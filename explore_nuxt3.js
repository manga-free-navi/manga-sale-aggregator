const fs = require('fs');
const cheerio = require('cheerio');

const paths = {
  magapoke_top: 'C:\\Users\\MASAYUKI\\.gemini\\antigravity-ide\\brain\\4c334507-1616-41bb-830e-9e616993b8ce\\.system_generated\\steps\\325\\content.md',
  magapoke_series: 'C:\\Users\\MASAYUKI\\.gemini\\antigravity-ide\\brain\\4c334507-1616-41bb-830e-9e616993b8ce\\.system_generated\\steps\\216\\content.md'
};

for (const [name, htmlPath] of Object.entries(paths)) {
  console.log(`\n==================== ${name.toUpperCase()} ====================`);
  if (!fs.existsSync(htmlPath)) {
    console.log('HTML file not found:', htmlPath);
    continue;
  }
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const $ = cheerio.load(html);

  const nuxtData = $('#__NUXT_DATA__').html();
  if (nuxtData) {
    console.log('Found #__NUXT_DATA__!');
    try {
      const parsed = JSON.parse(nuxtData);
      console.log('Array items count:', parsed.length);
      console.log('Sample data (first 50 items):', parsed.slice(0, 50));
      
      // 無料、キャンペーン、チケット などのキーワードが含まれているインデックスや文字列を検索
      const matches = [];
      parsed.forEach((item, idx) => {
        if (typeof item === 'string') {
          if (item.includes('無料') || item.includes('キャンペーン') || item.includes('特別') || item.includes('公開')) {
            matches.push({ idx, value: item });
          }
        }
      });
      console.log(`Found ${matches.length} keyword matches in NUXT_DATA:`);
      matches.slice(0, 15).forEach(m => console.log(`  Index ${m.idx}: "${m.value}"`));

    } catch (e) {
      console.log('Failed to parse #__NUXT_DATA__ JSON:', e.message);
    }
  } else {
    console.log('No #__NUXT_DATA__ found');
  }
}
