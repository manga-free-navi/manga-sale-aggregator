'use client';

import Link from 'next/link';

/**
 * プライバシーポリシーのコンテンツコンポーネント
 */
export default function PrivacyContent() {
  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '60px', maxWidth: '800px' }}>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '10px' }}>
          プライバシーポリシー・免責事項
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          策定日: 2026年6月19日
        </p>
      </header>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--accent-cyan)', marginBottom: '12px', borderLeft: '4px solid var(--accent-cyan)', paddingLeft: '10px' }}>
          1. 個人情報の利用目的
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
          当サイトでは、お問い合わせの際などに氏名やメールアドレス等の個人情報をご登録いただく場合があります。
        </p>
        <p style={{ color: 'var(--text-secondary)' }}>
          これらの個人情報は、質問に対する回答や必要な情報を電子メール等でご連絡する場合にのみ利用し、個人情報をご提供いただく際の目的以外では利用いたしません。
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--accent-cyan)', marginBottom: '12px', borderLeft: '4px solid var(--accent-cyan)', paddingLeft: '10px' }}>
          2. 広告の配信について
        </h2>
        
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
          Google AdSenseの利用
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
          当サイトでは、第三者配信の広告サービス「Google AdSense（グーグルアドセンス）」を利用しています。広告配信事業者は、ユーザーの興味に応じた商品やサービスの広告を表示するため、当サイトや他サイトへのアクセスに関する情報「Cookie」（氏名、住所、メールアドレス、電話番号は含まれません）を使用することがあります。
        </p>

        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
          アフィリエイトプログラムの参加
        </h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          当サイトは、楽天アフィリエイト、Amazonアソシエイト、および各種アフィリエイトASP等の紹介プログラムに参加しています。これらのプログラムにおいて、第三者がコンテンツおよび宣伝を提供し、訪問者から直接情報を収集し、訪問者のブラウザにCookieを設定したりこれを認識したりする場合があります。
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--accent-cyan)', marginBottom: '12px', borderLeft: '4px solid var(--accent-cyan)', paddingLeft: '10px' }}>
          3. 免責事項
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
          当サイトに掲載されている情報は、各電子書籍ストア公式API等のデータを元に自動的・定期的に収集し、できる限り正確な情報を掲載するよう努めておりますが、正確性や完全性を保証するものではありません。
        </p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
          セール価格や無料公開の期間、条件等は、各電子書籍ストア側で予告なく変更・終了される場合があります。必ず遷移先の対象ストア（Kindle、楽天Kobo、ジャンプ+等）にて、最新の販売条件・配信状況を最終確認のうえでご利用ください。
        </p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
          当サイトからリンクやバナーなどによって他のサイトに移動された場合、移動先サイトで提供される情報、サービス等について一切の責任を負いません。
        </p>
        <p style={{ color: 'var(--text-secondary)' }}>
          当サイトの利用により発生した直接的・間接的な損失やトラブル等について、当サイト管理者は一切の責任を負いかねますのであらかじめご了承ください。
        </p>
      </section>

      <section style={{ marginBottom: '35px' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--accent-cyan)', marginBottom: '12px', borderLeft: '4px solid var(--accent-cyan)', paddingLeft: '10px' }}>
          4. 著作権・肖像権について
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          当サイトで紹介している漫画の書影画像、紹介文、商標、著作権・肖像権等は、各著者、出版社、および各ストア等の権利所有者に帰属します。当サイトは情報の紹介および販売促進を目的としてプログラム経由でこれらを引用・表示しており、権利を侵害する意図はございません。
        </p>
      </section>

      <div style={{ marginTop: '40px', borderTop: '1px solid var(--border-color)', paddingTop: '20px', textAlign: 'center' }}>
        <Link href="/" style={{ color: 'var(--accent-cyan)', fontWeight: '600', textDecoration: 'none' }}>
          ← トップページへ戻る
        </Link>
      </div>
    </div>
  );
}
