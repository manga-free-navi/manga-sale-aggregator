import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '無料＆激安セール漫画ナビ | 期間限定無料コミック・割引セール情報を自動集約',
  description: 'Kindleや楽天Kobo、コミックシーモアなど主要電子書籍ストアの期間限定無料漫画や、とんでもない割引率（50%〜100%OFF）のセール対象コミック情報をリアルタイムで自動集約。おトクに漫画を読むための特化ナビサイト。',
  keywords: '無料漫画, 漫画セール, 電子書籍, Kindleセール, 楽天Kobo, コミックシーモア, アフィリエイト',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="theme-color" content="#f97316" />
        
        {/* Google Analytics (GA4) */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`} />
            <script dangerouslySetInnerHTML={{__html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
            `}} />
          </>
        )}
      </head>

      <body>
        <script dangerouslySetInnerHTML={{__html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(reg) {
                console.log('SW registered:', reg.scope);
              }).catch(function(err) {
                console.error('SW registration failed:', err);
              });
            });
          }
        `}} />
        {/* ヘッダー領域 */}
        <header className="header">
          <div className="container header-container">
            <div className="logo">
              <span>無料＆激安セール漫画ナビ</span>
            </div>

            {/* サイト切り替えタブ */}
            <div className="header-tabs">
              <a 
                href={process.env.NEXT_PUBLIC_ANIME_SITE_URL || "../youtube-free-anime-aggregator/out/index.html"} 
                className="header-tab"
                id="tab-to-anime"
              >
                <span>📺 無料アニメ</span>
              </a>
              <a href="#" className="header-tab active">
                <span>📚 漫画セール</span>
              </a>
              <a 
                href={process.env.NEXT_PUBLIC_GAME_SITE_URL || "../game-sale-aggregator/out/index.html"} 
                className="header-tab"
                id="tab-to-game"
              >
                <span>🎮 ゲームセール</span>
              </a>
            </div>

            <nav className="nav-links">
              <a href="/" className="nav-link active">ホーム</a>
              <a href="#about" className="nav-link">サイトについて</a>
            </nav>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main>{children}</main>

        {/* フッター領域 */}
        <footer className="footer" id="about">
          <div className="container">
            <div className="footer-logo">無料＆激安セール漫画ナビ</div>
            
            {/* プライバシーポリシーページへのリンクを追加 (AdSense審査通過対策) */}
            <p style={{ marginBottom: '15px' }}>
              <a href="/privacy" className="nav-link" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                プライバシーポリシー・免責事項
              </a>
            </p>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
              当サイトは、各電子書籍ストア公式API等のデータを元に、お得なセール情報をお届けしています。<br />
              アフィリエイトリンクおよびGoogle AdSenseによる広告表示を導入し、運営・維持を行っております。
            </p>
            <p>© 2026 無料＆激安セール漫画ナビ. All Rights Reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
