'use client';

import { useMemo, useState, useEffect, useRef } from 'react';

export interface StoreDeal {
  url: string;
  originalPrice: number;
  salePrice: number;
  discountRate: number;
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
  stores: {
    rakuten?: StoreDeal;
    seimor?: StoreDeal;
    amazon?: StoreDeal;
    [key: string]: StoreDeal | undefined;
  };
}

interface BookCardProps {
  books: Book[]; // シリーズに属する本の配列
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
export default function BookCard({ books }: BookCardProps) {
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // books の中身が変わった場合（検索やフィルタの再実行時など）に選択中の巻をリセット
  useEffect(() => {
    if (books.length > 0) {
      setCurrentBook(books[0]);
    }
  }, [books]);

  // localStorage から既読ステートを取得
  useEffect(() => {
    if (mounted) {
      const readList = JSON.parse(localStorage.getItem('manga_read_list') || '[]');
      setIsRead(readList.includes(currentBook.id));
    }
  }, [currentBook.id, mounted]);

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
    setIsRead(!isRead);
    
    // MainAppコンポーネントに既読状態が更新されたことを通知するイベントを発火
    window.dispatchEvent(new Event('readListUpdated'));
  };

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
      case 'prtimes':
        return { name: '公式サイト(PR TIMES)', btnClass: 'btn-prtimes', action: '詳細を見る' };
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
      {/* 割引率・無料バッジ */}
      <div className="discount-tag">
        {bestDeal.discountRate === 100 ? '無料公開' : `${bestDeal.discountRate}% OFF`}
      </div>

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
        
        {/* シリーズ全体の件数バッジ */}
        {books.length > 1 && (
          <span className="series-count-badge">シリーズ他 {books.length - 1} 冊</span>
        )}

        <h3 className="book-title" title={currentBook.title}>
          {currentBook.title}
        </h3>
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
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 700 }}>各電子ストアで読む・比較:</div>
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
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                      {info.name} で{info.action}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      {deal.salePrice === 0 ? '無料' : `¥${deal.salePrice.toLocaleString()}`} ↗
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
