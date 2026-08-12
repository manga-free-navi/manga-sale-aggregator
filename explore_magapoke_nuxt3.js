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

/**
 * 簡易的な全オブジェクト解決器
 * 配列内のすべてのオブジェクトに対し、値が数値の場合は配列のその位置の値を再帰的に取得する
 */
function resolveAllObjects(data) {
  const cache = new Map();

  function resolve(val) {
    if (val === null || val === undefined) return val;
    if (typeof val !== 'object') return val;
    if (cache.has(val)) return cache.get(val);

    if (Array.isArray(val)) {
      const res = [];
      cache.set(val, res);
      // devalue の型識別子は無視
      const start = (val[0] === 'Set' || val[0] === 'Map' || val[0] === 'ShallowReactive') ? 1 : 0;
      for (let i = start; i < val.length; i++) {
        const item = val[i];
        if (typeof item === 'number' && item >= 0 && item < data.length) {
          res.push(resolve(data[item]));
        } else {
          res.push(resolve(item));
        }
      }
      return res;
    }

    // オブジェクト
    const res = {};
    cache.set(val, res);
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === 'number' && v >= 0 && v < data.length) {
        res[k] = resolve(data[v]);
      } else {
        res[k] = resolve(v);
      }
    }
    return res;
  }

  // すべてのオブジェクトエントリーをデシリアライズして結果を収集
  const results = [];
  data.forEach((item, idx) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const resolved = resolve(item);
      results.push({ idx, obj: resolved });
    }
  });
  return results;
}

const allResolved = resolveAllObjects(parsed);
console.log(`Total resolved objects: ${allResolved.length}`);

// 作品タイトルとキャンペーンテキスト（例: 「3巻分無料！」「7/2まで」など）を両方持つオブジェクトをスキャン
const campaignWorks = [];
allResolved.forEach(item => {
  const obj = item.obj;
  if (!obj) return;
  
  // マガポケのデータ構造を推測するための緩いフィルタ
  // titleがあり、キャンペーン関連または無料関連の文字列が含まれるプロパティを持つオブジェクトを探す
  if (obj.title && typeof obj.title === 'string' && obj.title.length > 0) {
    // オブジェクトの全プロパティの値に「無料」や「巻」や「話」が含まれるかチェック
    let campaignText = '';
    let author = obj.author || obj.author_name || '';
    let seriesId = obj.series_id || obj.id || '';
    
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        if (v.includes('無料') && (v.includes('巻') || v.includes('話') || v.includes('まで'))) {
          campaignText = v;
        }
        if (!author && (k.includes('author') || k.includes('creator') || k.includes('writer'))) {
          author = v;
        }
      }
    }
    
    if (campaignText) {
      campaignWorks.push({
        idx: item.idx,
        title: obj.title,
        author: author,
        campaignText: campaignText,
        seriesId: seriesId,
        raw: obj
      });
    }
  }
});

console.log(`Found ${campaignWorks.length} campaign works in unresolved list:`);

// 重複を排除して表示（同一作品が複数回ヒットすることがあるため）
const seen = new Set();
const uniqueWorks = [];
campaignWorks.forEach(w => {
  const key = `${w.title}_${w.campaignText}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueWorks.push(w);
  }
});

console.log(`Unique campaign works count: ${uniqueWorks.length}`);
uniqueWorks.forEach((w, idx) => {
  console.log(`\n[Unique Work ${idx}] (Index in array: ${w.idx})`);
  console.log(`  Title: "${w.title}"`);
  console.log(`  Author: "${w.author}"`);
  console.log(`  Campaign: "${w.campaignText}"`);
  console.log(`  Series ID / Link: "${w.seriesId}"`);
  // 画像URLらしきものも表示してみる
  const img = w.raw.thumbnail_url || w.raw.image_url || w.raw.square_image_url || '';
  if (img) console.log(`  Image: "${img}"`);
});
