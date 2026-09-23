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
     カーソルに少し寄る（磁石）。見た目だけで、当たり判定はいじらない。
     （押した点から輪が広がる演出は、どこにでもある既製品っぽさが
     強かったので外した）
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
  }

  /* =====================================================
     見出しを一文字ずつ立ち上げる（[data-split]）
     文字を <span class="ch"><i>字</i></span> に組み直し、.split-in で動かす。
     中の <span> や <br> はそのまま残す（ホームの「ようこそ」「//」など）。
     読み上げ用に、元の文を aria-label に置いておく。
     ===================================================== */
  var SPLIT_MS = 36, RISE_MS = 950;
  function splitNode(el) {
    var text = el.textContent;
    el.setAttribute('aria-label', text.replace(/\s+/g, ' ').trim());
    var n = 0;
    (function walk(node) {
      [].slice.call(node.childNodes).forEach(function (k) {
        if (k.nodeType === 3) {
          var frag = d.createDocumentFragment();
          Array.from(k.nodeValue).forEach(function (c) {
            if (/\s/.test(c)) { frag.appendChild(d.createTextNode(c)); return; }
            var s = d.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true');
            var i = d.createElement('i'); i.textContent = c; i.style.setProperty('--ci', n++);
            s.appendChild(i); frag.appendChild(s);
          });
          node.replaceChild(frag, k);
        } else if (k.nodeType === 1 && k.tagName !== 'BR' && !k.classList.contains('ch')) {
          walk(k);
        }
      });
    })(el);
    el._split = text;
    el._chars = n;
  }
  function playSplit(el) {
    el.classList.remove('split-in', 'split-done');
    void el.offsetWidth;                                /* 同じ要素でもう一度動かすため */
    el.classList.add('split-in');
    clearTimeout(el._doneT);
    el._doneT = setTimeout(function () { el.classList.add('split-done'); },
                           RISE_MS + (el._chars || 0) * SPLIT_MS + 300);
  }
  function splits() {
    var els = [].slice.call(d.querySelectorAll('[data-split]'));
    if (!els.length || REDUCE) return;
    els.forEach(splitNode);

    /* 導入画面（初回のホーム）の間は、導入の中の見出しだけを動かす。
       導入が明けたら、残りを動かす。 */
    var locked = d.body.classList.contains('intro-lock');
    els.forEach(function (el) { if (!locked || el.closest('.intro')) playSplit(el); });
    if (locked) {
      var mo = new MutationObserver(function () {
        if (d.body.classList.contains('intro-lock')) return;
        mo.disconnect();
        els.forEach(function (el) { if (!el.closest('.intro')) playSplit(el); });
      });
      mo.observe(d.body, { attributes: true, attributeFilter: ['class'] });
    }

    /* 中身を差し替えられたら（作品一覧でジャンルを切り替えたとき）組み直す。
       文が変わったときだけ、もう一度立ち上げる。 */
    els.forEach(function (el) {
      new MutationObserver(function () {
        if (el.querySelector('.ch')) return;            /* 自分で組み直した直後 */
        var changed = el.textContent !== el._split;
        splitNode(el);
        if (changed) playSplit(el);
      }).observe(el, { childList: true });
    });
  }

  /* =====================================================
     文字の読み出し（観測装置の表示が切り替わる感じ）
     左から順に、でたらめな字が本来の字に落ち着く。
     ===================================================== */
  var POOL = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモラリルレロ0123456789ABCDEF';
  function decode(el, text, ms) {
    text = String(text == null ? '' : text);
    if (!el) return;
    if (el._decodeRaf) cancelAnimationFrame(el._decodeRaf);
    if (REDUCE) { el.textContent = text; return; }
    var dur = ms || 560, t0 = null, chars = Array.from(text);
    function frame(now) {
      if (t0 === null) t0 = now;
      var k = Math.min(1, (now - t0) / dur), out = '';
      for (var i = 0; i < chars.length; i++) {
        var at = 0.25 + 0.75 * (i / Math.max(1, chars.length));
        out += (k >= at || /\s/.test(chars[i])) ? chars[i] : POOL.charAt((Math.random() * POOL.length) | 0);
      }
      el.textContent = out;
      if (k < 1) el._decodeRaf = requestAnimationFrame(frame);
      else el._decodeRaf = 0;
    }
    el._decodeRaf = requestAnimationFrame(frame);
  }

  /* =====================================================
     カーソルに応える奥行き
     星空（.bg）と観測窓（.scope）に --px / --py（-1〜1）を書く。
     ルートに書くと重い作品一覧まで毎回計算し直すので、使う要素にだけ書く。
     ===================================================== */
  function pointer() {
    if (REDUCE || !(w.matchMedia && w.matchMedia('(pointer: fine)').matches)) return;
    var targets = [].slice.call(d.querySelectorAll('.bg, .scope'));
    if (!targets.length) return;
    var tx = 0, ty = 0, x = 0, y = 0, running = false;
    function step() {
      x += (tx - x) * 0.07; y += (ty - y) * 0.07;
      targets.forEach(function (t) {
        t.style.setProperty('--px', x.toFixed(4));
        t.style.setProperty('--py', y.toFixed(4));
      });
      if (Math.abs(tx - x) > 0.0008 || Math.abs(ty - y) > 0.0008) requestAnimationFrame(step);
      else running = false;
    }
    d.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX / w.innerWidth * 2 - 1;
      ty = e.clientY / w.innerHeight * 2 - 1;
      if (!running) { running = true; requestAnimationFrame(step); }
    }, { passive: true });
  }

  /* =====================================================
     ナビの下線は1本だけ。狙ったリンクへ滑り、離れると現在地に戻る。
     現在地と狙い先が同時に光ると、どちらが現在地か読めなくなるため。
     ===================================================== */
  function navInk() {
    var nav = d.querySelector('.nav-links');
    if (!nav) return;
    var ink = d.createElement('i');
    ink.className = 'nav-ink'; ink.setAttribute('aria-hidden', 'true');
    nav.appendChild(ink);
    var cur = nav.querySelector('.is-on');
    function to(el) {
      if (!el || !nav.contains(el)) { ink.style.opacity = '0'; return; }
      var r = el.getBoundingClientRect(), p = nav.getBoundingClientRect();
      ink.style.transform = 'translateX(' + (r.left - p.left).toFixed(1) + 'px) scaleX(' + r.width.toFixed(1) + ')';
      ink.style.opacity = '1';
    }
    function place() {
      ink.style.transition = 'none'; to(cur); void ink.offsetWidth; ink.style.transition = '';
    }
    nav.addEventListener('pointerover', function (e) { to(e.target.closest('a, button')); });
    nav.addEventListener('pointerleave', function () { to(cur); });
    nav.addEventListener('focusin', function (e) { to(e.target.closest('a, button')); });
    nav.addEventListener('focusout', function () { to(cur); });
    place();
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(place);   /* 書体が届いてから測り直す */
    w.addEventListener('resize', place, { passive: true });
  }

  /* =====================================================
     スマホのメニュー
     狭い画面ではナビのリンクが隠れるので、右上のボタンから全画面で開く。
     中身はナビのリンクを写すだけ（ページごとに書き足さなくてよい）。
     ===================================================== */
  function mobileMenu() {
    var links = d.querySelector('.nav-links'), end = d.querySelector('.nav-end');
    if (!links || !end) return;
    var btn = d.createElement('button');
    btn.type = 'button'; btn.className = 'menu-btn';
    btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'menu-sheet');
    btn.innerHTML = '<span class="sr">メニュー</span><i></i><i></i>';
    end.appendChild(btn);

    var sheet = d.createElement('nav');
    sheet.className = 'menu-sheet'; sheet.id = 'menu-sheet';
    sheet.setAttribute('aria-label', 'メニュー'); sheet.hidden = true;
    var list = d.createElement('ol');
    var items = [].slice.call(links.querySelectorAll('a, button'));
    var survey = end.querySelector('a.cta');
    if (survey) items.push(survey);
    items.forEach(function (el, i) {
      var a = d.createElement('a');
      /* 作品一覧のページでは、ナビの「作品一覧」がボタンなのでリンクに直す */
      a.href = el.getAttribute('href') || 'works.html';
      a.textContent = el.textContent.trim();
      a.style.setProperty('--mi', i);
      if (el.classList.contains('is-on') || el.getAttribute('aria-current')) a.setAttribute('aria-current', 'page');
      var li = d.createElement('li'); li.appendChild(a); list.appendChild(li);
    });
    sheet.appendChild(list);
    var foot = d.createElement('p'); foot.className = 'menu-foot';
    foot.textContent = '// MIF 2026  10月31日(土)・11月1日(日)';
    sheet.appendChild(foot);
    d.body.appendChild(sheet);

    function set(open) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      d.documentElement.classList.toggle('menu-open', open);
      if (open) { sheet.hidden = false; requestAnimationFrame(function () { sheet.classList.add('on'); });
        var first = sheet.querySelector('a'); if (first) setTimeout(function () { first.focus(); }, 60); }
      else { sheet.classList.remove('on'); setTimeout(function () { if (!sheet.classList.contains('on')) sheet.hidden = true; }, REDUCE ? 0 : 320); }
    }
    btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true'); });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); }
    });
    w.addEventListener('resize', function () { if (w.innerWidth > 820) set(false); }, { passive: true });
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
    splits();
    pointer();
    navInk();
    mobileMenu();
    requestAnimationFrame(function () { d.body.classList.add('ready'); });
  }

  w.CCMSite = { stars: stars, reveal: reveal, countTo: countTo, decode: decode };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

})(window, document);
