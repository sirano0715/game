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
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'ログインする' }).click();
    console.log('✅ ログイン成功');

    // --- 3. 延長処理の実行 ---
    await page.waitForURL('**/server/list');
    console.log('サーバー一覧ページに移動しました。');
    await page.getByRole('button', { name: 'ゲーム管理' }).click();
    console.log('✅ ゲーム管理ボタンをクリック');

    await page.waitForURL('**/server/detail/**');
    await page.getByRole('link', { name: 'アップグレード・期間延長' }).click();
    console.log('✅ アップグレード・期間延長ボタンをクリック');
    
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    const extendButton = page.getByRole('button', { name: '期間を延長する' }).first();
    const cannotExtendText = page.getByText('期間の延長は行えません');

    // --- 4. 条件分岐 ---
    if (await extendButton.isVisible()) {
      console.log('延長ボタン(1/3)が見つかりました。クリックします...');
      await extendButton.click();
      
      const confirmButton = page.getByRole('button', { name: '確認画面に進む' });
      await confirmButton.waitFor({ state: 'visible' });
      await confirmButton.click();
      console.log('✅ 確認画面に進むボタン(2/3)をクリックしました。');

      const finalExtendButton = page.getByRole('button', { name: '期間を延長する' });
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
    // エラーが発生した場合、プロセスを失敗で終了させる
    process.exit(1);
  } finally {
    // --- 5. 後処理 ---
    if (context) {
      // 動画ファイルが正常に保存されるのを待つ
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
    console.log('👋 プロセスを終了します。');
  }
})();
