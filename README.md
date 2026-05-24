# Date Memory

写真をアップロードして、デートの思い出をメモリー再生できる静的Webサイトです。

## 使い方

`index.html` をブラウザで開くか、ローカルサーバーで配信してください。

```sh
python3 -m http.server 4173
```

## 写真の保存

初期状態では写真はブラウザ内に保存されます。この場合、PCで追加した写真はスマホには表示されません。

どの端末からでも同じ写真を見たい場合は、Supabaseを設定してください。設定後は写真をSupabase Storageへアップロードし、写真一覧をSupabase Databaseから読み込みます。

## Supabase設定

1. Supabaseで新しいプロジェクトを作成します。
2. Storageで `date-memory` という bucket を作成します。公開設定はprivateのままで大丈夫です。
3. SQL Editorで [supabase.sql](supabase.sql) を実行します。
4. Project Settings > API から Project URL と anon public key を確認します。
5. [config.js](config.js) を編集します。

```js
window.DATE_MEMORY_CLOUD = {
  enabled: true,
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_ANON_PUBLIC_KEY",
  bucket: "date-memory",
  table: "date_memory_photos",
  albumId: "date-memory-main",
};
```

`albumId` は共有アルバムの合言葉のようなものです。URLを知っている人が写真を追加・閲覧できる想定なので、必要なら推測されにくい値に変更してください。その場合は `supabase.sql` 内の `date-memory-main` も同じ値に置き換えてください。
