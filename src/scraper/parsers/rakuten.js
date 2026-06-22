const axios = require('axios');

/**
 * 楽天Kobo電子書籍検索APIを利用して無料漫画情報を取得するパーサー
 * @param {string} appId - 楽天デベロッパーID (Application ID)
 * @param {string} accessKey - 楽天アクセスキー (Access Key)
 * @param {string} affiliateId - 楽天アフィリエイトID (オプション)
 * @returns {Promise<Array>} 収集された漫画データの配列
 */
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
    console.log(`[楽天Kobo] APIリクエスト開始 (少年・青年[101901] ＆ 少女・レディース[101902]、各2ページ取得)`);

    const genreIds = ['101901', '101902'];

    for (const genreId of genreIds) {
      console.log(`[楽天Kobo] ジャンル ID: ${genreId} の収集を開始します...`);
      for (let page = 1; page <= 2; page++) {
        const params = {
          applicationId: appId,
          accessKey: accessKey,
          format: 'json',
          keyword: '無料',            // 「無料」コミックを取得
          koboGenreId: genreId,      // 有効なコミックサブジャンルID
          hits: 30,                  // 1回あたりの取得件数 (最大30)
          page: page,                // ページ番号
          sort: 'sales',             // 売上順 (人気順)
        };

        if (affiliateId && affiliateId !== 'dummy_affiliate_id') {
          params.affiliateId = affiliateId;
        }

        try {
          const response = await axios.get(url, {
            params,
            headers: {
              'Referer': 'https://github.io/',
              'Referrer': 'https://github.io/',
              'Origin': 'https://github.io',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
          });

          if (response.data && response.data.Items) {
            const items = response.data.Items;
            console.log(`[楽天Kobo] ジャンル ${genreId} - ページ ${page}: APIより ${items.length} 件のアイテムを取得しました。`);

            items.forEach((itemWrapper) => {
              const item = itemWrapper.Item;
              if (!item) return;

              let endDate = null;
              if (item.salesEndDate) {
                const datePart = item.salesEndDate.split(' ')[0];
                endDate = datePart.replace(/\//g, '-');
              }

              const finalUrl = item.affiliateUrl || item.itemUrl;
              const salePrice = item.itemPrice;
              const isFree = salePrice === 0;
              const originalPrice = isFree ? 500 : Math.round(salePrice * 1.5);
              const discountRate = isFree ? 100 : 33;

              books.push({
                id: `rakuten-${item.itemNumber || item.title.substring(0, 10)}`,
                title: item.title,
                author: item.author || '不明',
                publisher: item.publisherName || '楽天Kobo',
                imageUrl: item.largeImageUrl || item.mediumImageUrl || '',
                store: 'rakuten',
                originalPrice: originalPrice,
                salePrice: salePrice,
                discountRate: discountRate,
                url: finalUrl,
                genre: genreId === '101902' ? '少女漫画' : '少年・青年漫画',
                endDate: endDate,
                description: item.itemCaption || `${item.title}の期間限定無料お試し版です。`,
                updatedAt: new Date().toISOString()
              });
            });
          }
        } catch (pageError) {
          console.error(`[楽天Kobo] ジャンル ${genreId} - ページ ${page} の取得に失敗しました:`, pageError.message);
        }

        // リクエスト間のウェイト (1秒)
        await new Promise(resolve => setTimeout(resolve, 1000));
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
  return [
    {
      id: "rakuten-mock-1",
      title: "【期間限定無料】呪術廻戦 1",
      author: "芥見下々",
      publisher: "集英社",
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/book/cabinet/5480/9784088815169.jpg?_ex=200x200",
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
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/book/cabinet/0285/9784088826158.jpg?_ex=200x200",
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
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/book/cabinet/3725/9784088466477.jpg?_ex=200x200",
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
