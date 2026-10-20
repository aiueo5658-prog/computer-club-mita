/* =========================================================
   data.js — 作品データの取得・正規化
   ========================================================= */
(function (w) {
  'use strict';

  /* =========================================================
     SEED: スプレッドシート未接続時に使う作品データ。
     今は 2026 年の部員作品の本物だけを入れている（サンプルは全部消した）。
     作品が増えたらここに足すか、config.js の sheetCsvUrl でシートにつなぐ。
     ========================================================= */
  var SEED = [
    /* ===== 2026 年の部員作品（Discord の提出スレッドから） =====
       作者名はサイト全体の決まりどおり、イニシャルで載せる。
       ジャンルは中身から判断：ゲーム → プログラミング、ポスター（静止画） → デザイン */
    { title:'棒人間格闘', author:'T.K.', category:'プログラミング',
      /* unityroom は他サイトへの埋め込みを禁止しているので、作者が GitHub Pages に
         置いた同じ WebGL ビルドを埋め込む。画面は 1200×540（固定サイズ）。
         サムネイルは unityroom の作品アイコンを借りる */
      url:'https://bwh587bvwm-droid.github.io/mygamesyade/',
      aspect: 1200 / 590,   /* ゲーム画面 540 ＋ Unity の下の帯 */
      thumb:'https://os-worker.unityroom.com/unityroom_production/icon/349959/icon_20261005_214707.png',
      desc:'棒人間を操作して戦うゲームです。色々地味にうるさいです。スペースキーでジャンプ、Jキーで攻撃。ある日、月食が起きた。それはとても綺麗なもので、そこら辺に住んでる棒人間たちも集まってきた。しかし、その中のとある棒人間が声を上げた。「この月食、綺麗やなー。ってなんでお前らも見てんだよ！この月食は俺のため！」' },
    { title:'心肺蘇生リズムゲーム', author:'R.A.', category:'プログラミング',
      /* Godot の Web 書き出しを games/cpr/ に置いて、サイトの中で遊ぶ */
      url:'games/cpr/', aspect: 16 / 9, thumb:'games/cpr/thumb.webp',
      desc:'手術室を舞台に、リズムに合わせて心臓マッサージをするゲームです。' },
    { title:'ハンコ職人', author:'R.A.', category:'プログラミング',
      /* Godot の Web 書き出しを games/hanko/ に置いて、サイトの中で遊ぶ */
      url:'games/hanko/', aspect: 16 / 9, thumb:'games/hanko/thumb.webp',
      desc:'書類の枠のまん中をクリックして、ハンコを押していくゲームです。1で承認、2で却下、3で差戻。右クリックかスペースで書類をはじきます。' },
    { title:'ムーンキャッチャー', author:'D.C.', category:'プログラミング',
      url:'https://editor.p5js.org/2025241/full/Jbxo48084', aspect: 3 / 4, thumb:'works/thumbs/moon.webp',
      desc:'自分の月の形を変えて、上から落ちてくる月と形を合わせてキャッチするゲームです。（p5.js）' },
    { title:'迷路（超クソゲー）', author:'R.I.', category:'プログラミング',
      url:'works/meiro/', scratch: true, aspect: 4 / 3, thumb:'https://uploads.scratch.mit.edu/get_image/project/960117282_480x360.png',
      desc:'マウスカーソルで緑の四角を操作して、右下のところまで行けばクリア。完全自作です。' },
    { title:'NeuroShield', author:'R.I.', category:'プログラミング',
      url:'works/neuroshield/', aspect: 16 / 10, thumb:'works/thumbs/neuroshield.webp',
      desc:'Discord の荒らし対策 bot です。荒らしの集団が来たときの動きを、サイトの中の再現画面で試せます（本物の bot にはつながっていません）。' },
    { title:'Nova', author:'R.I.', category:'プログラミング',
      url:'works/nova/', aspect: 16 / 10, thumb:'works/thumbs/nova.webp',
      desc:'Discord の多機能 bot です。通知・管理・情報整理のコマンドを、サイトの中の再現画面で試せます（本物の bot にはつながっていません）。' },
    { title:'kibou', author:'T.T.', category:'音楽',
      url:'works/kibou.mp3', thumb:'works/thumbs/kibou.webp',
      desc:'Kawaii Future Bass というジャンルの曲を目指して作ったけど、そこまでには至らなかった曲です。もっと作るのがうまくなりたいです。' },
    { title:'カラス', author:'T.F.', category:'モデリング',
      url:'works/karasu.glb', thumb:'works/karasu-thumb.webp',
      desc:'Blender で作ったカラスです。できたら 3D プリントして展示したいと思っています。ドラッグで回して見られます。' },
    { title:'円周率', author:'R.K.', category:'プログラミング',
      url:'works/pi/', scratch: true, aspect: 4 / 3, thumb:'works/thumbs/pi.webp',   /* .sb3 を TurboWarp Packager で1枚の HTML にしたもの */
      desc:'Scratch で作った円周率の作品です。' },
    { title:'震源シミュレーション', author:'R.K.', category:'プログラミング',
      url:'works/shingen/', scratch: true, aspect: 4 / 3, thumb:'works/thumbs/shingen.webp',
      desc:'Scratch で作った震源のシミュレーションです。' },
    { title:'生態系シミュレーション', author:'S.Y.', category:'プログラミング',
      url:'works/seitaikei/', scratch: true, aspect: 4 / 3, thumb:'https://uploads.scratch.mit.edu/get_image/project/1388493691_480x360.png',
      desc:'生態系について楽しく学べるシミュレーションです。草、ネズミ、うさぎ、土の栄養度、病気の流行度に応じた変化がわかります。' },
    { title:'MIF用イライラ棒', author:'K.A.', category:'プログラミング',
      url:'works/irairabou/', scratch: true, aspect: 4 / 3, thumb:'https://uploads.scratch.mit.edu/get_image/project/1387718978_480x360.png',
      desc:'MIF のために作ったイライラ棒です。' },
    { title:'昆布クリッカー', author:'S.N.', category:'プログラミング',
      url:'works/konbu/', scratch: true, aspect: 4 / 3, thumb:'https://uploads.scratch.mit.edu/get_image/project/1366437612_480x360.png',
      desc:'この作品はコンピューター部の通称「昆布」のクリッカーゲームです。真ん中の昆布をクリックし、ショップでアイテムを買い昆布を増やしていきます。' },
    /* 音楽のサムネイルは、元の曲の公式動画のサムネイル（メルトはニコニコの原曲と同じ絵） */
    { title:'オーバーライド（ピアノカバー）', author:'S.T.', category:'音楽',
      url:'works/override.m4a', thumb:'works/thumbs/override.webp',
      desc:'吉田夜世さん作曲、重音テト歌唱の「オーバーライド」をピアノカバーしました。' },
    { title:'人生（ピアノカバー）', author:'S.T.', category:'音楽',
      url:'works/jinsei.m4a', thumb:'works/thumbs/jinsei.webp',
      desc:'アンメルツPさん作曲、初音ミク・鏡音リン・レン・巡音ルカ・MEIKO・KAITO歌唱の「人生」をピアノカバーしました。ぜひ聴き分けてみてください。' },
    { title:'のだ（ピアノカバー）', author:'S.T.', category:'音楽',
      url:'works/noda.m4a', thumb:'works/thumbs/noda.webp',
      desc:'大漠波新さん作曲、初音ミク・重音テト・ずんだもん歌唱の「のだ」のピアノカバーです。3人の歌声を聴き分けてみてください。' },
    { title:'メルト（カバー）', author:'S.T.', category:'音楽',
      url:'works/melt.m4a', thumb:'works/thumbs/melt.webp',
      desc:'ryo（supercell）さん作曲、初音ミク歌唱の「メルト」を、初音ミク V4X でボカロ、メロディーをシンセサイザー、残りをピアノでカバーしました。歌唱中に一箇所、音の長さが違うところがあるので探してみてください。' },
    { title:'GONポスター①', author:'R.A.', category:'デザイン',
      url:'https://drive.google.com/file/d/1wCqn2k4aTBrXkkAHARvgh8VTwkPnv4Lh/view',
      desc:'大好きなGONさんのデザインポスターを作りました。まだまだ作る予定です。今年からAdobe Photoshopを触り始めましたが、デザインの自由度が高くて楽しいです。みなさんもGONの配信を観ましょう。' },
    { title:'DRKS', author:'R.A.', category:'デザイン',
      url:'https://drive.google.com/file/d/1EBR2tKoYZ1-Agshy8OV3A6BpybCjC1bZ/view',
      desc:'DRKSという配信者の事務所のポスターです。前回同様、Pinterestでいいなと思ったポスターを真似して作りました。DRKSは加藤純一さんを筆頭とした配信者の集まりです。一人一人個性のある配信者なので大好きです。' }
  ];




  /* ---------- URL 解析 ---------- */
  function scratchId(url) {
    var m = /scratch\.mit\.edu\/projects\/(\d+)/.exec(url || '');
    return m ? m[1] : null;
  }
  function youtubeId(url) {
    var m = /(?:youtube\.com\/(?:watch\?v=20260825204949|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url || '');
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
    'film':'film', 'デザイン':'film', 'design':'film', '映像':'film', '静止画':'film', 'ポスター':'film', '動画':'film', 'movie':'film', 'video':'film',
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
    if (isDirectMedia(url, ['.png', '.jpg', '.jpeg', '.gif', '.webp'])) return 'film';
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
      /* 公開設定（リンクを知っている全員）になっているファイルなら、
         ログインなしでこのサムネイル用エンドポイントが読める。 */
      return { kind:'drive', id:did,
               embed:'https://drive.google.com/file/d/' + did + '/preview',
               thumb:'https://drive.google.com/thumbnail?id=' + did + '&sz=w480' };
    }
    /* GitHub Pages に置いた Unity WebGL などのウェブ作品は、そのまま枠に埋め込める */
    if (/^https:\/\/[\w-]+\.github\.io\//i.test(url)) return { kind:'web', embed:url, thumb:'' };
    /* p5.js エディタの全画面表示は埋め込める */
    if (/^https:\/\/editor\.p5js\.org\/[^/]+\/full\//.test(url)) return { kind:'web', embed:url, thumb:'' };
    /* Scratch のファイル（.sb3）は TurboWarp の埋め込みで、このサイトから読み込ませて動かす */
    if (/\.sb3(\?|$)/i.test(url)) {
      var abs = url;
      try { abs = new URL(url, location.href).href; } catch (e) {}
      return { kind:'web', embed:'https://turbowarp.org/embed?project_url=' + encodeURIComponent(abs), thumb:'' };
    }
    /* 3D モデル（.glb）はその場で回して見る */
    if (/\.glb(\?|$)/i.test(url)) return { kind:'model3d', embed:url, thumb:'' };
    /* このサイトの games/ に置いたゲーム（Godot・Unity の Web 書き出し） */
    if (/^(games|works)\/[\w-]+\/?$/.test(url)) return { kind:'web', embed:url, thumb:'' };
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
      thumb:    String(raw.thumb || '').trim(),
      aspect:   Number(raw.aspect) || 0,
      scratch:  !!raw.scratch
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
