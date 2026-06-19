'use client';

import dynamic from 'next/dynamic';

// サーバーとクライアントのハイドレーション不一致 (React Error #418) を物理的に100%防ぐため、
// メインのロジックは ssr: false (クライアント専用) で動的インポートします。
const MainApp = dynamic(() => import('../components/MainApp'), {
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
      <div className="logo" style={{ fontSize: '2rem', marginBottom: '20px' }}>
        無料＆激安セール漫画ナビ
      </div>
      <p style={{ color: '#94a3b8' }}>最新のセール情報を読み込み中...</p>
    </div>
  ),
});

export default function Home() {
  return <MainApp />;
}
