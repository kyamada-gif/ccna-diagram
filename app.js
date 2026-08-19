/* 自動生成: build.js（app.jsx -> app.js）。手で編集せず app.jsx を直して再ビルド。 */
const { useState, useEffect, useRef } = React;
/* 計算なしの図表問題。ipcalc2 と同じ形（札 → 説明の1枚 → 練習／テスト）。
 *
 * 札 ＝ 図表問題の分類（show interface の読み取り／JSON／STP …）。
 * 札の中の「練習をする」で、その分類の見る所を**表の上から一個ずつ**学ぶ。
 * ぜんぶ通ると、その分類の過去問が解けるようになる。
 *
 * ・判定と出力作りは gen.js。ここでは判定しない
 * ・過去問は questions.js。ここには書かない
 * ・間違えたときは lpic-reflex と同じ：正解を見せて「もう一度チャレンジ」だけ。
 *   点になるのは最初の答え
 * ・画面の言葉は説明だけ。励ましも呼びかけも書かない
 */

/* 画面が変わったら、いつも上から読み始める。
   **押すたびに自分で上へ戻すのは面倒**なので、こちらで戻す（ipcalc2 と同じ） */
const nowY = () => {
  const e = document.querySelector(".wrap");
  return e ? e.scrollTop : 0;
};
const toTop = y => {
  const e = document.querySelector(".wrap");
  if (e) e.scrollTop = y || 0;
  try {
    window.scrollTo(0, y || 0);
  } catch (err) {}
};
const KEY = "showread-progress";
const TEST_N = 10;
const PASS = 0.9;

/* 札＝分類。いまできているのは「show interface の読み取り」だけ */
const TYPES = [{
  id: "showint",
  obj: "1.4",
  name: "show interface の読み取り",
  note: "出力を見て、何が起きているかを当てる",
  n: 35,
  ready: true
},
// n は questions.js の数で上書きされる
{
  id: "json",
  obj: "6.7",
  name: "JSON の読み取り",
  note: "キー・値・配列・オブジェクト",
  n: 38,
  ready: false
}, {
  id: "etherchannel",
  obj: "2.4",
  name: "EtherChannel",
  note: "束ねる設定と、束ねられない理由",
  n: 23,
  ready: false
}, {
  id: "stp",
  obj: "2.5",
  name: "STP（ルートブリッジ）",
  note: "優先度とMACアドレスで決まる",
  n: 23,
  ready: false
}, {
  id: "cable",
  obj: "1.3",
  name: "ケーブルの種類",
  note: "距離と光の種類で選ぶ",
  n: 19,
  ready: false
}, {
  id: "aaa",
  obj: "5.8",
  name: "AAA",
  note: "認証・認可・記録の見分け",
  n: 19,
  ready: false
}, {
  id: "vlan",
  obj: "2.1",
  name: "VLAN の設定と確認",
  note: "show vlan の読み方",
  n: 16,
  ready: false
}, {
  id: "access",
  obj: "5.3",
  name: "機器への入り方",
  note: "SSH・パスワード・vty",
  n: 15,
  ready: false
}];
function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (e) {
    return {};
  }
}
function save(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch (e) {}
}

/* ── 出力を出す ───────────────────────────── */
function Console({
  text,
  hits
}) {
  return /*#__PURE__*/React.createElement("pre", {
    className: "con"
  }, text.split("\n").map((line, i) => {
    const on = i > 0 && hits && hits.some(w => line.indexOf(w) >= 0);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "cline" + (i === 0 ? " ccmd" : "") + (on ? " chit" : "")
    }, line);
  }));
}

/* ── 練習を組む ───────────────────────────
 * 見る所の表を、上から一個ずつ。
 *   ① その見る所を覚える（説明の札）
 *   ② 決まるとき / 決まらないとき の2問
 * 最後に、出力ぜんぶで判定を3問。
 */
function makePractice() {
  const bs = GEN.blocks();
  const out = [];
  bs.forEach((b, i) => {
    out.push({
      kind: "learn",
      b: b,
      i: i,
      of: bs.length
    });
    [true, false].forEach(hit => {
      const r = GEN.reach(i, hit);
      if (!r) return;
      const st = r.step;
      const right = st.hit ? "答えは「" + st.verdict + "」" : "次に " + st.next + " を見る";
      const opts = [right];
      if (st.hit) {
        if (st.next) opts.push("次に " + st.next + " を見る");
      } else {
        opts.push("答えは「" + st.verdict + "」");
      }
      const other = GEN.shuffle(GEN.VERDICTS.filter(v => v !== st.verdict))[0];
      opts.push("答えは「" + other + "」");
      out.push({
        kind: "walk",
        text: r.text,
        st: st,
        b: b,
        i: i,
        of: bs.length,
        opts: GEN.shuffle(opts.slice(0, 3)),
        right: right
      });
    });
  });
  for (let k = 0; k < 3; k++) {
    const g = GEN.makeAny();
    if (!g.text) continue;
    const r = GEN.RULES.filter(x => x.key === g.key)[0];
    const wrong = GEN.shuffle(GEN.VERDICTS.filter(v => v !== r.verdict)).slice(0, 3);
    out.push({
      kind: "judge",
      text: g.text,
      i: bs.length,
      of: bs.length,
      opts: GEN.shuffle([r.verdict].concat(wrong)),
      right: r.verdict
    });
  }
  return out;
}

/* テストは10問ずつに区切る。**どの問題も、必ずどれか1つの回に入る。**
 * 余りが 5 問より少ないときは、最後の回に足す（31問なら 10 / 10 / 11）。
 */
function testChunks() {
  const all = QUESTIONS.slice().sort(function (a, b) {
    return a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0;
  });
  const out = [];
  for (let i = 0; i < all.length; i += TEST_N) out.push(all.slice(i, i + TEST_N));
  if (out.length > 1 && out[out.length - 1].length < 5) {
    const last = out.pop();
    out[out.length - 1] = out[out.length - 1].concat(last);
  }
  return out;
}
function makeTest(ci) {
  return GEN.shuffle(testChunks()[ci]).map(q => ({
    kind: "past",
    q: q,
    opts: q.choices,
    right: q.answer
  }));
}

/* ── 答えの出し方を、実際の数字で見せる ───────── */
function Steps({
  t,
  answer,
  book
}) {
  if (!t) {
    return /*#__PURE__*/React.createElement("div", {
      className: "note"
    }, /*#__PURE__*/React.createElement("div", {
      className: "note-t"
    }, answer || ""), book && /*#__PURE__*/React.createElement("div", {
      className: "note-b"
    }, "\u672C\u306E\u89E3\u8AAC\uFF1A", book.slice(0, 150)));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "note"
  }, /*#__PURE__*/React.createElement("div", {
    className: "note-t"
  }, answer || t.verdict), /*#__PURE__*/React.createElement("div", {
    className: "gloss"
  }, GEN.gloss(t.verdict)), /*#__PURE__*/React.createElement("div", {
    className: "note-h"
  }, "\u3053\u306E\u51FA\u529B\u3067\u898B\u305F\u6240"), /*#__PURE__*/React.createElement("div", {
    className: "steps"
  }, t.steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "step",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "step-n"
  }, i + 1), /*#__PURE__*/React.createElement("span", {
    className: "step-k"
  }, s.name), /*#__PURE__*/React.createElement("span", {
    className: "step-v"
  }, s.value))), /*#__PURE__*/React.createElement("div", {
    className: "step step-end"
  }, /*#__PURE__*/React.createElement("span", {
    className: "step-n"
  }, "\u2192"), /*#__PURE__*/React.createElement("span", {
    className: "step-w"
  }, t.why))), /*#__PURE__*/React.createElement("div", {
    className: "note-h"
  }, "\u307B\u304B\u306E\u9078\u629E\u80A2\u304C\u6D88\u3048\u308B\u7406\u7531"), /*#__PURE__*/React.createElement("div", {
    className: "rej"
  }, t.reject.map((r, i) => /*#__PURE__*/React.createElement("div", {
    className: "rej-r",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "rej-v"
  }, "\u2715 ", r.verdict), /*#__PURE__*/React.createElement("span", {
    className: "rej-w"
  }, r.why)))), book && /*#__PURE__*/React.createElement("div", {
    className: "note-b"
  }, "\u672C\u306E\u89E3\u8AAC\uFF1A", book.slice(0, 150)));
}
function Note({
  title,
  body,
  gloss
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "note"
  }, /*#__PURE__*/React.createElement("div", {
    className: "note-t"
  }, title), gloss && /*#__PURE__*/React.createElement("div", {
    className: "gloss"
  }, gloss), body && /*#__PURE__*/React.createElement("div", {
    className: "note-b"
  }, body));
}

/* ── ホーム。札＝分類 ────────────────────── */
function Home({
  prog,
  open
}) {
  const done = TYPES.filter(t => prog[t.id] && prog[t.id].badge).length;
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-t"
  }, "\u8A08\u7B97\u306A\u3057\u306E\u56F3\u8868\u554F\u984C"), /*#__PURE__*/React.createElement("div", {
    className: "hero-n"
  }, "\u51FA\u529B\u30FB\u56F3\u30FB\u753B\u9762\u3092\u898B\u3066\u7B54\u3048\u308B\u554F\u984C\u3092\u3001\u5206\u985E\u3054\u3068\u306B\u899A\u3048\u308B"), /*#__PURE__*/React.createElement("div", {
    className: "bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar-in",
    style: {
      width: done / TYPES.length * 100 + "%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "hero-n"
  }, done, " / ", TYPES.length, " \u306E\u5206\u985E\u306B\u5370\u304C\u4ED8\u304D\u307E\u3057\u305F")), TYPES.map((t, i) => {
    const st = prog[t.id] || {};
    return /*#__PURE__*/React.createElement("div", {
      className: "road",
      key: t.id
    }, i > 0 && /*#__PURE__*/React.createElement("div", {
      className: "link"
    }), /*#__PURE__*/React.createElement("button", {
      className: "tile" + (st.badge ? " tile-clear" : "") + (t.ready ? "" : " tile-soon"),
      onClick: () => t.ready && open(t.id),
      disabled: !t.ready
    }, /*#__PURE__*/React.createElement("span", {
      className: "tile-n"
    }, i + 1), /*#__PURE__*/React.createElement("span", {
      className: "tile-b"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tile-t"
    }, t.name), /*#__PURE__*/React.createElement("span", {
      className: "tile-s"
    }, t.note, "\u3000\uFF0F\u3000\u904E\u53BB\u554F ", t.ready ? QUESTIONS.length : t.n, " \u554F")), st.badge ? /*#__PURE__*/React.createElement("span", {
      className: "badge badge-gold"
    }, "\uD83C\uDFC5") : t.ready ? null : /*#__PURE__*/React.createElement("span", {
      className: "badge badge-soon"
    }, "\u3053\u308C\u304B\u3089")));
  }), /*#__PURE__*/React.createElement("div", {
    className: "foot"
  }, "\u3044\u307E\u3067\u304D\u3066\u3044\u308B\u306E\u306F\u300Cshow interface \u306E\u8AAD\u307F\u53D6\u308A\u300D\u3060\u3051\u3067\u3059\u3002 \u898B\u308B\u624013\u304B\u6240\u3068\u5224\u5B9A\u30EB\u30FC\u30EB10\u672C\u306F\u3001\u904E\u53BB\u554F35\u554F\u3068\u305D\u306E\u89E3\u8AAC\u304B\u3089\u8D77\u3053\u3057\u307E\u3057\u305F\u3002 31\u554F\u3067\u672C\u306E\u7B54\u3048\u3068\u4E00\u81F4\u3057\u307E\u3059\u3002\u6B8B\u308A4\u554F\u306F\u672C\u306E\u307B\u3046\u306B\u98DF\u3044\u9055\u3044\u304C\u3042\u308B\u305F\u3081\u3001\u5916\u3057\u3066\u3044\u307E\u3059\u3002"));
}

/* ── 説明の1枚 ──────────────────────────── */
function Brief({
  tid,
  prog,
  go,
  back
}) {
  const t = TYPES.filter(x => x.id === tid)[0];
  const st = prog[tid] || {};
  const bs = GEN.blocks();
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "wrap has-dock"
  }, /*#__PURE__*/React.createElement("div", {
    className: "head"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back",
    onClick: back
  }, "\u2190 \u3082\u3069\u308B"), /*#__PURE__*/React.createElement("span", {
    className: "head-t"
  }, t.name), st.badge && /*#__PURE__*/React.createElement("span", {
    className: "head-n"
  }, "\uD83C\uDFC5")), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u3053\u306E\u5206\u985E\u3067\u3084\u308B\u3053\u3068"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, t.note, "\u3002\u6C7A\u3081\u624B\u306F\u51FA\u529B\u306E\u4E2D\u306E\u6C7A\u307E\u3063\u305F\u6240\u306B\u3042\u308A\u307E\u3059\u3002 \u4E0A\u304B\u3089\u9806\u306B\u898B\u3066\u3044\u3063\u3066\u3001\u5F53\u305F\u3063\u305F\u3068\u3053\u308D\u3067\u7B54\u3048\u304C\u6C7A\u307E\u308A\u307E\u3059\u3002")), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u898B\u308B\u9806\u756A\uFF08\u7DF4\u7FD2\u3067\u4E0A\u304B\u3089\u4E00\u500B\u305A\u3064\u899A\u3048\u307E\u3059\uFF09"), /*#__PURE__*/React.createElement("div", {
    className: "order"
  }, bs.map((x, i) => /*#__PURE__*/React.createElement("div", {
    className: "order-r",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "order-n"
  }, i + 1), /*#__PURE__*/React.createElement("span", {
    className: "order-k"
  }, x.name), /*#__PURE__*/React.createElement("span", {
    className: "order-v"
  }, x.verdict, /*#__PURE__*/React.createElement("span", {
    className: "order-g"
  }, GEN.gloss(x.verdict))))))), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u30C6\u30B9\u30C8\u306E\u4E2D\u8EAB"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, "\u904E\u53BB\u554F ", QUESTIONS.length, " \u554F\u3092 ", TEST_N, " \u554F\u305A\u3064\u306B\u5206\u3051\u3066\u3042\u308A\u307E\u3059\u3002 \u3069\u306E\u554F\u984C\u3082\u3001\u5FC5\u305A\u3069\u308C\u304B\u306E\u56DE\u306B\u5165\u3063\u3066\u3044\u307E\u3059\u3002 9\u5272\u3067\u304D\u305F\u3089\u3001\u305D\u306E\u56DE\u306B\u5370\u304C\u4ED8\u304D\u307E\u3059\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, "\u76EE\u6A191.4 \u306E\u56F3\u8868\u554F\u984C\u306F\u5168\u90E8\u3067 35 \u554F\u3042\u308A\u307E\u3059\u304C\u3001 4\u554F\u306F\u672C\u306E\u7B54\u3048\u304C\u51FA\u529B\u3068\u98DF\u3044\u9055\u3046\u305F\u3081\u5916\u3057\u3066\u3044\u307E\u3059\u3002"))), /*#__PURE__*/React.createElement("div", {
    className: "dock"
  }, /*#__PURE__*/React.createElement("button", {
    className: "go next",
    onClick: () => go("practice")
  }, "\u7DF4\u7FD2\u3092\u3059\u308B"), /*#__PURE__*/React.createElement("button", {
    className: "go next ghost",
    onClick: () => go("testpick")
  }, "\u30C6\u30B9\u30C8\u3092\u3059\u308B")));
}

/* ── どのテストを受けるか選ぶ ────────────────── */
function TestPick({
  tid,
  prog,
  go,
  back
}) {
  const t = TYPES.filter(x => x.id === tid)[0];
  const st = prog[tid] || {};
  const chunks = testChunks();
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "head"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back",
    onClick: back
  }, "\u2190 \u3082\u3069\u308B"), /*#__PURE__*/React.createElement("span", {
    className: "head-t"
  }, t.name, "\u3000\u30C6\u30B9\u30C8")), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u3069\u306E\u30C6\u30B9\u30C8\u3092\u53D7\u3051\u307E\u3059\u304B"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, "\u904E\u53BB\u554F ", QUESTIONS.length, " \u554F\u3092 ", TEST_N, " \u554F\u305A\u3064\u306B\u5206\u3051\u3066\u3042\u308A\u307E\u3059\u3002 \u3069\u306E\u554F\u984C\u3082\u3001\u5FC5\u305A\u3069\u308C\u304B\u306E\u56DE\u306B\u5165\u3063\u3066\u3044\u307E\u3059\u3002 9\u5272\u3067\u304D\u305F\u3089\u3001\u305D\u306E\u56DE\u306B\u5370\u304C\u4ED8\u304D\u307E\u3059\u3002")), chunks.map((c, i) => {
    const r = (st.tests || {})[i] || {};
    return /*#__PURE__*/React.createElement("button", {
      className: "trow",
      key: i,
      onClick: () => go("test:" + i)
    }, /*#__PURE__*/React.createElement("span", {
      className: "trow-n"
    }, i + 1), /*#__PURE__*/React.createElement("span", {
      className: "trow-b"
    }, /*#__PURE__*/React.createElement("span", {
      className: "trow-t"
    }, "\u30C6\u30B9\u30C8 ", i + 1), /*#__PURE__*/React.createElement("span", {
      className: "trow-s"
    }, c.length, " \u554F\u3000", c[0].qid, " \u301C ", c[c.length - 1].qid)), r.badge ? /*#__PURE__*/React.createElement("span", {
      className: "badge badge-gold"
    }, "\uD83C\uDFC5") : r.best !== undefined ? /*#__PURE__*/React.createElement("span", {
      className: "trow-p"
    }, r.best, " / ", c.length) : /*#__PURE__*/React.createElement("span", {
      className: "trow-p trow-yet"
    }, "\u307E\u3060"));
  }), /*#__PURE__*/React.createElement("div", {
    className: "foot"
  }, "\u76EE\u6A191.4 \u306E\u56F3\u8868\u554F\u984C\u306F\u5168\u90E8\u3067 35 \u554F\u3042\u308A\u307E\u3059\u304C\u3001 4\u554F\u306F\u672C\u306E\u7B54\u3048\u304C\u51FA\u529B\u3068\u98DF\u3044\u9055\u3046\u305F\u3081\u5916\u3057\u3066\u3044\u307E\u3059\u3002"));
}

/* ── 一問一答 ────────────────────────── */
function Drill({
  tid,
  mode,
  prog,
  setProg,
  back
}) {
  const ci = mode.indexOf("test:") === 0 ? parseInt(mode.slice(5), 10) : -1;
  const isTest = ci >= 0;
  const [plan] = useState(() => isTest ? makeTest(ci) : makePractice());
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState(null);
  const [firstOk, setFirstOk] = useState(null);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(0);
  const [end, setEnd] = useState(false);
  const it = plan[at];
  const ok = picked !== null && picked === it.right;
  /* 次の問題・結果の画面に移ったら、上から見せる */
  useEffect(() => {
    toTop();
  }, [at, end]);
  const cram = !isTest;
  function choose(o) {
    if (picked !== null) return;
    setPicked(o);
    if (firstOk === null) {
      const good = o === it.right;
      setFirstOk(good);
      setAsked(asked + 1);
      if (good) setScore(score + 1);
    }
  }
  /* やり直しは問題が上に出直すので、こちらも上へ戻す */
  function retry() {
    setPicked(null);
    toTop();
  }
  function next() {
    if (at + 1 >= plan.length) {
      const p = Object.assign({}, prog);
      const prev = p[tid] || {};
      const tests = Object.assign({}, prev.tests);
      if (isTest) {
        const t0 = tests[ci] || {};
        tests[ci] = {
          best: Math.max(t0.best || 0, score),
          badge: t0.badge || false || score >= Math.ceil(plan.length * PASS)
        };
      }
      const all = testChunks().length;
      let done = 0;
      for (let k = 0; k < all; k++) if (tests[k] && tests[k].badge) done++;
      p[tid] = {
        tests: tests,
        badge: done === all,
        practiced: prev.practiced || !isTest
      };
      setProg(p);
      setEnd(true);
      return;
    }
    setAt(at + 1);
    setPicked(null);
    setFirstOk(null);
  }
  useEffect(() => {
    function onKey(e) {
      if (it.kind === "learn") {
        if (e.key === "Enter") {
          e.preventDefault();
          next();
        }
        return;
      }
      if (picked === null) {
        const map = {
          a: 0,
          b: 1,
          c: 2,
          d: 3,
          "1": 0,
          "2": 1,
          "3": 2,
          "4": 3
        };
        const i = map[e.key.toLowerCase()];
        if (i !== undefined && it.opts[i]) {
          e.preventDefault();
          choose(it.opts[i]);
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (cram && !ok) retry();else next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (end) {
    const need = Math.ceil(plan.length * PASS);
    return /*#__PURE__*/React.createElement("div", {
      className: "wrap"
    }, /*#__PURE__*/React.createElement("div", {
      className: "head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "head-t"
    }, "\u304A\u308F\u308A")), /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("div", {
      className: "brief-t"
    }, score, " / ", asked, " \u554F"), /*#__PURE__*/React.createElement("div", {
      className: "brief-b"
    }, isTest ? score >= need ? "この回に印が付きました。" : need + " 問できると印が付きます。" : "見る所を上から順に、ぜんぶ通りました。点になるのは最初の答えです。"), /*#__PURE__*/React.createElement("div", {
      className: "brief-b"
    }, "\u6570\u5B57\u3068\u9806\u756A\u306F\u6BCE\u56DE\u5909\u308F\u308A\u307E\u3059\u3002")), /*#__PURE__*/React.createElement("button", {
      className: "go",
      onClick: back
    }, "\u672D\u306B\u3082\u3069\u308B"));
  }

  /* 見る所を覚える1枚 */
  if (it.kind === "learn") {
    return /*#__PURE__*/React.createElement("div", {
      className: "wrap"
    }, /*#__PURE__*/React.createElement("div", {
      className: "head"
    }, /*#__PURE__*/React.createElement("button", {
      className: "back",
      onClick: back
    }, "\u2190 \u3082\u3069\u308B"), /*#__PURE__*/React.createElement("span", {
      className: "head-t"
    }, "\u898B\u308B\u6240\u3000", it.i + 1, " / ", it.of), /*#__PURE__*/React.createElement("span", {
      className: "head-n"
    }, at + 1, " / ", plan.length)), /*#__PURE__*/React.createElement("div", {
      className: "bar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bar-in",
      style: {
        width: at / plan.length * 100 + "%"
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, it.i + 1, " \u756A\u76EE\u306B\u898B\u308B\u6240"), /*#__PURE__*/React.createElement("div", {
      className: "brief-t"
    }, it.b.name)), /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, "\u4F55\u3092\u8868\u3059\u304B"), it.b.spots.map((s, i) => /*#__PURE__*/React.createElement("div", {
      className: "brief-r",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "brief-k"
    }, s.name), /*#__PURE__*/React.createElement("span", {
      className: "brief-v"
    }, s.mean)))), /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, "\u3069\u3046\u4F7F\u3046\u304B"), it.b.spots.map((s, i) => /*#__PURE__*/React.createElement("div", {
      className: "brief-b",
      key: i
    }, s.use))), /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, "\u3053\u3053\u3067\u6C7A\u307E\u308B\u3068\u304D"), it.b.cond.map((c, i) => /*#__PURE__*/React.createElement("div", {
      className: "brief-r",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "brief-k"
    }, "\u3082\u3057"), /*#__PURE__*/React.createElement("span", {
      className: "brief-v"
    }, c))), /*#__PURE__*/React.createElement("div", {
      className: "brief-r"
    }, /*#__PURE__*/React.createElement("span", {
      className: "brief-k"
    }, "\u306A\u3089"), /*#__PURE__*/React.createElement("span", {
      className: "brief-v brief-hit"
    }, it.b.verdict)), /*#__PURE__*/React.createElement("div", {
      className: "gloss"
    }, GEN.gloss(it.b.verdict)), /*#__PURE__*/React.createElement("div", {
      className: "brief-b"
    }, it.i + 1 < it.of ? "決まらなければ、次の所を見ます。" : "ここまでで決まらないときの、最後の所です。")), /*#__PURE__*/React.createElement("button", {
      className: "go",
      onClick: next
    }, "\u3053\u306E\u6240\u306E\u554F\u984C\u3078\uFF08Enter\uFF09"));
  }
  let con = null,
    vals = null,
    ask = null;
  if (it.kind === "walk") {
    con = /*#__PURE__*/React.createElement(Console, {
      text: it.text,
      hits: it.st.look
    });
    vals = /*#__PURE__*/React.createElement("div", {
      className: "vals"
    }, it.st.values.map((v, i) => /*#__PURE__*/React.createElement("div", {
      className: "val",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "val-k"
    }, v.name), /*#__PURE__*/React.createElement("span", {
      className: "val-v"
    }, v.value))));
    ask = "この値なら、どうしますか。";
  } else if (it.kind === "judge") {
    const r = picked !== null ? GEN.judge(GEN.read(it.text)) : null;
    con = /*#__PURE__*/React.createElement(Console, {
      text: it.text,
      hits: r ? r.look : null
    });
    ask = "この出力で起きていることはどれですか。";
  } else {
    const r = picked !== null ? GEN.judge(GEN.read(it.q.exhibit)) : null;
    con = /*#__PURE__*/React.createElement(Console, {
      text: it.q.exhibit,
      hits: r ? r.look : null
    });
    ask = it.q.text;
  }
  let note = null;
  if (picked !== null) {
    if (it.kind === "walk") {
      note = /*#__PURE__*/React.createElement(Note, {
        title: it.right,
        body: it.st.why,
        gloss: it.st.hit ? GEN.gloss(it.st.verdict) : ""
      });
    } else if (it.kind === "judge") note = /*#__PURE__*/React.createElement(Steps, {
      t: GEN.trace(it.text)
    });else note = /*#__PURE__*/React.createElement(Steps, {
      t: GEN.trace(it.q.exhibit),
      answer: it.q.answer,
      book: it.q.explanation
    });
  }
  const head = isTest ? "テスト " + (ci + 1) : it.kind === "walk" ? "見る所　" + (it.i + 1) + " / " + it.of : "出力ぜんぶで判定";
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "head"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back",
    onClick: back
  }, "\u2190 \u3082\u3069\u308B"), /*#__PURE__*/React.createElement("span", {
    className: "head-t"
  }, head), /*#__PURE__*/React.createElement("span", {
    className: "head-n"
  }, at + 1, " / ", plan.length)), /*#__PURE__*/React.createElement("div", {
    className: "bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar-in",
    style: {
      width: at / plan.length * 100 + "%"
    }
  })), con, vals, /*#__PURE__*/React.createElement("div", {
    className: "ask"
  }, ask), /*#__PURE__*/React.createElement("div", {
    className: "opts"
  }, it.opts.map((o, i) => {
    let cls = "opt";
    if (picked !== null) {
      if (o === it.right) cls += " opt-ok";else if (o === picked) cls += " opt-ng";else cls += " opt-off";
    }
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      className: cls,
      onClick: () => choose(o),
      disabled: picked !== null
    }, /*#__PURE__*/React.createElement("span", {
      className: "opt-k"
    }, "ABCD"[i]), /*#__PURE__*/React.createElement("span", {
      className: "opt-t"
    }, o), picked !== null && o === it.right && /*#__PURE__*/React.createElement("span", {
      className: "opt-m"
    }, "\u2713"), picked !== null && o === picked && o !== it.right && /*#__PURE__*/React.createElement("span", {
      className: "opt-m"
    }, "\u2715"));
  })), note, picked === null ? /*#__PURE__*/React.createElement("div", {
    className: "src"
  }, "A\u301C", "ABCD"[it.opts.length - 1], " \u304B 1\u301C", it.opts.length, " \u306E\u30AD\u30FC\u3067\u3082\u9078\u3079\u307E\u3059") : cram && !ok ? /*#__PURE__*/React.createElement("button", {
    className: "go go-retry",
    onClick: retry
  }, "\uD83D\uDD01 \u3082\u3046\u4E00\u5EA6\u30C1\u30E3\u30EC\u30F3\u30B8\uFF08Enter\uFF09") : /*#__PURE__*/React.createElement("button", {
    className: "go",
    onClick: next
  }, at + 1 >= plan.length ? "結果を見る（Enter）" : "次へ（Enter）"), it.kind === "past" && /*#__PURE__*/React.createElement("div", {
    className: "src"
  }, it.q.qid));
}
function App() {
  const [prog, setProg] = useState(load);
  const [tid, setTid] = useState(null);
  const [mode, setMode] = useState(null);
  const homeY = useRef(0);
  useEffect(() => {
    save(prog);
  }, [prog]);
  /* ホームに戻ったときだけ、見ていた所に戻す。ほかは上から */
  useEffect(() => {
    toTop(tid === null ? homeY.current : 0);
  }, [tid, mode]);
  if (tid === null) return /*#__PURE__*/React.createElement(Home, {
    prog: prog,
    open: i => {
      homeY.current = nowY();
      setTid(i);
      setMode(null);
    }
  });
  if (mode === null) return /*#__PURE__*/React.createElement(Brief, {
    tid: tid,
    prog: prog,
    go: setMode,
    back: () => setTid(null)
  });
  if (mode === "testpick") {
    return /*#__PURE__*/React.createElement(TestPick, {
      tid: tid,
      prog: prog,
      go: setMode,
      back: () => setMode(null)
    });
  }
  return /*#__PURE__*/React.createElement(Drill, {
    tid: tid,
    mode: mode,
    prog: prog,
    setProg: setProg,
    back: () => setMode(mode.indexOf("test:") === 0 ? "testpick" : null)
  });
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
