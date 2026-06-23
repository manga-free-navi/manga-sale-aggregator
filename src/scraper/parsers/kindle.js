const axios = require('axios');
const cheerio = require('cheerio');

// ヘルパー：指定ミリ秒待機する
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * きんどく詳細ページからセール中の書籍データをパースする
 * @param {string} url - きんどく詳細ページのURL
 * @returns {Promise<Array>} 書籍データの配列
 */
async function parseKintokuPage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const books = [];
    const amazonAssocId = process.env.AMAZON_ASSOCIATE_ID || 'dummy-22';

    // 1. 動的なアコーディオン項目 (.ajax-amazon-item) から抽出
    $('.ajax-amazon-item').each((i, el) => {
      const item = $(el);
      const asin = item.attr('data-asin') || '';
      const title = item.attr('data-title') || '';
      const saleText = item.attr('data-sale') || '';

      if (!asin || !title) return;

      // アフィリエイトURL組み立て
      const bookUrl = `https://www.amazon.co.jp/dp/${asin}?tag=${amazonAssocId}`;

      // セール価格の抽出（例: "1〜25巻が11円" から最安値 11 を抽出）
      let salePrice = 99;
      const priceMatches = saleText.match(/(\d+)円/g);
      if (priceMatches) {
        // 全てのマッチした価格から最小値を取得
        const prices = priceMatches.map(p => parseInt(p.replace(/[^0-9]/g, ''), 10));
        salePrice = Math.min(...prices);
      }

      // 割引率の抽出（例: "98%OFF" や "80%OFF"）
      let discountRate = 80;
      const rateMatch = saleText.match(/(\d+)\s*[％%]\s*OFF/i);
      if (rateMatch) {
        discountRate = parseInt(rateMatch[1], 10);
      }

      books.push({
        id: `kindle-${asin.toLowerCase()}`,
        title: title,
        author: '不明', // 名寄せマージ時に他ストアデータから著者名が自動補完されます
        publisher: 'Kindleストア',
        imageUrl: '', // 後でproduct-display等から同ASIN of image があれば補完されます
        genre: '少年・青年漫画',
        description: `Kindleストアでおトクに読めるセール対象コミックです。セール情報: ${saleText}`,
        endDate: null,
        updatedAt: new Date().toISOString(),
        store: 'amazon',
        url: bookUrl,
        originalPrice: Math.round(salePrice / (1 - discountRate / 100)) || 500,
        salePrice,
        discountRate
      });
    });

    // 2. 静的な表示枠 (.product-display) から抽出
    $('.product-display').each((i, el) => {
      const item = $(el);
      const titleLinkEl = item.find('.item-title a').first();
      const title = titleLinkEl.text().trim();
      const href = titleLinkEl.attr('href') || '';

      if (!title) return;

      // URLからASINを抽出
      let asin = '';
      const asinMatch = href.match(/(?:\/dp\/|\/gp\/product\/)([a-zA-Z0-9]{10})/);
      if (asinMatch) {
        asin = asinMatch[1];
      }

      const bookUrl = asin ? `https://www.amazon.co.jp/dp/${asin}?tag=${amazonAssocId}` : href;

      // セール情報のテキスト
      const priceText = item.find('.item-price-sale').text().trim();

      // セール価格の抽出
      let salePrice = 99;
      const priceMatches = priceText.match(/(\d+)円/g);
      if (priceMatches) {
        const prices = priceMatches.map(p => parseInt(p.replace(/[^0-9]/g, ''), 10));
        salePrice = Math.min(...prices);
      }

      // 割引率の抽出
      let discountRate = 80;
      const rateMatch = priceText.match(/(\d+)\s*[％%]\s*OFF/i);
      if (rateMatch) {
        discountRate = parseInt(rateMatch[1], 10);
      }

      const imageUrl = item.find('.item-image').attr('src') || '';

      books.push({
        id: asin ? `kindle-${asin.toLowerCase()}` : `kindle-${Buffer.from(title).toString('hex').substring(0, 12)}`,
        title: title,
        author: '不明',
        publisher: 'Kindleストア',
        imageUrl,
        genre: '少年・青年漫画',
        description: `Kindleストアでおトクに読めるセール対象コミックです。セール情報: ${priceText}`,
        endDate: null,
        updatedAt: new Date().toISOString(),
        store: 'amazon',
        url: bookUrl,
        originalPrice: Math.round(salePrice / (1 - discountRate / 100)) || 500,
        salePrice,
        discountRate
      });
    });

    return books;
  } catch (error) {
    console.error(`[Kindle/Kintoku] ページ取得失敗 (${url}):`, error.message);
    return [];
  }
}

/**
 * Amazon.co.jpストアを直接検索する
 * @param {string|null} keyword - 検索キーワード
 * @param {number} page - 取得ページ数
 * @returns {Promise<Array>} 書籍データの配列
 */
async function parseAmazonDirect(keyword, page) {
  const amazonAssocId = process.env.AMAZON_ASSOCIATE_ID || 'dummy-22';
  const keywordParam = keyword ? `k=${encodeURIComponent(keyword)}&` : '';
  const url = `https://www.amazon.co.jp/s?${keywordParam}i=digital-text&rh=n%3A2293143051%2Cp_36%3A1-100&s=featured&page=${page}`;

  console.log(`[Kindle/Amazon直接] 取得開始 (${keyword || '全体'}, ページ ${page}): ${url}`);
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'device-memory': '8',
        'downlink': '10',
        'ect': '4g',
        'rtt': '50',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1'
      },
      timeout: 15000
    });

    const hasCaptcha = /captcha/i.test(response.data) || 
                       (response.data.length < 50000 && /robot/i.test(response.data)) || 
                       response.data.includes('ロボット') || 
                       response.data.includes('Sorry!');

    if (hasCaptcha) {
      console.warn(`[Kindle/Amazon直接] ボット検知に引っかかったため、スキップします。`);
      return [];
    }

    const $ = cheerio.load(response.data);
    const books = [];

    $('[data-component-type="s-search-result"]').each((i, el) => {
      const item = $(el);
      const title = item.find('h2').first().text().trim();
      if (!title) return;

      const hrefEl = item.find('a[href*="/dp/"], a[href*="/gp/product/"]').first();
      let bookUrl = '';
      let asin = '';
      if (hrefEl.length > 0) {
        const rawHref = hrefEl.attr('href') || '';
        const cleanPathMatch = rawHref.match(/(\/(?:dp|gp\/product)\/[a-zA-Z0-9]{10})/);
        if (cleanPathMatch) {
          asin = cleanPathMatch[1].split('/').pop();
          bookUrl = `https://www.amazon.co.jp${cleanPathMatch[1]}?tag=${amazonAssocId}`;
        }
      }
      if (!bookUrl) {
        bookUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(title)}&i=digital-text&tag=${amazonAssocId}`;
      }

      const priceText = item.find('.a-price-whole').first().text().trim();
      const salePrice = priceText ? parseInt(priceText.replace(/[^0-9]/g, '')) : 99;

      const imageUrl = item.find('.s-image').attr('src') || '';

      const authorLine = item.find('.a-row').first().text();
      const parts = authorLine.split('|').map(p => p.trim());
      let author = '不明';
      if (parts.length >= 2) {
        author = parts[1].replace(/、/g, ',').trim();
      }

      const originalPrice = 500;
      const discountRate = originalPrice > salePrice ? Math.round(((originalPrice - salePrice) / originalPrice) * 100) : 80;

      books.push({
        id: asin ? `kindle-${asin.toLowerCase()}` : `kindle-${Buffer.from(title).toString('hex').substring(0, 12)}`,
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

    console.log(`[Kindle/Amazon直接] 取得完了: ${books.length} 件`);
    return books;
  } catch (error) {
    console.error(`[Kindle/Amazon直接] エラー:`, error.message);
    return [];
  }
}

/**
 * きんどく＆Amazon直接検索からKindleの最新セール情報をハイブリッド収集する
 * @returns {Promise<Array>} 書籍データの配列
 */
async function parseKindle() {
  const allBooks = [];

  // アプローチ1: きんどくからのまとめ巡回
  const topUrl = 'https://premium.gamepedia.jp/kindle/';
  console.log(`[Kindle/Kintoku] 巡回開始: ${topUrl}`);
  try {
    const response = await axios.get(topUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const targetUrls = new Set();

    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim() + ' ' + ($(el).find('.media-heading').text().trim() || '');

      if (href.includes('/archives/') && 
          (text.includes('99円') || text.includes('セール') || text.includes('円以下') || text.includes('ポイント') || text.includes('還元') || text.includes('％'))) {
        const cleanUrl = href.split('?')[0];
        targetUrls.add(cleanUrl);
      }
    });

    if (targetUrls.size === 0) {
      targetUrls.add('https://premium.gamepedia.jp/kindle/archives/41867');
      targetUrls.add('https://premium.gamepedia.jp/kindle/archives/41792');
    }

    console.log(`[Kindle/Kintoku] 巡回対象記事数: ${targetUrls.size}件`);
    // トップページ自体のピックアップ商品を直接パースして追加
    console.log(`[Kindle/Kintoku] トップページ自体のパースを開始します...`);
    const topPageBooks = await parseKintokuPage(topUrl);
    allBooks.push(...topPageBooks);
    console.log(`[Kindle/Kintoku] トップページから ${topPageBooks.length} 件を取得しました。`);

    for (const url of targetUrls) {
      const books = await parseKintokuPage(url);
      allBooks.push(...books);
      await sleep(1500);
    }
  } catch (kintokuError) {
    console.error('[Kindle/Kintoku] 巡回取得エラー:', kintokuError.message);
  }

  // アプローチ2: Amazon.co.jpへの直接キーワード検索補完
  // きんどくにないゲリラセール本（例: 浦安鉄筋家族など）を直接Amazonから補完します。
  console.log('[Kindle/Amazon直接] 補完検索を開始します...');
  
  // キーワードを「秋田書店」「講談社」に加え、「浦安」「チャンピオン」に拡張して、より広範囲に抽出します
  const directKeywords = [null, '99円', '秋田書店', '講談社', '浦安', 'チャンピオン'];
  for (const kw of directKeywords) {
    for (let page = 1; page <= 3; page++) {
      const books = await parseAmazonDirect(kw, page);
      allBooks.push(...books);
      await sleep(4000); // ボット対策として直接リクエスト間は4秒待機
    }
  }

  // 重複データをASINまたはタイトルベースでマージ
  const mergedMap = new Map();
  allBooks.forEach(book => {
    const key = book.id;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, book);
    } else {
      const existing = mergedMap.get(key);
      if (!existing.imageUrl && book.imageUrl) {
        existing.imageUrl = book.imageUrl;
      }
      // 不明な著者名が直接検索で取得できていれば補完
      if (existing.author === '不明' && book.author !== '不明') {
        existing.author = book.author;
      }
      if (existing.description.length < book.description.length) {
        existing.description = book.description;
      }
    }
  });

  const finalBooks = Array.from(mergedMap.values());
  console.log(`[Kindle] ハイブリッド収集完了。総取得件数: ${allBooks.length}件 -> 重複排除後: ${finalBooks.length}件`);
  return finalBooks;
}

module.exports = { parseKindle };
