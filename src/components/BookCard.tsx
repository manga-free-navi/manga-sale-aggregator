'use client';

import { useMemo, useState, useEffect, useRef } from 'react';

export interface StoreDeal {
  url: string;
  originalPrice: number;
  salePrice: number;
  discountRate: number;
}

export interface FreeEpisode {
  title: string;
  fullTitle: string;
  url: string;
  pubDate: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  publisher: string;
  imageUrl: string;
  genre: string;
  endDate: string | null;
  description: string;
  updatedAt: string;
  volsFreeText?: string;
  /** RSSから取得した無料公開エピソード数（ジャンプ+/うぇぶりRSS系のみ） */
  freeEpisodeCount?: number;
  /** 無料公開エピソードの詳細情報リスト */
  freeEpisodes?: FreeEpisode[];
  /** 最新公開日 */
  latestPubDate?: string;
  /** 次回更新予定日 */
  nextUpdateDate?: string;
  /** コンテンツ種別: 'free_serialization'=無料連載 / 'limited_free'=期間限定無料 / 'sale'=セール */
  category?: 'free_serialization' | 'limited_free' | 'sale';
  isAllFree?: boolean; // 全話無料フラグ
  stores: {
    rakuten?: StoreDeal;
    seimor?: StoreDeal;
    amazon?: StoreDeal;
    [key: string]: StoreDeal | undefined;
  };
}

interface BookCardProps {
  books: Book[]; // シリーズに属する本の配列
  animeVideos?: any[]; // アニメ配信情報リスト
  gameSales?: any[]; // 関連ゲームセールデータ
}

/**
 * 日付表示用のフォーマットヘルパー (例: 2026-06-27 -> 6月27日)
 */
function formatDisplayDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * 曜日付きの日付表示用のフォーマットヘルパー (例: 2026-06-27 -> 6月27日 (土))
 */
function formatDisplayDateWithDay(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const day = days[d.getDay()];
    const parts = dateStr.split('-');
    return `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日 (${day})`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * タイトルから巻数やサブタイトルを簡易的に切り出すヘルパー
 */
function getVolumeLabel(title: string, index: number): string {
  const cleaned = title.replace(/^\[[^\]]+\]/, '').replace(/^【[^】]+】/, '');
  
  // 末尾にある数字（巻数）を抽出
  const numMatch = cleaned.match(/(?:[\s　]*|[\(（])([\d１２３４５６７８９０]+|上|中|下|前|後)[巻話冊部]?[）\)]?[\s　]*$/);
  if (numMatch) {
    return `${numMatch[1]}巻`;
  }
  
  // 全角スペースや記号で区切られた後半部分をサブタイトルラベルとして取得
  const splitters = ['　', ' - ', ' — ', '：', ':'];
  for (const splitter of splitters) {
    const parts = cleaned.split(splitter);
    if (parts.length > 1 && parts[parts.length - 1].trim().length > 0) {
      const sub = parts[parts.length - 1].trim();
      return sub.length > 6 ? sub.substring(0, 5) + '..' : sub;
    }
  }
  
  return `${index + 1}巻`;
}

/**
 * シリーズごとにまとめた漫画カードコンポーネント（複数ストア価格比較・既読しおり機能付き）
 */
export default function BookCard({ books, animeVideos = [], gameSales = [] }: BookCardProps) {
  const [mounted, setMounted] = useState(false);
  
  // 現在選択されている巻（初期状態は最初の巻）
  const [currentBook, setCurrentBook] = useState<Book>(books[0]);
  
  // あらすじ展開ステート
  const [isExpanded, setIsExpanded] = useState(false);

  // あらすじDOM要素の参照と、はみ出し（見切れ）検知ステート
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [showReadMore, setShowReadMore] = useState(false);

  // 既読ステート
  const [isRead, setIsRead] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const [copied, setCopied] = useState(false);

  // アニメツールチップ表示ステート
  const [showAnimeTooltip, setShowAnimeTooltip] = useState(false);
  const [showGameTooltip, setShowGameTooltip] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // books の中身が変わった場合（検索やフィルタの再実行時など）に選択中の巻をリセット
  useEffect(() => {
    if (books.length > 0) {
      setCurrentBook(books[0]);
    }
  }, [books]);

  // localStorage から既読ステートおよび既読数を取得
  useEffect(() => {
    if (mounted) {
      const readList = JSON.parse(localStorage.getItem('manga_read_list') || '[]');
      setIsRead(readList.includes(currentBook.id));
      
      const count = books.filter(b => readList.includes(b.id)).length;
      setReadCount(count);
    }
  }, [currentBook.id, books, mounted, isRead]);

  // アニメ配信中情報のマッチング
  const matchedAnime = useMemo(() => {
    if (!animeVideos || animeVideos.length === 0) return null;
    
    const clean = (t: string) => {
      return t.replace(/【[^】]*】/g, '')
              .replace(/\[[^\]]*\]/g, '')
              .replace(/[\s　]+/g, '')
              .toLowerCase();
    };
    
    const bookTitleClean = clean(currentBook.title);
    const baseTitleClean = clean(books[0].title.replace(/^\[[^\]]+\]/, '').replace(/^【[^】]+】/, '').replace(/[\s　]*(?:[\d１２３４５６７８９０]+|上|中|下|前|後)[巻話冊部]?[\s　]*$/, ''));
    
    for (const video of animeVideos) {
      const animeTitle = clean(video.title || '');
      const originalTitle = clean(video.originalWorkTitle || '');
      
      if (
        (animeTitle && (bookTitleClean.includes(animeTitle) || animeTitle.includes(baseTitleClean))) ||
        (originalTitle && (bookTitleClean.includes(originalTitle) || originalTitle.includes(baseTitleClean)))
      ) {
        return video;
      }
    }
    return null;
  }, [animeVideos, currentBook.title, books]);

  // 関連ゲームセールのマッチング
  const matchedGame = useMemo(() => {
    if (!gameSales || gameSales.length === 0) return null;
    
    const clean = (t: string) => {
      return t.replace(/【[^】]*】/g, '')
              .replace(/\[[^\]]*\]/g, '')
              .replace(/[\s　]+/g, '')
              .toLowerCase();
    };
    
    const bookTitleClean = clean(currentBook.title);
    const baseTitleClean = clean(books[0].title.replace(/^\[[^\]]+\]/, '').replace(/^【[^】]+】/, '').replace(/[\s　]*(?:[\d１２３４５６７８９０]+|上|中|下|前|後)[巻話冊部]?[\s　]*$/, ''));
    
    for (const game of gameSales) {
      const gameTitle = clean(game.title || '');
      if (gameTitle && (bookTitleClean.includes(gameTitle) || gameTitle.includes(baseTitleClean) || baseTitleClean.includes(gameTitle))) {
        return game;
      }
    }
    return null;
  }, [gameSales, currentBook.title, books]);

  const handleGameBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (matchedGame) {
      // ゲームナビへの直行リンク
      const searchUrl = `https://masayuki-gemini.github.io/game-sale-aggregator/?search=${encodeURIComponent(matchedGame.title)}`;
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAnimeBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (matchedAnime) {
      const searchTitle = matchedAnime.originalWorkTitle || matchedAnime.title;
      // アニフリーサイトへのリンク (検索パラメータ付き)
      const searchUrl = `https://masayuki-gemini.github.io/youtube-free-anime-aggregator/?search=${encodeURIComponent(searchTitle.replace(/\s+/g, ''))}`;
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // あらすじが実際にはみ出している（3行を超えている）かを検知する
  useEffect(() => {
    const checkOverflow = () => {
      const el = descriptionRef.current;
      if (el) {
        // 非展開時のスクロール高さと表示高さを比較
        const hasOverflow = el.scrollHeight > el.clientHeight;
        setShowReadMore(hasOverflow || isExpanded);
      }
    };

    // 初期チェックと、レンダリングラグを考慮した遅延チェック
    checkOverflow();
    const timer = setTimeout(checkOverflow, 100);
    
    return () => clearTimeout(timer);
  }, [currentBook, isExpanded]);

  // 既読のトグル処理
  const handleToggleRead = () => {
    const readList = JSON.parse(localStorage.getItem('manga_read_list') || '[]');
    let newList;
    if (isRead) {
      newList = readList.filter((id: string) => id !== currentBook.id);
    } else {
      newList = [...readList, currentBook.id];
    }
    localStorage.setItem('manga_read_list', JSON.stringify(newList));
    localStorage.setItem('manga_favorites', JSON.stringify(newList)); // アニフリー共有用にも保存！
    setIsRead(!isRead);
    
    // MainAppコンポーネントに既読状態が更新されたことを通知するイベントを発火
    window.dispatchEvent(new Event('readListUpdated'));
  };

  // お気に入りのトグル処理
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (mounted) {
      const favList = JSON.parse(localStorage.getItem('manga_favorites_list') || '[]');
      setIsFavorite(favList.includes(currentBook.id));
    }
  }, [currentBook.id, mounted]);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    const favList = JSON.parse(localStorage.getItem('manga_favorites_list') || '[]');
    let newList;
    if (isFavorite) {
      newList = favList.filter((id: string) => id !== currentBook.id);
    } else {
      newList = [...favList, currentBook.id];
    }
    localStorage.setItem('manga_favorites_list', JSON.stringify(newList));
    setIsFavorite(!isFavorite);
    
    // 他のコンポーネントやお気に入り数などを同期させるためのイベント
    window.dispatchEvent(new Event('mangaFavoritesUpdated'));
  };

  // 直近3日以内の最新話更新判定
  const isRecentlyUpdated = useMemo(() => {
    if (!currentBook.latestPubDate) return false;
    try {
      const pubDate = new Date(currentBook.latestPubDate);
      const today = new Date();
      pubDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - pubDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 2;
    } catch (e) {
      return false;
    }
  }, [currentBook.latestPubDate]);

  // セール終了までの残り日数を計算
  const remainingDaysText = useMemo(() => {
    if (!currentBook.endDate || !mounted) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const end = new Date(currentBook.endDate);
    end.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'キャンペーン終了';
    } else if (diffDays === 0) {
      return '本日終了！';
    } else if (diffDays === 1) {
      return '明日終了！';
    } else if (diffDays <= 7) {
      return `あと ${diffDays} 日`;
    }
    
    return `${currentBook.endDate} まで`;
  }, [currentBook.endDate, mounted]);

  // 終了期限までの残り日数を数値で取得
  const diffDaysVal = useMemo(() => {
    if (!currentBook.endDate || !mounted) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(currentBook.endDate); end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [currentBook.endDate, mounted]);

  // コピー処理
  const handleCopyUrl = () => {
    const firstStoreKey = Object.keys(currentBook.stores)[0];
    const url = currentBook.stores[firstStoreKey]?.url || '';
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => {
        console.error('Failed to copy URL:', err);
      });
    }
  };

  // Xシェア
  const handleShareX = () => {
    const firstStoreKey = Object.keys(currentBook.stores)[0];
    const url = currentBook.stores[firstStoreKey]?.url || '';
    const text = `【無料＆セール漫画ナビ】『${currentBook.title}』がおトク！\n期間：${remainingDaysText || 'お早めに'}\n詳細ストアはこちら：`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  // ストア情報の動的判定
  const getStoreInfo = (storeKey: string) => {
    switch (storeKey) {
      case 'rakuten':
        return { name: '楽天Kobo', btnClass: 'btn-kobo', action: '読む' };
      case 'seimor':
        return { name: 'シーモア', btnClass: 'btn-seimor', action: '読む' };
      case 'amazon':
        return { name: 'Kindle', btnClass: 'btn-kindle', action: '読む' };
      case 'bookwalker':
        return { name: 'BOOK☆WALKER', btnClass: 'btn-bookwalker', action: '読む' };
      case 'jumpplus':
        return { name: 'ジャンプ＋', btnClass: 'btn-jumpplus', action: '読む' };
      case 'jumpplus_campaign':
        return { name: 'ジャンプ＋（キャンペーン）', btnClass: 'btn-jumpplus', action: '無料で読む' };
      case 'sundaywebry':
        return { name: 'サンデーうぇぶり', btnClass: 'btn-sundaywebry', action: '読む' };
      case 'sundaywebry_free':
        return { name: 'サンデーうぇぶり（無料）', btnClass: 'btn-sundaywebry', action: '無料で読む' };
      case 'magapoke':
        return { name: 'マガポケ', btnClass: 'btn-magapoke', action: '無料で読む' };
      case 'magapoke_campaign':
        return { name: 'マガポケ（キャンペーン）', btnClass: 'btn-magapoke', action: '無料で読む' };
      case 'comicdays':
        return { name: 'コミックDAYS', btnClass: 'btn-comicdays', action: '無料で読む' };
      case 'comicdays_campaign':
        return { name: 'コミックDAYS（キャンペーン）', btnClass: 'btn-comicdays', action: '無料で読む' };
      case 'tonarinoyj':
        return { name: 'となジャン', btnClass: 'btn-tonarinoyj', action: '無料で読む' };
      case 'yanmaga':
        return { name: 'ヤンマガWeb', btnClass: 'btn-yanmaga', action: '無料で読む' };
      case 'yanmaga_campaign':
        return { name: 'ヤンマガWeb（キャンペーン）', btnClass: 'btn-yanmaga', action: '無料で読む' };
      case 'kuragebunch':
        return { name: 'くらげバンチ', btnClass: 'btn-kuragebunch', action: '無料で読む' };
      case 'comicgardo':
        return { name: 'コミックガルド', btnClass: 'btn-comicgardo', action: '無料で読む' };
      case 'magcomi':
        return { name: 'MAGCOMI', btnClass: 'btn-magcomi', action: '無料で読む' };
      case 'biccomic':
        return { name: 'ビッコミ', btnClass: 'btn-biccomic', action: '無料で読む' };
      default:
        return { name: storeKey, btnClass: '', action: '読む' };
    }
  };



  // 最も価格が安く割引率の高いストア情報（代表取引）を算出
  const bestDeal = useMemo(() => {
    const deals = Object.values(currentBook.stores).filter(Boolean) as StoreDeal[];
    if (deals.length === 0) {
      return { discountRate: 100, originalPrice: 0, salePrice: 0 };
    }
    // 最安価格順、かつ割引率の高いものを最優先とする
    const sortedDeals = [...deals].sort((a, b) => a.salePrice - b.salePrice || b.discountRate - a.discountRate);
    return sortedDeals[0];
  }, [currentBook.stores]);

  return (
    <article className="book-card" id={`manga-card-${currentBook.id}`} style={{ position: 'relative' }}>
      {/* カテゴリバッジ（左上） & 割引率バッジ */}
      <div className="discount-tag" style={{
        background: currentBook.category === 'free_serialization'
          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
          : currentBook.category === 'limited_free'
            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
            : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      }}>
        {currentBook.category === 'free_serialization'
          ? '📺 無料連載'
          : currentBook.category === 'limited_free'
            ? '⏰ 期間限定無料'
            : bestDeal.discountRate === 100
              ? '無料公開'
              : `${bestDeal.discountRate}% OFF`
        }
      </div>

      {/* お気に入りボタン */}
      <button 
        className={`favorite-toggle-btn ${isFavorite ? 'active' : ''}`}
        onClick={handleToggleFavorite}
        title={isFavorite ? 'お気に入りから外す' : 'お気に入りに追加する (更新時に最上部へピン留め)'}
        id={`fav-toggle-${currentBook.id}`}
        style={{
          position: 'absolute',
          top: '0.75rem',
          right: '4.5rem',
          zIndex: 10,
          background: isFavorite ? 'rgba(251, 191, 36, 0.95)' : 'rgba(11, 15, 25, 0.75)',
          color: isFavorite ? '#0b0f19' : '#fbbf24',
          border: isFavorite ? 'none' : '1px solid rgba(251, 191, 36, 0.4)',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.65rem',
          fontWeight: 700,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '2px'
        }}
      >
        {isFavorite ? '★ お気に入り' : '☆ お気に入り'}
      </button>

      {/* 既読しおりボタン */}
      <button 
        className={`read-toggle-btn ${isRead ? 'read' : ''}`}
        onClick={handleToggleRead}
        title={isRead ? '未読に戻す' : '読了・既読にする (一覧から非表示化)'}
        id={`read-toggle-${currentBook.id}`}
        style={{
          position: 'absolute',
          top: '0.75rem',
          right: '0.75rem',
          zIndex: 10,
          background: isRead ? 'rgba(57, 255, 20, 0.95)' : 'rgba(11, 15, 25, 0.75)',
          color: isRead ? '#0b0f19' : '#e2e8f0',
          border: isRead ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.65rem',
          fontWeight: 700,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s'
        }}
      >
        {isRead ? '👁 既読済' : '👁 既読化'}
      </button>

      {/* 表紙画像 */}
      <div className="card-image-wrapper">
        {isRecentlyUpdated && (
          <div className="update-pulse-badge">
            🆕 更新あり！
          </div>
        )}
        {currentBook.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentBook.imageUrl}
            alt={`${currentBook.title}の表紙`}
            className="card-image"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>画像なし</div>
        )}
      </div>

      {/* コンテンツエリア */}
      <div className="card-content">
        <span className="book-genre">{currentBook.genre}</span>

        {/* シリーズ巻数/セール状態バッジ */}
        {currentBook.volsFreeText && (
          <span className="series-vols-badge" style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: currentBook.isAllFree
              ? 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)' // 全話無料ゴールドカラー
              : 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
            color: '#ffffff',
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            marginLeft: '0.5rem',
            verticalAlign: 'middle',
            boxShadow: currentBook.isAllFree
              ? '0 0 10px rgba(251, 191, 36, 0.6)'
              : '0 0 8px rgba(168, 85, 247, 0.4)'
          }}>
            ⚡ {currentBook.volsFreeText}
          </span>
        )}

        {/* 無料話数バッジ（GigaViewer RSS 系のみ表示） */}
        {currentBook.freeEpisodeCount && currentBook.freeEpisodeCount > 0 && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#fff',
            fontSize: '0.62rem',
            fontWeight: 800,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            marginLeft: '0.5rem',
            verticalAlign: 'middle',
            boxShadow: '0 0 6px rgba(245, 158, 11, 0.45)',
            letterSpacing: '0.01em',
          }}>
            📖 {currentBook.freeEpisodeCount}話 無料
          </span>
        )}
        
        {matchedAnime && (
          <div className="anime-sync-badge" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            marginLeft: '0.5rem',
            verticalAlign: 'middle',
            cursor: 'pointer',
            position: 'relative'
          }}
            onMouseEnter={() => setShowAnimeTooltip(true)}
            onMouseLeave={() => setShowAnimeTooltip(false)}
            onClick={handleAnimeBadgeClick}
            id={`anime-badge-${currentBook.id}`}
          >
            📺 アニメ無料配信中！
            
            {showAnimeTooltip && (
              <div className="anime-tooltip" style={{
                position: 'absolute',
                bottom: '125%',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#1e293b',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                width: '220px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                zIndex: 50,
                color: '#f8fafc',
                fontSize: '0.7rem',
                fontWeight: 400,
                lineHeight: '1.4',
                pointerEvents: 'none',
                textAlign: 'left'
              }}>
                <div style={{ fontWeight: 700, color: '#34d399', marginBottom: '0.25rem' }}>
                  {matchedAnime.channelName}で無料配信中！
                </div>
                <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {matchedAnime.title}
                </div>
                <div style={{ color: '#94a3b8', marginTop: '0.25rem' }}>
                  ※クリックでアニフリーへ移動します
                </div>
              </div>
            )}
          </div>
        )}
        
        {matchedGame && (
          <div className="game-sync-badge" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            color: '#ffffff',
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            marginLeft: '0.5rem',
            verticalAlign: 'middle',
            cursor: 'pointer',
            position: 'relative'
          }}
            onMouseEnter={() => setShowGameTooltip(true)}
            onMouseLeave={() => setShowGameTooltip(false)}
            onClick={handleGameBadgeClick}
            id={`game-badge-${currentBook.id}`}
          >
            🎮 関連ゲームセール中！
            
            {showGameTooltip && (
              <div className="game-tooltip" style={{
                position: 'absolute',
                bottom: '125%',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#0f172a',
                border: '1px solid rgba(59,130,246,0.3)',
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                width: '230px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 0 10px rgba(59,130,246,0.2)',
                zIndex: 50,
                color: '#f8fafc',
                fontSize: '0.7rem',
                fontWeight: 400,
                lineHeight: '1.4',
                pointerEvents: 'none',
                textAlign: 'left'
              }}>
                <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>🎮</span> 関連ゲームお得情報
                </div>
                <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 600, marginBottom: '0.2rem' }}>
                  {matchedGame.title}
                </div>
                <div>
                  価格: <strong style={{ color: '#fff' }}>{matchedGame.salePrice}</strong>
                  {matchedGame.discountRate && (
                    <strong style={{ color: '#39ff14', marginLeft: '0.4rem' }}>({matchedGame.discountRate}% OFF)</strong>
                  )}
                </div>
                {matchedGame.reviewScoreDesc && (
                  <div style={{ color: '#818cf8', fontSize: '0.65rem', marginTop: '0.15rem' }}>
                    評価: {matchedGame.reviewScoreDesc} ({matchedGame.reviewPercent}%)
                  </div>
                )}
                <div style={{ color: '#94a3b8', marginTop: '0.4rem', fontSize: '0.65rem' }}>
                  ※クリックでゲームセールナビへ移動します
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* シリーズ全体の件数バッジ */}
        {books.length > 1 && (
          <span className="series-count-badge">シリーズ他 {books.length - 1} 冊</span>
        )}

        <h3 className="book-title" title={currentBook.title}>
          {currentBook.title}
        </h3>
        
        {/* シリーズ既読進捗バー */}
        {books.length > 1 && mounted && (
          <div className="read-progress-container" style={{ margin: '0.6rem 0', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              <span>📖 シリーズ既読進捗:</span>
              <span>{readCount} / {books.length} 巻 ({Math.round((readCount / books.length) * 100)}%)</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${(readCount / books.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #39ff14 0%, #00f2fe 100%)', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}
        <p className="book-author">{currentBook.author}</p>

        {/* シリーズ巻数切り替えUI (複数巻ある場合のみ表示) */}
        {books.length > 1 && (
          <div className="series-volumes-container">
            <span className="series-volumes-label">巻・タイトル選択 ( ↗ で直接ストアへ ):</span>
            <div className="volume-badge-list">
              {books.map((b, index) => {
                const isActive = b.id === currentBook.id;
                const label = getVolumeLabel(b.title, index);
                
                // 代表ストア（最初に定義されているストア）のURLを直行リンクにする
                const firstStoreKey = Object.keys(b.stores)[0];
                const directUrl = b.stores[firstStoreKey]?.url || '#';

                return (
                  <div key={b.id} className="volume-badge-wrapper">
                    <button
                      onClick={() => {
                        setCurrentBook(b);
                        // 巻が切り替わったらアコーディオンは閉じる
                        setIsExpanded(false);
                      }}
                      className={`volume-badge ${isActive ? 'active' : ''}`}
                      title={`${b.title} に切り替え`}
                    >
                      {label}
                    </button>
                    <a
                      href={directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="volume-direct-link"
                      title="直接ストアで開く"
                    >
                      ↗
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 価格表示 */}
        <div className="price-container">
          {bestDeal.salePrice === 0 ? (
            <span className="sale-price free">無料公開中</span>
          ) : (
            <span className="sale-price">¥{bestDeal.salePrice.toLocaleString()}</span>
          )}
          {bestDeal.originalPrice > 0 && bestDeal.salePrice !== bestDeal.originalPrice && (
            <span className="original-price">¥{bestDeal.originalPrice.toLocaleString()}</span>
          )}
        </div>

        {/* 無料連載向け：無料エピソードの直接リンクと更新スケジュール */}
        {currentBook.category === 'free_serialization' && (
          <div className="free-serialization-details" style={{ margin: '0.8rem 0' }}>
            {/* エピソードリンク一覧 */}
            {currentBook.freeEpisodes && currentBook.freeEpisodes.length > 0 && (
              <div className="free-episodes-container" style={{ marginBottom: '0.6rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.3rem' }}>
                  📖 無料公開中のエピソード（直接読めます）：
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {currentBook.freeEpisodes.map((ep, idx) => (
                    <a
                      key={idx}
                      href={ep.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none' }}
                    >
                      <button
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.25rem 0.6rem',
                          borderRadius: '4px',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          background: 'rgba(16, 185, 129, 0.08)',
                          color: '#10b981',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        className="free-episode-btn"
                        id={`free-ep-btn-${currentBook.id}-${idx}`}
                      >
                        {ep.title} ↗
                      </button>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 公開日・次回更新日 */}
            {(currentBook.latestPubDate || currentBook.nextUpdateDate) && (
              <div className="update-schedule-container" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                padding: '0.5rem 0.7rem',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '0.68rem',
                color: 'var(--text-secondary)'
              }}>
                {currentBook.latestPubDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.8rem' }}>📅</span>
                    <span>公開日: <strong>{formatDisplayDate(currentBook.latestPubDate)}</strong></span>
                  </div>
                )}
                {currentBook.nextUpdateDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.8rem' }}>🔄</span>
                    <span>次回更新予定: <strong>{formatDisplayDateWithDay(currentBook.nextUpdateDate)}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* あらすじ */}
        <div className="description-wrapper">
          <p 
            ref={descriptionRef}
            className={`book-description ${isExpanded ? 'expanded' : ''}`}
          >
            {currentBook.description}
          </p>
          {showReadMore && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="read-more-btn"
              id={`read-more-btn-${currentBook.id}`}
            >
              {isExpanded ? '閉じる ▲' : '続きを読む ▼'}
            </button>
          )}
        </div>

        {/* シェア＆コピーボタン */}
        <div className="share-actions-row" style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem', marginBottom: '0.8rem' }}>
          <button 
            onClick={handleCopyUrl}
            className="action-btn copy-btn"
            style={{
              flex: 1,
              padding: '0.45rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
              transition: 'all 0.2s'
            }}
            id={`btn-copy-${currentBook.id}`}
          >
            <span>🔗</span> {copied ? 'コピー完了！' : 'ストアURLコピー'}
          </button>
          <button 
            onClick={handleShareX}
            className="action-btn share-btn"
            style={{
              flex: 1,
              padding: '0.45rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: '#1d9bf0',
              border: 'none',
              color: '#ffffff',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
              transition: 'all 0.2s'
            }}
            id={`btn-share-${currentBook.id}`}
          >
            <span>𝕏</span> シェアする
          </button>
        </div>

        {/* 下部メタ情報 */}
        <div className="book-meta">
          <span>対象ストア: {Object.keys(currentBook.stores).map(k => getStoreInfo(k).name).join(', ')}</span>
          {mounted && remainingDaysText && (
            <span className={`end-date ${diffDaysVal !== null && diffDaysVal <= 3 && diffDaysVal >= 0 ? 'urgent' : ''}`}>
              {diffDaysVal !== null && diffDaysVal <= 3 && diffDaysVal >= 0 ? '⚠️ ' : ''}{remainingDaysText}
            </span>
          )}
        </div>

        {/* 電子ストア別の価格比較・リンクエリア */}
        <div className="store-compare-container" style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontWeight: 700 }}>
            <span>各電子ストアで読む・比較:</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {Object.entries(currentBook.stores).map(([storeKey, deal]) => {
              if (!deal) return null;
              const info = getStoreInfo(storeKey);

              return (
                <a key={storeKey} href={deal.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <button 
                    className={`card-button ${info.btnClass}`} 
                    style={{ 
                      width: '100%', 
                      padding: '0.55rem 0.75rem', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      margin: 0,
                      cursor: 'pointer'
                    }}
                    id={`btn-store-${storeKey}-${currentBook.id}`}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', lineHeight: '1.2' }}>
                      <span>{info.name} で{info.action}</span>
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textAlign: 'right', display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                      <span>{deal.salePrice === 0 ? '無料' : `¥${deal.salePrice.toLocaleString()}`} ↗</span>
                    </span>
                  </button>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}
