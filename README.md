# リッチメニュープラス マスター版

自分用に使うマスター版です。  
ログイン画面・パスワード確認は使わず、起動後すぐに編集画面を開きます。

## この版の位置づけ

- マスター版：自分用。パスワードなし。クライアント選択・トークン切替あり。
- 通常版：クライアント配布用。パスワード制限を入れる予定。

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
- クライアント別チャネルアクセストークン保存
- プロジェクトJSON保存 / 読み込み
- プロジェクトJSONへのチャネルアクセストークン保存

## ファイル構成

```txt
index.html
package.json
README.md
vercel.json
.env.example
.gitignore
api/_auth.js
api/_line.js
api/upload-richmenu.js
api/set-default-richmenu.js
api/clear-default-richmenu.js
api/get-richmenu-status.js
api/link-users.js
api/unlink-users.js
```

## Vercel設定

マスター版では、基本的に環境変数は不要です。

チャネルアクセストークンは、画面側の「チャネルアクセストークン」に入力して使えます。  
Vercel側に固定したい場合だけ、以下を設定してください。

```txt
LINE_CHANNEL_ACCESS_TOKEN=チャネルアクセストークン
```

ただし、マスター版はパスワードなしなので、Vercel側にトークンを固定する場合はURL管理に注意してください。

## ローカル確認

```bash
npm install
npm run check
```

## Vercelへアップロードするファイル

このフォルダ内のファイルをそのままGitHubへアップロードしてください。

## 通常版で追加予定のもの

通常版では、以下を別途追加します。

- 初回パスワード確認
- 認証済みブラウザの保存
- クライアント用の画面制限
- クライアント選択の非表示
- 指定クライアント用トークン入りプロジェクト運用
