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
  const jstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  console.log(`スクレイパー開始: ${jstNow.toISOString().replace('T', ' ').substring(0, 19)} (JST)`);
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

  // 1. 既存の sales.json キャッシュデータをロード
  const dataDir = path.join(__dirname, '../data');
  const filePath = path.join(dataDir, 'sales.json');
  let cachedBooks = [];
  try {
    if (fs.existsSync(filePath)) {
      cachedBooks = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      console.log(`[キャッシュ] 既存の sales.json から ${cachedBooks.length} 件のデータをロードしました。`);
    }
  } catch (cacheError) {
    console.warn('[キャッシュ] 既存キャッシュの読み込みに失敗しました:', cacheError.message);
  }

  // 収集したすべての本を格納する配列
  let allBooks = [];

  // 2. 各ストアからデータを収集（失敗時はキャッシュからレスキュー）
  
  // 2.1 楽天Kobo
  try {
    const koboBooks = await parseRakuten(rakutenAppId, rakutenAccessKey, rakutenAffiliateId);
    if (koboBooks && koboBooks.length > 0) {
      console.log(`[楽天Kobo] ${koboBooks.length} 件のデータを新規取得しました。`);
      allBooks = allBooks.concat(koboBooks);
    } else {
      throw new Error('取得件数が0件です');
    }
  } catch (koboError) {
    console.error('[楽天Kobo] 取得に失敗したため、キャッシュデータから復元します:', koboError.message);
    const koboCache = cachedBooks.filter(b => Object.keys(b.stores).includes('rakuten')).map(b => {
      // 楽天ストアデータだけを抽出した平坦なオブジェクトを再構成
      return {
        id: b.id,
        title: b.title,
        author: b.author,
        publisher: b.publisher,
        imageUrl: b.imageUrl,
        genre: b.genre,
        description: b.description,
        endDate: b.endDate,
        updatedAt: b.updatedAt,
        store: 'rakuten',
        url: b.stores.rakuten.url,
        originalPrice: b.stores.rakuten.originalPrice,
        salePrice: b.stores.rakuten.salePrice,
        discountRate: b.stores.rakuten.discountRate
      };
    });
    console.log(`[楽天Kobo] キャッシュから ${koboCache.length} 件を復元しました。`);
    allBooks = allBooks.concat(koboCache);
  }

  // 2.2 コミックシーモア
  try {
    const seimorBooks = await parseSeimor(vcSid, vcPid);
    if (seimorBooks && seimorBooks.length > 0) {
      console.log(`[シーモア] ${seimorBooks.length} 件のデータを新規取得しました。`);
      allBooks = allBooks.concat(seimorBooks);
    } else {
      throw new Error('取得件数が0件です');
    }
  } catch (seimorError) {
    console.error('[シーモア] 取得に失敗したため、キャッシュデータから復元します:', seimorError.message);
    const seimorCache = cachedBooks.filter(b => Object.keys(b.stores).includes('seimor')).map(b => {
      return {
        id: b.id,
        title: b.title,
        author: b.author,
        publisher: b.publisher,
        imageUrl: b.imageUrl,
        genre: b.genre,
        description: b.description,
        endDate: b.endDate,
        updatedAt: b.updatedAt,
        store: 'seimor',
        url: b.stores.seimor.url,
        originalPrice: b.stores.seimor.originalPrice,
        salePrice: b.stores.seimor.salePrice,
        discountRate: b.stores.seimor.discountRate
      };
    });
    console.log(`[シーモア] キャッシュから ${seimorCache.length} 件を復元しました。`);
    allBooks = allBooks.concat(seimorCache);
  }

  // 2.3 PR TIMES
  try {
    const prtimesBooks = await parsePrtimes();
    if (prtimesBooks && prtimesBooks.length > 0) {
      console.log(`[PR TIMES] ${prtimesBooks.length} 件のデータを新規取得しました。`);
      allBooks = allBooks.concat(prtimesBooks);
    } else {
      throw new Error('取得件数が0件です');
    }
  } catch (prtimesError) {
    console.error('[PR TIMES] 取得に失敗したため、キャッシュデータから復元します:', prtimesError.message);
    const prtimesCache = cachedBooks.filter(b => Object.keys(b.stores).includes('prtimes')).map(b => {
      return {
        id: b.id,
        title: b.title,
        author: b.author,
        publisher: b.publisher,
        imageUrl: b.imageUrl,
        genre: b.genre,
        description: b.description,
        endDate: b.endDate,
        updatedAt: b.updatedAt,
        store: 'prtimes',
        url: b.stores.prtimes.url,
        originalPrice: b.stores.prtimes.originalPrice,
        salePrice: b.stores.prtimes.salePrice,
        discountRate: b.stores.prtimes.discountRate
      };
    });
    console.log(`[PR TIMES] キャッシュから ${prtimesCache.length} 件を復元しました。`);
    allBooks = allBooks.concat(prtimesCache);
  }

  try {
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

    // 4. 期限切れセールの自動除外フィルタリング (JST本日以前のendDateを持つセールを除外)
    const todayStr = jstNow.toISOString().split('T')[0]; // JSTの本日 YYYY-MM-DD
    const activeBooks = finalBooks.filter(book => {
      if (!book.endDate) return true; // 終了日の指定がないものは残す
      return book.endDate >= todayStr; // 今日以降に終了するものは残す
    });
    console.log(`[フィルタ] 期限切れデータを自動除外: ${finalBooks.length}件 -> ${activeBooks.length}件`);

    // データの保存
    if (activeBooks.length > 0) {
      // 保存先ディレクトリが存在しない場合は作成
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(activeBooks, null, 2), 'utf-8');

      // public/sales.json にも保存（他サイトからのクロスフェッチ用）
      try {
        const publicDir = path.join(__dirname, '../../public');
        const publicFilePath = path.join(publicDir, 'sales.json');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        fs.writeFileSync(publicFilePath, JSON.stringify(activeBooks, null, 2), 'utf-8');
        console.log(`パブリックデータの書き込み完了: ${publicFilePath}`);
      } catch (publicError) {
        console.warn('パブリックディレクトリへのデータ書き込みに失敗しました:', publicError.message);
      }
      
      console.log('====================================');
      console.log(`データの書き込み完了: ${filePath}`);
      console.log(`合計 ${activeBooks.length} 件のデータを保存しました。`);
      console.log('====================================');
    } else {
      console.log('====================================');
      console.log('警告: 収集された有効データが0件のため、ファイル更新をスキップしました。');
      console.log('====================================');
    }

  } catch (error) {
    console.error('データ収集プロセス全体でエラーが発生しました:', error);
  }
}

// スクリプトの実行
run();
