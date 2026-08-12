const fs = require('fs');

const htmlPath = 'C:\\Users\\MASAYUKI\\.gemini\\antigravity-ide\\brain\\4c334507-1616-41bb-830e-9e616993b8ce\\.system_generated\\steps\\325\\content.md';
const html = fs.readFileSync(htmlPath, 'utf-8');

const cheerio = require('cheerio');
const $ = cheerio.load(html);
const nuxtDataText = $('#__NUXT_DATA__').html();

if (!nuxtDataText) {
  console.log('No #__NUXT_DATA__ found');
  process.exit(1);
}

const parsed = JSON.parse(nuxtDataText);

// 検索したいインデックスの候補
const targetIndices = [6831, 1300, 1712, 10511];

console.log('--- インデックス値をプロパティ値に持つオブジェクトを検索 ---');
parsed.forEach((item, idx) => {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    // オブジェクトの各キーの値をチェック
    for (const [k, v] of Object.entries(item)) {
      if (targetIndices.includes(v)) {
        console.log(`\nFound object referring to target index at parsed[${idx}]:`);
        console.log(`  Key: "${k}" -> Index: ${v} ("${parsed[v]}")`);
        console.log(`  Full raw object:`, item);
        
        // オブジェクト内の他のインデックスの値も解決して表示
        console.log('  Resolved fields:');
        for (const [key, val] of Object.entries(item)) {
          if (typeof val === 'number' && val >= 0 && val < parsed.length) {
            console.log(`    ${key}: "${parsed[val]}" (Index: ${val})`);
          } else {
            console.log(`    ${key}: ${val} (Raw)`);
          }
        }
      }
    }
  }
});
