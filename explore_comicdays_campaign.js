const fs = require('fs');

const htmlPath = 'C:\\Users\\MASAYUKI\\.gemini\\antigravity-ide\\brain\\4c334507-1616-41bb-830e-9e616993b8ce\\.system_generated\\steps\\361\\content.md';
const html = fs.readFileSync(htmlPath, 'utf-8');

const cheerio = require('cheerio');
const $ = cheerio.load(html);
const nextData = $('#__NEXT_DATA__').html();

if (!nextData) {
  console.log('No #__NEXT_DATA__ found');
  process.exit(1);
}

const parsed = JSON.parse(nextData);
const campaigns = parsed.props?.pageProps?.data?.freeSeriesCampaignList || [];

campaigns.forEach((c, idx) => {
  if (c.seriesSlice && c.seriesSlice.seriesList) {
    const list = c.seriesSlice.seriesList;
    console.log(`\n[Campaign ${idx}] seriesList[0] keys:`, Object.keys(list[0]));
    console.log(`[Campaign ${idx}] seriesList[0] detailed JSON:`);
    console.log(JSON.stringify(list[0], null, 2));
  }
});
