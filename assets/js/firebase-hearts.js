/* =========================================================
   firebase-hearts.js — ハートの即時カウント（Firebase Realtime Database）

   config.js の firebase.databaseURL が空、または Firebase の
   スクリプト自体が読み込めていない（オフライン等）ときは、
   何もつながずに黙って諦める。呼び出し側（app.js）は
   CCMHearts.enabled を見て、無効なら今まで通り Apps Script の
   まとめ取得にフォールバックする。

   スラッグをそのまま Realtime Database のキーにはできない
   （ / . # $ [ ] が使えない）ため、encodeURIComponent で包む。
   ========================================================= */
window.CCMHearts = (function () {
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

  function key(slug) { return 'hearts/' + encodeURIComponent(slug) + '/count'; }

  /* ---- 1件だけ、今の数を読む ---- */
  function get(slug) {
    if (!ON) return Promise.resolve(null);
    return db.ref(key(slug)).once('value')
      .then(function (snap) { var v = snap.val(); return typeof v === 'number' ? v : 0; })
      .catch(function () { return null; });
  }

  /* ---- ＋1 / −1 する。サーバー側で加算するので、同時に何件
     来ても正しく積み上がる（取りこぼし・逆転が起きない）。
     表示側はこの結果を待たず、押した瞬間に自分で ±1 する運用
     なので、ここは投げっぱなしでよい。 ---- */
  function bump(slug, delta) {
    if (!ON) return Promise.resolve(null);
    return db.ref(key(slug)).set(firebase.database.ServerValue.increment(delta))
      .then(function () { return true; })
      .catch(function () { return false; });
  }

  return { enabled: ON, get: get, bump: bump };
})();
