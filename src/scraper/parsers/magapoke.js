/**
 * magapoke.js
 * マガジンポケット（講談社）の連載一覧ページから
 * 現在無料公開中の連載作品一覧を収集するパーサー
 *
 * 収集方法:
 *   1. https://pocket.shonenmagazine.com/series の HTML を取得
 *   2. 各曜日のセクション（#monday 〜 #sunday）内の作品リンクから情報を cheerio で抽出
 *   3. 各作品の曜日と本日の差分から最新公開日と次回更新予定日を算出
 */

const axios = require('axios');
const cheerio = require('cheerio');

/** マガポケ 連載一覧URL */
const MAGAPOKE_SERIES_URL = 'https://pocket.shonenmagazine.com/series';

/** ストアキー */
const STORE_KEY = 'magapoke';

/** サイト名 */
const SITE_NAME = 'マガポケ（講談社）';

/**
 * 曜日に基づいて直近の公開日（latestPubDate）と次回更新予定日（nextUpdateDate）を算出する
 *
 * @param {string} dayId - monday, tuesday, wednesday, thursday, friday, saturday, sunday
 * @returns {{latestPubDate: string, nextUpdateDate: string}}
 */
function calculateDatesFromDay(dayId) {
  const dayMap = {
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6,
    'sunday': 7
  };
  const targetDay = dayMap[dayId];
  const jstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const currentDay = jstNow.getDay() === 0 ? 7 : jstNow.getDay(); // 1=月曜...7=日曜
  
  if (!targetDay) {
    const todayStr = jstNow.toISOString().slice(0, 10);
    return { latestPubDate: todayStr, nextUpdateDate: todayStr };
  }

  // 本日の曜日と対象の曜日の差分
  let diff = currentDay - targetDay;
  if (diff < 0) {
    diff += 7; // 前週のその曜日
  }

  // 最新公開日（直近のその曜日）
  const pubDate = new Date(jstNow);
  pubDate.setDate(pubDate.getDate() - diff);
  const latestPubDate = pubDate.toISOString().slice(0, 10);

  // 次回更新予定日（最新公開日の7日後）
  const nextDate = new Date(pubDate);
  nextDate.setDate(nextDate.getDate() + 7);
  const nextUpdateDate = nextDate.toISOString().slice(0, 10);

  return { latestPubDate, nextUpdateDate };
}

/**
 * マガポケの連載一覧から無料作品情報を取得する
 *
 * @returns {Promise<Object[]>} 書籍オブジェクト配列
 */
async function parseMagapoke() {
  console.log(`[${SITE_NAME}] 連載作品を取得中: ${MAGAPOKE_SERIES_URL}`);

  let html;
  try {
    const response = await axios.get(MAGAPOKE_SERIES_URL, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
      responseType: 'text',
    });
    html = response.data;
  } catch (err) {
    console.error(`[${SITE_NAME}] HTMLの取得に失敗しました: ${err.message}`);
    return [];
  }

  const $ = cheerio.load(html);
  const books = [];
  const today = new Date().toISOString().slice(0, 10);
  const daySecs = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  daySecs.forEach(dayId => {
    const { latestPubDate, nextUpdateDate } = calculateDatesFromDay(dayId);

    $(`#${dayId} li.c-series-items__item a.c-series-item`).each((_, el) => {
      const $el = $(el);

      const href = $el.attr('href') || '';
      if (!href) return;

      // /title/03264/episode/438779 または /title/03264 などのURLから数値IDを抽出
      const idMatch = href.match(/\/title\/(\d+)/);
      if (!idMatch) return;
      const seriesIdNum = idMatch[1];

      // タイトル
      const title = $el.find('h3.c-series-item__ttl').text().trim();
      if (!title) return;

      // 著者
      const author = $el.find('p.c-series-item__name').text().trim() || '不明';

      // 説明文（最新話のキャッチコピーなど）
      const description = $el.find('p.c-series-item__description').text().trim() || 'マガポケにて無料連載中';

      // サムネイル
      const rawImgSrc = $el.find('.c-series-item__img img').attr('src') || '';
      const imgSrc = $el.find('.c-series-item__img img').attr('data-src') || rawImgSrc;

      // オリジナルラベルの判定
      const hasLabel = $el.find('.c-series-item__label img').length > 0;
      const labelText = $el.find('.c-series-item__label').text().trim();
      const isOriginal = hasLabel || labelText.includes('オリジナル');
      const publisher = isOriginal ? 'マガポケオリジナル（講談社）' : 'マガポケ（講談社）';

      // 一意ID
      const safeId = `${STORE_KEY}_${seriesIdNum}`;
      // 絶対URL
      const absoluteUrl = href.startsWith('http') ? href : `https://pocket.shonenmagazine.com${href}`;

      books.push({
        id: safeId,
        title: title,
        author: author,
        publisher: publisher,
        imageUrl: imgSrc,
        genre: '漫画',
        description: description,
        endDate: null,
        updatedAt: today,
        // マージ処理用フラット形式
        store: STORE_KEY,
        url: absoluteUrl,
        originalPrice: 0,
        salePrice: 0,
        discountRate: 100,
        freeEpisodeCount: 1,
        freeEpisodes: [
          {
            title: '最新話',
            fullTitle: '最新話',
            url: absoluteUrl,
            pubDate: latestPubDate
          }
        ],
        latestPubDate: latestPubDate,
        nextUpdateDate: nextUpdateDate,
      });
    });
  });

  console.log(`[${SITE_NAME}] ${books.length} 件 of 連載作品を取得しました。`);
  return books;
}

module.exports = { parseMagapoke };
