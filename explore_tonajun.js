const fs = require('fs');
const cheerio = require('cheerio');

const htmlPath = 'C:\\Users\\MASAYUKI\\.gemini\\antigravity-ide\\brain\\4c334507-1616-41bb-830e-9e616993b8ce\\.system_generated\\steps\\349\\content.md';
const html = fs.readFileSync(htmlPath, 'utf-8');
const $ = cheerio.load(html);

console.log('--- 1. すべての section 要素のクラスとIDを取得 ---');
$('section').each((_, el) => {
  const $el = $(el);
  console.log(`Tag: section | ID: ${$el.attr('id') || 'none'} | Class: ${$el.attr('class') || 'none'}`);
});

console.log('\n--- 2. section.free-campaign が存在するか、その中の要素を取得 ---');
const campaignEl = $('section.free-campaign');
console.log('Exists section.free-campaign:', campaignEl.length > 0);

if (campaignEl.length > 0) {
  console.log('Campaign elements:');
  campaignEl.find('a').slice(0, 5).each((i, el) => {
    const $el = $(el);
    console.log(`[${i}] href: ${$el.attr('href')} | title: ${$el.find('.free-campaign-item-title, h3, h4').text().trim() || $el.text().substring(0, 50).trim()}`);
  });
} else {
  console.log('\n--- 3. 「キャンペーン」や「無料」の文字列を含むセクションを探す ---');
  $('section').each((_, el) => {
    const $el = $(el);
    const text = $el.text();
    if (text.includes('無料') || text.includes('キャンペーン')) {
      console.log(`Found candidate section. Class: ${$el.attr('class') || 'none'} | Header: ${$el.find('h1, h2, h3').text().substring(0, 100).trim()}`);
    }
  });
}
