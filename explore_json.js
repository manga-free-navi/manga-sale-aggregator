const fs = require('fs');
const cheerio = require('cheerio');

const paths = {
  magapoke: 'C:\\Users\\MASAYUKI\\.gemini\\antigravity-ide\\brain\\4c334507-1616-41bb-830e-9e616993b8ce\\.system_generated\\steps\\325\\content.md',
  tonajun: 'C:\\Users\\MASAYUKI\\.gemini\\antigravity-ide\\brain\\4c334507-1616-41bb-830e-9e616993b8ce\\.system_generated\\steps\\349\\content.md',
  comicdays: 'C:\\Users\\MASAYUKI\\.gemini\\antigravity-ide\\brain\\4c334507-1616-41bb-830e-9e616993b8ce\\.system_generated\\steps\\361\\content.md'
};

for (const [site, htmlPath] of Object.entries(paths)) {
  console.log(`\n==================== ${site.toUpperCase()} ====================`);
  if (!fs.existsSync(htmlPath)) {
    console.log('HTML file not found:', htmlPath);
    continue;
  }
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const $ = cheerio.load(html);

  // 1. __NEXT_DATA__
  const nextData = $('#__NEXT_DATA__').html();
  if (nextData) {
    console.log('Found #__NEXT_DATA__!');
    try {
      const parsed = JSON.parse(nextData);
      console.log('JSON Keys:', Object.keys(parsed));
      if (parsed.props) console.log('props Keys:', Object.keys(parsed.props));
      // 適当に中身の文字数を絞って表示
      console.log('Sample JSON data (first 300 chars):', JSON.stringify(parsed).substring(0, 300));
    } catch(e) {
      console.log('Failed to parse #__NEXT_DATA__ JSON:', e.message);
    }
  } else {
    console.log('No #__NEXT_DATA__ found');
  }

  // 2. window.__NUXT__
  let nuxtData = '';
  $('script').each((_, el) => {
    const text = $(el).html() || '';
    if (text.includes('__NUXT__') || text.includes('window.__NUXT__')) {
      nuxtData = text;
    }
  });

  if (nuxtData) {
    console.log('Found __NUXT__ script data!');
    console.log('Sample __NUXT__ data (first 300 chars):', nuxtData.substring(0, 300));
  } else {
    console.log('No __NUXT__ found');
  }
}
