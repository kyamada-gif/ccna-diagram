#!/usr/bin/env node
/* 画面の中身（練習・テストの1問1問）を、Node の中で作って形を確かめる。
 *
 * **画面を開かずに、練習が壊れていないかを見る。**
 * build.js から呼ばれる。直接 `node selftest.js` でも動く。
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load() {
  const dir = __dirname;
  const { GENS, SPECS, BLOCK_IDS } = require(path.join(dir, "gen.js"));
  const { BANKS } = require(path.join(dir, "questions.js"));
  const FIG = require(path.join(dir, "fig.js"));
  /* app.js は画面を描くところまで書いてあるので、その1行だけ外して読む */
  const src = fs.readFileSync(path.join(dir, "app.js"), "utf8")
    .replace(/ReactDOM\.createRoot[\s\S]*$/, "");
  const ctx = {
    GENS, SPECS, BANKS, BLOCK_IDS, FIG, console,
    React: { createElement: () => ({}), Fragment: "F",
             useState: () => [], useEffect: () => {}, useRef: () => ({}) },
    document: { querySelector: () => null },
    window: {}, localStorage: { getItem: () => null, setItem: () => {} }
  };
  vm.createContext(ctx);
  vm.runInContext(src + ";this.__P=makePractice;this.__T=makeTest;this.__C=testChunks;", ctx);
  return { ctx, GENS, BANKS, BLOCK_IDS };
}

/* 1問の形が、決めた通りか */
function checkItem(it, where, bad) {
  const tag = `${where} kind=${it.kind}`;
  if (!it.kind) { bad.push(`${where}: kind が無い`); return; }
  if (it.kind === "learn") return;            /* 覚える1枚は問題ではない */
  if (!it.opts || !it.opts.length) { bad.push(`${tag}: 選択肢が無い`); return; }
  const rights = Array.isArray(it.right) ? it.right : [it.right];
  if (!rights.length || !rights[0]) { bad.push(`${tag}: 正解が無い`); return; }
  rights.forEach((r) => {
    if (it.opts.indexOf(r) < 0) bad.push(`${tag}: 正解が選択肢の中に無い（${String(r).slice(0, 30)}）`);
  });
  const seen = {};
  it.opts.forEach((o) => {
    if (seen[o]) bad.push(`${tag}: 同じ選択肢が2回出る（${String(o).slice(0, 30)}）`);
    seen[o] = 1;
  });
  if (it.opts.length > 8) bad.push(`${tag}: 選択肢が ${it.opts.length} 個（8個まで）`);
}

function run() {
  const { ctx, GENS, BANKS, BLOCK_IDS } = load();
  const bad = [];
  BLOCK_IDS.forEach((id) => {
    const G = GENS[id];
    const qs = BANKS[id] || [];
    if (!G) return;

    /* 練習：何度作っても、毎回ちゃんとした問題になるか */
    if (G.kind === "rules") {
      let len = null;
      for (let n = 0; n < 30; n++) {
        const plan = ctx.__P(G);
        if (!plan.length) { bad.push(`${id}: 練習が空`); break; }
        if (len === null) len = plan.length;
        if (plan.length !== len) bad.push(`${id}: 練習の問題数が ${len} と ${plan.length} で変わる`);
        plan.forEach((it, i) => checkItem(it, `${id} 練習[${i}]`, bad));
      }
      console.log(`  ${id}: 練習 ${len} 問 × 30回`);
    }

    /* テスト：どの回も、ちゃんとした問題になるか。全問がどこかの回に入るか */
    const chunks = ctx.__C(id);
    const inTest = new Set();
    chunks.forEach((c, ci) => {
      const plan = ctx.__T(id, ci);
      if (plan.length !== c.length) bad.push(`${id}: テスト${ci + 1} の数が合わない`);
      plan.forEach((it, i) => {
        checkItem(it, `${id} テスト${ci + 1}[${i}]`, bad);
        const qid = it.note ? it.note.qid : (it.q && it.q.qid);
        if (qid) inTest.add(qid);
      });
    });
    qs.forEach((q) => {
      if (!inTest.has(q.qid)) bad.push(`${id}: ${q.qid} がどのテストにも入っていない`);
    });
    console.log(`  ${id}: テスト ${chunks.length} 回 / 過去問 ${qs.length} 問すべてが、どれかの回に入る`);
  });
  return bad;
}

if (require.main === module) {
  const bad = run();
  bad.slice(0, 20).forEach((b) => console.error("  NG  " + b));
  if (bad.length) process.exit(1);
  console.log("画面の中身の検査：通りました。");
}
module.exports = { run };
