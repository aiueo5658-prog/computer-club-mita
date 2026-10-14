/* =========================================================
   thumbs.js — 衛星の中身（サムネイル）

   実サムネイル（Scratch / YouTube）がある作品はそれを使う。
   無い作品はここで描く。円に切り抜かれるので、絵は中央に寄せる。

   ジャンルごとに絵柄を変え、作品ごとにハッシュで細部を振る。
   同じ作品には常に同じ絵が出る。
   ========================================================= */
(function (w, d) {
  'use strict';

  function hash32(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * @param {string} seedStr  作品名＋制作者など
   * @param {number} size     出力の一辺(px)
   * @param {{category:string, hue:number}} opts
   * @returns {HTMLCanvasElement}
   */
  function make(seedStr, size, opts) {
    opts = opts || {};
    size = size || 160;
    var dpr = Math.min(w.devicePixelRatio || 1, 2);
    var cv = d.createElement('canvas');
    cv.width = cv.height = Math.floor(size * dpr);
    cv.style.width = cv.style.height = '100%';
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    var seed = hash32(seedStr || 'ccm');
    var rand = rng(seed);
    var hue = opts.hue == null ? 150 : opts.hue;
    var S = size;

    var base = 'oklch(0.86 0.15 ' + hue + ')';
    var deep = 'oklch(0.40 0.10 ' + hue + ')';
    var ink  = 'oklch(0.22 0.06 ' + hue + ')';

    /* 地：ジャンル色のベタ塗り。円に切り抜かれる前提で全面を塗る。 */
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);

    /* 斜めの地紋。作品ごとに角度と間隔が変わる。 */
    var ang = [22, 68, 112, 158][seed % 4] * Math.PI / 180;
    var gap = S * (0.07 + (seed % 5) * 0.012);
    g.save();
    g.globalAlpha = 0.14;
    g.strokeStyle = '#000';
    g.lineWidth = gap * 0.5;
    var diag = S * 1.5;
    for (var t = -diag; t < diag; t += gap * 2) {
      g.beginPath();
      g.moveTo(S / 2 + Math.cos(ang) * -diag - Math.sin(ang) * t,
               S / 2 + Math.sin(ang) * -diag + Math.cos(ang) * t);
      g.lineTo(S / 2 + Math.cos(ang) * diag - Math.sin(ang) * t,
               S / 2 + Math.sin(ang) * diag + Math.cos(ang) * t);
      g.stroke();
    }
    g.restore();

    /* 中身：ジャンルごとの絵。中央 62% に収める。 */
    var c = S / 2, box = S * 0.62;
    g.save();
    g.translate(c, c);
    g.strokeStyle = ink; g.fillStyle = ink;
    g.lineCap = 'round'; g.lineJoin = 'round';

    var kind = opts.category || 'other';

    if (kind === 'music') {
      /* 波形 */
      var bars = 7, bw = box / (bars * 1.9);
      g.lineWidth = bw;
      for (var i = 0; i < bars; i++) {
        var x = -box / 2 + (box / (bars - 1)) * i;
        var h = box * (0.16 + rand() * 0.42);
        g.beginPath(); g.moveTo(x, -h); g.lineTo(x, h); g.stroke();
      }

    } else if (kind === 'film') {
      /* フィルムのコマと再生記号 */
      g.lineWidth = S * 0.035;
      var fw = box, fh = box * 0.66;
      g.strokeRect(-fw / 2, -fh / 2, fw, fh);
      var holes = 4, hs = fh * 0.13;
      for (var k = 0; k < holes; k++) {
        var hx = -fw / 2 + fw * (k + 0.5) / holes - hs / 2;
        g.fillRect(hx, -fh / 2 - hs * 1.3, hs, hs * 0.8);
        g.fillRect(hx, fh / 2 + hs * 0.5, hs, hs * 0.8);
      }
      g.beginPath();
      g.moveTo(-fh * 0.16, -fh * 0.24);
      g.lineTo(fh * 0.26, 0);
      g.lineTo(-fh * 0.16, fh * 0.24);
      g.closePath(); g.fill();

    } else if (kind === 'code') {
      /* コードの行 */
      g.lineWidth = S * 0.055;
      var lines = 4, lh = box / (lines + 1);
      for (var L = 0; L < lines; L++) {
        var y = -box / 2 + lh * (L + 0.7);
        var indent = (L === 1 || L === 2) ? box * 0.16 : 0;
        var len = box * (0.34 + rand() * 0.5) - indent;
        g.beginPath();
        g.moveTo(-box / 2 + indent, y);
        g.lineTo(-box / 2 + indent + Math.max(len, box * 0.2), y);
        g.stroke();
      }

    } else if (kind === 'model') {
      /* 等角の立方体 */
      var r = box * 0.44, hgt = r * 0.58;
      g.lineWidth = S * 0.038;
      function pt(a2, yy) { return [Math.cos(a2) * r, Math.sin(a2) * r * 0.5 + yy]; }
      var top = [], bot = [];
      for (var a3 = 0; a3 < 6; a3++) {
        var A = (Math.PI / 3) * a3 + Math.PI / 6;
        top.push(pt(A, -hgt)); bot.push(pt(A, hgt));
      }
      g.beginPath();
      top.forEach(function (p, i2) { i2 ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
      g.closePath(); g.stroke();
      [1, 3, 5].forEach(function (i2) {
        g.beginPath(); g.moveTo(top[i2][0], top[i2][1]); g.lineTo(bot[i2][0], bot[i2][1]); g.stroke();
      });
      g.beginPath();
      g.moveTo(bot[1][0], bot[1][1]);
      g.lineTo(bot[2][0], bot[2][1]); g.lineTo(bot[3][0], bot[3][1]);
      g.lineTo(bot[4][0], bot[4][1]); g.lineTo(bot[5][0], bot[5][1]);
      g.stroke();

    } else {
      /* その他：丸と四角の重なり */
      g.lineWidth = S * 0.042;
      g.beginPath(); g.arc(-box * 0.13, -box * 0.1, box * 0.26, 0, 6.2832); g.stroke();
      g.strokeRect(-box * 0.04, -box * 0.02, box * 0.34, box * 0.34);
    }
    g.restore();

    /* 上からの光。球らしさではなく、面の陰影として薄く。 */
    var sh = g.createLinearGradient(0, 0, S * 0.4, S);
    sh.addColorStop(0, 'rgba(255,255,255,.20)');
    sh.addColorStop(0.45, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(0,0,0,.26)');
    g.fillStyle = sh;
    g.fillRect(0, 0, S, S);

    return cv;
  }

  w.CCMThumbs = { make: make, hash: hash32 };
})(window, document);
