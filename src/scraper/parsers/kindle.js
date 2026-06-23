const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Kindleコミックのセール情報をスクレイピングする
 * @returns {Promise<Array>} 書籍データの配列
 */
async function parseKindle() {
  // Kindleストア ＞ コミック ＞ 1〜100円（99円セール含む） ＞ おすすめ順
  const url = 'https://www.amazon.co.jp/s?i=digital-text&rh=n%3A2293143051%2Cp_36%3A1-100&s=featured';
  console.log(`[Kindle] データ取得開始: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 15000
    });

    if (response.data.includes('captcha') || response.data.includes('ロボット')) {
      console.warn('[Kindle] ボット検知に引っかかったため、スキップします。');
      return [];
    }

    const $ = cheerio.load(response.data);
    const books = [];
    const amazonAssocId = process.env.AMAZON_ASSOCIATE_ID || 'dummy-22';

    $('[data-component-type="s-search-result"]').each((i, el) => {
      const item = $(el);
      
      // 1. タイトル
      const title = item.find('h2').first().text().trim();
      if (!title) return;

      // 2. 書籍URL (アフィリエイトIDを付与)
      const hrefEl = item.find('a[href*="/dp/"], a[href*="/gp/product/"]').first();
      let bookUrl = '';
      if (hrefEl.length > 0) {
        const rawHref = hrefEl.attr('href') || '';
        const cleanPathMatch = rawHref.match(/(\/(?:dp|gp\/product)\/[a-zA-Z0-9]{10})/);
        if (cleanPathMatch) {
          bookUrl = `https://www.amazon.co.jp${cleanPathMatch[1]}?tag=${amazonAssocId}`;
        }
      }
      if (!bookUrl) {
        // フォールバック
        bookUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(title)}&i=digital-text&tag=${amazonAssocId}`;
      }

      // 3. 価格 (セール価格)
      const priceText = item.find('.a-price-whole').first().text().trim();
      const salePrice = priceText ? parseInt(priceText.replace(/[^0-9]/g, '')) : 99;

      // 4. 画像URL
      const imageUrl = item.find('.s-image').attr('src') || '';

      // 5. 著者名
      const authorLine = item.find('.a-row').first().text();
      const parts = authorLine.split('|').map(p => p.trim());
      let author = '不明';
      if (parts.length >= 2) {
        author = parts[1].replace(/、/g, ',').trim();
      }

      // 6. 割引前の価格（定価の推測）
      const originalPrice = 500;
      const discountRate = originalPrice > salePrice ? Math.round(((originalPrice - salePrice) / originalPrice) * 100) : 80;

      books.push({
        id: `kindle-${Buffer.from(title).toString('hex').substring(0, 12)}`,
        title,
        author,
        publisher: 'Kindleストア',
        imageUrl,
        genre: '少年・青年漫画',
        description: 'Kindleストアでおトクに読めるセール対象コミックです。',
        endDate: null,
        updatedAt: new Date().toISOString(),
        store: 'amazon',
        url: bookUrl,
        originalPrice,
        salePrice,
        discountRate
      });
    });

    console.log(`[Kindle] スクレイピング完了: ${books.length} 件取得`);
    return books;

  } catch (error) {
    console.error('[Kindle] 取得エラー:', error.message);
    return [];
  }
}

module.exports = { parseKindle };
