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
const data = parsed.props?.pageProps?.data || {};

console.log('--- 1. pageProps.data のルートキー一覧 ---');
console.log(Object.keys(data));

// キーの一覧に基づいて各キーの中身や長さを確認
for (const [key, val] of Object.entries(data)) {
  if (Array.isArray(val)) {
    console.log(`Key: [${key}] is Array | Length: ${val.length}`);
    if (val.length > 0) {
      console.log(`  Sample item sample keys:`, Object.keys(val[0]));
      // バナーやキャンペーンと思われるもののリンク先などを表示
      if (key === 'banners') {
        val.slice(0, 5).forEach((b, i) => console.log(`    Banner ${i}: Link=${b.linkUrl} | Img=${b.imageUrl}`));
      }
    }
  } else if (typeof val === 'object' && val !== null) {
    console.log(`Key: [${key}] is Object | Keys:`, Object.keys(val));
  } else {
    console.log(`Key: [${key}] is ${typeof val} | Value: ${val}`);
  }
}

// 無料キャンペーンの作品がありそうな箇所を深掘り
console.log('\n--- 2. キャンペーン情報やフリーエピソードに関連しそうなデータをスキャン ---');
// JSON全体の文字列表現から「無料」や「キャンペーン」が含まれる箇所を探します。
const jsonStr = JSON.stringify(data);
console.log('Total JSON data size:', jsonStr.length, 'chars');

// 特集やオリジナル連載の中身をチェック
if (data.original) {
  console.log('\n--- 3. original の中身をチェック ---');
  if (data.original.days) {
    console.log('original.days keys:', Object.keys(data.original.days));
    // 曜日ごとに連載作品が並んでいるはず
    const firstDayKey = Object.keys(data.original.days)[0];
    const firstDayWorks = data.original.days[firstDayKey];
    console.log(`  Sample Day (${firstDayKey}) Works: ${firstDayWorks?.length || 0}`);
    if (firstDayWorks && firstDayWorks.length > 0) {
      console.log(`    Sample Work keys:`, Object.keys(firstDayWorks[0]));
      console.log(`    Sample Work Title:`, firstDayWorks[0].title);
    }
  }
}
