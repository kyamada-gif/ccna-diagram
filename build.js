#!/usr/bin/env node
/* ビルド: app.jsx -> app.js（app/build.js と同じ作り）
 *   1) Babel で JSX をコンパイル
 *   2) ブラウザが素で読める形に直す（import を外し、末尾に描画を足す）
 *   3) index.html の ?v=… を中身に合わせて更新
 *   4) 中身の見張り：gen.js と questions.js が壊れていないか確かめる
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

const gv = fs.readFileSync("gen.js", "utf8").length;
const qv = fs.readFileSync("questions.js", "utf8").length;
let html = fs.readFileSync("index.html", "utf8");
const next = html
  .replace(/(\.\/app\.js)(\?v=\d+)?/, `$1?v=${code.length}`)
  .replace(/(\.\/gen\.js)(\?v=\d+)?/, `$1?v=${gv}`)
  .replace(/(\.\/questions\.js)(\?v=\d+)?/, `$1?v=${qv}`);
if (next !== html) fs.writeFileSync("index.html", next);
console.log(`built app.js (${code.length} bytes)`);

/* ── 見張り ───────────────────────────────── */
const GEN = require(path.join(__dirname, "gen.js"));
const { QUESTIONS } = require(path.join(__dirname, "questions.js"));
const bad = [];

if (GEN.SPOTS.length !== 13) bad.push(`見る所が ${GEN.SPOTS.length} 個（13 のはず）`);
if (GEN.RULES.length !== 10) bad.push(`判定ルールが ${GEN.RULES.length} 本（10 のはず）`);

/* 見本の出力の中に、13か所すべてが出てくるか */
const sample = GEN.sample();
GEN.SPOTS.forEach((s) => {
  if (!sample.split("\n").some((l) => s.re.test(l))) bad.push(`見本に ${s.name} が無い`);
});

/* 作った出力が、ねらったルールになるか（各300回） */
Object.keys(GEN.MAKERS).forEach((k) => {
  for (let i = 0; i < 300; i++) {
    const t = GEN.make(k);
    if (!t) { bad.push(`${k} の出力が作れない`); return; }
    const r = GEN.judge(GEN.read(t));
    if (!r || r.key !== k) { bad.push(`${k} が ${r ? r.key : "判定なし"} になった`); return; }
    /* 決め手の行だけにしても、同じ判定のままか */
    const r2 = GEN.judge(GEN.read(GEN.excerpt(t, r.look)));
    if (!r2 || r2.verdict !== r.verdict) {
      bad.push(`${k} は決め手の行だけにすると判定が変わる`); return;
    }
  }
});

/* 過去問：判定が本の答えと合うか */
const SAME = {
  "キューイング（順番待ち）": ["キューイング", "順番待ち"],
  "ポートのオーバーサブスクリプション": ["オーバーサブスクリプション", "過剰使用", "過剰利用"],
  "高スループット": ["高スループット", "高いスループット"],
  "デュプレックスの不一致": ["デュプレックス", "duplex", "半二重ネゴシエーション",
                     "全二重/半二重", "速度設定が一致", "インターフェース構成"],
  "物理エラー（ケーブルか NIC）": ["物理エラー", "物理的エラー", "ケーブル", "チェックサム", "CRC"],
  "不良 NIC": ["不良 NIC", "NIC が不良"],
  "ブロードキャストストーム": ["ブロードキャスト"],
  "インターフェースの設定（デュプレックス）": ["インターフェース構成", "インターフェース設定"]
};
let hit = 0;
QUESTIONS.forEach((q) => {
  if (!q.exhibit || !q.choices.length || !q.answer) { bad.push(`${q.qid} が欠けている`); return; }
  if (q.choices.indexOf(q.answer) < 0) bad.push(`${q.qid} の答えが選択肢に無い`);
  const r = GEN.judge(GEN.read(q.exhibit));
  const ok = r && (SAME[r.verdict] || []).some(
    (w) => q.answer.toLowerCase().indexOf(w.toLowerCase()) >= 0
  );
  if (ok) hit++; else bad.push(`${q.qid} の判定が本の答えと合わない（${r ? r.verdict : "判定なし"}）`);
});

console.log(`見る所 ${GEN.SPOTS.length} / 判定ルール ${GEN.RULES.length} / 過去問 ${QUESTIONS.length}問`);
console.log(`作った出力の検算 ${Object.keys(GEN.MAKERS).length} 種 × 300回`);
console.log(`過去問の判定が本の答えと合う: ${hit} / ${QUESTIONS.length}`);
if (bad.length) {
  console.error("\n止まりました。直してからもう一度：");
  bad.slice(0, 20).forEach((b) => console.error("  NG  " + b));
  process.exit(1);
}
console.log("検査はすべて通りました。");
