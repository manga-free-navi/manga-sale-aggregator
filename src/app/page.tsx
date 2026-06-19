'use client';

import { useState, useMemo } from 'react';
// 自動収集データと、手動割り込みデータを両方インポートして結合します
import initialBooks from '../data/sales.json';
import manualBooks from '../data/manual_sales.json';
import BookCard, { Book } from '../components/BookCard';
import FilterBar from '../components/FilterBar';
import AdContainer from '../components/AdContainer';

export default function Home() {
  // 自動データと手動キャンペーンデータを結合 (ハイドレーション不一致を防ぐため useMemo を使用)
  const books = useMemo(() => {
    const autoList = (initialBooks || []) as Book[];
    const manualList = (manualBooks || []) as Book[];
    return [...manualList, ...autoList]; // 手動割り込みデータを優先して上に表示させるため、先に結合します
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [sortBy, setSortBy] = useState('discountDesc');

  // 動的ジャンル一覧の抽出
  const genres = useMemo(() => {
    const allGenres = books.map((b) => b.genre).filter(Boolean);
    return Array.from(new Set(allGenres)).sort();
  }, [books]);

  // 検索・フィルタリング・ソートの適用
  const filteredAndSortedBooks = useMemo(() => {
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

    // 3. 並び替え (安定ソートを保証するため、同一条件時は ID で順序を決定します)
    result.sort((a, b) => {
      // 手動キャンペーンID（jumpplusなど）を常に最上部に固定したい場合のルール
      const isAManual = a.id.startsWith('manual-');
      const isBManual = b.id.startsWith('manual-');
      if (isAManual && !isBManual) return -1;
      if (!isAManual && isBManual) return 1;

      if (sortBy === 'discountDesc') {
        // 割引率の高い順
        if (b.discountRate !== a.discountRate) {
          return b.discountRate - a.discountRate;
        }
        // 割引率が同じ場合、IDのアルファベット順で順番を固定 (ミスマッチクラッシュ防止)
        return a.id.localeCompare(b.id);
      }
      if (sortBy === 'priceAsc') {
        // 価格の安い順
        if (a.salePrice !== b.salePrice) {
          return a.salePrice - b.salePrice;
        }
        return a.id.localeCompare(b.id);
      }
      if (sortBy === 'endDateAsc') {
        // 終了日が近い順 (nullは後ろへ)
        if (!a.endDate && b.endDate) return 1;
        if (a.endDate && !b.endDate) return -1;
        if (!a.endDate && !b.endDate) return a.id.localeCompare(b.id);
        
        const timeA = new Date(a.endDate!).getTime();
        const timeB = new Date(b.endDate!).getTime();
        if (timeA !== timeB) {
          return timeA - timeB;
        }
        return a.id.localeCompare(b.id);
      }
      if (sortBy === 'newest') {
        // データ更新順
        const timeA = new Date(a.updatedAt).getTime();
        const timeB = new Date(b.updatedAt).getTime();
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return a.id.localeCompare(b.id);
      }
      return a.id.localeCompare(b.id);
    });

    return result;
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
          {filteredAndSortedBooks.length === 0 ? (
            <div className="empty-state">
              <h3>対象の漫画が見つかりませんでした</h3>
              <p>検索キーワードやフィルタ条件を変えてお試しください。</p>
            </div>
          ) : (
            <div className="book-grid">
              {filteredAndSortedBooks.map((book, index) => {
                // 3番目のカードの後にインライン広告を挟み込む（AdSense収益化用）
                const insertAd = index === 2;
                return (
                  <div key={book.id} style={{ display: 'contents' }}>
                    <BookCard book={book} />
                    {insertAd && (
                      <AdContainer slot="inline-ad-slot-1" type="inline" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右側：サイドバー領域（AdSense広告などの掲載エリア） */}
        <aside>
          <AdContainer slot="sidebar-ad-slot-1" type="sidebar" />
          
          {/* お役立ち情報等のエリア (SEO/AdSense対策用テキストコンテンツ) */}
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
