/* =========================================================
   jev-playground.mjs — ひとこと審査（Jev）を公式 Playground で試す

   docs/gas-backend.gs の jevRequest()（本番で Jev に送る問い）と decide()
   （公開／確認待ち／公開しない の判定）をそのまま読み込み、
   テスト用のひとことごとに、TypeSafe 公式 Playground の「入力済みリンク」を作る。
   リンクを開くと、ひとことと3つの問い（種類・侮辱・不適切）が入った状態で
   Playground が開くので、Run を押すだけで Jev の答えが見られる。

   使い方（node 18 以上）：
     node tools/jev-playground.mjs                 … リンクを docs/jev-playground.md に書き出す
     node tools/jev-playground.mjs --run           … API を直接呼んで、decide() の判定まで一覧にする
                                                     （環境変数 JEV_API_KEY に API キー。キーはファイルに書かない）
     node tools/jev-playground.mjs "ひとこと" [名前] … そのひとことのリンクを1本だけ出す

   問いやしきい値を変えるときは gas-backend.gs を直す。このファイルはそれを読むだけ。
   ========================================================= */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAS = join(ROOT, 'docs', 'gas-backend.gs');
const OUT = join(ROOT, 'docs', 'jev-playground.md');

/* ---- gas-backend.gs を読み込む（Apps Script 専用の物は使わない関数だけ取り出す） ---- */
const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(GAS, 'utf8'), ctx, { filename: 'gas-backend.gs' });
const { jevRequest, decide, TH, JEV_URL } = ctx;

/* ---- 試すひとこと。expect は「こうなってほしい」判定 ---- */
const SAMPLES = [
  { id: 'praise',      name: 'たろう',   text: 'BGMがすごく好きです！2面の曲をずっと聴いていたい', expect: 'published', note: 'ふつうの感想' },
  { id: 'question',    name: 'ななし',   text: '何のソフトで作りましたか？', expect: 'published', note: '質問' },
  { id: 'harsh',       name: 'ゲーマー', text: '正直、操作が分かりにくくて2面で詰んだ。最初に説明があると助かる', expect: 'published', note: '辛口の指摘（公開すべき）' },
  { id: 'harsh2',      name: 'ななし',   text: 'つまらなかった。最後まで展開が同じで単調。後半に変化がほしい', expect: 'published', note: '否定的だが作品への意見（公開すべき）' },
  { id: 'bug',         name: 'ななし',   text: '3面でキャラが壁をすり抜けて落ちる。当たり判定がおかしいかも', expect: 'published', note: 'バグ報告' },
  { id: 'insult',      name: 'ななし',   text: 'つまらない。作ったやつセンスなさすぎ', expect: 'rejected', note: '作者への侮辱' },
  { id: 'polite',      name: 'ななし',   text: '作者さんはゲーム作りに向いていないので、別の部活に行った方がいいと思います', expect: 'rejected', note: '丁寧な言い方の人格否定（境界）' },
  { id: 'sarcasm',     name: 'ななし',   text: 'すごいね、3分で飽きさせる才能あるよ', expect: 'rejected', note: '皮肉（境界）' },
  { id: 'mixed',       name: 'ななし',   text: '色づかいは綺麗。でも作ったやつの頭が悪いのがよく分かる', expect: 'rejected', note: '褒め＋侮辱の混在' },
  { id: 'namefield',   name: '作者はバカ', text: '楽しかったです', expect: 'rejected', note: '名前欄で攻撃' },
  { id: 'spam',        name: 'ななし',   text: 'フォローしてね！プロフィールのリンク見て', expect: 'rejected', note: '宣伝' },
  { id: 'noise',       name: 'ななし',   text: 'あああああああああ', expect: 'rejected', note: '意味のない文字列' },
  { id: 'personal',    name: 'ななし',   text: 'これ作ったの3年B組の田中だよ。インスタは tanaka_0412', expect: 'rejected', note: '個人情報' },
];

/* ---- lz-string の compressToEncodedURIComponent（MIT, pieroxy）。公式ドキュメントの共有リンクと同じ ---- */
const KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$';
function compressToEncodedURIComponent(input) {
  if (input == null) return '';
  return compress(input, 6, (a) => KEY.charAt(a));
}
function compress(uncompressed, bitsPerChar, getCharFromInt) {
  let i, value;
  const dict = {}, dictToCreate = {};
  let c = '', wc = '', w = '', enlargeIn = 2, dictSize = 3, numBits = 2;
  const data = []; let dataVal = 0, dataPos = 0;
  const push = (bit) => {
    dataVal = (dataVal << 1) | bit;
    if (dataPos === bitsPerChar - 1) { dataPos = 0; data.push(getCharFromInt(dataVal)); dataVal = 0; }
    else dataPos++;
  };
  const writeBits = (n, v) => { for (let k = 0; k < n; k++) { push(v & 1); v >>= 1; } };
  const emitW = () => {
    if (Object.prototype.hasOwnProperty.call(dictToCreate, w)) {
      if (w.charCodeAt(0) < 256) { for (i = 0; i < numBits; i++) push(0); writeBits(8, w.charCodeAt(0)); }
      else { value = 1; for (i = 0; i < numBits; i++) { push(value); value = 0; } writeBits(16, w.charCodeAt(0)); }
      enlargeIn--; if (enlargeIn === 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
      delete dictToCreate[w];
    } else {
      writeBits(numBits, dict[w]);
    }
    enlargeIn--; if (enlargeIn === 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
  };
  for (let ii = 0; ii < uncompressed.length; ii++) {
    c = uncompressed.charAt(ii);
    if (!Object.prototype.hasOwnProperty.call(dict, c)) { dict[c] = dictSize++; dictToCreate[c] = true; }
    wc = w + c;
    if (Object.prototype.hasOwnProperty.call(dict, wc)) { w = wc; }
    else { emitW(); dict[wc] = dictSize++; w = String(c); }
  }
  if (w !== '') emitW();
  writeBits(numBits, 2);                                   /* 終わりの印 */
  while (true) { dataVal <<= 1; if (dataPos === bitsPerChar - 1) { data.push(getCharFromInt(dataVal)); break; } dataPos++; }
  return data.join('');
}

function request(s) {
  return jevRequest({ title: s.title || 'テスト作品', name: s.name, text: s.text });
}
function playgroundLink(s) {
  const req = request(s);
  return 'https://console.typesafe.ai/decode#share/' + compressToEncodedURIComponent(JSON.stringify({
    apiVersion: 'v1',
    documentText: JSON.stringify(req.state, null, 2),
    promptsText: JSON.stringify(req.questions, null, 2),
    selectedModels: [req.model],
  }));
}

/* ---- API を直接呼ぶ（--run） ---- */
async function run(samples) {
  const key = process.env.JEV_API_KEY;
  if (!key) { console.error('環境変数 JEV_API_KEY に API キーを入れてから実行してください。'); process.exit(1); }
  let ok = 0;
  for (const s of samples) {
    const res = await fetch(JEV_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(request(s)),
    });
    if (!res.ok) { console.log(`${s.id.padEnd(10)} HTTP ${res.status} ${(await res.text()).slice(0, 120)}`); continue; }
    const a = (await res.json()).answers;
    const v = decide(a);
    const hit = !s.expect || s.expect === v.status;
    if (hit) ok++;
    const p = a.kind.probabilities || {};
    const top = Object.entries(p).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([k, n]) => `${k} ${n.toFixed(2)}`).join(' / ');
    console.log(`${hit ? '○' : '×'} ${s.id.padEnd(10)} ${v.status.padEnd(9)} 侮辱 ${a.attacks_person.noul.toFixed(2)}  不適切 ${a.unsafe.noul.toFixed(2)}  種類 ${top}  ${v.reason}` +
                (hit ? '' : `  ← 想定は ${s.expect}`) + `\n    「${s.text}」`);
  }
  console.log(`\n想定どおり ${ok} / ${samples.length}（しきい値：公開しない ${TH.reject} / 確認待ち ${TH.hold} / 宣伝 ${TH.spam} / 自動公開 ${TH.good}）`);
}

/* ---- 書き出す ---- */
function writeDoc() {
  const any = request(SAMPLES[0]);
  const verdictJa = { published: '公開', held: '確認待ち', rejected: '公開しない' };
  const md = `# ひとこと審査（Jev）を Playground で試す

\`node tools/jev-playground.mjs\` で自動生成。問いは \`docs/gas-backend.gs\` の \`jevRequest()\` と同じ。
**リンクを開く → ログイン → Run** で、本番と同じ問いに Jev がどう答えるかが見られる
（Playground：https://console.typesafe.ai/playground）。

判定のしかた（\`decide()\`）：
- 不適切 または 侮辱 の確率が **${TH.reject} 以上** → 公開しない
- 宣伝・無関係（\`kind\` の spam）が **${TH.spam} 以上** → 公開しない
- 侮辱・不適切が **${TH.hold}〜${TH.reject}** → 部員の確認待ち
- 称賛＋指摘＋質問の合計が **${TH.good} 以上** → 自動で公開、足りなければ確認待ち

## 試すひとこと

| 想定 | ひとこと | 名前 | ねらい | Playground |
|---|---|---|---|---|
${SAMPLES.map((s) => `| ${verdictJa[s.expect]} | ${s.text} | ${s.name} | ${s.note} | [開く](${playgroundLink(s)}) |`).join('\n')}

## 自分で書いて試す

Playground の左（State）に次を貼り、「ひとこと本文」と「投稿者の表示名」を書き換える：

\`\`\`json
${JSON.stringify(any.state, null, 2)}
\`\`\`

右（Questions）には次を貼る：

\`\`\`json
${JSON.stringify(any.questions, null, 2)}
\`\`\`

1 本だけリンクを作るなら：\`node tools/jev-playground.mjs "ひとこと" 名前\`

## まとめて判定まで見る

\`\`\`bash
JEV_API_KEY=（キー） node tools/jev-playground.mjs --run
\`\`\`
上の全部を API に送り、\`decide()\` の判定と想定を並べて出す。しきい値や問いを直したら、これで確かめる。
`;
  writeFileSync(OUT, md, 'utf8');
  console.log('書き出しました: ' + OUT);
}

const args = process.argv.slice(2);
if (args[0] === '--run') await run(SAMPLES);
else if (args[0]) console.log(playgroundLink({ text: args[0], name: args[1] || 'ななし' }));
else writeDoc();
