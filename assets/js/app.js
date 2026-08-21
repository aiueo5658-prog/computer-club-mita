/* =========================================================
   app.js — コンピュータ部 作品展 2026

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
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
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
  function planShells(n, satD, minR, rMax, pitch) {
    var i;
    for (var r = minR; r <= rMax; r += 5) {
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
    var sideRoom = vw >= 1180 ? 282 : 0;
    var guideRoom = vw >= 1180 ? 162 : (vw >= 820 ? 56 : 24);
    var topRoom = 92, LABEL = 140;
    var maxN = 1;
    cats.forEach(function (c) { if (c.works.length > maxN) maxN = c.works.length; });

    var R = Math.min(vw * 0.22, vh * 0.32, 245);
    for (var guard = 0; guard < 80; guard++) {
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

      var mR = pd / 2 + geo.satD * 0.9, xR = widest(geo.satD);
      var shells = (xR > mR && planShells(c.works.length, geo.satD, mR, xR, PITCH0))
                || geo.shells;
      c.node.shells = shells;
      c.node.pd = pd;
      c.node.ringPitch = null;      /* 角度が変わったときだけ描き直す */

      c.node.rings.innerHTML = '';
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
          var n = c.works[put++].node;
          n.r = sh.r;
          n.s0 = j / sh.count + sh.ph;
          n.period = 150 + i * 46;          /* 外の輪ほどゆっくり回る */
          n.body.style.setProperty('--d', geo.satD + 'px');
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
  function ringPath(r, pitch, wantFront, pr) {
    /* 中心の丸に隠れるのは、手前レイヤーは考えなくていい。手前は
       中心より上に描くので、丸に重なってもそのまま線が見えるだけで
       問題にならない。隠す必要があるのは奥側だけ。

       隠すかどうかは、縮む前の位置（sp.x, sp.y）で判定する。proj() が
       返す x, y は遠近の s を掛けたあとの「見た目の位置」で、奥ほど
       中心へ引き寄せて描く演出が入っている。この引き寄せられた後の
       座標で「中心の丸に近いか」を測ると、実際には丸から離れている
       区間まで巻き込んで判定してしまい、線が大きく欠けて見えていた。 */
    var out = [], cur = [], N = 180;
    for (var k = 0; k <= N; k++) {
      var phi = k / N * Math.PI * 2;
      var q = proj(phi, r, pitch);
      var spx = r * Math.cos(phi), spy = r * Math.sin(phi) * Math.sin(pitch);
      var hidden = !wantFront && (spx * spx + spy * spy < pr * pr);
      var ok = ((q.z >= 0) === wantFront) && !hidden;
      if (ok) cur.push(q.x.toFixed(1) + ',' + q.y.toFixed(1));
      else { if (cur.length > 1) out.push('M' + cur.join('L')); cur = []; }
    }
    if (cur.length > 1) out.push('M' + cur.join('L'));
    return out.join('');
  }

  function drawRings(c) {
    if (!c.node.paths) return;
    if (c.node.ringPitch === cam.pitch) return;
    c.node.ringPitch = cam.pitch;
    var pr = (c.node.pd || 0) / 2 + 6;
    for (var i = 0; i < c.node.shells.length; i++) {
      var r = c.node.shells[i].r;
      c.node.paths[i].back.setAttribute('d', ringPath(r, cam.pitch, false, pr));
      c.node.paths[i].front.setAttribute('d', ringPath(r, cam.pitch, true, pr));
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
        st.setProperty('--sc', pt.s.toFixed(3));
        var open = state.openSlug === wk.slug;
        st.setProperty('--dim', open ? '1' : (0.58 + (pt.z + 1) / 2 * 0.42).toFixed(3));
        /* 重なり順。作品はいつでも軌道の線より上に来る。
           奥:12〜19 → 中心:20 → 軌道の線(手前):21 → 手前の作品:24〜31 */
        st.zIndex = open ? 60
                  : (pt.z > 0 ? 24 + Math.round(pt.z * 7)
                              : 12 + Math.round((1 + pt.z) * 7));
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
  var spinT0 = null, spinAt = 0;
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
    $('#hero-kick').textContent = zc ? zc.label : 'ECLIPSE 2026';
    $('#hero-kick').style.color = zc ? zc.node.color : '';
    $('#hero-title').textContent = zc ? zc.jp : '作品一覧';
    $('#hero-title').style.fontSize = zc && zc.jp.length > 5
      ? 'clamp(30px,' + (380 / zc.jp.length / 16) + 'rem,' + Math.floor(380 / zc.jp.length) + 'px)' : '';
    $('#hero-lede').innerHTML = zc
      ? 'まるい絵ひとつが作品です。<br>横に引くと回ります。クリックで説明が出ます。'
      : 'ジャンルごとに作品を探検しよう。<br>まるい絵をクリックすると、その中の作品が並びます。';
    $('#hero-back').hidden = !zc;

    /* 右の一覧 */
    var side = $('#side');
    var showSide = !!zc && !state.openSlug && vp().w >= 1180;
    side.classList.toggle('off', !showSide);
    if (zc) {
      $('#side-kick').textContent = zc.label;
      $('#side-kick').style.color = zc.node.color;
      $('#side-title').textContent = zc.jp;
      $('#side-count').textContent = zc.works.length + '点';
      var list = $('#side-list');
      list.innerHTML = '';
      zc.works.forEach(function (wk) {
        var b = el('button', 'row' + (state.openSlug === wk.slug ? ' on' : ''));
        b.type = 'button';
        b.style.setProperty('--c', wk.node.color);
        b.innerHTML = '<i class="dot"></i><b></b>';
        var bb = $('b', b);
        bb.textContent = wk.title;
        var sp = el('span'); sp.textContent = wk.author; bb.appendChild(sp);
        b.addEventListener('click', function (e) { e.stopPropagation(); openWork(wk.slug); });
        list.appendChild(b);
      });
    }

    /* 吹き出し */
    Data.works.forEach(function (wk) {
      if (!wk.node) return;
      wk.node.callHost.innerHTML = '';
      /* 開いた衛星は place() が最前面へ持ち上げる。 */
      if (state.openSlug === wk.slug) wk.node.callHost.appendChild(buildCallout(wk));
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

  function buildCallout(wk) {
    var box = el('div', 'callout');
    box.style.setProperty('--c', wk.node.color);
    box.addEventListener('click', function (e) { e.stopPropagation(); });

    var panel = el('div', 'cpanel');
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

    box.innerHTML = '<i class="cdot"></i><i class="cdiag"></i><i class="chorz"></i>';
    box.appendChild(panel);
    return box;
  }

  function openWork(slug) { state.openSlug = slug; render(); }

  /* =====================================================
     全画面再生
     ===================================================== */
  var playerWork = null, lastFocus = null;

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

    if (m.kind === 'scratch' || m.kind === 'youtube' || m.kind === 'drive') {
      frame.appendChild(iframe(m.embed));
    } else if (m.kind === 'video-file') {
      var v = el('video'); v.src = m.embed; v.controls = true; v.playsInline = true; v.preload = 'metadata';
      frame.appendChild(v);
    } else if (m.kind === 'image') {
      var im = new Image(); im.src = m.embed; im.alt = wk.title;
      frame.appendChild(im);
    } else if (m.kind === 'audio-file') {
      frame.className = 'frame audio-stage';
      var au = el('audio'); au.src = m.embed; au.controls = true; au.preload = 'metadata';
      var lab = el('div', 'hint');
      lab.innerHTML = '<b>AUDIO</b>';
      frame.appendChild(lab); frame.appendChild(au);
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
    fitFrame(frameSize(m.kind));
    pl._ar = frameSize(m.kind);
    setTimeout(function () { $('#p-close').focus(); }, 60);
  }

  function fitFrame(ar) {
    var pl = $('#player');
    if (pl.hidden) return;
    var frame = $('.frame', $('#p-stage'));
    if (!frame || frame.classList.contains('audio-stage')) return;
    var r = $('#p-stage').getBoundingClientRect();
    var wpx = Math.min(r.width, r.height * ar);
    frame.style.width = Math.floor(wpx) + 'px';
    frame.style.height = Math.floor(wpx / ar) + 'px';
  }

  function closePlayer() {
    var pl = $('#player');
    if (pl.hidden) return;
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

    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('#player').hidden) closePlayer();
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
  function start() {
    Data.load().then(function (res) {
      if (!Data.works.length) return;
      build();
      wire();
      wireDrag();
      readHash();
      /* 寸法が出るまで数フレーム試す。プレビュー枠は初期化が遅れることがある。 */
      var tries = 0;
      (function settle() {
        var done = layout();
        if (done) { stars(); render(); requestAnimationFrame(spin); return; }
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
