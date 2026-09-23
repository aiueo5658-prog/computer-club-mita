/* =========================================================
   config.js — このファイルだけ書き換えれば運用できます
   ========================================================= */
window.CCM = {

  /* ---- 学園祭の日程（カウントダウンに使用） ---- */
  festival: {
    start: '2026-10-31T09:00:00+09:00',
    end:   '2026-11-01T16:00:00+09:00'
  },

  /* ---- 部員数（HUB の統計に表示） ---- */
  memberCount: 20,

  /* ---------------------------------------------------------
     作品データの取得元（Google スプレッドシート）

     手順:
       1. 作品投稿用の Google フォームを作る
       2. 回答スプレッドシートを開く
       3. ファイル > 共有 > ウェブに公開 > 形式「カンマ区切り(.csv)」
       4. 出てきた URL をそのまま下に貼る

     空文字のままなら data.js の SEED データを使います。
     取得に失敗した場合も自動で SEED にフォールバックします。
     --------------------------------------------------------- */
  sheetCsvUrl: '',

  /* CSV の列名 → 内部フィールドの対応表。
     Google フォームの質問文をそのまま左側に書いてください。 */
  sheetColumns: {
    title:     ['作品名', 'タイトル', 'title'],
    author:    ['制作者', '部員名', '名前', 'author'],
    category:  ['カテゴリ', '種類', 'category'],
    url:       ['作品URL', 'URL', 'リンク', 'url'],
    thumb:     ['サムネイル', 'サムネイルURL', 'thumb'],
    desc:      ['説明', '作品説明', 'コメント', 'description'],
    docUrl:    ['ドキュメント', '資料URL', 'doc']
  },

  /* ---------------------------------------------------------
     裏側（Google スプレッドシート）の窓口

     アンケートの保存・作品へのコメント・ハートの数え上げを、
     ぜんぶこの1本で受け持ちます。

     手順:
       1. Google スプレッドシートを新しく1つ作る
       2. 拡張機能 > Apps Script を開く
       3. docs/gas-backend.gs の中身をまるごと貼って保存
       4. 右上の「デプロイ > 新しいデプロイ」
          種類=ウェブアプリ / 次のユーザーとして実行=自分 /
          アクセスできるユーザー=全員
       5. 出てきた https://script.google.com/.../exec を下に貼る

     空のままでも、サイトは普通に動きます。
     コメント欄とハートの数が出なくなるだけです。

     ハートの数え上げだけは、下の firebase 設定がある場合そちらを
     優先します（Apps Script は応答が数秒かかることがあり、押すたびに
     待たせてしまうため）。この apiUrl には引き続き「押された」記録が
     1行ずつ飛び、スプレッドシート側の記録として残り続けます。
     --------------------------------------------------------- */
  apiUrl: 'https://script.google.com/macros/s/AKfycbzlYFN6gtceG_TjTQJ73EJMKE4w3bMgKkobKmg8Oh5AB6EjgTfbRJcKHAhXMznCKEwxSA/exec',

  /* ---------------------------------------------------------
     ハートの即時カウント（Firebase Realtime Database）

     Apps Script は起動が遅く、ハートを押すたびに待たせてしまうため、
     数字の表示・加減算はこちら（数十ms〜で返る）を使う。
     押された記録そのものは、引き続き上の apiUrl 経由でスプレッドシート
     にも残るので、「集計はFirebase／記録はスプレッドシート」という
     二本立てになる。

     手順:
       1. https://console.firebase.google.com/ でプロジェクトを作る
       2. 「Realtime Database」を作成
       3. プロジェクトの設定 > マイアプリ > ウェブアプリを追加
          して出てくる設定オブジェクトを、下にそのまま転記する
       4. Realtime Database の「ルール」タブで、docs/firebase-rules.json
          の中身を貼って公開する

     空のままなら、ハートは今まで通り apiUrl（スプレッドシート）だけで
     数える（表示のたびに待たされる、元の遅い動作に戻る）。
     --------------------------------------------------------- */
  firebase: {
    apiKey: 'AIzaSyAAGW3EBGgpblpUiF4gkZAMpMVNsLwtUTA',
    authDomain: 'computerclub-8c911.firebaseapp.com',
    databaseURL: 'https://computerclub-8c911-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'computerclub-8c911',
    storageBucket: 'computerclub-8c911.firebasestorage.app',
    messagingSenderId: '962712134058',
    appId: '1:962712134058:web:ddd533c4d50d20318a8bd3'
  },

  /* ---------------------------------------------------------
     アンケートの送信先（Google フォーム）

     手順:
       1. アンケート用 Google フォームを作る
       2. 「表示 > プレビュー」でフォームを開き、ページのソースを表示
       3. 各質問の name="entry.XXXXXXXX" を探して下に転記
       4. formAction はフォーム URL の末尾を /viewform → /formResponse に変えたもの

     空のままだと送信ボタンは「未設定です」と表示して止まります。
     --------------------------------------------------------- */
  survey: {
    formAction: '',
    entries: {
      rating:   'entry.000000001',   // 満足度 1-5
      who:      'entry.000000002',   // あなたについて
      favWork:  'entry.000000003',   // 一番よかった作品
      genre:    'entry.000000004',   // 面白かったジャンル（複数可・読点区切り）
      interest: 'entry.000000005',   // 部への興味
      found:    'entry.000000006',   // どこで知ったか
      comment:  'entry.000000007'    // 自由記述
    }
  },

  /* ---- カテゴリ定義（表示順・ラベル） ---- */
  categories: [
    { key: 'music',  label: 'MUSIC', jp: '音楽',         hue: 112, icon: 'music' },
    { key: 'film',   label: 'FILM',  jp: '映像',         hue: 196, icon: 'film'  },
    { key: 'code',   label: 'CODE',  jp: 'プログラミング', hue: 150, icon: 'code'  },
    { key: 'model',  label: 'MODEL', jp: 'モデリング',    hue: 250, icon: 'model' },
    { key: 'other',  label: 'OTHER', jp: 'その他',       hue: 325, icon: 'other' }
  ]
};
