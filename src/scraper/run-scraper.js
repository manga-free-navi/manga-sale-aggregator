const fs = require('fs');
const path = require('path');
require('dotenv').config();

// パーサーのインポート
const { parseRakuten } = require('./parsers/rakuten');

/**
 * すべてのストアからセール・無料情報を収集して保存するエントリーポイント
 */
async function run() {
  console.log('====================================');
  // 日本標準時 (JST) で現在日時を出力
  console.log(`スクレイパー開始: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
  console.log('====================================');

  // 環境変数から楽天APIの設定を取得
  const rakutenAppId = process.env.RAKUTEN_APP_ID || '';
  const rakutenAccessKey = process.env.RAKUTEN_ACCESS_KEY || '';
  const rakutenAffiliateId = process.env.RAKUTEN_AFFILIATE_ID || '';

  if (!rakutenAppId || !rakutenAccessKey) {
    console.log('[情報] RAKUTEN_APP_ID または RAKUTEN_ACCESS_KEY が未設定のため、開発用モックデータ生成に切り替えます。');
  }

  // 収集したすべての本を格納する配列
  let allBooks = [];

  try {
    // 1. 楽天Kobo APIからデータを収集 (新仕様に合わせてアクセスキーも渡す)
    const koboBooks = await parseRakuten(rakutenAppId, rakutenAccessKey, rakutenAffiliateId);
    console.log(`[楽天Kobo] ${koboBooks.length} 件のデータを取得しました。`);
    allBooks = allBooks.concat(koboBooks);

    // データの保存
    if (allBooks.length > 0) {
      const dataDir = path.join(__dirname, '../data');
      
      // 保存先ディレクトリが存在しない場合は作成
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const filePath = path.join(dataDir, 'sales.json');
      fs.writeFileSync(filePath, JSON.stringify(allBooks, null, 2), 'utf-8');
      
      console.log('====================================');
      console.log(`データの書き込み完了: ${filePath}`);
      console.log(`合計 ${allBooks.length} 件のデータを保存しました。`);
      console.log('====================================');
    } else {
      console.log('====================================');
      console.log('警告: 収集されたデータが0件のため、ファイル更新をスキップしました。');
      console.log('====================================');
    }

  } catch (error) {
    console.error('データ収集プロセス全体でエラーが発生しました:', error);
  }
}

// スクリプトの実行
run();
