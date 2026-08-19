import React, { useState, useEffect, useRef } from "react";

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
const nowY = () => { const e = document.querySelector(".wrap"); return e ? e.scrollTop : 0; };
const toTop = (y) => {
  const e = document.querySelector(".wrap");
  if (e) e.scrollTop = y || 0;
  try { window.scrollTo(0, y || 0); } catch (err) {}
};

const KEY = "showread-progress";
const TEST_N = 10;
const PASS = 0.9;

/* 札＝分類。いまできているのは「show interface の読み取り」だけ */
const TYPES = [
  { id: "showint", obj: "1.4", name: "show interface の読み取り",
    note: "出力を見て、何が起きているかを当てる", n: 35, ready: true },   // n は questions.js の数で上書きされる
  { id: "json", obj: "6.7", name: "JSON の読み取り", note: "キー・値・配列・オブジェクト", n: 38, ready: false },
  { id: "etherchannel", obj: "2.4", name: "EtherChannel", note: "束ねる設定と、束ねられない理由", n: 23, ready: false },
  { id: "stp", obj: "2.5", name: "STP（ルートブリッジ）", note: "優先度とMACアドレスで決まる", n: 23, ready: false },
  { id: "cable", obj: "1.3", name: "ケーブルの種類", note: "距離と光の種類で選ぶ", n: 19, ready: false },
  { id: "aaa", obj: "5.8", name: "AAA", note: "認証・認可・記録の見分け", n: 19, ready: false },
  { id: "vlan", obj: "2.1", name: "VLAN の設定と確認", note: "show vlan の読み方", n: 16, ready: false },
  { id: "access", obj: "5.3", name: "機器への入り方", note: "SSH・パスワード・vty", n: 15, ready: false }
];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function save(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
}

/* ── 出力を出す ───────────────────────────── */
function Console({ text, hits }) {
  return (
    <pre className="con">
      {text.split("\n").map((line, i) => {
        const on = i > 0 && hits && hits.some((w) => line.indexOf(w) >= 0);
        return (
          <div key={i} className={"cline" + (i === 0 ? " ccmd" : "") + (on ? " chit" : "")}>
            {line}
          </div>
        );
      })}
    </pre>
  );
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
    out.push({ kind: "learn", b: b, i: i, of: bs.length });
    [true, false].forEach((hit) => {
      const r = GEN.reach(i, hit);
      if (!r) return;
      const st = r.step;
      const right = st.hit ? "答えは「" + st.verdict + "」" : "次に " + st.next + " を見る";
      const opts = [right];
      if (st.hit) { if (st.next) opts.push("次に " + st.next + " を見る"); }
      else { opts.push("答えは「" + st.verdict + "」"); }
      const other = GEN.shuffle(GEN.VERDICTS.filter((v) => v !== st.verdict))[0];
      opts.push("答えは「" + other + "」");
      out.push({ kind: "walk", text: r.text, st: st, b: b, i: i, of: bs.length,
        opts: GEN.shuffle(opts.slice(0, 3)), right: right });
    });
  });
  for (let k = 0; k < 3; k++) {
    const g = GEN.makeAny();
    if (!g.text) continue;
    const r = GEN.RULES.filter((x) => x.key === g.key)[0];
    const wrong = GEN.shuffle(GEN.VERDICTS.filter((v) => v !== r.verdict)).slice(0, 3);
    out.push({ kind: "judge", text: g.text, i: bs.length, of: bs.length,
      opts: GEN.shuffle([r.verdict].concat(wrong)), right: r.verdict });
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
  return GEN.shuffle(testChunks()[ci]).map((q) => ({
    kind: "past", q: q, opts: q.choices, right: q.answer
  }));
}

/* ── 答えの出し方を、実際の数字で見せる ───────── */
function Steps({ t, answer, book }) {
  if (!t) {
    return (
      <div className="note">
        <div className="note-t">{answer || ""}</div>
        {book && <div className="note-b">本の解説：{book.slice(0, 150)}</div>}
      </div>
    );
  }
  return (
    <div className="note">
      <div className="note-t">{answer || t.verdict}</div>
      <div className="gloss">{GEN.gloss(t.verdict)}</div>
      <div className="note-h">この出力で見た所</div>
      <div className="steps">
        {t.steps.map((s, i) => (
          <div className="step" key={i}>
            <span className="step-n">{i + 1}</span>
            <span className="step-k">{s.name}</span>
            <span className="step-v">{s.value}</span>
          </div>
        ))}
        <div className="step step-end">
          <span className="step-n">→</span>
          <span className="step-w">{t.why}</span>
        </div>
      </div>
      <div className="note-h">ほかの選択肢が消える理由</div>
      <div className="rej">
        {t.reject.map((r, i) => (
          <div className="rej-r" key={i}>
            <span className="rej-v">✕ {r.verdict}</span>
            <span className="rej-w">{r.why}</span>
          </div>
        ))}
      </div>
      {book && <div className="note-b">本の解説：{book.slice(0, 150)}</div>}
    </div>
  );
}

function Note({ title, body, gloss }) {
  return (
    <div className="note">
      <div className="note-t">{title}</div>
      {gloss && <div className="gloss">{gloss}</div>}
      {body && <div className="note-b">{body}</div>}
    </div>
  );
}

/* ── ホーム。札＝分類 ────────────────────── */
function Home({ prog, open }) {
  const done = TYPES.filter((t) => prog[t.id] && prog[t.id].badge).length;
  return (
    <div className="wrap">
      <div className="hero">
        <div className="hero-t">計算なしの図表問題</div>
        <div className="hero-n">出力・図・画面を見て答える問題を、分類ごとに覚える</div>
        <div className="bar"><div className="bar-in" style={{ width: (done / TYPES.length * 100) + "%" }} /></div>
        <div className="hero-n">{done} / {TYPES.length} の分類に印が付きました</div>
      </div>

      {TYPES.map((t, i) => {
        const st = prog[t.id] || {};
        return (
          <div className="road" key={t.id}>
            {i > 0 && <div className="link" />}
            <button className={"tile" + (st.badge ? " tile-clear" : "") + (t.ready ? "" : " tile-soon")}
              onClick={() => t.ready && open(t.id)} disabled={!t.ready}>
              <span className="tile-n">{i + 1}</span>
              <span className="tile-b">
                <span className="tile-t">{t.name}</span>
                <span className="tile-s">{t.note}　／　過去問 {t.ready ? QUESTIONS.length : t.n} 問</span>
              </span>
              {st.badge ? <span className="badge badge-gold">🏅</span>
                : t.ready ? null : <span className="badge badge-soon">これから</span>}
            </button>
          </div>
        );
      })}

      <div className="foot">
        いまできているのは「show interface の読み取り」だけです。
        見る所13か所と判定ルール10本は、過去問35問とその解説から起こしました。
        31問で本の答えと一致します。残り4問は本のほうに食い違いがあるため、外しています。
      </div>
    </div>
  );
}

/* ── 説明の1枚 ──────────────────────────── */
function Brief({ tid, prog, go, back }) {
  const t = TYPES.filter((x) => x.id === tid)[0];
  const st = prog[tid] || {};
  const bs = GEN.blocks();
  return (
    <>
      <div className="wrap has-dock">
      <div className="head">
        <button className="back" onClick={back}>← もどる</button>
        <span className="head-t">{t.name}</span>
        {st.badge && <span className="head-n">🏅</span>}
      </div>

      <div className="sec">
        <span className="sec-l">この分類でやること</span>
        <div className="brief-b">
          {t.note}。決め手は出力の中の決まった所にあります。
          上から順に見ていって、当たったところで答えが決まります。
        </div>
      </div>

      <div className="sec">
        <span className="sec-l">見る順番（練習で上から一個ずつ覚えます）</span>
        <div className="order">
          {bs.map((x, i) => (
            <div className="order-r" key={i}>
              <span className="order-n">{i + 1}</span>
              <span className="order-k">{x.name}</span>
              <span className="order-v">{x.verdict}
                <span className="order-g">{GEN.gloss(x.verdict)}</span></span>
            </div>
          ))}
        </div>
      </div>

      <div className="sec">
        <span className="sec-l">テストの中身</span>
        <div className="brief-b">
          過去問 {QUESTIONS.length} 問を {TEST_N} 問ずつに分けてあります。
          どの問題も、必ずどれかの回に入っています。
          9割できたら、その回に印が付きます。
        </div>
        <div className="brief-b">
          目標1.4 の図表問題は全部で 35 問ありますが、
          4問は本の答えが出力と食い違うため外しています。
        </div>
      </div>
      </div>

      {/* いちばん下の段。本文をどこまで送っても、ここは動かない */}
      <div className="dock">
        <button className="go next" onClick={() => go("practice")}>練習をする</button>
        <button className="go next ghost" onClick={() => go("testpick")}>テストをする</button>
      </div>
    </>
  );
}

/* ── どのテストを受けるか選ぶ ────────────────── */
function TestPick({ tid, prog, go, back }) {
  const t = TYPES.filter((x) => x.id === tid)[0];
  const st = prog[tid] || {};
  const chunks = testChunks();
  return (
    <div className="wrap">
      <div className="head">
        <button className="back" onClick={back}>← もどる</button>
        <span className="head-t">{t.name}　テスト</span>
      </div>
      <div className="sec">
        <span className="sec-l">どのテストを受けますか</span>
        <div className="brief-b">
          過去問 {QUESTIONS.length} 問を {TEST_N} 問ずつに分けてあります。
          どの問題も、必ずどれかの回に入っています。
          9割できたら、その回に印が付きます。
        </div>
      </div>
      {chunks.map((c, i) => {
        const r = (st.tests || {})[i] || {};
        return (
          <button className="trow" key={i} onClick={() => go("test:" + i)}>
            <span className="trow-n">{i + 1}</span>
            <span className="trow-b">
              <span className="trow-t">テスト {i + 1}</span>
              <span className="trow-s">{c.length} 問　{c[0].qid} 〜 {c[c.length - 1].qid}</span>
            </span>
            {r.badge ? <span className="badge badge-gold">🏅</span>
              : r.best !== undefined ? <span className="trow-p">{r.best} / {c.length}</span>
              : <span className="trow-p trow-yet">まだ</span>}
          </button>
        );
      })}
      <div className="foot">
        目標1.4 の図表問題は全部で 35 問ありますが、
        4問は本の答えが出力と食い違うため外しています。
      </div>
    </div>
  );
}

/* ── 一問一答 ────────────────────────── */
function Drill({ tid, mode, prog, setProg, back }) {
  const ci = mode.indexOf("test:") === 0 ? parseInt(mode.slice(5), 10) : -1;
  const isTest = ci >= 0;
  const [plan] = useState(() => (isTest ? makeTest(ci) : makePractice()));
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState(null);
  const [firstOk, setFirstOk] = useState(null);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(0);
  const [end, setEnd] = useState(false);
  const it = plan[at];
  const ok = picked !== null && picked === it.right;
  /* 次の問題・結果の画面に移ったら、上から見せる */
  useEffect(() => { toTop(); }, [at, end]);
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
  function retry() { setPicked(null); toTop(); }
  function next() {
    if (at + 1 >= plan.length) {
      const p = Object.assign({}, prog);
      const prev = p[tid] || {};
      const tests = Object.assign({}, prev.tests);
      if (isTest) {
        const t0 = tests[ci] || {};
        tests[ci] = { best: Math.max(t0.best || 0, score),
                      badge: (t0.badge || false) || score >= Math.ceil(plan.length * PASS) };
      }
      const all = testChunks().length;
      let done = 0;
      for (let k = 0; k < all; k++) if (tests[k] && tests[k].badge) done++;
      p[tid] = { tests: tests, badge: done === all,
                 practiced: prev.practiced || !isTest };
      setProg(p); setEnd(true); return;
    }
    setAt(at + 1); setPicked(null); setFirstOk(null);
  }

  useEffect(() => {
    function onKey(e) {
      if (it.kind === "learn") {
        if (e.key === "Enter") { e.preventDefault(); next(); }
        return;
      }
      if (picked === null) {
        const map = { a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
        const i = map[e.key.toLowerCase()];
        if (i !== undefined && it.opts[i]) { e.preventDefault(); choose(it.opts[i]); }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (cram && !ok) retry(); else next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (end) {
    const need = Math.ceil(plan.length * PASS);
    return (
      <div className="wrap">
        <div className="head"><span className="head-t">おわり</span></div>
        <div className="sec">
          <div className="brief-t">{score} / {asked} 問</div>
          <div className="brief-b">
            {isTest
              ? (score >= need ? "この回に印が付きました。" : need + " 問できると印が付きます。")
              : "見る所を上から順に、ぜんぶ通りました。点になるのは最初の答えです。"}
          </div>
          <div className="brief-b">数字と順番は毎回変わります。</div>
        </div>
        <button className="go" onClick={back}>札にもどる</button>
      </div>
    );
  }

  /* 見る所を覚える1枚 */
  if (it.kind === "learn") {
    return (
      <div className="wrap">
        <div className="head">
          <button className="back" onClick={back}>← もどる</button>
          <span className="head-t">見る所　{it.i + 1} / {it.of}</span>
          <span className="head-n">{at + 1} / {plan.length}</span>
        </div>
        <div className="bar"><div className="bar-in" style={{ width: (at / plan.length * 100) + "%" }} /></div>

        <div className="sec">
          <span className="sec-l">{it.i + 1} 番目に見る所</span>
          <div className="brief-t">{it.b.name}</div>
        </div>
        <div className="sec">
          <span className="sec-l">何を表すか</span>
          {it.b.spots.map((s, i) => (
            <div className="brief-r" key={i}>
              <span className="brief-k">{s.name}</span>
              <span className="brief-v">{s.mean}</span>
            </div>
          ))}
        </div>
        <div className="sec">
          <span className="sec-l">どう使うか</span>
          {it.b.spots.map((s, i) => <div className="brief-b" key={i}>{s.use}</div>)}
        </div>
        <div className="sec">
          <span className="sec-l">ここで決まるとき</span>
          {it.b.cond.map((c, i) => (
            <div className="brief-r" key={i}>
              <span className="brief-k">もし</span>
              <span className="brief-v">{c}</span>
            </div>
          ))}
          <div className="brief-r">
            <span className="brief-k">なら</span>
            <span className="brief-v brief-hit">{it.b.verdict}</span>
          </div>
          <div className="gloss">{GEN.gloss(it.b.verdict)}</div>
          <div className="brief-b">
            {it.i + 1 < it.of ? "決まらなければ、次の所を見ます。" : "ここまでで決まらないときの、最後の所です。"}
          </div>
        </div>
        <button className="go" onClick={next}>この所の問題へ（Enter）</button>
      </div>
    );
  }

  let con = null, vals = null, ask = null;
  if (it.kind === "walk") {
    con = <Console text={it.text} hits={it.st.look} />;
    vals = (
      <div className="vals">
        {it.st.values.map((v, i) => (
          <div className="val" key={i}>
            <span className="val-k">{v.name}</span>
            <span className="val-v">{v.value}</span>
          </div>
        ))}
      </div>
    );
    ask = "この値なら、どうしますか。";
  } else if (it.kind === "judge") {
    const r = picked !== null ? GEN.judge(GEN.read(it.text)) : null;
    con = <Console text={it.text} hits={r ? r.look : null} />;
    ask = "この出力で起きていることはどれですか。";
  } else {
    const r = picked !== null ? GEN.judge(GEN.read(it.q.exhibit)) : null;
    con = <Console text={it.q.exhibit} hits={r ? r.look : null} />;
    ask = it.q.text;
  }

  let note = null;
  if (picked !== null) {
    if (it.kind === "walk") {
      note = <Note title={it.right} body={it.st.why}
        gloss={it.st.hit ? GEN.gloss(it.st.verdict) : ""} />;
    }
    else if (it.kind === "judge") note = <Steps t={GEN.trace(it.text)} />;
    else note = <Steps t={GEN.trace(it.q.exhibit)} answer={it.q.answer} book={it.q.explanation} />;
  }

  const head = isTest
    ? "テスト " + (ci + 1)
    : (it.kind === "walk" ? "見る所　" + (it.i + 1) + " / " + it.of : "出力ぜんぶで判定");

  return (
    <div className="wrap">
      <div className="head">
        <button className="back" onClick={back}>← もどる</button>
        <span className="head-t">{head}</span>
        <span className="head-n">{at + 1} / {plan.length}</span>
      </div>
      <div className="bar"><div className="bar-in" style={{ width: (at / plan.length * 100) + "%" }} /></div>

      {con}
      {vals}
      <div className="ask">{ask}</div>

      <div className="opts">
        {it.opts.map((o, i) => {
          let cls = "opt";
          if (picked !== null) {
            if (o === it.right) cls += " opt-ok";
            else if (o === picked) cls += " opt-ng";
            else cls += " opt-off";
          }
          return (
            <button key={i} className={cls} onClick={() => choose(o)} disabled={picked !== null}>
              <span className="opt-k">{"ABCD"[i]}</span>
              <span className="opt-t">{o}</span>
              {picked !== null && o === it.right && <span className="opt-m">✓</span>}
              {picked !== null && o === picked && o !== it.right && <span className="opt-m">✕</span>}
            </button>
          );
        })}
      </div>

      {note}

      {picked === null ? (
        <div className="src">A〜{"ABCD"[it.opts.length - 1]} か 1〜{it.opts.length} のキーでも選べます</div>
      ) : (cram && !ok) ? (
        <button className="go go-retry" onClick={retry}>🔁 もう一度チャレンジ（Enter）</button>
      ) : (
        <button className="go" onClick={next}>
          {at + 1 >= plan.length ? "結果を見る（Enter）" : "次へ（Enter）"}
        </button>
      )}
      {it.kind === "past" && <div className="src">{it.q.qid}</div>}
    </div>
  );
}

export default function App() {
  const [prog, setProg] = useState(load);
  const [tid, setTid] = useState(null);
  const [mode, setMode] = useState(null);
  const homeY = useRef(0);
  useEffect(() => { save(prog); }, [prog]);
  /* ホームに戻ったときだけ、見ていた所に戻す。ほかは上から */
  useEffect(() => { toTop(tid === null ? homeY.current : 0); }, [tid, mode]);

  if (tid === null) return <Home prog={prog}
    open={(i) => { homeY.current = nowY(); setTid(i); setMode(null); }} />;
  if (mode === null) return <Brief tid={tid} prog={prog} go={setMode} back={() => setTid(null)} />;
  if (mode === "testpick") {
    return <TestPick tid={tid} prog={prog} go={setMode} back={() => setMode(null)} />;
  }
  return <Drill tid={tid} mode={mode} prog={prog} setProg={setProg}
    back={() => setMode(mode.indexOf("test:") === 0 ? "testpick" : null)} />;
}
