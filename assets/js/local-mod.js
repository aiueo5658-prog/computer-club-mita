/* =========================================================
   local-mod.js — ひとことを、来場者のブラウザの中で審査する

   有料の Jev の代わりに、無料の小さな判定AIを端末の中で動かす。
     モデル：Xenova/multilingual-e5-small（文の意味を数字の並びにするAI。日本語に強い。約120MB）
     しくみ：「載せたい ひとこと」と「載せない ひとこと」の見本を下に並べておき、
             送られた文がどちらの見本に意味が近いかで決める（似ている上位3つの平均の差）。
             感想・応援・質問 → 載せる。批判・悪口・下品・脅し → 載せない。
             見本を足し引きすれば、判定の好みを直せる。
             初回だけダウンロードし、あとはブラウザに保存される。
     実行  ：Transformers.js（jsDelivr から読み込む）

   方針：作品への批判は、辛口の指摘も含めて載せない（前向きなひとことだけ載せる）。
   AIは一語だけの下ネタに弱いので、そこだけ WORDS で補う。
   リンク・メール・電話番号は、個人情報と宣伝よけとして先に止める。
   結果は { status, reason, unsafe } で返す。
     published … 載せる  rejected … 載せない
   AI が読み込めないとき（オフラインなど）は、送らずに「少し待って」と返す。

   しきい値は運用しながら TH をいじる。
   ========================================================= */
window.CCMLocalMod = (function () {
  'use strict';

  var LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5';
  var MODEL = 'Xenova/multilingual-e5-small';
  var TH = { margin: 0 };   /* 「載せたい見本」への近さ − 「載せない見本」への近さ がこれ以下なら載せない */

  var GOOD = ['楽しかった', '面白かった！', 'すごい', '最高でした', 'BGMが好きです', '絵がきれい', 'かわいい', 'また遊びたい',
              '続編待ってます', '感動しました', '作者天才', '神ゲー', '難しかったけど楽しかった', 'どうやって作ったんですか？',
              'ありがとうございます', '応援してます', 'いい曲', 'クオリティ高い', 'ハマりました', '友達にも勧めたい',
              '色使いがおしゃれ', 'もっと長く遊びたかった', '何分で作ったんですか？', '声がかっこいい', '映像がきれいで見入った',
              '3Dモデルすごい', 'プログラミングできるのかっこいい', '来年も来ます', '頑張ってください', '笑いました',
              '中学生が作ったとは思えない', 'プロみたい', '信じられないくらい上手', 'ストーリーが泣ける', '泣きました'];
  var BAD = ['つまらない', '面白くない', 'おもんない', '微妙', '退屈だった', 'クソゲー', 'ゴミ作品', '下手', 'センスない',
             '操作が分かりにくい', '難しすぎてやる気なくした', '音が小さくて聞こえない', 'バグだらけ', '時間の無駄',
             '作った人やばい', '作者頭悪い', '二度とやらない', '見る価値なし', 'がっかりした', '途中で飽きた',
             '死ね', '殺す', 'ばーか', 'お前の顔ブス', 'きもい', 'うざい', 'エロい', '下ネタ', '作った人は人間じゃない',
             'こんなの誰でも作れる', 'もっと頑張れよ', '金返せ', '才能ない', 'ダサい', '意味わからん', 'もうちょっと頑張って', 'パクリじゃん', '説明が長い'];

  /* AIが見抜けない言葉。ひらがな・カタカナ・半角・記号まじりは同じものとして見る */
  var WORDS = ['セックス', 'ちんこ', 'ちんぽ', 'ちんちん', 'まんこ', 'おっぱい', 'えっち', 'エロ', 'オナニ','パンパン', '69', '野獣', 'YAJU', 'やりますね', 
               'うんこ', 'うんち', 'しっこ', 'きもい', 'きもすぎ', 'きしょ', 'うざい', 'デブ', 'クズ', 'ゴミ', 'クソ',
               'ガイジ', '氏ね', 'ころす', 'おもんな', 'おもろな', 'つまんね',
               'sex', 'fuck', 'shit', 'dick', 'porn'];
  /* 短すぎる語（シネ→シネマ、カス→カスタム、ハゲ→はげしい 等）は、ふつうの言葉に
     まぎれて誤爆するので入れない。そういう悪口は判定AIのほうが拾える。 */

  function fold(s) {
    s = String(s || '').normalize('NFKC').toLowerCase();
    /* ひらがな → カタカナ */
    s = s.replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); });
    /* 伸ばし棒・記号・空白を落とす（「せ っ く す」「ち○ぽ」「うーんこ」対策） */
    return s.replace(/[\sー〜~・.,、。_\-*○●◯×♡☆★!?！？]/g, '');
  }
  var FOLDED = WORDS.map(fold);

  var clfPromise = null;
  function load() {
    if (!clfPromise) {
      clfPromise = import(LIB).then(function (T) {
        return T.pipeline('feature-extraction', MODEL, { dtype: 'q8', device: 'wasm' });
      }).then(function (ext) {
        function emb(list) {
          return ext(list.map(function (s) { return 'query: ' + s; }), { pooling: 'mean', normalize: true })
            .then(function (x) { return x.tolist(); });
        }
        /* 見本は最初に一度だけ数字にしておく（これが空打ちも兼ねる） */
        return Promise.all([emb(GOOD), emb(BAD)]).then(function (r) {
          return { emb: emb, good: r[0], bad: r[1] };
        });
      }).catch(function (e) { clfPromise = null; throw e; });
    }
    return clfPromise;
  }

  function rules(name, text) {
    var all = name + ' ' + text;
    if (/https?:\/\/|www\.|\.(com|net|jp|io|xyz)\b/i.test(all)) return { status: 'rejected', reason: 'リンクは載せていません' };
    if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(all)) return { status: 'rejected', reason: 'メールアドレスは載せていません' };
    if (/0\d{1,4}[-\s]?\d{2,4}[-\s]?\d{3,4}/.test(all.normalize('NFKC'))) return { status: 'rejected', reason: '電話番号は載せていません' };
    if (/(.)\1{9,}/.test(text)) return { status: 'rejected', reason: '同じ文字の連打' };
    var f = fold(all);
    for (var i = 0; i < FOLDED.length; i++) {
      if (FOLDED[i] && f.indexOf(FOLDED[i]) >= 0) return { status: 'rejected', reason: '不適切・人への攻撃の疑い' };
    }
    return null;
  }

  function check(name, text) {
    var r = rules(name || '', text || '');
    if (r) return Promise.resolve({ status: r.status, reason: r.reason, unsafe: 1 });

    return load().then(function (m) {
      var input = (name ? name + '：' : '') + text;
      return m.emb([input]).then(function (v) {
        var x = v[0];
        function near(M) {
          var s = M.map(function (y) { var d = 0; for (var i = 0; i < y.length; i++) d += x[i] * y[i]; return d; });
          s.sort(function (a, b) { return b - a; });
          return (s[0] + s[1] + s[2]) / 3;
        }
        var score = near(m.good) - near(m.bad);
        /* unsafe は裏側へ送る数字。0〜1 に収め、0.5 以上＝載せない に合わせる */
        var u = Math.max(0, Math.min(1, 0.5 - score * 10));
        if (score <= TH.margin) return { status: 'rejected', reason: '前向きでない内容', unsafe: Math.max(u, 0.5) };
        return { status: 'published', reason: 'ok', unsafe: Math.min(u, 0.49) };
      });
    }).catch(function () {
      return { status: 'rejected', reason: '判定の準備ができませんでした。通信を確かめて、少し待ってからもう一度どうぞ', unsafe: null };
    });
  }

  /* ひとこと欄のあるページでは、開くのを待たずに、ページが落ち着いたら裏で読み込み始める（PCのみ）。
     初回のダウンロード（約180MB）と、保存済みからの立ち上げ（約1.5秒）を、
     送信の瞬間に待たせないため。データ節約の設定なら、欄を開くまで待つ。 */
  (function autoWarm() {
    /* スマホ（指で触る端末）は通信量がかさむので、欄を開いたときだけ読み込む。
       展示用のPC（マウスの端末）だけ、先に読み込んでおく */
    var c = navigator.connection;
    if (c && (c.saveData || c.type === 'cellular')) return;
    if (!(window.matchMedia && matchMedia('(pointer: fine)').matches)) return;
    function go() {
      if (!document.getElementById('cmt-form')) return;
      var idle = window.requestIdleCallback || function (f) { setTimeout(f, 1); };
      setTimeout(function () { idle(function () { load().catch(function () {}); }, { timeout: 3000 }); }, 2500);
    }
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  })();

  return {
    /* ひとこと欄を開いたときに呼ぶ。送信までにダウンロードを済ませておく */
    warm: function () { load().catch(function () {}); },
    check: check,
    TH: TH
  };
})();
