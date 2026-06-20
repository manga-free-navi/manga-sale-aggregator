'use client';

import { useEffect, useState } from 'react';

interface AdContainerProps {
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  layoutKey?: string;
  type?: 'sidebar' | 'inline';
}

// アドブロック検知結果のキャッシュ用変数（モジュールレベル）
let isAdBlockDetectedCached: boolean | null = null;

/**
 * Google AdSenseおよびアフィリエイトバナー用広告コンポーネント（アドブロック自動回避・回遊バナー対応版）
 */
export default function AdContainer({
  slot,
  format = 'auto',
  layoutKey,
  type = 'inline',
}: AdContainerProps) {
  const [adLoaded, setAdLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAdBlocked, setIsAdBlocked] = useState(false);
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '';

  useEffect(() => {
    setMounted(true);

    // アドブロック検知ロジック
    const checkAdBlock = () => {
      if (isAdBlockDetectedCached !== null) {
        setIsAdBlocked(isAdBlockDetectedCached);
        return;
      }

      // ダミー要素をDOMに配置してスタイルの非表示化をチェック
      const dummy = document.createElement('div');
      dummy.id = 'ad-placement-zone';
      dummy.className = 'adsbygoogle adsbox ad-placement ad-content advertisement';
      
      // positionと座標のみ設定し、displayやsizeのインラインスタイルは指定しない（アドブロッカーの display: none !important を有効化）
      dummy.style.position = 'absolute';
      dummy.style.left = '-9999px';
      dummy.style.top = '-9999px';
      dummy.style.width = '10px';
      dummy.style.height = '10px';
      
      document.body.appendChild(dummy);

      // 反応時間を300msに延長し、アドブロッカーによるスタイル適用時間を確保
      window.setTimeout(() => {
        try {
          const styles = window.getComputedStyle(dummy);
          const isBlocked = styles.display === 'none' || 
                            styles.visibility === 'hidden' || 
                            dummy.offsetHeight === 0;
          
          if (dummy.parentNode) {
            dummy.parentNode.removeChild(dummy);
          }
          
          isAdBlockDetectedCached = isBlocked;
          setIsAdBlocked(isBlocked);
        } catch (e) {
          isAdBlockDetectedCached = true;
          setIsAdBlocked(true);
        }
      }, 300);
    };

    checkAdBlock();
  }, []);

  useEffect(() => {
    // アドブロック検知時はAdSenseのロードをスキップ
    if (isAdBlocked) return;

    // 開発中またはAdSense IDが未設定の場合は何もしない
    if (!adsenseClient || adsenseClient === 'ca-pub-XXXXXXXXXXXXXXXX') {
      return;
    }

    // すでにスクリプトがロードされているか確認
    const existingScript = document.getElementById('google-adsense-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-adsense-script';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    try {
      // AdSenseの初期化スクリプトを実行
      const adsbygoogle = (window as any).adsbygoogle || [];
      adsbygoogle.push({});
      setAdLoaded(true);
    } catch (err) {
      console.error('AdSenseの読み込みエラー:', err);
    }
  }, [adsenseClient, isAdBlocked]);

  const wrapperClass = type === 'sidebar' ? 'ad-wrapper sidebar-ad' : 'ad-wrapper inline-ad';

  // ハイドレーションミスマッチを防ぐため、マウントされるまではサーバー側と同じ静的ラッパーのみを返す
  if (!mounted) {
    return (
      <div className={wrapperClass}>
        <span className="ad-label">Sponsor / 広告</span>
        <div className="ad-placeholder" style={{ minHeight: type === 'sidebar' ? '220px' : '100px' }} />
      </div>
    );
  }

  // アドブロックが検知された場合の代替表示（プレミアム回遊バナー）
  if (isAdBlocked) {
    return (
      <div className="promo-banner-card" id={`promo-banner-${slot}`}>
        <div className="promo-banner-glow" />
        <div className="promo-banner-inner">
          <div className="promo-header">
            <span className="promo-badge">RECOMMEND</span>
            <h3 className="promo-title">姉妹サイトも毎日更新中！</h3>
          </div>
          <p className="promo-desc">
            広告ブロッカーをご利用中の皆様へ。当サイトの姉妹サイト「ゲームセール」と「無料アニメ」情報ナビも、ぜひ合わせてお楽しみください！
          </p>
          <div className="promo-actions">
            <a
              href="https://manga-free-navi.github.io/game-sale-aggregator/"
              className="promo-btn game-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="btn-icon">🎮</span>
              <span className="btn-text">ゲームセールナビ</span>
            </a>
            <a
              href="https://manga-free-navi.github.io/youtube-free-anime-aggregator/"
              className="promo-btn anime-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="btn-icon">📺</span>
              <span className="btn-text">無料アニメ配信ナビ</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  const isDummyClient = !adsenseClient || adsenseClient === 'ca-pub-XXXXXXXXXXXXXXXX';

  return (
    <div className={wrapperClass}>
      <span className="ad-label">Sponsor / 広告</span>
      {isDummyClient ? (
        <div className="ad-placeholder" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px 0', minHeight: type === 'sidebar' ? '250px' : '100px' }}>
          {/* バリューコマース アフィリエイトバナー広告 */}
          <a
            href="https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3773863&pid=892640994"
            rel="nofollow"
            target="_blank"
            style={{ display: 'block', maxWidth: '100%', overflow: 'hidden' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3773863&pid=892640994"
              alt="Sponsor Ad"
              onError={() => {
                // 万が一DOM検知をすり抜けてブロックされた場合、エラー発生時に検知して自己修復（回遊バナーへ切り替え）
                console.log('Ad-block detected via image load failure. Switching to promo banner.');
                isAdBlockDetectedCached = true;
                setIsAdBlocked(true);
              }}
              style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
            />
          </a>
        </div>
      ) : (
        <ins
          className="adsbygoogle"
          style={{ display: 'block', overflow: 'hidden' }}
          data-ad-client={adsenseClient}
          data-ad-slot={slot}
          data-ad-format={format}
          {...(layoutKey ? { 'data-ad-layout-key': layoutKey } : {})}
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
}
