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
      { id: "ospf", name: "OSPF のとなり関係", n: 7 },
      { id: "ospfdr", name: "OSPF の代表ルータ", n: 2 },
      { id: "log", name: "ログの読み取り", n: 3 }
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
/* 番号。トップの札が 1・2・3・4、その中の分野が 1.1・1.2 … */
const cardNo = (cid) => CARDS.findIndex((c) => c.id === cid) + 1;
const blockNo = (cid, bid) => {
  const c = CARDS.filter((x) => x.id === cid)[0];
  return cardNo(cid) + "." + (c.blocks.findIndex((b) => b.id === bid) + 1);
};
const cardCount = (c) => c.blocks.reduce((a, b) => a + (bank(b.id) ? bank(b.id).length : b.n), 0);

/* 学習の記録は store.js（いまは localStorage、のちにサーバ）。
   **画面は「いまの状態」だけを見る。**状態は、ためた記録から毎回作り直す */
const allBlockIds = () => CARDS.reduce((a, c) => a.concat(c.blocks.map((b) => b.id)), []);
const roundsOf = (id) => testChunks(id).map((c) => STORE.setKey(c));
/* 問題データの版。中身ができているブロックだけを並べる。
   例 "showint:31,rootbridge:23"。問題を足すと変わるので、
   あとから「どの版で解いた記録か」が分かる */
const dataVersion = () => allBlockIds()
  .filter((id) => bank(id)).map((id) => id + ":" + bank(id).length).join(",");
function loadState() { return STORE.summarize(STORE.load(), allBlockIds(), roundsOf); }

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

/* ── 図を出す ─────────────────────────────
 * 描くのは fig.js。**React を使わない素の関数**なので、
 * 本番環境が React でなくても、そのまま持っていける。
 */
function Figure({ fig }) {
  if (!fig) return null;
  return <div className="figwrap" dangerouslySetInnerHTML={{ __html: FIG.svg(fig) }} />;
}

/* ── 紙面から切り出した、本物の図 ─────────────────
 * テストは**本と同じ見え方**にする。練習で出る図は作ったもの（Figure）。
 */
function Scan({ image, alt }) {
  if (!image) return null;
  return (
    <div className="scan">
      <img src={image.src} width={image.w} height={image.h} alt={alt || ""} loading="lazy" />
    </div>
  );
}

/* ── MACアドレスの一覧 ─────────────────────────
 * 本の紙面では、図の下に別で刷られていることがある。
 * 切り出した図には入らないので、ここで出す。**紙面と同じ並び。**
 */
function MacList({ sw }) {
  return (
    <div className="mlist">
      {sw.map((s, i) => (
        <div className="mrow" key={i}>
          <span className="mk">{s.id}</span>
          <span className="mv">{s.mac}</span>
        </div>
      ))}
    </div>
  );
}

/* ── 1問の形 ─────────────────────────────
 * **練習もテストも、同じ形にそろえる。**画面側は kind で場合分けしない。
 *
 *   kind    "learn"（覚える1枚）／"step"（見る所ごとの問題）
 *           "whole"（提示物ぜんぶで判定）／"past"（過去問）
 *   ask     問題文。learn は null
 *   exhibit 提示物。{kind:"console", text} か {kind:"topology", fig} か null
 *   image   紙面から切り出した実物。{src,w,h} か null
 *   opts    選択肢。learn は null
 *   right   正解。**いつも配列**（答えが2つ以上の問題があるため）
 *   extra   その形だけが持つもの（覚える1枚の中身、見る所の道すじ、MACの一覧…）
 *   note    出どころ。{qid, book, explanation}。過去問だけ
 */
function item(o) {
  return { kind: o.kind, ask: o.ask || null,
           exhibit: o.exhibit || null, image: o.image || null,
           opts: o.opts || null,
           right: o.right ? (Array.isArray(o.right) ? o.right : [o.right]) : null,
           extra: o.extra || {}, note: o.note || null };
}
/* 提示物を1つの形にする。文字列なら出力、それ以外は図 */
function asExhibit(x) {
  if (x == null) return null;
  return typeof x === "string" ? { kind: "console", text: x } : { kind: "topology", fig: x };
}
/* 判定エンジンに渡す中身を取り出す */
function exValue(ex) { return ex ? (ex.kind === "console" ? ex.text : ex.fig) : null; }

/* ── 練習を組む ───────────────────────────
 * 見る所の表を、上から一個ずつ。
 *   ① その見る所を覚える（説明の札）
 *   ② 決まるとき / 決まらないとき の2問
 * 最後に、提示物ぜんぶで判定を3問。
 */
function makePractice(G, id) {
  /* 判定エンジンを持たないブロック（言葉と意味の組み合わせなど）は、
     **過去問そのものを練習にする。**間違えたら、正解するまでやり直す形。
     テストは同じ問題を、点を付けて解く（lpic-reflex と同じ考え方） */
  if (!G || G.kind !== "rules") {
    const qs = bank(id) || [];
    if (!qs.length) return [];
    return shuffleAny(qs).map((q) => asPast(q));
  }
  const bs = G.blocks();
  const out = [];
  bs.forEach((b, i) => {
    out.push(item({ kind: "learn", extra: { block: b, i: i, of: bs.length } }));
    [true, false].forEach((hit) => {
      const r = G.reach(i, hit);
      if (!r) return;
      const st = r.step;
      /* 聞き方と選択肢を、その題材が自分で持っているときは、そちらを使う。
         **画面側では文を組み立てない**（判定と同じ考え方） */
      let ask, opts, right;
      if (G.spec.walk) {
        const w = G.spec.walk(st, G.read(r.text), G.shuffle);
        ask = w.ask; opts = w.opts; right = w.right;
      } else {
        right = st.hit ? "答えは「" + st.verdict + "」" : "次に " + st.next + " を見る";
        opts = [right];
        if (st.hit) { if (st.next) opts.push("次に " + st.next + " を見る"); }
        else { opts.push("答えは「" + st.verdict + "」"); }
        const other = G.shuffle(G.VERDICTS.filter((v) => v !== st.verdict))[0];
        if (other) opts.push("答えは「" + other + "」");
        opts = G.shuffle(opts.slice(0, 3));
        ask = "この値なら、どうしますか。";
      }
      out.push(item({ kind: "step", ask: ask, exhibit: asExhibit(r.text),
        opts: opts, right: right, extra: { step: st, i: i, of: bs.length } }));
    });
  });
  for (let k = 0; k < 3; k++) {
    const g = G.makeAny();
    if (!g.text) continue;
    const r = G.RULES.filter((x) => x.key === g.key)[0];
    /* 答えが「その場の選択肢」になるブロック（ルートブリッジなど）は、
       誤答も同じ提示物の中の別のものから作る */
    let opts, right;
    if (G.answer) {
      const v = G.read(g.text);
      right = G.answer(v);
      opts = G.shuffle(v.sw.map((x) => x.id));
    } else {
      right = r.verdict;
      opts = G.shuffle([r.verdict].concat(
        G.shuffle(G.VERDICTS.filter((v) => v !== r.verdict)).slice(0, 3)));
    }
    out.push(item({ kind: "whole",
      ask: (G.spec && G.spec.ask) || "この出力で起きていることはどれですか。",
      exhibit: asExhibit(g.text), opts: opts, right: right,
      extra: { i: bs.length, of: bs.length } }));
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

/* 過去問1問を、画面が読む形にする */
function asPast(q) {
  return item({
    kind: "past", ask: q.text,
    exhibit: asExhibit(q.fig || q.exhibit || null),
    image: q.image || null,
    opts: q.choices, right: q.answer,
    extra: { maclist: !!(q.fig && q.fig.maclist), sw: q.fig ? q.fig.sw : null },
    note: { qid: q.qid, book: q.book, explanation: q.explanation }
  });
}

/* 判定エンジンが無いブロックでも混ぜられるように */
function shuffleAny(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = x[i]; x[i] = x[j]; x[j] = t;
  }
  return x;
}

function makeTest(id, ci) {
  return shuffleAny(testChunks(id)[ci]).map((q) => asPast(q));
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

/* ── ホーム。札＝問題の型 ──────────────────────
 * **はじめは札だけ。押した札にだけ、2つのボタンが出る**（ipcalc2 と同じ）。
 * 鍵は無い。どの札も、練習もテストも、いつでも押せる。
 */
function Home({ prog, go }) {
  const [pick, setPick] = useState(null);
  const done = CARDS.filter((c) =>
    c.blocks.every((b) => prog.blocks[b.id] && prog.blocks[b.id].badge)).length;
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
        const clear = c.blocks.filter((b) => prog.blocks[b.id] && prog.blocks[b.id].badge).length;
        return (
          <div className="road" key={c.id}>
            {i > 0 && <div className="link" />}
            <div className={"tile" + (clear === c.blocks.length ? " tile-clear" : "") +
              (pick === c.id ? " pick" : "")}>
              <div className="t-top">
                <button className="t-h" onClick={() => setPick(pick === c.id ? null : c.id)}>
                  <span className="tile-n">{i + 1}</span>
                  <span className="tile-b">
                    <span className="tile-t">{c.name}</span>
                    <span className="tile-s">
                      {c.note}　／　{c.blocks.length} ブロック・過去問 {cardCount(c)} 問
                    </span>
                  </span>
                </button>
                {clear === c.blocks.length ? <span className="badge badge-gold">🏅</span>
                  : <span className="trow-p">{ready.length} / {c.blocks.length} できています</span>}
              </div>
              {pick === c.id && (
                <div className="t-go">
                  <button className="go" onClick={() => go(c.id, "practice")}>練習をする</button>
                  <button className="go" onClick={() => go(c.id, "test")}>テストをする</button>
                </div>
              )}
            </div>
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

/* ── どの分野をやるか選ぶ ───────────────────────
 * 上のタブで分野（ブロック）を選び、中身を見てから、
 * いちばん下のボタンで始める。練習もテストも同じ形。
 */
/* 上のタブ＋中身＋いちばん下のボタン */
function Choose({ cid, kind, bid, prog, setBid, start, back }) {
  const c = CARDS.filter((x) => x.id === cid)[0];
  const block = c.blocks.filter((b) => b.id === bid)[0] || c.blocks[0];
  const isPractice = kind === "practice";
  const st = prog.blocks[block.id] || {};
  const G = engine(block.id);
  const bs = G && G.kind === "rules" ? G.blocks() : [];
  const chunks = testChunks(block.id);
  const spec = G ? G.spec : null;
  const ready = isReady(block.id);
  const canGo = isPractice ? (bs.length > 0 || (ready && !G)) : chunks.length > 0;

  let nextRound = 0;
  for (let i = 0; i < chunks.length; i++) {
    const r = (st.rounds || {})[STORE.setKey(chunks[i])] || {};
    if (!r.passed) { nextRound = i; break; }
  }

  return (
    <>
      <div className="wrap has-dock">
        <div className="head">
          <button className="back" onClick={back}>← もどる</button>
          <span className="head-t">
            {cardNo(cid)} {c.name}　{isPractice ? "練習" : "テスト"}
          </span>
          {st.badge && <span className="head-n">🏅</span>}
        </div>

        <div className="sec">
          <span className="sec-l">どの分野をやりますか</span>
        </div>
        <div className="tabs">
          {c.blocks.map((b) => (
            <button key={b.id}
              className={"tab" + (b.id === block.id ? " on" : "") + (isReady(b.id) ? "" : " tab-yet")}
              onClick={() => setBid(b.id)}>
              <span className="tab-n">{blockNo(cid, b.id)}</span>
              {b.name}
            </button>
          ))}
        </div>

        {!ready ? (
          <>
            <div className="sec">
              <span className="sec-l">ここに入る問題</span>
              <div className="brief-t">過去問 {block.n} 問</div>
              <div className="brief-b">{c.note}。</div>
            </div>
            <div className="sec">
              <span className="sec-l">まだできていないこと</span>
              <div className="brief-b">
                この題材の「見る所」と「決め方」を、過去問と解説から起こす作業がこれからです。
                できると、ほかの分野と同じように、練習で覚えてからテストに進めます。
              </div>
            </div>
          </>
        ) : isPractice ? (
          <>
            <div className="sec">
              <span className="sec-l">この分野でやること</span>
              <div className="brief-b">
                {spec ? spec.note + "。決め手は決まった所にあります。上から順に見ていって、当たったところで答えが決まります。"
                      : c.note + "。1問ずつ出します。間違えたら、正解するまでやり直します。"}
              </div>
            </div>
            {bs.length > 0 && (
              <div className="sec">
                <span className="sec-l">見る順番（上から一個ずつ覚えます）</span>
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
              <span className="sec-l">練習の中身</span>
              <div className="brief-b">
                {bs.length > 0
                  ? "見る所ごとに、覚える1枚とその所の問題2問。最後に、出力ぜんぶで判定する問題が3問あります。"
                  : bank(block.id).length + " 問を、順番を混ぜて1問ずつ出します。点は付きません。"}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="sec">
              <span className="sec-l">テストの中身</span>
              <div className="brief-b">
                この分野で覚えた所が、そのままテストの範囲です。
                過去問 {bank(block.id).length} 問を {chunks.length} 回に分けてあります。
                1問まで間違えても、その回に印が付きます。
              </div>
              {spec && spec.dropped && spec.dropped.length > 0 && (
                <div className="brief-b">
                  この題材の図表問題は全部で {bank(block.id).length + spec.dropped.length} 問ありますが、
                  {spec.dropped.length} 問は本の答えが出力と食い違うため外しています。
                </div>
              )}
            </div>
            {chunks.map((ch, i) => {
              const r = (st.rounds || {})[STORE.setKey(ch)] || {};
              return (
                <button className="trow" key={i} onClick={() => start("test:" + i)}>
                  <span className="trow-n">{i + 1}</span>
                  <span className="trow-b">
                    <span className="trow-t">テスト {i + 1}</span>
                    <span className="trow-s">{ch.length} 問　{ch[0].qid} 〜 {ch[ch.length - 1].qid}</span>
                  </span>
                  {r.passed ? <span className="badge badge-gold">🏅</span>
                    : r.best !== null && r.best !== undefined
                      ? <span className="trow-p">{r.best} / {ch.length}</span>
                    : <span className="trow-p trow-yet">まだ</span>}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* いちばん下の段。本文をどこまで送っても、ここは動かない */}
      <div className="dock">
        <button className="go next" disabled={!canGo}
          onClick={() => start(isPractice ? "practice" : "test:" + nextRound)}>
          {isPractice ? "この分野を練習する" : "テスト " + (nextRound + 1) + " を受ける"}
        </button>
      </div>
    </>
  );
}

/* ── 一問一答 ────────────────────────── */
function Drill({ bid, mode, prog, setProg, back }) {
  const { block } = blockOf(bid);
  const G = engine(bid);
  const ci = mode.indexOf("test:") === 0 ? parseInt(mode.slice(5), 10) : -1;
  const isTest = ci >= 0;
  const [plan] = useState(() => (isTest ? makeTest(bid, ci) : makePractice(G, bid)));
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState(null);   // 決まった時に押したもの（間違いのときだけ入る）
  const [got, setGot] = useState([]);           // 当たった選択肢（答えが2つ以上のとき積む）
  const [done, setDone] = useState(false);      // その問題の答え合わせが出ているか
  const [firstOk, setFirstOk] = useState(null);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(0);
  const [end, setEnd] = useState(false);
  /* ためる1件。**練習もテストも同じ形。**問題ごとに足していく */
  const at0 = useRef(Date.now());
  const rec = useRef(null);
  if (rec.current === null) {
    const qn = plan.filter((x) => x.kind !== "learn").length;
    rec.current = STORE.start({
      version: dataVersion(), block: bid, mode: isTest ? "test" : "practice",
      /* 出題範囲。作った問題は範囲という考えが無いので "generated" */
      set: isTest ? STORE.setKey(testChunks(bid)[ci])
        : (G && G.kind === "rules" ? "generated" : STORE.setKey(bank(bid) || [])),
      of: qn, passLine: passLine(qn)
    });
  }
  const tries = useRef(0);
  const it = plan[at];
  const rights = it ? (Array.isArray(it.right) ? it.right : [it.right]) : [];
  const ok = done && picked === null;
  const cram = !isTest;

  /* 次の問題・結果の画面に移ったら、上から見せる */
  useEffect(() => { toTop(); }, [at, end]);

  function choose(o) {
    if (done) return;
    tries.current += 1;
    if (rights.indexOf(o) >= 0) {
      if (got.indexOf(o) >= 0) return;
      const g = got.concat([o]);
      setGot(g);
      if (g.length >= rights.length) {      // ぜんぶ当てた
        setDone(true);
        if (firstOk === null) {
          setFirstOk(true); setAsked(asked + 1); setScore(score + 1);
          writeAnswer(true, g);
        }
      }
      return;
    }
    setPicked(o); setDone(true);
    if (firstOk === null) { setFirstOk(false); setAsked(asked + 1); writeAnswer(false, got.concat([o])); }
  }

  /* その1問の結果を書きとめる。**点になるのは最初の答え** */
  function writeAnswer(ok, picked) {
    STORE.answer(rec.current, {
      no: rec.current.answers.length + 1,
      kind: it.kind,
      qid: it.note ? it.note.qid : null,
      spot: it.kind === "step" ? it.extra.step.look.join(" と ") : null,
      firstOk: ok, tries: tries.current,
      picked: picked, right: rights,
      ms: Date.now() - at0.current
    });
    at0.current = Date.now();
  }
  /* やり直しは問題が上に出直すので、こちらも上へ戻す */
  function retry() { setPicked(null); setGot([]); setDone(false); toTop(); }
  function next() {
    if (at + 1 >= plan.length) {
      /* 1回ぶんを、そのまま1件ためる（のちにサーバへ送るのと同じ形） */
      STORE.add(STORE.finish(rec.current));
      setProg(loadState()); setEnd(true); return;
    }
    setAt(at + 1); setPicked(null); setGot([]); setDone(false); setFirstOk(null);
    tries.current = 0; at0.current = Date.now();
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
    const need = rec.current.passLine;
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
    const lb = it.extra.block, li = it.extra.i, lof = it.extra.of;
    return (
      <div className="wrap">
        <div className="head">
          <button className="back" onClick={back}>← もどる</button>
          <span className="head-t">見る所　{li + 1} / {lof}</span>
          <span className="head-n">{at + 1} / {plan.length}</span>
        </div>
        <div className="bar"><div className="bar-in" style={{ width: (at / plan.length * 100) + "%" }} /></div>

        <div className="sec">
          <span className="sec-l">{li + 1} 番目に見る所</span>
          <div className="brief-t">{lb.name}</div>
        </div>
        <div className="sec">
          <span className="sec-l">何を表すか</span>
          {lb.spots.map((s, i) => (
            <div className="brief-r" key={i}>
              <span className="brief-k">{s.name}</span>
              <span className="brief-v">{s.mean}</span>
            </div>
          ))}
        </div>
        <div className="sec">
          <span className="sec-l">どう使うか</span>
          {lb.spots.map((s, i) => <div className="brief-b" key={i}>{s.use}</div>)}
        </div>
        <div className="sec">
          <span className="sec-l">ここで決まるとき</span>
          {lb.cond.map((c, i) => (
            <div className="brief-r" key={i}>
              <span className="brief-k">もし</span>
              <span className="brief-v">{c}</span>
            </div>
          ))}
          <div className="brief-r">
            <span className="brief-k">なら</span>
            <span className="brief-v brief-hit">{lb.verdict}</span>
          </div>
          <div className="gloss">{G.gloss(lb.verdict)}</div>
          <div className="brief-b">
            {li + 1 < lof ? "決まらなければ、次の所を見ます。" : "ここまでで決まらないときの、最後の所です。"}
          </div>
        </div>
        <button className="go" onClick={next}>この所の問題へ（Enter）</button>
      </div>
    );
  }

  /* **kind で場合分けしない。**あるものを出すだけ */
  const exv = exValue(it.exhibit);
  const hitWords = it.kind === "step" ? it.extra.step.look
    : (done && G && exv ? (G.judge(G.read(exv)) || {}).look : null);
  const con = (
    <>
      {it.image ? <Scan image={it.image} alt={it.note ? it.note.qid : ""} />
        : it.exhibit && it.exhibit.kind === "topology" ? <Figure fig={it.exhibit.fig} />
        : it.exhibit ? <Console text={it.exhibit.text} hits={hitWords} /> : null}
      {/* 図の下に MACアドレスの一覧が別に刷られている問題。
          これが無いと、選択肢が SW1〜SW4 だけの問題は解けない */}
      {it.extra.maclist && <MacList sw={it.extra.sw} />}
    </>
  );
  const vals = it.kind === "step" ? (
    <div className="vals">
      {it.extra.step.values.map((v, i) => (
        <div className="val" key={i}>
          <span className="val-k">{v.name}</span>
          <span className="val-v">{v.value}</span>
        </div>
      ))}
    </div>
  ) : null;
  let ask = it.ask || "";
  /* 問題文が自分で「2つ選択」と言っているときは、重ねて書かない */
  if (rights.length > 1 && !/つ選|選択して/.test(ask)) {
    ask = ask + "（" + rights.length + "つ選びます）";
  }

  let note = null;
  if (done) {
    if (it.kind === "step") {
      const st = it.extra.step;
      note = <Note title={it.right[0]} body={st.why}
        gloss={st.hit ? G.gloss(st.verdict) : ""} />;
    } else {
      note = (
        <>
          {/* 紙面の図はかすれていることがある。答え合わせでは、読み取った中身も出す */}
          {it.image && it.exhibit && it.exhibit.kind === "topology" &&
            <Figure fig={it.exhibit.fig} />}
          <Steps t={G && exv ? G.trace(exv) : null}
            answer={it.note ? rights.join(" ／ ") : null}
            book={it.note ? it.note.explanation : null} />
        </>
      );
    }
  }

  const head = isTest
    ? "テスト " + (ci + 1)
    : (it.kind === "step" ? "見る所　" + (it.extra.i + 1) + " / " + it.extra.of
       : it.kind === "past" ? "練習" : "ぜんぶ見て判定");

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
      {it.note && <div className="src">{it.note.qid}</div>}
    </div>
  );
}

export default function App() {
  const [prog, setProg] = useState(loadState);
  const [cid, setCid] = useState(null);    // 札
  const [kind, setKind] = useState(null);  // "practice" / "test"
  const [bid, setBid] = useState(null);    // 分野（ブロック）
  const [mode, setMode] = useState(null);  // null=分野を選ぶ / "practice" / "test:N"
  const homeY = useRef(0);
  /* ホームに戻ったときだけ、見ていた所に戻す。ほかは上から */
  useEffect(() => { toTop(cid === null ? homeY.current : 0); }, [cid, kind, bid, mode]);

  if (cid === null) {
    return <Home prog={prog} go={(c, k) => {
      homeY.current = nowY();
      const card = CARDS.filter((x) => x.id === c)[0];
      const first = card.blocks.filter((b) => isReady(b.id))[0] || card.blocks[0];
      setCid(c); setKind(k); setBid(first.id); setMode(null);
    }} />;
  }
  if (mode === null) {
    return <Choose cid={cid} kind={kind} bid={bid} prog={prog}
      setBid={(id) => setBid(id)}
      start={(m) => setMode(m)}
      back={() => { setCid(null); setKind(null); setBid(null); }} />;
  }
  return <Drill bid={bid} mode={mode} prog={prog} setProg={setProg}
    back={() => setMode(null)} />;
}
