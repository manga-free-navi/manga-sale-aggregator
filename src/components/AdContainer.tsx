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
        <div className="ad-placeholder">
          {type === 'sidebar' ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ fontWeight: 'bold' }}>広告掲載エリア (300×250)</p>
              <p style={{ fontSize: '0.75rem', marginTop: '8px', color: 'var(--text-secondary)' }}>
                Google AdSenseの準備が整うとここにサイドバー広告が表示されます。
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px' }}>
              <p style={{ fontWeight: 'bold' }}>広告掲載エリア (インフィード/レスポンシブ)</p>
              <p style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-secondary)' }}>
                記事一覧の間に広告が挿入されます。
              </p>
            </div>
          )}
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
