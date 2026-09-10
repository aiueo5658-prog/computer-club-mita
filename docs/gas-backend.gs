/* =========================================================
   gas-backend.gs — 昆布観測島 の裏側（Google Apps Script）

   これ1本で3つを受け持ちます。
     1. アンケートの回答  → シート「アンケート」
     2. 作品へのコメント  → シート「コメント」
     3. 作品へのハート    → シート「ハート」

   置き方は README の「裏側（スプレッドシート）の用意」を見てください。
   ざっくり言うと、スプレッドシートを1つ作って
   「拡張機能 > Apps Script」にこの中身を貼り、ウェブアプリとして
   「アクセスできるユーザー: 全員」でデプロイするだけです。

   出てきた /exec の URL を assets/js/config.js の apiUrl に貼れば繋がります。
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

/* 見出し行。シートが無ければこの通りに作ります。 */
var HEADERS = {
  'アンケート': ['日時', '満足度', 'あなたについて', '一番よかった作品',
                 '面白かったジャンル', '部への興味', 'どこで知ったか', '自由記述'],
  'コメント':   ['日時', '作品', 'なまえ', '本文', '公開'],
  'ハート':     ['日時', '作品', '端末ID', '増減']
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
  return json({ ok: true, message: '昆布観測島の裏側は動いています', time: new Date().toISOString() });
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
   2. コメント
   ========================================================= */
function saveComment(b) {
  var slug = clean(b.slug, 80);
  var text = clean(b.text, COMMENT_MAX);
  if (!slug) return { ok: false, error: '作品が指定されていません' };
  if (!text) return { ok: false, error: 'ひとことを書いてください' };

  var name = clean(b.name, NAME_MAX) || 'ななし';
  sheet(SHEET.comment).appendRow([new Date(), slug, name, text, true]);

  /* 貼り出しは即時。消したいときはシートの「公開」を FALSE にするか、
     行ごと消してください。次に読むときには反映されます。 */
  cacheDrop('comments:' + slug);
  return { ok: true };
}

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
      if (String(r[1]) !== slug) continue;
      if (r[4] === false || String(r[4]).toUpperCase() === 'FALSE') continue;
      out.push({
        at: r[0] ? new Date(r[0]).toISOString() : '',
        name: String(r[2] || 'ななし'),
        text: String(r[3] || '')
      });
    }
  }
  out.reverse();                 /* 新しいものが上 */
  out = out.slice(0, 60);
  cachePut('comments:' + slug, out, 30);
  return out;
}


/* =========================================================
   3. ハート

   1行1操作の追記だけにして、数え上げは合計で出します。
   追記は速く、同時に押されても壊れません。
   同じ端末が何度押しても、最後の状態だけを数えます。
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

function sheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    var head = HEADERS[name];
    if (head) {
      sh.appendRow(head);
      sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
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
