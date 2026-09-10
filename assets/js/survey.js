/* =========================================================
   survey.js — アンケート

   config.js の survey.formAction が設定されていれば Google フォームへ送る。
   未設定でも入力から感謝画面まで通しで動く（保存はされない）。
   保存されないことは、そのときだけ画面に出す。
   ========================================================= */
(function (w, d) {
  'use strict';

  var CFG = w.CCM || {};
  var Data = w.CCMData;
  var $  = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }

  var NOTE = 'いただいた声は部員のみが集計に利用します。個人が特定される情報は集めていません。';

  var answers = { rating:'', who:'', favWork:'', genre:'', interest:'', found:'', comment:'' };
  var live = false;   /* 送信先に繋がっているか */
  var Cloud = window.CCMCloud || null;   /* スプレッドシート（apiUrl） */

  function setNote(msg, err) {
    var n = $('#form-note');
    n.textContent = msg;
    n.classList.toggle('err', !!err);
  }

  /* ひとつだけ選ぶ群。もう一度押すと外れる。 */
  function single(hostId, key) {
    var host = $(hostId);
    if (!host) return;
    host.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      var was = b.classList.contains('on');
      $$('.chip', host).forEach(function (x) {
        x.classList.remove('on'); x.setAttribute('aria-pressed', 'false');
      });
      if (!was) { b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); answers[key] = b.getAttribute('data-v'); }
      else answers[key] = '';
    });
  }

  /* いくつでも選べる群。読点でつないで送る。 */
  function multi(hostId, key) {
    var host = $(hostId);
    if (!host) return;
    host.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      var on = !b.classList.contains('on');
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      answers[key] = $$('.chip.on', host).map(function (x) { return x.getAttribute('data-v'); }).join('、');
    });
  }

  function reset() {
    answers = { rating:'', who:'', favWork:'', genre:'', interest:'', found:'', comment:'' };
    $$('.rate').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed','false'); });
    $$('.chips .chip').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed','false'); });
    $('#fav-work').value = '';
    $('#comment').value = '';
    $('#cc').textContent = '0';
    $('#thanks').hidden = true;
    $('#thanks-echo').hidden = true;
    $('#survey-form').hidden = false;
    $('#submit-btn').disabled = false;
    setNote(NOTE, false);
    w.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* 送ってくれた内容を一言にして返す。書いた甲斐があったと分かるように。 */
  function echo() {
    var bits = [];
    var faces = { '1':'いまいち', '2':'すこし', '3':'ふつう', '4':'よかった', '5':'最高' };
    if (answers.rating) bits.push('満足度は「' + faces[answers.rating] + '」');
    if (answers.favWork) bits.push('一番は「' + answers.favWork.split(' / ')[0] + '」');
    if (answers.comment) bits.push('メッセージを ' + answers.comment.length + '文字');
    if (!bits.length) return '';
    return bits.join('、') + 'で受け取りました。';
  }

  function finish() {
    var e = echo();
    var box = $('#thanks-echo');
    if (e) { box.textContent = e; box.hidden = false; }
    if (!live) {
      box.textContent = (e ? e + ' ' : '') + '（このページはまだ送信先に繋がっていないため、内容は保存されていません）';
      box.hidden = false;
      box.classList.add('warn');
    }
    $('#survey-form').hidden = true;
    var thanks = $('#thanks');
    thanks.hidden = false;
    /* クラスを付け直すことで、同じセッション内で二回送っても
       食が欠けるところから毎回やり直す。 */
    thanks.classList.remove('in'); void thanks.offsetWidth;
    thanks.classList.add('in');
    $('#submit-btn').disabled = false;
    w.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submit(e) {
    e.preventDefault();
    if (!answers.rating) {
      setNote('展示の満足度だけ選んでください。ほかは空のままで構いません。', true);
      $('.rate').focus();
      return;
    }
    $('#submit-btn').disabled = true;
    setNote('送信中…', false);

    /* スプレッドシートへ直接送れるなら、そちらを使う。
       結果が読めるので「送れなかった」ときに正直に伝えられる。 */
    if (Cloud && Cloud.enabled) {
      Cloud.survey(answers).then(function (ok) {
        if (!ok) {
          $('#submit-btn').disabled = false;
          setNote('送れませんでした。通信を確かめて、もう一度お願いします。', true);
          return;
        }
        finish();
      });
      return;
    }

    if (live) {
      /* 隠し iframe を宛先にした通常の form POST。CORS を回避できる。 */
      var s = CFG.survey;
      var f = d.createElement('form');
      f.action = safeUrl(s.formAction);
      f.method = 'POST';
      f.target = 'gform-sink';
      f.style.display = 'none';
      Object.keys(s.entries || {}).forEach(function (k) {
        if (!s.entries[k] || !answers[k]) return;
        var i = d.createElement('input');
        i.type = 'hidden'; i.name = s.entries[k]; i.value = answers[k];
        f.appendChild(i);
      });
      d.body.appendChild(f);
      f.submit();
      setTimeout(function () { f.remove(); }, 1200);
    }

    /* iframe 越しには結果を読めないため、送信できたものとして扱う */
    setTimeout(finish, live ? 700 : 450);
  }

  function fillWorks() {
    if (!Data) return;
    Data.load().then(function () {
      var sel = $('#fav-work');
      Data.works.forEach(function (wk) {
        var o = d.createElement('option');
        o.value = wk.title + ' / ' + wk.author;
        o.textContent = wk.title + ' — ' + wk.author;
        sel.appendChild(o);
      });
      var other = d.createElement('option');
      other.value = 'その他'; other.textContent = 'その他 / 選べない';
      sel.appendChild(other);
    });
  }

  /* 選んだ瞬間だけ弾ませる。押しごたえを添えるだけで、選択状態の
     判定そのものには関わらない。 */
  function pop(b) {
    b.classList.remove('pop'); void b.offsetWidth;
    b.classList.add('pop');
    b.addEventListener('animationend', function once() {
      b.classList.remove('pop'); b.removeEventListener('animationend', once);
    });
  }

  function start() {
    /* config.js の apiUrl があればそちらへ。無ければ従来の Google フォームへ。
       どちらも無ければ「未設定」として、送らずに知らせる。 */
    live = (Cloud && Cloud.enabled) || !!safeUrl((CFG.survey || {}).formAction);
    fillWorks();

    d.querySelector('.sv-grid').addEventListener('click', function (e) {
      var b = e.target.closest('.rate.on, .chip.on');
      if (b) pop(b);
    });

    $('#rating').addEventListener('click', function (e) {
      var b = e.target.closest('.rate'); if (!b) return;
      $$('.rate').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed','false'); });
      b.classList.add('on'); b.setAttribute('aria-pressed','true');
      answers.rating = b.getAttribute('data-v');
      setNote(NOTE, false);
    });

    single('#who', 'who');
    single('#interest', 'interest');
    single('#found', 'found');
    multi('#genre', 'genre');

    $('#fav-work').addEventListener('change', function () { answers.favWork = this.value; });
    $('#comment').addEventListener('input', function () {
      answers.comment = this.value;
      $('#cc').textContent = this.value.length;
    });
    $('#survey-form').addEventListener('submit', submit);
    $('#again').addEventListener('click', reset);

    setNote(NOTE, false);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

})(window, document);
