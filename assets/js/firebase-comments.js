/* =========================================================
   firebase-comments.js — 「ひとこと」の即時読み書き（Firebase Realtime Database）

   firebase-hearts.js と同じ理屈で、Apps Script の代わりに使う。
   config.js の firebase.databaseURL が空なら、何もつながずに
   CCMComments.enabled=false のまま諦める（呼び出し側の app.js が
   その場合は Apps Script にフォールバックする）。

   1件ずつ push() で追記する、書き換え・削除ができない一方向のログ。
   荒らし対策のモデレーションは今のところ無い（docs/firebase-rules.json
   で長さの上限だけは弾く）。必要になったら、公開フラグを足すなど
   ハート側と同じ発想で拡張できる。
   ========================================================= */
window.CCMComments = (function () {
  'use strict';

  var CFG = (window.CCM && window.CCM.firebase) || {};
  var ON = !!(CFG.databaseURL && window.firebase && window.firebase.initializeApp);
  var db = null;

  if (ON) {
    try {
      var app = (firebase.apps && firebase.apps.length) ? firebase.apps[0] : firebase.initializeApp(CFG);
      db = firebase.database(app);
    } catch (e) {
      ON = false;
    }
  }

  function path(slug) { return 'comments/' + encodeURIComponent(slug); }

  /* ---- 新しい60件を、新しい順で読む ---- */
  function list(slug) {
    if (!ON) return Promise.resolve(null);
    return db.ref(path(slug)).orderByChild('at').limitToLast(60).once('value')
      .then(function (snap) {
        var out = [];
        snap.forEach(function (child) {
          var v = child.val() || {};
          out.push({
            at: typeof v.at === 'number' ? new Date(v.at).toISOString() : '',
            name: String(v.name || 'ななし'),
            text: String(v.text || '')
          });
        });
        out.reverse();   /* 新しいものが上 */
        return out;
      })
      .catch(function () { return null; });
  }

  /* ---- 1件書く ---- */
  function add(slug, name, text) {
    if (!ON) return Promise.resolve(false);
    var n = String(name || '').slice(0, 20);
    var t = String(text || '').slice(0, 200);
    if (!t) return Promise.resolve(false);
    return db.ref(path(slug)).push({
      name: n,
      text: t,
      at: firebase.database.ServerValue.TIMESTAMP
    }).then(function () { return true; }).catch(function () { return false; });
  }

  return { enabled: ON, list: list, add: add };
})();
