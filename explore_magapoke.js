const fs = require('fs');
const cheerio = require('cheerio');

const htmlPath = 'C:\\Users\\MASAYUKI\\.gemini\\antigravity-ide\\brain\\4c334507-1616-41bb-830e-9e616993b8ce\\.system_generated\\steps\\325\\content.md';
const html = fs.readFileSync(htmlPath, 'utf-8');
const $ = cheerio.load(html);

console.log('--- 1. すべての section 要素のクラスとIDを取得 ---');
$('section').each((_, el) => {
  const $el = $(el);
  console.log(`Tag: section | ID: ${$el.attr('id') || 'none'} | Class: ${$el.attr('class') || 'none'}`);
});

console.log('\n--- 2. p-index- で始まるすべてのクラス名を取得 ---');
const pIndexClasses = new Set();
$('*').each((_, el) => {
  const className = $(el).attr('class');
  if (className) {
    className.split(/\s+/).forEach(c => {
      if (c.startsWith('p-index-')) {
        pIndexClasses.add(c);
      }
    });
  }
});
console.log('p-index- classes:', Array.from(pIndexClasses));

console.log('\n--- 3. 全体の大まかなHTML構造 (主な子要素) ---');
$('.l-main__inner').children().each((i, el) => {
  const $el = $(el);
  console.log(`Child ${i}: Tag=${el.name} | ID=${$el.attr('id') || 'none'} | Class=${$el.attr('class') || 'none'}`);
});
