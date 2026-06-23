/**
 * webryFree.js
 * サンデーうぇぶり「無料エピソードあり」シリーズ一覧から
 * 無料で読める漫画情報を収集するパーサー
 *
 * 収集方法:
 *   1. https://www.sunday-webry.com/series?free_episode=true の HTML を取得
 *   2. li.webry-series-item 要素を cheerio でパース
 *   3. タイトル・著者・エピソードURL・サムネイル画像を抽出
 */

const axios = require('axios');
const cheerio = require('cheerio');

/** サンデーうぇぶり 無料シリーズ一覧URL */
const WEBRY_FREE_URL = 'https://www.sunday-webry.com/series?free_episode=true';

/** ストアキー */
const STORE_KEY = 'sundaywebry_free';

/** サイト名 */
const SITE_NAME = 'サンデーうぇぶり（無料特集）';

/**
 * サンデーうぇぶり 無料エピソードありシリーズ一覧を取得する
 *
 * @returns {Promise<Object[]>} 書籍オブジェクト配列
 */
async function parseWebryfree() {
  console.log(`[${SITE_NAME}] シリーズ一覧を取得中: ${WEBRY_FREE_URL}`);

  let html;
  try {
    const response = await axios.get(WEBRY_FREE_URL, {
      timeout: 20000,
      headers: {
        // 一般的なブラウザを模倣するヘッダ（Bot 扱いを回避）
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      responseType: 'text',
    });
    html = response.data;
  } catch (err) {
    console.error(`[${SITE_NAME}] HTML 取得に失敗しました: ${err.message}`);
    return [];
  }

  const $ = cheerio.load(html);
  const books = [];
  const today = new Date().toISOString().slice(0, 10);

  // li.webry-series-item 内の各シリーズをループ
  $('li.webry-series-item').each((_, el) => {
    // タイトル（h4.series-title）
    const title = $(el).find('h4.series-title').text().trim();
    if (!title) return;

    // 著者（p.author）
    const author = $(el).find('p.author').text().trim() || '不明';

    // シリーズURLを「初めから」リンクから取得（最初の話）
    const firstEpUrl = $(el).find('a.episode-link.first').attr('href') || '';
    // フォールバック: webry-series-item-link
    const seriesUrl = $(el).find('a.webry-series-item-link').attr('href') || firstEpUrl;
    const url = firstEpUrl || seriesUrl;
    if (!url || !url.startsWith('http')) return;

    // サムネイル画像URL（data-src が優先、なければ src）
    const imgSrc = $(el).find('img.js-lazyload').attr('data-src')
      || $(el).find('img').attr('src')
      || '';

    // 掲載誌名（p.label）
    const magazine = $(el).find('p[class^="label"]').text().trim() || 'サンデーうぇぶり';

    // 一意 ID：ストアキー＋タイトルの安全な文字列
    const safeId = `${STORE_KEY}_${title.replace(/[^a-zA-Z0-9\u3040-\u9FFF]/g, '_')}`;

    books.push({
      id: safeId,
      title: title,
      author: author,
      publisher: magazine,
      imageUrl: imgSrc,
      genre: '漫画',
      description: `${SITE_NAME}で無料エピソードが公開中（${magazine}）`,
      endDate: null, // 終了日は HTML に記載がないため null
      updatedAt: today,
      // run-scraper.js のマージ処理が期待するフラット形式
      store: STORE_KEY,
      url: url,
      originalPrice: 0,
      salePrice: 0,
      discountRate: 100,
    });
  });

  console.log(`[${SITE_NAME}] ${books.length} 件の無料シリーズを取得しました。`);
  return books;
}

module.exports = { parseWebryfree };
