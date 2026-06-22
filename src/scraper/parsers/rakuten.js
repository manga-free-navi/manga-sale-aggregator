const axios = require('axios');

/**
 * 楽天Kobo電子書籍検索APIを利用して無料漫画情報を取得するパーサー
 * @param {string} appId - 楽天デベロッパーID (Application ID)
 * @param {string} accessKey - 楽天アクセスキー (Access Key)
 * @param {s/**
 * タイトルから割引率（％）を抽出するヘルパー関数
 * @param {string} title - 書籍のタイトル
 * @returns {number|null} 抽出された割引率。見つからない場合はnull
 */
function extractDiscountRateFromTitle(title) {
  let t = title.replace(/％/g, '%');
  
  // 30% OFF, 50%OFF などのパターン
  let match = t.match(/(\d+)\s*%\s*OFF/i);
  if (match) return parseInt(match[1], 10);
  
  // 30%割引, 30%引き などのパターン
  match = t.match(/(\d+)\s*%\s*割引/);
  if (match) return parseInt(match[1], 10);
  match = t.match(/(\d+)\s*%\s*引き/);
  if (match) return parseInt(match[1], 10);
  
  // 「半額」パターン
  if (t.includes('半額')) return 50;
  
  // 「3割引」などのパターン
  match = t.match(/(\d+)\s*割引き?/);
  if (match) return parseInt(match[1], 10) * 10;
  
  return null;
}

async function parseRakuten(appId, accessKey, affiliateId) {
  const books = [];

  // アプリIDまたはアクセスキーが設定されていない、またはダミー値の場合はモックデータを返す
  if (
    !appId || appId === 'dummy_app_id' || appId.startsWith('dummy') ||
    !accessKey || accessKey === 'dummy_access_key' || accessKey.startsWith('dummy')
  ) {
    console.log('[楽天Kobo] 有効な RAKUTEN_APP_ID または RAKUTEN_ACCESS_KEY が設定されていません。開発用のモックデータを生成します。');
    return generateMockRakutenData();
  }

  // 新しい楽天APIエンドポイント（openapi.rakuten.co.jp）
  const url = 'https://openapi.rakuten.co.jp/services/api/Kobo/EbookSearch/20170426';

  try {
    console.log(`[楽天Kobo] APIリクエスト開始 (無料本＆セール本の個別収集)`);

    // 収集パラメータの定義
    // 無料本: 価格の安い順ソート (0円本を優先収集)
    // セール本: 標準ソート (セールやOFFのキーワードでおすすめ度の高い本を収集)
    const queries = [
      {
        keyword: '無料',
        sort: '+itemPrice', // 0円本を最優先で収集
        maxPages: { '101901': 5, '101902': 3 }
      },
      {
        keyword: '無料',
        sort: 'sales', // 売上順で現在人気のセール・無料キャンペーン本を収集
        maxPages: { '101901': 4, '101902': 2 }
      },
      {
        keyword: '無料',
        sort: 'standard', // 標準おすすめ順でセール本を収集
        maxPages: { '101901': 3, '101902': 2 }
      },
      {
        keyword: 'セール',
        sort: 'sales', // 有料セール本を売上順で収集
        maxPages: { '101901': 3, '101902': 2 }
      },
      {
        keyword: '割引',
        sort: 'sales', // 割引本を売上順で収集
        maxPages: { '101901': 2, '101902': 1 }
      },
      {
        keyword: 'OFF',
        sort: 'sales', // OFF表記の本を売上順で収集
        maxPages: { '101901': 2, '101902': 1 }
      }
    ];

    const genres = [
      { id: '101901', name: '少年・青年漫画' },
      { id: '101902', name: '少女・レディース漫画' }
    ];

    for (const query of queries) {
      console.log(`[楽天Kobo] キーワード: "${query.keyword}" (ソート: ${query.sort}) の収集を開始します...`);

      for (const genre of genres) {
        const maxPage = query.maxPages[genre.id];
        console.log(`[楽天Kobo] ジャンル: ${genre.name} (${genre.id}) - 最大 ${maxPage} ページ`);

        for (let page = 1; page <= maxPage; page++) {
          const params = {
            applicationId: appId,
            accessKey: accessKey,
            format: 'json',
            keyword: query.keyword,
            koboGenreId: genre.id,
            hits: 30,
            page: page,
            sort: query.sort,
          };

          if (affiliateId && affiliateId !== 'dummy_affiliate_id') {
            params.affiliateId = affiliateId;
          }

          let response = null;
          let retries = 3;
          while (retries > 0) {
            try {
              response = await axios.get(url, {
                params,
                headers: {
                  'Referer': 'https://github.io/',
                  'Origin': 'https://github.io',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 10000
              });
              break; // リクエスト成功
            } catch (err) {
              if (err.response && err.response.status === 429) {
                console.warn(`[楽天Kobo] キーワード: ${query.keyword}, ${genre.name} Page ${page}: 429エラーが発生。10秒待機してリトライします... (残りリトライ: ${retries - 1})`);
                await new Promise(resolve => setTimeout(resolve, 10000));
                retries--;
              } else {
                console.error(`[楽天Kobo] キーワード: ${query.keyword}, ${genre.name} Page ${page} の取得に失敗:`, err.message);
                break;
              }
            }
          }

          if (response && response.data && response.data.Items) {
            const items = response.data.Items;
            if (items.length === 0) {
              console.log(`[楽天Kobo] キーワード: ${query.keyword}, ジャンル ${genre.name} - ページ ${page}: これ以上のデータはありません。`);
              await new Promise(resolve => setTimeout(resolve, 3000));
              break;
            }
            console.log(`[楽天Kobo] キーワード: ${query.keyword}, ジャンル ${genre.name} - ページ ${page}: APIより ${items.length} 件を取得しました。`);

            items.forEach((itemWrapper) => {
              const item = itemWrapper.Item;
              if (!item) return;

              const salePrice = item.itemPrice;
              const discountRateFromTitle = extractDiscountRateFromTitle(item.title);
              
              const isFree = (salePrice === 0);
              const isHighDiscount = (salePrice > 0 && discountRateFromTitle !== null && discountRateFromTitle >= 30);

              // 無料でもなく、3割以上の割引でもない本はすべて除外する
              if (!isFree && !isHighDiscount) {
                if (salePrice > 0) {
                  console.log(`[デバッグ・有料除外] 価格: ${salePrice}円, 割引パース: ${discountRateFromTitle}% (Title: ${item.title})`);
                }
                return;
              }

              let endDate = null;
              if (item.salesEndDate) {
                const datePart = item.salesEndDate.split(' ')[0];
                endDate = datePart.replace(/\//g, '-');
              }

              const finalUrl = item.affiliateUrl || item.itemUrl;
              
              // 価格と割引率の算出
              let originalPrice = 500;
              let discountRate = 100;
              
              if (isFree) {
                discountRate = 100;
                originalPrice = 500; // 想定の元価格を一律500円とする
              } else {
                discountRate = discountRateFromTitle;
                // セール価格と割引率から元価格を逆算
                originalPrice = Math.round(salePrice / (1 - discountRate / 100));
              }

              // 重複追加の防止
              const id = `rakuten-${item.itemNumber || item.title.substring(0, 10)}`;
              if (books.some(b => b.id === id)) return;

              books.push({
                id: id,
                title: item.title,
                author: item.author || '不明',
                publisher: item.publisherName || '楽天Kobo',
                imageUrl: item.largeImageUrl || item.mediumImageUrl || '',
                store: 'rakuten',
                originalPrice: originalPrice,
                salePrice: salePrice,
                discountRate: discountRate,
                url: finalUrl,
                genre: genre.id === '101902' ? '少女漫画' : '少年・青年漫画',
                endDate: endDate,
                description: item.itemCaption || `${item.title}の期間限定割引・無料お試し版です。`,
                updatedAt: new Date().toISOString(),
                seriesName: item.seriesName || '' // シリーズ名を保持
              });
            });
          } else {
            console.log(`[楽天Kobo] キーワード: ${query.keyword}, ジャンル ${genre.name} - ページ ${page}: レスポンスが不正です。`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            break;
          }

          // レートリミット回避のため、リクエストごとに必ず3.0秒のウェイトを設ける
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    // シリーズ追加収集フェーズの開始
    const seriesNames = new Set();
    books.forEach(b => {
      let sName = b.seriesName;
      if (!sName) {
        // タイトルから巻数表記や括弧を除外した仮のシリーズ名を作成
        let t = b.title;
        t = t.replace(/[０-９]/g, function(s) {
          return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        });
        t = t.replace(/【[^】]*】/g, ' ');
        t = t.replace(/\[[^\]]*\]/g, ' ');
        t = t.replace(/(?:act|vol|volume|no|#)\.?\s*\d+/i, ' ');
        t = t.replace(/第?\s*\d+\s*[巻話作]/g, ' ');
        t = t.replace(/[\(（]\d+[\)）]/g, ' ');
        t = t.replace(/\s+\d+\s*$/g, ' ');
        t = t.replace(/\d+\s*$/g, ' ');
        t = t.replace(/\([^\)]*\)/g, ' ');
        t = t.replace(/（[^）]*）/g, ' ');
        t = t.replace(/期間限定/g, ' ');
        t = t.replace(/無料/g, ' ');
        t = t.replace(/セール/g, ' ');
        t = t.replace(/お試し/g, ' ');
        t = t.replace(/試し読み/g, ' ');
        sName = t.trim();
      }
      
      // 有効なシリーズ名のみ収集（短すぎる・長すぎるものはノイズ回避のため除外）
      if (sName && sName.length >= 2 && sName.length < 25) {
        seriesNames.add(sName);
      }
    });

    const uniqueSeries = Array.from(seriesNames);
    console.log(`[楽天Kobo] 検出されたユニークなシリーズ数: ${uniqueSeries.length}件。追加のシリーズ検索を開始します...`);

    // API負荷防止のため、最大40シリーズに制限
    const targetSeries = uniqueSeries.slice(0, 40);

    for (const sName of targetSeries) {
      console.log(`[楽天Kobo] シリーズ追加検索: "${sName}"...`);
      const params = {
        applicationId: appId,
        accessKey: accessKey,
        format: 'json',
        keyword: sName,
        hits: 20, // シリーズ全巻が網羅できるように20件に設定
        page: 1,
        sort: 'standard', // おすすめ度標準ソート
      };

      if (affiliateId && affiliateId !== 'dummy_affiliate_id') {
        params.affiliateId = affiliateId;
      }

      let response = null;
      try {
        response = await axios.get(url, {
          params,
          headers: {
            'Referer': 'https://github.io/',
            'Origin': 'https://github.io',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 10000
        });
      } catch (err) {
        console.error(`[楽天Kobo] シリーズ "${sName}" の検索に失敗:`, err.message);
      }

      if (response && response.data && response.data.Items) {
        const items = response.data.Items;
        console.log(`[楽天Kobo] シリーズ "${sName}": ${items.length}件の関連本を取得`);

        items.forEach((itemWrapper) => {
          const item = itemWrapper.Item;
          if (!item) return;

          // シリーズ検索で取得した本は、コミックであるもの（101901, 101902）のみを対象とする
          const isComic = item.koboGenreId === '101901' || item.koboGenreId === '101902';
          if (!isComic) return;

          const salePrice = item.itemPrice;
          const discountRateFromTitle = extractDiscountRateFromTitle(item.title);
          const isFree = (salePrice === 0);
          
          let endDate = null;
          if (item.salesEndDate) {
            const datePart = item.salesEndDate.split(' ')[0];
            endDate = datePart.replace(/\//g, '-');
          }

          const finalUrl = item.affiliateUrl || item.itemUrl;
          
          let originalPrice = 500;
          let discountRate = 0;
          
          if (isFree) {
            discountRate = 100;
            originalPrice = 500;
          } else {
            discountRate = discountRateFromTitle || 0;
            if (discountRate > 0) {
              originalPrice = Math.round(salePrice / (1 - discountRate / 100));
            } else {
              originalPrice = salePrice; // 推定定価マージ処理で上書きされるため仮設定
            }
          }

          const id = `rakuten-${item.itemNumber || item.title.substring(0, 10)}`;
          
          const existingIndex = books.findIndex(b => b.id === id);
          if (existingIndex !== -1) {
            if (!books[existingIndex].seriesName && item.seriesName) {
              books[existingIndex].seriesName = item.seriesName;
            }
            return;
          }

          books.push({
            id: id,
            title: item.title,
            author: item.author || '不明',
            publisher: item.publisherName || '楽天Kobo',
            imageUrl: item.largeImageUrl || item.mediumImageUrl || '',
            store: 'rakuten',
            originalPrice: originalPrice,
            salePrice: salePrice,
            discountRate: discountRate,
            url: finalUrl,
            genre: item.koboGenreId === '101902' ? '少女漫画' : '少年・青年漫画',
            endDate: endDate,
            description: item.itemCaption || `${item.title}の期間限定割引・無料お試し版です。`,
            updatedAt: new Date().toISOString(),
            seriesName: item.seriesName || sName
          });
        });
      }

      // レートリミット回避のためのウェイト
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    return books;
  } catch (error) {
    console.error('[楽天Kobo] 処理中に致命的なエラーが発生しました:', error.message);
    console.log('[楽天Kobo] エラーのため、開発用モックデータにフォールバックします。');
    return generateMockRakutenData();
  }
}

/**
 * 開発テスト用のモックデータを生成する関数
 */
function generateMockRakutenData() {
  return [
    {
      id: "rakuten-1230001355598",
      title: "アーマードール・アライブ１【無料版】",
      author: "幾谷正",
      publisher: "FunnyCreative",
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/rakutenkobo-ebooks/cabinet/1496/2000004671496.jpg?_ex=200x200",
      store: "rakuten",
      originalPrice: 500,
      salePrice: 0,
      discountRate: 100,
      url: "https://hb.afl.rakuten.co.jp/hgc/g00reb4n.lbfgh789.g00reb4n.lbfgi8c6/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2Frk%2F2ec7c569e83d39fab93913d062c50a86%2F",
      genre: "少年・青年漫画",
      endDate: null,
      description: "「滅びゆく世界、戦闘機械の宿命。それでも私は恋をしたーー」人工知能を操り人間を殺戮する謎の電子汚染現象【ゲーティア】によって、滅亡 of 道に立たされた世界。残された人類は自我を持つ人型兵器【アーマードール】を開発し、心無き機械たちとの戦いに明け暮れていた。近未来ＳＦロボットラブコメディ。こちらは【無料版】になっています。",
      updatedAt: new Date().toISOString(),
      seriesName: "アーマードール・アライブ"
    },
    {
      id: "rakuten-1230003423691",
      title: "アーマードール・アライブ２【無料版】",
      author: "幾谷正",
      publisher: "FunnyCreative",
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/rakutenkobo-ebooks/cabinet/8886/2000007758886.jpg?_ex=200x200",
      store: "rakuten",
      originalPrice: 500,
      salePrice: 0,
      discountRate: 100,
      url: "https://hb.afl.rakuten.co.jp/hgc/g00reb4n.lbfgh789.g00reb4n.lbfgi8c6/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2Frk%2F8a2f7fd47f823b6e8e33ed7b1ef82654%2F",
      genre: "少年・青年漫画",
      endDate: null,
      description: "人工知能を操り人類を殺戮する謎の電子汚染現象【ゲーティア】の出現によって、滅亡の道を歩む世界。残された人類は自我を持つ人型兵器【アーマードール】を開発し、心無き機械たちとの戦いを繰り広げていた。操縦士達の怪死の原因を探るため、テストパイロットに選ばれる文楽だが……!?",
      updatedAt: new Date().toISOString(),
      seriesName: "アーマードール・アライブ"
    },
    {
      id: "rakuten-1230003310977",
      title: "マイティ・スレイヴァーact.1（無料見本版）",
      author: "土堂コォジ",
      publisher: "土堂コォジ",
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/rakutenkobo-ebooks/cabinet/6632/2000007566632.jpg?_ex=200x200",
      store: "rakuten",
      originalPrice: 500,
      salePrice: 0,
      discountRate: 100,
      url: "https://hb.afl.rakuten.co.jp/hgc/g00reb4n.lbfgh789.g00reb4n.lbfgi8c6/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2Frk%2Ffb10c390435e3b6099dbe4ef8e0e5dda%2F",
      genre: "少年・青年漫画",
      endDate: null,
      description: "フルCGで挿絵が動く！電子書籍「ならでは」の新感覚ノベル、ここに登場──遠い未来の遠い星にて、巨大ロボットが大暴れ!?完全オリジナルの３DCGアニメが織りなす、SF・コメディ・アクション短編！動画小説シリーズ第一弾、まずは無料見本版をご覧ください！",
      updatedAt: new Date().toISOString(),
      seriesName: "マイティ・スレイヴァー"
    },
    {
      id: "rakuten-1230003324622",
      title: "マイティ・スレイヴァーact.2（無料見本版）",
      author: "土堂コォジ",
      publisher: "土堂コォジ",
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/rakutenkobo-ebooks/cabinet/0723/2000007570723.jpg?_ex=200x200",
      store: "rakuten",
      originalPrice: 500,
      salePrice: 0,
      discountRate: 100,
      url: "https://hb.afl.rakuten.co.jp/hgc/g00reb4n.lbfgh789.g00reb4n.lbfgi8c6/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2Frk%2F27b57ce6cf053f08b18f83ef6afc3a31%2F",
      genre: "少年・青年漫画",
      endDate: null,
      description: "巨大ロボット・スレイヴァーによる格闘技『スレイバトル』。王者キャロルとタッグを組んで、新人ステラの遠征試合。敵は空飛ぶ『可変スレイヴァー』！3対3の大混戦、果たして勝利は誰の手に…!?フルCG動画小説・第2弾、熱いゴングを鳴らします！",
      updatedAt: new Date().toISOString(),
      seriesName: "マイティ・スレイヴァー"
    },
    {
      id: "rakuten-1230003327043",
      title: "マイティ・スレイヴァーact.3（無料見本版）",
      author: "土堂コォジ",
      publisher: "土堂コォジ",
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/rakutenkobo-ebooks/cabinet/3259/2000007573259.jpg?_ex=200x200",
      store: "rakuten",
      originalPrice: 500,
      salePrice: 0,
      discountRate: 100,
      url: "https://hb.afl.rakuten.co.jp/hgc/g00reb4n.lbfgh789.g00reb4n.lbfgi8c6/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2Frk%2F78cb08d45fde3363a422a2b72ad14530%2F",
      genre: "少年・青年漫画",
      endDate: null,
      description: "人里はなれた山奥で、相次ぐ謎の失踪事件。兄の行方を探す少女と、保安官その他一名。闇夜に潜む深紅の巨体に、彼らは打ち勝てるのか!?動画小説・第3弾、ここに飛び立つ！",
      updatedAt: new Date().toISOString(),
      seriesName: "マイティ・スレイヴァー"
    },
    {
      id: "rakuten-1230003328811",
      title: "マイティ・スレイヴァーact.4（無料見本版）",
      author: "土堂コォジ",
      publisher: "土堂コォジ",
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/rakutenkobo-ebooks/cabinet/7320/2000007577320.jpg?_ex=200x200",
      store: "rakuten",
      originalPrice: 500,
      salePrice: 0,
      discountRate: 100,
      url: "https://hb.afl.rakuten.co.jp/hgc/g00reb4n.lbfgh789.g00reb4n.lbfgi8c6/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2Frk%2F91ec3774064e311fba4386ae358bb70f%2F",
      genre: "少年・青年漫画",
      endDate: null,
      description: "採掘工・スミス一家が湖底で見つけた、移民船の落とし物。お宝目当ての盗賊と、正義を守る保安官。追いつ追われつ繰り広げられる、激しいバトルの行く末は!?動画小説・第4弾、全力疾走いたします！",
      updatedAt: new Date().toISOString(),
      seriesName: "マイティ・スレイヴァー"
    },
    {
      id: "rakuten-1230003333891",
      title: "マイティ・スレイヴァーact.5（無料見本版）",
      author: "土堂コォジ",
      publisher: "土堂コォジ",
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/rakutenkobo-ebooks/cabinet/3220/2000007583220.jpg?_ex=200x200",
      store: "rakuten",
      originalPrice: 500,
      salePrice: 0,
      discountRate: 100,
      url: "https://hb.afl.rakuten.co.jp/hgc/g00reb4n.lbfgh789.g00reb4n.lbfgi8c6/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2Frk%2F866cbb97ea6630a297e2810836a65ce5%2F",
      genre: "少年・青年漫画",
      endDate: null,
      description: "無人の荒野で山籠もりする二人の青年、ユゥトとビクター。奇怪な姿のスレイヴァーと、それに追われる謎めいた少女。問答無用の大鎌が、大地を切り裂き火花を散らす！動画小説・第5弾、いよいよ発進！",
      updatedAt: new Date().toISOString(),
      seriesName: "マイティ・スレイヴァー"
    },
    {
      id: "rakuten-1230003338117",
      title: "マイティ・スレイヴァーact.6（無料見本版）",
      author: "土堂コォジ",
      publisher: "土堂コォジ",
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/rakutenkobo-ebooks/cabinet/3874/2000007603874.jpg?_ex=200x200",
      store: "rakuten",
      originalPrice: 500,
      salePrice: 0,
      discountRate: 100,
      url: "https://hb.afl.rakuten.co.jp/hgc/g00reb4n.lbfgh789.g00reb4n.lbfgi8c6/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2Frk%2F4cf772468585392686e37681efc19c0a%2F",
      genre: "少年・青年漫画",
      endDate: null,
      description: "上級保安官を目指し、研修に励むスレイヴァー使い三人。立ち塞がるは鬼教官の美女二人、および粗暴な闖入者。動画小説・第6弾、ラストスパートです!!",
      updatedAt: new Date().toISOString(),
      seriesName: "マイティ・スレイヴァー"
    },
    {
      id: "rakuten-1230001532395",
      title: "白亜色の涙　１",
      author: "阿都",
      publisher: "阿都",
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/rakutenkobo-ebooks/cabinet/0337/2000004950337.jpg?_ex=200x200",
      store: "rakuten",
      originalPrice: 500,
      salePrice: 100,
      discountRate: 80,
      url: "https://hb.afl.rakuten.co.jp/hgc/g00reb4n.lbfgh789.g00reb4n.lbfgi8c6/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2Frk%2F2d19953a2b6f325e9d5f0b2538e35397%2F",
      genre: "少年・青年漫画",
      endDate: null,
      description: "一族に受け継がれてきた特殊な力『道しるべ』をもった二人は、不思議な事件にかかわっていく。ジュブナイル伝奇シリーズ、第1巻。序章から第2話まで収録。巻末小話付き。",
      updatedAt: new Date().toISOString(),
      seriesName: "白亜色の涙"
    }
  ];
}

module.exports = { parseRakuten };
