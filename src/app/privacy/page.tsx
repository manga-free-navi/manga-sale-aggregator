'use client';

import dynamic from 'next/dynamic';

// サーバーとクライアントのハイドレーション不一致を物理的に防ぐため、
// プライバシーポリシーのコンテンツを ssr: false (クライアント専用) で動的インポートします。
const PrivacyContent = dynamic(() => import('../../components/PrivacyContent'), {
  ssr: false,
  loading: () => (
    <div
      className="container"
      style={{
        padding: '100px 20px',
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0f19',
        color: '#f8fafc',
      }}
    >
      <p style={{ color: '#94a3b8' }}>ページを読み込み中...</p>
    </div>
  ),
});

export default function PrivacyPolicy() {
  return <PrivacyContent />;
}
