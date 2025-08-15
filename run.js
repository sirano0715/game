const { chromium } = require('playwright-chromium');

async function notifyDiscord(fetch, status, message, gameName) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('Discord Webhook URLが設定されていないため、通知をスキップします。');
    return;
  }
  if (status === '情報') {
    console.log('更新不要のため、Discord通知をスキップします。');
    return;
  }

  const color = { '成功': 65280, '失敗': 16711680 }[status] || 8421504;
  const webhookUsername = gameName ? `Xserver GAMEs 更新情報 ${gameName}鯖` : 'Xserver GAMEs 更新情報';

  const body = {
    username: webhookUsername,
    embeds: [{
      title: `XServer GAMES 自動延長 (${status})`,
      description: message,
      color: color,
      timestamp: new Date(),
    }],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.ok) console.log('Discordへの通知が成功しました。');
    else console.error(`Discordへの通知に失敗しました: ${response.status}`);
  } catch (error) {
    console.error('Discord通知中にエラーが発生しました:', error.message);
  }
}


(async () => {
  const { default: fetch } = await import('node-fetch');
  
  let browser = null;
  let context = null;
  let gameName = null;
  console.log('自動化プロセスを開始します...');

  try {
    const email = process.env.XSERVER_EMAIL;
    const password = process.env.XSERVER_PASSWORD;
    if (!email || !password) throw new Error('シークレットが設定されていません。');

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      recordVideo: { dir: './videos/' },
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    console.log('ログインページに移動しています。');
    await page.goto('https://secure.xserver.ne.jp/xapanel/login/xmgame');
    
    await page.locator('#memberid').fill(email);
    await page.locator('#user_password').fill(password);
    await page.locator('input[value="ログインする"]').click();
    console.log('正常にログインが完了しました。');
    
    // ★★★ waitForURL → waitForLoadState に変更 ★★★
    await page.waitForLoadState('networkidle');
    console.log('サーバー一覧ページに正常に移動しました。');

    const freeServerRow = page.locator('tr:has(span.freeServerIco)');
    
    const gameNameElement = freeServerRow.locator('.svpGamesName');
    const fullText = await gameNameElement.textContent();
    const spanText = await gameNameElement.locator('.GamesType').textContent();
    gameName = fullText.replace(spanText, '').trim();
    console.log(`ゲーム名「${gameName}」を正常に取得しました。`);
    
    await freeServerRow.getByRole('link', { name: 'ゲーム管理' }).click();
    console.log('無料サーバーの「ゲーム管理」ボタンを正常にクリックしました。');

    // ★★★ waitForURL → waitForLoadState に変更 ★★★
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'アップグレード・期限延長' }).click();
    console.log('アップグレード・期限延長ボタンを正常にクリックしました。');
    
    // ★★★ waitForURL → waitForLoadState に変更 ★★★
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    console.log('延長可能か、または延長不可メッセージがあるかを確認します。');
    const extendButtonLocator = page.getByRole('link', { name: '期限を延長する' });
    const cannotExtendLocator = page.locator('.freePlanMessage');

    await Promise.race([
        extendButtonLocator.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
        cannotExtendLocator.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
    ]);

    if (await extendButtonLocator.isVisible()) {
      console.log('延長ボタン(1/3)が正常に見つかりました。');
      await extendButtonLocator.click();
      
      await page.waitForLoadState('networkidle');
      const confirmButton = page.getByRole('button', { name: '確認画面に進む' });
      await confirmButton.waitFor({ state: 'visible' });
      await confirmButton.click();
      console.log('確認画面に進むボタン(2/3)を正常にクリックしました。');

      await page.waitForLoadState('networkidle');
      const finalExtendButton = page.getByRole('button', { name: '期限を延長する' });
      await finalExtendButton.waitFor({ state: 'visible' });
      await finalExtendButton.scrollIntoViewIfNeeded();
      await finalExtendButton.click();
      console.log('最終延長ボタン(3/3)を正常にクリックしました。');

      await page.waitForLoadState('domcontentloaded');
      const successMessage = 'サーバー期間の延長が正常に完了しました！';
      console.log(`更新完了 ${successMessage}`);
      await notifyDiscord(fetch, '成功', successMessage, gameName);

    } else if (await cannotExtendLocator.isVisible()) {
      const infoMessage = 'まだ延長可能な期間ではありません。処理をスキップします。';
      console.log(`${infoMessage}`);
      await notifyDiscord(fetch, '情報', infoMessage, gameName);
    } else {
      throw new Error('予期しないページ状態です。延長ボタンまたは延長不可メッセージが見つかりませんでした。');
    }

  } catch (error) {
    const errorMessage = `エラーが発生しました: ${error.message}`;
    console.error(`${errorMessage}`);
    await notifyDiscord(fetch, '失敗', errorMessage, gameName);
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    console.log('プロセスを終了します。');
  }
})();
