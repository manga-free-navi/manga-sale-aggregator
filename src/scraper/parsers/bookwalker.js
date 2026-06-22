const axios = require('axios');
const cheerio = require('cheerio');

/**
  * BOOK☆WALKERの無料コーナーから漫画情報を収集するパーサー
  * @returns {Promise<Array>} 収集された漫画データの配列
  */
async function parseBookwalker() {
  const url = 'https://bookwalker.jp/free/';
  const books = [];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Referer': 'https://bookwalker.jp/'
  };

  try {
    console.log(`[BOOK☆WALKER] スクレイピング開始: ${url}`);
    const response = await axios.get(url, { headers, timeout: 15000 });
    
    if (!response.data) {
      console.log('[BOOK☆WALKER] 取得したHTMLデータが空です。');
      return [];
    }

    const $ = cheerio.load(response.data);
    const cards = $('article.t-c-tile-card');
    
    console.log(`[BOOK☆WALKER] 一覧から ${cards.length} 件の要素を発見しました。`);

    // 負荷軽減とテスト迅速化のため、最大40件程度に制限
    cards.slice(0, 40).each((index, element) => {
      const $el = $(element);

      // 詳細タイトルリンクの取得
      const titleLink = $el.find('.t-o-heading-book-title__link').first();
      const title = titleLink.text().trim();
      let rawUrl = titleLink.attr('href') || '';

      if (!title || !rawUrl) return;

      // 相対パスを絶対パスへ変換
      if (rawUrl.startsWith('/')) {
        rawUrl = `https://bookwalker.jp${rawUrl}`;
      }

      // 画像URL (Lazy Load対策で data-lazy-src を優先)
      const imgEl = $el.find('.t-o-thumbnail__img').first();
      let imageUrl = imgEl.attr('data-lazy-src') || imgEl.attr('src') || '';
      if (imageUrl.startsWith('//')) {
        imageUrl = `https:${imageUrl}`;
      } else if (imageUrl.startsWith('/')) {
        imageUrl = `https://sp.bookwalker.jp${imageUrl}`;
      }

      // 無料冊数・期間などのテキスト（例: 「3冊無料」「期間限定無料」）
      const priceText = $el.find('.t-c-card-free-action__price').first().text().trim() || '期間限定無料';

      // 著者・出版社名は一覧からは取得できないため、デフォルト値またはタイトルから判定
      const author = 'BOOK☆WALKER';
      const publisher = 'BOOK☆WALKER';

      // 詳細URLのUUIDからIDを生成して一意にする
      // 例: https://bookwalker.jp/dea4e6ab95-04c6-4ea2-b152-58d2f82075b7/
      const uuidMatch = rawUrl.match(/\/de([a-zA-Z0-9\-]+)\/?/);
      const uuid = uuidMatch ? uuidMatch[1] : Math.random().toString(36).substring(2, 9);
      const id = `bookwalker-${uuid}`;

      // ジャンルの判定 (マンガラベルがあれば 少年・青年漫画)
      const isManga = $el.find('.t-o-genre-label').text().includes('マンガ');
      const genre = isManga ? '少年・青年漫画' : 'その他';

      books.push({
        id: id,
        title: title,
        author: author,
        publisher: publisher,
        imageUrl: imageUrl,
        store: 'bookwalker',
        originalPrice: 500, // 推定定価
        salePrice: 0,       // 0円無料
        discountRate: 100,  // 100% OFF
        url: rawUrl,
        genre: genre,
        endDate: null,      // 一覧からは取得不可のためnull
        description: `${priceText}キャンペーン実施中。BOOK☆WALKERで今すぐ読める期間限定の無料作品です。`,
        updatedAt: new Date().toISOString()
      });
    });

    return books;
  } catch (error) {
    console.error('[BOOK☆WALKER] スクレイピング中にエラーが発生しました:', error.message);
    return [];
  }
}

module.exports = { parseBookwalker };
