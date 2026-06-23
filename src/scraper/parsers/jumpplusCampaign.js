/**
 * jumpplusCampaign.js
 * 少年ジャンプ＋ トップページの「無料キャンペーン・復刻連載」セクションから
 * 期間限定無料公開の漫画情報を収集するパーサー
 *
 * 収集方法:
 *   1. https://shonenjumpplus.com/ の HTML を取得
 *   2. section.free-campaign 内の a.swiper-slide 要素を cheerio でパース
 *   3. タイトル・著者・エピソードURL・サムネイル画像を抽出
 */

const axios = require('axios');
const cheerio = require('cheerio');

/** ジャンプ＋ トップページURL */
const JUMPPLUS_TOP_URL = 'https://shonenjumpplus.com/';

/** ストアキー */
const STORE_KEY = 'jumpplus_campaign';

/** サイト名 */
const SITE_NAME = 'ジャンプ＋（無料キャンペーン）';

/**
 * ジャンプ＋ トップページから「無料キャンペーン・復刻連載」を取得する
 *
 * @returns {Promise<Object[]>} 書籍オブジェクト配列
 */
async function parseJumpplusCampaign() {
  console.log(`[${SITE_NAME}] トップページを取得中: ${JUMPPLUS_TOP_URL}`);

  let html;
  try {
    const response = await axios.get(JUMPPLUS_TOP_URL, {
      timeout: 20000,
      headers: {
        // 一般的なブラウザを模倣するヘッダ（Bot 扱いを回避）
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
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

  // section.free-campaign 内の各スライドアイテムをループ
  $('section.free-campaign a.swiper-slide').each((_, el) => {
    const $el = $(el);

    // エピソードURL（href）
    const episodeUrl = $el.attr('href');
    if (!episodeUrl || !episodeUrl.startsWith('http')) return;

    // タイトル（h3.free-campaign-item-title）
    const title = $el.find('h3.free-campaign-item-title').text().trim();
    if (!title) return;

    // 著者（h4.free-campaign-item-author）
    const author = $el.find('h4.free-campaign-item-author').text().trim() || '不明';

    // サムネイル画像URL（img.free-campaign-item-thumb の src）
    const rawImgSrc = $el.find('img.free-campaign-item-thumb').attr('src') || '';
    // data-src が設定されていれば優先
    const imgSrc = $el.find('img.free-campaign-item-thumb').attr('data-src') || rawImgSrc;

    // 一意 ID：ストアキー＋タイトルの安全な文字列
    const safeId = `${STORE_KEY}_${title.replace(/[^a-zA-Z0-9\u3040-\u9FFF]/g, '_')}`;

    books.push({
      id: safeId,
      title: title,
      author: author,
      publisher: 'ジャンプ＋',
      imageUrl: imgSrc,
      genre: '漫画',
      description: `ジャンプ＋ 無料キャンペーン・復刻連載で現在無料公開中`,
      endDate: null, // 終了日は HTML に記載がないため null
      updatedAt: today,
      // run-scraper.js のマージ処理が期待するフラット形式
      store: STORE_KEY,
      url: episodeUrl,
      originalPrice: 0,
      salePrice: 0,
      discountRate: 100,
    });
  });

  console.log(`[${SITE_NAME}] ${books.length} 件のキャンペーン作品を取得しました。`);
  return books;
}

module.exports = { parseJumpplusCampaign };
