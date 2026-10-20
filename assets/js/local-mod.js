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

   方針：感想・応援・質問に加えて、作品への指摘・バグ報告・要望も載せる。
         人への悪口・死ね系・差別・政治や領土の主張は載せない。
   AIは短い悪口や伏せ字に弱いので、そこは NG（正規表現の一覧）で補う。
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

  /* 載せたい見本。感想・応援・質問に加えて、作品への指摘・バグ報告・要望も載せる。 */
  var GOOD = ['楽しかった', '面白かった！', 'すごい', '最高でした', 'BGMが好きです', '絵がきれい', 'かわいい', 'また遊びたい',
              '続編待ってます', '感動しました', '神ゲー', '難しかったけど楽しかった', 'どうやって作ったんですか？',
              'ありがとうございます', '応援してます', 'いい曲', 'クオリティ高い', 'ハマりました', '友達にも勧めたい',
              '色使いがおしゃれ', 'もっと長く遊びたかった', '何分で作ったんですか？', '映像がきれいで見入った',
              '3Dモデルすごい', '来年も来ます', '頑張ってください', '笑いました', 'プロみたい', '泣きました',
              '操作が少し分かりにくかった', '音が小さくて聞こえない', '2面でバグって先に進めなかった',
              '左手でJとスペースを押すのが難しいので修正してほしいです', '当たり判定がずれている気がします',
              'イラストが欲しい！', '色が原色に近いからおもちゃっぽく感じる', '説明がもう少し欲しい',
              '難しすぎたので簡単モードがあると嬉しい', 'ロードが長い', '操作が難しい', '出口が見つからなかった',
              '何回も死んでしまったけど楽しい', 'ここを直すともっと良くなると思う',
              'かっこよw', 'かっこいい！', 'えぐい！すごい', '信じてます', 'このままでいい', 'ありのままが良い', 'まじですごい'];
  /* 載せない見本。人への悪口・死ね系・差別・政治や領土の主張・意味のない冷やかし。 */
  var BAD = ['つまらない', 'おもんない', 'クソゲー乙', 'ゴミ作品', '下手くそ', 'センスない', '時間の無駄', '作った人やばい',
             '作者頭悪い', '見る価値なし', '死ね', '殺す', 'ばーか', 'お前の顔ブス', 'きもい', 'うざい', '作った人は人間じゃない',
             '才能ない', 'ダサい', 'パクリじゃん', '死んでください', 'お亡くなりください', 'くたばれ', '消えろ',
             '頭おかしい', '病気かよ', '障害者みたい', '生活保護だろ', 'オカマ', 'ハゲ', '病んでる？', 'イキってる',
             'すごいなあキミww（皮肉）', 'ど、どした？笑', '竹島は韓国の領土', '台湾は中国の一部', '天皇制反対', 'ハイルヒトラー',
             '外国人は出ていけ', 'うおwきっつ', '縦読みしてね'];

  /* AIが見抜けない言葉・言い回し。fold() で、ひらがな→カタカナ、全角→半角、
     記号・空白・伏せ字（〇○●×）を落としてから当てる。
     短い語は、ふつうの言葉にまぎれる形を (?!…) で外してある
     （シネ→シネマ、キチ→キチンと、カス→カスタム、ハゲ→ハゲシイ 等）。
     docs/gas-backend.gs の NG と同じ一覧。片方を直したら両方直す。 */
  var NG = [
    /死ネ|死ンデ(?:クダサイ|ホシ|クレ|ネ|ヨ|ロ|$)|死ニ(?:タマエ|クダサイ|ヤガレ|ナサイ)|死ヌベキ|シネ(?!マ|ラリア)|シンデ(?:クダサイ|ホシ|クレ|ネ$|ヨ$)|シニタマエ|氏ネ/,
    /亡クナリ(?:クダサイ|下サイ|ナサイ)|クタバ|クタバレ|殺ス|殺シテ|コロス|コロシテ|消エロ|キエロ|自殺/,
    /^(?:w*)(?:sine|shine|sineyo|shineyo|sinde|shinde|korosu)(?:w*)$/,
    /基地外|気違イ|キチガイ|キチ(?!ン|ット|ョウ)|ガイジ|池沼|糖質|ナマポ|生活保護|障害者|知恵遅レ|メクラ|ツンボ|カタワ/,
    /バカ(?!ン)|馬鹿|馬ト鹿|アホ(?!ウドリ)|マヌケ|ブス|デブ|ハゲ(?!シ|マ)|キモ(?!チ)|キショ|ウザ|クズ(?!レ)|ゴミ|カス(?!タ|テラ|ケード)|クソ(?!ゲ)|ザコ|雑魚|イキスギ|イキッテ/,
    /オカマ|ホモ|レズ|ゲイ(?!ム|ジ)|ニガー|チョン|支那|土人|朝鮮人|韓国人|中国人|在日/,
    /セックス|チンコ|チンポ|チンチン|マンコ|オッパイ|エッチ|エロ|オナニ|パンパン|69|野獣|yaju|ヤリマスネ|810|114514|イイヨコイヨ|田所/,
    /ウンコ|ウンチ|シッコ|オモンナ|オモロナ|ツマンネ|ツマラナイ|オモシロクナイ|面白クナイ|面白クナ/,
    /竹島|独島|尖閣|北方領土|樺太|植民地|慰安婦|南京|台湾ハ|中華人民共和国|紅衛兵|天皇|靖国|ヒトラー|ハイル|ナチ(?!ュ)|総統/,
    /縦読ミ|タテヨミ|下カラ読|頭文字ヲ/,
    /[가-힯]/,
    /sex|fuck|shit|dick|porn|bitch|nigg/
  ];

  function fold(s) {
    s = String(s || '').normalize('NFKC').toLowerCase();
    /* ひらがな → カタカナ */
    s = s.replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); });
    /* 伸ばし棒・記号・空白・伏せ字を落とす（「し。ね」「〇〇し〇〇ね」「ち○ぽ」「うーんこ」対策） */
    return s.replace(/[\sー〜~・.,、。_\-*○〇◯●×♡☆★!?！？「」『』()（）\[\]【】…‥'"`]/g, '');
  }

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
    /* 名前と本文は別々に当てる（つなげると、名前の終わりと本文の頭で語ができてしまう） */
    var parts = [fold(name), fold(text)];
    for (var i = 0; i < NG.length; i++) {
      for (var j = 0; j < parts.length; j++) {
        if (parts[j] && NG[i].test(parts[j])) return { status: 'rejected', reason: '不適切・人への攻撃の疑い' };
      }
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
