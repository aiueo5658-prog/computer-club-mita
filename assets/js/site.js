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

  /* =====================================================
     ナビの下線
     下線は全体で1本だけ持つ。狙ったタブへ、いまいる場所から
     滑って動く。狙うのをやめたら現在地へ戻る。
     ===================================================== */
  function navInk() {
    var host = d.querySelector('.nav-links');
    if (!host) return;
    var items = Array.prototype.slice.call(host.querySelectorAll('a,button'));
    if (!items.length) return;

    var ink = d.createElement('span');
    ink.className = 'nav-ink';
    ink.setAttribute('aria-hidden', 'true');
    host.appendChild(ink);

    var current = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].classList.contains('is-on')) { current = items[i]; break; }
    }

    function moveTo(target, animate) {
      if (!target) { ink.classList.remove('on'); return; }
      if (!animate) ink.style.transition = 'none';
      ink.style.width = target.offsetWidth + 'px';
      ink.style.transform = 'translateX(' + target.offsetLeft + 'px)';
      ink.classList.add('on');
      if (!animate) { void ink.offsetWidth; ink.style.transition = ''; }
    }

    /* 書体が届く前に測ると幅がずれるので、届いてから置き直す */
    moveTo(current, false);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { moveTo(current, false); });

    items.forEach(function (b) {
      b.addEventListener('pointerenter', function () { moveTo(b, true); });
      b.addEventListener('focus', function () { moveTo(b, true); });
    });
    host.addEventListener('pointerleave', function () { moveTo(current, true); });
    host.addEventListener('focusout', function (e) {
      if (!host.contains(e.relatedTarget)) moveTo(current, true);
    });

    var t;
    w.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { moveTo(current, false); }, 120);
    }, { passive: true });
  }

  function start() {
    navInk();
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
    requestAnimationFrame(function () { d.body.classList.add('ready'); });
  }

  w.CCMSite = { stars: stars };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

})(window, document);
