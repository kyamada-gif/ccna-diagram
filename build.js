#!/usr/bin/env node
/* ビルド: app.jsx -> app.js ＋ 中身の検査
 *   1) Babel で JSX をコンパイル
 *   2) ブラウザが素で読める形に直す（import を外し、末尾に描画を足す）
 *   3) index.html の ?v=… を中身に合わせて更新
 *   4) **ブロックごとに**中身を確かめる
 *
 * 直したら必ず `node build.js` を通す。**通さないと app.js が古いまま。**
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

process.chdir(__dirname);
execSync("npx babel app.jsx --presets @babel/preset-react -o app.js", { stdio: "inherit" });

let code = fs.readFileSync("app.js", "utf8");
code = code.replace(
  /^import React,\s*\{([^}]*)\}\s*from\s*"react";?\s*$/m,
  (_, names) => `const {${names}} = React;`
);
code = code.replace(/export default function App/, "function App");
const boot =
  'ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));';
if (!code.includes(boot)) code = code.trimEnd() + "\n" + boot + "\n";
fs.writeFileSync(
  "app.js",
  "/* 自動生成: build.js（app.jsx -> app.js）。手で編集せず app.jsx を直して再ビルド。 */\n" + code
);

const sum = (f) => fs.readFileSync(f, "utf8").length;
const gv = sum("gen.js") + sum("engine.js") + sum("fig.js") +
  fs.readdirSync("types").reduce((a, f) => a + sum(path.join("types", f)), 0);
const qv = sum("questions.js");
let html = fs.readFileSync("index.html", "utf8");
const next = html
  .replace(/(\.\/app\.js)(\?v=\d+)?/, `$1?v=${code.length}`)
  .replace(/(\.\/gen\.js)(\?v=\d+)?/, `$1?v=${gv}`)
  .replace(/(\.\/engine\.js)(\?v=\d+)?/, `$1?v=${gv}`)
  .replace(/(\.\/fig\.js)(\?v=\d+)?/, `$1?v=${gv}`)
  .replace(/(\.\/types\/[\w-]+\.js)(\?v=\d+)?/g, `$1?v=${gv}`)
  .replace(/(\.\/questions\.js)(\?v=\d+)?/, `$1?v=${qv}`);
if (next !== html) if (next !== html) fs.writeFileSync("index.html", next);
console.log(`built app.js (${code.length} bytes)`);

/* ── 見張り ───────────────────────────────── */
const { GENS, SPECS, BLOCK_IDS } = require(path.join(__dirname, "gen.js"));
const { BANKS } = require(path.join(__dirname, "questions.js"));
const bad = [];
let totalQ = 0;

BLOCK_IDS.forEach((id) => {
  const G = GENS[id];
  const spec = SPECS[id];
  const qs = BANKS[id] || [];
  const tag = spec ? spec.name : id;
  if (!G) { bad.push(`${id} のエンジンが作れていない`); return; }
  const exp = spec.expect || {};

  /* 申告した数と、実物が合っているか */
  if (exp.spots !== undefined && G.SPOTS.length !== exp.spots)
    bad.push(`${tag}: 見る所が ${G.SPOTS.length} 個（申告は ${exp.spots}）`);
  if (exp.rules !== undefined && G.RULES.length !== exp.rules)
    bad.push(`${tag}: 判定ルールが ${G.RULES.length} 本（申告は ${exp.rules}）`);
  if (exp.questions !== undefined && qs.length !== exp.questions)
    bad.push(`${tag}: 過去問が ${qs.length} 問（申告は ${exp.questions}）`);

  if (G.kind === "rules") {
    /* 見本の出力の中に、見る所がすべて出てくるか。
       図のブロックは提示物がテキストではないので、この検査はしない */
    const sample = G.sample();
    if (typeof sample === "string") {
      G.SPOTS.forEach((s) => {
        if (!sample.split("\n").some((l) => s.re.test(l)))
          bad.push(`${tag}: 見本に ${s.name} が無い`);
      });
    } else if (!G.judge(G.read(sample))) {
      bad.push(`${tag}: 見本が判定できない`);
    }
    /* 作った出力が、ねらったルールになるか（各300回） */
    Object.keys(G.MAKERS).forEach((k) => {
      for (let i = 0; i < 300; i++) {
        const t = G.make(k);
        if (!t) { bad.push(`${tag}: ${k} の出力が作れない`); return; }
        const r = G.judge(G.read(t));
        if (!r || r.key !== k) { bad.push(`${tag}: ${k} が ${r ? r.key : "判定なし"} になった`); return; }
        /* 決め手の行だけにしても、同じ判定のままか */
        const r2 = G.judge(G.read(G.excerpt(t, r.look)));
        if (!r2 || r2.verdict !== r.verdict) {
          bad.push(`${tag}: ${k} は決め手の行だけにすると判定が変わる`); return;
        }
      }
    });
  }

  /* **その問題が、画面に出るものだけで本当に解けるか。**
     ルートブリッジのように答えが選択肢の1つになる問題は、
     優先度とMACアドレスが「図の中」か「選択肢の中」か「MACの一覧」の
     どこかに必ず出ていないと、解きようがない */
  if (G.answer) {
    qs.forEach((q) => {
      const f = q.fig;
      if (!f) return;
      const inChoice = q.choices.some((c) => /[0-9a-f]{2}:[0-9a-f]{2}:/i.test(c));
      const inList = !!f.maclist;
      const inFig = !!f.figvals;   /* 図そのものに値が書かれている */
      if (!inChoice && !inList && !inFig && q.image) {
        bad.push(`${tag}: ${q.qid} は MACアドレスが画面のどこにも出ない（解けない）`);
      }
    });
  }

  /* 紙面から切り出した図が、ちゃんと置いてあるか */
  qs.forEach((q) => {
    if (!q.image) return;
    if (!fs.existsSync(q.image.src)) bad.push(`${tag}: ${q.qid} の図が無い（${q.image.src}）`);
  });

  /* 過去問の形。ここは kind によらず全ブロック共通 */
  const seen = {};
  qs.forEach((q) => {
    const ans = Array.isArray(q.answer) ? q.answer : [q.answer];
    if (seen[q.qid]) bad.push(`${tag}: ${q.qid} が2回入っている`);
    seen[q.qid] = 1;
    if (!q.choices || !q.choices.length) bad.push(`${tag}: ${q.qid} に選択肢が無い`);
    if (!ans.length || !ans[0]) bad.push(`${tag}: ${q.qid} に答えが無い`);
    ans.forEach((a) => {
      if (q.choices.indexOf(a) < 0) bad.push(`${tag}: ${q.qid} の答えが選択肢に無い`);
    });
  });

  /* 判定エンジンがあるブロックは、過去問の判定が本の答えと合うか */
  if (G.kind === "rules" && (spec.same || G.answer)) {
    let hit = 0;
    qs.forEach((q) => {
      const ex = q.fig || q.exhibit;
      if (!ex) { bad.push(`${tag}: ${q.qid} に提示物が無い`); return; }
      const v = G.read(ex);
      const r = G.judge(v);
      const ans = Array.isArray(q.answer) ? q.answer.join(" ") : q.answer;
      let ok;
      if (G.answer) {
        /* 答えがその場の選択肢になるブロック（例：ルートブリッジ） */
        const a = G.answer(v);
        ok = r && a && ans.replace(/\s/g, "").indexOf(a) >= 0;
      } else {
        ok = r && (spec.same[r.verdict] || []).some(
          (w) => ans.toLowerCase().indexOf(w.toLowerCase()) >= 0
        );
      }
      if (ok) hit++;
      else bad.push(`${tag}: ${q.qid} の判定が本の答えと合わない（${r ? r.verdict : "判定なし"}）`);
    });
    console.log(`  ${tag}: 見る所 ${G.SPOTS.length} / ルール ${G.RULES.length} / 過去問の判定が本と合う ${hit} / ${qs.length}`);
  } else {
    console.log(`  ${tag}: 過去問 ${qs.length} 問（判定エンジンなし。形だけ確かめた）`);
  }
  totalQ += qs.length;
});

/* 画面に出る1問1問の形（練習・テストとも同じ形か、正解が選択肢の中にあるか） */
const { run } = require(path.join(__dirname, "selftest.js"));
run().forEach((b) => bad.push(b));

console.log(`ブロック ${BLOCK_IDS.length} / 過去問 ${totalQ} 問`);
if (bad.length) {
  console.error("\n止まりました。直してからもう一度：");
  bad.slice(0, 20).forEach((b) => console.error("  NG  " + b));
  process.exit(1);
}
console.log("検査はすべて通りました。");
