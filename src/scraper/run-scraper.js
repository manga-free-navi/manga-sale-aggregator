const fs = require('fs');
const path = require('path');
require('dotenv').config();

// パーサーのインポート
const { parseRakuten } = require('./parsers/rakuten');
const { parseSeimor } = require('./parsers/seimor');
const { parsePrtimes } = require('./parsers/prtimes');

/**
 * すべてのストアからセール・無料情報を収集して保存するエントリーポイント
 */
async function run() {
  console.log('====================================');
  // 日本標準時 (JST) で現在日時を出力
  console.log(`スクレイパー開始: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
  console.log('====================================');

  // 環境変数から各種設定を取得
  const rakutenAppId = process.env.RAKUTEN_APP_ID || '';
  const rakutenAccessKey = process.env.RAKUTEN_ACCESS_KEY || '';
  const rakutenAffiliateId = process.env.RAKUTEN_AFFILIATE_ID || '';
  const vcSid = process.env.VC_SID || '';
  const vcPid = process.env.VC_PID || '';

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

    // 2. コミックシーモアからスクレイピングして収集
    const seimorBooks = await parseSeimor(vcSid, vcPid);
    console.log(`[シーモア] ${seimorBooks.length} 件のデータを取得しました。`);
    allBooks = allBooks.concat(seimorBooks);

    // 3. PR TIMES からプレスリリース（無料公開情報等）をスクレイピングして収集
    try {
      const prtimesBooks = await parsePrtimes();
      console.log(`[PR TIMES] ${prtimesBooks.length} 件のデータを取得しました。`);
      allBooks = allBooks.concat(prtimesBooks);
    } catch (prtimesError) {
      console.error('[PR TIMES] 収集プロセスでエラーが発生しましたが、続行します:', prtimesError.message);
    }


    // 3. 同一作品（同一巻）のストア間名寄せマージ処理
    const mergedMap = new Map();
    
    function cleanTitle(title) {
      let t = title;
      t = t.replace(/【[^】]*】/g, ' ');
      t = t.replace(/\[[^\]]*\]/g, ' ');
      t = t.replace(/\([^\)]*\)/g, ' ');
      t = t.replace(/（[^）]*）/g, ' ');
      t = t.replace(/期間限定/g, ' ');
      t = t.replace(/無料/g, ' ');
      t = t.replace(/セール/g, ' ');
      t = t.replace(/お試し/g, ' ');
      t = t.replace(/試し読み/g, ' ');
      t = t.replace(/\s+/g, '');
      return t.toLowerCase().trim();
    }

    allBooks.forEach((book) => {
      // タイトルと著者名を結合したキーで同一本かどうか判定
      const cleanedAuthor = (book.author || '不明').replace(/\s+/g, '');
      const key = `${cleanTitle(book.title)}_${cleanedAuthor}`;
      
      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          id: book.id,
          title: book.title.replace(/【期間限定無料】|【期間限定無料お試し版】|【期間限定無料冊子】|【セール】/g, '').trim(),
          author: book.author,
          publisher: book.publisher,
          imageUrl: book.imageUrl,
          genre: book.genre,
          description: book.description,
          endDate: book.endDate,
          updatedAt: book.updatedAt,
          stores: {}
        });
      }
      
      const mergedBook = mergedMap.get(key);
      // 各ストア固有の情報（URL、価格、割引率）を格納
      mergedBook.stores[book.store] = {
        url: book.url,
        originalPrice: book.originalPrice,
        salePrice: book.salePrice,
        discountRate: book.discountRate
      };
      
      // 画像がより高画質なものがあれば上書き
      if (!mergedBook.imageUrl && book.imageUrl) {
        mergedBook.imageUrl = book.imageUrl;
      }
      // 説明文の補完
      if ((!mergedBook.description || mergedBook.description.includes('お試し')) && book.description && !book.description.includes('お試し')) {
        mergedBook.description = book.description;
      }
      // より早い終了日時があれば採用
      if (book.endDate && (!mergedBook.endDate || new Date(book.endDate) < new Date(mergedBook.endDate))) {
        mergedBook.endDate = book.endDate;
      }
    });

    const finalBooks = Array.from(mergedMap.values());
    console.log(`[名寄せ] ストア間で重複する書籍を統合: ${allBooks.length}件 -> ${finalBooks.length}件`);

    // データの保存
    if (finalBooks.length > 0) {
      const dataDir = path.join(__dirname, '../data');
      
      // 保存先ディレクトリが存在しない場合は作成
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const filePath = path.join(dataDir, 'sales.json');
      fs.writeFileSync(filePath, JSON.stringify(finalBooks, null, 2), 'utf-8');
      
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
