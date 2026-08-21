/* 出題パターンでテストを絞る道具。**どの分野でも使える。**
 *
 *   node scripts/trim.js <分野> <上限>        何が起きるか見るだけ
 *   node scripts/trim.js <分野> <上限> --write  q/<分野>.js を書きかえる
 *
 * 絞り方は2段階。
 *   ① 本が違うだけの同じ問題を1つにまとめる（提示物と答えが同じもの）。
 *      まとめた問題番号は、残したほうの from に全部入れる
 *   ② 同じ出題パターンは上限まで。あふれた分を外す。
 *      **残すものは、なるべく別の本から選ぶ**
 *
 * 出題パターンは、判定エンジンがどのルールで答えを出したかで決める。
 * **答えが同じでも、たどり着く道筋が違えば別のパターン。**
 * 例 show interface の「デュプレックスの不一致」は3つのルールから来る。
 *    答えでまとめると、読み方の道筋が1つ消えてしまう。
 *
 * 外した問題は out/full/not_used.csv に理由つきで載せること。
 * **from にぶら下がっている別の本の問題も、一緒に載せる。**
 * 載せ忘れると build.js の全問カバーの見張りに引っかかる。
 */
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
global.window = global;
require(path.join(root, "questions.js"));
require(path.join(root, "q", "synonym.js"));
require(path.join(root, "engine.js"));
require(path.join(root, "gen.js"));

const [id, capArg, ...rest] = process.argv.slice(2);
const CAP = parseInt(capArg, 10) || 3;
const write = rest.indexOf("--write") >= 0;
const bank = (global.BANKS || {})[id];
const G = (global.GENS || {})[id];
if (!bank) { console.error(`分野 ${id} が見つからない`); process.exit(1); }

const norm = (t) => String(t == null ? "" : t).replace(/[\s_]/g, "");
const exOf = (q) => (q.fig || q.exhibit || "");
const srcOf = (q) => {
  const e = exOf(q);
  return typeof e === "string" ? e : (e.src || JSON.stringify(e));
};

/* その問題が、どのルールで答えにたどり着くか */
function patternOf(q) {
  if (G && G.kind === "rules" && G.judge && G.read) {
    try {
      const v = G.read(G.spec && G.spec.wantsQuestion
        ? { text: q.text, exhibit: exOf(q) } : exOf(q));
      const r = G.judge(v);
      if (r) return r.key;
    } catch (e) { /* 読めない問題は、答えでまとめる */ }
  }
  return norm(Array.isArray(q.answer) ? q.answer.join(" ") : q.answer);
}

/* 本が違うだけの同じ問題か */
const sameKey = (q) => norm(srcOf(q)) + "##" + norm(q.text) + "##" +
  norm(Array.isArray(q.answer) ? q.answer.join(" ") : q.answer);

const folded = [], seen = {};
bank.forEach((q) => {
  const k = sameKey(q);
  if (seen[k]) { seen[k].from.push(q.qid); return; }
  const r = Object.assign({}, q);
  r.from = (q.from && q.from.slice()) || [q.qid];
  seen[k] = r; folded.push(r);
});

const byPat = {};
folded.forEach((r) => { (byPat[patternOf(r)] = byPat[patternOf(r)] || []).push(r); });

const keep = [], drop = [];
Object.keys(byPat).forEach((pat) => {
  const byBook = {};
  byPat[pat].forEach((r) => { (byBook[r.book || ""] = byBook[r.book || ""] || []).push(r); });
  const books = Object.keys(byBook).sort(), order = [];
  while (books.some((b) => byBook[b].length)) {
    books.forEach((b) => { if (byBook[b].length) order.push(byBook[b].shift()); });
  }
  keep.push(...order.slice(0, CAP));
  drop.push(...order.slice(CAP));
});
keep.sort((a, b) => (a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0));

console.log(`${id}: ${bank.length} 問 → ${keep.length} 問（同じパターンは ${CAP} 問まで）`);
console.log(`出題パターン ${Object.keys(byPat).length} 通り`);
Object.keys(byPat).sort((a, b) => byPat[b].length - byPat[a].length).forEach((p) => {
  const n = byPat[p].length;
  console.log(`  ${String(p).padEnd(14)} ${String(n).padStart(2)} 問 → ${Math.min(n, CAP)} 問`);
});
const merged = keep.filter((r) => r.from.length > 1);
if (merged.length) {
  console.log(`\nまとめた同じ問題 ${merged.length} 組:`);
  merged.forEach((r) => console.log(`  ${r.from.join(" ＝ ")}`));
}
if (drop.length) {
  console.log(`\n外す ${drop.length} 問（not_used.csv に載せる行）:`);
  drop.forEach((r) => r.from.forEach((qid) => {
    console.log(`${qid},,,図表,図表なし計算なし,` +
      `同じ出題パターン（${patternOf(r)}）が ${CAP} 問すでにある`);
  }));
}

if (write) {
  const out = path.join(root, "q", `${id}.js`);
  const head = fs.readFileSync(out, "utf8").split("\n").slice(0, 5).join("\n");
  const body = keep.map((r) => "    " + JSON.stringify(r)).join(",\n");
  fs.writeFileSync(out,
    `${head}\n${body}\n  ];\n  if (typeof module !== "undefined" && module.exports) ` +
    `module.exports = BANKS.${id};\n})(typeof window !== "undefined" ? window : globalThis);\n`,
    "utf8");
  console.log(`\n書きました: ${out}`);
}
