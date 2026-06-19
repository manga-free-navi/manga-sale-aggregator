# 📚 漫画セールナビ 運営・管理用セットアップガイド

本プロジェクト（無料＆激安セール漫画ナビ）を本番環境でリリース・公開し、自動運転を開始するまでに必要な管理者向け設定手順書です。

---

## 🛠️ 1. GitHub Actions (自動運転) の本番設定

GitHub Pages や外部サーバーにサイトを毎日自動デプロイし、最新のセール情報を更新し続けるには、GitHub リポジトリ上で環境変数（Secrets / Variables）を登録する必要があります。

### 設定方法
1. GitHub上のリポジトリページを開きます。
2. **Settings** (歯車マーク) > **Secrets and variables** > **Actions** の順に移動します。
3. 以下の環境変数を用途に応じて追加してください。

### 🔑 登録が必要な環境変数一覧

| 区分 | 変数名 | 種別 | 説明 |
| :--- | :--- | :---: | :--- |
| **データ自動収集** | `RAKUTEN_APP_ID` | **Secret** | 楽天デベロッパーID (APIキー)。設定すると楽天Koboから実際のデータを自動取得します。 |
| | `RAKUTEN_ACCESS_KEY` | **Secret** | 楽天アクセスキー。セキュリティ検証に使用されます。 |
| | `RAKUTEN_AFFILIATE_ID` | **Secret** | 楽天アフィリエイトID。アフィリエイトリンク生成に使用され、収益が発生します。 |
| | `VC_SID` | **Secret** | コミックシーモア(バリューコマース)のアフィリエイトSID（任意）。 |
| | `VC_PID` | **Secret** | コミックシーモア(バリューコマース)のアフィリエイトPID（任意）。 |
| **アクセス解析** | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | **Variable** | Google Analytics (GA4) の測定ID (例: `G-XXXXXXXXXX`)。設定すると自動で測定が始まります。 |
| **広告・収益化** | `NEXT_PUBLIC_ADSENSE_CLIENT` | **Variable** | Google AdSense のクライアントID (例: `ca-pub-XXXXXXXXXXXXXXXX`)。広告配信タグが有効になります。 |
| **3サイト相互回遊** | `NEXT_PUBLIC_MANGA_SITE_URL` | **Variable** | 本サイト（漫画セールナビ）の公開URL。 |
| | `NEXT_PUBLIC_ANIME_SITE_URL` | **Variable** | 姉妹サイト「アニフリー（アニメナビ）」の公開URL。 |
| | `NEXT_PUBLIC_GAME_SITE_URL` | **Variable** | 姉妹サイト「ゲームナビ」の公開URL。 |

---

## 📈 2. Google Analytics (GA4) ＆ Search Console の設定

### Google Analytics 4 (GA4)
1. [Google アナリティクス](https://analytics.google.com/)にて、新しくプロパティ（ウェブ）を作成します。
2. ストリーム設定で発行される **「測定ID (G-XXXXXXXXXX)」** をコピーします。
3. 上記の通り、GitHub リポジトリの **Variables** に `NEXT_PUBLIC_GA_MEASUREMENT_ID` という名前で登録してください。

### Google Search Console (サチコ)
1. [Google Search Console](https://search.google.com/search-console/)にサイトのドメイン（または GitHub Pages のURL）を登録します。
2. 所有権の確認方法で「HTMLタグ」を選択し、メタタグ（例: `<meta name="google-site-verification" content="..." />`）をコピーします。
3. 必要に応じて、`src/app/layout.tsx` の `<head>` タグ内にこのメタタグを追記してプッシュしてください。

---

## 💰 3. Google AdSense (広告収益化) の審査通過のヒント

当サイトは、アドセンスの厳しいサイト審査を通過しやすいように設計されています。

### 審査通過のための機能・コンテンツ設計
*   **プライバシーポリシー・免責事項の設置済み**: フッターからアクセスできる専用ページ ([PrivacyContent.tsx](file:///C:/Users/MASAYUKI/.gemini/antigravity/scratch/manga-sale-aggregator/src/components/PrivacyContent.tsx)) に、アドセンスやアフィリエイトに関する表記をあらかじめ設置しています。
*   **プレースホルダーの完備**: 広告が入っていない状態でもレイアウトが崩れず、ユーザー体験を損なわないようプレースホルダーが表示されます。

### AdSenseの登録手順
1. [Google AdSense](https://adsense.google.com/)にログインし、サイトのURLを登録します。
2. 発行されるサイト確認用コード、または自動広告用スクリプトをコピーします。
3. 審査用コード（パブリッシャーID `ca-pub-XXXXXXXXXXXXXXXX` の部分）を GitHub リポジトリの **Variables** に `NEXT_PUBLIC_ADSENSE_CLIENT` という名前で登録します。
4. 審査に合格したら、アドセンスの「広告ユニット（ディスプレイ広告等）」を作成し、その **スロットID** を `src/components/MainApp.tsx` 内の `AdContainer` コンポーネントに設定します。

---

## 🎨 4. サイトアイコン・favicon の本番用への差し替え

現在、PWAおよびブラウザ表示用の仮のアイコンが設定されています。本番公開にあたっては、以下のファイルをオリジナルデザインの画像に上書きしてください。

*   **favicon**: [public/favicon.ico](file:///C:/Users/MASAYUKI/.gemini/antigravity/scratch/manga-sale-aggregator/public/favicon.ico) (ブラウザのタブに表示されるアイコン)
*   **PWAアイコン / Apple タッチアイコン**: [public/icon.svg](file:///C:/Users/MASAYUKI/.gemini/antigravity/scratch/manga-sale-aggregator/public/icon.svg) (スマートフォンでホーム画面に追加したときに表示される高解像度のアプリアイコン)

※ アイコン画像を変更した際は、PWAキャッシュが更新されるようにサービスワーカー（[sw.js](file:///C:/Users/MASAYUKI/.gemini/antigravity/scratch/manga-sale-aggregator/public/sw.js)）のキャッシュバージョンを変更、または再生成されるようにしてください。

---

## 🔄 5. サイトの動作確認（ローカル環境）

ローカルで本番同様のビルドを行い、確認するコマンドです。

```bash
# 1. 依存関係のインストール
npm install

# 2. ローカルテストデータの収集
node src/scraper/run-scraper.js

# 3. 本番用ビルドの検証
npm run build

# 4. ローカル検証サーバーの起動
npm run dev
```
