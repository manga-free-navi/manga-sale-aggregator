const axios = require('axios');
const cheerio = require('cheerio');

// 主要なマンガ配信サービスやストアのドメイン
const MANGA_DOMAINS = [
  'kuragebunch.com',
  'shonenjumpplus.com',
  'zebrack-comic.shueisha.co.jp',
  'comic-days.com',
  'pocket.shonenmagazine.com',
  'sunday-webry.com',
  'manga-one.com',
  'urasunday.com',
  'comic-walker.com',
  'bookwalker.jp',
  'cmoa.jp',
  'ebookjapan.yahoo.co.jp',
  'renta.papy.co.jp',
  'mechacomic.jp',
  'manga.line.me',
  'piccoma.com',
  'biccomic.jp'
];

/**
 * ユーティリティ: 指定ミリ秒待機する
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 相対時間や日時文字列から「年」を判定する
 * @param {string} timeText
 * @returns {number} 年
 */
function parseYear(timeText) {
  const match = timeText.match(/(\d{4})年/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return new Date().getFullYear();
}

/**
 * プレスリリース本文からキャンペーン終了日(endDate)を抽出する
 * @param {string} text 本文テキスト
 * @param {number} defaultYear デフォルトの年
 * @returns {string|null} YYYY-MM-DD形式の日付、またはnull
 */
function extractEndDate(text, defaultYear = new Date().getFullYear()) {
  // 「~X月Y日まで」「X月Y日（金）まで」「X月Y日(金) 23:59まで」などのパターンを検出
  // 1. 年月日パターン (「まで」の間に「月」が含まれないことを保証)
  const pattern1 = /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日(?:(?!月).)*?まで/g;
  // 2. スラッシュパターン (例: 7/17まで) (「まで」の間に「/」が含まれないことを保証)
  const pattern2 = /(\d{1,2})\/(\d{1,2})(?:(?!\/).)*?まで/g;

  let matches = [];
  let match;

  // パターン1で検索
  while ((match = pattern1.exec(text)) !== null) {
    const year = match[1] ? parseInt(match[1], 10) : defaultYear;
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    matches.push({ year, month, day });
  }

  // パターン1で見つからなければパターン2で検索
  if (matches.length === 0) {
    while ((match = pattern2.exec(text)) !== null) {
      const month = parseInt(match[1], 10);
      const day = parseInt(match[2], 10);
      matches.push({ year: defaultYear, month, day });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  const dates = matches.map(m => {
    const d = new Date(m.year, m.month - 1, m.day);
    return {
      formatted: `${m.year}-${String(m.month).padStart(2, '0')}-${String(m.day).padStart(2, '0')}`,
      time: d.getTime()
    };
  }).filter(d => !isNaN(d.time));

  if (dates.length === 0) return null;

  // ソートして最も未来の日付を採用
  dates.sort((a, b) => b.time - a.time);
  return dates[0].formatted;
}

/**
 * 抽出されたリンクから主要マンガサイトのURLを特定する
 * @param {Array} links リンクオブジェクトの配列
 * @param {string} fallbackUrl 見つからなかった場合のフォールバックURL
 * @returns {string} ストア直行URL
 */
function extractStoreUrl(links, fallbackUrl) {
  for (const domain of MANGA_DOMAINS) {
    const found = links.find(l => l.href.includes(domain));
    if (found) {
      return found.href;
    }
  }
  return fallbackUrl;
}

/**
 * PR TIMESの検索結果から無料公開されているマンガキャンペーン情報を自動収集する
 * @returns {Promise<Array>} 収集された漫画データの配列
 */
async function parsePrtimes() {
  const books = [];
  const searchUrl = 'https://prtimes.jp/main/action.php?run=html&page=searchkey&search_word=%E6%BC%AB%E7%94%BB%20%E7%84%A1%E6%96%99%E5%85%AC%E9%96%8B';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
  };

  try {
    console.log(`[PR TIMES] リクエスト開始: ${searchUrl}`);
    const response = await axios.get(searchUrl, { headers, timeout: 15000 });
    
    if (!response.data) {
      console.log('[PR TIMES] 検索結果が空です。');
      return [];
    }

    const $ = cheerio.load(response.data);
    const releaseCards = $('article[class*="release-card_article"]');
    
    console.log(`[PR TIMES] 検索一覧から ${releaseCards.length} 件のリリースを発見しました。`);

    // 上位15件をクロール対象にする（サーバー負荷防止と最新情報の担保）
    const targetCards = releaseCards.slice(0, 15);
    
    for (let i = 0; i < targetCards.length; i++) {
      const card = $(targetCards[i]);
      const linkEl = card.find('a[href*="/main/html/rd/p/"]').first();
      if (linkEl.length === 0) continue;

      const relativeHref = linkEl.attr('href');
      const detailUrl = `https://prtimes.jp${relativeHref}`;
      const title = card.find('h3[class*="release-card_title"]').first().text().trim();
      const imageUrl = card.find('img[class*="release-card_thumbnail"]').first().attr('src') || '';
      const companyName = card.find('a[class*="release-card_companyLink"]').first().text().trim() || '不明';
      const timeText = card.find('time').first().text().trim() || '';

      const releaseYear = parseYear(timeText);
      const idMatch = relativeHref.match(/rd\/p\/([^\/]+)\.html/);
      const prId = idMatch ? idMatch[1].replace('.', '-') : Math.random().toString(36).substring(2, 9);

      console.log(`[PR TIMES] 詳細クロール中 (${i + 1}/${targetCards.length}): ${detailUrl}`);

      try {
        // 連続リクエストによる負荷低減のための待機 (1秒)
        await sleep(1000);

        const detailRes = await axios.get(detailUrl, { headers, timeout: 10000 });
        const $detail = cheerio.load(detailRes.data);
        
        const bodyText = $detail('article').text().trim();
        const description = bodyText.substring(0, 250).replace(/\s+/g, ' ') + '...';

        // 外部リンクの抽出
        const links = [];
        $detail('article a').each((_, el) => {
          const href = $detail(el).attr('href') || '';
          const text = $detail(el).text().trim();
          if (href && !href.startsWith('#') && !href.startsWith('/') && !href.includes('javascript:')) {
            links.push({ text, href });
          }
        });

        // ロジックから終了日とストア直行URLを算出
        const endDate = extractEndDate(bodyText, releaseYear);
        const storeUrl = extractStoreUrl(links, detailUrl);

        books.push({
          id: `prtimes-${prId}`,
          title: title,
          author: `プレスリリース`,
          publisher: companyName,
          imageUrl: imageUrl,
          store: 'prtimes',
          originalPrice: 0,
          salePrice: 0,
          discountRate: 100,
          url: storeUrl,
          genre: 'キャンペーン',
          endDate: endDate,
          description: description,
          updatedAt: new Date().toISOString()
        });

      } catch (detailError) {
        console.error(`[PR TIMES] 詳細ページの取得に失敗しました: ${detailUrl}`, detailError.message);
        // エラー時は一覧から得られる情報だけで最低限のデータを作る（フォールバック）
        books.push({
          id: `prtimes-${prId}`,
          title: title,
          author: `プレスリリース`,
          publisher: companyName,
          imageUrl: imageUrl,
          store: 'prtimes',
          originalPrice: 0,
          salePrice: 0,
          discountRate: 100,
          url: detailUrl,
          genre: 'キャンペーン',
          endDate: null,
          description: 'プレスリリースの詳細内容はPR TIMESの公式サイトをご確認ください。',
          updatedAt: new Date().toISOString()
        });
      }
    }

    return books;

  } catch (error) {
    console.error('[PR TIMES] クロール中にエラーが発生しました:', error.message);
    return [];
  }
}

module.exports = { parsePrtimes };
