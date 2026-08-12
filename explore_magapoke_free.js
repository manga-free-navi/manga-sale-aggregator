const fs = require('fs');
const cheerio = require('cheerio');

const htmlPath = 'C:\\Users\\MASAYUKI\\.gemini\\antigravity-ide\\brain\\4c334507-1616-41bb-830e-9e616993b8ce\\.system_generated\\steps\\369\\content.md';
const html = fs.readFileSync(htmlPath, 'utf-8');
const $ = cheerio.load(html);

console.log('--- 1. 大枠のli要素やクラス名を検索 ---');
// サンデーうぇぶりの 'li.webry-series-item' みたいなものがあるか、あるいは 'li.c-series-items__item' のようなものか
const listItems = $('li');
console.log(`Total <li> tags found: ${listItems.length}`);

// クラス名の候補を調べる
const classes = new Set();
$('li').each((_, el) => {
  const className = $(el).attr('class');
  if (className) {
    className.split(/\s+/).forEach(c => classes.add(c));
  }
});
console.log('Found <li> classes:', Array.from(classes));

console.log('\n--- 2. 作品と思われる要素の内容を表示 ---');
// 'li.c-series-items__item' やそれに類するものを抽出してみる
const candidates = $('li[class*="item"], li[class*="series"]');
console.log(`Found candidate series items: ${candidates.length}`);

candidates.slice(0, 10).each((i, el) => {
  const $el = $(el);
  const title = $el.find('h3, h4, .title, .c-series-item__ttl').text().trim();
  const author = $el.find('.author, .c-series-item__name').text().trim();
  const href = $el.find('a').attr('href') || '';
  console.log(`[${i}] Title: ${title} | Author: ${author} | Link: ${href}`);
});
