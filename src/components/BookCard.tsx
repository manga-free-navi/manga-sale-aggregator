'use client';

import { useMemo, useState, useEffect, useRef } from 'react';

export interface Book {
  id: string;
  title: string;
  author: string;
  publisher: string;
  imageUrl: string;
  store: string;
  originalPrice: number;
  salePrice: number;
  discountRate: number;
  url: string;
  genre: string;
  endDate: string | null;
  description: string;
  updatedAt: string;
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
 * シリーズごとにまとめた漫画カードコンポーネント
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

  useEffect(() => {
    setMounted(true);
  }, []);

  // books の中身が変わった場合（検索やフィルタの再実行時など）に選択中の巻をリセット
  useEffect(() => {
    if (books.length > 0) {
      setCurrentBook(books[0]);
    }
  }, [books]);

  // あらすじが実際にはみ出している（3行を超えている）かを検知する
  useEffect(() => {
    const checkOverflow = () => {
      const el = descriptionRef.current;
      if (el) {
        // 非展開時のスクロール高さと表示高さを比較
        const hasOverflow = el.scrollHeight > el.clientHeight;
        setShowReadMore(hasOverflow);
      }
    };

    // 初期チェックと、レンダリングラグを考慮した遅延チェック
    checkOverflow();
    const timer = setTimeout(checkOverflow, 100);
    
    return () => clearTimeout(timer);
  }, [currentBook]);

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

  // ストア情報の動的判定
  const storeInfo = useMemo(() => {
    switch (currentBook.store) {
      case 'amazon':
        return { name: 'Kindle', btnClass: 'btn-kindle', action: '買う・読む' };
      case 'rakuten':
        return { name: '楽天Kobo', btnClass: 'btn-kobo', action: '買う・読む' };
      case 'seimor':
        return { name: 'シーモア', btnClass: 'btn-seimor', action: '読む' };
      case 'jumpplus':
        return { name: 'ジャンプ+', btnClass: 'btn-jumpplus', action: '無料で読む' };
      case 'magapoke':
        return { name: 'マガポケ', btnClass: 'btn-magapoke', action: '無料で読む' };
      case 'sundaywebry':
        return { name: 'サンデーうぇぶり', btnClass: 'btn-sundaywebry', action: '無料で読む' };
      case 'mangaone':
        return { name: 'マンガワン', btnClass: 'btn-mangaone', action: '無料で読む' };
      case 'yanjan':
        return { name: 'ヤンジャン！', btnClass: 'btn-yanjan', action: '無料で読む' };
      case 'zebrack':
        return { name: 'ゼブラック', btnClass: 'btn-zebrack', action: '無料で読む' };
      case 'piccoma':
        return { name: 'ピッコマ', btnClass: 'btn-piccoma', action: '無料で読む' };
      case 'linemanga':
        return { name: 'LINEマンガ', btnClass: 'btn-linemanga', action: '無料で読む' };
      default:
        return { name: 'ストア', btnClass: '', action: '詳細を見る' };
    }
  }, [currentBook.store]);

  return (
    <article className="book-card">
      {/* 割引率・無料バッジ (選択中の巻に基づく) */}
      <div className="discount-tag">
        {currentBook.discountRate === 100 ? '無料公開' : `${currentBook.discountRate}% OFF`}
      </div>

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
            <span className="series-volumes-label">巻・タイトル選択 ( ↗ で直接ストアへ進む ):</span>
            <div className="volume-badge-list">
              {books.map((b, index) => {
                const isActive = b.id === currentBook.id;
                const label = getVolumeLabel(b.title, index);
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
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="volume-direct-link"
                      title={`${b.title} を直接ストアで開く`}
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
          {currentBook.salePrice === 0 ? (
            <span className="sale-price free">無料公開中</span>
          ) : (
            <span className="sale-price">¥{currentBook.salePrice.toLocaleString()}</span>
          )}
          {currentBook.originalPrice > 0 && currentBook.salePrice !== currentBook.originalPrice && (
            <span className="original-price">¥{currentBook.originalPrice.toLocaleString()}</span>
          )}
        </div>

        {/* あらすじ・キャンペーン説明 (アコーディオン開閉対応) */}
        <div className="description-wrapper">
          <p 
            ref={descriptionRef}
            className={`book-description ${isExpanded ? 'expanded' : ''}`}
            title={isExpanded ? undefined : currentBook.description}
          >
            {currentBook.description}
          </p>
          {showReadMore && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="read-more-btn"
            >
              {isExpanded ? '閉じる ▲' : '続きを読む ▼'}
            </button>
          )}
        </div>

        {/* 下部メタ情報 */}
        <div className="book-meta">
          <span>{storeInfo.name}</span>
          {mounted && remainingDaysText && (
            <span className="end-date">{remainingDaysText}</span>
          )}
        </div>

        {/* アクションボタン */}
        <a href={currentBook.url} target="_blank" rel="noopener noreferrer">
          <button className={`card-button ${storeInfo.btnClass}`}>
            <span style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '230px' }}>
              {currentBook.title.replace(/^\[[^\]]+\]/, '').replace(/^【[^】]+】/, '')} を {storeInfo.name} で{storeInfo.action}
            </span>
            <span style={{ fontSize: '0.8rem' }}>↗</span>
          </button>
        </a>
      </div>
    </article>
  );
}
