/* =========================================================
   app.js — // 昆布観測島 作品展 2026

   場面はひとつ。太陽系は1つだけ存在し、衛星は最初から
   その惑星の子として在る。動くのはカメラだけ。
   ========================================================= */
(function (w, d) {
  'use strict';

  var CFG = w.CCM || {};
  var Data = w.CCMData;

  var $  = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  function el(tag, cls) { var n = d.createElement(tag); if (cls) n.className = cls; return n; }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, cls) { var n = d.createElementNS(SVGNS, tag); if (cls) n.setAttribute('class', cls); return n; }

  /* 実サムネイルが無い作品の代替。thumbs.js の CCMThumbs.make に
     渡すだけの薄いラッパー。作品名＋制作者を種にするので、
     同じ作品にはいつも同じ絵が出る。 */
  function drawThumb(wk, cat) {
    return w.CCMThumbs.make(wk.title + '/' + wk.author, 160, { hue: cat.hue });
  }
  /* 外部は http(s) だけ。このサイトの games/ に置いたゲームは相対パスで許す */
  function safeUrl(u) { u = String(u || '').trim(); return (/^https?:\/\//i.test(u) || /^(games|works)\/[\w.-]+/.test(u)) ? u : ''; }
  function hue(h) { return 'oklch(0.86 0.15 ' + h + ')'; }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h);
  }

  /* 画面寸法。枠の初期化前は innerWidth が 0 を返すことがある。 */
  function vp() {
    var vw = w.innerWidth || d.documentElement.clientWidth || 0;
    var vh = w.innerHeight || d.documentElement.clientHeight || 0;
    return { w: vw, h: vh, ok: vw > 0 && vh > 0 };
  }

  /* ---- 配置の定数（画面幅から実寸を出す） ---- */
  var K = 1.75;            /* 潜ったときの倍率 */
  var DUR_CAT = 182;       /* ジャンルの公転周期（秒） */
  var geo = { cx:0, cy:0, R:245, satR:100, satD:50, shells:[] };

  /* ---- 作品の輪：本物の透視投影で置く ----
     作品は「傾いた円」の上に等間隔で並ぶ。円を斜めから見るから楕円に見える、
     という順番で計算する。楕円を直接描いていた前のやり方だと、
     手前どうしの大きさの差が出なかった。 */
  var PITCH0 = 22 * Math.PI / 180;  /* 既定の見下ろし角 */
  var PERSP  = 2.0;                 /* カメラまでの距離 ÷ 輪の半径。小さいほど遠近が強い */
  var GAPMIN = 0.26;                /* 隣とのすき間（直径の何倍か） */
  var PMIN   = -88 * Math.PI / 180, PMAX = 88 * Math.PI / 180;

  /* カメラの向き。左右＝yaw、上下＝pitch。中心の位置は動かさない。 */
  var cam = { yaw: 0, pitch: PITCH0 };

  /* 輪の上の角度 phi を画面に落とす。
     s は「近いほど大きい」倍率で、位置にも大きさにもそのまま効く。 */
  function proj(phi, r, pitch) {
    var sp = Math.sin(phi), cp = Math.cos(phi);
    var z = sp * Math.cos(pitch);              /* +がこちら側 */
    var s = PERSP / (PERSP - z);
    return { x: r * cp * s, y: r * sp * Math.sin(pitch) * s, s: s, z: z };
  }

  /* 輪の組み合わせを実際に一周まわして、いちばん近い2つのすき間を測る。
     輪をまたいだ組み合わせもここで一緒に見る。 */
  function worstGap(rings, satD, pitch) {
    var worst = Infinity, PH = 36;
    for (var q = 0; q < PH; q++) {
      var X = [], Y = [], D = [];
      for (var i = 0; i < rings.length; i++) {
        var n = rings[i].count;
        for (var j = 0; j < n; j++) {
          var pt = proj((j / n + rings[i].ph + q / PH / Math.max(n, 1)) * Math.PI * 2,
                        rings[i].r, pitch);
          X.push(pt.x); Y.push(pt.y); D.push(satD * pt.s);
        }
      }
      for (var a = 0; a < X.length; a++) for (var b = a + 1; b < X.length; b++) {
        var dx = X[a] - X[b], dy = Y[a] - Y[b];
        var g = Math.sqrt(dx * dx + dy * dy) - (D[a] + D[b]) / 2;
        if (g < worst) worst = g;
      }
    }
    return worst;
  }

  /* 既定の向きで、この輪が画面のどこまで広がるか（ローカル座標） */
  function extent(r, satD, pitch) {
    var L = 0, R = 0, U = 0, Dn = 0;
    for (var k = 0; k < 180; k++) {
      var pt = proj(k / 180 * Math.PI * 2, r, pitch), h = satD * pt.s / 2;
      L = Math.max(L, -(pt.x - h)); R = Math.max(R, pt.x + h);
      U = Math.max(U, -(pt.y - h)); Dn = Math.max(Dn, pt.y + h);
    }
    return { l: L, r: R, u: U, d: Dn };
  }

  /* 原子の電子殻と同じ考え方。まず内側の輪を入るところまで広げ、
     広げきっても入らなければ外側にもう1本足す。
     定員は式ではなく worstGap で実測する。 */
  function planShells(n, satD, minR, rMax, pitch, minRings) {
    var i;
    /* minRings が 2 以上なら、1本で入っても輪を分ける（作品が多いジャンル用） */
    for (var r = minR; (minRings || 1) < 2 && r <= rMax; r += 5) {
      if (worstGap([{ r: r, count: n, ph: 0 }], satD, pitch) >= satD * GAPMIN)
        return [{ r: Math.round(r), count: n, ph: 0 }];
    }
    for (var m = 2; m <= 3; m++) {
      for (var step = satD * 1.2; step <= satD * 5; step += satD * 0.3) {
        if (rMax - (m - 1) * step < minR) break;
        for (var head = 1; head < n; head++) {
          var rings = [], left = n;
          for (i = 0; i < m; i++) {
            var take = (i === 0) ? head : Math.ceil(left / (m - i));
            rings.push({ r: Math.round(rMax - (m - 1 - i) * step), count: take, ph: i * 0.13 });
            left -= take;
            if (left <= 0) break;
          }
          if (left > 0) continue;
          if (worstGap(rings, satD, pitch) >= satD * GAPMIN) return rings;
        }
      }
    }
    return null;
  }

  var state = { zoom:null, ang:0, openSlug:null };
  var cats = [], nodes = {};

  /* =====================================================
     画面寸法から配置を決める
     ===================================================== */
  function layout() {
    var v = vp();
    if (!v.ok) return false;           /* 寸法が出るまで待つ */
    var vw = v.w, vh = v.h;
    var narrow = vw < 1180;

    /* 見出し・右パネル・ガイドを避けられるまで軌道を詰める。
       惑星のラベルは上の階層だけ、右パネルは潜ったときだけ出るので、
       同時には効かない制約として別々に判定する。 */
    var pad = Math.max(20, Math.min(vw * 0.034, 56));
    var heroRight = pad + Math.min(400, vw * 0.34) + 24;
    /* 右の一覧の実際の幅＋すき間。CSS で幅を変えても軌道がもぐり込まないよう、寸法は DOM から読む。 */
    var sideEl = $('#side');
    var sideRoom = vw >= 1180 ? ((sideEl && sideEl.offsetWidth) || 300) + 32 : 0;
    var guideRoom = vw >= 1180 ? 162 : (vw >= 820 ? 56 : 24);
    var topRoom = 92, LABEL = 140;
    var maxN = 1;
    cats.forEach(function (c) { if (c.works.length > maxN) maxN = c.works.length; });

    var R = Math.min(vw * 0.22, vh * 0.32, 245), guard = 0;
    /* スマホ幅では見出しの横に並べる余地がない。見出しの下、画面の中央に置く。 */
    if (vw < 700) {
      var half = (0.25 + maxN * 0.041) / 2;
      R = Math.min((vw / 2 - pad - 64) / (1 + half), vh * 0.2, 150);
      geo.cx = Math.round(vw / 2);
      geo.cy = Math.round(Math.min(vh - guideRoom - R * (1 + half) - 40,
                                   Math.max(vh * 0.62, 340 + R * (1 + half))));
      guard = 99;
    }
    for (; guard < 80; guard++) {
      var pd = R * (0.25 + maxN * 0.041);
      var cx = Math.max(vw * 0.5, heroRight + R + pd / 2);
      var cy = Math.max(topRoom + R + pd / 2,
                        Math.min(vh * 0.52, vh - guideRoom - R - pd / 2));
      /* 上の階層：惑星とその名札が収まるか */
      var okTop  = cx + R + pd / 2 + LABEL <= vw - pad;
      /* 潜ったとき：拡大した衛星の輪が右パネルを侵さないか */
      var okZoom = cx + R * 0.41 * K + R * 0.205 * K / 2 <= vw - pad - sideRoom;
      var okY    = cy - R - pd / 2 >= topRoom && cy + R + pd / 2 <= vh - guideRoom;
      if ((okTop && okZoom && okY) || R <= 110) {
        geo.cx = Math.round(cx); geo.cy = Math.round(cy); break;
      }
      R -= 4;
    }
    geo.R  = Math.round(R);
    geo.satR = Math.round(geo.R * 0.41);
    geo.satD = Math.round(geo.R * 0.205);

    var root = d.documentElement.style;
    root.setProperty('--cx', geo.cx + 'px');
    root.setProperty('--cy', geo.cy + 'px');
    root.setProperty('--R', geo.R + 'px');

    /* 輪の寸法は R からの比率 */
    $$('#ringgrp .ring').forEach(function (n) {
      var r = geo.R * parseFloat(n.getAttribute('data-r'));
      n.style.width = n.style.height = (r * 2) + 'px';
      n.style.margin = (-r) + 'px 0 0 ' + (-r) + 'px';
    });
    $$('#ringgrp .ec').forEach(function (n) {
      var s = geo.R * parseFloat(n.getAttribute('data-d'));
      n.style.width = n.style.height = s + 'px';
    });

    /* 既定の向きで画面に収まるまで、作品を少しずつ小さくする。
       上下左右それぞれの余白を、実際に投影して測ってから判定する。 */
    var pdMax = Math.round(geo.R * (0.25 + maxN * 0.041));
    var room = {
      l: (geo.cx - pad) / K,
      r: (vw - pad - sideRoom - geo.cx) / K,
      u: (geo.cy - topRoom) / K,
      d: (vh - guideRoom - geo.cy) / K
    };

    /* この大きさなら、輪をどこまで広げられるか */
    function widest(satD) {
      var best = 0;
      for (var rr = 40; rr <= 420; rr += 4) {
        var e = extent(rr, satD, PITCH0);
        if (e.l <= room.l && e.r <= room.r && e.u <= room.u && e.d <= room.d) best = rr;
        else break;
      }
      return best;
    }

    geo.shells = null;
    for (var sg = 0; sg < 16; sg++) {
      var minR = pdMax / 2 + geo.satD * 0.9;
      var rMax = widest(geo.satD);
      if (rMax > minR) geo.shells = planShells(maxN, geo.satD, minR, rMax, PITCH0);
      if (geo.shells) break;
      geo.satD = Math.round(geo.satD * 0.9);
      if (geo.satD < 20) break;
    }
    if (!geo.shells) geo.shells = [{ r: Math.round(geo.satR), count: maxN, ph: 0 }];
    geo.satR = geo.shells[0].r;

    d.documentElement.style.setProperty('--satd', geo.satD + 'px');

    cats.forEach(function (c) {
      var pd = Math.round(geo.R * (0.25 + c.works.length * 0.041));
      c.node.pos.style.setProperty('--rx', geo.R + 'px');
      c.node.body.style.setProperty('--d', pd + 'px');
      c.node.flag.style.setProperty('--fo', Math.round(pd / 2 + 15) + 'px');

      /* 作品の大きさはジャンルごとに決める。いちばん多いジャンルに合わせた
         geo.satD のままだと、作品の少ないジャンルはサムネが小さく見える。
         多いジャンルとの比の平方根ぶん（最大2.6倍）から始めて、入るまで縮める。 */
      var sd = Math.round(geo.satD * Math.min(2.6, Math.sqrt(maxN / c.works.length)));
      var shells = null, mR, xR;
      /* 作品が10点以上のジャンルは、軌道を2本に分けて並べる */
      var rings = c.works.length >= 10 ? 2 : 1;
      for (; sd > geo.satD; sd = Math.max(geo.satD, Math.round(sd * 0.92))) {
        mR = pd / 2 + sd * 0.9; xR = widest(sd);
        if (xR > mR) shells = planShells(c.works.length, sd, mR, xR, PITCH0, rings);
        if (shells) break;
      }
      if (!shells) {
        sd = geo.satD;
        mR = pd / 2 + sd * 0.9; xR = widest(sd);
        shells = (xR > mR && planShells(c.works.length, sd, mR, xR, PITCH0, rings)) || null;
        if (!shells && rings === 2 && xR > mR) {
          /* 重なりの判定を満たす2本が見つからなくても、2本に分ける。
             外を枠いっぱい、内を作品1つ半ぶん内側に置き、数は半径に比例して振る。
             内外で半周ずらして、前後で重なりにくくする。 */
          var n = c.works.length, rIn = Math.max(mR, xR - sd * 1.6);
          var nOut = Math.round(n * xR / (xR + rIn));
          shells = [{ r: Math.round(rIn), count: n - nOut, ph: 0.5 / Math.max(n - nOut, 1) },
                    { r: Math.round(xR),  count: nOut,     ph: 0 }];
        }
        if (!shells) shells = (xR > mR && planShells(c.works.length, sd, mR, xR, PITCH0)) || geo.shells;
      }
      c.node.satD = sd;
      c.node.satsys.style.setProperty('--satd', sd + 'px');
      c.node.shells = shells;
      c.node.pd = pd;

      c.node.rings.innerHTML = '';

      c.node.ringPitch = null;
      c.node.paths = shells.map(function () {
        /* 手前半分と奥半分は別々の svg にする。同じ svg に入れると
           中心の前後にレイヤーを分けられない。 */
        function layer(half) {
          var svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('class', 'orbsvg ' + half);
          svg.setAttribute('viewBox', '-500 -500 1000 1000');
          var path = d.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('class', 'orbline ' + half);
          svg.appendChild(path);
          c.node.rings.appendChild(svg);
          return path;
        }
        return { back: layer('back'), front: layer('front') };
      });

      var put = 0;
      shells.forEach(function (sh, i) {
        for (var j = 0; j < sh.count; j++) {
          /* planShells が使えないときの控え（geo.shells）は、この
             ジャンルの作品数に合わせて作られたものとは限らない。
             用意された席のほうが多いことがあるので、必ず数を確かめる。 */
          var wk = c.works[put++];
          if (!wk) break;
          var n = wk.node;
          n.r = sh.r;
          n.s0 = j / sh.count + sh.ph;
          n.period = 150 + i * 46;          /* 外の輪ほどゆっくり回る */
          n.body.style.setProperty('--d', sd + 'px');
        }
      });
    });
    /* 窓の大きさが変わると軌道の半径も変わる。潜ったままだと、
       クリックした時の角度のままではカメラが的を外す。引き直す。 */
    if (state.zoom) {
      var zc = catOf(state.zoom);
      if (zc) state.ang = angleOf(zc);
    }
    place(0);
    applyCamera(false);
    return true;
  }

  /* =====================================================
     カメラ：押したジャンルが、いま食のある一点に来るまで寄る
     ===================================================== */
  function applyCamera(animate) {
    var sys = $('#sys');
    if (!animate) sys.style.transition = 'none';
    if (!state.zoom) {
      sys.style.transform = 'translate(0px, 0px) scale(1)';
      d.documentElement.style.setProperty('--inv', '1');
      d.documentElement.style.setProperty('--kz', '1');
    } else {
      var th = state.ang * Math.PI / 180;
      var vx = geo.R * Math.cos(th), vy = geo.R * Math.sin(th);
      sys.style.transform = 'translate(' + (-K * vx).toFixed(1) + 'px, ' +
                            (-K * vy).toFixed(1) + 'px) scale(' + K + ')';
      d.documentElement.style.setProperty('--inv', (1 / K).toFixed(4));
      d.documentElement.style.setProperty('--kz', String(K));
    }
    if (!animate) { void sys.offsetWidth; sys.style.transition = ''; }
  }

  /* 押した瞬間、そのジャンルが軌道上のどこにいるか。
     公転アニメーション自身の時計を読む。止めた分も自動で織り込まれる。 */
  function angleOf(cat) {
    var list = cat.node.arm.getAnimations ? cat.node.arm.getAnimations() : [];
    if (list.length && list[0].currentTime != null)
      return cat.seat + (list[0].currentTime / (DUR_CAT * 1000)) * 360;
    return cat.seat;   /* 時計が読めない環境では初期角のまま */
  }

  /* =====================================================
     組み立て（最初に一度だけ）
     ===================================================== */
  function build() {
    var sys = $('#sys');
    /* #ringgrp は HTML 側の飾りなので残す。作った分だけ片づける。 */
    $$('.seat', sys).forEach(function (n) { n.remove(); });

    cats = (CFG.categories || []).map(function (c) {
      return { key: c.key, label: c.label, jp: c.jp, hue: c.hue, icon: c.icon, works: [] };
    });
    Data.works.forEach(function (wk) {
      var c = catOf(wk.category) || cats[cats.length - 1];
      if (c) c.works.push(wk);
    });
    cats = cats.filter(function (c) { return c.works.length > 0; });
    cats.forEach(function (c, i) { c.seat = Math.round(360 * i / cats.length); });

    cats.forEach(function (c) {
      var color = hue(c.hue);

      var seat   = el('div', 'seat');      seat.style.transform = 'rotate(' + c.seat + 'deg)';
      var arm    = el('div', 'arm g-arm'); arm.style.setProperty('--dur', DUR_CAT + 's');
      var pos    = el('div', 'pos');
      var up     = el('div', 'up g-up');   up.style.setProperty('--dur', DUR_CAT + 's');
      var unseat = el('div', 'unseat');    unseat.style.transform = 'rotate(' + (-c.seat) + 'deg)';

      var body = el('button', 'orbi');
      body.type = 'button';
      body.style.setProperty('--c', color);
      body.setAttribute('aria-label', c.jp + ' ' + c.works.length + '点');
      body.innerHTML = '<svg><use href="#i-' + c.icon + '"></use></svg>';
      body.addEventListener('click', function (e) { e.stopPropagation(); dive(c); });

      var flag = el('span', 'flag');
      flag.innerHTML = '<b></b><i></i><u></u>';
      $('b', flag).textContent = c.jp;
      $('i', flag).textContent = c.label;
      $('u', flag).textContent = c.works.length + '点';

      var satsys = el('div', 'satsys');
      satsys.style.setProperty('--c', color);
      var rings = el('div', 'satrings');
      satsys.appendChild(rings);

      c.works.forEach(function (wk, j) {
        var wc = hue(c.hue + (j - c.works.length / 2) * 11);
        var h = hash(wk.title);

        var sb = el('button', 'orbi');
        sb.type = 'button';
        sb.style.setProperty('--c', wc);
        /* 枠の縁だけはジャンルそのものの色。作品ごとにずらすと帰属が読めない。 */
        sb.style.setProperty('--cg', hue(c.hue));
        sb.style.setProperty('--ang', [24, 68, 112, 156][h % 4] + 'deg');
        sb.style.setProperty('--g', (4 + (h % 4)) + 'px');
        sb.setAttribute('aria-label', wk.title + ' / ' + wk.author);

        /* 中身＝サムネイル。枠（.lens）にはめる。枠の縁はジャンルの色。 */
        var lens = el('span', 'lens');
        var realThumb = safeUrl(wk.thumb);
        if (realThumb) {
          var im = new Image();
          im.alt = ''; im.decoding = 'async'; im.referrerPolicy = 'no-referrer';
          im.onerror = function () { im.remove(); lens.appendChild(drawThumb(wk, c)); };
          lens.appendChild(im);
          im.src = realThumb;          /* 挿入してから src を入れる */
        } else {
          lens.appendChild(drawThumb(wk, c));
        }
        sb.appendChild(lens);
        sb.addEventListener('click', function (e) { e.stopPropagation(); openWork(wk.slug); });

        var sf = el('span', 'flag one');
        sf.innerHTML = '<b></b>';
        $('b', sf).textContent = wk.title;

        var callHost = el('div', 'call-host');
        callHost.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0';
        callHost.style.setProperty('--c', wc);

        var sn = el('div', 'satnode');
        sn.appendChild(sb); sn.appendChild(sf); sn.appendChild(callHost);
        satsys.appendChild(sn);

        wk.node = { body: sb, flag: sf, node: sn, callHost: callHost,
                    color: wc, cat: c, r: 0, s0: 0, period: 150 };
      });

      unseat.appendChild(body); unseat.appendChild(flag); unseat.appendChild(satsys);
      up.appendChild(unseat); pos.appendChild(up); arm.appendChild(pos); seat.appendChild(arm);
      sys.appendChild(seat);

      c.node = { seat: seat, arm: arm, body: body, flag: flag, pos: pos,
                 satsys: satsys, rings: rings, color: color };
    });
  }

  function dive(cat) {
    if (state.zoom) return;
    state.zoom = cat.key;
    state.ang = angleOf(cat);
    state.openSlug = null;
    render();
  }

  function surface() {
    state.zoom = null;
    state.openSlug = null;
    render();
  }

  /* =====================================================
     作品を1コマ分置く
     位置・大きさ・明るさ・重なり順は、すべて同じ1つの投影から出す。
     こちら側に来たものほど大きく明るく、中心より手前のレイヤーへ。
     絵そのものは回さない。いつでもこちらを向いたまま。
     ===================================================== */
  /* 輪の線。円は自分の軸で回しても形が変わらないので、
     yaw では描き直さない。pitch が変わったときだけ引き直す。
     中心の丸に重なるところは描かない。浅い角度だと、そこが
     真ん中を横切るただの線に見えてしまうため。 */
  /* 線は手前半分と奥半分に分けて引くだけ。作品の丸は中身が不透明で、
     いつも線より上のレイヤーにあるので、重なったところは丸が隠す。
     中心の丸も奥の線より上にある。線の形は見下ろし角だけで決まるので、
     角度が変わったときだけ引き直す（公転では動かない）。 */
  var RING_N = 180;
  function ringPath(r, pitch, wantFront) {
    var out = [], cur = [], EPS = 1e-6;
    for (var k = 0; k <= RING_N; k++) {
      var q = proj(k / RING_N * Math.PI * 2, r, pitch);
      var onSide = wantFront ? (q.z >= -EPS) : (q.z <= EPS);
      if (onSide) cur.push(q.x.toFixed(1) + ',' + q.y.toFixed(1));
      else { if (cur.length > 1) out.push('M' + cur.join('L')); cur = []; }
    }
    if (cur.length > 1) out.push('M' + cur.join('L'));
    return out.join('');
  }

  function drawRings(c) {
    if (!c.node.paths || c.node.ringPitch === cam.pitch) return;
    c.node.ringPitch = cam.pitch;
    for (var i = 0; i < c.node.shells.length; i++) {
      var r = c.node.shells[i].r;
      c.node.paths[i].back.setAttribute('d', ringPath(r, cam.pitch, false));
      c.node.paths[i].front.setAttribute('d', ringPath(r, cam.pitch, true));
    }
  }

  function place(t) {
    for (var ci = 0; ci < cats.length; ci++) {
      var c = cats[ci];
      if (state.zoom && state.zoom !== c.key) continue;
      if (!c.node.shells) continue;

      drawRings(c);
      for (var wi = 0; wi < c.works.length; wi++) {
        var wk = c.works[wi], n = wk.node;
        if (!n || !n.r) continue;
        var phi = (n.s0 + t / n.period + cam.yaw) * Math.PI * 2;
        var pt = proj(phi, n.r, cam.pitch);
        var st = n.node.style;
        st.transform = 'translate(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px)';
        /* 値が変わったときだけ書く。毎コマ同じ値を書くだけでも、
           opacity の transition が始め直しになって重くなる。 */
        var sc = pt.s.toFixed(3);
        if (n.lastSc !== sc) { st.setProperty('--sc', sc); n.lastSc = sc; }
        var open = state.openSlug === wk.slug;
        var dim = open ? '1' : (0.58 + (pt.z + 1) / 2 * 0.42).toFixed(2);
        if (n.lastDim !== dim) { st.setProperty('--dim', dim); n.lastDim = dim; }
        /* 重なり順。作品はいつでも軌道の線より上に来る。
           奥:12〜19 → 中心:20 → 軌道の線(手前):21 → 手前の作品:24〜31 */
        var zi = open ? 60
               : (pt.z > 0 ? 24 + Math.round(pt.z * 7)
                           : 12 + Math.round((1 + pt.z) * 7));
        if (n.lastZ !== zi) { st.zIndex = zi; n.lastZ = zi; }
      }
    }
  }

  /* =====================================================
     カメラの向き（左右・上下）とその戻し
     中心の位置は動かさない。動くのは見る角度だけ。
     ===================================================== */
  var TURN_X = 620;   /* この距離を引くと一周する */
  var TURN_Y = 380;   /* この距離を引くと真上から真横まで振れる */
  var drag = null, tween = null;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function camMoved() {
    return Math.abs(cam.yaw) > 0.002 || Math.abs(cam.pitch - PITCH0) > 0.002;
  }
  function showReset() {
    var b = $('#camreset');
    if (b) b.classList.toggle('on', !!state.zoom && camMoved());
  }

  /* 戻すときは近い方向へ回る。1周ぶんの差は無視する。 */
  function resetCam() {
    tween = { t0: null, dur: 760,
              y0: cam.yaw, y1: Math.round(cam.yaw),
              p0: cam.pitch, p1: PITCH0 };
  }

  function wireDrag() {
    var scene = $('#scene');

    scene.addEventListener('pointerdown', function (e) {
      if (!state.zoom || e.button !== 0) return;
      if (e.target.closest('.callout') || e.target.closest('.nav')) return;
      /* setPointerCapture は使わない。使うと click の宛先が
         #scene に変わってしまい、作品をクリックできなくなる。 */
      tween = null;
      drag = { x: e.clientX, y: e.clientY, moved: 0,
               yaw: cam.yaw, pitch: cam.pitch, active: false };
    });

    w.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
      if (!drag.active) {
        if (drag.moved < 5) return;        /* ここまでは「クリック」として扱う */
        drag.active = true;
        d.documentElement.classList.add('turning');
      }
      cam.yaw = drag.yaw + dx / TURN_X;
      cam.pitch = clamp(drag.pitch - dy / TURN_Y * (Math.PI / 2), PMIN, PMAX);
      place(spinAt);
      showReset();
    }, { passive: true });

    function end() {
      if (!drag) return;
      var was = drag.active;
      drag = null;
      d.documentElement.classList.remove('turning');
      if (!was) return;
      /* 引いた後に続けて飛んでくる click は打ち消す */
      var kill = function (ev) { ev.stopPropagation(); ev.preventDefault(); };
      d.addEventListener('click', kill, true);
      setTimeout(function () { d.removeEventListener('click', kill, true); }, 0);
    }
    w.addEventListener('pointerup', end);
    w.addEventListener('pointercancel', end);

    var btn = $('#camreset');
    if (btn) btn.addEventListener('click', function (e) { e.stopPropagation(); resetCam(); });
  }

  /* 公転。潜っているあいだだけ回す。 */
  var spinT0 = null, spinAt = 0, lastPlace = 0;
  function spin(now) {
    requestAnimationFrame(spin);
    if (!state.zoom) { spinT0 = null; spinAt = 0; return; }
    if (spinT0 === null) spinT0 = now;
    if (drag) { spinT0 = now - spinAt * 1000; return; }

    if (tween) {
      if (tween.t0 === null) tween.t0 = now;
      var k = Math.min(1, (now - tween.t0) / tween.dur);
      var e = 1 - Math.pow(1 - k, 3);            /* 終わりでそっと止まる */
      cam.yaw   = tween.y0 + (tween.y1 - tween.y0) * e;
      cam.pitch = tween.p0 + (tween.p1 - tween.p0) * e;
      if (k >= 1) { cam.yaw = tween.y1; cam.pitch = tween.p1; tween = null; }
      showReset();
    }

    /* 公転はゆっくり（1周150秒以上）なので、カメラが止まっているあいだは
       30コマ/秒で足りる。見た目は変わらず、描き直しが半分になる。 */
    if (!tween && now - lastPlace < 31) return;
    lastPlace = now;
    spinAt = (now - spinT0) / 1000;
    place(spinAt);
  }

  /* =====================================================
     状態を画面に反映する
     ===================================================== */
  function render() {
    var sys = $('#sys');
    var zc = state.zoom ? catOf(state.zoom) : null;

    sys.classList.toggle('held', !!state.zoom);
    $('#ringgrp').style.opacity = state.zoom ? 0 : 1;
    $('#guide').classList.toggle('off', !!state.zoom);

    cats.forEach(function (c) {
      var focused = state.zoom === c.key;
      c.node.body.classList.toggle('sun', focused);
      c.node.body.classList.toggle('away', !!state.zoom && !focused);
      c.node.flag.classList.toggle('hide', !!state.zoom);
      c.node.satsys.classList.toggle('on', focused);
      c.node.seat.style.zIndex = focused ? 40 : 10;
    });

    /* 左の見出し */
    $('#hero-kick').textContent = zc ? zc.label : 'WORKS';
    $('#hero-kick').style.color = zc ? zc.node.color : '';
    $('#hero-title').textContent = zc ? zc.jp : '作品一覧';
    $('#hero-title').style.fontSize = zc && zc.jp.length > 5
      ? 'clamp(30px,' + (380 / zc.jp.length / 16) + 'rem,' + Math.floor(380 / zc.jp.length) + 'px)' : '';
    $('#hero-lede').innerHTML = zc
      ? 'まるい絵ひとつが作品です。<br>横に引くと回ります。押すと説明が出ます。'
      : 'ジャンルごとに作品を探検しよう。';   /* 操作の説明は下の使い方ガイドにあるので繰り返さない */
    $('#hero-back').hidden = !zc;

    /* 右の一覧 */
    var side = $('#side');
    var showSide = !!zc && !state.openSlug && vp().w >= 1180;
    side.classList.toggle('off', !showSide);
    if (zc) {
      $('#side-kick').textContent = zc.label;
      $('#side-kick').style.color = zc.node.color;
      $('#side-title').textContent = zc.jp;
      $('#side-count').textContent = zc.works.length + '作品';
      var list = $('#side-list');
      list.innerHTML = '';
      zc.works.forEach(function (wk) {
        /* M3 の2行リスト項目：先頭にサムネ（無ければ色つきの頭文字）、
           見出し＝作品名、補足＝作者、末尾に「開く」の矢印 */
        var b = el('button', 'row' + (state.openSlug === wk.slug ? ' on' : ''));
        b.type = 'button';
        b.style.setProperty('--c', wk.node.color);
        var lead = el('span', 'row-lead');
        var th = safeUrl(wk.thumb);
        if (th) { var im = new Image(); im.alt = ''; im.loading = 'lazy'; im.src = th; lead.appendChild(im); }
        else lead.textContent = Array.from(wk.title || '・')[0];
        var txt = el('span', 'row-txt');
        var bb = el('b'); bb.textContent = wk.title;
        var sp = el('span'); sp.textContent = wk.author;
        txt.appendChild(bb); txt.appendChild(sp);
        var tr = el('span', 'row-trail');
        tr.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.4 18 8 16.6l4.6-4.6L8 7.4 9.4 6l6 6z"/></svg>';
        b.appendChild(lead); b.appendChild(txt); b.appendChild(tr);
        b.addEventListener('click', function (e) { e.stopPropagation(); openWork(wk.slug); });
        list.appendChild(b);
      });
    }

    /* 吹き出し */
    var sheet = sheetHost();
    sheet.innerHTML = '';
    Data.works.forEach(function (wk) {
      if (!wk.node) return;
      wk.node.callHost.innerHTML = '';
      if (state.openSlug !== wk.slug) return;
      /* スマホ幅では衛星の横に吹き出しを出す余地がないので、
         説明は画面下からのシートにする。 */
      if (vp().w < 700) sheet.appendChild(buildPanel(wk));
      /* 開いた衛星は place() が最前面へ持ち上げる。 */
      else wk.node.callHost.appendChild(buildCallout(wk));
    });

    if (!state.zoom) { cam.yaw = 0; cam.pitch = PITCH0; tween = null; }
    showReset();
    place(spinAt);
    applyCamera(true);
    updateHash();
  }

  function catOf(key) {
    for (var i = 0; i < cats.length; i++) if (cats[i].key === key) return cats[i];
    return null;
  }

  function sheetHost() {
    var s = d.getElementById('csheet');
    if (!s) {
      s = el('div', 'csheet'); s.id = 'csheet';
      s.addEventListener('click', function (e) { e.stopPropagation(); });
      s.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      d.body.appendChild(s);
    }
    return s;
  }

  function buildCallout(wk) {
    var box = el('div', 'callout');
    box.style.setProperty('--c', wk.node.color);
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    box.innerHTML = '<i class="cdot"></i><i class="cdiag"></i><i class="chorz"></i>';
    box.appendChild(buildPanel(wk));
    return box;
  }

  function buildPanel(wk) {
    var panel = el('div', 'cpanel');
    panel.style.setProperty('--c', wk.node.color);
    var kick = el('div', 'kick'); kick.textContent = wk.node.cat.label;
    var h4 = el('h4'); h4.textContent = wk.title;
    var by = el('div', 'by'); by.textContent = wk.author;
    var p = el('p'); p.textContent = wk.desc || '';
    var acts = el('div', 'acts');

    var play = el('button', 'cta'); play.type = 'button';
    play.textContent = wk.playable ? '全画面で見る' : '作品を開く';
    play.addEventListener('click', function (e) { e.stopPropagation(); openPlayer(wk); });

    var close = el('button', 'ghost'); close.type = 'button'; close.textContent = '閉じる';
    close.addEventListener('click', function (e) { e.stopPropagation(); openWork(null); });

    acts.appendChild(play); acts.appendChild(close);
    panel.appendChild(kick); panel.appendChild(h4); panel.appendChild(by);
    panel.appendChild(p); panel.appendChild(acts);
    return panel;
  }

  function openWork(slug) { state.openSlug = slug; render(); }

  /* =====================================================
     全画面再生
     ===================================================== */
  var playerWork = null, lastFocus = null;

  /* =====================================================
     いいね
     部員どうしの投票ではなく、来場者が「気に入った」を残す
     ためのもの。集計はスプレッドシート側（Cloud.heart）が持つので、
     この「押した/押していない」の見た目はページを開いている間だけ
     覚えていれば十分。会場では一台の端末を何人もの来場者が入れ替わり
     使うため、あえて localStorage には残さない——残すと、前の人が
     押した状態がリロード後もずっと表示され続け、次の人には「もう
     押されている」ように見えてしまう（押し直すと今度は誤って
     解除＝マイナス集計になる）。メモリ上の Set はリロードのたびに
     まっさらになるので、スプレッドシートの数字はそのまま、見た目
     だけが次の来場者のためにリセットされる。 */
  var liked = new Set();
  function isLiked(slug) { return liked.has(slug); }
  function setLiked(slug, on) {
    if (on) liked.add(slug); else liked.delete(slug);
  }

  /* =====================================================
     ハートの数と、ひとこと（コメント）

     裏側（config.js の apiUrl）が未設定なら、コメント欄は
     丸ごと隠す。押した記録はこれまで通りこの端末のなかにも
     残るので、見た目は今までと変わらない。

     数字そのものは Firebase Realtime Database（CCMHearts）から
     即座に取る。Apps Script は応答が数秒かかることがあり、それを
     基準値にしていた頃は押すたびに数字が行ったり来たりしていた
     ため、Firebase 側が使えるならそちらを優先し、apiUrl の方は
     「押された」記録をスプレッドシートに残すためだけに裏で叩く
     （表示には一切関わらせない）。Firebase が未設定の会場では、
     今まで通り Apps Script のまとめ取得にフォールバックする。

     数字は「作品を開いたときに一度だけ」取りに行く。押した/外した
     瞬間の表示は、そのとき届いた基準値に対して単純に ±1 するだけ。
     次に基準値を取り直すのは、その作品をまた開いたとき
     （＝一覧に戻ってから開き直したとき）だけにする。
     ===================================================== */
  var Cloud = window.CCMCloud || null;
  var Hearts = window.CCMHearts || null;
  var HeartsOn = !!((Hearts && Hearts.enabled) || (Cloud && Cloud.enabled));
  var Comments = window.CCMComments || null;
  /* ひとことは必ず裏側（Jev の審査）を通して書く。裏側が無ければ欄ごと出さない。
     読むのは Firebase があればそちら（速い）、無ければ裏側から。 */
  var CommentsOn = !!(Cloud && Cloud.enabled);
  var heartCounts = {};
  var heartBaseSlug = null;   /* 今、基準値が揃っている作品 */

  function showHeart(slug) {
    var n = $('#p-like-n');
    if (!n) return;
    if (!HeartsOn || heartBaseSlug !== slug) { n.textContent = ''; return; }
    var c = heartCounts[slug];
    n.textContent = (typeof c === 'number' && c > 0) ? String(c) : '';
  }

  /* 作品を開くたびに呼ぶ。基準値が揃うまで #p-loading で画面を覆い、
     数字だけが遅れてポツンと現れるのを防ぐ。通信が固まっても
     待たせすぎないよう、上限つきで諦める（Firebase は普段ここまで
     待つことはほぼない）。 */
  function loadHeartFor(slug) {
    heartBaseSlug = null;
    var overlay = $('#p-loading');
    if (!HeartsOn) { if (overlay) overlay.hidden = true; return; }
    if (overlay) overlay.hidden = false;

    var done = false;
    function settle(count) {
      if (done) return;
      done = true;
      if (!playerWork || playerWork.slug !== slug) return;   /* 待つ間に他の作品へ移っていたら捨てる */
      heartCounts[slug] = typeof count === 'number' ? count : (heartCounts[slug] || 0);
      heartBaseSlug = slug;
      showHeart(slug);
      if (overlay) overlay.hidden = true;
    }

    if (Hearts && Hearts.enabled) {
      Hearts.get(slug).then(settle);
    } else {
      Cloud.hearts(true).then(function (map) { settle(map && map[slug]); });
    }
    setTimeout(function () { settle(heartCounts[slug]); }, 4000);   /* 待ちきれなければ、今ある値で諦めて開放する */
  }

  function whenText(iso) {
    if (!iso) return '';
    var t = new Date(iso);
    if (isNaN(t)) return '';
    var diff = (Date.now() - t.getTime()) / 1000;
    if (diff < 60) return 'たった今';
    if (diff < 3600) return Math.floor(diff / 60) + '分前';
    if (diff < 86400) return Math.floor(diff / 3600) + '時間前';
    return (t.getMonth() + 1) + '/' + t.getDate();
  }

  function renderComments(items) {
    var list = $('#cmt-list'), cnt = $('#cmt-count');
    if (!list) return;
    list.innerHTML = '';
    if (!items) {
      cnt.textContent = '';
      var p = el('li', 'cmt-empty');
      p.textContent = 'いま読み込めませんでした。';
      list.appendChild(p);
      return;
    }
    cnt.textContent = items.length ? items.length + '件' : '';
    if (!items.length) {
      var e0 = el('li', 'cmt-empty');
      e0.textContent = 'まだありません。最初のひとことをどうぞ。';
      list.appendChild(e0);
      return;
    }
    items.forEach(function (it) {
      /* 受け取った文字はそのまま textContent に入れる。
         HTML として解釈させないので、タグを書かれても安全。 */
      list.appendChild(cmtItem(it.name, whenText(it.at), it.text || ''));
    });
  }

  /* ひとこと1件＝M3 のリスト項目（先頭に頭文字のアバター） */
  function cmtItem(name, when, text) {
    var li = el('li', 'cmt-item');
    var av = el('span', 'cmt-av'); av.setAttribute('aria-hidden', 'true');
    var nm = name || 'ななし';
    av.textContent = Array.from(nm)[0];
    var main = el('div', 'cmt-main');
    var top = el('div', 'cmt-top');
    var who = el('span', 'cmt-who'); who.textContent = nm;
    var at = el('span', 'cmt-at'); at.textContent = when;
    var body = el('p', 'cmt-body'); body.textContent = text;
    top.appendChild(who); top.appendChild(at);
    main.appendChild(top); main.appendChild(body);
    li.appendChild(av); li.appendChild(main);
    return li;
  }

  /* 送信中のひとことを、仮に一覧の先頭へ出す */
  var pendingLi = null;
  function showPending(name, text) {
    var list = $('#cmt-list');
    if (!list) return;
    var empty = list.querySelector('.cmt-empty');
    if (empty) empty.remove();
    var li = cmtItem(name, 'たった今', text);
    li.classList.add('cmt-pending');
    list.insertBefore(li, list.firstChild);
    pendingLi = li;
    $('#cmt-text').value = ''; $('#cmt-text').dispatchEvent(new Event('input'));
    var note = $('#cmt-note');
    note.classList.remove('bad');
    note.textContent = 'ありがとうございます。載せました。';
  }
  function dropPending() { if (pendingLi) { pendingLi.remove(); pendingLi = null; } }

  function updateCmtBadge(n) {
    var b = $('#cmt-badge');
    if (b) b.textContent = (typeof n === 'number' && n > 0) ? String(n) : '';
  }

  /* ---- ひとこと欄の開け閉め ----
     右上のアイコンを押したときだけ、フローティングのカードが滑り出す。
     クリックするまでは書き込めない（＝欄が見えない）ので、
     「押して初めてコメントできる」という見た目のふるまいになる。 */
  function isCmtOpen() {
    var p = $('#cmt-panel');
    return !!(p && p.classList.contains('on'));
  }
  function closeCmt() {
    var p = $('#cmt-panel'), t = $('#cmt-toggle');
    if (p) { p.classList.remove('on'); p.setAttribute('aria-hidden', 'true'); }
    if (t) { t.classList.remove('on'); t.setAttribute('aria-expanded', 'false'); }
  }
  function openCmt() {
    var p = $('#cmt-panel'), t = $('#cmt-toggle');
    if (!p || p.hidden) return;
    if (t && t.hidden) return;
    p.classList.add('on'); p.setAttribute('aria-hidden', 'false');
    if (t) { t.classList.add('on'); t.setAttribute('aria-expanded', 'true'); }
    /* 端末内の判定AIを、書いているあいだに読み込んでおく */
    if (window.CCMLocalMod) window.CCMLocalMod.warm();
    setTimeout(function () { var f = $('#cmt-text'); if (f) f.focus(); }, 260);
  }

  /* 一覧と件数バッジだけを読み直す。「ひとこと」欄の下のメッセージ
     （送信後の「ありがとうございました。」など）には触れない。
     loadComments がここも毎回空にしてしまうと、送信直後にこの
     メッセージを読む間もなく消えてしまうため、分けてある。 */
  function refreshComments(slug) {
    var read = (Comments && Comments.enabled) ? Comments.list(slug) : Cloud.comments(slug);
    return read.then(function (items) {
      /* 読んでいる間に別の作品へ移っていたら、その結果は捨てる */
      if (!playerWork || playerWork.slug !== slug) return;
      renderComments(items);
      updateCmtBadge(items ? items.length : null);
    });
  }

  function loadComments(slug) {
    var toggle = $('#cmt-toggle');
    if (!toggle) return;
    if (!CommentsOn) { toggle.hidden = true; return; }
    toggle.hidden = false;
    $('#cmt-note').textContent = '';
    $('#cmt-note').classList.remove('bad');
    $('#cmt-list').innerHTML = '';
    $('#cmt-count').textContent = '';
    updateCmtBadge(null);
    refreshComments(slug);
  }

  /* ---- 音楽：オーディオビジュアライザ ---- */
  function buildVisualizer(frame, src, wk) {
    /* 見た目：細い線を円周にびっしり並べ、円をまたいで内外に伸ばす（少し斜め）。
       スペクトルは半周ぶんを作り、反対側にも同じものを置く（点対称）。
       曲ごとに鳴っている帯域を測り、各帯域の大きさを自動で揃えるので、
       低音だけが伸びて片側に偏ることがない。 */
    var cv = el('canvas', 'viz-canvas');
    var au = el('audio'); au.preload = 'auto';
    var btn = el('button', 'viz-play');
    btn.type = 'button'; btn.setAttribute('aria-label', '再生');
    btn.innerHTML = '<svg class="i-play" viewBox="0 -960 960 960"><path d="M320-200v-560l440 280-440 280Z"/></svg>' +
                    '<svg class="i-pause" viewBox="0 -960 960 960"><path d="M520-200v-560h240v560H520Zm-320 0v-560h240v560H200Z"/></svg>';
    var bar = el('div', 'viz-bar');
    var seek = el('input', 'viz-seek'); seek.type = 'range'; seek.min = 0; seek.max = 1000; seek.step = 1; seek.value = 0;
    seek.setAttribute('aria-label', '再生位置');
    var tm = el('span', 'viz-time'); tm.textContent = '0:00';
    bar.appendChild(seek); bar.appendChild(tm);
    frame.appendChild(cv); frame.appendChild(btn); frame.appendChild(bar); frame.appendChild(au);

    /* 簡易サーバー（Range 非対応）でも再生位置を動かせるよう、
       ファイルを丸ごと読んでからブラウザ内の URL で鳴らす */
    fetch(src).then(function (r) { return r.blob(); })
      .then(function (b) { au.src = URL.createObjectURL(b); })
      .catch(function () { au.src = src; });

    /* 描き方は、定番のビジュアライザ（audioMotion-analyzer、Wallpaper Engine の
       円形スペクトラム、foobar の Spectrum など）がやっている工夫に揃えた：
       1. 振幅ではなく dB で見る（耳の感じ方に近い）
       2. 周波数は対数（オクターブ）で区切る。40Hz〜16kHz
       3. 高音ほど小さく出る音楽の傾き（ピンクノイズ）を、+4.5dB/oct で補正する
       4. 帯の中は平均ではなく最大値を取る（細い音も拾う）
       5. ゲインは帯ごとではなく曲全体で自動調整する
          （帯ごとに揃えると、ずっと鳴っている低音が常に最大に張り付く）
       6. 立ち上がりは速く、戻りはゆっくり。隣の帯と少しならして滑らかに
       7. 一周に低音→高音を並べ、継ぎ目（真上）は両端をならしてつなぐ */
    var ctx = cv.getContext('2d'), ac = null, an = null, fd = null, raf = 0;
    var N = 120, HALF = N;                     /* 一周ぶん、全部別の帯（鏡写しにしない） */
    var lvl = new Float32Array(HALF), tmp = new Float32Array(HALF);
    var edges = null;                          /* 各帯の [開始bin, 終了bin, 中心Hz] */
    var top = -30;                             /* 曲全体の「大きい音」の目安（dB）。自動で追う */
    var RANGE = 42;                            /* top から何 dB 下までを表示に使うか */
    var dragging = false;
    function fmt(s) { s = Math.max(0, s | 0); return (s / 60 | 0) + ':' + ('0' + s % 60).slice(-2); }
    function setup() {
      if (ac) return;
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        var srcN = ac.createMediaElementSource(au);
        an = ac.createAnalyser(); an.fftSize = 8192; an.smoothingTimeConstant = .5;
        an.minDecibels = -100; an.maxDecibels = -10;
        srcN.connect(an); an.connect(ac.destination);
        fd = new Float32Array(an.frequencyBinCount);
        var hz = ac.sampleRate / an.fftSize, f0 = 40, f1 = Math.min(16000, ac.sampleRate / 2.2);
        edges = [];
        for (var i = 0; i < HALF; i++) {
          var a = f0 * Math.pow(f1 / f0, i / HALF), b = f0 * Math.pow(f1 / f0, (i + 1) / HALF);
          var b0 = Math.round(a / hz), b1 = Math.max(b0 + 1, Math.round(b / hz));
          edges.push([b0, b1, Math.sqrt(a * b)]);
        }
      } catch (e) { ac = null; }
    }
    function draw() {
      raf = requestAnimationFrame(draw);
      if (!frame.isConnected) { cancelAnimationFrame(raf); au.pause(); return; }
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== (w * dpr | 0) || cv.height !== (h * dpr | 0)) { cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2 - 12, R = Math.min(w, h) * .27;
      var live = an && !au.paused, i;
      if (live) {
        an.getFloatFrequencyData(fd);
        var frameMax = -200;
        for (i = 0; i < HALF; i++) {
          var e = edges[i], m = -200;
          for (var k = e[0]; k < e[1] && k < fd.length; k++) if (fd[k] > m) m = fd[k];
          m += 4.5 * Math.log2(e[2] / 1000);   /* 高音の補正 */
          tmp[i] = m;
          if (m > frameMax) frameMax = m;
        }
        /* 曲全体のゲイン：大きい音にはすぐ合わせ、静かになったらゆっくり下げる */
        top = frameMax > top ? top + (frameMax - top) * .3 : top - .04;
        for (i = 0; i < HALF; i++) {
          var v = (tmp[i] - (top - RANGE)) / RANGE;
          tmp[i] = Math.pow(Math.min(1, Math.max(0, v)), 1.6);
        }
      } else {
        for (i = 0; i < HALF; i++) tmp[i] = 0;
      }
      /* 隣とならして、立ち上がり速く・戻りゆっくり */
      for (i = 0; i < HALF; i++) {
        var sm = tmp[i] * .5 + tmp[(i - 1 + HALF) % HALF] * .25 + tmp[(i + 1) % HALF] * .25;
        lvl[i] += (sm - lvl[i]) * (sm > lvl[i] ? .55 : .1);
      }
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.2, R * .011);
      /* うっすら光らせる。大きく鳴っている所だけ緑がかる */
      ctx.shadowColor = 'rgba(0,255,0,.35)';
      for (var n = 0; n < N; n++) {
        var idx = n;
        var lv = lvl[idx];
        var a = -Math.PI / 2 + (n + .5) / N * Math.PI * 2;
        var L = R * (.03 + lv * .34);
        var ux = Math.cos(a), uy = Math.sin(a);
        var px = cx + ux * R, py = cy + uy * R;
        /* 静かな所は白く細く、大きく鳴った所だけ緑の光をまとう */
        ctx.globalAlpha = .5 + lv * .5;
        ctx.shadowBlur = lv > .45 ? (lv - .45) * 26 : 0;
        ctx.strokeStyle = '#eef3f0';
        ctx.beginPath();
        ctx.moveTo(px - ux * L * .45, py - uy * L * .45);
        ctx.lineTo(px + ux * L, py + uy * L);
        ctx.stroke();
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      /* 基準の円（細く） */
      ctx.strokeStyle = 'rgba(233,238,236,.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R * .82, 0, Math.PI * 2); ctx.stroke();
      if (au.duration && !dragging) {
        seek.value = Math.round(au.currentTime / au.duration * 1000);
        tm.textContent = fmt(au.currentTime) + ' / ' + fmt(au.duration);
      }
    }
    btn.addEventListener('click', function () {
      setup();
      if (ac && ac.state === 'suspended') ac.resume();
      if (au.paused) { var p = au.play(); if (p) p.catch(function () {}); } else au.pause();
    });
    au.addEventListener('play', function () { frame.classList.add('playing'); btn.setAttribute('aria-label', '一時停止'); });
    au.addEventListener('pause', function () { frame.classList.remove('playing'); btn.setAttribute('aria-label', '再生'); });
    au.addEventListener('loadedmetadata', function () { tm.textContent = '0:00 / ' + fmt(au.duration); });
    /* 再生バー：つまんでいる間は描画で上書きしない。離したところへ飛ぶ */
    seek.addEventListener('pointerdown', function () { dragging = true; });
    seek.addEventListener('input', function () {
      dragging = true;
      if (au.duration) tm.textContent = fmt(seek.value / 1000 * au.duration) + ' / ' + fmt(au.duration);
    });
    seek.addEventListener('change', function () {
      if (au.duration) au.currentTime = seek.value / 1000 * au.duration;
      dragging = false;
    });
    seek.addEventListener('pointerup', function () { setTimeout(function () { dragging = false; }, 0); });
    raf = requestAnimationFrame(draw);
  }

  /* ---- 3D モデル：model-viewer を必要なときだけ読み込む ---- */
  var mvLoading = null;
  function buildModelViewer(frame, src, wk) {
    if (!mvLoading && !window.customElements.get('model-viewer')) {
      mvLoading = new Promise(function (res) {
        var s = d.createElement('script'); s.type = 'module';
        s.src = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js';
        s.onload = res; s.onerror = res; d.head.appendChild(s);
      });
    }
    var mv = d.createElement('model-viewer');
    mv.setAttribute('src', src);
    mv.setAttribute('alt', wk.title);
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('auto-rotate', '');
    mv.setAttribute('auto-rotate-delay', '0');
    mv.setAttribute('rotation-per-second', '18deg');
    mv.setAttribute('interaction-prompt', 'none');
    mv.setAttribute('shadow-intensity', '1');
    mv.setAttribute('shadow-softness', '0.6');
    mv.setAttribute('exposure', '0.85');
    mv.setAttribute('tone-mapping', 'agx');
    mv.setAttribute('environment-image', 'neutral');
    /* 色も模様もない（真っ白の）マテリアルは、明るい照明だと陰影が飛んで形が読めない。
       粘土のような灰色・つや消しに置き換えて、凹凸が影で見えるようにする。
       色や模様が付いているモデル（カラスなど）には触らない。 */
    mv.addEventListener('load', function () {
      var mats = (mv.model && mv.model.materials) || [];
      mats.forEach(function (m) {
        /* 板一枚で作った部分（剣の刃など）は、裏から見ると描かれず消えて見える。両面とも描く */
        if (m.setDoubleSided) m.setDoubleSided(true);
        var pbr = m.pbrMetallicRoughness;
        if (!pbr || (pbr.baseColorTexture && pbr.baseColorTexture.texture)) return;
        var c = pbr.baseColorFactor;
        /* 白〜Blender の初期マテリアル（0.8 の灰色）まで。色味のあるものは残す */
        var lo = Math.min(c[0], c[1], c[2]), hi = Math.max(c[0], c[1], c[2]);
        if (lo > 0.7 && hi - lo < 0.06) {
          pbr.setBaseColorFactor([0.56, 0.58, 0.56, c[3]]);
          pbr.setRoughnessFactor(0.72);
          pbr.setMetallicFactor(0);
        }
      });
    });
    var hint = el('span', 'model-hint'); hint.textContent = 'ドラッグで回転・ホイールで拡大';
    frame.appendChild(mv); frame.appendChild(hint);
  }

  function frameSize(kind) {
    if (kind === 'scratch') return 485 / 402;
    if (kind === 'audio-file') return 1;
    return 16 / 9;
  }

  function openPlayer(wk) {
    playerWork = wk;
    lastFocus = d.activeElement;
    var pl = $('#player');
    pl.style.setProperty('--c', wk.node.color);
    $('#p-kick').textContent = wk.node.cat.label;
    $('#p-kick').style.color = wk.node.color;
    $('#p-title').textContent = wk.title;
    $('#p-by').textContent = wk.author;
    $('#p-desc').textContent = wk.desc || '';

    var url = safeUrl(wk.url), ext = $('#p-ext');
    if (url) { ext.href = url; ext.hidden = false; } else { ext.hidden = true; }

    var likeBtn = $('#p-like');
    likeBtn.classList.toggle('on', isLiked(wk.slug));
    likeBtn.setAttribute('aria-pressed', isLiked(wk.slug) ? 'true' : 'false');
    loadHeartFor(wk.slug);
    closeCmt();               /* 作品が替わるたびに、ひとこと欄は閉じた状態から */
    loadComments(wk.slug);

    var stage = $('#p-stage');
    stage.innerHTML = '';
    var m = wk.media;
    var frame = el('div', 'frame');

    function iframe(src) {
      var f = el('iframe');
      f.src = src;
      f.title = wk.title;
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      f.setAttribute('referrerpolicy', 'no-referrer');
      return f;
    }

    if (m.kind === 'scratch' || m.kind === 'youtube' || m.kind === 'drive' || m.kind === 'web') {
      var ifr = iframe(m.embed);
      frame.appendChild(ifr);
      /* 読み込み中は枠の中にくるくるを出す。ページはそのまま使える。
         games/ のゲーム（同じサイト）は、ゲーム本体のダウンロードと起動が
         終わるまで（Godot の #status が消えるまで）待ってから外す */
      /* Scratch（TurboWarp で HTML にしたもの）は、元の旗ボタン類を消してあるので、
         開始・停止をこちらの M3 アイコンボタンで出す */
      if (wk.scratch) {
        var ctl = el('div', 'sc-ctl');
        ctl.innerHTML =
          '<button type="button" class="sc-btn sc-start" aria-label="スタート" title="スタート"><svg viewBox="0 -960 960 960"><path d="M320-200v-560l440 280-440 280Z"/></svg></button>' +
          '<button type="button" class="sc-btn sc-stop" aria-label="ストップ" title="ストップ"><svg viewBox="0 -960 960 960"><path d="M240-240v-480h480v480H240Z"/></svg></button>';
        var send = function (cmd) { try { ifr.contentWindow.postMessage({ ccm: 'scratch', cmd: cmd }, '*'); } catch (e) {} };
        ctl.querySelector('.sc-start').addEventListener('click', function () { send('start'); try { ifr.focus(); } catch (e) {} });
        ctl.querySelector('.sc-stop').addEventListener('click', function () { send('stop'); });
        w.addEventListener('message', function onMsg(e) {
          if (!ctl.isConnected) { w.removeEventListener('message', onMsg); return; }
          if (e.source === ifr.contentWindow && e.data && e.data.ccm === 'scratch') frame.classList.toggle('sc-running', !!e.data.running);
        });
        frame.appendChild(ctl);
      }
      var spin = el('div', 'frame-loading');
      spin.innerHTML = '<span class="loading-ring"></span><span class="frame-loading-t">読み込み中…</span>';
      frame.appendChild(spin);
      var doneSpin = function () { if (spin.parentNode) { spin.classList.add('out'); setTimeout(function () { spin.remove(); }, 300); } };
      ifr.addEventListener('load', function () {
        var doc = null;
        try { doc = ifr.contentDocument; } catch (e) {}
        if (!doc || !/^games\//.test(m.embed)) { doneSpin(); return; }
        var t0 = Date.now();
        (function wait() {
          if (!spin.parentNode) return;
          var s = null;
          try { s = ifr.contentDocument.getElementById('status'); } catch (e) {}
          var hidden = !s || s.style.display === 'none' || s.style.visibility === 'hidden' || getComputedStyle(s).display === 'none';
          if (hidden || Date.now() - t0 > 120000) { doneSpin(); return; }
          setTimeout(wait, 300);
        })();
      });
    } else if (m.kind === 'video-file') {
      var v = el('video'); v.src = m.embed; v.controls = true; v.playsInline = true; v.preload = 'metadata';
      frame.appendChild(v);
    } else if (m.kind === 'image') {
      var im = new Image(); im.src = m.embed; im.alt = wk.title;
      frame.appendChild(im);
    } else if (m.kind === 'audio-file') {
      /* 音楽：月食の輪の形をしたオーディオビジュアライザ。再生ボタンは真ん中 */
      frame.className = 'frame viz-stage';
      buildVisualizer(frame, m.embed, wk);
    } else if (m.kind === 'model3d') {
      /* 3D モデル：その場でドラッグして回せる（Google の model-viewer） */
      frame.className = 'frame model-stage';
      buildModelViewer(frame, m.embed, wk);
    } else {
      var hint = el('div', 'hint');
      hint.innerHTML = '<b>' + (url ? 'EXTERNAL SITE' : 'ON SITE ONLY') + '</b><span>' +
        (url ? '右上の「元のページ」から開いてください。' : '会場の展示でご覧ください。') + '</span>';
      frame.appendChild(hint);
    }

    ['br1','br2','br3','br4'].forEach(function (_, i) {
      var b = el('i', 'br');
      b.style.cssText = [
        'left:-1px;top:-1px;border-right:0;border-bottom:0',
        'right:-1px;top:-1px;border-left:0;border-bottom:0',
        'left:-1px;bottom:-1px;border-right:0;border-top:0',
        'right:-1px;bottom:-1px;border-left:0;border-top:0'
      ][i];
      frame.appendChild(b);
    });

    stage.appendChild(frame);
    pl.hidden = false;
    var ar0 = wk.aspect || frameSize(m.kind);
    fitFrame(ar0);
    pl._ar = ar0;
    /* Google Drive は中身（縦長のポスター／横長の動画）で形が変わる。
       サムネイルを一度読んで縦横比を測り、埋め込みの窓をその形に合わせる */
    if (m.kind === 'drive' && m.thumb) {
      var probe = new Image();
      probe.onload = function () {
        if (playerWork !== wk || !probe.naturalWidth || !probe.naturalHeight) return;
        var ar = probe.naturalWidth / probe.naturalHeight;
        pl._ar = ar;
        fitFrame(ar);
      };
      probe.src = m.thumb;
    }
    setTimeout(function () { $('#p-close').focus(); }, 60);
  }

  function fitFrame(ar) {
    var pl = $('#player');
    if (pl.hidden) return;
    var frame = $('.frame', $('#p-stage'));
    if (!frame || frame.classList.contains('audio-stage')) return;
    /* 枠は stage の内側（padding を除いた箱）に収める。さらに 92% に抑えて、
       上のバー・下の説明との間に余白を残す */
    var st = $('#p-stage'), cs = getComputedStyle(st), r = st.getBoundingClientRect();
    var iw = (r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 0.92;
    var ih = (r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) * 0.92;
    var wpx = Math.min(iw, ih * ar);
    frame.style.width = Math.floor(wpx) + 'px';
    frame.style.height = Math.floor(wpx / ar) + 'px';
  }


  function closePlayer() {
    var pl = $('#player');
    if (pl.hidden) return;
    closeCmt();
    $('#p-stage').innerHTML = '';
    pl.hidden = true;
    playerWork = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function stepWork(dir) {
    if (!playerWork) return;
    var list = playerWork.node.cat.works;
    var at = list.indexOf(playerWork);
    var nx = (at + dir + list.length) % list.length;
    state.openSlug = list[nx].slug;
    render();
    openPlayer(list[nx]);
  }

  /* =====================================================
     シート（情報・アンケート）
     ===================================================== */
  var openSheet = null, sheetFocus = null;
  function showSheet(name) {
    var s = $('#sheet-' + name);
    if (!s) return;
    hideSheet();
    sheetFocus = d.activeElement;
    s.hidden = false;
    openSheet = s;
    var f = $('button,a,input,select,textarea', s);
    if (f) f.focus();
  }
  function hideSheet() {
    if (!openSheet) return;
    openSheet.hidden = true;
    openSheet = null;
    if (sheetFocus && sheetFocus.focus) sheetFocus.focus();
  }

  /* =====================================================
     URL（共有・戻るボタン）
     ===================================================== */
  var muteHash = false;
  function updateHash() {
    if (muteHash) return;
    var h = '';
    if (state.openSlug) h = '#w/' + encodeURIComponent(state.openSlug);
    else if (state.zoom) h = '#g/' + encodeURIComponent(state.zoom);
    if (('#' + (location.hash || '').replace(/^#/, '')) !== h && (location.hash || '') !== h) {
      history.replaceState(null, '', h || location.pathname + location.search);
    }
  }
  function readHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (h.indexOf('w/') === 0) {
      var wk = Data.bySlug(decodeURIComponent(h.slice(2)));
      if (wk) {
        var c = catOf(wk.category);
        if (c) { state.zoom = c.key; state.ang = angleOf(c); }
        state.openSlug = wk.slug;
        return;
      }
    }
    if (h.indexOf('g/') === 0) {
      var c2 = catOf(decodeURIComponent(h.slice(2)));
      if (c2) { state.zoom = c2.key; state.ang = angleOf(c2); }
    }
  }

  /* =====================================================
     星
     ===================================================== */
  function stars() {
    var host = $('#stars');
    var v = vp();
    if (!v.ok) return;
    var vw = v.w, vh = v.h;
    var s = 20261;
    var rnd = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    var pts = [], MIN2 = 76 * 76, tries = 0;
    var want = Math.round((vw * vh) / 26000);
    host.innerHTML = '';
    while (pts.length < want && tries < 9000) {
      tries++;
      var x = Math.round(rnd() * (vw - 16)) + 8, y = Math.round(rnd() * (vh - 16)) + 8;
      var ok = true;
      for (var i = 0; i < pts.length; i++) {
        var dx = pts[i].x - x, dy = pts[i].y - y;
        if (dx * dx + dy * dy < MIN2) { ok = false; break; }
      }
      if (!ok) continue;
      var b = rnd();
      pts.push({ x:x, y:y, d: b > 0.85 ? 2.6 : (b > 0.6 ? 1.9 : 1.3), o:(0.18 + rnd() * 0.5).toFixed(2) });
    }
    pts.forEach(function (p) {
      var i2 = el('i');
      i2.style.cssText = 'left:' + p.x + 'px;top:' + p.y + 'px;width:' + p.d + 'px;height:' + p.d + 'px;opacity:' + p.o;
      host.appendChild(i2);
    });
  }

  /* =====================================================
     配線
     ===================================================== */
  function wire() {
    $$('[data-home]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); surface(); });
    });
    $('#hero-back').addEventListener('click', function (e) { e.stopPropagation(); surface(); });
    $$('[data-sheet]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); showSheet(b.getAttribute('data-sheet')); });
    });
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { hideSheet(); return; }
      if (e.target.closest('.player') || e.target.closest('.sheet') || e.target.closest('.nav')) return;
      if (state.openSlug) openWork(null);
    });
    $('#p-close').addEventListener('click', closePlayer);
    $('#p-prev').addEventListener('click', function () { stepWork(-1); });
    $('#p-next').addEventListener('click', function () { stepWork(1); });

    $('#p-like').addEventListener('click', function () {
      if (!playerWork) return;
      var slug = playerWork.slug;
      var on = !isLiked(slug);
      setLiked(slug, on);
      var b = this;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');

      /* 表示は、開いたときに取った基準値に対して単純に ±1 するだけ。
         どちらの裏側の返り値でも動かさない（複数の通信が前後して
         届くと、そちらで上書きするたびに数字が行ったり来たりして
         いたため）。正しい数字は次にこの作品を開いたときにまた
         基準値として取り直す。
         Firebase には数え上げ用の加算を、スプレッドシートには
         「押された」の記録を、それぞれ裏で飛ばす（どちらも表示は
         待たない）。 */
      if (HeartsOn && heartBaseSlug === slug) {
        heartCounts[slug] = Math.max(0, (heartCounts[slug] || 0) + (on ? 1 : -1));
        showHeart(slug);
      }
      if (Hearts && Hearts.enabled) Hearts.bump(slug, on ? 1 : -1);
      if (Cloud && Cloud.enabled) Cloud.heart(slug, on);

      if (on) {
        /* 弾んだ跡に、小さな光の粒を数個だけ散らす。数が多いと
           安っぽく見えるので最小限に。 */
        b.classList.remove('burst'); void b.offsetWidth; b.classList.add('burst');
      }
    });

    /* ---- 全画面：作品の枠だけを画面いっぱいにする ---- */
    var fsBtn = $('#p-fs');
    if (fsBtn) {
      var canFs = !!(d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen);
      if (!canFs) fsBtn.hidden = true;
      fsBtn.addEventListener('click', function () {
        var fr = $('.frame', $('#p-stage'));
        if (!fr) return;
        if (d.fullscreenElement || d.webkitFullscreenElement) {
          (d.exitFullscreen || d.webkitExitFullscreen).call(d);
        } else {
          (fr.requestFullscreen || fr.webkitRequestFullscreen).call(fr);
          /* ゲームにキー入力が届くよう、中身にフォーカスを渡す */
          var f = $('iframe', fr); if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 200);
        }
      });
      var syncFs = function () { fsBtn.classList.toggle('on', !!(d.fullscreenElement || d.webkitFullscreenElement)); };
      d.addEventListener('fullscreenchange', syncFs);
      d.addEventListener('webkitfullscreenchange', syncFs);
    }

    /* ---- ひとこと（コメント）を開け閉め ---- */
    var cmtToggle = $('#cmt-toggle');
    if (cmtToggle) {
      cmtToggle.addEventListener('click', function () {
        if (isCmtOpen()) closeCmt(); else openCmt();
      });
    }
    var cmtPanelClose = $('#cmt-panel-close');
    if (cmtPanelClose) cmtPanelClose.addEventListener('click', closeCmt);

    /* ---- ひとこと（コメント）を送る ---- */
    var cmtForm = $('#cmt-form');
    var cmtTextEl = $('#cmt-text'), cmtCounter = $('#cmt-counter');
    if (cmtTextEl && cmtCounter) {
      var upd = function () { cmtCounter.textContent = Array.from(cmtTextEl.value).length + '/200'; };
      cmtTextEl.addEventListener('input', upd);
      /* Ctrl / ⌘ + Enter で送信（Enter だけは改行） */
      cmtTextEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (cmtForm.requestSubmit) cmtForm.requestSubmit(); }
      });
    }
    if (cmtForm) {
      cmtForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (!playerWork || !CommentsOn) return;

        var slug = playerWork.slug;
        var text = $('#cmt-text').value.trim();
        var name = $('#cmt-name').value.trim();
        var note = $('#cmt-note');
        if (!text) { note.textContent = 'ひとこと書いてください。'; note.classList.add('bad'); return; }

        var send = $('#cmt-send');
        send.disabled = true;
        note.classList.remove('bad');
        note.textContent = '確認しています…';

        /* まず端末の中の判定AI（local-mod.js）で審査する。無料。
           載せられないものはここで止めて、送らない。
           通ったものは判定結果を添えて裏側に送り、裏側が最後に確かめて Firebase に載せる。
           published … 載った / rejected … 載らない */
        var Mod = window.CCMLocalMod;
        var judged = Mod ? Mod.check(name, text) : Promise.resolve(null);
        judged.then(function (local) {
          if (local && local.status === 'rejected') {
            return { status: 'rejected', message: (local.reason === '不適切・人への攻撃の疑い' || local.reason === '前向きでない内容')
              ? 'ごめんなさい、このひとことは載せられません。ここには、作品への感想・応援・質問を載せています。'
              : local.reason + '。' };
          }
          /* 端末の判定で「載せてよい」と出たら、裏側（Apps Script は数秒かかる）を
             待たずに、すぐ一覧の先頭に出して「載せました」と言う。
             裏側に断られたら、そのとき取り消す。 */
          if (local && local.status === 'published') showPending(name, text);
          return Cloud.addComment(slug, name, text, playerWork.title, local);
        }).then(function (res) {
          send.disabled = false;
          if (!res || (res.status !== 'published' && res.status !== 'held')) {
            if (pendingLi) { $('#cmt-text').value = text; $('#cmt-text').dispatchEvent(new Event('input')); dropPending(); }
          } else { pendingLi = null; }
          if (!res) {
            note.textContent = '送れませんでした。少し待ってもう一度どうぞ。';
            note.classList.add('bad');
            return;
          }
          if (res.status === 'published' || res.status === 'held') {
            $('#cmt-text').value = ''; $('#cmt-text').dispatchEvent(new Event('input'));
            note.textContent = res.message || (res.status === 'published'
              ? 'ありがとうございます。載せました。'
              : 'ありがとうございます。部員が確認してから載せます。');
            /* 書いたものがすぐ見えるように読み直す。loadComments だと
               この note の文言まで空にしてしまうので、一覧だけ読み直す。 */
            if (res.status === 'published' && playerWork && playerWork.slug === slug) refreshComments(slug);
            return;
          }
          /* 載せられなかったときは、書いた文を消さずに残す（直して送り直せる） */
          note.textContent = res.message || '送れませんでした。';
          note.classList.add('bad');
        });
      });
    }

    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (isCmtOpen()) closeCmt();
        else if (!$('#player').hidden) closePlayer();
        else if (openSheet) hideSheet();
        else if (state.openSlug) openWork(null);
        else if (state.zoom) surface();
        return;
      }
      if (!$('#player').hidden) {
        if (e.key === 'ArrowRight') { e.preventDefault(); stepWork(1); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); stepWork(-1); }
      }
    });

    var rt;
    function reflow() {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (!layout()) return;
        stars();
        if (!$('#player').hidden) fitFrame($('#player')._ar || 16 / 9);
        render();
      }, 120);
    }
    if (w.ResizeObserver) new ResizeObserver(reflow).observe(d.documentElement);
    w.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        layout(); stars();
        if (!$('#player').hidden) fitFrame($('#player')._ar || 16 / 9);
        render();
      }, 140);
    }, { passive:true });

    w.addEventListener('hashchange', function () {
      muteHash = true;
      state.zoom = null; state.openSlug = null;
      readHash();
      render();
      muteHash = false;
    });
  }

  /* =====================================================
     起動
     ===================================================== */
  /* 開いた瞬間だけ、惑星を順番に浮かび上がらせる。トランジションを
     使うので（キーフレームではない）、終わったあとは何も残らず、
     ズームで惑星を隠す通常の挙動を後から邪魔しない。
     ハッシュ付きで特定のジャンルへ直接来たときはやらない
     （寄っていく途中で他の惑星が湧いて出ると目障りなため）。 */
  function entrancePlanets() {
    if (state.zoom) return;
    if (w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    $$('.sys > .seat').forEach(function (seat, i) {
      var orbi = $('.unseat > .orbi', seat);
      if (!orbi) return;
      orbi.style.transition = 'none';
      orbi.style.opacity = '0';
      orbi.style.transform = 'translate(-50%,-50%) scale(.4)';
      void orbi.offsetWidth;
      orbi.style.transitionDelay = (i * 70) + 'ms';
      orbi.style.transition = '';
      requestAnimationFrame(function () {
        orbi.style.opacity = '';
        orbi.style.transform = '';
      });
      orbi.addEventListener('transitionend', function clear(e) {
        if (e.propertyName !== 'transform') return;
        orbi.style.transitionDelay = '';
        orbi.removeEventListener('transitionend', clear);
      });
    });
  }

  function start() {
    Data.load().then(function (res) {
      if (!Data.works.length) return;
      build();
      wire();
      wireDrag();
      readHash();
      /* 寸法が出るまで数フレーム試す。プレビュー枠は初期化が遅れることがある。 */
      var tries = 0, entranced = false;
      (function settle() {
        var done = layout();
        if (done) {
          stars(); render(); requestAnimationFrame(spin);
          if (!entranced) { entranced = true; entrancePlanets(); }
          return;
        }
        if (++tries < 60) requestAnimationFrame(settle);
      })();
      if (res.source === 'seed' && (CFG.sheetCsvUrl || '').trim()) {
        console.info('[CCM] スプレッドシートに繋がらないため、サンプルを表示しています。');
      }
    });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

})(window, document);
