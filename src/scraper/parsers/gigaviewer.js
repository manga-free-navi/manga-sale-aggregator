/**
 * gigaviewer.js
 * GigaViewer（はてな）ベースの漫画サイト RSS フィードから
 * 現在無料公開中のエピソード一覧を収集するパーサー
 *
 * 対応サイト:
 *   - 少年ジャンプ＋ : https://shonenjumpplus.com/rss
 *   - サンデーうぇぶり: https://www.sunday-webry.com/rss
 */

const axios = require('axios');

/** RSS フィードの設定リスト */
const GIGAVIEWER_SITES = [
  {
    storeKey: 'jumpplus',
    siteName: 'ジャンプ＋（集英社）',
    rssUrl: 'https://shonenjumpplus.com/rss',
  },
  {
    storeKey: 'sundaywebry',
    siteName: 'サンデーうぇぶり（小学館）',
    rssUrl: 'https://www.sunday-webry.com/rss',
  },
  {
    storeKey: 'comicdays',
    siteName: 'コミックDAYS（講談社）',
    rssUrl: 'https://comic-days.com/rss',
  },
  {
    storeKey: 'tonarinoyj',
    siteName: 'となりのヤングジャンプ（集英社）',
    rssUrl: 'https://tonarinoyj.jp/rss',
  },
  {
    storeKey: 'kuragebunch',
    siteName: 'くらげバンチ（新潮社）',
    rssUrl: 'https://kuragebunch.com/rss',
  },
  {
    storeKey: 'comicgardo',
    siteName: 'コミックガルド（オーバーラップ）',
    rssUrl: 'https://comic-gardo.com/rss',
  },
  {
    storeKey: 'magcomi',
    siteName: 'MAGCOMI（マッグガーデン）',
    rssUrl: 'https://magcomi.com/rss',
  },
  {
    storeKey: 'biccomic',
    siteName: 'ビッコミ（小学館）',
    rssUrl: 'https://biccomic.jp/rss',
  },
];

/**
 * RSS の XML テキストからエピソード一覧を解析し、
 * シリーズ名ごとにまとめた書籍オブジェクト配列を返す
 *
 * @param {string} xmlText - RSS XML テキスト
 * @param {string} storeKey - ストアキー ('jumpplus' など)
 * @param {string} siteName - サイト名
 * @returns {Object[]} 書籍オブジェクト配列
 */
function parseRssXml(xmlText, storeKey, siteName) {
  // <item> タグをすべて抽出
  const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g);
  if (!itemMatches || itemMatches.length === 0) {
    console.warn(`[${siteName}] RSS に item が見つかりませんでした`);
    return [];
  }

  /**
   * タグの内容を取り出すヘルパー
   * @param {string} xmlBlock - XML ブロック
   * @param {string} tagName - タグ名
   * @returns {string} タグの中身
   */
  function extractTag(xmlBlock, tagName) {
    // 名前空間を含むタグ（例: giga:freeTermStartDate）も対応
    const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
    const m = xmlBlock.match(re);
    return m ? m[1].trim() : '';
  }

  /**
   * <enclosure url="..."> の url 属性を取り出すヘルパー
   * @param {string} xmlBlock
   * @returns {string}
   */
  function extractEnclosureUrl(xmlBlock) {
    const m = xmlBlock.match(/<enclosure[^>]*url="([^"]+)"/i);
    return m ? m[1] : '';
  }

  /**
   * CDATA を除去するヘルパー
   * @param {string} text
   * @returns {string}
   */
  function stripCdata(text) {
    return text.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
  }

  /**
   * HTML エンティティを変換するヘルパー
   * @param {string} text
   * @returns {string}
   */
  function decodeHtml(text) {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // 日付フォーマット用のヘルパー関数 (JST標準時に補正)
  function formatPubDate(pubDateStr) {
    try {
      const d = new Date(pubDateStr);
      if (isNaN(d.getTime())) return null;
      // JST (UTC+9) への補正
      const jstDate = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      return jstDate.toISOString().slice(0, 10);
    } catch (e) {
      return null;
    }
  }

  // 次回更新日の計算 (最新公開日の7日後を週刊連載の基準とする)
  function calculateNextUpdateDate(latestPubDateStr) {
    if (!latestPubDateStr) return null;
    try {
      const d = new Date(latestPubDateStr);
      if (isNaN(d.getTime())) return null;
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    } catch (e) {
      return null;
    }
  }

  // シリーズ名をキーにしてエピソードをグループ化
  // key: シリーズ名, value: { episodes: [], author, imageUrl, ... }
  const seriesMap = new Map();
  const today = new Date().toISOString().slice(0, 10);

  for (const itemXml of itemMatches) {
    const episodeTitle = decodeHtml(stripCdata(extractTag(itemXml, 'title')));
    const link = stripCdata(extractTag(itemXml, 'link'));
    // GigaViewer RSS では <description> タグがシリーズ名に対応している
    const seriesName = decodeHtml(stripCdata(extractTag(itemXml, 'description')));
    const author = decodeHtml(stripCdata(extractTag(itemXml, 'author')));
    const imageUrl = extractEnclosureUrl(itemXml);
    const pubDate = stripCdata(extractTag(itemXml, 'pubDate'));
    const freeTermStart = stripCdata(extractTag(itemXml, 'giga:freeTermStartDate'));

    // シリーズ名が空のものはスキップ
    if (!seriesName || !link) continue;

    if (!seriesMap.has(seriesName)) {
      seriesMap.set(seriesName, {
        latestEpisodeTitle: episodeTitle,
        latestUrl: link,
        author: author || '不明',
        imageUrl: imageUrl,
        pubDate: pubDate,
        freeTermStart: freeTermStart,
        episodes: [],
      });
    }
    
    const info = seriesMap.get(seriesName);
    // タイトルの [第X話] や [X話] などの話数表記部分を抽出
    const match = episodeTitle.match(/^\[([^\]]+)\]/);
    const epName = match ? match[1] : '最新話';
    
    // エピソード情報をリストに追加
    info.episodes.push({
      title: epName,
      fullTitle: episodeTitle,
      url: link,
      pubDate: formatPubDate(pubDate) || today,
    });
  }

  // シリーズマップを書籍オブジェクト配列に変換
  const books = [];

  for (const [seriesName, info] of seriesMap.entries()) {
    // ストアキーとシリーズ名を組み合わせた一意 ID
    const safeId = `${storeKey}_${seriesName.replace(/[^a-zA-Z0-9\u3040-\u9FFF]/g, '_')}`;

    // RSSの並び順（通常最新が先頭）に基づいて、最新エピソードの日付を取得
    const latestEp = info.episodes[0];
    const latestPubDate = latestEp ? latestEp.pubDate : today;
    const nextUpdateDate = calculateNextUpdateDate(latestPubDate);

    books.push({
      id: safeId,
      title: seriesName,
      author: info.author,
      publisher: siteName,
      imageUrl: info.imageUrl,
      genre: '漫画',
      // 無料公開エピソードが何話か分かるように description に記載
      description: info.episodes.length > 1
        ? `${info.episodes.length}話が無料公開中（${siteName}）`
        : `最新話が無料公開中（${siteName}）`,
      // 独立したフィールドとして話数を保存（UIでの表示用）
      freeEpisodeCount: info.episodes.length,
      freeEpisodes: info.episodes,
      latestPubDate: latestPubDate,
      nextUpdateDate: nextUpdateDate,
      endDate: null, // RSS には終了日の記載がないため null
      updatedAt: today,
      // run-scraper.js のマージ処理が期待するフラット形式
      store: storeKey,
      url: info.latestUrl,
      originalPrice: 0,
      salePrice: 0,
      discountRate: 100,
    });
  }

  return books;
}

/**
 * GigaViewer ベースの全サイトから RSS を取得してパースする
 * @returns {Promise<Object[]>} 書籍オブジェクト配列
 */
async function parseGigaviewer() {
  const allBooks = [];

  for (const site of GIGAVIEWER_SITES) {
    try {
      console.log(`[GigaViewer] ${site.siteName} の RSS を取得中: ${site.rssUrl}`);

      const response = await axios.get(site.rssUrl, {
        timeout: 15000,
        headers: {
          // 一般的なブラウザを模倣するヘッダ
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        },
        // RSS は文字コードを正しく扱う必要があるため responseType を text に
        responseType: 'text',
      });

      const xmlText = response.data;
      const books = parseRssXml(xmlText, site.storeKey, site.siteName);

      console.log(`[GigaViewer] ${site.siteName}: ${books.length} シリーズを取得`);
      allBooks.push(...books);

      // サイト間のリクエストに 1 秒のウェイトを挿入してサーバー負荷を軽減
      if (GIGAVIEWER_SITES.indexOf(site) < GIGAVIEWER_SITES.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error(`[GigaViewer] ${site.siteName} の取得に失敗: ${err.message}`);
      // 1 サイトが失敗しても他のサイトの処理は継続する
    }
  }

  return allBooks;
}

module.exports = { parseGigaviewer };
