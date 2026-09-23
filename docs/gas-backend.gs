/* =========================================================
   gas-backend.gs — 昆布観測島 の裏側（Google Apps Script）

   これ1本で3つを受け持ちます。
     1. アンケートの回答  → シート「アンケート」
     2. 作品へのひとこと  → Jev で審査 → 公開してよいものだけ Firebase へ
                            （全件をシート「コメント」に記録）
     3. 作品へのハート    → シート「ハート」

   置き方は README の「6-9 裏側」と「6-10 ひとことの自動審査」を見てください。
   ざっくり言うと、スプレッドシートを1つ作って
   「拡張機能 > Apps Script」にこの中身を貼り、ウェブアプリとして
   「アクセスできるユーザー: 全員」でデプロイするだけです。

   出てきた /exec の URL を assets/js/config.js の apiUrl に貼れば繋がります。

   ---- 秘密の値はコードに書かない ----
   「プロジェクトの設定 > スクリプト プロパティ」に入れます。
     JEV_API_KEY      … TypeSafe の Jev の API キー（必須。無いと全件「確認待ち」）
     FIREBASE_DB_URL  … 空なら下の FIREBASE_DB_URL を使う
     FIREBASE_SECRET  … 任意。appsscript.json の権限設定をしない場合だけ使う
   ========================================================= */

/* ---- シート名。変えたいときはここだけ ---- */
var SHEET = {
  survey:  'アンケート',
  comment: 'コメント',
  heart:   'ハート'
};

/* コメントの上限。長すぎる投稿を防ぐ。 */
var COMMENT_MAX = 200;
var NAME_MAX = 20;

/* 見出し行。シートが無ければこの通りに作ります。
   コメントは、古いシート（5列）にも足りない見出しを右に足します。 */
var HEADERS = {
  'アンケート': ['日時', '満足度', 'あなたについて', '一番よかった作品',
                 '面白かったジャンル', '部への興味', 'どこで知ったか', '自由記述'],
  'コメント':   ['日時', '作品', 'なまえ', '本文', '公開',
                 '判定', '理由', '侮辱', '不適切', '種類', '端末ID', 'FirebaseID'],
  'ハート':     ['日時', '作品', '端末ID', '増減']
};
/* コメント シートの列番号（1始まり） */
var C = { at: 1, slug: 2, name: 3, text: 4, pub: 5, verdict: 6, reason: 7,
          attack: 8, unsafe: 9, kind: 10, device: 11, fid: 12 };

/* Firebase Realtime Database。config.js の firebase.databaseURL と同じもの */
var FIREBASE_DB_URL = 'https://computerclub-8c911-default-rtdb.asia-southeast1.firebasedatabase.app';


/* =========================================================
   Jev（TypeSafe の System One モデル）での審査

   Jev は文章を書くモデルではなく、決められた問いに
   「どれか・何％か」を型付きで返すモデル。3つの問いを同時に聞く。

     kind           … この投稿はどの種類か（choice）
     attacks_person … 人を侮辱・攻撃しているか（noul = はいの確率）
     unsafe         … 学校の公開サイトに載せてはいけない内容か（noul）

   方針：作品への指摘・改善案は、辛口でも「feedback」として公開する。
         ただし人を貶める言い方が混ざっていれば公開しない。
   ========================================================= */
var JEV_URL = 'https://api.typesafe.ai/v1/systemone';
var JEV_MODEL = 'jev-latest';

/* 判定のしきい値。運用しながら「理由」「侮辱」「不適切」列を見て調整する。 */
var TH = {
  reject: 0.6,   /* 侮辱・不適切の確率がこれ以上 → 公開しない */
  hold:   0.3,   /* この間（0.3〜0.6）→ 公開せず、部員の確認待ち */
  spam:   0.7,   /* 無関係・意味のない投稿の確率がこれ以上 → 公開しない */
  good:   0.7    /* 称賛＋指摘＋質問の確率の合計がこれ以上 → 自動で公開 */
};

var SCENE = '中学・高校のコンピュータ部の作品展サイト。部員（中高生）が作ったゲーム・映像・音楽・3Dモデルに、' +
            '来場者が短い「ひとこと」を書き込み、それが作品の横に公開される。';

function jevRequest(post) {
  return {
    model: JEV_MODEL,
    state: {
      '場面': SCENE,
      '作品名': post.title || '(不明)',
      '投稿者の表示名': post.name,
      'ひとこと本文': post.text
    },
    questions: {
      kind: {
        type: 'choice',
        instructions: 'この「ひとこと」はどの種類の投稿ですか。表示名と本文の両方を見て判断してください。',
        criteria: {
          praise: {
            what: '作品への感想・応援・称賛・お礼',
            examples: ['すごく楽しかった！', 'BGMがかっこいい', '続編待ってます']
          },
          feedback: {
            what: '作品への具体的な指摘・改善案・率直な感想。否定的・辛口でも、作品そのもの（操作性・難易度・音量・見た目・内容・バグなど）について述べていればこれ',
            not_for: '作者や人の人格・能力・容姿を貶める言い方',
            examples: ['操作が少し分かりにくかった', 'BGMが大きくて効果音が聞こえない',
                       '正直ちょっと単調だった。後半に変化があるともっと良いと思う',
                       '2面でバグって先に進めなかった', '色づかいが見づらい']
          },
          question: {
            what: '作品や作り方についての質問',
            examples: ['何のソフトで作りましたか？', 'どれくらいかかりましたか']
          },
          insult: {
            what: '作者や他人への侮辱・悪口・嘲笑・人格攻撃・差別・からかい',
            not_for: '作品の欠点を指摘しているだけで、人を貶めていないもの',
            examples: ['作ったやつセンスない', '下手くそすぎて草', 'こんなの作って恥ずかしくないの？']
          },
          spam: {
            what: '作品と関係のない内容・宣伝・意味のない文字列・同じ文字の繰り返し',
            examples: ['あああああ', 'フォローしてね', 'wwwwwwww']
          },
          harmful: {
            what: '性的・暴力的・脅迫的な内容、個人情報（本名・住所・電話番号・SNSのID）の書き込み、犯罪や危険行為を勧める内容'
          }
        }
      },
      attacks_person: {
        type: 'noul',
        instructions: 'この投稿は、作者や特定の人物を侮辱・嘲笑・攻撃していますか。',
        criteria: {
          'true': '人（作者・部員・来場者など）を貶める言葉がある。例:「作者の頭が悪い」「センスゼロの奴」「キモい」「〇〇は下手」。' +
                  '作品への指摘を含んでいても、人を貶める言い方が混ざっていれば true',
          'false': '作品の出来・欠点・改善点について率直に述べているだけで、人を貶める言い方がない。' +
                   '例:「難しすぎる」「音が割れている」「つまらなかった、理由は〜」「ここを直すともっと良い」'
        }
      },
      unsafe: {
        type: 'noul',
        instructions: 'この投稿は、学校の公開サイトに載せてはいけない内容を含みますか。',
        criteria: {
          'true': '性的・暴力的・脅迫・差別的な表現、または本名・住所・電話番号・SNSのIDなどの個人情報、犯罪や危険行為の勧めがある',
          'false': 'どれにも当てはまらない（辛口の感想や作品への指摘は false）'
        }
      }
    }
  };
}

/* Jev の答えから、公開する／確認待ち／公開しない を決める。
   通信をしない純粋な関数なので、しきい値の調整はここだけ見ればよい。 */
function decide(answers) {
  var a = answers || {};
  var atk = num(a.attacks_person && a.attacks_person.noul);
  var bad = num(a.unsafe && a.unsafe.noul);
  var p = (a.kind && a.kind.probabilities) || {};
  var kind = (a.kind && a.kind.choice) || '';
  var s = { attack: atk, unsafe: bad, kind: kind };

  if (bad >= TH.reject || num(p.harmful) >= TH.reject) return verdict('rejected', '不適切な内容', s);
  if (atk >= TH.reject || num(p.insult) >= TH.reject)  return verdict('rejected', '人への侮辱', s);
  if (num(p.spam) >= TH.spam)                          return verdict('rejected', '作品と関係のない投稿', s);
  if (atk >= TH.hold || bad >= TH.hold)                return verdict('held', '侮辱・不適切の疑い（あいまい）', s);

  var good = num(p.praise) + num(p.feedback) + num(p.question);
  if (good >= TH.good) return verdict('published', kind === 'feedback' ? '作品への指摘・改善案' : '感想・質問', s);
  return verdict('held', '種類の判定があいまい', s);
}
function verdict(status, reason, s) { return { status: status, reason: reason, scores: s }; }
function num(v) { v = Number(v); return isFinite(v) ? v : 0; }

function judgeComment(post) {
  var key = prop('JEV_API_KEY');
  if (!key) return verdict('held', 'Jev 未設定のため確認待ち', {});

  var payload = JSON.stringify(jevRequest(post));
  for (var attempt = 0; attempt < 3; attempt++) {
    var res;
    try {
      res = UrlFetchApp.fetch(JEV_URL, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + key },
        payload: payload,
        muteHttpExceptions: true
      });
    } catch (err) {
      Utilities.sleep(600 * Math.pow(2, attempt));
      continue;
    }
    var code = res.getResponseCode();
    if (code === 200) {
      try { return decide(JSON.parse(res.getContentText()).answers); }
      catch (e) { return verdict('held', 'Jev の答えを読めなかった', {}); }
    }
    /* 混雑（429 / 529）とサーバー側の不調だけ待って再試行する */
    if (code === 429 || code >= 500) { Utilities.sleep(600 * Math.pow(2, attempt)); continue; }
    return verdict('held', 'Jev エラー ' + code, {});
  }
  /* 審査できなかったものは公開しない（荒らしを通さない側に倒す） */
  return verdict('held', 'Jev に繋がらなかった', {});
}

/* 投稿者に返す文言。判定の数字や理由の細部は見せない。 */
var MESSAGES = {
  published: 'ありがとうございます。載せました。',
  held:      'ありがとうございます。部員が確認してから載せます。',
  insult:    'この書き方のままだと載せられません。作品への指摘や改善案は大歓迎です。' +
             '人を傷つける言い方になっていないか、見直してもらえますか。',
  spam:      '作品と関係のない投稿は載せていません。',
  slow:      '続けて送るときは、少し待ってからどうぞ。'
};


/* =========================================================
   入り口
   ========================================================= */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'summary') {
    return json({ ok: true, hearts: heartCounts() });
  }
  if (action === 'comments') {
    return json({ ok: true, items: readComments(String((e.parameter && e.parameter.slug) || '')) });
  }
  /* 動作確認用。ブラウザで /exec をそのまま開くとこれが出ます。 */
  return json({ ok: true, message: '昆布観測島の裏側は動いています', time: new Date().toISOString(),
                jev: !!prop('JEV_API_KEY') });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: '受け取った中身を読めませんでした' });
  }

  try {
    if (body.action === 'survey')  return json(saveSurvey(body));
    if (body.action === 'comment') return json(saveComment(body));
    if (body.action === 'heart')   return json(saveHeart(body));
    return json({ ok: false, error: '知らない action です: ' + body.action });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}


/* =========================================================
   1. アンケート
   ========================================================= */
function saveSurvey(b) {
  sheet(SHEET.survey).appendRow([
    new Date(),
    clean(b.rating, 10),
    clean(b.who, 40),
    clean(b.favWork, 80),
    clean(b.genre, 80),
    clean(b.interest, 40),
    clean(b.found, 40),
    clean(b.comment, 1000)
  ]);
  return { ok: true };
}


/* =========================================================
   2. ひとこと（コメント）

   ブラウザは Firebase に直接書けない（docs/firebase-rules.json で閉じてある）。
   必ずここを通り、Jev の審査で「公開」になったものだけを
   この裏側が Firebase に書く。全件をシートに残すので、あとから
   部員が「公開」列を手で切り替えて、syncComments() で反映できる。
   ========================================================= */
function saveComment(b) {
  var slug = clean(b.slug, 80);
  var text = clean(b.text, COMMENT_MAX);
  if (!slug) return { ok: false, error: '作品が指定されていません' };
  if (!text) return { ok: false, error: 'ひとことを書いてください' };

  var name = clean(b.name, NAME_MAX) || 'ななし';
  var title = clean(b.title, 80);
  var device = clean(b.id, 40);

  /* 連投よけ：同じ端末からは 15 秒に1件、1時間に 12 件まで */
  if (device && !allowPost(device)) return { ok: false, status: 'slow', message: MESSAGES.slow };

  var v = judgeComment({ title: title, name: name, text: text });
  var fid = '';
  if (v.status === 'published') {
    try {
      fid = fbPush(slug, { name: name, text: text, at: { '.sv': 'timestamp' } });
    } catch (err) {
      /* Jev は通ったが Firebase に書けなかった。落とさずに確認待ちへ */
      v = verdict('held', 'Firebase に書けなかった: ' + String(err).slice(0, 80), v.scores);
    }
  }

  var sc = v.scores || {};
  sheet(SHEET.comment).appendRow([
    new Date(), slug, name, text, v.status === 'published',
    v.status, v.reason,
    sc.attack === undefined ? '' : round2(sc.attack),
    sc.unsafe === undefined ? '' : round2(sc.unsafe),
    sc.kind || '', device, fid
  ]);
  cacheDrop('comments:' + slug);

  var msg = v.status === 'published' ? MESSAGES.published
          : v.status === 'held'      ? MESSAGES.held
          : v.reason === '作品と関係のない投稿' ? MESSAGES.spam
          : MESSAGES.insult;
  return { ok: true, status: v.status, message: msg };
}

function allowPost(device) {
  var cache = CacheService.getScriptCache();
  var lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (e) { return true; }
  try {
    if (cache.get('rl:' + device)) return false;
    var hourKey = 'rlh:' + device;
    var n = Number(cache.get(hourKey) || 0);
    if (n >= 12) return false;
    cache.put('rl:' + device, '1', 15);
    cache.put(hourKey, String(n + 1), 3600);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* Firebase を使わない構成のときだけ、ブラウザはここから読む。
   「公開」が TRUE の行だけを返す。 */
function readComments(slug) {
  if (!slug) return [];

  var hit = cacheGet('comments:' + slug);
  if (hit) return hit;

  var sh = sheet(SHEET.comment);
  var last = sh.getLastRow();
  var out = [];
  if (last >= 2) {
    var rows = sh.getRange(2, 1, last - 1, 5).getValues();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (String(r[C.slug - 1]) !== slug) continue;
      if (!isTrue(r[C.pub - 1])) continue;
      out.push({
        at: r[0] ? new Date(r[0]).toISOString() : '',
        name: String(r[C.name - 1] || 'ななし'),
        text: String(r[C.text - 1] || '')
      });
    }
  }
  out.reverse();                 /* 新しいものが上 */
  out = out.slice(0, 60);
  cachePut('comments:' + slug, out, 30);
  return out;
}

/* ---- 部員の手直しを Firebase に反映する ----
   シート「コメント」の「公開」列を
     FALSE → TRUE にしたもの … Firebase に載せる（確認待ち・却下の救済）
     TRUE → FALSE にしたもの … Firebase から消す（すり抜けた荒らしの削除）
   「判定」列が空の行（この仕組みより前の古い行）には触らない。 */
function syncComments() {
  var sh = sheet(SHEET.comment);
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var width = HEADERS[SHEET.comment].length;
  var rows = sh.getRange(2, 1, last - 1, width).getValues();
  var changed = 0;

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], rowNo = i + 2;
    var state = String(r[C.verdict - 1] || '');
    if (!state) continue;
    var slug = String(r[C.slug - 1] || '');
    var fid = String(r[C.fid - 1] || '');
    var pub = isTrue(r[C.pub - 1]);

    if (pub && !fid && slug) {
      var at = r[C.at - 1] ? new Date(r[C.at - 1]).getTime() : { '.sv': 'timestamp' };
      var id = fbPush(slug, { name: String(r[C.name - 1] || 'ななし'), text: String(r[C.text - 1] || ''), at: at });
      sh.getRange(rowNo, C.fid).setValue(id);
      sh.getRange(rowNo, C.verdict).setValue('approved');
      cacheDrop('comments:' + slug);
      changed++;
    } else if (!pub && fid && slug) {
      fbDelete(slug, fid);
      sh.getRange(rowNo, C.fid).setValue('');
      sh.getRange(rowNo, C.verdict).setValue('removed');
      cacheDrop('comments:' + slug);
      changed++;
    }
  }
  return changed;
}


/* =========================================================
   Firebase Realtime Database（REST）

   ブラウザは ref('comments/' + encodeURIComponent(slug)) で読んでいる。
   つまりキーは「%E4%BD…」という文字列そのもの。REST の URL は
   サーバー側で一度デコードされるので、同じキーに届けるには
   もう一度エンコードする（% → %25）。

   認証は2通り。どちらでもルールを越えて書ける（管理者扱い）。
     1. docs/appsscript.json の権限を入れた場合 … このスクリプトの持ち主の
        Google アカウントで書く（Firebase プロジェクトの持ち主と同じアカウント）
     2. スクリプト プロパティ FIREBASE_SECRET … データベースのシークレット
   ========================================================= */
function fbKey(slug) { return encodeURIComponent(encodeURIComponent(slug)); }

function fbUrl(path) {
  var base = (prop('FIREBASE_DB_URL') || FIREBASE_DB_URL).replace(/\/+$/, '');
  var secret = prop('FIREBASE_SECRET');
  var q = secret ? 'auth=' + encodeURIComponent(secret) : 'access_token=' + ScriptApp.getOAuthToken();
  return base + '/' + path + '.json?' + q;
}

function fbPush(slug, item) {
  var res = UrlFetchApp.fetch(fbUrl('comments/' + fbKey(slug)), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(item),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 120));
  return JSON.parse(res.getContentText()).name;
}

function fbDelete(slug, id) {
  var res = UrlFetchApp.fetch(fbUrl('comments/' + fbKey(slug) + '/' + encodeURIComponent(id)), {
    method: 'delete',
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 120));
}


/* =========================================================
   スプレッドシートのメニュー（開いたときに「昆布観測島」が出る）
   ========================================================= */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('昆布観測島')
    .addItem('ひとことの公開／非公開を反映する', 'syncCommentsFromMenu')
    .addItem('Jev と Firebase の接続を確認する', 'checkConnections')
    .addSeparator()
    .addItem('5分ごとに自動で反映する（初回だけ）', 'installSyncTrigger')
    .addToUi();
}

function syncCommentsFromMenu() {
  var n = syncComments();
  SpreadsheetApp.getUi().alert(n ? n + ' 件を反映しました。' : '反映するものはありませんでした。');
}

function installSyncTrigger() {
  var exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'syncComments'; });
  if (!exists) ScriptApp.newTrigger('syncComments').timeBased().everyMinutes(5).create();
  SpreadsheetApp.getUi().alert(exists ? 'すでに有効です。' : '5分ごとの自動反映を有効にしました。');
}

/* 辛口の指摘・侮辱・ふつうの感想を1件ずつ Jev に聞いて、結果を見せる。
   Firebase は読むだけ（書き込みはしない）。 */
function checkConnections() {
  var lines = [];
  if (!prop('JEV_API_KEY')) {
    lines.push('Jev: スクリプト プロパティに JEV_API_KEY がありません（全件「確認待ち」になります）');
  } else {
    var samples = [
      ['楽しかった！BGMが好きです', 'published'],
      ['操作が分かりにくくて2面で詰んだ。説明があると助かる', 'published'],
      ['つまらない。作ったやつセンスなさすぎ', 'rejected']
    ];
    samples.forEach(function (s) {
      var v = judgeComment({ title: 'テスト作品', name: 'テスト', text: s[0] });
      lines.push('Jev: 「' + s[0] + '」→ ' + v.status + '（' + v.reason + '）' + (v.status === s[1] ? '' : '  ← 想定は ' + s[1]));
    });
  }
  try {
    var res = UrlFetchApp.fetch(fbUrl('comments/' + fbKey('接続確認') + '/_'), { muteHttpExceptions: true });
    lines.push('Firebase: ' + (res.getResponseCode() === 200 ? '読み書きの権限あり' : 'HTTP ' + res.getResponseCode() + '（README の 6-10 を確認）'));
  } catch (err) {
    lines.push('Firebase: ' + String(err));
  }
  SpreadsheetApp.getUi().alert(lines.join('\n\n'));
}


/* =========================================================
   3. ハート

   1行1操作の追記だけにして、数え上げは合計で出します。
   追記は速く、同時に押されても壊れません。
   同じ端末が何度押しても、最後の状態だけを数えます。
   （表示用の数は Firebase 側。こちらは記録として残る）
   ========================================================= */
function saveHeart(b) {
  var slug = clean(b.slug, 80);
  var id = clean(b.id, 40);
  if (!slug || !id) return { ok: false, error: '作品か端末IDがありません' };

  sheet(SHEET.heart).appendRow([new Date(), slug, id, b.on ? 1 : -1]);
  cacheDrop('hearts');

  var counts = heartCounts();
  return { ok: true, count: counts[slug] || 0 };
}

function heartCounts() {
  var hit = cacheGet('hearts');
  if (hit) return hit;

  var sh = sheet(SHEET.heart);
  var last = sh.getLastRow();
  var byWork = {};
  if (last >= 2) {
    var rows = sh.getRange(2, 2, last - 1, 3).getValues();   /* 作品 / 端末ID / 増減 */
    var state = {};
    for (var i = 0; i < rows.length; i++) {
      var slug = String(rows[i][0]);
      var id = String(rows[i][1]);
      if (!slug || !id) continue;
      /* タブ区切りにしておけば、作品名に空白が入っても取り違えない */
      state[slug + '\t' + id] = Number(rows[i][2]) > 0 ? 1 : 0;
    }
    Object.keys(state).forEach(function (k) {
      if (!state[k]) return;
      var slug = k.split('\t')[0];
      byWork[slug] = (byWork[slug] || 0) + 1;
    });
  }
  cachePut('hearts', byWork, 25);
  return byWork;
}


/* =========================================================
   道具
   ========================================================= */
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* 制御文字を落として、長さを切りそろえる */
function clean(v, max) {
  var s = (v === null || v === undefined) ? '' : String(v);
  s = s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return s.length > max ? s.slice(0, max) : s;
}

function isTrue(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function round2(v) { return Math.round(num(v) * 100) / 100; }

function prop(k) {
  try { return PropertiesService.getScriptProperties().getProperty(k) || ''; } catch (e) { return ''; }
}

function sheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  var head = HEADERS[name];
  if (!sh) {
    sh = ss.insertSheet(name);
    if (head) {
      sh.appendRow(head);
      sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  } else if (head && sh.getLastColumn() < head.length) {
    /* 古いシートに、新しく増えた見出しだけを右に足す */
    var from = sh.getLastColumn() + 1;
    sh.getRange(1, from, 1, head.length - from + 1).setValues([head.slice(from - 1)]).setFontWeight('bold');
  }
  return sh;
}

/* 数え上げを毎回やるとページが重くなるので、少しだけ覚えておく。 */
function cacheGet(key) {
  try {
    var v = CacheService.getScriptCache().get(key);
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}
function cachePut(key, val, sec) {
  try { CacheService.getScriptCache().put(key, JSON.stringify(val), sec); } catch (e) {}
}
function cacheDrop(key) {
  try { CacheService.getScriptCache().remove(key); } catch (e) {}
}
