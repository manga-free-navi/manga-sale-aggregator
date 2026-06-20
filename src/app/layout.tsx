import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '無料 漫画・激安セール漫画ナビ | 期間限定無料コミック・セール情報を毎日更新',
  description: '【毎日自動更新】「無料 漫画」や「無料コミック」、とんでもない割引率（50%〜100%OFF）の激安セールコミック情報をリアルタイムで自動集約。Kindle・楽天Kobo・コミックシーモアなど主要電子書籍ストアの期間限定無料作品を網羅。',
  keywords: '無料 漫画, 無料 漫画 おすすめ, 無料コミック, 漫画セール, 電子書籍, Kindleセール, 楽天Kobo, コミックシーモア, 公式サイト(PR TIMES)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_MANGA_SITE_URL || 'https://manga-free-navi.github.io/manga-sale-aggregator/';

  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: `
          window.addEventListener('error', function(e) {
            if (e.message && (e.message.indexOf('ChunkLoadError') !== -1 || e.message.indexOf('Loading chunk') !== -1)) {
              var now = Date.now();
              var lastReload = sessionStorage.getItem('last_chunk_error_reload');
              // 10秒以内の連続リロードを防ぐ（無限ループ防止ガード）
              if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
                sessionStorage.setItem('last_chunk_error_reload', now.toString());
                console.warn('ChunkLoadErrorを検知しました。最新のアセットを取得するためページをリロードします...');
                window.location.reload();
              } else {
                console.error('短時間に繰り返しChunkLoadErrorが発生したため、無限リロードを防ぐためにリロードを停止しました。');
              }
            }
          }, true);
        `}} />
        <link rel="manifest" href="manifest.json" />
        <link rel="apple-touch-icon" href="icon.svg" />
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

        {/* SEO用構造化データ (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "無料 漫画・激安セール漫画ナビ",
              "url": siteUrl,
              "description": "主要電子書籍ストアの期間限定無料漫画や激安セールコミック情報をリアルタイムで自動集約。",
              "inLanguage": "ja",
              "publisher": {
                "@type": "Organization",
                "name": "無料 漫画・激安セール漫画ナビ 運営チーム"
              }
            })
          }}
        />
      </head>

      <body>
        <script dangerouslySetInnerHTML={{__html: `
          // キャッシュ干渉によるエラーを防ぐため、古いService Workerを強制解除する
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
              for (var i = 0; i < registrations.length; i++) {
                registrations[i].unregister().then(function(success) {
                  if (success) {
                    console.log('古いService Workerの登録を解除しました。');
                  }
                });
              }
            }).catch(function(err) {
              console.error('Service Workerの登録解除に失敗しました:', err);
            });
          }
        `}} />
        {/* ヘッダー領域 */}
        <header className="header">
          <div className="container header-container">
            <div className="logo">
              <span>無料 漫画 ＆ セールナビ</span>
            </div>


            {/* サイト切り替えタブ */}
            <div className="header-tabs">
              <a 
                href={process.env.NEXT_PUBLIC_ANIME_SITE_URL || "https://manga-free-navi.github.io/youtube-free-anime-aggregator/"} 
                className="header-tab"
                id="tab-to-anime"
              >
                <span>📺 無料アニメ</span>
              </a>
              <a href={siteUrl} className="header-tab active">
                <span>📚 漫画セール</span>
              </a>
              <a 
                href={process.env.NEXT_PUBLIC_GAME_SITE_URL || "https://manga-free-navi.github.io/game-sale-aggregator/"} 
                className="header-tab"
                id="tab-to-game"
              >
                <span>🎮 ゲームセール</span>
              </a>
            </div>

            <nav className="nav-links">
              <a href={siteUrl} className="nav-link active">ホーム</a>
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
