/* =========================================================
   data.js — 作品データの取得・正規化
   ========================================================= */
(function (w) {
  'use strict';

  /* =========================================================
     SEED: スプレッドシート未接続時のサンプル。

     ⚠ ここに入っている URL は、サムネイルと埋め込み再生の
       見え方を確かめるために置いた **Scratch / YouTube の
       公開作品** です。部員の作品ではありません。

       本番前に必ず config.js の sheetCsvUrl を設定するか、
       ここを実データに置き換えてください。他人の作品が
       部員の作品として並んだまま公開されます。
     ========================================================= */
  var SEED = [
    { title:'アステロイド・ドリフト', author:'1年 A', category:'プログラミング',
      url:'https://scratch.mit.edu/projects/10128407/',
      desc:'小惑星帯を抜けるシューティング。当たり判定を軽くするために、敵の座標をリスト管理に置き換えました。' },
    { title:'深夜の学校からの脱出', author:'2年 B', category:'プログラミング',
      url:'https://scratch.mit.edu/projects/60917032/',
      desc:'部室をモデルにした脱出ゲーム。背景はすべてドット絵で描き起こしています。' },
    { title:'リズム・オブ・ミタ', author:'2年 C', category:'プログラミング',
      url:'https://scratch.mit.edu/projects/276660/',
      desc:'自作BGMに合わせて叩く音ゲー。判定のズレを直すのに三週間かかりました。' },
    { title:'部誌アーカイブ 2026', author:'2年 F', category:'プログラミング',
      url:'https://scratch.mit.edu/projects/1988107/',
      desc:'歴代の部誌をまとめた静的サイト。検索とタグ絞り込みを実装しました。' },
    { title:'迷路自動生成アルゴリズム比較', author:'3年 G', category:'プログラミング',
      url:'https://scratch.mit.edu/projects/119615465/',
      desc:'穴掘り法・棒倒し法・クラスカル法を実装して、生成される迷路の性質を比べました。' },

    { title:'放課後のパレット', author:'3年 D', category:'映像',
      url:'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      desc:'一年間の部活動を撮りためた記録映像。編集は DaVinci Resolve。' },
    { title:'部室の窓から', author:'2年 J', category:'映像',
      url:'https://www.youtube.com/watch?v=LXb3EKWsInQ',
      desc:'夕方の部室を定点で撮った短編。カラーグレーディングを勉強しました。' },
    { title:'部活紹介ムービー', author:'1年 M', category:'映像',
      url:'https://www.youtube.com/watch?v=eRsGyueVLvQ',
      desc:'新入生に向けて撮った紹介映像。ナレーションも部員が録りました。' },

    { title:'nocturne / 夜想', author:'1年 E', category:'音楽',
      url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      desc:'ピアノとシンセの小品。打ち込みは Domino、ミックスは Studio One。' },
    { title:'起動音のためのスケッチ', author:'3年 K', category:'音楽',
      url:'https://www.youtube.com/watch?v=ScMzIvxBSi4',
      desc:'サイトの起動音を作るつもりで書いた3秒の曲。結局30秒に伸びました。' },
    { title:'テーマ曲「eclipse」', author:'2年 N', category:'音楽',
      url:'https://scratch.mit.edu/projects/171408186/',
      desc:'今年の文化祭テーマに合わせて書いた曲。だんだん光が戻ってくる展開にしました。' },

    { title:'校舎まるごと3Dモデル', author:'2年 O', category:'モデリング',
      url:'https://scratch.mit.edu/projects/413418575/',
      desc:'Blender で校舎を再現しました。窓の数を数えるところから始めています。' },
    { title:'部室のミニチュア', author:'1年 P', category:'モデリング',
      url:'https://scratch.mit.edu/projects/437264978/',
      desc:'部室を1/12スケールでモデリング。机の傷まで入れました。' },

    { title:'ドット絵で描く校舎', author:'1年 H', category:'その他',
      url:'https://scratch.mit.edu/projects/10357326/',
      desc:'64x64 のキャンバスに校舎を描きました。使った色は 12 色だけです。' },
    { title:'部章のリデザイン', author:'2年 L', category:'その他',
      url:'https://scratch.mit.edu/projects/16659573/',
      desc:'部の紋章を作り直しました。六角形は基板のイメージです。' },

    { title:'タイピング練習「打鍵」', author:'1年 Q', category:'プログラミング',
      url:'https://scratch.mit.edu/projects/15355774/',
      desc:'苦手なキーだけを繰り返し出題します。指の運びを記録して弱点を出しています。' },

    { title:'文化祭準備の30日', author:'2年 R', category:'映像',
      url:'https://www.youtube.com/watch?v=9bZkp7q19f0',
      desc:'準備期間をタイムラプスでつなぎました。1日1カット、欠かさず撮っています。' },
    { title:'一分間のストップモーション', author:'1年 S', category:'映像',
      url:'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
      desc:'消しゴムが机の上を歩きます。720枚撮って1分になりました。' },
    { title:'はじめてのScratch 解説', author:'3年 G', category:'映像',
      url:'https://www.youtube.com/watch?v=hTWKbfoikeg',
      desc:'入部したばかりの人に向けた操作解説。画面録画にナレーションを重ねています。' },

    { title:'廊下のノイズ・スケッチ', author:'2年 T', category:'音楽',
      url:'https://www.youtube.com/watch?v=YQHsXMglC9A',
      desc:'休み時間の廊下を録って、素材として組み直しました。全部の音が校内の音です。' },
    { title:'8bitで組んだ校歌', author:'1年 U', category:'音楽',
      url:'https://www.youtube.com/watch?v=OPf0YbXqDm0',
      desc:'校歌を矩形波3声とノイズ1声だけで再構成しました。' },
    { title:'部室のアンビエント', author:'3年 K', category:'音楽',
      url:'https://www.youtube.com/watch?v=60ItHLz5WEA',
      desc:'放課後の部室で流すために書いた12分の曲。パソコンのファンの音に合わせています。' },

    { title:'部章の立体化', author:'2年 L', category:'モデリング',
      url:'https://scratch.mit.edu/projects/30235532/',
      desc:'平面の部章を立体に起こしました。面取りの角度で印象が変わるのが面白かったです。' },
    { title:'教室の机と椅子', author:'1年 Q', category:'モデリング',
      url:'https://scratch.mit.edu/projects/23456789/',
      desc:'実際に定規で測って寸法を取りました。天板の反りまで再現しています。' },
    { title:'給水塔のモデル', author:'3年 G', category:'モデリング',
      url:'https://scratch.mit.edu/projects/222222222/',
      desc:'屋上から見える給水塔。錆の表現をテクスチャで作り込みました。' },
    { title:'自作キーボードの筐体', author:'2年 R', category:'モデリング',
      url:'https://scratch.mit.edu/projects/333333333/',
      desc:'3Dプリンタで出すところまでやりました。3回作り直しています。' },

    { title:'部誌の表紙イラスト', author:'1年 S', category:'その他',
      url:'https://scratch.mit.edu/projects/999999999/',
      desc:'今年の部誌の表紙です。日食をモチーフにしました。' },
    { title:'展示ポスターのデザイン', author:'2年 T', category:'その他',
      url:'https://scratch.mit.edu/projects/300000000/',
      desc:'校内に貼ったポスター。遠くからでも読める字の大きさを探りました。' },
    { title:'サイトのアイコン一式', author:'3年 K', category:'その他',
      url:'https://scratch.mit.edu/projects/500000000/',
      desc:'このサイトで使っているアイコンを描きました。線の太さを全部そろえています。' },
    { title:'部室レイアウトの提案', author:'1年 U', category:'その他',
      url:'https://scratch.mit.edu/projects/800000000/',
      desc:'机の配置を変える提案です。動線を測って3案作りました。' }
  ];




  /* ---------- URL 解析 ---------- */
  function scratchId(url) {
    var m = /scratch\.mit\.edu\/projects\/(\d+)/.exec(url || '');
    return m ? m[1] : null;
  }
  function youtubeId(url) {
    var m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url || '');
    return m ? m[1] : null;
  }
  function driveId(url) {
    var m = /drive\.google\.com\/(?:file\/d\/([\w-]+)|open\?id=([\w-]+))/.exec(url || '');
    return m ? (m[1] || m[2]) : null;
  }
  function isDirectMedia(url, exts) {
    if (!url) return false;
    var clean = url.split('?')[0].toLowerCase();
    for (var i = 0; i < exts.length; i++) {
      if (clean.slice(-exts[i].length) === exts[i]) return true;
    }
    return false;
  }

  /* ---------- カテゴリ推定 ---------- */
  var CAT_ALIAS = {
    'music':'music', '音楽':'music', '楽曲':'music', 'audio':'music', 'bgm':'music', '作曲':'music',
    'film':'film', '映像':'film', '動画':'film', 'movie':'film', 'video':'film',
    'code':'code', 'プログラミング':'code', 'プログラム':'code', 'ゲーム':'code', 'game':'code',
      'scratch':'code', 'web':'code', 'サイト':'code', 'アプリ':'code', 'app':'code',
    'model':'model', 'モデリング':'model', '3d':'model', 'blender':'model', 'cg':'model',
    'other':'other', 'その他':'other', 'イラスト':'other', 'グラフィック':'other', '絵':'other', 'art':'other'
  };

  function normalizeCategory(raw, url) {
    var v = String(raw || '').trim().toLowerCase();
    if (CAT_ALIAS[v]) return CAT_ALIAS[v];
    for (var k in CAT_ALIAS) {
      if (v.indexOf(k) !== -1) return CAT_ALIAS[k];
    }
    if (scratchId(url)) return 'code';
    if (youtubeId(url)) return 'film';
    if (isDirectMedia(url, ['.mp3', '.wav', '.m4a', '.ogg'])) return 'music';
    if (isDirectMedia(url, ['.mp4', '.webm', '.mov'])) return 'film';
    if (isDirectMedia(url, ['.png', '.jpg', '.jpeg', '.gif', '.webp'])) return 'other';
    return 'other';
  }

  /* ---------- メディア種別の判定 ---------- */
  function resolveMedia(item) {
    var url = item.url || '';
    var sid = scratchId(url), yid = youtubeId(url), did = driveId(url);

    if (sid) {
      return { kind:'scratch', id:sid,
               embed:'https://scratch.mit.edu/projects/' + sid + '/embed',
               thumb:'https://uploads.scratch.mit.edu/get_image/project/' + sid + '_480x360.png' };
    }
    if (yid) {
      return { kind:'youtube', id:yid,
               embed:'https://www.youtube-nocookie.com/embed/' + yid,
               /* hqdefault は 4:3 の額縁で上下に黒帯が焼き込まれている。
                  mqdefault は素の 16:9 なので帯が出ない。 */
               thumb:'https://img.youtube.com/vi/' + yid + '/mqdefault.jpg' };
    }
    if (did) {
      return { kind:'drive', id:did,
               embed:'https://drive.google.com/file/d/' + did + '/preview',
               thumb:'' };
    }
    if (isDirectMedia(url, ['.mp4', '.webm'])) return { kind:'video-file', embed:url, thumb:'' };
    if (isDirectMedia(url, ['.mp3', '.wav', '.m4a', '.ogg'])) return { kind:'audio-file', embed:url, thumb:'' };
    if (isDirectMedia(url, ['.png', '.jpg', '.jpeg', '.gif', '.webp'])) return { kind:'image', embed:url, thumb:url };
    if (url) return { kind:'link', embed:'', thumb:'' };
    return { kind:'none', embed:'', thumb:'' };
  }

  /* ---------- URL 用の識別子 ----------
     作品ごとに固有の住所を持たせるため、タイトルからスラッグを作る。
     日本語はそのまま encodeURIComponent されるので、記号だけ落として詰める。 */
  function slugify(s) {
    return String(s || '')
      .trim()
      .replace(/[\s　]+/g, '-')
      .replace(/[\/\\?#&=%"'`<>\[\]{}|^~:;,.!*()+]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'work';
  }

  /* ---------- 正規化 ---------- */
  var uid = 0, usedSlugs = {};
  function normalize(raw) {
    var item = {
      id:       'w' + (++uid),
      title:    String(raw.title || '').trim() || '無題',
      author:   String(raw.author || '').trim() || '部員',
      url:      String(raw.url || '').trim(),
      desc:     String(raw.desc || '').trim(),
      docUrl:   String(raw.docUrl || '').trim(),
      thumb:    String(raw.thumb || '').trim()
    };
    item.category = normalizeCategory(raw.category, item.url);
    item.media = resolveMedia(item);
    if (!item.thumb && item.media.thumb) item.thumb = item.media.thumb;

    /* 画面内で再生できるものだけ「遊べる/見られる」扱いにする。
       外部サイトに飛ぶだけのものに再生バッジを出さないため。 */
    item.playable = ['scratch', 'youtube', 'drive', 'video-file', 'audio-file', 'image']
      .indexOf(item.media.kind) !== -1;

    var base = slugify(item.title);
    var slug = base, n = 2;
    while (usedSlugs[slug]) slug = base + '-' + (n++);
    usedSlugs[slug] = true;
    item.slug = slug;

    return item;
  }

  /* ---------- CSV パーサ（引用符・改行対応） ---------- */
  function parseCsv(text) {
    var rows = [], row = [], cur = '', q = false, i = 0;
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    while (i < text.length) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        cur += c; i++; continue;
      }
      if (c === '"') { q = true; i++; continue; }
      if (c === ',') { row.push(cur); cur = ''; i++; continue; }
      if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; continue; }
      cur += c; i++;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  /* 列名 → インデックス を candidates から探す（部分一致・大文字小文字無視） */
  function findCol(header, candidates) {
    for (var c = 0; c < candidates.length; c++) {
      var want = candidates[c].toLowerCase();
      for (var h = 0; h < header.length; h++) {
        if (header[h].toLowerCase().indexOf(want) !== -1) return h;
      }
    }
    return -1;
  }

  function fromCsv(text, colMap) {
    var rows = parseCsv(text).filter(function (r) {
      return r.some(function (v) { return String(v).trim() !== ''; });
    });
    if (rows.length < 2) return [];

    var header = rows[0].map(function (s) { return String(s).trim(); });
    var idx = {};
    for (var key in colMap) idx[key] = findCol(header, colMap[key]);

    return rows.slice(1).map(function (r) {
      var o = {};
      for (var k in idx) o[k] = idx[k] >= 0 ? String(r[idx[k]] || '').trim() : '';
      return o;
    }).filter(function (o) { return o.title || o.url; });
  }

  /* ---------- 公開 API ---------- */
  var Data = {
    works: [],

    load: function () {
      var cfg = w.CCM || {};
      var url = (cfg.sheetCsvUrl || '').trim();

      usedSlugs = {}; uid = 0;

      if (!url) {
        Data.works = SEED.map(normalize);
        return Promise.resolve({ works: Data.works, source: 'seed' });
      }

      return fetch(url, { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function (text) {
          var rawRows = fromCsv(text, cfg.sheetColumns || {});
          if (!rawRows.length) throw new Error('no rows');
          Data.works = rawRows.map(normalize);
          return { works: Data.works, source: 'sheet' };
        })
        .catch(function (err) {
          console.warn('[CCM] スプレッドシートの取得に失敗、SEED を使用します:', err.message);
          Data.works = SEED.map(normalize);
          return { works: Data.works, source: 'seed' };
        });
    },

    byCategory: function (key) {
      if (!key || key === 'all') return Data.works;
      return Data.works.filter(function (x) { return x.category === key; });
    },

    counts: function () {
      var out = {};
      Data.works.forEach(function (x) { out[x.category] = (out[x.category] || 0) + 1; });
      return out;
    },

    bySlug: function (slug) {
      for (var i = 0; i < Data.works.length; i++) {
        if (Data.works[i].slug === slug) return Data.works[i];
      }
      return null;
    },

    /* 制作者ごとにまとめる。名前の登場順を保つ。 */
    authors: function () {
      var order = [], map = {};
      Data.works.forEach(function (x) {
        if (!map[x.author]) { map[x.author] = []; order.push(x.author); }
        map[x.author].push(x);
      });
      return order.map(function (name) { return { name: name, works: map[name] }; });
    },

    playableCount: function () {
      return Data.works.filter(function (x) { return x.playable; }).length;
    }
  };

  w.CCMData = Data;
  w.CCMData._seed = SEED;
  w.CCMData._normalize = normalize;
})(window);
