const axios = require('axios');
const cheerio = require('cheerio');

// サンデーうぇぶり 無料エピソードありシリーズ一覧のテスト
axios.get('https://www.sunday-webry.com/series?free_episode=true', {
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36'
  }
}).then(res => {
  const $ = cheerio.load(res.data);
  const items = [];
  $('li.webry-series-item').each((_, el) => {
    const title = $(el).find('h4.series-title').text().trim();
    const author = $(el).find('p.author').text().trim();
    const href = $(el).find('a.webry-series-item-link').attr('href') || '';
    const img = $(el).find('img.js-lazyload').attr('data-src') || '';
    if (title) items.push({ title, author, href });
  });
  console.log('取得件数:', items.length);
  items.slice(0, 15).forEach(i => console.log(' -', i.title, '/', i.author));
}).catch(e => console.error(e.message));
