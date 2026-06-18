'use client';

import { useMemo } from 'react';

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
  book: Book;
}

/**
 * 各漫画セール・無料キャンペーン情報を表示するカードコンポーネント
 */
export default function BookCard({ book }: BookCardProps) {
  // セール終了までの残り日数を計算
  const remainingDaysText = useMemo(() => {
    if (!book.endDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const end = new Date(book.endDate);
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
    
    return `${book.endDate} まで`;
  }, [book.endDate]);

  // ストア情報（表示名、ボタン用クラス、アクションテキスト）の動的判定
  const storeInfo = useMemo(() => {
    switch (book.store) {
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
  }, [book.store]);

  // アプリ系ストア（アフィリエイト非対応・送客メイン）かどうか
  const isAppStore = useMemo(() => {
    const appStores = ['jumpplus', 'magapoke', 'sundaywebry', 'mangaone', 'yanjan', 'zebrack', 'piccoma', 'linemanga'];
    return appStores.includes(book.store);
  }, [book.store]);

  return (
    <article className="book-card">
      {/* 割引率・無料バッジ */}
      <div className="discount-tag">
        {book.discountRate === 100 ? '無料公開' : `${book.discountRate}% OFF`}
      </div>

      {/* 表紙画像 */}
      <div className="card-image-wrapper">
        {book.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.imageUrl}
            alt={`${book.title}の表紙`}
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
        <span className="book-genre">{book.genre}</span>
        <h3 className="book-title" title={book.title}>
          {book.title}
        </h3>
        <p className="book-author">{book.author}</p>

        {/* 価格表示 (アプリ無料キャンペーンの場合は0円表記) */}
        <div className="price-container">
          {book.salePrice === 0 ? (
            <span className="sale-price free">無料公開中</span>
          ) : (
            <span className="sale-price">¥{book.salePrice.toLocaleString()}</span>
          )}
          {book.originalPrice > 0 && book.salePrice !== book.originalPrice && (
            <span className="original-price">¥{book.originalPrice.toLocaleString()}</span>
          )}
        </div>

        {/* あらすじ・キャンペーン説明 */}
        <p className="book-description" title={book.description}>
          {book.description}
        </p>

        {/* 下部メタ情報 (掲載ストア・終了期限など) */}
        <div className="book-meta">
          <span>{storeInfo.name}</span>
          {remainingDaysText && (
            <span className="end-date">{remainingDaysText}</span>
          )}
        </div>

        {/* アクションボタン */}
        <a href={book.url} target="_blank" rel="noopener noreferrer">
          <button className={`card-button ${storeInfo.btnClass}`}>
            <span>{storeInfo.name} で{storeInfo.action}</span>
            <span style={{ fontSize: '0.8rem' }}>↗</span>
          </button>
        </a>
      </div>
    </article>
  );
}
