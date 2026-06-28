/**
 * comicdaysCampaign.js
 * コミックDAYS（講談社）のトップページに埋め込まれた Next.js データから
 * 期間限定の無料キャンペーン作品一覧を収集するパーサー
 */

const axios = require('axios');
const cheerio = require('cheerio');

const COMICDAYS_TOP_URL = 'https://comic-days.com/';
const STORE_KEY = 'comicdays_campaign';
const SITE_NAME = 'コミックDAYS（キャンペーン）';

/**
 * Base64でエンコードされたIDからデータベース数値IDを抽出する
 * 例: "U2VyaWVzOjEwODM0MTA4MTU2NjI5NTU3NDIw" -> Base64デコード -> "Series:10834108156629557420" -> "10834108156629557420"
 *
 * @param {string} base64Id
 * @returns {string} 数値ID
 */
function extractDatabaseId(base64Id) {
  if (!base64Id) return '';
  try {
    const decoded = Buffer.from(base64Id, 'base64').toString('utf-8');
    const match = decoded.match(/Series:(\d+)/);
    return match ? match[1] : '';
  } catch (e) {
    return '';
  }
}

/**
 * 画像URLテンプレートを具体的なピクセル数に置換する
 *
 * @param {string} template
 * @returns {string} 画像URL
 */
function resolveImageUrl(template) {
  if (!template) return '';
  return template.replace(/{width}/g, '300').replace(/{height}/g, '400');
}

/**
 * コミックDAYSのトップページから無料公開キャンペーン情報を取得する
 *
 * @returns {Promise<Object[]>} 書籍オブジェクト配列
 */
async function parseComicdaysCampaign() {
  console.log(`[${SITE_NAME}] トップページを取得中: ${COMICDAYS_TOP_URL}`);

  let html;
  try {
    const response = await axios.get(COMICDAYS_TOP_URL, {
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
  const nextDataText = $('#__NEXT_DATA__').html();
  if (!nextDataText) {
    console.warn(`[${SITE_NAME}] #__NEXT_DATA__ が見つかりませんでした。`);
    return [];
  }

  let parsedData;
  try {
    parsedData = JSON.parse(nextDataText);
  } catch (err) {
    console.error(`[${SITE_NAME}] JSONのパースに失敗しました: ${err.message}`);
    return [];
  }

  const campaigns = parsedData.props?.pageProps?.data?.freeSeriesCampaignList || [];
  const books = [];
  const today = new Date().toISOString().slice(0, 10);

  // 重複排除用
  const seenIds = new Set();

  campaigns.forEach(c => {
    if (!c.seriesSlice || !c.seriesSlice.seriesList) return;

    c.seriesSlice.seriesList.forEach(item => {
      if (!item || !item.title) return;

      const base64Id = item.id;
      const dbId = extractDatabaseId(base64Id);
      const titleId = dbId || base64Id;
      if (!titleId || seenIds.has(titleId)) return;
      seenIds.add(titleId);

      const title = item.title;
      // 著者名はデータに含まれていないため「コミックDAYS公式」や「不明」にする、
      // あるいは shortDescription の一部を表示
      const author = '不明';
      const description = item.shortDescription || 'コミックDAYS期間限定無料キャンペーン';

      const freeCount = item.freeEpisodeOr0ptEpisodeCount || 0;
      const promoLabel = freeCount > 0 ? `${freeCount}話分無料公開中` : '期間限定無料キャンペーン';

      const imgSrc = resolveImageUrl(item.thumbnailUriTemplate || item.thumbnailUriSquareTemplate);
      const safeId = `${STORE_KEY}_${titleId}`;

      // URLの解決 (permalinkを優先し、なければ詳細URL)
      const permalink = item.firstEpisode?.permalink || '';
      const url = permalink || `https://comic-days.com/series/${titleId}`;

      books.push({
        id: safeId,
        title: title,
        author: author,
        publisher: 'コミックDAYS（講談社）',
        imageUrl: imgSrc,
        genre: '漫画',
        description: `${promoLabel}（${description}）`,
        endDate: null, // 終了期限はトップページからは特定困難なため null
        updatedAt: today,
        store: STORE_KEY,
        url: url,
        originalPrice: 0,
        salePrice: 0,
        discountRate: 100,
      });
    });
  });

  console.log(`[${SITE_NAME}] ${books.length} 件のキャンペーン作品を取得しました。`);
  return books;
}

module.exports = { parseComicdaysCampaign };
