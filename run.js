const { chromium } = require('playwright-chromium');

// Discordに通知を送る関数
async function notifyDiscord(fetch, status, message) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('Discord Webhook URLが設定されていないため、通知をスキップします。');
    return;
  }

  const color = {
    '🎉成功🎉': 65280, // 緑
    '🟡情報🟡': 16776960, // 黄
    '❌失敗❌': 16711680, // 赤
  }[status] || 8421504; // グレー

  const body = {
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
    if (response.ok) {
      console.log('✅ Discordへの通知が成功しました。');
    } else {
      console.error(`❌ Discordへの通知に失敗しました: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Discord通知中にエラーが発生しました:', error.message);
  }
}


(async () => {
  const { default: fetch } = await import('node-fetch');
  
  let browser = null;
  let context = null;
  console.log('🚀 自動化プロセスを開始します...');

  try {
    const email = process.env.XSERVER_EMAIL;
    const password = process.env.XSERVER_PASSWORD;

    if (!email || !password) {
      throw new Error('シークレット XSERVER_EMAIL または XSERVER_PASSWORD が設定されていません。');
    }

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      recordVideo: { dir: './videos/' },
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    console.log('ログインページに移動します...');
    await page.goto('https://secure.xserver.ne.jp/xapanel/login/xmgame');
    
    await page.locator('#memberid').fill(email);
    await page.locator('#user_password').fill(password);
    await page.locator('input[value="ログインする"]').click();
    console.log('✅ ログイン成功');
    
    await page.waitForURL('**/xmgame/index');
    console.log('サーバー一覧ページに移動しました。');
    await page.getByRole('link', { name: 'ゲーム管理' }).click();
    console.log('✅ ゲーム管理ボタンをクリック');

    await page.waitForURL('**/xmgame/game/index');
    await page.getByRole('link', { name: 'アップグレード・期限延長' }).click();
    console.log('✅ アップグレード・期限延長ボタンをクリック');
    
    await page.waitForURL('**/game/freeplan/extend/index');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    console.log('延長可能か、または延長不可メッセージがあるかを確認します...');
    const extendButtonLocator = page.getByRole('link', { name: '期限を延長する' });
    // ★★★ ここをクラス名で指定するように修正 ★★★
    const cannotExtendLocator = page.locator('.freePlanMessage');

    await Promise.race([
        extendButtonLocator.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
        cannotExtendLocator.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
    ]);

    if (await extendButtonLocator.isVisible()) {
      console.log('延長ボタン(1/3)が見つかりました。クリックします...');
      await extendButtonLocator.click();
      
      await page.waitForURL('**/game/freeplan/extend/input');
      const confirmButton = page.getByRole('button', { name: '確認画面に進む' });
      await confirmButton.waitFor({ state: 'visible' });
      await confirmButton.click();
      console.log('✅ 確認画面に進むボタン(2/3)をクリックしました。');

      await page.waitForURL('**/game/freeplan/extend/conf');
      const finalExtendButton = page.getByRole('button', { name: '期限を延長する' });
      await finalExtendButton.waitFor({ state: 'visible' });
      await finalExtendButton.scrollIntoViewIfNeeded();
      await finalExtendButton.click();
      console.log('✅ 最終延長ボタン(3/3)をクリックしました。');

      await page.waitForLoadState('domcontentloaded');
      const successMessage = 'サーバー期間の延長が完了しました！';
      console.log(`🎉🎉🎉 ${successMessage}`);
      await notifyDiscord(fetch, '🎉成功🎉', successMessage);

    } else if (await cannotExtendLocator.isVisible()) {
      const infoMessage = 'まだ延長可能な期間ではありません。処理をスキップします。';
      console.log(`🟡 ${infoMessage}`);
      await notifyDiscord(fetch, '🟡情報🟡', infoMessage);
    } else {
      throw new Error('予期しないページ状態です。延長ボタンまたは延長不可メッセージが見つかりませんでした。');
    }

  } catch (error) {
    const errorMessage = `エラーが発生しました: ${error.message}`;
    console.error(`❌ ${errorMessage}`);
    await notifyDiscord(fetch, '❌失敗❌', errorMessage);
    process.exit(1);
  } finally {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
    console.log('👋 プロセスを終了します。');
  }
})();
