'use client';

interface FilterBarProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  selectedGenre: string;
  setSelectedGenre: (val: string) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  genres: string[];
  hideSingleVolumeFree: boolean;
  setHideSingleVolumeFree: (val: boolean) => void;
}

/**
 * 検索・フィルタリング・ソートを行うためのコントロールバー
 */
export default function FilterBar({
  searchTerm,
  setSearchTerm,
  selectedGenre,
  setSelectedGenre,
  sortBy,
  setSortBy,
  genres,
  hideSingleVolumeFree,
  setHideSingleVolumeFree,
}: FilterBarProps) {
  return (
    <div className="filter-container">
      <div className="filter-grid">
        {/* キーワード検索 */}
        <div className="input-group">
          <label className="input-label" htmlFor="search">キーワード検索</label>
          <input
            id="search"
            type="text"
            className="search-input"
            placeholder="タイトル、著者名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* ジャンル絞り込み */}
        <div className="input-group">
          <label className="input-label" htmlFor="genre">ジャンル</label>
          <select
            id="genre"
            className="select-input"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
          >
            <option value="all">すべてのジャンル</option>
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>

        {/* 並び替え */}
        <div className="input-group">
          <label className="input-label" htmlFor="sort">並び替え</label>
          <select
            id="sort"
            className="select-input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="discountDesc">割引率の高い順</option>
            <option value="priceAsc">価格の安い順</option>
            <option value="endDateAsc">終了期日が近い順</option>
            <option value="newest">更新順</option>
          </select>
        </div>

        {/* 1巻のみ無料を非表示 */}
        <div className="input-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.4rem', marginTop: '1.4rem' }}>
          <input
            id="hide-single-free"
            type="checkbox"
            checked={hideSingleVolumeFree}
            onChange={(e) => setHideSingleVolumeFree(e.target.checked)}
            style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
          />
          <label className="input-label" htmlFor="hide-single-free" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
            1巻のみ無料を除外
          </label>
        </div>
      </div>
    </div>
  );
}
