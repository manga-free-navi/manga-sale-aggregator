/**
 * biccomicCampaign.js
 * ビッコミ（小学館） トップページの「期間限定キャンペーン」セクションから
 * 期間限定無料公開の漫画情報を収集するパーサー
 */

const axios = require('axios');
const cheerio = require('cheerio');

/** ビッコミ トップページURL */
const BICCOMIC_TOP_URL = 'https://bigcomics.jp/';

/** ストアキー */
const STORE_KEY = 'biccomic';

/** サイト名 */
const SITE_NAME = 'ビッコミ（無料キャンペーン）';

/**
 * ビッコミのキャンペーン見出しテキストから日付を自動パースする
 */
function extractEndDate(text) {
  const today = new Date();
  const currentYear = today.getFullYear();
  
  // 1. 「X月Y日まで」のパターン
  const match1 = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (match1) {
    return `${currentYear}-${String(match1[1]).padStart(2, '0')}-${String(match1[2]).padStart(2, '0')}`;
  }

  // 2. 「X/Yまで」のパターン
  const match2 = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (match2) {
    return `${currentYear}-${String(match2[1]).padStart(2, '0')}-${String(match2[2]).padStart(2, '0')}`;
  }

  return null;
}

/**
 * ビッコミ トップページから「期間限定無料キャンペーン」を収集する
 * @returns {Promise<Object[]>} 書籍オブジェクト配列
 */
async function parseBiccomicCampaign() {
  console.log(`[${SITE_NAME}] トップページを取得中: ${BICCOMIC_TOP_URL}`);

  let html;
  try {
    const response = await axios.get(BICCOMIC_TOP_URL, {
      timeout: 20000,
      headers: {
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

  // カルーセルや「home-special-section」内のキャンペーンブロックをパース
  $('div.home-special-section').each((_, el) => {
    const $el = $(el);

    // 見出しタイトル (h2.home-special-section-h)
    const rawHeading = $el.find('h2.home-special-section-h').text().trim();
    if (!rawHeading) return;

    // キャンペーン遷移先リンク (a.home-special-item-link)
    const linkEl = $el.find('a.home-special-item-link').first();
    let relativeUrl = linkEl.attr('href');
    if (!relativeUrl) return;

    const absoluteUrl = relativeUrl.startsWith('http') 
      ? relativeUrl 
      : `https://bigcomics.jp${relativeUrl}`;

    // バナー画像 (img)
    const imgEl = $el.find('img.home-special-item-img').first();
    const rawImgSrc = imgEl.attr('src') || '';
    const imgSrc = imgEl.attr('data-src') || rawImgSrc;

    // 見出しから『作品名』を抽出する
    let bookTitle = rawHeading;
    const titleMatch = rawHeading.match(/『([^』]+)』/);
    if (titleMatch) {
      bookTitle = titleMatch[1];
    } else {
      // 『』が無い場合はタイトル全体の「キャンペーン」や「無料」の前の部分を作品名にする
      bookTitle = rawHeading.split(/[‼！!【]|\s/)[0].trim();
    }

    const safeId = `${STORE_KEY}_campaign_${bookTitle.replace(/[^a-zA-Z0-9\u3040-\u9FFF]/g, '_')}`;
    const endDate = extractEndDate(rawHeading);

    // 終了期限切れのデータは追加しない
    if (endDate && endDate < today) return;

    // 「無料」や「試し読み」「全話」「全巻」などの文言が含まれている場合に収集
    const isFreeCampaign = rawHeading.includes('無料') || 
                           rawHeading.includes('解放') || 
                           rawHeading.includes('試し読み') || 
                           rawHeading.includes('イッキ');

    if (isFreeCampaign) {
      // 全話・全巻判定
      const isAllFree = rawHeading.includes('全話') || rawHeading.includes('全巻');
      const volsFreeText = isAllFree ? '全話無料' : '期間限定無料';

      books.push({
        id: safeId,
        title: bookTitle,
        author: '小学館公式',
        publisher: 'ビッコミ',
        imageUrl: imgSrc,
        genre: '漫画',
        description: rawHeading, // キャンペーン見出しを説明文にする
        endDate: endDate,
        updatedAt: today,
        volsFreeText: volsFreeText,
        // マージ用フラット構造
        store: STORE_KEY,
        url: absoluteUrl,
        originalPrice: 0,
        salePrice: 0,
        discountRate: 100,
        category: 'limited_free', // 期間限定無料カテゴリとして定義
        isAllFree: isAllFree
      });
    }
  });

  console.log(`[${SITE_NAME}] ${books.length} 件のキャンペーン作品を取得しました。`);
  return books;
}

module.exports = { parseBiccomicCampaign };
