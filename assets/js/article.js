/* =========================================================
   article.js — 記事の一覧（articles.html）と、記事の本文（article.html）

   一覧も本文の頭（見出し・表紙）も articles.js のデータから、
   このファイルが読まれた瞬間に組み立てる。site.js より前に読むこと
   （見出しの一文字ずつの立ち上がりと、ページ切り替えで写し取られるのに
   間に合わせるため）。本文は articles/<slug>/article.md を読んでから組む。

   本文の Markdown の書き方は README の「記事を足す」。要点だけ：
     ## ① 章の見出し          … 章。直後の *一行* は章のリード
     **名前：** せりふ          … 発言。名前は articles.js の people の short か name
     > **【注釈】用語（よみ）**  … 用語の注。広い画面では本文の右の余白に出る
     > **【引用】**             … 話し手の言葉を大きく抜き出す
     > **【リード文】** / **【プロフィール】名前（よみ）**
     ![説明](img/xx.webp) ![説明](img/yy.webp)  … 1行に並べると横に並ぶ
     @[youtube](https://youtu.be/xxxx)      … YouTube の動画。押すまでは写真だけ（軽く、YouTube にもつながない）
     *キャプション*             … 画像の直後の行
     【画像：…】 と（キャプション例：…）、（※…）は編集メモとして出さない
   ========================================================= */
(function (w, d) {
  'use strict';

  var DATA = w.CCMArticles || { list: [] };
  var LIST = (DATA.list || []).slice().sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.no - a.no; });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function kindEn(a) { return a.kind === 'autobiography' ? 'autobiography' : 'interview'; }
  function fmtDate(s) { var m = /^(\d{4})-(\d{1,2})/.exec(s || ''); return m ? m[1] + '.' + pad2(+m[2]) : ''; }
  function titleHTML(a) {
    /* 改行位置はデータ側で指定できる（titleLines）。無ければそのまま */
    return a.titleLines ? a.titleLines.map(function (l) { return '<span class="tl">' + esc(l) + '</span>'; }).join('') : esc(a.title);
  }
  function person(a, role) {
    for (var i = 0; i < a.people.length; i++) if (a.people[i].role === role) return a.people[i];
    return null;
  }

  /* ---------- 一覧のカード ---------- */
  function peopleHTML(a, cls) {
    return '<div class="' + cls + '">' + a.people.map(function (p) {
      return '<span class="pp"><img src="' + esc(p.icon) + '" alt="" width="40" height="40" loading="lazy">' +
             '<span><small>' + esc(p.label) + '</small>' + esc(p.name) + '</span></span>';
    }).join('<i class="pp-x" aria-hidden="true">×</i>') + '</div>';
  }

  function cardHTML(a, feature) {
    var s = a.coverSize || [16, 9];
    return '<a class="acard' + (feature ? ' acard--feature' : '') + '" href="article.html?id=' + encodeURIComponent(a.slug) + '">' +
      '<span class="acard-cover" style="view-transition-name:cover-' + esc(a.slug) + ';view-transition-class:cover">' +
        '<img src="' + esc(a.cover) + '" alt="' + esc(a.coverAlt || '') + '" width="' + s[0] + '" height="' + s[1] + '"' +
        (feature ? ' fetchpriority="high"' : ' loading="lazy"') + '>' +
      '</span>' +
      '<span class="acard-body">' +
        '<span class="acard-kick">' + kindEn(a) + ' ' + pad2(a.no) + '</span>' +
        '<span class="acard-title">' + titleHTML(a) + '</span>' +
        '<span class="acard-sub">' + esc(a.sub) + '</span>' +
        (feature ? '<span class="acard-ex">' + esc(a.excerpt) + '</span>' : '') +
        peopleHTML(a, 'acard-people') +
        '<span class="acard-meta"><span>' + fmtDate(a.date) + '</span><span>約' + a.readMin + '分</span>' +
          '<span class="acard-go">読む</span></span>' +
      '</span>' +
    '</a>';
  }

  /* 新しいものを大きく1枚、残りを下に並べる。
     まだ書かれていない回は、空の枠を並べず1行で知らせる。 */
  function renderList(host, except) {
    var items = LIST.filter(function (a) { return a.slug !== except; });
    var html = '';
    if (!except && items.length) html += cardHTML(items.shift(), true);
    if (items.length) html += '<div class="acard-row">' + items.map(function (a) { return cardHTML(a, false); }).join('') + '</div>';
    var left = (DATA.planned || 0) - LIST.length;
    if (left > 0) html += '<p class="arts-next">次の記事は準備中です。全' + DATA.planned + '回の予定で、順に公開します。</p>';
    host.innerHTML = html;
  }

  /* =====================================================
     本文の Markdown を読む
     ===================================================== */
  var CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮';

  function inline(s) {
    s = s.replace(/（※[^）]*）/g, '');                 /* 編集メモ */
    s = esc(s);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return s;
  }

  function parse(md, a) {
    var lines = md.replace(/\r\n?/g, '\n').split('\n');
    var out = { lead: '', profile: null, coverCap: '', chapters: [], pre: [] };
    var cur = out.pre, chNo = 0, i = 0;
    var speakers = {};
    a.people.forEach(function (p) { speakers[p.short] = p; speakers[p.name] = p; });

    function next() { return lines[i + 1] === undefined ? '' : lines[i + 1].trim(); }

    while (i < lines.length) {
      var L = lines[i].trim();

      if (!L || L === '---' || /^#\s/.test(L)) { i++; continue; }
      if (/^\*\*聞き手[：:]/.test(L)) { i++; continue; }
      if (/^【画像[：:]/.test(L)) { if (/^（キャプション例/.test(next())) i++; i++; continue; }
      if (/^（キャプション例/.test(L)) { i++; continue; }

      var m;
      if ((m = /^##\s+(.+)$/.exec(L))) {
        var t = m[1].trim(), c0 = t.charAt(0), no;
        if (CIRCLED.indexOf(c0) >= 0) { no = CIRCLED.indexOf(c0) + 1; t = t.slice(1).trim(); }
        else no = chNo + 1;
        chNo = no;
        var ch = { no: no, title: t, deck: '', blocks: [] };
        i++;
        while (i < lines.length && !lines[i].trim()) i++;
        var dm = /^\*([^*].*)\*$/.exec((lines[i] || '').trim());
        if (dm) { ch.deck = dm[1]; i++; }
        out.chapters.push(ch);
        cur = ch.blocks;
        continue;
      }

      if (L.charAt(0) === '>') {
        var q = [];
        while (i < lines.length && lines[i].trim().charAt(0) === '>') {
          q.push(lines[i].trim().replace(/^>\s?/, '')); i++;
        }
        var hm = /^\*\*【([^】]+)】(.*?)\*\*$/.exec(q[0] || '');
        var kind = hm ? hm[1] : '', head = hm ? hm[2].trim() : '';
        var body = hm ? q.slice(1) : q;
        if (kind === 'リード文') { out.lead = body.join(''); continue; }
        if (kind === 'プロフィール') {
          var pr = { head: head, org: '', items: [] };
          body.forEach(function (b) {
            var om = /^（所属[：:](.+)）$/.exec(b);
            if (om) { pr.org = om[1]; return; }
            var im = /^-\s*(\S+?)[\s　]+(.+)$/.exec(b);
            if (im) pr.items.push({ when: im[1], what: im[2] });
          });
          out.profile = pr;
          continue;
        }
        if (kind === '引用') { cur.push({ t: 'quote', text: body.join('') }); continue; }
        /* 注釈（ほかの見出しも同じ扱い） */
        /* 注釈は余白に浮かせるので、その言葉が章の中で最初に出てくる発言の
           直前に差し込む。md に書いた位置のままだと、言葉よりずっと下に出てしまう */
        var note = { t: 'note', kind: kind || '注釈', head: head, body: body };
        var term = (/^(.+?)（.+）$/.exec(head) || [0, head])[1].trim().toLowerCase(), at = -1;
        if (term) for (var k = 0; k < cur.length; k++) {
          var txt = cur[k].t === 'say' ? cur[k].paras.join('') : cur[k].t === 'p' ? cur[k].text : '';
          if (txt && txt.toLowerCase().indexOf(term) >= 0) { at = k; break; }
        }
        if (at >= 0) cur.splice(at, 0, note); else cur.push(note);
        continue;
      }

      var vm = /^@\[youtube\]\(([^)\s]+)\)$/.exec(L);
      if (vm) {
        var vcap = '', cm2 = /^\*([^*].*)\*$/.exec(next());
        if (cm2) { vcap = cm2[1]; i++; }
        i++;
        var vid = youtubeId(vm[1]);
        if (vid) cur.push({ t: 'video', id: vid, cap: vcap });
        continue;
      }

      if (/^!\[/.test(L)) {
        var imgs = [], re = /!\[([^\]]*)\]\(([^)\s]+)\)/g, im2;
        while ((im2 = re.exec(L))) imgs.push({ alt: im2[1], src: im2[2] });
        var cap = '';
        var cm = /^\*([^*].*)\*$/.exec(next());
        if (cm) { cap = cm[1]; i++; }
        i++;
        /* 表紙と同じ画像は、表紙のキャプションにだけ使う */
        if (imgs.length === 1 && a.cover.slice(-imgs[0].src.length) === imgs[0].src) { out.coverCap = cap; continue; }
        cur.push({ t: 'fig', imgs: imgs, cap: cap });
        continue;
      }

      var sm = /^\*\*([^*：:]+)[：:]\*\*\s*(.*)$/.exec(L);
      if (sm && speakers[sm[1].trim()]) {
        var say = { t: 'say', who: speakers[sm[1].trim()], paras: [sm[2]] };
        i++;
        while (i < lines.length) {
          var n2 = lines[i].trim();
          if (!n2 || /^(#|>|!\[|---|【|\*\*[^*]+[：:]\*\*)/.test(n2)) break;
          say.paras.push(n2); i++;
        }
        cur.push(say);
        continue;
      }

      var em = /^\*([^*].*)\*$/.exec(L);
      cur.push({ t: em ? 'aside' : 'p', text: em ? em[1] : L });
      i++;
    }
    return out;
  }

  /* youtu.be/ID ・ watch?v=ID ・ embed/ID ・ shorts/ID のどれからでも ID を取り出す */
  function youtubeId(u) {
    var m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/.exec(u || '');
    return m ? m[1] : '';
  }

  /* ---------- 組み立て ---------- */
  var figNo = 0;
  function blockHTML(b, a, base) {
    if (b.t === 'p') return '<p>' + inline(b.text) + '</p>';
    if (b.t === 'aside') return '<p class="art-aside">' + inline(b.text) + '</p>';
    if (b.t === 'say') {
      var p = b.who;
      return '<div class="say say--' + p.role + '">' +
        '<img class="say-icon" src="' + esc(p.icon) + '" alt="" width="44" height="44" loading="lazy">' +
        '<div class="say-main"><p class="say-name">' + esc(p.short) + '</p>' +
          b.paras.map(function (t) { return '<p>' + inline(t) + '</p>'; }).join('') +
        '</div></div>';
    }
    if (b.t === 'quote') {
      var s = person(a, 'subject');
      return '<figure class="pq"><blockquote>' + inline(b.text) + '</blockquote>' +
             (s ? '<figcaption>' + esc(s.name) + '</figcaption>' : '') + '</figure>';
    }
    if (b.t === 'note') {
      var hm = /^(.+?)（(.+)）$/.exec(b.head);
      var term = hm ? hm[1] : b.head, yomi = hm ? hm[2] : '';
      var items = [], paras = [];
      b.body.forEach(function (x) {
        var lm = /^-\s+(.+)$/.exec(x);
        if (lm) items.push('<li>' + inline(lm[1]) + '</li>');
        else if (x.trim()) paras.push('<p>' + inline(x) + '</p>');
      });
      return '<aside class="note" aria-label="注：' + esc(term) + '">' +
        '<p class="note-term">' + esc(term) + (yomi ? '<small>' + esc(yomi) + '</small>' : '') + '</p>' +
        paras.join('') + (items.length ? '<ul>' + items.join('') + '</ul>' : '') +
      '</aside>';
    }
    if (b.t === 'video') {
      var label = b.cap ? b.cap.replace(/[*]/g, '') : 'YouTube の動画';
      return '<figure class="fig fig--video">' +
        '<button type="button" class="yt" data-yt="' + esc(b.id) + '" aria-label="再生：' + esc(label) + '">' +
          '<img src="https://i.ytimg.com/vi/' + esc(b.id) + '/hqdefault.jpg" alt="" loading="lazy" width="480" height="360">' +
          '<span class="yt-play" aria-hidden="true"></span>' +
        '</button>' +
        (b.cap ? '<figcaption>' + inline(b.cap) + '</figcaption>' : '') + '</figure>';
    }
    if (b.t === 'fig') {
      var cells = b.imgs.map(function (im) {
        var k = figNo++;
        return '<button type="button" class="fig-cell" data-fig="' + k + '" aria-label="拡大：' + esc(im.alt) + '">' +
               '<img src="' + esc(base + im.src) + '" alt="' + esc(im.alt) + '" loading="lazy" decoding="async"></button>';
      }).join('');
      return '<figure class="fig fig--n' + b.imgs.length + '"><div class="fig-imgs">' + cells + '</div>' +
             (b.cap ? '<figcaption>' + inline(b.cap) + '</figcaption>' : '') + '</figure>';
    }
    return '';
  }

  function profileHTML(pr, a) {
    var s = person(a, 'subject');
    var hm = /^(.+?)（(.+)）$/.exec(pr.head || '');
    return '<section class="prof" aria-label="プロフィール">' +
      '<div class="prof-id">' +
        (s ? '<img class="prof-icon" src="' + esc(s.icon) + '" alt="' + esc(s.name) + 'さん" width="120" height="120">' : '') +
        '<p class="prof-name">' + esc(hm ? hm[1] : (s && s.name) || pr.head) + '</p>' +
        '<p class="prof-yomi">' + esc(hm ? hm[2] : (s && s.reading) || '') + '</p>' +
        (pr.org ? '<p class="prof-org">所属 ' + esc(pr.org) + '</p>' : '') +
      '</div>' +
      '<ol class="prof-line">' + pr.items.map(function (it) {
        var dm = /^(\d{4})年(\d{1,2})月$/.exec(it.when);
        var when = dm ? dm[1] + '<span>.' + pad2(+dm[2]) + '</span>' : esc(it.when);
        return '<li><time>' + when + '</time><p>' + inline(it.what) + '</p></li>';
      }).join('') + '</ol>' +
    '</section>';
  }

  /* =====================================================
     記事の本文ページ
     ===================================================== */
  function reader() {
    var host = d.getElementById('art');
    if (!host) return;
    var id = (/[?&]id=([^&#]+)/.exec(location.search) || [])[1];
    var a = null;
    LIST.forEach(function (x) { if (x.slug === decodeURIComponent(id || '')) a = x; });
    if (!a) {
      d.title = '記事が見つかりません — // 昆布観測島';
      host.innerHTML = '<div class="art-missing"><p class="doc-kick">404</p><h1 class="doc-title">記事が見つかりません</h1>' +
        '<p class="doc-lede">リンクが古いのかもしれません。<a href="articles.html">記事の一覧</a>から探してください。</p></div>';
      return;
    }
    d.title = a.title + ' — // 昆布観測島';
    var md = d.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', a.excerpt);

    var s = a.coverSize || [16, 9];
    host.innerHTML =
      '<header class="art-hero">' +
        '<div class="art-hero-txt">' +
          '<p class="art-kick"><a href="articles.html">Articles</a> / ' + kindEn(a) + ' ' + pad2(a.no) + '</p>' +
          '<h1 class="art-title" data-split>' + titleHTML(a) + '</h1>' +
          '<p class="art-sub">' + esc(a.sub) + '</p>' +
          '<div class="art-meta">' + peopleHTML(a, 'art-people') +
            '<p class="art-facts"><span>' + fmtDate(a.date) + '</span><span>約' + a.readMin + '分</span></p></div>' +
        '</div>' +
        '<figure class="art-cover" style="view-transition-name:cover-' + esc(a.slug) + ';view-transition-class:cover">' +
          '<img src="' + esc(a.cover) + '" alt="' + esc(a.coverAlt || '') + '" width="' + s[0] + '" height="' + s[1] + '" fetchpriority="high">' +
          '<figcaption id="art-cover-cap"></figcaption>' +
        '</figure>' +
      '</header>' +
      '<div class="art-layout">' +
        '<nav class="art-toc" id="art-toc" aria-label="目次"></nav>' +
        '<article class="art-body" id="art-body" aria-busy="true"><p class="art-loading">本文を読み込んでいます…</p></article>' +
      '</div>' +
      '<section class="art-more" aria-labelledby="art-more-h">' +
        '<h2 class="art-more-h" id="art-more-h">ほかの記事</h2>' +
        '<div class="arts-list" id="art-more-list"></div>' +
        '<p class="art-back"><a class="ghost" href="articles.html">記事の一覧へ</a></p>' +
      '</section>';

    renderList(d.getElementById('art-more-list'), a.slug);

    var base = a.md.replace(/[^/]*$/, '');
    fetch(a.md, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) { fill(parse(text, a), a, base); })
      .catch(function () {
        var b = d.getElementById('art-body');
        b.removeAttribute('aria-busy');
        b.innerHTML = '<p class="art-loading">本文を読み込めませんでした。通信の具合を確かめて、もう一度開いてください。</p>';
      });

    progress();
  }

  function fill(doc, a, base) {
    var body = d.getElementById('art-body');
    var cap = d.getElementById('art-cover-cap');
    if (cap && doc.coverCap) cap.innerHTML = inline(doc.coverCap);

    figNo = 0;
    var html = '';
    if (doc.lead) html += '<p class="art-lead">' + inline(doc.lead) + '</p>';
    if (doc.profile) html += profileHTML(doc.profile, a);
    html += doc.pre.map(function (b) { return blockHTML(b, a, base); }).join('');
    html += doc.chapters.map(function (ch) {
      return '<section class="chap" id="ch-' + ch.no + '" aria-labelledby="ch-' + ch.no + '-h">' +
        '<header class="chap-head"><p class="chap-no">' + pad2(ch.no) + '</p>' +
          '<h2 class="chap-title" id="ch-' + ch.no + '-h">' + inline(ch.title) + '</h2>' +
          (ch.deck ? '<p class="chap-deck">' + inline(ch.deck) + '</p>' : '') + '</header>' +
        ch.blocks.map(function (b) { return blockHTML(b, a, base); }).join('') +
      '</section>';
    }).join('');
    html += '<footer class="art-credit">' + a.people.map(function (p) {
        return '<p><span>' + esc(p.label) + '</span>' + esc(p.name) + '</p>';
      }).join('') + '</footer>';

    body.innerHTML = html;
    body.removeAttribute('aria-busy');

    var toc = d.getElementById('art-toc');
    if (toc && doc.chapters.length) {
      toc.innerHTML = '<p class="toc-kick">目次</p><ol>' + doc.chapters.map(function (ch) {
        return '<li><a href="#ch-' + ch.no + '"><span>' + pad2(ch.no) + '</span>' + inline(ch.title) + '</a></li>';
      }).join('') + '</ol>';
    }

    shape(body);
    videos(body);
    tocSpy(toc);
    lightbox(body);
    if (location.hash) { var t = d.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }

  /* 並んだ画像は高さをそろえる（横幅を縦横比で分ける）。
     縦長の画像が1枚だけのときは、高くなりすぎないよう幅を絞る。 */
  function shape(root) {
    [].forEach.call(root.querySelectorAll('.fig-cell img'), function (img) {
      function set() {
        if (!img.naturalWidth) return;
        var r = img.naturalWidth / img.naturalHeight;
        img.parentNode.style.setProperty('--r', r.toFixed(4));
        img.setAttribute('width', img.naturalWidth); img.setAttribute('height', img.naturalHeight);
        img.parentNode.classList.add('is-in');
        var fig = img.closest('.fig--n1');
        if (fig) fig.style.setProperty('--r', r.toFixed(4));
      }
      if (img.complete) set(); else img.addEventListener('load', set);
    });
  }

  /* 動画は押したときだけ YouTube を読み込む（ページが重くならず、見ない人の情報も YouTube に渡らない） */
  function videos(root) {
    [].forEach.call(root.querySelectorAll('.yt'), function (btn) {
      btn.addEventListener('click', function () {
        var f = d.createElement('iframe');
        f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(btn.getAttribute('data-yt')) + '?autoplay=1&rel=0';
        f.title = btn.getAttribute('aria-label').replace(/^再生：/, '');
        f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        f.allowFullscreen = true;
        f.className = 'yt-frame';
        btn.replaceWith(f);
        f.focus();
      });
    });
  }

  /* 目次：いま読んでいる章に印をつける */
  function tocSpy(toc) {
    if (!toc || !('IntersectionObserver' in w)) return;
    var links = {};
    [].forEach.call(toc.querySelectorAll('a'), function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.toggle('is-on', k === e.target.id); });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    [].forEach.call(d.querySelectorAll('.chap'), function (s) { io.observe(s); });
  }

  /* 読んだ分だけ、ナビの下の線が伸びる */
  function progress() {
    var bar = d.createElement('div');
    bar.className = 'art-progress'; bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<i></i>';
    d.body.appendChild(bar);
    var fillEl = bar.firstChild, ticking = false;
    function upd() {
      ticking = false;
      var h = d.documentElement.scrollHeight - w.innerHeight;
      fillEl.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, Math.max(0, w.scrollY / h)) : 0).toFixed(4) + ')';
    }
    w.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    w.addEventListener('resize', upd, { passive: true });
    upd();
  }

  /* 画像を押すと大きく見られる。左右キーで前後の画像へ */
  function lightbox(root) {
    var cells = [].slice.call(root.querySelectorAll('.fig-cell'));
    if (!cells.length) return;
    var dlg = d.createElement('dialog');
    dlg.className = 'lb';
    dlg.setAttribute('aria-label', '画像');
    dlg.innerHTML = '<figure class="lb-fig"><img alt=""><figcaption><span class="lb-n"></span><span class="lb-c"></span></figcaption></figure>' +
      '<button type="button" class="lb-x" aria-label="閉じる"><i></i><i></i></button>' +
      '<button type="button" class="lb-p" aria-label="前の画像">←</button><button type="button" class="lb-q" aria-label="次の画像">→</button>';
    d.body.appendChild(dlg);
    var img = dlg.querySelector('img'), num = dlg.querySelector('.lb-n'), cap = dlg.querySelector('.lb-c'), at = 0;

    function show(k) {
      at = (k + cells.length) % cells.length;
      var src = cells[at].querySelector('img');
      img.src = src.currentSrc || src.src; img.alt = src.alt;
      var fc = cells[at].closest('figure').querySelector('figcaption');
      cap.textContent = fc ? fc.textContent : src.alt;
      num.textContent = pad2(at + 1) + ' / ' + pad2(cells.length);
    }
    cells.forEach(function (c, k) {
      c.addEventListener('click', function () { show(k); dlg.showModal(); d.documentElement.classList.add('lb-open'); });
    });
    dlg.addEventListener('close', function () {
      d.documentElement.classList.remove('lb-open');
      cells[at].focus();
    });
    dlg.querySelector('.lb-x').addEventListener('click', function () { dlg.close(); });
    dlg.querySelector('.lb-p').addEventListener('click', function () { show(at - 1); });
    dlg.querySelector('.lb-q').addEventListener('click', function () { show(at + 1); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(at - 1);
      if (e.key === 'ArrowRight') show(at + 1);
    });
  }

  /* =====================================================
     起動
     ===================================================== */
  var listHost = d.getElementById('arts-list');
  if (listHost) renderList(listHost, null);
  reader();

  w.CCMArticle = { parse: parse };
})(window, document);
