'use client';

import { useState, useMemo } from 'react';
// 自動収集データと、手動割り込みデータを両方インポートして結合します
import initialBooks from '../data/sales.json';
import manualBooks from '../data/manual_sales.json';
import BookCard, { Book } from './BookCard';
import FilterBar from './FilterBar';
import AdContainer from './AdContainer';

interface SeriesGroup {
  id: string; // 代表本ID
  seriesKey: string; // シリーズ識別キー
  books: Book[]; // シリーズに属する本の配列
}

/**
 * タイトルからシリーズ名（ベースタイトル）を抽出するヘルパー
 */
function getSeriesKey(title: string): string {
  // 1. 【期間限定無料】や【セール】などの前置タグを除去
  let key = title.replace(/^\[[^\]]+\]/, '').replace(/^【[^】]+】/, '');
  
  // 2. 巻数、または「X巻」「上・中・下」「前後」などを除去
  key = key.replace(/[\s　]*(?:[\d１２３４５６７８９０]+|上|中|下|前|後)[巻話冊部]?[\s　]*$/, '');
  key = key.replace(/[\s　]*[（(](?:[\d１２３４５６７８９０]+|上|中|下|前|後)[巻話冊部]?[）)][\s　]*$/, '');
  key = key.replace(/[\s　]*第[\s　]*(?:[\d１２３４５６７８９０]+)[\s　]*[巻話冊]/, '');

  // 3. 全角スペースや特定の記号で区切られた後半部（サブタイトルなど）を切り取る
  const splitters = ['　', ' - ', ' — ', '：', ':'];
  for (const splitter of splitters) {
    const parts = key.split(splitter);
    if (parts.length > 1 && parts[0].trim().length > 1) {
      key = parts[0];
      break;
    }
  }
  
  return key.trim();
}

export default function MainApp() {
  // 自動データと手動キャンペーンデータを結合
  const books = useMemo(() => {
    const autoList = (initialBooks || []) as Book[];
    const manualList = (manualBooks || []) as Book[];
    return [...manualList, ...autoList];
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [sortBy, setSortBy] = useState('discountDesc');

  // 動的ジャンル一覧の抽出 (順序を完全に一意にするため .sort() を追加)
  const genres = useMemo(() => {
    const allGenres = books.map((b) => b.genre).filter(Boolean);
    return Array.from(new Set(allGenres)).sort();
  }, [books]);

  // 検索・フィルタリング・グループ化・ソートの適用
  const filteredAndSortedGroups = useMemo(() => {
    let result = [...books];

    // 1. キーワード検索 (タイトル or 著者名)
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(term) ||
          b.author.toLowerCase().includes(term)
      );
    }

    // 2. ジャンル絞り込み
    if (selectedGenre !== 'all') {
      result = result.filter((b) => b.genre === selectedGenre);
    }

    // 3. シリーズごとにグループ化
    const groupsMap = new Map<string, Book[]>();
    
    result.forEach((book) => {
      const key = getSeriesKey(book.title);
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      
      // 手動データを配列の先頭にするため、unshift を使用し、自動データは末尾に push します
      if (book.id.startsWith('manual-')) {
        groupsMap.get(key)!.unshift(book);
      } else {
        groupsMap.get(key)!.push(book);
      }
    });

    const groupedResults: SeriesGroup[] = [];
    groupsMap.forEach((groupBooks, seriesKey) => {
      const manualBooksInGroup = groupBooks.filter(b => b.id.startsWith('manual-'));
      const autoBooksInGroup = groupBooks.filter(b => !b.id.startsWith('manual-'));

      if (manualBooksInGroup.length > 0) {
        // 手動データがある場合：手動データを先頭にして固定し、自動データ部分のみをソートして結合
        autoBooksInGroup.sort((a, b) => a.title.localeCompare(b.title));
        const merged = [...manualBooksInGroup, ...autoBooksInGroup];
        groupedResults.push({
          id: merged[0].id,
          seriesKey: seriesKey,
          books: merged,
        });
      } else {
        // 自動データのみの場合：全体をソート
        groupBooks.sort((a, b) => a.title.localeCompare(b.title));
        groupedResults.push({
          id: groupBooks[0].id,
          seriesKey: seriesKey,
          books: groupBooks,
        });
      }
    });

    // 4. グループの並び替え (代表本またはグループ内最大値を基準にします)
    groupedResults.sort((a, b) => {
      const repA = a.books[0];
      const repB = b.books[0];

      // 手動データを常に最上部に固定
      const isAManual = repA.id.startsWith('manual-');
      const isBManual = repB.id.startsWith('manual-');
      if (isAManual && !isBManual) return -1;
      if (!isAManual && isBManual) return 1;

      if (sortBy === 'discountDesc') {
        // グループ内での最大割引率を基準に降順ソート
        const maxDiscountA = Math.max(...a.books.map(bk => bk.discountRate));
        const maxDiscountB = Math.max(...b.books.map(bk => bk.discountRate));
        if (maxDiscountB !== maxDiscountA) {
          return maxDiscountB - maxDiscountA;
        }
        return repA.id.localeCompare(repB.id);
      }
      
      if (sortBy === 'priceAsc') {
        // グループ内での最安価格を基準に昇順ソート
        const minPriceA = Math.min(...a.books.map(bk => bk.salePrice));
        const minPriceB = Math.min(...b.books.map(bk => bk.salePrice));
        if (minPriceA !== minPriceB) {
          return minPriceA - minPriceB;
        }
        return repA.id.localeCompare(repB.id);
      }
      
      if (sortBy === 'endDateAsc') {
        // 終了日が最も近いものを基準にソート (nullは後ろへ)
        const datesA = a.books.map(bk => bk.endDate).filter(Boolean).map(d => new Date(d!).getTime());
        const datesB = b.books.map(bk => bk.endDate).filter(Boolean).map(d => new Date(d!).getTime());
        const minDateA = datesA.length > 0 ? Math.min(...datesA) : Infinity;
        const minDateB = datesB.length > 0 ? Math.min(...datesB) : Infinity;
        
        if (minDateA !== minDateB) {
          return minDateA - minDateB;
        }
        return repA.id.localeCompare(repB.id);
      }
      
      if (sortBy === 'newest') {
        // グループ内の最新の更新日付を基準に降順ソート
        const newestA = Math.max(...a.books.map(bk => new Date(bk.updatedAt).getTime()));
        const newestB = Math.max(...b.books.map(bk => new Date(bk.updatedAt).getTime()));
        if (newestA !== newestB) {
          return newestB - newestA;
        }
        return repA.id.localeCompare(repB.id);
      }
      
      return repA.id.localeCompare(repB.id);
    });

    return groupedResults;
  }, [books, searchTerm, selectedGenre, sortBy]);

  return (
    <div className="container" style={{ paddingTop: '20px' }}>
      {/* ヒーローセクション */}
      <section className="hero">
        <h1>今だけの無料＆激安セール漫画を見逃すな！</h1>
        <p>
          期間限定で無料になっている話題作や、割引セール中の電子書籍コミック情報をまとめました。<br />
          主要無料漫画アプリ（ジャンプ+、マガポケ、サンデーうぇぶり等）の特大キャンペーン情報も掲載中！
        </p>
      </section>

      {/* 検索・フィルタバー */}
      <FilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedGenre={selectedGenre}
        setSelectedGenre={setSelectedGenre}
        sortBy={sortBy}
        setSortBy={setSortBy}
        genres={genres}
      />

      {/* メインレイアウト */}
      <div className="main-layout">
        {/* 左側：漫画一覧領域 */}
        <div>
          {filteredAndSortedGroups.length === 0 ? (
            <div className="empty-state">
              <h3>対象の漫画が見つかりませんでした</h3>
              <p>検索キーワードやフィルタ条件を変えてお試しください。</p>
            </div>
          ) : (
            <div className="book-grid">
              {filteredAndSortedGroups.map((group, index) => {
                // 3番目のカードの後にインライン広告を挟み込む（AdSense収益化用）
                const insertAd = index === 2;
                return (
                  <div key={group.id} style={{ display: 'contents' }}>
                    <BookCard books={group.books} />
                    {insertAd && (
                      <AdContainer slot="inline-ad-slot-1" type="inline" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右側：サイドバー領域 */}
        <aside>
          <AdContainer slot="sidebar-ad-slot-1" type="sidebar" />
          
          {/* お役立ち情報等のエリア */}
          <div
            className="filter-container"
            style={{ marginTop: '20px', fontSize: '0.85rem' }}
          >
            <h4 style={{ marginBottom: '10px', color: 'var(--accent-cyan)' }}>
              ご利用ガイド
            </h4>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
              当サイトでは、主要ストア・無料漫画アプリで期間限定配信されている「無料漫画」や「セール割引本」をリストアップしています。
            </p>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <strong>無料マークの作品：</strong><br />
              ストアやアプリ側で期間限定で無料設定になっているものです。期間終了後は通常設定に戻りますのでご注意ください。
            </p>
            <p style={{ color: 'var(--text-secondary)' }}>
              ※各セールの正確な価格や配信状況は、各ストア・アプリの遷移先ページにて最終確認をお願いいたします。
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
