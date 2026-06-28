/**
 * yanmaga.js
 * ヤンマガWeb（講談社）の無料連載および期間限定キャンペーン（今だけお得）作品を収集するパーサー
 */

const axios = require('axios');
const cheerio = require('cheerio');

const YANMAGA_BASE_URL = 'https://yanmaga.jp';
const SERIES_URL = 'https://yanmaga.jp/comics/series';
const TOP_URL = 'https://yanmaga.jp/';

/**
 * ヤンマガWebから無料連載・キャンペーン作品を取得する
 * @returns {Promise<Array>}
 */
async function parseYanmaga() {
  const books = [];
  const seenUrls = new Set();

  // 1. 今だけお得（キャンペーン）の収集
  try {
    console.log('[ヤンマガWeb（キャンペーン）] トップページを取得中:', TOP_URL);
    const response = await axios.get(TOP_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9'
      },
      timeout: 15000
    });
    const $ = cheerio.load(response.data);
    const campaignSection = $('#feature-index-3');
    
    if (campaignSection.length > 0) {
      const items = campaignSection.find('ul.mod-feature-banner-list li');
      console.log(`[ヤンマガWeb（キャンペーン）] ${items.length} 件の候補を発見しました。`);
      
      items.each((_, el) => {
        const aTag = $(el).find('a.mod-feature-banner-link');
        if (aTag.length === 0) return;

        const rawHref = aTag.attr('href') || '';
        if (!rawHref) return;

        // URLのベース部分を取り出す
        let cleanUrl = rawHref.split('?')[0];
        if (!cleanUrl.startsWith('http')) {
          cleanUrl = YANMAGA_BASE_URL + cleanUrl;
        }

        const imgTag = aTag.find('div.mod-feature-banner-image img');
        const imageUrl = imgTag.attr('data-src') || imgTag.attr('src') || '';
        
        // aタグのhrefの末尾の作品ID/スラッグをデコードしてタイトルを取得する予備ロジック
        const pathParts = cleanUrl.split('/');
        const encodedSlug = pathParts[pathParts.length - 1] || '';
        let slugTitle = '';
        try {
          slugTitle = decodeURIComponent(encodedSlug);
        } catch (e) {
          slugTitle = encodedSlug;
        }

        const h3Text = aTag.find('h3').text().trim();
        const campaignText = aTag.attr('data-name') || h3Text || '期間限定無料';
        
        // h3 の中身がキャンペーン文字列（「〇話無料！」「全話無料！」）の場合は、slugTitleを作品タイトルにする
        let title = h3Text;
        if (h3Text.includes('無料') || h3Text.includes('CP')) {
          title = slugTitle || h3Text;
        }

        if (!title) return;

        const bookId = `yanmaga-${encodedSlug || title}`;
        
        books.push({
          id: bookId,
          title: title,
          author: 'ヤンマガWeb編集部', // トップページからは著者が取得できないため
          publisher: '講談社',
          imageUrl: imageUrl,
          genre: '少年・青年漫画',
          description: `ヤンマガWebキャンペーン作品: ${campaignText}`,
          endDate: null,
          url: cleanUrl,
          store: 'yanmaga_campaign',
          originalPrice: 0,
          salePrice: 0,
          discountRate: 100,
          volsFreeText: campaignText
        });
        seenUrls.add(cleanUrl);
      });
    } else {
      console.log('[ヤンマガWeb（キャンペーン）] #feature-index-3 セクションが見つかりませんでした。');
    }
  } catch (err) {
    console.error('[ヤンマガWeb（キャンペーン）] 取得失敗:', err.message);
  }

  // 2. 無料連載の収集
  try {
    console.log('[ヤンマガWeb（連載）] 連載作品一覧を取得中:', SERIES_URL);
    const response = await axios.get(SERIES_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9'
      },
      timeout: 15000
    });
    const $ = cheerio.load(response.data);
    const seriesItems = $('a.banner-link');
    console.log(`[ヤンマガWeb（連載）] ${seriesItems.length} 件の連載作品を発見しました。`);

    seriesItems.each((_, el) => {
      const aTag = $(el);
      const rawHref = aTag.attr('href') || '';
      if (!rawHref) return;

      let cleanUrl = rawHref.split('?')[0];
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = YANMAGA_BASE_URL + cleanUrl;
      }

      // すでにキャンペーンで取得済みのURLなら連載用としての重複追加を避ける (キャンペーン優先)
      if (seenUrls.has(cleanUrl)) return;

      const card = aTag.find('div.title-card-wrapper');
      if (card.length === 0) return;

      const title = card.find('div.text-wrapper h2').text().trim();
      const author = card.find('div.text-wrapper p.date').text().trim() || 'ヤンマガWeb連載作家';
      const bgDiv = card.find('div.img-bg-wrapper');
      
      // 画像は style="background-image: url(...)" または data-bg に入っている
      let imageUrl = bgDiv.attr('data-bg') || '';
      if (!imageUrl) {
        const style = bgDiv.attr('style') || '';
        const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (match) {
          imageUrl = match[1];
        }
      }

      const pathParts = cleanUrl.split('/');
      const encodedSlug = pathParts[pathParts.length - 1] || '';

      const bookId = `yanmaga-${encodedSlug || title}`;

      books.push({
        id: bookId,
        title: title,
        author: author,
        publisher: '講談社',
        imageUrl: imageUrl,
        genre: '少年・青年漫画',
        description: 'ヤンマガWebにて無料連載中。毎日・毎週更新されるエピソードを無料で読めます。',
        endDate: null,
        url: cleanUrl,
        store: 'yanmaga',
        originalPrice: 0,
        salePrice: 0,
        discountRate: 100,
        volsFreeText: '無料連載'
      });
      seenUrls.add(cleanUrl);
    });
  } catch (err) {
    console.error('[ヤンマガWeb（連載）] 取得失敗:', err.message);
  }

  return books;
}

module.exports = {
  parseYanmaga
};
