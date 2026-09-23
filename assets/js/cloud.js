/* =========================================================
   cloud.js — 裏側（Google スプレッドシート）との細い窓口

   config.js の apiUrl が空のときは、何も繋がずに黙って諦めます。
   繋がっていなくてもサイトが壊れないように、失敗はすべて握りつぶし、
   呼び出し側には「使えなかった」とだけ返します。

   送信は Content-Type を text/plain にしています。application/json に
   すると preflight（OPTIONS）が飛びますが、Apps Script はそれに答えて
   くれないため必ず失敗します。中身は JSON のままで問題ありません。
   ========================================================= */
window.CCMCloud = (function () {
  'use strict';

  var CFG = (window.CCM || {});
  var URL_ = (CFG.apiUrl || '').trim();
  var ON = /^https:\/\/script\.google\.com\//.test(URL_);

  /* ---- この端末を表す番号。ハートの付け外しに使う ---- */
  var ID_KEY = 'ccm-device';
  function deviceId() {
    try {
      var v = localStorage.getItem(ID_KEY);
      if (!v) {
        v = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        localStorage.setItem(ID_KEY, v);
      }
      return v;
    } catch (e) {
      /* 保存できない環境では、その場限りの番号でしのぐ */
      return 'tmp' + Math.random().toString(36).slice(2, 10);
    }
  }

  function get(params) {
    if (!ON) return Promise.resolve(null);
    var q = Object.keys(params)
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
    return fetch(URL_ + '?' + q, { method: 'GET' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function post(body) {
    if (!ON) return Promise.resolve(null);
    return fetch(URL_, {
      method: 'POST',
      /* text/plain にして preflight を避ける。中身は JSON。 */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* ---- ハートの数をまとめて取る（作品一覧の表示用）----
     取得に失敗しても（Apps Script が固まった、圏外だった等）、
     空のキャッシュを確定として覚えてしまうと、以後ずっと数字が
     出なくなる。失敗した回は覚えず、次に呼ばれたときにもう一度
     取りに行けるようにする。 */
  var heartsCache = null;
  function hearts(force) {
    if (heartsCache && !force) return Promise.resolve(heartsCache);
    return get({ action: 'summary' }).then(function (res) {
      if (res && res.ok && res.hearts) heartsCache = res.hearts;
      return heartsCache || {};
    });
  }

  /* ---- ハートを付ける・外す。新しい数を返す ----
     裏側は「この端末の最後の操作」だけを数えるので、連打で複数の
     リクエストが同時に飛ぶと、届いた順序が送った順序と入れ替わる
     ことがあり、最終状態が逆転してしまう（例：好き→取消の順で押した
     のに、通信の遅れで 取消→好き の順に届き、結局「好き」のまま
     集計される）。作品ごとに前の送信が終わるまで次を送らないよう
     直列化し、届く順序＝押した順序を保証する。 */
  var heartQueue = {};
  function heart(slug, on) {
    var wait = heartQueue[slug] || Promise.resolve();
    var run = wait['catch'](function () {}).then(function () {
      return post({ action: 'heart', slug: slug, on: !!on, id: deviceId() })
        .then(function (res) {
          if (res && res.ok && typeof res.count === 'number') {
            if (heartsCache) heartsCache[slug] = res.count;
            return res.count;
          }
          return null;
        });
    });
    heartQueue[slug] = run;
    return run;
  }

  /* ---- コメントを読む ---- */
  function comments(slug) {
    return get({ action: 'comments', slug: slug }).then(function (res) {
      return (res && res.ok && res.items) ? res.items : null;
    });
  }

  /* ---- ひとことを書く ----
     裏側が Jev で審査し、公開してよいものだけを Firebase に載せる。
     返り値は { status: 'published' | 'held' | 'rejected' | 'slow', message }。
     通信に失敗したときは null。 */
  function addComment(slug, name, text, title) {
    return post({ action: 'comment', slug: slug, name: name, text: text, title: title || '', id: deviceId() })
      .then(function (res) {
        if (!res) return null;
        if (res.status) return { status: res.status, message: res.message || '' };
        /* 審査の入る前の裏側（古いデプロイ）は status を返さない。
           その場合もシートには残っているので「確認待ち」として扱う。 */
        return res.ok ? { status: 'held', message: '' } : null;
      });
  }

  /* ---- アンケートを送る ---- */
  function survey(answers) {
    var body = { action: 'survey' };
    Object.keys(answers || {}).forEach(function (k) { body[k] = answers[k]; });
    return post(body).then(function (res) { return !!(res && res.ok); });
  }

  return {
    enabled: ON,
    deviceId: deviceId,
    hearts: hearts,
    heart: heart,
    comments: comments,
    addComment: addComment,
    survey: survey
  };
})();
