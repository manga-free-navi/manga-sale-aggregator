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
    console.log(`[楽天Kobo] APIリクエスト開始 (少年・青年[101901] ＆ 少女・レディース[101902]、価格の安い順)`);

    const genres = [
      { id: '101901', name: '少年・青年漫画', maxPage: 8 },
      { id: '101902', name: '少女・レディース漫画', maxPage: 5 }
    ];
    const keyword = '無料';

    for (const genre of genres) {
      console.log(`[楽天Kobo] ジャンル: ${genre.name} (${genre.id}) の収集を開始します...`);
      for (let page = 1; page <= genre.maxPage; page++) {
        const params = {
          applicationId: appId,
          accessKey: accessKey,
          format: 'json',
          keyword: keyword,
          koboGenreId: genre.id,
          hits: 30,
          page: page,
          sort: '+itemPrice', // 価格の安い順ソート (0円本を優先収集)
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
              console.warn(`[楽天Kobo] Page ${page}: 429エラーが発生。10秒待機してリトライします... (残りリトライ: ${retries - 1})`);
              await new Promise(resolve => setTimeout(resolve, 10000));
              retries--;
            } else {
              console.error(`[楽天Kobo] Page ${page} の取得に失敗:`, err.message);
              break;
            }
          }
        }

        if (response && response.data && response.data.Items) {
          const items = response.data.Items;
          if (items.length === 0) {
            console.log(`[楽天Kobo] ジャンル ${genre.name} - ページ ${page}: これ以上のデータはありません。`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            break;
          }
          console.log(`[楽天Kobo] ジャンル ${genre.name} - ページ ${page}: APIより ${items.length} 件を取得しました。`);

          items.forEach((itemWrapper) => {
            const item = itemWrapper.Item;
            if (!item) return;

            const salePrice = item.itemPrice;
            const discountRateFromTitle = extractDiscountRateFromTitle(item.title);
            
            const isFree = (salePrice === 0);
            const isHighDiscount = (salePrice > 0 && discountRateFromTitle !== null && discountRateFromTitle >= 30);

            // 無料でもなく、3割以上の割引でもない本はすべて除外する
            if (!isFree && !isHighDiscount) return;

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
              updatedAt: new Date().toISOString()
            });
          });
        } else {
          console.log(`[楽天Kobo] ジャンル ${genre.name} - ページ ${page}: レスポンスが不正です。`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          break;
        }

        // レートリミット回避のため、リクエストごとに必ず3.0秒のウェイトを設ける
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
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
    {
      id: "rakuten-mock-1",
      title: "【期間限定無料】呪術廻戦 1",
      author: "芥見下々",
      publisher: "集英社",
      imageUrl: validImageUrl,
      store: "rakuten",
      originalPrice: 480,
      salePrice: 0,
      discountRate: 100,
      url: "https://books.rakuten.co.jp/rb/15478440/?scid=af_pc_etc&sc2id=af_101_0_0",
      genre: "少年漫画",
      endDate: "2026-06-30",
      description: "類稀なる身体能力を持つ高校生・虎杖悠仁は、ある日学校に眠る「呪物」の封印が解かれたことで、呪いを巡る戦いに身を投じることになる。呪いの王「両面宿儺」と肉体を共有することになった虎杖の運命は──。期間限定無料お試し版！",
      updatedAt: new Date().toISOString()
    },
    {
      id: "rakuten-mock-2",
      title: "【期間限定無料】怪獣8号 1",
      author: "松本直也",
      publisher: "集英社",
      imageUrl: validImageUrl,
      store: "rakuten",
      originalPrice: 500,
      salePrice: 0,
      discountRate: 100,
      url: "https://books.rakuten.co.jp/rb/16600285/?scid=af_pc_etc&sc2id=af_101_0_0",
      genre: "少年漫画",
      endDate: "2026-06-28",
      description: "怪獣発生率が世界屈指の日本。かつて防衛隊員を目指していた日比野カフカは、夢破れ怪獣専門清労業者で働いていた。しかし、謎の小型生物によって身体が怪獣化し、「怪獣8号」と呼ばれる討伐対象になってしまう──！期間限定無料お試し版！",
      updatedAt: new Date().toISOString()
    },
    {
      id: "rakuten-mock-3",
      title: "【セール】アオハライド 1 (50% OFF)",
      author: "咲坂伊緒",
      publisher: "集英社",
      imageUrl: validImageUrl,
      store: "rakuten",
      originalPrice: 480,
      salePrice: 240,
      discountRate: 50,
      url: "https://books.rakuten.co.jp/rb/11193725/?scid=af_pc_etc&sc2id=af_101_0_0",
      genre: "少女漫画",
      endDate: "2026-07-02",
      description: "高校1年生の双葉は、中学時代に転校してしまった初恋の相手「田中くん」と再会する。しかし、彼は名前を「馬渕」に変え、性格もすっかり変わっていた。空白の3年を経て、再び動き出す二人の恋。人気の青春ラブストーリー！",
      updatedAt: new Date().toISOString()
    }
  ];
}

module.exports = { parseRakuten };
