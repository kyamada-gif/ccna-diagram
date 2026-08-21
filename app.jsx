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
 * ・間違えたときは lpic-reflex と同じ：正解を見せて、同じ確認項目をもう一度解かせる。
 *   点になるのは最初の答え
 * ・画面の言葉は説明だけ。励ましも呼びかけも書かない
 */

/* 画面が変わったら、いつも上から読み始める。
   **押すたびに自分で上へ戻すのは面倒**なので、こちらで戻す（ipcalc2 と同じ） */
/* 見ている位置。**動くのはページそのものなので、ページの位置を見る。**
   中に別のスクロールを作らないので、ここも1か所で済む */
const nowY = () => (document.scrollingElement || document.documentElement).scrollTop;
const toTop = (y) => { try { window.scrollTo(0, y || 0); } catch (err) {} };

const LETTERS = "ABCDEFGH";

/* ── 札とブロック ────────────────────────────
 * 束B 335問を、問題の型で4枚に分け、その中を題材ごとのブロックに割る。
 * n は、そのブロックに入る過去問の数（できていないブロックは見込み）。
 * できたブロックは questions.js の BANKS に入るので、そちらの数を使う。
 */
const CARDS = [
  { id: "read", name: "出力を読んで当てる",
    note: "出力の値を読み、決まった規則にあてはめて答えを出す",
    blocks: [
      { id: "showint", name: "show interface の障害", n: 17 },
      { id: "json", name: "JSON の読み取り", n: 25 },
      { id: "rootbridge", name: "ルートブリッジの決まり方", n: 23 },
      { id: "ospf", name: "OSPF のとなり関係", n: 7 },
      { id: "ospfdr", name: "OSPF の代表ルータ", n: 2 },
      { id: "log", name: "ログの読み取り", n: 3 }
    ] },
  { id: "words", name: "言葉と意味の組み合わせ",
    note: "説明と用語の対応を覚える",
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
    note: "要件と現在の設定を読み、必要なコマンドを選ぶ",
    blocks: [
      { id: "etherchannel", name: "EtherChannel", n: 20 },
      { id: "trunk", name: "トランクと VLAN", n: 19 },
      { id: "access", name: "機器への入り方", n: 10 },
      { id: "ipsvc", name: "DHCP・NAT・NTP の設定", n: 9 },
      { id: "portsec", name: "ポートの守り", n: 4 }
    ] },
  { id: "misc", name: "そのほか",
    note: "決まった確認項目が立たない、一点ものの問題",
    blocks: [
      { id: "wlangui", name: "無線の画面を読む", n: 13 },
      { id: "nolink", name: "つながらない原因をさがす", n: 5 },
      { id: "misc", name: "そのほか", n: 5 }
    ] }
];

const bank = (id) => (typeof BANKS !== "undefined" && BANKS[id]) || null;
/* 紙面から切り出した提示物。**qid で引く。**問題データには画像を書かない。
   img/index.js（scripts/build_exhibit_images.py が作る）が唯一の置き場所 */
const scanOf = (qid) =>
  (typeof SCANS !== "undefined" && SCANS[String(qid).replace(/#\d+$/, "")]) || null;
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
/* ── 名前の付け方（画面に出る言葉の決まり）──────────────
 * ここに全部まとめる。**画面のあちこちで別々に組み立てない。**
 *
 *   札      「1 出力を読んで当てる」          番号は 1〜4。ホームの小見出しにだけ出る
 *   分野    「1.1 show interface の障害」     番号は 札.分野
 *   やり方  「練習」「テスト」                **テストは分野に1本なので、回の番号は無い**
 */

/* ── 印（バッジ）の決まり ──────────────────────
 * 3つの状態しかない。**画面のどこでも同じ見た目にする。**
 *
 *   まだ    … 一度も受けていない
 *   数字    … 受けたが、まだ届いていない（いちばん良かった点）
 *   🏅      … 届いた
 *
 * **数えるものは分野のバッジ1種類だけ。**
 * 分野は21ある。ホームの上に「n / 21 分野」と出す。
 */
function markOf(r, of) {
  if (!r || r.best === null || r.best === undefined) return { kind: "yet", text: "まだ" };
  if (r.passed) return { kind: "done", text: "🏅" };
  return { kind: "part", text: r.best + " / " + of };
}
/* バッジの置き場。**空の枠を先に見せる。**
   ipcalc2 と同じ形（破線の枠 → バッジが付くと金色の枠に 🏅）。
   途中の点数は、枠の下に小さく添える */
function Mark({ mark, sm }) {
  const cls = "slot" + (sm ? " sm" : "") + (mark.kind === "done" ? " got" : "");
  if (mark.kind === "part") {
    return (
      <span className="slot-w">
        <span className={cls} />
        <span className="slot-n">{mark.text}</span>
      </span>
    );
  }
  return <span className={cls}>{mark.kind === "done" ? "🏅" : ""}</span>;
}
/* 分野の印。テストは分野に1本なので、その1本の結果がそのまま分野の印になる */
function blockMark(st, id) {
  const ch = testChunks(id);
  if (!ch.length) return { kind: "yet", text: "まだ" };
  return markOf((st.rounds || {})[STORE.setKey(ch[0])] || {}, ch[0].length);
}

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
/* 打ったコマンドの行か。**1行目を無条件にコマンド扱いしない。**
   show の出力や設定は「R1#show ip ospf interface」で始まるが、
   JSON の1行目は中身そのもの。コマンド扱いすると色が変わるうえ、
   決め手の行として光らせることもできなくなる */
const isCmd = (line) => /^\S*[#>]\s*\S/.test(line);

/* 行の中の、決め手の言葉だけを光らせる。
   **行ごと光らせると、どこを見ればいいのか分からない。**
   例「コロンの左」なら、その行の "firewall" だけを光らせたい */
function marked(line, marks) {
  if (!marks || !marks.length) return line;
  /* 長い言葉から先に当てる。短い言葉が先だと、長い言葉の一部を先に取ってしまう */
  const ws = marks.slice().sort((a, b) => b.length - a.length);
  const out = [];
  let rest = line, guard = 0;
  while (rest && guard++ < 200) {
    let at = -1, hit = null;
    ws.forEach((w) => {
      if (!w) return;
      const i = rest.indexOf(w);
      if (i >= 0 && (at < 0 || i < at)) { at = i; hit = w; }
    });
    if (at < 0) { out.push(rest); break; }
    if (at > 0) out.push(rest.slice(0, at));
    out.push(<span className="cmark" key={out.length}>{hit}</span>);
    rest = rest.slice(at + hit.length);
  }
  return out;
}

function Console({ text, hits, marks }) {
  const lines = text.split("\n");
  const head = isCmd(lines[0] || "");
  return (
    <pre className="con">
      {lines.map((line, i) => {
        const cmd = i === 0 && head;
        const on = !cmd && hits && hits.some((w) => line.indexOf(w) >= 0);
        return (
          <div key={i} className={"cline" + (cmd ? " ccmd" : "") + (on ? " chit" : "")}>
            {cmd ? line : marked(line, marks)}
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
/* 提示物を1つの形にする。
     文字列        → 出力（そのまま出す）
     src を持つ    → JSON など、**画面に出すのは src だけ**で、
                     判定にはほかの中身（何を聞かれているか）も要るもの
     それ以外      → 図 */
function asExhibit(x) {
  if (x == null) return null;
  if (typeof x === "string") return { kind: "console", text: x };
  if (x.src !== undefined) return { kind: "json", text: x.src, data: x };
  return { kind: "topology", fig: x };
}
/* 書き起こしを「図の段」と「文字の段」に分ける。
 *
 * 提示物の書き起こしは `【ネットワーク図】` `【SW1 の show interface】` のような
 * 見出しで区切ってある。**紙面の画像があるときは、図の段だけを画像に置きかえる。**
 * 文字の段（show出力・設定）は、そのまま画像の下に出す。
 * 見出しが無いもの（出力だけの問題）は、丸ごと文字の段になる。
 */
function splitFigure(text) {
  if (typeof text !== "string" || text.indexOf("【") < 0) return { fig: null, rest: text };
  const lines = text.split("\n");
  const secs = [];
  let cur = { head: "", body: [] };
  lines.forEach((l) => {
    const m = /^【(.+)】\s*$/.exec(l.trim());
    if (m) { if (cur.head || cur.body.length) secs.push(cur); cur = { head: m[1], body: [] }; }
    else cur.body.push(l);
  });
  secs.push(cur);
  /* 「図」だけを画像に譲る。**「画面」の段は文字のまま残す。**
     機器の画面は別の箱に刷られていて、図の切り出しには入らないことがある
     （例 B1-P15-010：ネットワーク図は紙面の画像、HostC の設定画面は文字） */
  const isFig = (h) => /図/.test(h);
  if (!secs.some((s) => isFig(s.head))) return { fig: null, rest: text };
  /* 図の段の中に、見出しを付けずに show出力や設定が続けて書いてあることがある。
     **空行のあとに、機器の合図（R1# など）や設定の言葉が来たら、そこから下は文字。** */
  const looksCode = (l) =>
    /^\S*[#>]\s*\S/.test(l) ||
    /^\s*(interface|switchport|ip\s|no\s|encapsulation|channel-group|router\s|vlan\s|line\s|username|hostname|spanning-tree|standby|access-list)\b/.test(l) ||
    /^\.\.\.$/.test(l.trim());
  const cut = (body) => {
    for (let i = 1; i < body.length; i++) {
      if (body[i - 1].trim() !== "") continue;
      let j = i;
      while (j < body.length && body[j].trim() === "") j++;
      if (j < body.length && looksCode(body[j])) return [body.slice(0, i), body.slice(j)];
    }
    return [body, []];
  };
  const figPart = [], textPart = [];
  secs.forEach((s) => {
    if (isFig(s.head)) {
      const [f, t] = cut(s.body);
      figPart.push(f.join("\n"));
      if (t.length) textPart.push(t.join("\n"));
    } else {
      textPart.push((s.head ? "【" + s.head + "】\n" : "") + s.body.join("\n"));
    }
  });
  const rest = textPart.join("\n").replace(/^\n+|\n+$/g, "");
  return { fig: figPart.join("\n").trim(), rest: rest || null };
}

/* 判定エンジンに渡す中身を取り出す。**画面に出すものとは限らない** */
function exValue(ex) {
  if (!ex) return null;
  if (ex.kind === "console") return ex.text;
  if (ex.kind === "json") return ex.data;
  return ex.fig;
}

/* ── 練習を組む ───────────────────────────
 * 見る所の表を、上から一個ずつ。
 *   ① その見る所を覚える（説明の札）
 *   ② 決まるとき / 決まらないとき の2問
 * 最後に、提示物ぜんぶで判定を3問。
 */
/* 1つの確認項目につき、問題を何問出すか。
   **分野ごとに変えられる。**指定が無ければ2問（いままでどおり） */
function perSpot(G) {
  const n = G && G.spec && G.spec.perSpot;
  return n > 0 ? n : 2;
}
/* 説明の1枚に出す見本。**分野が用意しているときだけ出す。**
   出力のどこを見るかは、文字の説明より現物を見せたほうが早い */
function learnEx(G, block, i) {
  if (!G || !G.spec || typeof G.spec.learnEx !== "function") return null;
  return asExhibit(G.spec.learnEx(block, i));
}

function makePractice(G, id) {
  /* **エンジンが無いブロックは、まだ練習が作れない。**
     ここで過去問を出してしまうと「練習＝テストと同じ問題」になる。
     決まりは「テストは本の問題、練習は生成問題」。混ぜない */
  if (!G) return [];
  /* 練習の始めに1回だけ呼ぶ。**同じ提示物を練習の間ずっと使う分野**が、
     ここで1つ作って持っておく（指定が無ければ何も起きない） */
  if (G.begin) G.begin();
  const bs = G.blocks();
  const out = [];
  const per = perSpot(G);
  bs.forEach((b, i) => {
    out.push(item({ kind: "learn", exhibit: learnEx(G, b, i),
      extra: { block: b, i: i, of: bs.length } }));
    /* その確認項目の問題。**組み立てるのはエンジン側**（画面では作らない） */
    for (let n = 0; n < per; n++) {
      const q = G.stepQ(i, n);
      if (!q) continue;
      out.push(item({ kind: q.kind, ask: q.ask, exhibit: asExhibit(q.exhibit),
        opts: q.opts, right: q.right,
        extra: Object.assign({}, q.extra, { i: q.extra.i, of: bs.length }) }));
    }
  });
  for (let k = 0; k < 3; k++) {
    const q = G.wholeQ();
    if (!q) continue;
    out.push(item({ kind: q.kind, ask: q.ask, exhibit: asExhibit(q.exhibit),
      opts: q.opts, right: q.right,
      extra: Object.assign({}, q.extra, { i: bs.length, of: bs.length }) }));
  }
  return out;
}

/* ── 間違えた確認項目だけを、もう一度 ──────────────
 * 練習の記録には、どの確認項目でつまずいたかが残っている（answers[].spot）。
 * その項目だけを取り出して、短い練習を組み直す。
 * **問題は作り直すので、同じ問題は出ない。**
 */
function makeReview(G, idx) {
  if (!G || !idx.length) return [];
  if (G.begin) G.begin();
  const bs = G.blocks();
  const out = [];
  const per = perSpot(G);
  idx.forEach((i) => {
    if (!bs[i]) return;
    out.push(item({ kind: "learn", exhibit: learnEx(G, bs[i], i),
      extra: { block: bs[i], i: i, of: bs.length } }));
    for (let n = 0; n < per; n++) {
      const q = G.stepQ(i, n);
      if (!q) continue;
      out.push(item({ kind: q.kind, ask: q.ask, exhibit: asExhibit(q.exhibit),
        opts: q.opts, right: q.right,
        extra: Object.assign({}, q.extra, { i: q.extra.i, of: bs.length }) }));
    }
  });
  return out;
}

/* そのブロックのテストを回に分ける。**どの問題も、必ずどれか1つの回に入る。**
 * 余りが 5 問より少ないときは、最後の回に足す（31問なら 10 / 10 / 11）。
 */
function testChunks(id) {
  const qs = bank(id);
  if (!qs || !qs.length) return [];
  return [qs.slice().sort(function (a, b) {
    return a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0;
  })];
}

/* バッジが付く線は9割。**例外を作らない。**
   例：10問なら9問、38問なら35問。
   9問までの分野は、計算すると満点が必要になる（オーナーの判断でそのまま） */
function passLine(len) { return Math.ceil(len * 0.9); }

/* 過去問1問を、画面が読む形にする */
function asPast(q) {
  /* 左と右を結ぶ問題。**本の1問のまま出す。**
     正解は「説明 → 入れ先」の並び。ためる1件の形を変えずに済むよう、
     ほかの問題と同じ「文字列の配列」にそろえる */
  if (q.pairs) {
    return item({
      kind: "match", ask: q.text,
      exhibit: null, image: scanOf(q.qid),
      opts: q.targets,
      right: q.pairs.map((p) => p.l + " → " + p.r),
      extra: { pairs: q.pairs, targets: q.targets },
      note: { qid: q.qid, book: q.book, explanation: q.explanation }
    });
  }
  /* 紙面の画像があるときは、書き起こしの「図の段」を画像に譲る。
     文字の段（show出力・設定）は画像の下に残す。**同じ中身を二度出さない。**
       covers="all" … 図と出力が同じ箱に入っている → 書き起こしは出さない
       covers="fig" … 図だけ                    → 文字の段だけ残す */
  const scan = scanOf(q.qid);
  let ex = q.fig || q.exhibit || null;
  if (scan && typeof ex === "string") {
    ex = scan.covers === "all" ? null : splitFigure(ex).rest;
  }
  return item({
    kind: "past", ask: q.text,
    exhibit: asExhibit(ex),
    image: scan,
    opts: q.choices, right: q.answer,
    extra: { maclist: !!(q.fig && q.fig.maclist), sw: q.fig ? q.fig.sw : null },
    note: { qid: q.qid, book: q.book, explanation: q.explanation }
  });
}

/* 判定エンジンが無い分野でも混ぜられるように */
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
/* ── ホーム ───────────────────────────────
 * **この1枚に全部ある。**分野を選ぶための画面は作らない。
 * 21の分野が縦に並び、行を押すとその場で開いて
 * 「練習をする」「テストをする」が出る。開くのは1行だけ。
 * 4つの札は、押せない小見出しとして行のかたまりを区切るだけ。
 */
function Home({ prog, go, open, setOpen }) {
  const allBlocks = CARDS.reduce((a, c) => a.concat(c.blocks), []);
  const doneB = allBlocks.filter((b) =>
    blockMark(prog.blocks[b.id] || {}, b.id).kind === "done").length;

  return (
    <div className="wrap">
      <div className="hero">
        <div className="hero-t">計算なしの図表問題</div>
        <div className="hero-n">出力・図・画面を見て答える問題を、型ごとに覚える</div>
        <div className="bar">
          <div className="bar-in" style={{ width: (doneB / allBlocks.length * 100) + "%" }} />
        </div>
        <div className="hero-n">🏅 {doneB} / {allBlocks.length} 分野</div>
      </div>

      {CARDS.map((c, ci) => (
        <div className="grp" key={c.id}>
          <div className="grp-h">
            <span className="grp-n">{ci + 1}</span>
            <span className="grp-b">
              <span className="grp-t">{c.name}</span>
              <span className="grp-s">{c.note}</span>
            </span>
          </div>

          {c.blocks.map((b) => {
            const on = open === b.id;
            const ready = isReady(b.id);
            const mark = blockMark(prog.blocks[b.id] || {}, b.id);
            const n = bank(b.id) ? bank(b.id).length : b.n;
            const G = engine(b.id);
            const bs = G ? G.blocks() : [];
            return (
              <div className={"row" + (on ? " row-on" : "") + (ready ? "" : " row-yet")} key={b.id}>
                <button className="row-h" onClick={() => setOpen(on ? null : b.id)}
                  aria-expanded={on}>
                  <span className="row-n">{blockNo(c.id, b.id)}</span>
                  <span className="row-b">
                    <span className="row-t">{b.name}</span>
                    <span className="row-s">本の問題 {n} 問</span>
                  </span>
                  <Mark mark={mark} sm />
                  <span className={"row-v" + (on ? " row-v-on" : "")}>▾</span>
                </button>

                {on && (
                  <div className="row-p">
                    {ready ? (
                      /* **説明は書かない。**押せば分かることを、押す前に読ませない */
                      <div className="row-go">
                        <button className="go next" disabled={bs.length === 0}
                          onClick={() => go(b.id, "practice")}>練習をする</button>
                        <button className="go ghost"
                          onClick={() => go(b.id, "test:0")}>テストを受ける</button>
                      </div>
                    ) : (
                      <div className="row-d">
                        この分野の「確認項目」と「決め方」を、本の問題と解説から書き起こす作業がこれからです。
                        できると、ほかの分野と同じように、練習で覚えてからテストに進めます。
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div className="legend">
        <span className="slot got">🏅</span>
        <span className="legend-t">
          バッジは分野ごとに1つ。その分野のテストで9割正解すると付きます。
        </span>
      </div>

      <div className="foot">
        計算のいらない図表問題は、本で 335 問あります。
        どの問題も、必ずどれかの分野に入ります。
        テストに出るのは、本に載っている問題そのものです。
        練習は、それを解けるようになるためのものです。
      </div>

      <button className="wipe" onClick={() => {
        if (window.confirm("これまでの記録をすべて消します。よろしいですか。")) {
          STORE.wipe();
          window.location.reload();
        }
      }}>記録を消す</button>
    </div>
  );
}

/* ── 左と右を結ぶ問題 ─────────────────────
 * 上に説明の札、下に入れ先。**説明を押してから、入れ先を押す。**
 * 引っぱって落とす形にしないのは、小さい画面で押し間違えるため。
 * 答え合わせのあとは、合った組に✓、違った組に✕と正しい入れ先を出す。
 */
function Match({ pairs, targets, put, hold, done, onCard, onTarget }) {
  return (
    <div className="mt">
      <div className="mt-cards">
        {pairs.map((p, i) => {
          const at = put[i];
          const right = done && at === p.r;
          let cls = "mt-card";
          if (done) cls += right ? " mt-ok" : " mt-ng";
          else if (hold === i) cls += " mt-hold";
          else if (at !== undefined) cls += " mt-set";
          return (
            <button key={i} className={cls} disabled={done} onClick={() => onCard(i)}>
              <span className="mt-l">{p.l}</span>
              {at !== undefined && <span className="mt-at">{at}</span>}
              {done && (right
                ? <span className="mt-m">✓</span>
                : <span className="mt-m">✕　正しくは {p.r}</span>)}
            </button>
          );
        })}
      </div>
      <div className="mt-targets">
        {targets.map((t, i) => (
          <button key={i} className={"mt-t" + (hold !== null ? " mt-t-on" : "")}
            disabled={done || hold === null} onClick={() => onTarget(t)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── 一問一答 ────────────────────────── */
function Drill({ bid, mode, prog, setProg, back, goTest, goNext }) {
  const { block } = blockOf(bid);
  const chunks = testChunks(bid);
  const G = engine(bid);
  const ci = mode.indexOf("test:") === 0 ? parseInt(mode.slice(5), 10) : -1;
  const isTest = ci >= 0;
  const [plan, setPlan] = useState(() => (isTest ? makeTest(bid, ci) : makePractice(G, bid)));
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState(null);   // 決まった時に押したもの（間違いのときだけ入る）
  const [got, setGot] = useState([]);           // 当たった選択肢（答えが2つ以上のとき積む）
  /* 結ぶ問題だけが使う。説明の番号 → 用語の名前。まだ入れていない説明は入らない */
  const [put, setPut] = useState({});
  const [hold, setHold] = useState(null);       // いま持ち上げている説明の番号
  const [done, setDone] = useState(false);      // その問題の答え合わせが出ているか
  const [firstOk, setFirstOk] = useState(null);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(0);
  const [end, setEnd] = useState(false);
  /* この回が「間違えた確認項目だけの回」かどうか。結果の説明文を変えるために持つ */
  const [again, setAgain] = useState(false);
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
      /* どの確認項目でつまずいたかを残す。あとで、そこだけ練習し直すために使う。
         対応づけは look を持たないので、その用語の名前を入れる */
      spot: it.kind === "step"
        ? (it.extra.step.look.length ? it.extra.step.look.join(" と ")
           : ((G.blocks()[it.extra.i] || {}).name || null))
        : null,
      spotNo: it.kind === "step" ? it.extra.i : null,
      firstOk: ok, tries: tries.current,
      picked: picked, right: rights,
      ms: Date.now() - at0.current
    });
    at0.current = Date.now();
  }
  /* ── 結ぶ問題 ─────────────────────────
   * 説明を押す → 入れ先を押す。もう一度押すと外れる。
   * **ぜんぶ入れてから答え合わせ。全部合って初めて正解**（本の1問＝1点）。
   */
  function tapCard(i) {
    if (done) return;
    if (put[i] !== undefined) { const p = { ...put }; delete p[i]; setPut(p); setHold(null); return; }
    setHold(hold === i ? null : i);
  }
  function tapTarget(t) {
    if (done || hold === null) return;
    setPut({ ...put, [hold]: t });
    setHold(null);
  }
  function grade() {
    if (done) return;
    tries.current += 1;
    const pairs = it.extra.pairs;
    const allOk = pairs.every((p, i) => put[i] === p.r);
    setDone(true);
    if (!allOk) setPicked("×");
    if (firstOk === null) {
      setFirstOk(allOk);
      setAsked(asked + 1);
      if (allOk) setScore(score + 1);
      writeAnswer(allOk, pairs.map((p, i) => p.l + " → " + (put[i] || "（入れていない）")));
    }
  }

  /* やり直しは問題が上に出直すので、こちらも上へ戻す */
  function retry() {
    setPicked(null); setGot([]); setDone(false);
    /* 結ぶ問題は、合っている組だけ残して、違う組を外す */
    if (it && it.kind === "match") {
      const keep = {};
      it.extra.pairs.forEach((p, i) => { if (put[i] === p.r) keep[i] = put[i]; });
      setPut(keep); setHold(null);
    }
    toTop();
  }
  function next() {
    if (at + 1 >= plan.length) {
      /* 1回ぶんを、そのまま1件ためる（のちにサーバへ送るのと同じ形） */
      STORE.add(STORE.finish(rec.current));
      setProg(loadState()); setEnd(true); return;
    }
    setAt(at + 1); setPicked(null); setGot([]); setDone(false); setFirstOk(null);
    setPut({}); setHold(null);
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
        /* 結ぶ問題は押す所が2段あるので、キーでは選べない。Enter で答え合わせだけ */
        if (it.kind === "match") {
          if (e.key === "Enter" && Object.keys(put).length >= it.extra.pairs.length) {
            e.preventDefault(); grade();
          }
          return;
        }
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

  /* 練習の材料が作れない分野（判定エンジンがない）で、空のまま入ったとき */
  if (!plan.length) {
    return (
      <div className="wrap">
        <div className="head">
          <button className="back" onClick={back}>← もどる</button>
          <span className="head-t">{block.name}</span>
        </div>
        <div className="sec">
          <div className="brief-b">この分野の練習は、まだ用意できていません。</div>
        </div>
        <button className="go" onClick={back}>もどる</button>
      </div>
    );
  }

  if (end) {
    const need = rec.current.passLine;
    const passed = isTest && score >= need;
    /* 間違えた確認項目を、記録から拾う。同じ項目は1つにまとめる。
       **名前ではなく番号で引く。**確認項目の名前は、ほかの項目と重なることがある */
    const bs2 = G ? G.blocks() : [];
    const wrong = [];
    (rec.current.answers || []).forEach((a) => {
      if (a.kind !== "step" || a.firstOk) return;
      if (a.spotNo === null || a.spotNo === undefined) return;
      if (bs2[a.spotNo] && wrong.indexOf(a.spotNo) < 0) wrong.push(a.spotNo);
    });
    wrong.sort((x, y) => x - y);
    /* 次の分野（ホームの並び順で、次に来る用意のできた分野） */
    const all = CARDS.reduce((a, c) => a.concat(c.blocks), []).filter((b) => isReady(b.id));
    const at2 = all.map((b) => b.id).indexOf(bid);
    const nextB = at2 >= 0 && at2 + 1 < all.length ? all[at2 + 1] : null;

    return (
      <div className="wrap">
        <div className="head">
          <span className="head-t">{isTest ? "テスト" : "練習"}　結果</span>
        </div>

        <div className="sec">
          <div className="brief-t">{score} / {asked} 問</div>
          <div className="brief-b">
            {isTest
              ? (passed ? "この分野にバッジが付きました。"
                        : need + " 問正解でバッジが付きます。あと " + (need - score)
                          + " 問です。もう一度受けられます。")
              : again
                ? "間違えた確認項目だけを、もう一度解きました。得点になるのは最初の答えです。"
                : "確認項目を上から順に、すべて通しました。得点になるのは最初の答えです。"}
          </div>
        </div>

        {/* つまずいた確認項目。**そこだけをもう一度やり直せる** */}
        {!isTest && wrong.length > 0 && (
          <div className="sec">
            <span className="sec-l">間違えた確認項目</span>
            {wrong.map((i) => (
              <div className="brief-r" key={i}>
                <span className="brief-k">{i + 1}</span>
                <span className="brief-v">{bs2[i].name}</span>
              </div>
            ))}
            <button className="go ghost" onClick={() => {
              const p2 = makeReview(G, wrong);
              setPlan(p2); setAgain(true);
              setAt(0); setPicked(null); setGot([]); setDone(false); setFirstOk(null);
              setPut({}); setHold(null); setScore(0); setAsked(0); setEnd(false);
              tries.current = 0; at0.current = Date.now();
              const qn = p2.filter((x) => x.kind !== "learn").length;
              rec.current = STORE.start({
                version: dataVersion(), block: bid, mode: "practice",
                set: "generated", of: qn, passLine: passLine(qn)
              });
              toTop();
            }}>この {wrong.length} 項目だけ、もう一度解く</button>
          </div>
        )}

        <div className="dock">
          {!isTest && (
            <button className="go next" onClick={goTest}>この分野のテストを受ける</button>
          )}
          {isTest && passed && nextB && (
            <button className="go next" onClick={() => goNext(nextB.id)}>
              次の分野（{nextB.name}）へ
            </button>
          )}
          {isTest && !passed && (
            <button className="go next" onClick={() => {
              setPlan(makeTest(bid, ci));
              setAt(0); setPicked(null); setGot([]); setDone(false); setFirstOk(null);
              setPut({}); setHold(null); setScore(0); setAsked(0); setEnd(false);
              tries.current = 0; at0.current = Date.now();
              rec.current = STORE.start({
                version: dataVersion(), block: bid, mode: "test",
                set: STORE.setKey(testChunks(bid)[ci]),
                of: chunks[ci].length, passLine: passLine(chunks[ci].length)
              });
              toTop();
            }}>もう一度受ける</button>
          )}
          <button className="go ghost" onClick={back}>ホームへ</button>
        </div>
      </div>
    );
  }

  /* 決め手の行を光らせるための言葉。
     **確認項目の日本語名は、出力の中には書かれていない。**
     例「エリアの番号」は出力に無く、実際に書いてあるのは Internet address の行。
     そこで、分野が hits() を持っていれば、名前を「出力に実際にある文字」に置きかえる。
     持っていない分野は、いままでどおり名前のまま当てる */
  /* 行の中で光らせる言葉。分野が marks() を持っていれば使う。
     持っていなければ何も光らせない（いままでどおり） */
  const toMarks = (look) => {
    if (!look || !look.length) return null;
    if (!G || !G.spec || typeof G.spec.marks !== "function") return null;
    return look.reduce((a, w) => a.concat(G.spec.marks(w) || []), []);
  };
  const toHits = (look) => {
    if (!look || !look.length) return look;
    if (!G || !G.spec || typeof G.spec.hits !== "function") return look;
    return look.reduce((a, w) => a.concat(G.spec.hits(w) || [w]), []);
  };

  /* 確認項目の説明 */
  if (it.kind === "learn") {
    const lb = it.extra.block, li = it.extra.i, lof = it.extra.of;
    return (
      <div className="wrap">
        <div className="head">
          <button className="back" onClick={back}>← もどる</button>
          <span className="head-t">
            {G.kind === "match" ? "覚える用語　" : "確認項目　"}{li + 1} / {lof}</span>
          <span className="head-n">{at + 1} / {plan.length}</span>
        </div>
        <div className="bar"><div className="bar-in" style={{ width: (at / plan.length * 100) + "%" }} /></div>

        <div className="sec">
          <span className="sec-l">{G.kind === "match"
            ? (li + 1) + " 番目に覚える用語" : (li + 1) + " 番目の確認項目"}</span>
          <div className="brief-t">{lb.name}</div>
        </div>

        {/* 見本の出力。**どこを見るかは、文字で説明するより現物のほうが早い。**
            決め手の行は光らせる。用意していない分野では何も出ない（いままでどおり） */}
        {it.exhibit && (
          <div className="sec">
            <span className="sec-l">どこに書いてあるか</span>
            {it.exhibit.image && <Scan image={it.exhibit.image} alt={lb.name} />}
            {it.exhibit.text
              ? <Console text={it.exhibit.text} hits={toHits(lb.look)}
                          marks={toMarks(lb.look)} /> : null}
          </div>
        )}
        {/* 対応づけは、規則ではなく覚えるもの。
            **説明はこちらで書かない。**本に載っている対をそのまま並べる */}
        {G.kind === "match" ? (
          <>
            <div className="sec">
              <span className="sec-l">この用語に当てはまる説明（過去問から）</span>
              {/* 用語の名前は上の見出しに出ているので、ここは説明だけ並べる */}
              {lb.learn.map((p, i) => (
                <div className="brief-r" key={i}>
                  <span className="brief-k">{i + 1}</span>
                  <span className="brief-v">{p.l}</span>
                </div>
              ))}
            </div>
            <div className="sec">
              <span className="sec-l">どう使うか</span>
              <div className="brief-b">
                ここに挙げた {lb.learn.length} 個の説明は、いずれも「{lb.name}」を指しています。
                {li + 1 < lof ? "次の用語へ進みます。" : "これが最後の用語です。"}
              </div>
            </div>
          </>
        ) : (
        <>
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
            {li + 1 < lof
              ? "ここで決まらなければ、次の確認項目へ進みます。"
              : "ここまでで決まらなかったときに見る、最後の確認項目です。"}
          </div>
        </div>
        </>
        )}
        <button className="go" onClick={next}>この確認項目の問題へ（Enter）</button>
      </div>
    );
  }

  /* **kind で場合分けしない。**あるものを出すだけ */
  const exv = exValue(it.exhibit);
  /* 問題の画面で光らせる所。
     **確認項目の名前ではなく、その問題が実際に聞いている所を光らせる。**
     「IDS は何を表しますか」なら、光らせるのは IDS だけ。
     確認項目の名前（コロンの左）から引くと、キーを全部光らせてしまう。
     focus() を持たない分野は、いままでどおり確認項目の名前から引く */
  const look = it.kind === "step" ? it.extra.step.look
    : (done && G && exv ? (G.judge(G.read(exv)) || {}).look : null);
  const focus = (G && G.spec && typeof G.spec.focus === "function" && exv
    && (it.kind === "step" || done)) ? G.spec.focus(G.read(exv)) : null;
  const hitWords = focus ? focus.hits : toHits(look);
  const markWords = focus ? focus.marks : toMarks(look);
  const con = (
    <>
      {/* **画像と文字は、両方出せる。**
          紙面の画像があればまず画像。文字の提示物（show出力・設定・JSON）は
          その下に続けて出す。図の書き起こしは、画像があるほうに譲ってある（asPast） */}
      {it.image && <Scan image={it.image} alt={it.note ? it.note.qid : ""} />}
      {!it.image && it.exhibit && it.exhibit.kind === "topology"
        ? <Figure fig={it.exhibit.fig} />
        : it.exhibit && it.exhibit.kind !== "topology"
          ? <Console text={it.exhibit.text} hits={hitWords} marks={markWords} /> : null}
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
  /* 結ぶ問題は「いくつ選ぶ」ではないので、この一言を足さない */
  if (it.kind !== "match" && rights.length > 1 && !/つ選|選択して/.test(ask)) {
    ask = ask + "（" + rights.length + "つ選びます）";
  }

  let note = null;
  if (done) {
    if (it.kind === "step") {
      const st = it.extra.step;
      note = <Note title={it.right[0]} body={st.why}
        gloss={st.hit ? G.gloss(st.verdict) : ""} />;
    } else {
      note = it.kind === "match" ? (
        /* 結ぶ問題の答えは、1本の長い行にしない。**組ごとに1行**にする */
        <div className="note">
          <div className="note-t">正しい組み合わせ</div>
          <div className="mt-ans">
            {it.extra.pairs.map((p, i) => (
              <div className="mt-ans-r" key={i}>
                <span className="mt-ans-k">{p.r}</span>
                <span className="mt-ans-v">{p.l}</span>
              </div>
            ))}
          </div>
          {it.note && it.note.explanation &&
            <div className="note-b">本の解説：{it.note.explanation.slice(0, 150)}</div>}
        </div>
      ) : (
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

  const isMatchG = G && G.kind === "match";
  const head = isTest
    ? "テスト"
    : (it.kind === "step"
        ? (isMatchG ? "覚える用語　" : "確認項目　") + (it.extra.i + 1) + " / " + it.extra.of
        : it.kind === "past" ? "練習"
        : isMatchG ? "覚えた組み合わせで" : "ぜんぶ見て判定");

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

      {it.kind === "match" ? (
        <Match pairs={it.extra.pairs} targets={it.extra.targets}
          put={put} hold={hold} done={done}
          onCard={tapCard} onTarget={tapTarget} />
      ) : (
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
      )}

      {note}

      {it.kind === "match" && !done ? (
        <>
          <button className="go" onClick={grade}
            disabled={Object.keys(put).length < it.extra.pairs.length}>
            答え合わせ（Enter）
          </button>
          <div className="src">
            {hold === null
              ? "説明を押してから、入れる先を押します"
              : "入れる先を押します。もう一度説明を押すと外れます"}
            {"　／　あと " + (it.extra.pairs.length - Object.keys(put).length) + " つ"}
          </div>
        </>
      ) : !done ? (
        <div className="src">
          A〜{LETTERS[it.opts.length - 1]} か 1〜{it.opts.length} のキーでも選べます
          {rights.length > 1 && got.length > 0 && "　／　あと " + (rights.length - got.length) + " つ"}
        </div>
      ) : (cram && !ok) ? (
        <button className="go go-retry" onClick={retry}>同じ確認項目を、もう一度解く（Enter）</button>
      ) : (
        <button className="go" onClick={next}>
          {at + 1 >= plan.length ? "結果を見る（Enter）" : "次へ（Enter）"}
        </button>
      )}
      {it.note && <div className="src">{it.note.qid}</div>}
    </div>
  );
}

/* ── 画面は2つだけ ─────────────────────────
 * ホーム（分野の一覧）と、練習・テストの画面。
 * **その間に「選ぶ画面」を置かない。**
 * 分野は、ホームの行を開いて出てくるボタンから直接はじまる。
 */
export default function App() {
  const [prog, setProg] = useState(loadState);
  const [bid, setBid] = useState(null);    // いまやっている分野
  const [mode, setMode] = useState(null);  // null=ホーム / "practice" / "test:0"
  const [open, setOpen] = useState(null);  // ホームで開いている行
  const homeY = useRef(0);
  /* ホームに戻ったときだけ、見ていた所に戻す。ほかは上から */
  useEffect(() => { toTop(mode === null ? homeY.current : 0); }, [bid, mode]);

  if (mode === null) {
    return <Home prog={prog} open={open} setOpen={setOpen}
      go={(id, m) => { homeY.current = nowY(); setBid(id); setMode(m); }} />;
  }
  /* key に分野とやり方を入れて、別のものへ移ったときに作り直す。
     こうしないと、前の問題と点数がそのまま残る */
  return <Drill key={bid + "/" + mode} bid={bid} mode={mode} prog={prog} setProg={setProg}
    back={() => { setOpen(bid); setMode(null); }}
    /* 練習が終わったら、そのままテストへ進めるようにする。
       いちどホームまで戻らせない */
    goTest={() => setMode("test:0")}
    /* 次の分野へ。ホームに戻し、その行を開いた状態で見せる */
    goNext={(id) => { homeY.current = 0; setOpen(id); setBid(id); setMode(null); }} />;
}
