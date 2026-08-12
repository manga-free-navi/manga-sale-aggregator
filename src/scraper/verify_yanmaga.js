const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Playwrightを起動しています...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 画面解像度を設定
  await page.setViewportSize({ width: 1400, height: 1200 });

  console.log('ローカルサーバー（http://localhost:3000/manga-sale-aggregator）にアクセスしています...');
  try {
    await page.goto('http://localhost:3000/manga-sale-aggregator', { waitUntil: 'load', timeout: 15000 });
  } catch (gotoError) {
    console.log('loadイベント待機がタイムアウトしたため、ネットワーク安定を待ちます...');
    await page.waitForTimeout(5000);
  }

  // 初期ロードとレンダリングの安定化待機
  await page.waitForTimeout(4000);

  console.log('ヤンマガWebフィルターを探しています...');
  // フィルターボタンテキスト「🔥 ヤンマガWeb」を検索してクリック
  const filterBtn = page.locator('button:has-text("ヤンマガWeb")');
  
  if (await filterBtn.count() > 0) {
    console.log('ヤンマガWebフィルターボタンを発見しました。クリックします。');
    await filterBtn.click();
    
    // フィルタリングと再レンダリングの待機
    await page.waitForTimeout(4000);
    
    // 書籍リストが表示されている位置まで少しスクロール
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1000);
    
    const screenshotPath = path.join(__dirname, '../../public/yanmaga_ui_success.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`検証用スクリーンショットの保存に成功しました: ${screenshotPath}`);
  } else {
    console.error('エラー: 「🔥 ヤンマガWeb」ボタンが見つかりませんでした！');
    const buttons = await page.locator('button').allTextContents();
    console.log('見つかったボタン一覧:', buttons);
  }

  await browser.close();
  console.log('検証完了。');
})();
