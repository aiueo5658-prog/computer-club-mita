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
    /* ===== プログラミング / 映像 は昨年の実サイト（昆布Wiki）から実際の
       部員作品です。それ以外のジャンルは、まだサンプルのままです。 ===== */
    { title:'恥ずかしがりの恐竜', author:'R.A.', category:'プログラミング',
      url:'https://scratch.mit.edu/projects/426872449/',
      desc:'クロームの恐竜ゲームを再現してみました。小4に作ったコードを改良したものを出しているので、コードがぐちゃぐちゃで大変でした。恐竜なのに小心者。マザコンであるほど身弱な冒険が始まります。' },
    { title:'反射神経', author:'T.K.', category:'プログラミング',
      url:'https://scratch.mit.edu/projects/1062642501/',
      desc:'タイミングが合えば敵を斬ることができますが、ミスったら自分も斬られます。' },
    { title:'STG「敵艦を撃退せよ」', author:'W.F', category:'プログラミング',
      url:'https://scratch.mit.edu/projects/662428120/',
      desc:'昔に作ったシューティングゲームです。' },
    { title:'Scratch 作品（ボールゲーム）', author:'T.I.', category:'プログラミング',
      url:'https://scratch.mit.edu/projects/1228655685/',
      desc:'TAITOのアルカノイドというゲームをモチーフにして作ったゲームです。矢印キーで移動、Aボタンでビームを発射。ブロックに触れると破壊でき、全て破壊したらクリアです。' },
    { title:'国旗ゲーム', author:'T.K.', category:'プログラミング',
      url:'https://unityroom.com/games/flaggamedrop',
      desc:'Unityで制作されました。' },
    { title:'大惨事世界大戦', author:'T.K.', category:'プログラミング',
      url:'https://scratch.mit.edu/projects/1121433481/',
      desc:'にゃ○こ大戦争をモチーフにしたやつですね。ポーランドボールを知ってる人にはおすすめです。' },
    { title:'scratch 作品', author:'R.I.', category:'プログラミング',
      url:'https://scratch.mit.edu/projects/1188813855/',
      desc:'scratchで作成したダダサバイバー風のゲームです。ガチャ機能を追加するのが難しかったです。' },
    { title:'フィルターから逃げろ', author:'T.K.', category:'プログラミング',
      url:'https://scratch.mit.edu/projects/1096939377/',
      desc:'昔フィルターへの怒りをこめて作ったゲームです。矢印キーで動かしてレーザーや玉から逃げます。' },

    { title:'昆布MIF動画', author:'E.A.', category:'映像',
      url:'https://youtu.be/OGKo8Zogu9U',
      desc:'現在シアトルに入る生徒からの動画です。' },
    { title:'羽田空港ゆっくり（？）旅', author:'W.F', category:'映像',
      url:'https://youtu.be/3f0AtJZHsq0',
      desc:'去年の12月に、JA703Jが日本を離れるのを見に友達と羽田に行きました。その動画です。' },
    { title:'「神っぽいな」feat.鏡音リン', author:'W.F', category:'映像',
      url:'https://drive.google.com/file/d/1iyvc816g8Lm3VyH-weoPmN3fgO7x7L29/view',
      desc:'ピノキオピーさんの「神っぽいな」を鏡音リンでカバーしました。' },
    { title:'青函連絡船船内食堂の割りばし', author:'K.N.', category:'映像',
      url:'https://drive.google.com/file/d/163Xp9oFfi76uwkBYsz6OqRKnd3iFRUIV/view',
      desc:'説明は準備中です。' },
    { title:'推しを召喚する', author:'R.A.', category:'映像',
      url:'https://drive.google.com/file/d/1h2JNcjOUMUNKSF98NYe2pol3HGZ_7YRK/view',
      desc:'説明は準備中です。' },
    { title:'自作テクスチャパックを作りたい', author:'R.A.', category:'映像',
      url:'https://drive.google.com/file/d/1AWhN6HXeujxvGZ-BYgE_AXDkcy5Ynr16/view',
      desc:'説明は準備中です。' },

    { title:'無責任集合体ft. 重音テト&初音ミク[サビのみ]', author:'S.M.', category:'音楽',
      url:'https://drive.google.com/file/d/1vPGr6GOseeH7Jz0_SsbbIqucX3zN80NI/view',
      desc:'説明は準備中です。' },
    { title:'ボカロじゃないけどオリジナル曲', author:'T.T.', category:'音楽',
      url:'https://drive.google.com/file/d/1i7VoR8jsgC7EdXX_7Jo6Kk5ydtJlMUQ6/view',
      desc:'説明は準備中です。' },

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
