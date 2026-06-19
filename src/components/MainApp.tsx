'use client';

import { useState, useMemo, useEffect } from 'react';
// 自動収集データと、手動割り込みデータを両方インポートして結合します
import initialBooks from '../data/sales.json';
import manualBooks from '../data/manual_sales.json';
import BookCard, { Book, StoreDeal } from './BookCard';
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

function getBookMaxDiscount(bk: Book): number {
  const deals = Object.values(bk.stores).filter((deal): deal is StoreDeal => !!deal);
  if (deals.length === 0) return 0;
  return Math.max(...deals.map(d => d.discountRate));
}

function getBookMinPrice(bk: Book): number {
  const deals = Object.values(bk.stores).filter((deal): deal is StoreDeal => !!deal);
  if (deals.length === 0) return Infinity;
  return Math.min(...deals.map(d => d.salePrice));
}

export default function MainApp() {
  // 自動データと手動キャンペーンデータを結合（手動データの互換性を補正）
  const books = useMemo(() => {
    const autoList = (initialBooks || []) as Book[];
    const rawManualList = (manualBooks || []) as any[];
    
    const manualList: Book[] = rawManualList.map((item, idx) => {
      if (item.stores) return item as Book;
      
      const storeKey = item.store || 'amazon';
      return {
        id: item.id || `manual-${idx}`,
        title: item.title || '',
        author: item.author || '',
        publisher: item.publisher || '',
        imageUrl: item.imageUrl || '',
        genre: item.genre || 'その他',
        endDate: item.endDate || null,
        description: item.description || '',
        updatedAt: item.updatedAt || new Date().toISOString(),
        stores: {
          [storeKey]: {
            url: item.url || '',
            originalPrice: typeof item.originalPrice === 'number' ? item.originalPrice : parseInt(item.originalPrice) || 0,
            salePrice: typeof item.salePrice === 'number' ? item.salePrice : parseInt(item.salePrice) || 0,
            discountRate: typeof item.discountRate === 'number' ? item.discountRate : parseInt(item.discountRate) || 0,
          }
        }
      };
    });
    return [...manualList, ...autoList];
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [sortBy, setSortBy] = useState('discountDesc');
  const [hideRead, setHideRead] = useState(false);
  const [readList, setReadList] = useState<string[]>([]);

  // 閲覧設定の初期復元
  useEffect(() => {
    try {
      const savedGenre = localStorage.getItem('manga_filter_genre');
      const savedSort = localStorage.getItem('manga_sort_by');
      const savedHideRead = localStorage.getItem('manga_hide_read');
      
      if (savedGenre) setSelectedGenre(savedGenre);
      if (savedSort) setSortBy(savedSort);
      if (savedHideRead) setHideRead(savedHideRead === 'true');
    } catch (e) {
      console.error('Failed to load manga preferences:', e);
    }
  }, []);

  // 設定変更時の保存用ハンドラー
  const handleGenreChange = (genre: string) => {
    setSelectedGenre(genre);
    try {
      localStorage.setItem('manga_filter_genre', genre);
    } catch (e) { console.error(e); }
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    try {
      localStorage.setItem('manga_sort_by', sort);
    } catch (e) { console.error(e); }
  };

  const handleHideReadChange = (hide: boolean) => {
    setHideRead(hide);
    try {
      localStorage.setItem('manga_hide_read', String(hide));
    } catch (e) { console.error(e); }
  };

  // 既読状態の同期（LocalStorageの監視）
  useEffect(() => {
    const syncReadList = () => {
      const list = JSON.parse(localStorage.getItem('manga_read_list') || '[]');
      setReadList(list);
    };
    syncReadList();
    window.addEventListener('readListUpdated', syncReadList);
    return () => window.removeEventListener('readListUpdated', syncReadList);
  }, []);

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

    // 2.5 既読作品の非表示
    if (hideRead) {
      result = result.filter((b) => !readList.includes(b.id));
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
        const maxDiscountA = Math.max(...a.books.map(bk => getBookMaxDiscount(bk)));
        const maxDiscountB = Math.max(...b.books.map(bk => getBookMaxDiscount(bk)));
        if (maxDiscountB !== maxDiscountA) {
          return maxDiscountB - maxDiscountA;
        }
        return repA.id.localeCompare(repB.id);
      }
      
      if (sortBy === 'priceAsc') {
        // グループ内での最安価格を基準に昇順ソート
        const minPriceA = Math.min(...a.books.map(bk => getBookMinPrice(bk)));
        const minPriceB = Math.min(...b.books.map(bk => getBookMinPrice(bk)));
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
        <h1>無料＆割引セール中のコミック情報まとめ</h1>
        <p>
          主要な電子書籍ストアや公式マンガアプリで公開されている、期間限定の無料漫画やお得な割引セール情報を集めて整理しています。<br />
          今日読める作品のチェックや、新しい漫画との出会いにお役立てください。
        </p>
      </section>

      {/* 検索・フィルタバー */}
      <FilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedGenre={selectedGenre}
        setSelectedGenre={handleGenreChange}
        sortBy={sortBy}
        setSortBy={handleSortChange}
        genres={genres}
      />

      {/* 補助コントロール（件数 ＆ 既読非表示トグル） */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', fontSize: '0.9rem' }}>
        <div style={{ color: 'var(--text-secondary)' }}>
          該当シリーズ: <strong>{filteredAndSortedGroups.length}</strong> 作品
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', cursor: 'pointer' }} id="label-hide-read">
          <input
            type="checkbox"
            checked={hideRead}
            onChange={(e) => handleHideReadChange(e.target.checked)}
            id="checkbox-hide-read"
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          既読にした作品を非表示にする
        </label>
      </div>

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
