import type { Metadata } from 'next';
import Script from 'next/script';
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
          // デバッグコンソールを表示するための共通関数
          function showDebugBanner(htmlContent) {
            var div = document.getElementById('debug-error-console');
            if (!div) {
              div = document.createElement('div');
              div.id = 'debug-error-console';
              div.style.position = 'fixed';
              div.style.bottom = '10px';
              div.style.left = '10px';
              div.style.right = '10px';
              div.style.background = 'rgba(17, 24, 39, 0.95)';
              div.style.color = '#fff';
              div.style.padding = '15px';
              div.style.borderRadius = '8px';
              div.style.zIndex = '999999';
              div.style.fontSize = '12px';
              div.style.fontFamily = 'monospace';
              div.style.maxHeight = '250px';
              div.style.overflowY = 'auto';
              div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
              div.style.border = '1px solid #ef4444';
              document.body.appendChild(div);
            }
            div.innerHTML += htmlContent;
          }

          window.addEventListener('error', function(e) {
            // アセット（画像やスタイルシート）のロードエラーは message が存在しないため無視
            if (!e.message) return;

            showDebugBanner('<div style="margin-bottom: 5px; color: #fecaca;">⚠️ Runtime Error: ' + e.message + ' at ' + (e.filename || 'unknown') + ':' + (e.lineno || '0') + '</div>');

            if (e.message.indexOf('ChunkLoadError') !== -1 || e.message.indexOf('Loading chunk') !== -1) {
              var now = Date.now();
              var lastReload = sessionStorage.getItem('last_chunk_error_reload');
              if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
                sessionStorage.setItem('last_chunk_error_reload', now.toString());
                console.warn('ChunkLoadErrorを検知しました。リロードします...');
                window.location.reload();
              }
            }
          }, true);

          window.addEventListener('unhandledrejection', function(e) {
            var msg = e.reason ? (e.reason.message || String(e.reason)) : 'Promise Rejection';
            var stack = e.reason && e.reason.stack ? e.reason.stack : '';
            var html = '<div style="margin-bottom: 5px; color: #fde047;">⚠️ Promise Error: ' + msg + '</div>';
            if (stack) {
              html += '<pre style="margin: 5px 0 10px 10px; font-size: 10px; color: #d1d5db; white-space: pre-wrap; background: #1f2937; padding: 5px; border-radius: 4px;">' + stack.substring(0, 300) + '</pre>';
            }
            showDebugBanner(html);
          });
        `}} />
        <link rel="manifest" href="manifest.json" />
        <link rel="apple-touch-icon" href="icon.svg" />
        <meta name="theme-color" content="#f97316" />
        
        {/* Google Analytics は body 直後に Next.js Script として配置 */}

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
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
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
