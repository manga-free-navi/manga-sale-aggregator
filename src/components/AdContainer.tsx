'use client';

import { useEffect, useState } from 'react';

interface AdContainerProps {
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  layoutKey?: string;
  type?: 'sidebar' | 'inline';
}

/**
 * Google AdSense用の広告コンポーネント
 * 広告コードがロードされるまでは、美しいプレースホルダーを表示してレイアウトシフトを防ぎます。
 * ハイドレーションミスマッチを防ぐため、マウントされるまでは静的なコンテナ枠のみを描画します。
 */
export default function AdContainer({
  slot,
  format = 'auto',
  layoutKey,
  type = 'inline',
}: AdContainerProps) {
  const [adLoaded, setAdLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '';

  useEffect(() => {
    setMounted(true);

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
  }, [adsenseClient]);

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

  // クライアントIDが未設定、またはダミーの場合は開発者用プレースホルダーを表示
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
