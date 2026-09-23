/* =========================================================
   firebase-comments.js — 「ひとこと」の即時読み取り（Firebase Realtime Database）

   読むのはここ（速い）、書くのは裏側（cloud.js → Apps Script）。
   ブラウザから Firebase へ直接は書けない（docs/firebase-rules.json で
   閉じてある）。裏側が Jev で審査して、公開してよいものだけを載せるため。

   config.js の firebase.databaseURL が空なら、何もつながずに
   CCMComments.enabled=false のまま諦める（呼び出し側の app.js が
   その場合は Apps Script から読む）。
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

  /* このキーの作り方は docs/gas-backend.gs の fbKey() と対になっている */
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

  return { enabled: ON, list: list };
})();
