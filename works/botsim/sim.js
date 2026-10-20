/* =========================================================
   botsim — Discord bot の「動きのイメージ」をブラウザの中で再現する。
   本物の bot には接続しない。返事の中身は bot の公開説明文から作った再現。
   bot ごとの違いは BOTS に書く（index.html の data-bot で選ぶ）。
   ========================================================= */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var log, input, pick;
  var bot, cmds, picked = 0, last = null;
  var you = { name: 'あなた', color: '#e67e22' };

  function now() {
    var d = new Date();
    return '今日 ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function avatar(u) {
    if (u.icon) return '<img class="av" src="' + u.icon + '" alt="">';
    return '<div class="av" style="background:' + u.color + '">' + esc(u.name.slice(0, 1)) + '</div>';
  }
  function scroll() { log.scrollTop = log.scrollHeight; }

  /* 1件のメッセージを足す。同じ人の連投はまとめて表示する */
  function post(u, html, opts) {
    opts = opts || {};
    var el = document.createElement('div');
    el.className = 'msg' + (last === u && !opts.slash ? ' cont' : '');
    el.innerHTML = avatar(u) +
      '<div class="hd">' + esc(u.name) + (u.bot ? '<span class="tag">APP</span>' : '') + '<time>' + now() + '</time></div>' +
      '<div class="bd">' + (opts.slash ? '<div class="slash">' + opts.slash + '</div>' : '') + html + '</div>';
    log.appendChild(el);
    last = u;
    scroll();
    return el;
  }
  function sys(text) {
    var el = document.createElement('div');
    el.className = 'sys';
    el.textContent = text;
    log.appendChild(el);
    last = null;
    scroll();
  }
  function embed(e) {
    var f = (e.fields || []).map(function (x) { return '<div><b>' + esc(x[0]) + '</b>' + esc(x[1]) + '</div>'; }).join('');
    return '<div class="embed ' + (e.tone || '') + '">' + (e.title ? '<div class="t">' + esc(e.title) + '</div>' : '') +
      (e.text ? '<div>' + esc(e.text).replace(/\n/g, '<br>') + '</div>' : '') + (f ? '<div class="f">' + f + '</div>' : '') + '</div>';
  }
  function say(html, delay, slash) {
    return new Promise(function (ok) {
      setTimeout(function () { ok(post(bot.user, html, { slash: slash })); }, delay == null ? 450 : delay);
    });
  }
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  /* ---------- ユーザーの入力 ---------- */
  function send(text) {
    text = text.trim();
    if (!text) return;
    if (text[0] === '/') {
      var name = text.slice(1).split(/\s+/)[0];
      var arg = text.slice(1 + name.length).trim();
      var c = cmds.filter(function (x) { return x.name === name; })[0];
      if (!c) { sys('「/' + name + '」というコマンドはありません。「/」を打つと一覧が出ます'); return; }
      var slash = '<b>' + esc(you.name) + '</b> が <b>/' + esc(name) + '</b> を使用しました';
      c.run(arg, slash);
      return;
    }
    var el = post(you, esc(text));
    if (bot.onMessage) bot.onMessage(you, text, el);
  }

  function showPick() {
    var v = input.value;
    if (v[0] !== '/' || /\s/.test(v)) { pick.hidden = true; return; }
    var q = v.slice(1);
    var list = cmds.filter(function (c) { return c.name.indexOf(q) === 0; });
    if (!list.length) { pick.hidden = true; return; }
    picked = Math.min(picked, list.length - 1);
    pick.innerHTML = list.map(function (c, i) {
      return '<div data-n="' + c.name + '"' + (i === picked ? ' class="on"' : '') + '>/' + c.name + (c.arg ? ' <small>' + esc(c.arg) + '</small>' : '') + '<small>' + esc(c.desc) + '</small></div>';
    }).join('');
    pick.hidden = false;
  }
  function choose(name) {
    var c = cmds.filter(function (x) { return x.name === name; })[0];
    input.value = '/' + name + (c && c.arg ? ' ' : '');
    pick.hidden = true;
    input.focus();
    if (c && !c.arg) { send(input.value); input.value = ''; }
  }

  /* =========================================================
     NeuroShield — 荒らし対策 bot
     ========================================================= */
  var raiders = ['xX_r41d_Xx', 'free_nitro_bot', 'spam_king', 'a8f2k1', 'raid_squad_7', 'zz_zz_zz', 'nuke_er', 'qwerty_001'];
  var spamLines = ['@everyone 無料Nitro配布中→ discord-gift.example', 'あああああああああああ', 'このサーバー終わりｗｗｗ', '@everyone @everyone @everyone', '■■■■■■■■■■■■■■■■'];
  function neuro() {
    var st = { shield: true, lockdown: false, blocked: 0, deleted: 0, timeouts: 0, recent: {} };
    var palette = ['#ed4245', '#9b59b6', '#3498db', '#1abc9c', '#e91e63', '#607d8b', '#795548', '#ff5722'];

    /* 同じ人の短時間の連投・一斉メンション・怪しいリンクを見張る */
    function onMessage(u, text, el) {
      if (!st.shield || u.bot) return;
      var t = Date.now(), r = st.recent[u.name] = (st.recent[u.name] || []).filter(function (x) { return t - x < 6000; });
      r.push(t);
      var reason = '';
      if (/@everyone|@here/.test(text)) reason = '一斉メンション';
      else if (/https?:\/\/|discord-gift|\.example/.test(text) && /nitro|gift|無料/i.test(text)) reason = '詐欺リンクの疑い';
      else if (r.length >= 4) reason = '短時間の連投（6秒で' + r.length + '件）';
      if (!reason) return;
      setTimeout(function () {
        el.querySelector('.bd').className = 'bd gone';
        st.deleted++;
        if (u === you && r.length < 6 && reason.indexOf('連投') === 0) {
          say(embed({ tone: 'warn', title: '⚠ 警告', text: u.name + ' さん、' + reason + 'を検知しました。続けるとタイムアウトになります。' }), 200);
        } else {
          st.timeouts++;
          say(embed({ tone: 'bad', title: '🛡 タイムアウト', text: u.name + ' を 10 分間タイムアウトしました。', fields: [['理由', reason], ['処理', 'メッセージ削除']] }), 200);
          st.recent[u.name] = [];
        }
      }, 250);
    }

    function raid() {
      var b = $('#raid'); if (b) b.disabled = true;
      sys('（ここから荒らしの再現が始まります）');
      var joined = 0, i = 0, raidMsgs = [];
      var users = raiders.map(function (n, k) { return { name: n, color: palette[k % palette.length] }; });
      function next() {
        if (i >= users.length) return finish();
        var u = users[i++];
        if (st.lockdown) {
          st.blocked++;
          say(embed({ tone: 'bad', text: '🚫 ' + u.name + ' の参加をブロックしました（ロックダウン中）' }), 120).then(function () { setTimeout(next, 260); });
          return;
        }
        sys(u.name + ' がサーバーに参加しました');
        joined++;
        setTimeout(function () {
          var el = post(u, esc(spamLines[(i - 1) % spamLines.length]));
          raidMsgs.push(el);
          onMessage(u, spamLines[(i - 1) % spamLines.length], el);
          if (joined === 3 && !st.lockdown && st.shield) {
            st.lockdown = true;
            /* レイドと判断したら、参加した荒らしの書き込みをまとめて消してタイムアウトする */
            raidMsgs.forEach(function (m) {
              var bd = m.querySelector('.bd');
              if (bd.className.indexOf('gone') < 0) { bd.className = 'bd gone'; st.deleted++; st.timeouts++; }
            });
            say(embed({ tone: 'bad', title: '🛡 レイドを検知', text: '10 秒間に 3 人が参加し、すぐに同じような書き込みをしました。\nサーバーをロックダウンします。新しい参加者は一時的に入れません。', fields: [['参加ペース', '通常の 18 倍'], ['新規アカウント', '3 / 3'], ['対応', 'ロックダウン']] }), 300)
              .then(function () { setTimeout(next, 500); });
          } else setTimeout(next, 700);
        }, 350);
      }
      function finish() {
        wait(900).then(function () {
          return say(embed({ tone: 'ok', title: '✅ 防御完了', text: '荒らしは止まりました。', fields: [['削除', st.deleted + ' 件'], ['タイムアウト', st.timeouts + ' 人'], ['参加ブロック', st.blocked + ' 人']] }));
        }).then(function () {
          sys('「/unlock」でロックダウンを解除できます。自分で連投や @everyone を試すこともできます');
          if (b) b.disabled = false;
        });
      }
      next();
    }

    return {
      user: { name: 'NeuroShield', bot: true, icon: '../thumbs/neuroshield.webp' },
      invite: 'https://discord.com/oauth2/authorize?client_id=1436980586500718692',
      channel: '雑談',
      intro: 'このサーバーは NeuroShield が守っています。\n上の「荒らしを再現」を押すと、荒らしの集団が来たときの動きを見られます。自分で同じ文を連投したり、@everyone を書いたりしても反応します。',
      action: '<button class="btn" id="raid">荒らしを再現</button>',
      bind: function () { $('#raid').onclick = raid; },
      onMessage: onMessage,
      chips: ['/status', '@everyone みんな見て', '/lockdown', '/unlock'],
      cmds: [
        { name: 'status', desc: '防御の状態を見る', run: function (a, s) {
          say(embed({ tone: st.lockdown ? 'bad' : 'ok', title: '🛡 NeuroShield の状態', fields: [['防御', st.shield ? 'オン' : 'オフ'], ['ロックダウン', st.lockdown ? '中' : 'なし'], ['削除したメッセージ', st.deleted + ' 件'], ['タイムアウト', st.timeouts + ' 人'], ['参加ブロック', st.blocked + ' 人']] }), null, s);
        } },
        { name: 'lockdown', desc: 'サーバーをロックダウンする', run: function (a, s) {
          st.lockdown = true;
          say(embed({ tone: 'bad', title: '🔒 ロックダウン', text: '新しい参加者と書き込みを一時的に止めました。' }), null, s);
        } },
        { name: 'unlock', desc: 'ロックダウンを解除する', run: function (a, s) {
          st.lockdown = false; st.recent = {};
          say(embed({ tone: 'ok', title: '🔓 解除', text: 'ロックダウンを解除しました。見張りは続けています。' }), null, s);
        } },
        { name: 'shield', arg: 'on / off', desc: '自動防御を切り替える', run: function (a, s) {
          st.shield = a !== 'off';
          say(embed({ tone: st.shield ? 'ok' : 'warn', text: '自動防御を' + (st.shield ? 'オン' : 'オフ') + 'にしました。' }), null, s);
        } }
      ]
    };
  }

  /* =========================================================
     Nova — 多機能 bot（通知・管理・情報整理）
     ========================================================= */
  function nova() {
    var memos = [], polls = 0;
    var members = ['あなた', 'R.I.', 'T.K.', 'S.T.', 'D.C.', 'S.N.'];
    return {
      user: { name: 'Nova', bot: true, icon: '../thumbs/nova.webp' },
      invite: 'https://discord.com/oauth2/authorize?client_id=1546154449070719127',
      channel: 'bot-テスト',
      intro: 'Nova は通知・管理・情報整理をまとめてこなす bot です。\n「/」を打つとコマンドの一覧が出ます。下のボタンからも試せます。',
      action: '<button class="btn" id="join">メンバー参加を再現</button>',
      bind: function () {
        $('#join').onclick = function () {
          var n = '新入部員' + (Math.floor(Math.random() * 90) + 10);
          sys(n + ' がサーバーに参加しました');
          say(embed({ title: '👋 ようこそ、' + n + ' さん', text: 'コンピューター部のサーバーへようこそ。\n#自己紹介 で一言どうぞ。ルールは #ルール にあります。', fields: [['メンバー数', (members.length + 1) + ' 人目']] }), 600);
        };
      },
      chips: ['/help', '/serverinfo', '/remind 10秒 片付け', '/poll 次の作品展のテーマ'],
      cmds: [
        { name: 'help', desc: 'できることの一覧', run: function (a, s) {
          say(embed({ title: 'Nova のコマンド', text: cmds.map(function (c) { return '/' + c.name + (c.arg ? ' ' + c.arg : '') + ' — ' + c.desc; }).join('\n') }), null, s);
        } },
        { name: 'serverinfo', desc: 'サーバーの情報', run: function (a, s) {
          say(embed({ title: 'コンピューター部', fields: [['メンバー', members.length + ' 人'], ['チャンネル', '3'], ['bot', 'Nova']] }), null, s);
        } },
        { name: 'userinfo', desc: '自分の情報', run: function (a, s) {
          say(embed({ title: you.name, fields: [['参加日', '今日'], ['ロール', '部員'], ['メッセージ数', String(log.querySelectorAll('.msg').length)]] }), null, s);
        } },
        { name: 'remind', arg: '時間 内容', desc: '時間がたったら知らせる', run: function (a, s) {
          var m = /^(\d+)\s*(秒|分)?\s*(.*)$/.exec(a);
          if (!m) { say(embed({ tone: 'warn', text: '例：/remind 10秒 片付け' }), null, s); return; }
          var sec = Math.min(+m[1] * (m[2] === '分' ? 60 : 1), 120), what = m[3] || '時間です';
          say(embed({ tone: 'ok', text: '⏰ ' + sec + ' 秒後に「' + what + '」をお知らせします。' }), null, s);
          setTimeout(function () { say('<b>@' + esc(you.name) + '</b> ⏰ リマインド：' + esc(what)); }, sec * 1000);
        } },
        { name: 'poll', arg: '質問', desc: '投票をつくる', run: function (a, s) {
          var q = a || '今日のおやつは？', id = 'poll' + (++polls), votes = [0, 0, 0], opts = ['賛成', '反対', 'どちらでも'];
          say(embed({ title: '📊 ' + q, text: '下のボタンで投票できます。' }) +
            '<div class="chips" id="' + id + '" style="margin-top:6px">' + opts.map(function (o, i) { return '<button class="chip" data-i="' + i + '">' + o + ' · 0</button>'; }).join('') + '</div>', null, s)
            .then(function () {
              var box = document.getElementById(id), voted = false;
              box.onclick = function (e) {
                var b = e.target.closest('button'); if (!b || voted) return;
                voted = true; votes[+b.dataset.i]++;
                [].forEach.call(box.children, function (c, i) { c.textContent = opts[i] + ' · ' + votes[i]; c.disabled = true; });
              };
            });
        } },
        { name: 'memo', arg: '内容', desc: 'メモを保存（空なら一覧）', run: function (a, s) {
          if (a) { memos.push(a); say(embed({ tone: 'ok', text: '📝 メモを保存しました（' + memos.length + ' 件目）' }), null, s); }
          else say(embed({ title: '📝 メモ', text: memos.length ? memos.map(function (m, i) { return (i + 1) + '. ' + m; }).join('\n') : 'まだメモはありません。' }), null, s);
        } },
        { name: 'clear', arg: '件数', desc: 'メッセージをまとめて消す（管理）', run: function (a, s) {
          var n = Math.max(1, Math.min(+a || 5, 50)), all = log.querySelectorAll('.msg'), k = 0;
          for (var i = all.length - 1; i >= 0 && k < n; i--, k++) all[i].remove();
          last = null;
          say(embed({ tone: 'ok', text: '🧹 ' + k + ' 件のメッセージを削除しました。' }), null, s);
        } }
      ]
    };
  }

  /* ---------- 起動 ---------- */
  function start() {
    var key = document.body.getAttribute('data-bot');
    bot = key === 'nova' ? nova() : neuro();
    cmds = bot.cmds;
    document.body.innerHTML =
      '<div class="app"><aside class="side"><div class="guild">コンピューター部（再現）</div>' +
      '<div class="chs"><div class="ch">ルール</div><div class="ch on">' + esc(bot.channel) + '</div><div class="ch">作品</div></div>' +
      '<div class="note"><b>動きのイメージです。</b>本物の ' + esc(bot.user.name) + ' にはつながっていません。返事は bot の説明文をもとにした再現です。<br><a href="' + bot.invite + '" target="_blank" rel="noopener">本物をサーバーに招待する</a></div></aside>' +
      '<main class="main"><div class="top"># ' + esc(bot.channel) + '<span class="sp"></span>' + bot.action + '</div>' +
      '<div class="log"></div><div class="bar"><div class="pick" hidden></div><div class="chips"></div>' +
      '<input class="in" placeholder="#' + esc(bot.channel) + ' へメッセージを送信（/ でコマンド）" autocomplete="off"></div></main></div>';
    log = $('.log'); input = $('.in'); pick = $('.pick');
    $('.chips').innerHTML = bot.chips.map(function (c) { return '<button class="chip">' + esc(c) + '</button>'; }).join('');
    $('.chips').onclick = function (e) { var b = e.target.closest('button'); if (b) send(b.textContent); };
    bot.bind();
    input.addEventListener('input', function () { picked = 0; showPick(); });
    input.addEventListener('keydown', function (e) {
      var items = pick.hidden ? [] : pick.children;
      if (items.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault(); picked = (picked + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; showPick(); return;
      }
      if (items.length && (e.key === 'Tab' || (e.key === 'Enter' && !e.isComposing && input.value.indexOf(' ') < 0))) {
        e.preventDefault(); choose(items[picked].dataset.n); return;
      }
      if (e.key === 'Escape') { pick.hidden = true; return; }
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(input.value); input.value = ''; pick.hidden = true; }
    });
    pick.addEventListener('mousedown', function (e) { var d = e.target.closest('[data-n]'); if (d) { e.preventDefault(); choose(d.dataset.n); } });
    post(bot.user, esc(bot.intro).replace(/\n/g, '<br>'));
  }
  start();
})();
