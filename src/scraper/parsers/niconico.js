/**
 * niconico.js
 * ニコニコ漫画（公式無料・ランキング作品）を収集するパーサー
 */

const axios = require('axios');
const cheerio = require('cheerio');

const NICONICO_BASE_URL = 'https://manga.nicovideo.jp';
const STORE_KEY = 'niconico';
const SITE_NAME = 'ニコニコ漫画';

const RANKING_URLS = [
  'https://manga.nicovideo.jp/ranking/daily',
  'https://manga.nicovideo.jp/ranking/point/hourly/shonen',
  'https://manga.nicovideo.jp/ranking/point/hourly/seinen',
  'https://manga.nicovideo.jp/ranking/point/hourly/shojo',
  'https://manga.nicovideo.jp/ranking/point/hourly/josei'
];

/**
 * ニコニコ漫画から無料マンガ作品情報を取得する
 * @returns {Promise<Array>}
 */
async function parseNiconico() {
  const booksMap = new Map();
  const today = new Date().toISOString().slice(0, 10);

  console.log(`[${SITE_NAME}] データの収集を開始します...`);

  for (const rankingUrl of RANKING_URLS) {
    try {
      console.log(`[${SITE_NAME}] 取得中: ${rankingUrl}`);
      const response = await axios.get(rankingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ja-JP,ja;q=0.9'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);

      $('a[href*="/comic/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const match = href.match(/\/comic\/(\d+)/);
        if (!match) return;

        const comicId = match[1];
        const text = $(el).text().trim();
        if (!text || text === 'マンガ') return;

        if (!booksMap.has(comicId)) {
          booksMap.set(comicId, {
            comicId,
            title: '',
            freeText: ''
          });
        }

        const item = booksMap.get(comicId);
        if (text.includes('無料') || text.includes('話')) {
          item.freeText = text;
        } else {
          item.title = text;
        }
      });
    } catch (err) {
      console.warn(`[${SITE_NAME}] 取得失敗 (${rankingUrl}): ${err.message}`);
    }
  }

  const books = [];
  for (const item of booksMap.values()) {
    if (!item.title || item.title.length < 2) continue;

    const comicId = item.comicId;
    const absoluteUrl = `${NICONICO_BASE_URL}/comic/${comicId}`;
    const safeId = `${STORE_KEY}_${comicId}`;

    // 無料話数の抽出（例: "7話 無料" -> 7）
    let epCount = 1;
    if (item.freeText) {
      const epMatch = item.freeText.match(/(\d+)\s*話/);
      if (epMatch) {
        epCount = parseInt(epMatch[1], 10);
      }
    }

    const volsFreeText = item.freeText ? `${item.freeText}公開` : 'Web連載無料';

    // サムネイル画像の代替URL生成
    const imageUrl = `https://nicovideo.cdn.nimg.jp/thumbnails/mg/${comicId}`;

    books.push({
      id: safeId,
      title: item.title,
      author: 'ニコニコ漫画公式',
      publisher: 'ニコニコ漫画',
      imageUrl: imageUrl,
      genre: '漫画',
      description: `ニコニコ漫画にて ${item.freeText || '無料配信中'}！『${item.title}』`,
      endDate: null,
      updatedAt: today,
      volsFreeText: volsFreeText,
      store: STORE_KEY,
      url: absoluteUrl,
      originalPrice: 0,
      salePrice: 0,
      discountRate: 100,
      freeEpisodeCount: epCount,
      freeEpisodes: [
        {
          title: item.freeText || '最新話無料',
          fullTitle: item.freeText ? `全${item.freeText}` : '無料配信中',
          url: absoluteUrl,
          pubDate: today
        }
      ],
      latestPubDate: today
    });
  }

  console.log(`[${SITE_NAME}] ${books.length} 件の作品を抽出しました。`);
  return books;
}

module.exports = { parseNiconico };
