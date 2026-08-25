/* =========================================================
   site.js — 全ページ共通

   ・背景の星を撒く（最小間隔を守るので固まらない）
   ・ページ間の移動に切り替えの間を入れる
   ========================================================= */
(function (w, d) {
  'use strict';

  /* =====================================================
     星
     ===================================================== */
  function stars(host, seed) {
    if (!host) return;
    var vw = w.innerWidth || d.documentElement.clientWidth;
    var vh = Math.max(w.innerHeight || 0, d.documentElement.clientHeight || 0,
                      d.body ? d.body.scrollHeight : 0);
    if (!vw || !vh) return;

    var s = seed || 20261;
    var rnd = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    var pts = [], MIN2 = 76 * 76, tries = 0;
    var want = Math.round((vw * vh) / 26000);

    host.innerHTML = '';
    while (pts.length < want && tries < 12000) {
      tries++;
      var x = Math.round(rnd() * (vw - 16)) + 8;
      var y = Math.round(rnd() * (vh - 16)) + 8;
      var ok = true;
      for (var i = 0; i < pts.length; i++) {
        var dx = pts[i].x - x, dy = pts[i].y - y;
        if (dx * dx + dy * dy < MIN2) { ok = false; break; }
      }
      if (!ok) continue;
      var b = rnd();
      pts.push({ x: x, y: y, d: b > 0.85 ? 2.6 : (b > 0.6 ? 1.9 : 1.3),
                 o: (0.18 + rnd() * 0.5).toFixed(2) });
    }
    pts.forEach(function (p) {
      var n = d.createElement('i');
      n.style.cssText = 'left:' + p.x + 'px;top:' + p.y + 'px;width:' + p.d +
                        'px;height:' + p.d + 'px;opacity:' + p.o;
      host.appendChild(n);
    });
  }

  /* =====================================================
     ページの切り替え
     View Transitions が使える環境はそれに任せ、
     使えない環境では手前で暗転させてから移動する。
     ===================================================== */
  function transitions() {
    var supported = !!d.startViewTransition;
    /* 対応している側ではなく、していない側に印をつける。
       印が付く前の一瞬に、代わりの動きが走ってしまうのを避けるため。 */
    d.documentElement.classList.toggle('novt', !supported);
    if (supported) return;   /* CSS 側の @view-transition が受け持つ */

    d.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      var url;
      try { url = new URL(href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;

      e.preventDefault();
      d.body.classList.add('leaving');
      setTimeout(function () { location.href = url.href; }, 240);
    });

    /* 戻ってきたときに暗転が残らないようにする */
    w.addEventListener('pageshow', function () { d.body.classList.remove('leaving'); });
  }

  var REDUCE = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =====================================================
     スクロールで現れる
     [data-reveal] を付けた要素と、その直下の子を、
     画面に入ったタイミングで浮かび上がらせる。
     動きを控える設定のときは、そのまま出す。
     ===================================================== */
  function reveal() {
    var hosts = d.querySelectorAll('[data-reveal]');
    if (!hosts.length) return;

    if (REDUCE || !('IntersectionObserver' in w)) {
      hosts.forEach(function (h) { h.classList.add('in'); });
      return;
    }

    hosts.forEach(function (h) {
      var kids = h.querySelectorAll('[data-reveal-item]');
      (kids.length ? kids : [h]).forEach(function (k, i) {
        k.style.setProperty('--ri', i);
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

    hosts.forEach(function (h) { io.observe(h); });
  }

  /* =====================================================
     数字を数え上げる
     読み込みが終わって値が入った瞬間に、0 からではなく
     直前の表示値から動かす。データが後から来ても不自然にならない。
     ===================================================== */
  function countTo(el, value, ms) {
    if (!el) return;
    var from = parseInt(el.textContent, 10); if (isNaN(from)) from = 0;
    var to = parseInt(value, 10); if (isNaN(to)) { el.textContent = value; return; }
    if (REDUCE || from === to) { el.textContent = to; return; }
    var t0 = null, dur = ms || 700;
    function tick(now) {
      if (t0 === null) t0 = now;
      var k = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(tick);
      else el.textContent = to;
    }
    requestAnimationFrame(tick);
  }

  /* =====================================================
     ボタンの手ざわり
     カーソルに寄る（磁石）のと、押した点から輪が広がるのと。
     どちらも見た目だけで、当たり判定はいじらない。
     ===================================================== */
  function buttonFeel() {
    if (REDUCE) return;
    /* 磁石で寄るのは本物のボタンだけ。チップや一覧の行にまで
       効かせると、押せる場所がぼやけて雑然と見える。 */
    var sel = '.cta, .ghost';
    var PULL = 10;

    d.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var b = e.target.closest(sel);
      if (!b || b.dataset.noMagnet) return;
      var r = b.getBoundingClientRect();
      var mx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      var my = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      b.style.setProperty('--mx', (mx * PULL).toFixed(1) + 'px');
      b.style.setProperty('--my', (my * PULL * 0.6).toFixed(1) + 'px');
    }, { passive: true });

    d.addEventListener('pointerleave', function (e) {
      var b = e.target.closest && e.target.closest(sel);
      if (b) { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); }
    }, true);

    d.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('.cta, .ghost');
      if (!b) return;
      var r = b.getBoundingClientRect();
      var ring = d.createElement('i');
      ring.className = 'ripple';
      var s = Math.max(r.width, r.height) * 1.8;
      ring.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' +
        (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
      b.appendChild(ring);
      ring.addEventListener('animationend', function () { ring.remove(); });
    });
  }

  function start() {
    var host = d.getElementById('stars');
    if (host) {
      stars(host);
      var t;
      w.addEventListener('resize', function () {
        clearTimeout(t);
        t = setTimeout(function () { stars(host); }, 200);
      }, { passive: true });
    }
    transitions();
    reveal();
    buttonFeel();
    requestAnimationFrame(function () { d.body.classList.add('ready'); });
  }

  w.CCMSite = { stars: stars, reveal: reveal, countTo: countTo };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

})(window, document);
