# Date Memory

写真をアップロードして、デートの思い出をメモリー再生できるWebサイトです。

## 写真の保存

初期状態では写真はブラウザ内に保存されます。この場合、PCで追加した写真はスマホには表示されません。

PC、iPhone、別ブラウザで同じ写真を参照するには、MongoDB Atlasへ保存するAPIをデプロイしてください。このリポジトリにはVercel向けのAPIを同梱しています。

## MongoDB Atlas + Vercel設定

1. MongoDB AtlasでDatabase Userを作成します。
2. Atlasの接続文字列を取得します。形式は `mongodb+srv://USER:PASSWORD@HOST/...` です。
3. VercelでこのGitHubリポジトリをImportします。
4. VercelのEnvironment Variablesに以下を設定します。

```txt
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/?retryWrites=true&w=majority
MONGODB_DB=date_memory
MONGODB_COLLECTION=photos
ALBUM_ID=date-memory-main
```

削除機能もクラウドに対して有効にしたい場合だけ、以下も設定します。

```txt
ADMIN_TOKEN=推測されにくい長い文字列
```

5. VercelにDeployします。
6. `config.js` を以下のように変更します。

同じVercel上でWebサイトも動かす場合:

```js
window.DATE_MEMORY_CLOUD = {
  enabled: true,
  provider: "api",
  apiBaseUrl: "",
  albumId: "date-memory-main",
  adminToken: "",
};
```

GitHub Pagesを表示元にして、APIだけVercelを使う場合:

```js
window.DATE_MEMORY_CLOUD = {
  enabled: true,
  provider: "api",
  apiBaseUrl: "https://YOUR_VERCEL_APP.vercel.app",
  albumId: "date-memory-main",
  adminToken: "",
};
```

`albumId` は共有アルバムIDです。URLを知っている人が写真を追加・閲覧できる想定なので、必要なら推測されにくい値に変更してください。

## 注意

MongoDBのパスワードやAPIキーを `config.js` に入れないでください。`config.js` はブラウザから誰でも読めます。秘密情報は必ずVercelのEnvironment Variablesに入れてください。

すでにチャット等に貼ったキーは漏えい済みとして扱い、MongoDB Atlas側でローテーションすることをおすすめします。

## ローカル確認

静的サイトだけ確認する場合:

```sh
python3 -m http.server 4173
```

Vercel APIも含めて確認する場合:

```sh
npm install
npm start
```
