/**
 * magapokeCampaign.js
 * マガジンポケット（講談社）のトップページに埋め込まれた Nuxt3 データから
 * 期間限定の無料公開・巻数無料キャンペーン作品一覧を収集するパーサー
 */

const axios = require('axios');
const cheerio = require('cheerio');

const MAGAPOKE_TOP_URL = 'https://pocket.shonenmagazine.com/';
const STORE_KEY = 'magapoke_campaign';
const SITE_NAME = 'マガポケ（キャンペーン）';

/**
 * キャンペーンテキストから終了日を逆算するヘルパー
 * 例: "3巻分無料！7/2まで" -> "2026-07-02"
 *
 * @param {string} campaignText
 * @returns {string|null} YYYY-MM-DD
 */
function parseEndDate(campaignText) {
  if (!campaignText) return null;
  const match = campaignText.match(/(\d+)\/(\d+)\s*まで/);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);

  const jstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  let year = jstNow.getFullYear();

  // 現在月より小さい月で差が極端に大きい場合は来年と推定（例: 現在12月で1/5締めなど）
  const currentMonth = jstNow.getMonth() + 1;
  if (month < currentMonth && currentMonth - month > 6) {
    year += 1;
  }

  const mStr = String(month).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  return `${year}-${mStr}-${dStr}`;
}

/**
 * Nuxt3の平坦化配列からオブジェクト構造を解決・デシリアライズする
 */
function resolveNuxtData(data) {
  const cache = new Map();

  function resolve(val) {
    if (val === null || val === undefined) return val;
    if (typeof val !== 'object') return val;
    if (cache.has(val)) return cache.get(val);

    if (Array.isArray(val)) {
      const res = [];
      cache.set(val, res);
      const start = (val[0] === 'Set' || val[0] === 'Map' || val[0] === 'ShallowReactive') ? 1 : 0;
      for (let i = start; i < val.length; i++) {
        const item = val[i];
        if (typeof item === 'number' && item >= 0 && item < data.length) {
          res.push(resolve(data[item]));
        } else {
          res.push(resolve(item));
        }
      }
      return res;
    }

    const res = {};
    cache.set(val, res);
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === 'number' && v >= 0 && v < data.length) {
        res[k] = resolve(data[v]);
      } else {
        res[k] = resolve(v);
      }
    }
    return res;
  }

  const results = [];
  data.forEach(item => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const resolved = resolve(item);
      results.push(resolved);
    }
  });
  return results;
}

/**
 * マガポケのトップページから無料公開キャンペーン情報を取得する
 *
 * @returns {Promise<Object[]>} 書籍オブジェクト配列
 */
async function parseMagapokeCampaign() {
  console.log(`[${SITE_NAME}] トップページを取得中: ${MAGAPOKE_TOP_URL}`);

  let html;
  try {
    const response = await axios.get(MAGAPOKE_TOP_URL, {
      timeout: 25000,
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
  const nuxtDataText = $('#__NUXT_DATA__').html();
  if (!nuxtDataText) {
    console.warn(`[${SITE_NAME}] #__NUXT_DATA__ が見つかりませんでした。`);
    return [];
  }

  let parsedData;
  try {
    parsedData = JSON.parse(nuxtDataText);
  } catch (err) {
    console.error(`[${SITE_NAME}] JSONのパースに失敗しました: ${err.message}`);
    return [];
  }

  const allResolved = resolveNuxtData(parsedData);
  const books = [];
  const today = new Date().toISOString().slice(0, 10);

  // 重複排除用
  const seenIds = new Set();

  allResolved.forEach(obj => {
    if (!obj || !obj.title_id || !obj.title_name) return;

    // キャンペーンテキストがあるものを抽出
    let campaignText = '';
    for (const v of Object.values(obj)) {
      if (typeof v === 'string' && v.includes('無料') && (v.includes('巻') || v.includes('話') || v.includes('まで'))) {
        campaignText = v;
        break;
      }
    }

    if (!campaignText) return;

    const titleId = String(obj.title_id);
    if (seenIds.has(titleId)) return;
    seenIds.add(titleId);

    const title = obj.title_name;
    const author = obj.author_text || '不明';
    
    // 画像URLの選択
    const rawImg = obj.thumbnail_image_url || obj.thumbnail_rect_image_url || '';
    const imgSrc = rawImg.startsWith('http') ? rawImg : `https://pocket.shonenmagazine.com${rawImg}`;

    const endDate = parseEndDate(campaignText);
    const safeId = `${STORE_KEY}_${titleId}`;
    const url = `https://pocket.shonenmagazine.com/title/${titleId}`;

    books.push({
      id: safeId,
      title: title,
      author: author,
      publisher: 'マガポケ（講談社）',
      imageUrl: imgSrc,
      genre: '漫画',
      description: `${campaignText}（マガポケ期間限定無料キャンペーン）`,
      endDate: endDate,
      updatedAt: today,
      store: STORE_KEY,
      url: url,
      originalPrice: 0,
      salePrice: 0,
      discountRate: 100,
    });
  });

  console.log(`[${SITE_NAME}] ${books.length} 件のキャンペーン作品を取得しました。`);
  return books;
}

module.exports = { parseMagapokeCampaign };
