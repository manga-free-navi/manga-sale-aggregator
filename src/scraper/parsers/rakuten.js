const axios = require('axios');

/**
 * 楽天Kobo電子書籍検索APIを利用して無料漫画情報を取得するパーサー
 * @param {string} appId - 楽天デベロッパーID (Application ID)
 * @param {string} accessKey - 楽天アクセスキー (Access Key)
 * @param {s/**
 * タイトルから割引率（％）を抽出するヘルパー関数
 * @param {string} title - 書籍のタイトル
 * @returns {number|null} 抽出された割引率。見つからない場合はnull
 */
function extractDiscountRateFromTitle(title) {
  let t = title.replace(/％/g, '%');
  
  // 30% OFF, 50%OFF などのパターン
  let match = t.match(/(\d+)\s*%\s*OFF/i);
  if (match) return parseInt(match[1], 10);
  
  // 30%割引, 30%引き などのパターン
  match = t.match(/(\d+)\s*%\s*割引/);
  if (match) return parseInt(match[1], 10);
  match = t.match(/(\d+)\s*%\s*引き/);
  if (match) return parseInt(match[1], 10);
  
  // 「半額」パターン
  if (t.includes('半額')) return 50;
  
  // 「3割引」などのパターン
  match = t.match(/(\d+)\s*割引き?/);
  if (match) return parseInt(match[1], 10) * 10;
  
  return null;
}

async function parseRakuten(appId, accessKey, affiliateId) {
  const books = [];

  // アプリIDまたはアクセスキーが設定されていない、またはダミー値の場合はモックデータを返す
  if (
    !appId || appId === 'dummy_app_id' || appId.startsWith('dummy') ||
    !accessKey || accessKey === 'dummy_access_key' || accessKey.startsWith('dummy')
  ) {
    console.log('[楽天Kobo] 有効な RAKUTEN_APP_ID または RAKUTEN_ACCESS_KEY が設定されていません。開発用のモックデータを生成します。');
    return generateMockRakutenData();
  }

  // 新しい楽天APIエンドポイント（openapi.rakuten.co.jp）
  const url = 'https://openapi.rakuten.co.jp/services/api/Kobo/EbookSearch/20170426';

  try {
    console.log(`[楽天Kobo] APIリクエスト開始 (無料本＆セール本の個別収集)`);

    // 収集パラメータの定義
    // 無料本: 価格の安い順ソート (0円本を優先収集)
    // セール本: 標準ソート (セールやOFFのキーワードでおすすめ度の高い本を収集)
    const queries = [
      {
        keyword: '無料',
        sort: '+itemPrice', // 0円本を最優先で収集
        maxPages: { '101901': 5, '101902': 3 }
      },
      {
        keyword: '無料',
        sort: 'sales', // 売上順で現在人気のセール・無料キャンペーン本を収集
        maxPages: { '101901': 4, '101902': 2 }
      },
      {
        keyword: '無料',
        sort: 'standard', // 標準おすすめ順でセール本を収集
        maxPages: { '101901': 3, '101902': 2 }
      },
      {
        keyword: 'セール',
        sort: 'sales', // 有料セール本を売上順で収集
        maxPages: { '101901': 3, '101902': 2 }
      },
      {
        keyword: '割引',
        sort: 'sales', // 割引本を売上順で収集
        maxPages: { '101901': 2, '101902': 1 }
      },
      {
        keyword: 'OFF',
        sort: 'sales', // OFF表記の本を売上順で収集
        maxPages: { '101901': 2, '101902': 1 }
      }
    ];

    const genres = [
      { id: '101901', name: '少年・青年漫画' },
      { id: '101902', name: '少女・レディース漫画' }
    ];

    for (const query of queries) {
      console.log(`[楽天Kobo] キーワード: "${query.keyword}" (ソート: ${query.sort}) の収集を開始します...`);

      for (const genre of genres) {
        const maxPage = query.maxPages[genre.id];
        console.log(`[楽天Kobo] ジャンル: ${genre.name} (${genre.id}) - 最大 ${maxPage} ページ`);

        for (let page = 1; page <= maxPage; page++) {
          const params = {
            applicationId: appId,
            accessKey: accessKey,
            format: 'json',
            keyword: query.keyword,
            koboGenreId: genre.id,
            hits: 30,
            page: page,
            sort: query.sort,
          };

          if (affiliateId && affiliateId !== 'dummy_affiliate_id') {
            params.affiliateId = affiliateId;
          }

          let response = null;
          let retries = 3;
          while (retries > 0) {
            try {
              response = await axios.get(url, {
                params,
                headers: {
                  'Referer': 'https://github.io/',
                  'Origin': 'https://github.io',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 10000
              });
              break; // リクエスト成功
            } catch (err) {
              if (err.response && err.response.status === 429) {
                console.warn(`[楽天Kobo] キーワード: ${query.keyword}, ${genre.name} Page ${page}: 429エラーが発生。10秒待機してリトライします... (残りリトライ: ${retries - 1})`);
                await new Promise(resolve => setTimeout(resolve, 10000));
                retries--;
              } else {
                console.error(`[楽天Kobo] キーワード: ${query.keyword}, ${genre.name} Page ${page} の取得に失敗:`, err.message);
                break;
              }
            }
          }

          if (response && response.data && response.data.Items) {
            const items = response.data.Items;
            if (items.length === 0) {
              console.log(`[楽天Kobo] キーワード: ${query.keyword}, ジャンル ${genre.name} - ページ ${page}: これ以上のデータはありません。`);
              await new Promise(resolve => setTimeout(resolve, 3000));
              break;
            }
            console.log(`[楽天Kobo] キーワード: ${query.keyword}, ジャンル ${genre.name} - ページ ${page}: APIより ${items.length} 件を取得しました。`);

            items.forEach((itemWrapper) => {
              const item = itemWrapper.Item;
              if (!item) return;

              const salePrice = item.itemPrice;
              const discountRateFromTitle = extractDiscountRateFromTitle(item.title);
              
              const isFree = (salePrice === 0);
              const isHighDiscount = (salePrice > 0 && discountRateFromTitle !== null && discountRateFromTitle >= 30);

              // 無料でもなく、3割以上の割引でもない本はすべて除外する
              if (!isFree && !isHighDiscount) {
                if (salePrice > 0) {
                  console.log(`[デバッグ・有料除外] 価格: ${salePrice}円, 割引パース: ${discountRateFromTitle}% (Title: ${item.title})`);
                }
                return;
              }

              let endDate = null;
              if (item.salesEndDate) {
                const datePart = item.salesEndDate.split(' ')[0];
                endDate = datePart.replace(/\//g, '-');
              }

              const finalUrl = item.affiliateUrl || item.itemUrl;
              
              // 価格と割引率の算出
              let originalPrice = 500;
              let discountRate = 100;
              
              if (isFree) {
                discountRate = 100;
                originalPrice = 500; // 想定の元価格を一律500円とする
              } else {
                discountRate = discountRateFromTitle;
                // セール価格と割引率から元価格を逆算
                originalPrice = Math.round(salePrice / (1 - discountRate / 100));
              }

              // 重複追加の防止
              const id = `rakuten-${item.itemNumber || item.title.substring(0, 10)}`;
              if (books.some(b => b.id === id)) return;

              books.push({
                id: id,
                title: item.title,
                author: item.author || '不明',
                publisher: item.publisherName || '楽天Kobo',
                imageUrl: item.largeImageUrl || item.mediumImageUrl || '',
                store: 'rakuten',
                originalPrice: originalPrice,
                salePrice: salePrice,
                discountRate: discountRate,
                url: finalUrl,
                genre: genre.id === '101902' ? '少女漫画' : '少年・青年漫画',
                endDate: endDate,
                description: item.itemCaption || `${item.title}の期間限定割引・無料お試し版です。`,
                updatedAt: new Date().toISOString(),
                seriesName: item.seriesName || '' // シリーズ名を保持
              });
            });
          } else {
            console.log(`[楽天Kobo] キーワード: ${query.keyword}, ジャンル ${genre.name} - ページ ${page}: レスポンスが不正です。`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            break;
          }

          // レートリミット回避のため、リクエストごとに必ず3.0秒のウェイトを設ける
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    // シリーズ追加収集フェーズの開始
    const seriesNames = new Set();
    books.forEach(b => {
      let sName = b.seriesName;
      if (!sName) {
        // タイトルから巻数表記や括弧を除外した仮のシリーズ名を作成
        let t = b.title;
        t = t.replace(/[０-９]/g, function(s) {
          return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        });
        t = t.replace(/【[^】]*】/g, ' ');
        t = t.replace(/\[[^\]]*\]/g, ' ');
        t = t.replace(/(?:act|vol|volume|no|#)\.?\s*\d+/i, ' ');
        t = t.replace(/第?\s*\d+\s*[巻話作]/g, ' ');
        t = t.replace(/[\(（]\d+[\)）]/g, ' ');
        t = t.replace(/\s+\d+\s*$/g, ' ');
        t = t.replace(/\d+\s*$/g, ' ');
        t = t.replace(/\([^\)]*\)/g, ' ');
        t = t.replace(/（[^）]*）/g, ' ');
        t = t.replace(/期間限定/g, ' ');
        t = t.replace(/無料/g, ' ');
        t = t.replace(/セール/g, ' ');
        t = t.replace(/お試し/g, ' ');
        t = t.replace(/試し読み/g, ' ');
        sName = t.trim();
      }
      
      // 有効なシリーズ名のみ収集（短すぎる・長すぎるものはノイズ回避のため除外）
      if (sName && sName.length >= 2 && sName.length < 25) {
        seriesNames.add(sName);
      }
    });

    const uniqueSeries = Array.from(seriesNames);
    console.log(`[楽天Kobo] 検出されたユニークなシリーズ数: ${uniqueSeries.length}件。追加のシリーズ検索を開始します...`);

    // API負荷防止のため、最大40シリーズに制限
    const targetSeries = uniqueSeries.slice(0, 40);

    for (const sName of targetSeries) {
      console.log(`[楽天Kobo] シリーズ追加検索: "${sName}"...`);
      const params = {
        applicationId: appId,
        accessKey: accessKey,
        format: 'json',
        keyword: sName,
        hits: 20, // シリーズ全巻が網羅できるように20件に設定
        page: 1,
        sort: 'standard', // おすすめ度標準ソート
      };

      if (affiliateId && affiliateId !== 'dummy_affiliate_id') {
        params.affiliateId = affiliateId;
      }

      let response = null;
      try {
        response = await axios.get(url, {
          params,
          headers: {
            'Referer': 'https://github.io/',
            'Origin': 'https://github.io',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 10000
        });
      } catch (err) {
        console.error(`[楽天Kobo] シリーズ "${sName}" の検索に失敗:`, err.message);
      }

      if (response && response.data && response.data.Items) {
        const items = response.data.Items;
        console.log(`[楽天Kobo] シリーズ "${sName}": ${items.length}件の関連本を取得`);

        items.forEach((itemWrapper) => {
          const item = itemWrapper.Item;
          if (!item) return;

          // シリーズ検索で取得した本は、コミックであるもの（101901, 101902）のみを対象とする
          const isComic = item.koboGenreId === '101901' || item.koboGenreId === '101902';
          if (!isComic) return;

          const salePrice = item.itemPrice;
          const discountRateFromTitle = extractDiscountRateFromTitle(item.title);
          const isFree = (salePrice === 0);
          
          let endDate = null;
          if (item.salesEndDate) {
            const datePart = item.salesEndDate.split(' ')[0];
            endDate = datePart.replace(/\//g, '-');
          }

          const finalUrl = item.affiliateUrl || item.itemUrl;
          
          let originalPrice = 500;
          let discountRate = 0;
          
          if (isFree) {
            discountRate = 100;
            originalPrice = 500;
          } else {
            discountRate = discountRateFromTitle || 0;
            if (discountRate > 0) {
              originalPrice = Math.round(salePrice / (1 - discountRate / 100));
            } else {
              originalPrice = salePrice; // 推定定価マージ処理で上書きされるため仮設定
            }
          }

          const id = `rakuten-${item.itemNumber || item.title.substring(0, 10)}`;
          
          const existingIndex = books.findIndex(b => b.id === id);
          if (existingIndex !== -1) {
            if (!books[existingIndex].seriesName && item.seriesName) {
              books[existingIndex].seriesName = item.seriesName;
            }
            return;
          }

          books.push({
            id: id,
            title: item.title,
            author: item.author || '不明',
            publisher: item.publisherName || '楽天Kobo',
            imageUrl: item.largeImageUrl || item.mediumImageUrl || '',
            store: 'rakuten',
            originalPrice: originalPrice,
            salePrice: salePrice,
            discountRate: discountRate,
            url: finalUrl,
            genre: item.koboGenreId === '101902' ? '少女漫画' : '少年・青年漫画',
            endDate: endDate,
            description: item.itemCaption || `${item.title}の期間限定割引・無料お試し版です。`,
            updatedAt: new Date().toISOString(),
            seriesName: item.seriesName || sName
          });
        });
      }

      // レートリミット回避のためのウェイト
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    return books;
  } catch (error) {
    console.error('[楽天Kobo] 処理中に致命的なエラーが発生しました:', error.message);
    console.log('[楽天Kobo] エラーのため、開発用モックデータにフォールバックします。');
    return generateMockRakutenData();
  }
}

/**
 * 開発テスト用のモックデータを生成する関数
 */
function generateMockRakutenData() {
  const validImageUrl = "https://thumbnail.image.rakuten.co.jp/@0_mall/rakutenkobo-ebooks/cabinet/1393/2000000181393.jpg?_ex=200x200";
  return [
    // 呪術廻戦 (無料+セール)
    {
      id: "rakuten-mock-jjk-1",
      title: "【期間限定無料】呪術廻戦 1",
      author: "芥見下々",
      publisher: "集英社",
      imageUrl: validImageUrl,
      store: "rakuten",
      originalPrice: 480,
      salePrice: 0,
      discountRate: 100,
      url: "https://books.rakuten.co.jp/rk/56b46b2b6ab03893bb96b6b7a5a8cd01/",
      genre: "少年漫画",
      endDate: "2026-06-30",
      description: "類稀なる身体能力を持つ高校生・虎杖悠仁は、ある日学校に眠る「呪物」の封印が解かれたことで、呪いを巡る戦いに身を投じることになる。期間限定無料お試し版！",
      updatedAt: new Date().toISOString()
    },
    {
      id: "rakuten-mock-jjk-2",
      title: "呪術廻戦 2",
      author: "芥見下々",
      publisher: "集英社",
      imageUrl: validImageUrl,
      store: "rakuten",
      originalPrice: 480,
      salePrice: 240,
      discountRate: 50,
      url: "https://books.rakuten.co.jp/rk/56b46b2b6ab03893bb96b6b7a5a8cd02/",
      genre: "少年漫画",
      endDate: "2026-06-30",
      description: "少年漫画の王道！呪術廻戦第2巻セール中！",
      updatedAt: new Date().toISOString()
    },
    // 怪獣8号 (無料+セール)
    {
      id: "rakuten-mock-kj8-1",
      title: "【期間限定無料】怪獣8号 1",
      author: "松本直也",
      publisher: "集英社",
      imageUrl: validImageUrl,
      store: "rakuten",
      originalPrice: 500,
      salePrice: 0,
      discountRate: 100,
      url: "https://books.rakuten.co.jp/rk/56b46b2b6ab03893bb96b6b7a5a8cd11/",
      genre: "少年漫画",
      endDate: "2026-06-28",
      description: "怪獣発生率が世界屈指の日本。夢破れ怪獣専門清掃業者で働いていたカフカの身体が怪獣化し、「怪獣8号」と呼ばれる討伐対象になってしまう──！期間限定無料お試し版！",
      updatedAt: new Date().toISOString()
    },
    {
      id: "rakuten-mock-kj8-2",
      title: "怪獣8号 2",
      author: "松本直也",
      publisher: "集英社",
      imageUrl: validImageUrl,
      store: "rakuten",
      originalPrice: 500,
      salePrice: 350,
      discountRate: 30,
      url: "https://books.rakuten.co.jp/rk/56b46b2b6ab03893bb96b6b7a5a8cd12/",
      genre: "少年漫画",
      endDate: "2026-06-28",
      description: "話題沸騰の怪獣アクション、第2巻セール中！",
      updatedAt: new Date().toISOString()
    },
    // アオハライド (無料+セール複数)
    {
      id: "rakuten-mock-aoharu-1",
      title: "【期間限定無料】アオハライド 1",
      author: "咲坂伊緒",
      publisher: "集英社",
      imageUrl: validImageUrl,
      store: "rakuten",
      originalPrice: 480,
      salePrice: 0,
      discountRate: 100,
      url: "https://books.rakuten.co.jp/rk/56b46b2b6ab03893bb96b6b7a5a8cd21/",
      genre: "少女漫画",
      endDate: "2026-07-02",
      description: "高校1年生の双葉は、中学時代に転校してしまった初恋の相手「田中くん」と再会する。期間限定無料お試し版！",
      updatedAt: new Date().toISOString()
    },
    {
      id: "rakuten-mock-aoharu-2",
      title: "アオハライド 2 (50% OFF)",
      author: "咲坂伊緒",
      publisher: "集英社",
      imageUrl: validImageUrl,
      store: "rakuten",
      originalPrice: 480,
      salePrice: 240,
      discountRate: 50,
      url: "https://books.rakuten.co.jp/rk/56b46b2b6ab03893bb96b6b7a5a8cd22/",
      genre: "少女漫画",
      endDate: "2026-07-02",
      description: "空白の3年を経て、再び動き出す二人の恋。人気の青春ラブストーリー、第2巻セール！",
      updatedAt: new Date().toISOString()
    },
    {
      id: "rakuten-mock-aoharu-3",
      title: "アオハライド 3 (30% OFF)",
      author: "咲坂伊緒",
      publisher: "集英社",
      imageUrl: validImageUrl,
      store: "rakuten",
      originalPrice: 480,
      salePrice: 336,
      discountRate: 30,
      url: "https://books.rakuten.co.jp/rk/56b46b2b6ab03893bb96b6b7a5a8cd23/",
      genre: "少女漫画",
      endDate: "2026-07-02",
      description: "揺れ動く登場人物たちの心情。アオハライド第3巻セール！",
      updatedAt: new Date().toISOString()
    }
  ];
}

module.exports = { parseRakuten };
