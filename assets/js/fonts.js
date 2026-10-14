/* =========================================================
   fonts.js — 本文の書体（UD新ゴ / モリサワ）を Adobe Fonts から読み込む

   Adobe Fonts の規約で、フォントのファイルをこのサイトに置いて配ることはできない。
   Adobe Fonts の「Web プロジェクト」の埋め込みコード経由でだけ使える。
   和文はダイナミックサブセット（ページに出る字だけを都度取り寄せる）なので、
   JavaScript 版の埋め込みが必要（CSS の <link> 版では使えない）。

   設定：fonts.adobe.com → UD新ゴ Pr6N → 「Web プロジェクトに追加」
         ウェイトは R（400）・M（500）・B（700）を選ぶ
         表示された kitId をこの下の KIT に貼る（README「7-3 書体」）
   KIT が空のあいだは何もせず、style.css のフォールバック
   （BIZ UDPゴシック → ヒラギノ角ゴ → Noto Sans JP）で表示される。
   ========================================================= */
(function (d) {
  var KIT = 'uli4crt';
  if (!KIT) return;
  var h = d.documentElement;
  var config = { kitId: KIT, scriptTimeout: 3000, async: true };
  var t = setTimeout(function () {
    h.className = h.className.replace(/\bwf-loading\b/g, '') + ' wf-inactive';
  }, config.scriptTimeout);
  var tk = d.createElement('script'), done = false;
  h.className += ' wf-loading';
  tk.src = 'https://use.typekit.net/' + config.kitId + '.js';
  tk.async = true;
  tk.onload = tk.onreadystatechange = function () {
    var a = this.readyState;
    if (done || (a && a !== 'complete' && a !== 'loaded')) return;
    done = true; clearTimeout(t);
    try { window.Typekit.load(config); } catch (e) {}
  };
  var s = d.getElementsByTagName('script')[0];
  if (s) s.parentNode.insertBefore(tk, s); else d.head.appendChild(tk);
})(document);
