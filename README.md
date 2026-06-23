# リッチメニュー＋ Vercel版

LINE公式アカウントのリッチメニューを作成し、Vercel API経由でLINE APIへアップロードできるWebアプリです。

## 今回の仕様

### 共通本体

- アプリ本体は1つだけです。
- `APP_MODE` の値で、自分用 / クライアント用を切り替えます。

### 起動モード

```txt
owner  : 自分用。パスワードなしで起動。
client : クライアント用。初回のみパスワード入力。
```

### クライアント用モード

`APP_MODE=client` にすると、初回起動時だけパスワード入力が必要です。
ログイン成功後、認証済みトークンをブラウザに保存します。
2回目以降は、同じブラウザであればパスワード入力なしで起動できます。

Vercelはサーバー側に認証ファイルを永続保存する用途に向かないため、認証済み情報はブラウザ側に保存します。
別PC・別ブラウザ・サイトデータ削除後は、再ログインが必要です。

### 自分用モード

`APP_MODE=owner` にすると、ログイン画面を出さずに起動します。
クライアントごとにチャネルアクセストークンを保存・切り替えできます。

> 注意：ownerモードはURLを知っている人が画面を開けます。基本的には自分だけが使うURL・運用で使ってください。

## 主な機能

- リッチメニュー画像の読み込み
- タップエリア作成
- URI / メッセージ / Postback / リッチメニュー切替アクション設定
- LINE APIへのアップロード
- アップロード後の自動デフォルト設定
- デフォルトリッチメニュー設定
- デフォルト解除
- 現在のデフォルトrichMenuId確認
- ユーザー個別リンク中richMenuId確認
- 登録ユーザーへのリンク / リンク解除
- 起動モード切替（owner / client）
- クライアント別チャネルアクセストークン保存
- プロジェクトJSON保存 / 読み込み
- プロジェクトJSONへのチャネルアクセストークン保存

## プロジェクトファイルに含まれるもの

プロジェクトファイルには以下を含めます。

- メニュー設定
- 背景画像データ
- タップエリア
- アクション設定
- ユーザーリスト
- チャネルアクセストークン
- クライアント別トークン一覧

チャネルアクセストークン込みのため、プロジェクトファイルの取り扱いには注意してください。

## ファイル構成

```txt
index.html
package.json
README.md
vercel.json
.env.example
.gitignore
api/_auth.js
api/app-config.js
api/check-password.js
api/clear-default-richmenu.js
api/get-richmenu-status.js
api/link-users.js
api/set-default-richmenu.js
api/unlink-users.js
api/upload-richmenu.js
```

## Vercelに必要な環境変数

### クライアント用

```txt
APP_MODE=client
APP_PASSWORD=任意の初回ログインパスワード
AUTH_SECRET=長いランダム文字列
```

### 自分用

```txt
APP_MODE=owner
AUTH_SECRET=長いランダム文字列
```

### 任意

```txt
LINE_CHANNEL_ACCESS_TOKEN=長期チャネルアクセストークン
```

通常は画面側でクライアントごとにチャネルアクセストークンを保存する運用で大丈夫です。

## 更新方法

1. ZIPを解凍
2. 解凍した中身をGitHubに上書きアップロード
3. Commit changes
4. Vercelで自動デプロイ、またはDeploymentsからRedeploy

ZIPファイルそのものはGitHubにアップロードしないでください。
