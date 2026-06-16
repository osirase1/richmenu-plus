# リッチメニュー＋ Vercel API経由版

LINE公式アカウントのリッチメニューを作成し、Vercel API経由でLINE APIへアップロードできるWebアプリです。

## 主な機能

- リッチメニュー画像の読み込み
- タップエリア作成
- URI / メッセージ / Postback / リッチメニュー切替アクション設定
- LINE APIへのアップロード
- デフォルトリッチメニュー設定
- デフォルト解除
- 現在のデフォルトrichMenuId確認
- ユーザー個別リンク中richMenuId確認
- 登録ユーザーへのリンク / リンク解除
- パスワードログイン
- 本人側保存
  - ブラウザ自動保存
  - プロジェクトJSON保存
  - プロジェクトJSON読み込み

## ファイル構成

```txt
index.html
package.json
README.md
vercel.json
api/check-password.js
api/clear-default-richmenu.js
api/get-richmenu-status.js
api/link-users.js
api/set-default-richmenu.js
api/unlink-users.js
api/upload-richmenu.js
```

Google Drive連携・テンプレート・JSONコード編集機能は入れていません。
不要なファイルは削除済みです。

## Vercelに必要な環境変数

### 必須

```txt
APP_PASSWORD
```

リッチメニュー＋を開く時のログインパスワードです。
ログイン画面には「パスワードを入力してください」とだけ表示されます。

### 任意

```txt
LINE_CHANNEL_ACCESS_TOKEN
```

自分専用で使う場合、ここにLINE Developersの長期チャネルアクセストークンを入れると、画面で毎回トークンを入力せずに使えます。

他の人にもURLを渡して使わせる場合は、基本的に `LINE_CHANNEL_ACCESS_TOKEN` はVercelに入れず、使う人がAPIタブで自分のチャネルアクセストークンを入力する運用がおすすめです。

## 保存について

作成データは使う人本人側に保存します。

- 通常はブラウザに自動保存されます。
- キャッシュ・Cookie・サイトデータ削除、別端末、別ブラウザでは消えたり見えなくなったりします。
- 大事なデータは「保存」タブからプロジェクトJSONとして保存してください。
- 次回は「プロジェクトファイル読み込み」で再編集できます。

## 更新方法

1. ZIPを解凍
2. 解凍した中身をGitHubに上書きアップロード
3. Commit changes
4. Vercelで自動デプロイ、またはDeploymentsからRedeploy

ZIPファイルそのものはGitHubにアップロードしないでください。
