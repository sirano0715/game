const { chromium } = require('playwright-chromium');

// メインの自動化処理
(async () => {
  let browser = null;
  let context = null; // ★★★ 変更点 ★★★
  try {
    console.log('🚀 自動化プロセスを開始します...');
    
    const email = process.env.XSERVER_EMAIL;
    const password = process.env.XSERVER_PASSWORD;

    if (!email || !password) {
      throw new Error('シークレット XSERVER_EMAIL または XSERVER_PASSWORD が設定されていません。');
    }

    browser = await chromium.launch({ headless: true });
    
    // ★★★ ここから変更 ★★★
    // 録画設定を有効にした新しいブラウザコンテキストを作成
    context = await browser.newContext({
      recordVideo: {
        dir: './videos/', // 'videos'というフォルダに保存
        size: { width: 1280, height: 720 } // 動画の解像度
      }
    });
    const page = await context.newPage();
    // ★★★ ここまで変更 ★★★

    console.log('ログインページに移動します...');
    await page.goto('https://secure.xserver.ne.jp/xapanel/login/xmgame');

    await page.getByLabel('XServerアカウントID または メールアドレス').fill(email);
    await page.getByLabel('パスワード').fill(password);
    await page.getByRole('button', { name: 'ログインする' }).click();
    console.log('✅ ログイン成功');

    await page.waitForURL('**/server/list');
    console.log('サーバー一覧ページに移動しました。');
    await page.getByRole('button', { name: 'ゲーム管理' }).click();
    console.log('✅ ゲーム管理ボタンをクリック');

    await page.waitForURL('**/server/detail/**');
    console.log('ゲームパネルに移動しました。');
    await page.getByRole('link', { name: 'アップグレード・期間延長' }).click();
    console.log('✅ アップグレード・期間延長ボタンをクリック');
    
    await page.waitForLoadState('networkidle');
    console.log('ページをスクロールします...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    const extendButton = page.getByRole('button', { name: '期間を延長する' }).first();
    const cannotExtendText = page.getByText('期間の延長は行えません');

    if (await extendButton.isVisible()) {
      console.log('延長ボタン(1/3)が見つかりました。クリックします...');
      await extendButton.click();
      
      console.log('確認画面に進むボタン(2/3)を探しています...');
      const confirmButton = page.getByRole('button', { name: '確認画面に進む' });
      await confirmButton.waitFor({ state: 'visible' });
      await confirmButton.click();
      console.log('✅ 確認画面に進むボタンをクリックしました。');

      console.log('最終確認ページに移動しました。最後の延長ボタン(3/3)を探します...');
      const finalExtendButton = page.getByRole('button', { name: '期間を延長する' });
      
      await finalExtendButton.waitFor({ state: 'visible' });
      await finalExtendButton.scrollIntoViewIfNeeded();
      
      console.log('最終延長ボタンをクリックします...');
      await finalExtendButton.click();

      await page.waitForLoadState('domcontentloaded');
      console.log('🎉🎉🎉 全ての延長プロセスが完了しました！');

    } else if (await cannotExtendText.isVisible()) {
      console.log('🟡 まだ延長可能な期間ではありません。処理をスキップします。');
    } else {
      console.log('❓ 予期しないページ状態です。');
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    // ★★★ 変更点 ★★★
    // コンテキストを閉じる処理を追加
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
    console.log('👋 プロセスを終了します。');
  }
})();
