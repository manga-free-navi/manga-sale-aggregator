'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
// 自動収集データと、手動キャンペーンデータを両方インポートして結合します
import initialBooks from '../data/sales.json';
import manualBooks from '../data/manual_sales.json';
import BookCard, { Book, StoreDeal } from './BookCard';
import FilterBar from './FilterBar';
import AdContainer from './AdContainer';
import LazyRender from './LazyRender';

interface SeriesGroup {
  id: string; // 代表本ID
  seriesKey: string; // シリーズ識別キー
  books: Book[]; // シリーズに属する本の配列
}

/**
 * タイトルからシリーズ名（ベースタイトル）を抽出するヘルパー
 */
function getSeriesKey(title: string): string {
  // 全角数字を半角に正規化
  let key = title.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  
  // 1. 【期間限定無料】や【セール】などの前置タグや括弧内ノイズ（無料版・見本版・割引率表記等）を除去
  key = key.replace(/【[^】]*】/g, ' ')
           .replace(/\[[^\]]*\]/g, ' ')
           .replace(/[\(（][^）\)]*(?:無料|見本|お試し|分冊|単行本|％|%|OFF|割引|引き)[^）\)]*[\)）]/gi, ' ');

  // 2. act.X, vol.X, no.X, #X などの巻数表記の除去
  key = key.replace(/(?:act|vol|volume|no|#)\.?\s*\d+/i, ' ');

  // 3. 巻数、または「X巻」「上・中・下」「前後」などを除去
  key = key.replace(/第?\s*\d+\s*[巻話作]/g, ' ');
  key = key.replace(/[\(（]\d+[\)）]/g, ' ');
  key = key.replace(/[\s　]*(?:[\d]+|上|中|下|前|後)[巻話冊部]?[\s　]*$/, ' ');
  key = key.replace(/[\s　]*[（(](?:[\d]+|上|中|下|前|後)[巻話冊部]?[）)][\s　]*$/, ' ');
  key = key.replace(/[\s　]*第[\s　]*(?:\d+)[\s　]*[巻話冊]/, ' ');
  key = key.replace(/\s+\d+\s*$/g, ' ');
  key = key.replace(/\d+\s*$/g, ' ');

  // ノイズワードの除去
  const noiseWords = ['期間限定', '無料', 'セール', 'お試し', '試し読み', 'お試し版', '無料お試し版', '無料版', '無料見本版', '見本版', '分冊版'];
  noiseWords.forEach(word => {
    key = key.split(word).join(' ');
  });

  // 4. 全角スペースや特定の記号で区切られた後半部（サブタイトルなど）を切り取る
  const splitters = ['　', ' - ', ' — ', '：', ':'];
  for (const splitter of splitters) {
    const parts = key.split(splitter);
    if (parts.length > 1 && parts[0].trim().length > 1) {
      key = parts[0];
      break;
    }
  }
  
  return key.replace(/[\s　]+/g, '').trim();
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
  const [showOnlyAllFree, setShowOnlyAllFree] = useState(false); // 全話無料のみ表示フラグ
  const [readList, setReadList] = useState<string[]>([]);
  // ストアタグ絞り込み（複数選択可）
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  // カテゴリ絞り込み
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // ページネーション用ステート
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 60;

  // フィルター変更時にページを 1 に自動リセット (selectedStores 配列の参照変化による無限ループ防止)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedGenre, sortBy, JSON.stringify(selectedStores), selectedCategory, hideRead, showOnlyAllFree]);

  // ページ変更時に画面最上部へスムーズスクロール (初回マウント時はスクロール位置を維持)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);


  // 同期コード管理ステート
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState(false);

  // 3Way・テーマ・表示モード用ステート
  const [theme, setTheme] = useState('dark');
  const [viewMode, setViewMode] = useState<'grid' | 'gallery'>('grid');
  const [animeVideos, setAnimeVideos] = useState<any[]>([]);
  const [gameSales, setGameSales] = useState<any[]>([]);

  // アニメ配信情報のフェッチ
  useEffect(() => {
    const fetchAnimeVideos = async () => {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const envUrl = process.env.NEXT_PUBLIC_ANIME_SITE_URL || '';
      const urls: string[] = [];
      
      if (envUrl) {
        urls.push(`${envUrl.replace(/\/$/, '')}/videos.json`);
      }
      if (origin) {
        urls.push(`${origin}/youtube-free-anime-aggregator/videos.json`);
        urls.push(`${origin}/anime-free/videos.json`);
      }
      urls.push('/youtube-free-anime-aggregator/videos.json');
      urls.push('/anime-free/videos.json');
      urls.push('/videos.json');

      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              setAnimeVideos(data);
              break;
            }
          }
        } catch (e) {
          // ignore
        }
      }
    };
    fetchAnimeVideos();
  }, []);

  // ゲームセール情報のフェッチ
  useEffect(() => {
    const fetchGameSales = async () => {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const envUrl = process.env.NEXT_PUBLIC_GAME_SITE_URL || '';
      const urls: string[] = [];
      
      if (envUrl) {
        urls.push(`${envUrl.replace(/\/$/, '')}/games.json`);
      }
      if (origin) {
        urls.push(`${origin}/game-sale-aggregator/games.json`);
        urls.push(`${origin}/game-sale-aggregator/data/games.json`);
      }
      urls.push('/game-sale-aggregator/games.json');
      urls.push('/game-sale-aggregator/data/games.json');
      urls.push('/games.json');

      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              setGameSales(data);
              break;
            }
          }
        } catch (e) {
          // ignore
        }
      }
    };
    fetchGameSales();
  }, []);

  // お気に入りをBase64コード化して出力 (同期用)
  const readListCode = useMemo(() => {
    try {
      return btoa(JSON.stringify(readList));
    } catch (e) {
      return '';
    }
  }, [readList]);

  // 同期コードからお気に入りを復元 (インポート)
  const handleImportReadList = () => {
    setSyncError('');
    setSyncSuccess(false);
    try {
      const trimmed = syncCodeInput.trim();
      if (!trimmed) {
        setSyncError('同期コードを入力してください。');
        return;
      }
      const parsed = JSON.parse(atob(trimmed));
      if (!Array.isArray(parsed)) {
        setSyncError('無効な同期コード形式です。');
        return;
      }
      // 重複を排除してマージ
      const merged = Array.from(new Set([...readList, ...parsed]));
      setReadList(merged);
      localStorage.setItem('manga_read_list', JSON.stringify(merged));
      localStorage.setItem('manga_favorites', JSON.stringify(merged)); // アニフリー連携用にも保存
      
      setSyncSuccess(true);
      setSyncCodeInput('');
      
      // イベント発火して他コンポーネントへ通知
      window.dispatchEvent(new Event('readListUpdated'));
      
      setTimeout(() => {
        setShowSyncModal(false);
        setSyncSuccess(false);
      }, 1500);
    } catch (e) {
      setSyncError('コードの解析に失敗しました。正しいコードを入力してください。');
    }
  };

  // 閲覧設定の初期復元
  useEffect(() => {
    try {
      const savedGenre = localStorage.getItem('manga_filter_genre');
      const savedSort = localStorage.getItem('manga_sort_by');
      const savedHideRead = localStorage.getItem('manga_hide_read');
      const savedShowOnlyAllFree = localStorage.getItem('manga_show_only_all_free');
      const savedTheme = localStorage.getItem('manga-theme') || 'dark';
      const savedViewMode = localStorage.getItem('manga-view-mode') || 'grid';
      
      if (savedGenre) setSelectedGenre(savedGenre);
      if (savedSort) setSortBy(savedSort);
      if (savedHideRead) setHideRead(savedHideRead === 'true');
      if (savedShowOnlyAllFree) setShowOnlyAllFree(savedShowOnlyAllFree === 'true');
      
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
      
      setViewMode(savedViewMode as 'grid' | 'gallery');
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

  const handleShowOnlyAllFreeChange = (show: boolean) => {
    setShowOnlyAllFree(show);
    try {
      localStorage.setItem('manga_show_only_all_free', String(show));
    } catch (e) { console.error(e); }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('manga-theme', newTheme);
  };

  const handleSetViewMode = (mode: 'grid' | 'gallery') => {
    setViewMode(mode);
    localStorage.setItem('manga-view-mode', mode);
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

    // 2.7 ストアタグ絞り込み（選択したストアを少なくとも1つ以上持つ本のみ表示）
    if (selectedStores.length > 0) {
      result = result.filter((b) =>
        selectedStores.some(store => Object.keys(b.stores).includes(store))
      );
    }

    // 2.8 カテゴリ絞り込み
    if (selectedCategory !== 'all') {
      result = result.filter((b) => (b as any).category === selectedCategory);
    }

    // 2.9 全話無料のみ表示
    if (showOnlyAllFree) {
      result = result.filter(
        (b) =>
          (b as any).isAllFree === true ||
          (b as any).category === 'free_serialization'
      );
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
      
      return 0;
    });

    return groupedResults;
  }, [books, searchTerm, selectedGenre, sortBy, hideRead, readList, selectedStores, selectedCategory, showOnlyAllFree]);

  // ページネーションの計算とデータ分割
  const totalPages = Math.ceil(filteredAndSortedGroups.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedGroups = useMemo(() => {
    return filteredAndSortedGroups.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedGroups, startIndex]);




  return (
    <div className="container" style={{ paddingTop: '20px' }}>
      {/* ヒーローセクション */}
      <section className="hero">
        <h1>無料 漫画 ＆ 激安セール中のコミック情報まとめ</h1>
        <p>
          主要な電子書籍ストアや公式マンガアプリで配信されている、期間限定の「無料 漫画」やお得な割引セール情報を毎日自動集約。<br />
          今日すぐに読める「無料 漫画」のチェックや、新しい作品との出会いにお役立てください。
        </p>
      </section>

      {/* 操作バー (表示モード・テーマ切り替え・同期) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '-0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        {/* 左側：表示モード切り替え */}
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255, 255, 255, 0.02)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.1))' }}>
          <button
            onClick={() => handleSetViewMode('grid')}
            style={{
              background: viewMode === 'grid' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              border: 'none',
              color: viewMode === 'grid' ? 'var(--text-main)' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            通常グリッド
          </button>
          <button
            onClick={() => handleSetViewMode('gallery')}
            style={{
              background: viewMode === 'gallery' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              border: 'none',
              color: viewMode === 'gallery' ? 'var(--text-main)' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            ジャケ買いギャラリー
          </button>
        </div>

        {/* 右側：同期＆テーマ切り替え */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={toggleTheme}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: '0.45rem 0.95rem',
              borderRadius: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s',
              backdropFilter: 'blur(5px)'
            }}
          >
            {theme === 'dark' ? 'ライトネオン' : 'ダークネオン'}
          </button>
          <button
            onClick={() => setShowSyncModal(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: '0.45rem 0.95rem',
              borderRadius: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s',
              backdropFilter: 'blur(5px)'
            }}
          >
            同期・バックアップ
          </button>
        </div>
      </div>

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

      {/* カテゴリタグ（無料連載 / 期間限定無料 / セール） */}
      <div style={{ marginBottom: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginRight: '0.25rem' }}>種別：</span>
        {([
          { value: 'all',               label: 'すべて',       emoji: '' },
          { value: 'free_serialization', label: '無料連載',    emoji: '📺' },
          { value: 'limited_free',       label: '期間限定無料', emoji: '⏰' },
          { value: 'sale',               label: 'セール',       emoji: '💰' },
        ] as const).map(cat => {
          const active = selectedCategory === cat.value;
          // カテゴリごとにアクティブ色を変える
          const activeGradient =
            cat.value === 'free_serialization' ? 'linear-gradient(135deg,#10b981,#059669)' :
            cat.value === 'limited_free'       ? 'linear-gradient(135deg,#f59e0b,#d97706)' :
            cat.value === 'sale'               ? 'linear-gradient(135deg,#ef4444,#dc2626)' :
                                                 'linear-gradient(135deg,#6366f1,#a855f7)';
          const activeShadow =
            cat.value === 'free_serialization' ? '0 0 10px rgba(16,185,129,0.4)' :
            cat.value === 'limited_free'       ? '0 0 10px rgba(245,158,11,0.4)' :
            cat.value === 'sale'               ? '0 0 10px rgba(239,68,68,0.4)'  :
                                                 '0 0 10px rgba(99,102,241,0.4)';
          return (
            <button
              key={cat.value}
              id={`category-tag-${cat.value}`}
              onClick={() => setSelectedCategory(cat.value)}
              style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '0.25rem 0.8rem',
                borderRadius: '20px', border: '1px solid', cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: active ? activeGradient : 'rgba(255,255,255,0.04)',
                borderColor: active ? 'transparent' : 'rgba(255,255,255,0.12)',
                color: active ? '#fff' : 'var(--text-secondary)',
                boxShadow: active ? activeShadow : 'none',
              }}
            >{cat.emoji ? `${cat.emoji} ` : ''}{cat.label}</button>
          );
        })}
      </div>

      {/* ストアタグ絞り込み */}
      {((): React.ReactNode => {
        // タグ定義：名前、絵文字、対応ストアキー配列
        const storeTags: { label: string; emoji: string; keys: string[] }[] = [
          { label: 'ジャンプ+', emoji: '⚡', keys: ['jumpplus', 'jumpplus_campaign'] },
          { label: 'うぇぶり', emoji: '☀️', keys: ['sundaywebry', 'sundaywebry_free'] },
          { label: 'マガポケ', emoji: '📢', keys: ['magapoke', 'magapoke_campaign'] },
          { label: 'コミックDAYS', emoji: '📆', keys: ['comicdays', 'comicdays_campaign'] },
          { label: 'となジャン', emoji: '🎯', keys: ['tonarinoyj'] },
          { label: 'ヤンマガWeb', emoji: '🔥', keys: ['yanmaga', 'yanmaga_campaign'] },
          { label: 'くらげバンチ', emoji: '🪼', keys: ['kuragebunch'] },
          { label: 'コミックガルド', emoji: '🛡️', keys: ['comicgardo'] },
          { label: 'MAGCOMI', emoji: '🏰', keys: ['magcomi'] },
          { label: '楽天Kobo', emoji: '📚', keys: ['rakuten'] },
          { label: 'シーモア', emoji: '🌊', keys: ['seimor'] },
          { label: 'BOOKWALKER', emoji: '🎮', keys: ['bookwalker'] },
          { label: 'Kindle', emoji: '📱', keys: ['amazon'] },
        ];
        const isTagActive = (keys: string[]) => keys.some(k => selectedStores.includes(k));
        const toggleStore = (keys: string[]) => {
          setSelectedStores(prev => {
            const allIn = keys.every(k => prev.includes(k));
            if (allIn) return prev.filter(k => !keys.includes(k));
            const merged = [...prev];
            keys.forEach(k => { if (!merged.includes(k)) merged.push(k); });
            return merged;
          });
        };
        return (
          <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginRight: '0.25rem' }}>配信元：</span>
            <button
              id="store-tag-all"
              onClick={() => setSelectedStores([])}
              style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '0.25rem 0.7rem',
                borderRadius: '20px', border: '1px solid', cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: selectedStores.length === 0 ? 'linear-gradient(135deg,#6366f1,#a855f7)' : 'rgba(255,255,255,0.04)',
                borderColor: selectedStores.length === 0 ? 'transparent' : 'rgba(255,255,255,0.12)',
                color: selectedStores.length === 0 ? '#fff' : 'var(--text-secondary)',
                boxShadow: selectedStores.length === 0 ? '0 0 10px rgba(99,102,241,0.4)' : 'none',
              }}
            >すべて</button>
            {storeTags.map(tag => {
              const active = isTagActive(tag.keys);
              return (
                <button
                  key={tag.label}
                  id={`store-tag-${tag.label}`}
                  onClick={() => toggleStore(tag.keys)}
                  style={{
                    fontSize: '0.72rem', fontWeight: 700, padding: '0.25rem 0.7rem',
                    borderRadius: '20px', border: '1px solid', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: active ? 'linear-gradient(135deg,#0ea5e9,#6366f1)' : 'rgba(255,255,255,0.04)',
                    borderColor: active ? 'transparent' : 'rgba(255,255,255,0.12)',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    boxShadow: active ? '0 0 10px rgba(14,165,233,0.35)' : 'none',
                  }}
                >{tag.emoji} {tag.label}</button>
              );
            })}
          </div>
        );
      })()}

      {/* 補助コントロール（件数 ＆ 各種トグル） */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', fontSize: '0.9rem' }}>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', cursor: 'pointer' }} id="label-show-only-all-free">
          <input
            type="checkbox"
            checked={showOnlyAllFree}
            onChange={(e) => handleShowOnlyAllFreeChange(e.target.checked)}
            id="checkbox-show-only-all-free"
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          🏆 全話（全巻）無料のみ表示
        </label>
      </div>

      {/* 漫画一覧領域 */}
      {filteredAndSortedGroups.length === 0 ? (
        <div className="empty-state">
          <h3>対象の漫画が見つかりませんでした</h3>
          <p>検索キーワードやフィルタ条件を変えてお試しください。</p>
        </div>
      ) : (
        <div className={viewMode === 'gallery' ? "book-gallery-grid" : "book-grid"}>
          {paginatedGroups.map((group, index) => {
            const cardElement = (
              <LazyRender key={group.id}>
                {viewMode === 'gallery' ? (
                  <div 
                    className="gallery-card" 
                    style={{
                      position: 'relative',
                      aspectRatio: '2/3',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-card)',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => {
                      // クリック時は代表電子ストアに遷移
                      const repBook = group.books[0];
                      const firstStoreKey = Object.keys(repBook.stores)[0];
                      const storeUrl = repBook.stores[firstStoreKey]?.url || '';
                      if (storeUrl) window.open(storeUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={group.books[0].imageUrl} 
                      alt={group.books[0].title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      loading="lazy"
                    />
                    <div 
                      className="gallery-overlay" 
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(to top, rgba(11, 15, 25, 0.95) 0%, rgba(11, 15, 25, 0.4) 80%, transparent 100%)',
                        padding: '1.25rem 0.75rem 0.75rem 0.75rem',
                        color: '#fff',
                        opacity: 0,
                        transition: 'opacity 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        height: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.6rem', background: '#e11d48', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                          {Math.max(...group.books.map(b => getBookMaxDiscount(b)))}% OFF
                        </span>
                        {group.books.length > 1 && (
                          <span style={{ fontSize: '0.6rem', background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            他 {group.books.length - 1}冊
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 0.2rem 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {group.books[0].title.replace(/^\[[^\]]+\]/, '').replace(/^【[^】]+】/, '')}
                      </h4>
                      <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0 0 0.5rem 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {group.books[0].author}
                      </p>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#39ff14' }}>
                        ¥{Math.min(...group.books.map(b => getBookMinPrice(b))).toLocaleString()}〜
                      </div>
                    </div>
                  </div>
                ) : (
                  <BookCard 
                    books={group.books} 
                    animeVideos={animeVideos} 
                    gameSales={gameSales}
                  />
                )}
              </LazyRender>
            );

            // 8枚のカードごとにインライン広告を挟む（最初の広告は4枚目の後に配置して見えやすくする）
            if ((index + 1) % 8 === 4) {
              return (
                <div key={`wrapper-${group.id}`} style={{ display: 'contents' }}>
                  {cardElement}
                  <div key={`grid-ad-${index}`} style={{ gridColumn: '1 / -1' }}>
                    <AdContainer slot={`in-grid-ad-${index}`} format="fluid" />
                  </div>
                </div>
              );
            }

            return cardElement;
          })}
        </div>
      )}

      {/* ページネーションコントローラー */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.4rem',
          marginTop: '2.5rem',
          marginBottom: '2.5rem',
          flexWrap: 'wrap'
        }} id="pagination-controls">
          {/* 最初へ */}
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: currentPage === 1 ? 'var(--text-secondary)' : 'var(--text-main)',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.4 : 1,
              fontSize: '0.75rem',
              fontWeight: 700,
              transition: 'all 0.2s'
            }}
          >
            « 最初
          </button>
          
          {/* 前へ */}
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: currentPage === 1 ? 'var(--text-secondary)' : 'var(--text-main)',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.4 : 1,
              fontSize: '0.75rem',
              fontWeight: 700,
              transition: 'all 0.2s'
            }}
          >
            ‹ 前へ
          </button>

          {/* ページ番号（省略記号付き） */}
          {((): React.ReactNode => {
            const pages: (number | string)[] = [];
            const delta = 2; // 現在ページの前後に表示する数
            const left = currentPage - delta;
            const right = currentPage + delta;
            
            for (let i = 1; i <= totalPages; i++) {
              if (i === 1 || i === totalPages || (i >= left && i <= right)) {
                pages.push(i);
              } else if (pages[pages.length - 1] !== '...') {
                pages.push('...');
              }
            }

            return pages.map((page, idx) => {
              if (page === '...') {
                return (
                  <span 
                    key={`ellipsis-${idx}`} 
                    style={{ color: 'var(--text-secondary)', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                  >
                    ...
                  </span>
                );
              }

              const isCurrent = page === currentPage;
              return (
                <button
                  key={`page-${page}`}
                  onClick={() => setCurrentPage(page as number)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: isCurrent ? 'transparent' : 'rgba(255,255,255,0.08)',
                    background: isCurrent ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.03)',
                    color: isCurrent ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    boxShadow: isCurrent ? '0 0 10px rgba(99,102,241,0.35)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {page}
                </button>
              );
            });
          })()}

          {/* 次へ */}
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: currentPage === totalPages ? 'var(--text-secondary)' : 'var(--text-main)',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.4 : 1,
              fontSize: '0.75rem',
              fontWeight: 700,
              transition: 'all 0.2s'
            }}
          >
            次へ ›
          </button>

          {/* 最後へ */}
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: currentPage === totalPages ? 'var(--text-secondary)' : 'var(--text-main)',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.4 : 1,
              fontSize: '0.75rem',
              fontWeight: 700,
              transition: 'all 0.2s'
            }}
          >
            最後 »
          </button>
        </div>
      )}


      {/* 同期モーダル */}
      {showSyncModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100,
          padding: '1rem',
          boxSizing: 'border-box'
        }} onClick={() => setShowSyncModal(false)}>
          <div className="modal-content" style={{
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '2rem',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            color: '#e2e8f0',
            backdropFilter: 'blur(20px)',
            position: 'relative',
            boxSizing: 'border-box'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
              お気に入り既読データの同期・移行
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              このコードをコピペすることで、他のブラウザやスマホとお気に入り既読状態を同期したり、バックアップを取ることができます。
            </p>

            {/* エクスポートコード */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                あなたのお気に入り同期コード (コピー用):
              </label>
              <textarea
                readOnly
                value={readListCode}
                onClick={(e) => {
                  const el = e.currentTarget;
                  el.select();
                  navigator.clipboard.writeText(readListCode);
                }}
                style={{
                  width: '100%',
                  height: '80px',
                  background: 'rgba(15, 23, 42, 0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#a7f3d0',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  padding: '0.5rem',
                  boxSizing: 'border-box',
                  resize: 'none',
                  cursor: 'pointer'
                }}
                title="クリックで全選択コピー"
              />
              <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'block', marginTop: '0.2rem' }}>
                ※クリックすると全選択され、クリップボードにコピーされます。
              </span>
            </div>

            {/* インポート入力 */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                同期コードをインポート (貼り付け用):
              </label>
              <textarea
                placeholder="ここに同期コードを貼り付けてください..."
                value={syncCodeInput}
                onChange={(e) => setSyncCodeInput(e.target.value)}
                style={{
                  width: '100%',
                  height: '80px',
                  background: 'rgba(15, 23, 42, 0.2)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  padding: '0.5rem',
                  boxSizing: 'border-box',
                  resize: 'none'
                }}
              />
            </div>

            {/* エラー／成功メッセージ */}
            {syncError && (
              <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '1rem', fontWeight: 600 }}>
                ⚠️ {syncError}
              </div>
            )}
            {syncSuccess && (
              <div style={{ color: '#10b981', fontSize: '0.8rem', marginBottom: '1rem', fontWeight: 600 }}>
                ✅ 同期に成功しました！
              </div>
            )}

            {/* アクションボタン */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowSyncModal(false);
                  setSyncError('');
                  setSyncCodeInput('');
                }}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-secondary)',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleImportReadList}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.5rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 700
                }}
              >
                インポート実行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
