const fs = require('fs');
const path = require('path');
require('dotenv').config();

// パーサーのインポート
const { parseRakuten } = require('./parsers/rakuten');
const { parseSeimor } = require('./parsers/seimor');

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
  try {
    // 各書籍の stores から各種情報を抽出するヘルパー
    function isBookFree(book) {
      return Object.values(book.stores || {}).some(s => s && s.salePrice === 0);
    }

    function isBookSale(book) {
      return Object.values(book.stores || {}).some(s => s && s.salePrice > 0 && s.discountRate >= 30);
    }

    function getMaxDiscountRate(book) {
      const rates = Object.values(book.stores || {}).map(s => s ? s.discountRate : 0);
      return rates.length > 0 ? Math.max(...rates) : 0;
    }

    // 3. 同一作品（同一巻）のストア間名寄せマージ処理
    const mergedMap = new Map();
    
    function cleanTitle(title) {
      let t = title;
      // 不要な装飾やセール文言（【】や［］）を削除
      t = t.replace(/【[^】]*】/g, ' ');
      t = t.replace(/\[[^\]]*\]/g, ' ');
      
      // かっこ内にセール・期間関連のキーワードがある場合のみ、そのかっこを丸ごと消去
      t = t.replace(/（期間限定[^）]*）/g, ' ');
      t = t.replace(/\(期間限定[^\)]*\)/g, ' ');
      t = t.replace(/（分冊版[^）]*）/g, ' ');
      t = t.replace(/\(分冊版[^\)]*\)/g, ' ');
      t = t.replace(/（無料[^）]*）/g, ' ');
      t = t.replace(/\(無料[^\)]*\)/g, ' ');
      
      // 残ったかっこ記号自体を取り除く（かっこ内の巻数表記などは残す）
      t = t.replace(/[\(\)（）\{\}｛｝]/g, '');
      
      // ノイズワードを消去
      t = t.replace(/期間限定/g, ' ');
      t = t.replace(/無料/g, ' ');
      t = t.replace(/セール/g, ' ');
      t = t.replace(/お試し/g, ' ');
      t = t.replace(/試し読み/g, ' ');
      t = t.replace(/お試し版/g, ' ');
      
      // 空白の除去
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

    // 3.5 「1巻のみ無料」の作品を除外するフィルタリング処理
    
    // タイトルから巻数（数字）を抽出するヘルパー
    function extractVolumeNumber(title) {
      // 全角数字を半角に正規化
      let t = title.replace(/[０-９]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
      });
      
      // かっこ内の割引率表記 (50% OFF など) やお試し・見本などのノイズを事前に消去
      t = t.replace(/[\(（]\s*\d+\s*[％%]\s*OFF\s*[\)）]/i, ' ');
      t = t.replace(/[\(（]\s*\d+\s*[％%]\s*割引\s*[\)）]/i, ' ');
      t = t.replace(/[\(（]\s*\d+\s*[％%]\s*引き\s*[\)）]/i, ' ');
      t = t.replace(/【[^】]*】/g, ' ').replace(/\[[^\]]*\]/g, ' ');
      
      // 第X巻、X巻、X話、X作目
      let match = t.match(/第?\s*(\d+)\s*[巻話作]/);
      if (match) return parseInt(match[1], 10);
      
      // かっこ内の数字 (X) や （X）
      match = t.match(/[\(（](\d+)[\)）]/);
      if (match) return parseInt(match[1], 10);
      
      // act.X や vol.X などの表記
      match = t.match(/(?:act|vol|volume|no|#)\.?\s*(\d+)/i);
      if (match) return parseInt(match[1], 10);
      
      // 末尾の数字（スペースのあとの数字など）
      match = t.match(/\s+(\d+)\s*$/);
      if (match) return parseInt(match[1], 10);
      
      // 単独の数字（タイトルの最後にある数字など）
      match = t.match(/(\d+)\s*$/);
      if (match) return parseInt(match[1], 10);
      
      return null;
    }

    // シリーズをグループ化するためのベースキー作成用（巻数表記を極力排除）
    function getSeriesBaseKey(title, author) {
      let t = title;
      // 全角数字を半角に
      t = t.replace(/[０-９]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
      });
      
      t = t.replace(/【[^】]*】/g, ' ');
      t = t.replace(/\[[^\]]*\]/g, ' ');
      
      // 先にかっこ内の割引率表記やノイズを消去する
      t = t.replace(/\([^\)]*\)/g, ' ');
      t = t.replace(/（[^）]*）/g, ' ');
      t = t.replace(/期間限定/g, ' ');
      t = t.replace(/無料/g, ' ');
      t = t.replace(/セール/g, ' ');
      t = t.replace(/お試し/g, ' ');
      t = t.replace(/試し読み/g, ' ');
      
      // act.X, vol.X, no.X, #X などの巻数ワード＋数字を消去
      t = t.replace(/(?:act|vol|volume|no|#)\.?\s*\d+/i, ' ');
      
      // 第X巻, X巻, X話, X作目 などの巻数文字を消去
      t = t.replace(/第?\s*\d+\s*[巻話作]/g, ' ');
      
      // かっこ内の数字 (X) や （X） を消去
      t = t.replace(/[\(（]\d+[\)）]/g, ' ');
      
      // 末尾の数字や単独の数字を消去
      t = t.replace(/\s+\d+\s*$/g, ' ');
      t = t.replace(/\d+\s*$/g, ' ');
      t = t.replace(/\s+/g, '');
      
      const cleanedAuthor = (author || '不明').replace(/\s+/g, '');
      return `${t.toLowerCase().trim()}_${cleanedAuthor}`;
    }

    // 小説・雑誌・体験版等のブラックリストワード
    const blacklist = [
      'ジャーロ', 'コバルト文庫', '小説', '文庫', 'ライトノベル', 'ラノベ', 
      '雑誌', '体験版', 'ダイジェスト', '試し読み集', '試し読み版', '読本', 
      'カタログ', 'パンフレット', '画集', 'ファンブック', '設定資料集',
      '試し読み', '合本', 'ブックレット', '小冊子', 'エッセイ', '自伝', 'ルポ',
      '単行本', '新書', 'ノベル', 'アンソロジー', '短編集', '羊の平和', '「さあ、どんでん返しだ。」'
    ];

    // ブラックリストによる非コミック等の除外
    const filteredByBlacklist = finalBooks.filter(book => {
      const isBlacklisted = blacklist.some(word => book.title.includes(word));
      if (isBlacklisted) {
        console.log(`[ブラックリスト除外] ${book.title} (著者: ${book.author})`);
      }
      return !isBlacklisted;
    });

    // デバッグログ：名寄せ後のセール本（有料・割引率30%以上）の件数とタイトルを出力
    const rawSales = filteredByBlacklist.filter(b => isBookSale(b));
    console.log(`[デバッグ] 名寄せ後のセール本（30%以上割引）の総件数: ${rawSales.length}件`);
    if (rawSales.length > 0) {
      console.log(`[デバッグ] セール本（最初の5件）:`);
      rawSales.slice(0, 5).forEach(b => {
        console.log(`  - Title: ${b.title}, Price: ${Object.values(b.stores).map(s=>s.salePrice).join(',')}, Rates: ${Object.values(b.stores).map(s=>s.discountRate).join(',')}`);
      });
    }

    // 各書籍に巻数情報を付与
    const booksWithVol = filteredByBlacklist.map(book => {
      return {
        ...book,
        volumeNum: extractVolumeNumber(book.title)
      };
    });

    // シリーズごとにマッピング
    const seriesMap = new Map();
    booksWithVol.forEach(book => {
      const seriesKey = getSeriesBaseKey(book.title, book.author);
      if (!seriesMap.has(seriesKey)) {
        seriesMap.set(seriesKey, []);
      }
      seriesMap.get(seriesKey).push(book);
    });

    const nonSingleVolumeFreeBooks = [];
    seriesMap.forEach((group, seriesKey) => {
      // 1. 同一シリーズ内から通常定価（0円を除く最高販売価格）を推定
      const prices = group.map(b => {
        return Object.values(b.stores || {}).map(s => s ? s.salePrice : 0);
      }).flat().filter(p => p > 0);
      
      let estimatedOriginalPrice = prices.length > 0 ? Math.max(...prices) : 0;
      
      // 推定定価が一般的なコミック定価（350円）より低い場合、セール価格しか取得できていないと判断し、標準定価（500円）を適用
      if (estimatedOriginalPrice > 0 && estimatedOriginalPrice < 350) {
        estimatedOriginalPrice = 500;
      }
      
      // 2. 推定された定価を元に、各巻の割引率 (discountRate) を逆算・補正する
      group.forEach(book => {
        if (!book.stores) return;
        Object.keys(book.stores).forEach(storeKey => {
          const storeData = book.stores[storeKey];
          if (!storeData) return;
          
          if (storeData.salePrice === 0) {
            storeData.discountRate = 100;
            storeData.originalPrice = estimatedOriginalPrice > 0 ? estimatedOriginalPrice : 500;
          } else if (estimatedOriginalPrice > 0 && storeData.salePrice < estimatedOriginalPrice) {
            // 定価より販売価格が安い場合、割引率を逆算
            const calcRate = Math.round((estimatedOriginalPrice - storeData.salePrice) / estimatedOriginalPrice * 100);
            if (!storeData.discountRate || calcRate > storeData.discountRate) {
              storeData.discountRate = calcRate;
            }
            storeData.originalPrice = estimatedOriginalPrice;
          } else {
            // 定価と同じか高い場合
            storeData.originalPrice = estimatedOriginalPrice > 0 ? estimatedOriginalPrice : storeData.salePrice;
            if (!storeData.discountRate) {
              storeData.discountRate = 0;
            }
          }
        });
      });

      // 巻数（数字）のリストを抽出してソート
      const vols = group.map(b => b.volumeNum).filter(v => v !== null).sort((a, b) => a - b);
      const freeVols = group.filter(b => isBookFree(b)).map(b => b.volumeNum).filter(v => v !== null).sort((a, b) => a - b);
      const saleVols = group.filter(b => isBookSale(b)).map(b => b.volumeNum).filter(v => v !== null).sort((a, b) => a - b);
      
      if (group[0].title.includes('アオハライド')) {
        console.log(`[デバッグ・アオハライド] vols: ${JSON.stringify(vols)}, freeVols: ${JSON.stringify(freeVols)}, saleVols: ${JSON.stringify(saleVols)}, groupLength: ${group.length}`);
      }
      
      if (vols.length > 0) {
        // 無料本があり、それが1巻のみである場合
        const hasFree = group.some(b => isBookFree(b));
        if (hasFree) {
          const onlyHasVolumeOneFree = freeVols.length === 1 && freeVols[0] === 1;
          // 無料本が1巻のみで、かつ有料セール本（30%以上）も他に伴っていない場合
          if (onlyHasVolumeOneFree && saleVols.length === 0) {
            console.log(`[除外] 1巻のみ無料（他巻セールなし）のため除外: ${group[0].title} (著者: ${group[0].author})`);
            return; // シリーズ全体を除外
          }
        }
      } else {
        // 巻数が一切判定できなかったシリーズは、小説や単発本の可能性が高いため丸ごと除外
        console.log(`[除外] 巻数不明（非コミックの可能性あり）のため除外: ${group[0].title} (著者: ${group[0].author})`);
        return;
      }
      
      // シリーズ状態を示すテキストの自動生成 (volsFreeText)
      let volsFreeText = "";
      if (freeVols.length > 0 && saleVols.length === 0) {
        // すべて無料の場合
        const minVol = freeVols[0];
        const maxVol = freeVols[freeVols.length - 1];
        if (minVol === maxVol) {
          volsFreeText = `${minVol}巻無料`;
        } else {
          volsFreeText = `${minVol}〜${maxVol}巻無料`;
        }
      } else if (freeVols.length === 0 && saleVols.length > 0) {
        // すべてセール（有料）の場合
        const maxDiscount = Math.max(...group.map(b => getMaxDiscountRate(b)));
        const minVol = saleVols[0];
        const maxVol = saleVols[saleVols.length - 1];
        if (minVol === maxVol) {
          volsFreeText = `${minVol}巻 ${maxDiscount}%OFF`;
        } else {
          volsFreeText = `${minVol}〜${maxVol}巻 ${maxDiscount}%OFF〜`;
        }
      } else if (freeVols.length > 0 && saleVols.length > 0) {
        // 無料とセール混在の場合
        const minFreeVol = freeVols[0];
        const maxFreeVol = freeVols[freeVols.length - 1];
        let freePart = minFreeVol === maxFreeVol ? `${minFreeVol}巻無料` : `${minFreeVol}〜${maxFreeVol}巻無料`;
        volsFreeText = `${freePart} ＆ 続巻セール`;
      }
      
      // シリーズ内の全巻を保存リストに追加（フロントの巻数選択UIと連動させるため）
      group.forEach(book => {
        // タイトルから不要な装飾を除去
        const cleanedTitle = book.title.replace(/【期間限定無料】|【期間限定無料お試し版】|【期間限定無料冊子】|【セール】/g, '').trim();
        
        // 既存オブジェクトのクリーンアップと volsFreeText のセット
        const mergedBook = {
          id: book.id,
          title: cleanedTitle,
          author: book.author,
          publisher: book.publisher,
          imageUrl: book.imageUrl,
          genre: book.genre,
          description: book.description,
          endDate: book.endDate,
          updatedAt: book.updatedAt,
          volsFreeText: volsFreeText,
          stores: { ...book.stores } // すべてのストア情報をマージされた状態で維持
        };
        
        // 重複チェックして保存
        const existing = nonSingleVolumeFreeBooks.find(b => b.id === mergedBook.id);
        if (existing) {
          // すでに同一巻が存在する場合、店舗データをマージ
          existing.stores = { ...existing.stores, ...mergedBook.stores };
          if (!existing.imageUrl && mergedBook.imageUrl) {
            existing.imageUrl = mergedBook.imageUrl;
          }
          if ((!existing.description || existing.description.includes('お試し')) && mergedBook.description && !mergedBook.description.includes('お試し')) {
            existing.description = mergedBook.description;
          }
        } else {
          nonSingleVolumeFreeBooks.push(mergedBook);
        }
      });
    });

    console.log(`[フィルタ] 1巻のみ無料の作品を除外: ${filteredByBlacklist.length}件 -> ${nonSingleVolumeFreeBooks.length}件`);

    // 4. 期限切れセールの自動除外フィルタリング (JST本日以前のendDateを持つセールを除外)
    const todayStr = jstNow.toISOString().split('T')[0]; // JSTの本日 YYYY-MM-DD
    const activeBooks = nonSingleVolumeFreeBooks.filter(book => {
      if (!book.endDate) return true; // 終了日の指定がないものは残す
      return book.endDate >= todayStr; // 今日以降に終了するものは残す
    });
    console.log(`[フィルタ] 期限切れデータを自動除外: ${nonSingleVolumeFreeBooks.length}件 -> ${activeBooks.length}件`);

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
