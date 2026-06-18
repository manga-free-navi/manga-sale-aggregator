'use client';

import { useEffect } from 'react';

/**
 * クライアントサイドで例外が発生したときに自動的に表示されるエラーバウンダリ画面
 * ユーザーが画面上でエラー内容を確認し、デバッグできるようにします。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 開発者ツール（コンソール）にもエラーを出力します
    console.error('詳細なエラー情報:', error);
  }, [error]);

  return (
    <div className="container" style={{ padding: '60px 20px', color: '#f8fafc', minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="filter-container" style={{ borderColor: '#ef4444', borderStyle: 'solid', borderWidth: '1px', maxWidth: '800px', width: '100%' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚠️ 画面表示中にエラーが発生しました
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem' }}>
          お手数ですが、問題解決のため画面に表示されている以下のエラーテキストをコピーして開発チャットへご提供ください。
        </p>
        
        {/* エラー詳細エリア */}
        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '10px', overflowX: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', border: '1px solid var(--border-color)', marginBottom: '25px' }}>
          <p style={{ fontWeight: 'bold', color: '#ef4444', marginBottom: '8px' }}>エラー内容 (Message):</p>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#f8fafc', marginBottom: '15px' }}>{error.message || 'No message available'}</pre>
          
          {error.digest && (
            <>
              <p style={{ fontWeight: 'bold', color: 'var(--accent-cyan)', marginBottom: '8px' }}>エラーコード (Digest):</p>
              <pre style={{ color: '#f8fafc', marginBottom: '15px' }}>{error.digest}</pre>
            </>
          )}
          
          {error.stack && (
            <>
              <p style={{ fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px' }}>スタックトレース (Stack Trace):</p>
              <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{error.stack}</pre>
            </>
          )}
        </div>

        <button 
          onClick={() => reset()}
          className="card-button"
          style={{ width: 'auto', padding: '10px 20px', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))', border: 'none', color: '#fff' }}
        >
          もう一度読み込む
        </button>
      </div>
    </div>
  );
}
