import React, { useState, useEffect, useRef } from "react";

/* 計算なしの図表問題。ipcalc2 と同じ形（札 → 説明の1枚 → 練習／テスト）。
 *
 * 札 ＝ 問題の型（出力を読んで当てる／言葉と意味の組み合わせ／足りない設定を選ぶ／そのほか）。
 * 札の中は**ブロック**に分かれる。ブロックごとに、
 *   「練習をする」で仕組みを覚え → 「テストをする」で**同じ所の過去問**を解く。
 * これで、覚えた所とテストの範囲が必ず対になる（lpic-reflex と同じ）。
 *
 * ・判定と出力作りは engine.js と types/<id>.js。ここでは判定しない
 * ・過去問は questions.js の BANKS[<ブロックの id>]。ここには書かない
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
const LETTERS = "ABCDEFGH";

/* ── 札とブロック ────────────────────────────
 * 束B 335問を、問題の型で4枚に分け、その中を題材ごとのブロックに割る。
 * n は、そのブロックに入る過去問の数（できていないブロックは見込み）。
 * できたブロックは questions.js の BANKS に入るので、そちらの数を使う。
 */
const CARDS = [
  { id: "read", name: "出力を読んで当てる",
    note: "値を読んで、決まった規則で答えを出す",
    blocks: [
      { id: "showint", name: "show interface の障害", n: 31 },
      { id: "json", name: "JSON の読み取り", n: 38 },
      { id: "rootbridge", name: "ルートブリッジの決まり方", n: 23 },
      { id: "ospf", name: "OSPF のとなり関係", n: 13 }
    ] },
  { id: "words", name: "言葉と意味の組み合わせ",
    note: "説明と用語の対を覚える",
    blocks: [
      { id: "parts", name: "ネットワークの部品と役割", n: 22 },
      { id: "autoword", name: "自動化と API の言葉", n: 21 },
      { id: "ipv6word", name: "IPv6 のアドレスの種類", n: 19 },
      { id: "cable", name: "ケーブルの種類", n: 18 },
      { id: "aaa", name: "AAA（認証・認可・記録）", n: 15 },
      { id: "guardword", name: "守りと QoS ほか", n: 16 },
      { id: "dhcpword", name: "DHCP と DNS・NTP・SNMP", n: 10 }
    ] },
  { id: "config", name: "足りない設定を選ぶ",
    note: "要件と今の設定を読んで、打つコマンドを選ぶ",
    blocks: [
      { id: "etherchannel", name: "EtherChannel", n: 22 },
      { id: "access", name: "機器への入り方", n: 14 },
      { id: "trunk", name: "トランク", n: 10 },
      { id: "vlan", name: "VLAN", n: 9 },
      { id: "othercfg", name: "そのほかの設定", n: 18 }
    ] },
  { id: "misc", name: "そのほか",
    note: "決まった見る所が立たない、一点物",
    blocks: [
      { id: "misc", name: "題材ごとに分けます", n: 32 }
    ] }
];

const bank = (id) => (typeof BANKS !== "undefined" && BANKS[id]) || null;
const engine = (id) => (typeof GENS !== "undefined" && GENS[id]) || null;
const isReady = (id) => !!bank(id);
const blockOf = (id) => {
  for (const c of CARDS) for (const b of c.blocks) if (b.id === id) return { card: c, block: b };
  return null;
};
const cardCount = (c) => c.blocks.reduce((a, b) => a + (bank(b.id) ? bank(b.id).length : b.n), 0);

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
function makePractice(G) {
  if (!G || G.kind !== "rules") return [];
  const bs = G.blocks();
  const out = [];
  bs.forEach((b, i) => {
    out.push({ kind: "learn", b: b, i: i, of: bs.length });
    [true, false].forEach((hit) => {
      const r = G.reach(i, hit);
      if (!r) return;
      const st = r.step;
      const right = st.hit ? "答えは「" + st.verdict + "」" : "次に " + st.next + " を見る";
      const opts = [right];
      if (st.hit) { if (st.next) opts.push("次に " + st.next + " を見る"); }
      else { opts.push("答えは「" + st.verdict + "」"); }
      const other = G.shuffle(G.VERDICTS.filter((v) => v !== st.verdict))[0];
      opts.push("答えは「" + other + "」");
      out.push({ kind: "walk", text: r.text, st: st, b: b, i: i, of: bs.length,
        opts: G.shuffle(opts.slice(0, 3)), right: right });
    });
  });
  for (let k = 0; k < 3; k++) {
    const g = G.makeAny();
    if (!g.text) continue;
    const r = G.RULES.filter((x) => x.key === g.key)[0];
    const wrong = G.shuffle(G.VERDICTS.filter((v) => v !== r.verdict)).slice(0, 3);
    out.push({ kind: "judge", text: g.text, i: bs.length, of: bs.length,
      opts: G.shuffle([r.verdict].concat(wrong)), right: r.verdict });
  }
  return out;
}

/* そのブロックのテストを回に分ける。**どの問題も、必ずどれか1つの回に入る。**
 * 余りが 5 問より少ないときは、最後の回に足す（31問なら 10 / 10 / 11）。
 */
function testChunks(id) {
  const qs = bank(id);
  if (!qs || !qs.length) return [];
  const all = qs.slice().sort(function (a, b) {
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

/* 印が付く線。**10問に満たない回で「満点でないと印が付かない」ことが起きないように、
   問題数から1を引く。**9割の計算だと 9問の回は 9/9 が必要になってしまう */
function passLine(len) { return Math.max(1, len - 1); }

function makeTest(id, ci) {
  const G = engine(id);
  const sh = G ? G.shuffle : (a) => a.slice();
  return sh(testChunks(id)[ci]).map((q) => ({
    kind: "past", q: q, opts: q.choices,
    right: Array.isArray(q.answer) ? q.answer : [q.answer]
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
      <div className="note-b">{t.why}</div>
      <div className="steps">
        <div className="step-l">見た所と、そこに入っている数</div>
        {t.steps.map((s, i) => (
          <div className="step-r" key={i}>
            <span className="step-k">{s.name}</span>
            <span className="step-v">{s.value}</span>
          </div>
        ))}
      </div>
      <div className="rej">
        <div className="rej-l">ほかが消える理由</div>
        {t.reject.map((r, i) => (
          <div className="rej-r" key={i}>
            <span className="rej-k">{r.verdict}</span>
            <span className="rej-v">{r.why}</span>
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

/* ── ホーム。札＝問題の型 ────────────────────── */
function Home({ prog, open }) {
  const done = CARDS.filter((c) =>
    c.blocks.every((b) => prog[b.id] && prog[b.id].badge)).length;
  return (
    <div className="wrap">
      <div className="hero">
        <div className="hero-t">計算なしの図表問題</div>
        <div className="hero-n">出力・図・画面を見て答える問題を、型ごとに覚える</div>
        <div className="bar"><div className="bar-in" style={{ width: (done / CARDS.length * 100) + "%" }} /></div>
        <div className="hero-n">{done} / {CARDS.length} の札に印が付きました</div>
      </div>

      {CARDS.map((c, i) => {
        const ready = c.blocks.filter((b) => isReady(b.id));
        const clear = c.blocks.filter((b) => prog[b.id] && prog[b.id].badge).length;
        return (
          <div className="road" key={c.id}>
            {i > 0 && <div className="link" />}
            <button className={"tile" + (clear === c.blocks.length ? " tile-clear" : "") + (ready.length ? "" : " tile-soon")}
              onClick={() => ready.length && open(c.id)} disabled={!ready.length}>
              <span className="tile-n">{i + 1}</span>
              <span className="tile-b">
                <span className="tile-t">{c.name}</span>
                <span className="tile-s">
                  {c.note}　／　{c.blocks.length} ブロック・過去問 {cardCount(c)} 問
                </span>
              </span>
              {clear === c.blocks.length ? <span className="badge badge-gold">🏅</span>
                : ready.length ? <span className="trow-p">{ready.length} / {c.blocks.length} できています</span>
                : <span className="badge badge-soon">これから</span>}
            </button>
          </div>
        );
      })}

      <div className="foot">
        図表問題は全部で 335 問あります。どの問題も、必ずどれかの札のどれかのブロックに入ります。
        いま中身ができているのは「show interface の障害」だけです。
      </div>
    </div>
  );
}

/* ── 札の中。ブロックの一覧 ───────────────────── */
function Card({ cid, prog, open, back }) {
  const c = CARDS.filter((x) => x.id === cid)[0];
  return (
    <div className="wrap">
      <div className="head">
        <button className="back" onClick={back}>← もどる</button>
        <span className="head-t">{c.name}</span>
      </div>
      <div className="sec">
        <span className="sec-l">この札でやること</span>
        <div className="brief-b">{c.note}。</div>
        <div className="brief-b">
          ブロックごとに、まず仕組みを覚えて、そのあと同じ所の過去問を解きます。
        </div>
      </div>
      <div className="sec">
        <span className="sec-l">ブロック</span>
      </div>
      {c.blocks.map((b, i) => {
        const st = prog[b.id] || {};
        const ready = isReady(b.id);
        const num = ready ? bank(b.id).length : b.n;
        return (
          <button className={"trow" + (ready ? "" : " trow-soon")} key={b.id}
            onClick={() => ready && open(b.id)} disabled={!ready}>
            <span className="trow-n">{i + 1}</span>
            <span className="trow-b">
              <span className="trow-t">{b.name}</span>
              <span className="trow-s">過去問 {num} 問</span>
            </span>
            {st.badge ? <span className="badge badge-gold">🏅</span>
              : ready ? <span className="trow-p trow-yet">まだ</span>
              : <span className="badge badge-soon">これから</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── 説明の1枚（ブロック1つぶん） ───────────────── */
function Brief({ bid, prog, go, back }) {
  const { card, block } = blockOf(bid);
  const st = prog[bid] || {};
  const G = engine(bid);
  const bs = G && G.kind === "rules" ? G.blocks() : [];
  const chunks = testChunks(bid);
  const spec = G ? G.spec : null;
  return (
    <>
      <div className="wrap has-dock">
        <div className="head">
          <button className="back" onClick={back}>← もどる</button>
          <span className="head-t">{block.name}</span>
          {st.badge && <span className="head-n">🏅</span>}
        </div>

        <div className="sec">
          <span className="sec-l">このブロックでやること</span>
          <div className="brief-b">
            {spec ? spec.note : card.note}。決め手は決まった所にあります。
            上から順に見ていって、当たったところで答えが決まります。
          </div>
        </div>

        {bs.length > 0 && (
          <div className="sec">
            <span className="sec-l">見る順番（練習で上から一個ずつ覚えます）</span>
            <div className="order">
              {bs.map((x, i) => (
                <div className="order-r" key={i}>
                  <span className="order-n">{i + 1}</span>
                  <span className="order-k">{x.name}</span>
                  <span className="order-v">{x.verdict}
                    <span className="order-g">{G.gloss(x.verdict)}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="sec">
          <span className="sec-l">テストの中身</span>
          <div className="brief-b">
            このブロックの過去問 {bank(bid).length} 問を {chunks.length} 回に分けてあります。
            どの問題も、必ずどれかの回に入っています。
            1問まで間違えても、その回に印が付きます。
          </div>
          {spec && spec.dropped && spec.dropped.length > 0 && (
            <div className="brief-b">
              この題材の図表問題は全部で {bank(bid).length + spec.dropped.length} 問ありますが、
              {spec.dropped.length} 問は本の答えが出力と食い違うため外しています。
            </div>
          )}
        </div>
      </div>

      {/* いちばん下の段。本文をどこまで送っても、ここは動かない */}
      <div className="dock">
        <button className="go next" onClick={() => go("practice")} disabled={!bs.length}>
          練習をする
        </button>
        <button className="go next ghost" onClick={() => go("testpick")}>テストをする</button>
      </div>
    </>
  );
}

/* ── どのテストを受けるか選ぶ ────────────────── */
function TestPick({ bid, prog, go, back }) {
  const { block } = blockOf(bid);
  const st = prog[bid] || {};
  const chunks = testChunks(bid);
  return (
    <div className="wrap">
      <div className="head">
        <button className="back" onClick={back}>← もどる</button>
        <span className="head-t">{block.name}　テスト</span>
      </div>
      <div className="sec">
        <span className="sec-l">どのテストを受けますか</span>
        <div className="brief-b">
          このブロックで覚えた所が、そのままテストの範囲です。
          1問まで間違えても、その回に印が付きます。
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
    </div>
  );
}

/* ── 一問一答 ────────────────────────── */
function Drill({ bid, mode, prog, setProg, back }) {
  const { block } = blockOf(bid);
  const G = engine(bid);
  const ci = mode.indexOf("test:") === 0 ? parseInt(mode.slice(5), 10) : -1;
  const isTest = ci >= 0;
  const [plan] = useState(() => (isTest ? makeTest(bid, ci) : makePractice(G)));
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState(null);   // 決まった時に押したもの（間違いのときだけ入る）
  const [got, setGot] = useState([]);           // 当たった選択肢（答えが2つ以上のとき積む）
  const [done, setDone] = useState(false);      // その問題の答え合わせが出ているか
  const [firstOk, setFirstOk] = useState(null);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(0);
  const [end, setEnd] = useState(false);
  const it = plan[at];
  const rights = it ? (Array.isArray(it.right) ? it.right : [it.right]) : [];
  const ok = done && picked === null;
  const cram = !isTest;

  /* 次の問題・結果の画面に移ったら、上から見せる */
  useEffect(() => { toTop(); }, [at, end]);

  function choose(o) {
    if (done) return;
    if (rights.indexOf(o) >= 0) {
      if (got.indexOf(o) >= 0) return;
      const g = got.concat([o]);
      setGot(g);
      if (g.length >= rights.length) {      // ぜんぶ当てた
        setDone(true);
        if (firstOk === null) { setFirstOk(true); setAsked(asked + 1); setScore(score + 1); }
      }
      return;
    }
    setPicked(o); setDone(true);
    if (firstOk === null) { setFirstOk(false); setAsked(asked + 1); }
  }
  /* やり直しは問題が上に出直すので、こちらも上へ戻す */
  function retry() { setPicked(null); setGot([]); setDone(false); toTop(); }
  function next() {
    if (at + 1 >= plan.length) {
      const p = Object.assign({}, prog);
      const prev = p[bid] || {};
      const tests = Object.assign({}, prev.tests);
      if (isTest) {
        const t0 = tests[ci] || {};
        tests[ci] = { best: Math.max(t0.best || 0, score),
                      badge: (t0.badge || false) || score >= passLine(plan.length) };
      }
      const all = testChunks(bid).length;
      let cleared = 0;
      for (let k = 0; k < all; k++) if (tests[k] && tests[k].badge) cleared++;
      p[bid] = { tests: tests, badge: all > 0 && cleared === all,
                 practiced: prev.practiced || !isTest };
      setProg(p); setEnd(true); return;
    }
    setAt(at + 1); setPicked(null); setGot([]); setDone(false); setFirstOk(null);
  }

  useEffect(() => {
    function onKey(e) {
      if (!it) return;
      if (it.kind === "learn") {
        if (e.key === "Enter") { e.preventDefault(); next(); }
        return;
      }
      if (!done) {
        const k = e.key.toLowerCase();
        let i = LETTERS.toLowerCase().indexOf(k);
        if (i < 0 && /^[1-8]$/.test(k)) i = parseInt(k, 10) - 1;
        if (i >= 0 && it.opts[i]) { e.preventDefault(); choose(it.opts[i]); }
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

  /* 練習の材料が作れないブロック（判定エンジンがない）で、空のまま入ったとき */
  if (!plan.length) {
    return (
      <div className="wrap">
        <div className="head">
          <button className="back" onClick={back}>← もどる</button>
          <span className="head-t">{block.name}</span>
        </div>
        <div className="sec">
          <div className="brief-b">このブロックの練習は、まだ用意できていません。</div>
        </div>
        <button className="go" onClick={back}>もどる</button>
      </div>
    );
  }

  if (end) {
    const need = passLine(plan.length);
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
        <button className="go" onClick={back}>もどる</button>
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
          <div className="gloss">{G.gloss(it.b.verdict)}</div>
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
    const r = done ? G.judge(G.read(it.text)) : null;
    con = <Console text={it.text} hits={r ? r.look : null} />;
    ask = "この出力で起きていることはどれですか。";
  } else {
    const r = done && G ? G.judge(G.read(it.q.exhibit)) : null;
    con = it.q.exhibit ? <Console text={it.q.exhibit} hits={r ? r.look : null} /> : null;
    ask = it.q.text;
  }
  /* 問題文が自分で「2つ選択」と言っているときは、重ねて書かない */
  if (rights.length > 1 && !/つ選|選択して/.test(ask)) {
    ask = ask + "（" + rights.length + "つ選びます）";
  }

  let note = null;
  if (done) {
    if (it.kind === "walk") {
      note = <Note title={it.right} body={it.st.why}
        gloss={it.st.hit ? G.gloss(it.st.verdict) : ""} />;
    }
    else if (it.kind === "judge") note = <Steps t={G.trace(it.text)} />;
    else note = <Steps t={G && it.q.exhibit ? G.trace(it.q.exhibit) : null}
      answer={rights.join(" ／ ")} book={it.q.explanation} />;
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
          const right = rights.indexOf(o) >= 0;
          const hitYet = got.indexOf(o) >= 0;
          let cls = "opt";
          if (done) {
            if (right) cls += " opt-ok";
            else if (o === picked) cls += " opt-ng";
            else cls += " opt-off";
          } else if (hitYet) cls += " opt-ok";
          return (
            <button key={i} className={cls} onClick={() => choose(o)} disabled={done}>
              <span className="opt-k">{LETTERS[i] || ""}</span>
              <span className="opt-t">{o}</span>
              {(done && right) || hitYet ? <span className="opt-m">✓</span> : null}
              {done && o === picked && !right && <span className="opt-m">✕</span>}
            </button>
          );
        })}
      </div>

      {note}

      {!done ? (
        <div className="src">
          A〜{LETTERS[it.opts.length - 1]} か 1〜{it.opts.length} のキーでも選べます
          {rights.length > 1 && got.length > 0 && "　／　あと " + (rights.length - got.length) + " つ"}
        </div>
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
  const [cid, setCid] = useState(null);   // 札
  const [bid, setBid] = useState(null);   // ブロック
  const [mode, setMode] = useState(null); // null=説明 / "practice" / "testpick" / "test:N"
  const homeY = useRef(0);
  useEffect(() => { save(prog); }, [prog]);
  /* ホームに戻ったときだけ、見ていた所に戻す。ほかは上から */
  useEffect(() => { toTop(cid === null ? homeY.current : 0); }, [cid, bid, mode]);

  if (cid === null) {
    return <Home prog={prog}
      open={(id) => { homeY.current = nowY(); setCid(id); setBid(null); setMode(null); }} />;
  }
  if (bid === null) {
    return <Card cid={cid} prog={prog}
      open={(id) => { setBid(id); setMode(null); }}
      back={() => setCid(null)} />;
  }
  if (mode === null) {
    return <Brief bid={bid} prog={prog} go={setMode} back={() => setBid(null)} />;
  }
  if (mode === "testpick") {
    return <TestPick bid={bid} prog={prog} go={setMode} back={() => setMode(null)} />;
  }
  return <Drill bid={bid} mode={mode} prog={prog} setProg={setProg}
    back={() => setMode(mode.indexOf("test:") === 0 ? "testpick" : null)} />;
}
