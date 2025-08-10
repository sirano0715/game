const { chromium } = require('playwright-chromium');

(async () => {
  let browser = null;
  let context = null;
  console.log('🚀 自動化プロセスを開始します...');

  try {
    // --- 1. 準備 ---
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

    // --- 2. ログイン処理 ---
    console.log('ログインページに移動します...');
    await page.goto('https://secure.xserver.ne.jp/xapanel/login/xmgame');
    
    await page.locator('#memberid').fill(email);
    await page.locator('#user_password').fill(password);
    await page.locator('input[value="ログインする"]').click();
    console.log('✅ ログイン成功');

    // --- 3. 延長処理の実行 ---
    await page.waitForURL('**/xmgame/index'); // ログイン後のURL
    console.log('サーバー一覧ページに移動しました。');
    await page.getByRole('link', { name: 'ゲーム管理' }).click();
    console.log('✅ ゲーム管理ボタンをクリック');

    // ★★★ ここから、いただいたURLをすべて反映 ★★★
    await page.waitForURL('**/xmgame/game/index'); // ゲーム管理クリック後のURL
    await page.getByRole('link', { name: 'アップグレード・期限延長' }).click();
    console.log('✅ アップグレード・期限延長ボタンをクリック');
    
    await page.waitForURL('**/game/freeplan/extend/index');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    const extendButton1 = page.getByRole('link', { name: '期限を延長する' });
    const cannotExtendText = page.getByText('期間の延長は行えません');

    // --- 4. 条件分岐 ---
    if (await extendButton1.isVisible()) {
      console.log('延長ボタン(1/3)が見つかりました。クリックします...');
      await extendButton1.click();
      
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
      console.log('🎉🎉🎉 全ての延長プロセスが完了しました！');

    } else if (await cannotExtendText.isVisible()) {
      console.log('🟡 まだ延長可能な期間ではありません。処理をスキップします。');
    } else {
      throw new Error('予期しないページ状態です。延長ボタンまたはメッセージが見つかりませんでした。');
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  } finally {
    // --- 5. 後処理 ---
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
    console.log('👋 プロセスを終了します。');
  }
})();
