/* 自動生成: build.js（app.jsx -> app.js）。手で編集せず app.jsx を直して再ビルド。 */
const { useState, useEffect, useRef } = React;
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
const toTop = y => {
  try {
    window.scrollTo(0, y || 0);
  } catch (err) {}
};
const LETTERS = "ABCDEFGH";

/* ── 札とブロック ────────────────────────────
 * 束B 335問を、問題の型で4枚に分け、その中を題材ごとのブロックに割る。
 * n は、そのブロックに入る過去問の数（できていないブロックは見込み）。
 * できたブロックは questions.js の BANKS に入るので、そちらの数を使う。
 */
const CARDS = [{
  id: "read",
  name: "出力を読んで当てる",
  note: "出力の値を読み、決まった規則にあてはめて答えを出す",
  blocks: [{
    id: "showint",
    name: "show interface の障害",
    n: 31
  }, {
    id: "json",
    name: "JSON の読み取り",
    n: 41
  }, {
    id: "rootbridge",
    name: "ルートブリッジの決まり方",
    n: 23
  }, {
    id: "ospf",
    name: "OSPF のとなり関係",
    n: 7
  }, {
    id: "ospfdr",
    name: "OSPF の代表ルータ",
    n: 2
  }, {
    id: "log",
    name: "ログの読み取り",
    n: 3
  }]
}, {
  id: "words",
  name: "言葉と意味の組み合わせ",
  note: "説明と用語の対応を覚える",
  blocks: [{
    id: "parts",
    name: "ネットワークの部品と役割",
    n: 22
  }, {
    id: "autoword",
    name: "自動化と API の言葉",
    n: 21
  }, {
    id: "ipv6word",
    name: "IPv6 のアドレスの種類",
    n: 19
  }, {
    id: "cable",
    name: "ケーブルの種類",
    n: 18
  }, {
    id: "aaa",
    name: "AAA（認証・認可・記録）",
    n: 15
  }, {
    id: "guardword",
    name: "守りと QoS ほか",
    n: 16
  }, {
    id: "dhcpword",
    name: "DHCP と DNS・NTP・SNMP",
    n: 10
  }]
}, {
  id: "config",
  name: "足りない設定を選ぶ",
  note: "要件と現在の設定を読み、必要なコマンドを選ぶ",
  blocks: [{
    id: "etherchannel",
    name: "EtherChannel",
    n: 20
  }, {
    id: "trunk",
    name: "トランクと VLAN",
    n: 19
  }, {
    id: "access",
    name: "機器への入り方",
    n: 10
  }, {
    id: "ipsvc",
    name: "DHCP・NAT・NTP の設定",
    n: 9
  }, {
    id: "portsec",
    name: "ポートの守り",
    n: 4
  }]
}, {
  id: "misc",
  name: "そのほか",
  note: "決まった確認項目が立たない、一点ものの問題",
  blocks: [{
    id: "wlangui",
    name: "無線の画面を読む",
    n: 13
  }, {
    id: "nolink",
    name: "つながらない原因をさがす",
    n: 5
  }, {
    id: "misc",
    name: "そのほか",
    n: 5
  }]
}];
const bank = id => typeof BANKS !== "undefined" && BANKS[id] || null;
/* 紙面から切り出した提示物。**qid で引く。**問題データには画像を書かない。
   img/index.js（scripts/build_exhibit_images.py が作る）が唯一の置き場所 */
const scanOf = qid => typeof SCANS !== "undefined" && SCANS[String(qid).replace(/#\d+$/, "")] || null;
const engine = id => typeof GENS !== "undefined" && GENS[id] || null;
const isReady = id => !!bank(id);
const blockOf = id => {
  for (const c of CARDS) for (const b of c.blocks) if (b.id === id) return {
    card: c,
    block: b
  };
  return null;
};
/* 番号。トップの札が 1・2・3・4、その中の分野が 1.1・1.2 … */
const cardNo = cid => CARDS.findIndex(c => c.id === cid) + 1;
const blockNo = (cid, bid) => {
  const c = CARDS.filter(x => x.id === cid)[0];
  return cardNo(cid) + "." + (c.blocks.findIndex(b => b.id === bid) + 1);
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
  if (!r || r.best === null || r.best === undefined) return {
    kind: "yet",
    text: "まだ"
  };
  if (r.passed) return {
    kind: "done",
    text: "🏅"
  };
  return {
    kind: "part",
    text: r.best + " / " + of
  };
}
/* バッジの置き場。**空の枠を先に見せる。**
   ipcalc2 と同じ形（破線の枠 → バッジが付くと金色の枠に 🏅）。
   途中の点数は、枠の下に小さく添える */
function Mark({
  mark,
  sm
}) {
  const cls = "slot" + (sm ? " sm" : "") + (mark.kind === "done" ? " got" : "");
  if (mark.kind === "part") {
    return /*#__PURE__*/React.createElement("span", {
      className: "slot-w"
    }, /*#__PURE__*/React.createElement("span", {
      className: cls
    }), /*#__PURE__*/React.createElement("span", {
      className: "slot-n"
    }, mark.text));
  }
  return /*#__PURE__*/React.createElement("span", {
    className: cls
  }, mark.kind === "done" ? "🏅" : "");
}
/* 分野の印。テストは分野に1本なので、その1本の結果がそのまま分野の印になる */
function blockMark(st, id) {
  const ch = testChunks(id);
  if (!ch.length) return {
    kind: "yet",
    text: "まだ"
  };
  return markOf((st.rounds || {})[STORE.setKey(ch[0])] || {}, ch[0].length);
}
const cardCount = c => c.blocks.reduce((a, b) => a + (bank(b.id) ? bank(b.id).length : b.n), 0);

/* 学習の記録は store.js（いまは localStorage、のちにサーバ）。
   **画面は「いまの状態」だけを見る。**状態は、ためた記録から毎回作り直す */
const allBlockIds = () => CARDS.reduce((a, c) => a.concat(c.blocks.map(b => b.id)), []);
const roundsOf = id => testChunks(id).map(c => STORE.setKey(c));
/* 問題データの版。中身ができているブロックだけを並べる。
   例 "showint:31,rootbridge:23"。問題を足すと変わるので、
   あとから「どの版で解いた記録か」が分かる */
const dataVersion = () => allBlockIds().filter(id => bank(id)).map(id => id + ":" + bank(id).length).join(",");
function loadState() {
  return STORE.summarize(STORE.load(), allBlockIds(), roundsOf);
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

/* ── 図を出す ─────────────────────────────
 * 描くのは fig.js。**React を使わない素の関数**なので、
 * 本番環境が React でなくても、そのまま持っていける。
 */
function Figure({
  fig
}) {
  if (!fig) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "figwrap",
    dangerouslySetInnerHTML: {
      __html: FIG.svg(fig)
    }
  });
}

/* ── 紙面から切り出した、本物の図 ─────────────────
 * テストは**本と同じ見え方**にする。練習で出る図は作ったもの（Figure）。
 */
function Scan({
  image,
  alt
}) {
  if (!image) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "scan"
  }, /*#__PURE__*/React.createElement("img", {
    src: image.src,
    width: image.w,
    height: image.h,
    alt: alt || "",
    loading: "lazy"
  }));
}

/* ── MACアドレスの一覧 ─────────────────────────
 * 本の紙面では、図の下に別で刷られていることがある。
 * 切り出した図には入らないので、ここで出す。**紙面と同じ並び。**
 */
function MacList({
  sw
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "mlist"
  }, sw.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "mrow",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "mk"
  }, s.id), /*#__PURE__*/React.createElement("span", {
    className: "mv"
  }, s.mac))));
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
  return {
    kind: o.kind,
    ask: o.ask || null,
    exhibit: o.exhibit || null,
    image: o.image || null,
    opts: o.opts || null,
    right: o.right ? Array.isArray(o.right) ? o.right : [o.right] : null,
    extra: o.extra || {},
    note: o.note || null
  };
}
/* 提示物を1つの形にする。
     文字列        → 出力（そのまま出す）
     src を持つ    → JSON など、**画面に出すのは src だけ**で、
                     判定にはほかの中身（何を聞かれているか）も要るもの
     それ以外      → 図 */
function asExhibit(x) {
  if (x == null) return null;
  if (typeof x === "string") return {
    kind: "console",
    text: x
  };
  if (x.src !== undefined) return {
    kind: "json",
    text: x.src,
    data: x
  };
  return {
    kind: "topology",
    fig: x
  };
}
/* 書き起こしを「図の段」と「文字の段」に分ける。
 *
 * 提示物の書き起こしは `【ネットワーク図】` `【SW1 の show interface】` のような
 * 見出しで区切ってある。**紙面の画像があるときは、図の段だけを画像に置きかえる。**
 * 文字の段（show出力・設定）は、そのまま画像の下に出す。
 * 見出しが無いもの（出力だけの問題）は、丸ごと文字の段になる。
 */
function splitFigure(text) {
  if (typeof text !== "string" || text.indexOf("【") < 0) return {
    fig: null,
    rest: text
  };
  const lines = text.split("\n");
  const secs = [];
  let cur = {
    head: "",
    body: []
  };
  lines.forEach(l => {
    const m = /^【(.+)】\s*$/.exec(l.trim());
    if (m) {
      if (cur.head || cur.body.length) secs.push(cur);
      cur = {
        head: m[1],
        body: []
      };
    } else cur.body.push(l);
  });
  secs.push(cur);
  /* 「図」だけを画像に譲る。**「画面」の段は文字のまま残す。**
     機器の画面は別の箱に刷られていて、図の切り出しには入らないことがある
     （例 B1-P15-010：ネットワーク図は紙面の画像、HostC の設定画面は文字） */
  const isFig = h => /図/.test(h);
  if (!secs.some(s => isFig(s.head))) return {
    fig: null,
    rest: text
  };
  /* 図の段の中に、見出しを付けずに show出力や設定が続けて書いてあることがある。
     **空行のあとに、機器の合図（R1# など）や設定の言葉が来たら、そこから下は文字。** */
  const looksCode = l => /^\S*[#>]\s*\S/.test(l) || /^\s*(interface|switchport|ip\s|no\s|encapsulation|channel-group|router\s|vlan\s|line\s|username|hostname|spanning-tree|standby|access-list)\b/.test(l) || /^\.\.\.$/.test(l.trim());
  const cut = body => {
    for (let i = 1; i < body.length; i++) {
      if (body[i - 1].trim() !== "") continue;
      let j = i;
      while (j < body.length && body[j].trim() === "") j++;
      if (j < body.length && looksCode(body[j])) return [body.slice(0, i), body.slice(j)];
    }
    return [body, []];
  };
  const figPart = [],
    textPart = [];
  secs.forEach(s => {
    if (isFig(s.head)) {
      const [f, t] = cut(s.body);
      figPart.push(f.join("\n"));
      if (t.length) textPart.push(t.join("\n"));
    } else {
      textPart.push((s.head ? "【" + s.head + "】\n" : "") + s.body.join("\n"));
    }
  });
  const rest = textPart.join("\n").replace(/^\n+|\n+$/g, "");
  return {
    fig: figPart.join("\n").trim(),
    rest: rest || null
  };
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
function makePractice(G, id) {
  /* **エンジンが無いブロックは、まだ練習が作れない。**
     ここで過去問を出してしまうと「練習＝テストと同じ問題」になる。
     決まりは「テストは本の問題、練習は生成問題」。混ぜない */
  if (!G) return [];
  const bs = G.blocks();
  const out = [];
  bs.forEach((b, i) => {
    out.push(item({
      kind: "learn",
      extra: {
        block: b,
        i: i,
        of: bs.length
      }
    }));
    /* その確認項目の問題を2問。**組み立てるのはエンジン側**（画面では作らない） */
    [0, 1].forEach(n => {
      const q = G.stepQ(i, n);
      if (!q) return;
      out.push(item({
        kind: q.kind,
        ask: q.ask,
        exhibit: asExhibit(q.exhibit),
        opts: q.opts,
        right: q.right,
        extra: Object.assign({}, q.extra, {
          i: q.extra.i,
          of: bs.length
        })
      }));
    });
  });
  for (let k = 0; k < 3; k++) {
    const q = G.wholeQ();
    if (!q) continue;
    out.push(item({
      kind: q.kind,
      ask: q.ask,
      exhibit: asExhibit(q.exhibit),
      opts: q.opts,
      right: q.right,
      extra: Object.assign({}, q.extra, {
        i: bs.length,
        of: bs.length
      })
    }));
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
  const bs = G.blocks();
  const out = [];
  idx.forEach(i => {
    if (!bs[i]) return;
    out.push(item({
      kind: "learn",
      extra: {
        block: bs[i],
        i: i,
        of: bs.length
      }
    }));
    [0, 1].forEach(n => {
      const q = G.stepQ(i, n);
      if (!q) return;
      out.push(item({
        kind: q.kind,
        ask: q.ask,
        exhibit: asExhibit(q.exhibit),
        opts: q.opts,
        right: q.right,
        extra: Object.assign({}, q.extra, {
          i: q.extra.i,
          of: bs.length
        })
      }));
    });
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
function passLine(len) {
  return Math.ceil(len * 0.9);
}

/* 過去問1問を、画面が読む形にする */
function asPast(q) {
  /* 左と右を結ぶ問題。**本の1問のまま出す。**
     正解は「説明 → 入れ先」の並び。ためる1件の形を変えずに済むよう、
     ほかの問題と同じ「文字列の配列」にそろえる */
  if (q.pairs) {
    return item({
      kind: "match",
      ask: q.text,
      exhibit: null,
      image: scanOf(q.qid),
      opts: q.targets,
      right: q.pairs.map(p => p.l + " → " + p.r),
      extra: {
        pairs: q.pairs,
        targets: q.targets
      },
      note: {
        qid: q.qid,
        book: q.book,
        explanation: q.explanation
      }
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
    kind: "past",
    ask: q.text,
    exhibit: asExhibit(ex),
    image: scan,
    opts: q.choices,
    right: q.answer,
    extra: {
      maclist: !!(q.fig && q.fig.maclist),
      sw: q.fig ? q.fig.sw : null
    },
    note: {
      qid: q.qid,
      book: q.book,
      explanation: q.explanation
    }
  });
}

/* 判定エンジンが無い分野でも混ぜられるように */
function shuffleAny(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = x[i];
    x[i] = x[j];
    x[j] = t;
  }
  return x;
}
function makeTest(id, ci) {
  return shuffleAny(testChunks(id)[ci]).map(q => asPast(q));
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
    className: "note-b"
  }, t.why), /*#__PURE__*/React.createElement("div", {
    className: "steps"
  }, /*#__PURE__*/React.createElement("div", {
    className: "step-l"
  }, "\u898B\u305F\u6240\u3068\u3001\u305D\u3053\u306B\u5165\u3063\u3066\u3044\u308B\u6570"), t.steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "step-r",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "step-k"
  }, s.name), /*#__PURE__*/React.createElement("span", {
    className: "step-v"
  }, s.value)))), /*#__PURE__*/React.createElement("div", {
    className: "rej"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rej-l"
  }, "\u307B\u304B\u304C\u6D88\u3048\u308B\u7406\u7531"), t.reject.map((r, i) => /*#__PURE__*/React.createElement("div", {
    className: "rej-r",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "rej-k"
  }, r.verdict), /*#__PURE__*/React.createElement("span", {
    className: "rej-v"
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
function Home({
  prog,
  go,
  open,
  setOpen
}) {
  const allBlocks = CARDS.reduce((a, c) => a.concat(c.blocks), []);
  const doneB = allBlocks.filter(b => blockMark(prog.blocks[b.id] || {}, b.id).kind === "done").length;
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-t"
  }, "\u8A08\u7B97\u306A\u3057\u306E\u56F3\u8868\u554F\u984C"), /*#__PURE__*/React.createElement("div", {
    className: "hero-n"
  }, "\u51FA\u529B\u30FB\u56F3\u30FB\u753B\u9762\u3092\u898B\u3066\u7B54\u3048\u308B\u554F\u984C\u3092\u3001\u578B\u3054\u3068\u306B\u899A\u3048\u308B"), /*#__PURE__*/React.createElement("div", {
    className: "bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar-in",
    style: {
      width: doneB / allBlocks.length * 100 + "%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "hero-n"
  }, "\uD83C\uDFC5 ", doneB, " / ", allBlocks.length, " \u5206\u91CE")), CARDS.map((c, ci) => /*#__PURE__*/React.createElement("div", {
    className: "grp",
    key: c.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "grp-h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "grp-n"
  }, ci + 1), /*#__PURE__*/React.createElement("span", {
    className: "grp-b"
  }, /*#__PURE__*/React.createElement("span", {
    className: "grp-t"
  }, c.name), /*#__PURE__*/React.createElement("span", {
    className: "grp-s"
  }, c.note))), c.blocks.map(b => {
    const on = open === b.id;
    const ready = isReady(b.id);
    const mark = blockMark(prog.blocks[b.id] || {}, b.id);
    const n = bank(b.id) ? bank(b.id).length : b.n;
    const G = engine(b.id);
    const bs = G ? G.blocks() : [];
    return /*#__PURE__*/React.createElement("div", {
      className: "row" + (on ? " row-on" : "") + (ready ? "" : " row-yet"),
      key: b.id
    }, /*#__PURE__*/React.createElement("button", {
      className: "row-h",
      onClick: () => setOpen(on ? null : b.id),
      "aria-expanded": on
    }, /*#__PURE__*/React.createElement("span", {
      className: "row-n"
    }, blockNo(c.id, b.id)), /*#__PURE__*/React.createElement("span", {
      className: "row-b"
    }, /*#__PURE__*/React.createElement("span", {
      className: "row-t"
    }, b.name), /*#__PURE__*/React.createElement("span", {
      className: "row-s"
    }, "\u672C\u306E\u554F\u984C ", n, " \u554F")), /*#__PURE__*/React.createElement(Mark, {
      mark: mark,
      sm: true
    }), /*#__PURE__*/React.createElement("span", {
      className: "row-v" + (on ? " row-v-on" : "")
    }, "\u25BE")), on && /*#__PURE__*/React.createElement("div", {
      className: "row-p"
    }, ready ?
    /*#__PURE__*/
    /* **説明は書かない。**押せば分かることを、押す前に読ませない */
    React.createElement("div", {
      className: "row-go"
    }, /*#__PURE__*/React.createElement("button", {
      className: "go next",
      disabled: bs.length === 0,
      onClick: () => go(b.id, "practice")
    }, "\u7DF4\u7FD2\u3092\u3059\u308B"), /*#__PURE__*/React.createElement("button", {
      className: "go ghost",
      onClick: () => go(b.id, "test:0")
    }, "\u30C6\u30B9\u30C8\u3092\u53D7\u3051\u308B")) : /*#__PURE__*/React.createElement("div", {
      className: "row-d"
    }, "\u3053\u306E\u5206\u91CE\u306E\u300C\u78BA\u8A8D\u9805\u76EE\u300D\u3068\u300C\u6C7A\u3081\u65B9\u300D\u3092\u3001\u672C\u306E\u554F\u984C\u3068\u89E3\u8AAC\u304B\u3089\u66F8\u304D\u8D77\u3053\u3059\u4F5C\u696D\u304C\u3053\u308C\u304B\u3089\u3067\u3059\u3002 \u3067\u304D\u308B\u3068\u3001\u307B\u304B\u306E\u5206\u91CE\u3068\u540C\u3058\u3088\u3046\u306B\u3001\u7DF4\u7FD2\u3067\u899A\u3048\u3066\u304B\u3089\u30C6\u30B9\u30C8\u306B\u9032\u3081\u307E\u3059\u3002")));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "legend"
  }, /*#__PURE__*/React.createElement("span", {
    className: "slot got"
  }, "\uD83C\uDFC5"), /*#__PURE__*/React.createElement("span", {
    className: "legend-t"
  }, "\u30D0\u30C3\u30B8\u306F\u5206\u91CE\u3054\u3068\u306B1\u3064\u3002\u305D\u306E\u5206\u91CE\u306E\u30C6\u30B9\u30C8\u30679\u5272\u6B63\u89E3\u3059\u308B\u3068\u4ED8\u304D\u307E\u3059\u3002")), /*#__PURE__*/React.createElement("div", {
    className: "foot"
  }, "\u8A08\u7B97\u306E\u3044\u3089\u306A\u3044\u56F3\u8868\u554F\u984C\u306F\u3001\u672C\u3067 335 \u554F\u3042\u308A\u307E\u3059\u3002 \u3069\u306E\u554F\u984C\u3082\u3001\u5FC5\u305A\u3069\u308C\u304B\u306E\u5206\u91CE\u306B\u5165\u308A\u307E\u3059\u3002 \u30C6\u30B9\u30C8\u306B\u51FA\u308B\u306E\u306F\u3001\u672C\u306B\u8F09\u3063\u3066\u3044\u308B\u554F\u984C\u305D\u306E\u3082\u306E\u3067\u3059\u3002 \u7DF4\u7FD2\u306F\u3001\u305D\u308C\u3092\u89E3\u3051\u308B\u3088\u3046\u306B\u306A\u308B\u305F\u3081\u306E\u3082\u306E\u3067\u3059\u3002"), /*#__PURE__*/React.createElement("button", {
    className: "wipe",
    onClick: () => {
      if (window.confirm("これまでの記録をすべて消します。よろしいですか。")) {
        STORE.wipe();
        window.location.reload();
      }
    }
  }, "\u8A18\u9332\u3092\u6D88\u3059"));
}

/* ── 左と右を結ぶ問題 ─────────────────────
 * 上に説明の札、下に入れ先。**説明を押してから、入れ先を押す。**
 * 引っぱって落とす形にしないのは、小さい画面で押し間違えるため。
 * 答え合わせのあとは、合った組に✓、違った組に✕と正しい入れ先を出す。
 */
function Match({
  pairs,
  targets,
  put,
  hold,
  done,
  onCard,
  onTarget
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "mt"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mt-cards"
  }, pairs.map((p, i) => {
    const at = put[i];
    const right = done && at === p.r;
    let cls = "mt-card";
    if (done) cls += right ? " mt-ok" : " mt-ng";else if (hold === i) cls += " mt-hold";else if (at !== undefined) cls += " mt-set";
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      className: cls,
      disabled: done,
      onClick: () => onCard(i)
    }, /*#__PURE__*/React.createElement("span", {
      className: "mt-l"
    }, p.l), at !== undefined && /*#__PURE__*/React.createElement("span", {
      className: "mt-at"
    }, at), done && (right ? /*#__PURE__*/React.createElement("span", {
      className: "mt-m"
    }, "\u2713") : /*#__PURE__*/React.createElement("span", {
      className: "mt-m"
    }, "\u2715\u3000\u6B63\u3057\u304F\u306F ", p.r)));
  })), /*#__PURE__*/React.createElement("div", {
    className: "mt-targets"
  }, targets.map((t, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "mt-t" + (hold !== null ? " mt-t-on" : ""),
    disabled: done || hold === null,
    onClick: () => onTarget(t)
  }, t))));
}

/* ── 一問一答 ────────────────────────── */
function Drill({
  bid,
  mode,
  prog,
  setProg,
  back,
  goTest,
  goNext
}) {
  const {
    block
  } = blockOf(bid);
  const chunks = testChunks(bid);
  const G = engine(bid);
  const ci = mode.indexOf("test:") === 0 ? parseInt(mode.slice(5), 10) : -1;
  const isTest = ci >= 0;
  const [plan, setPlan] = useState(() => isTest ? makeTest(bid, ci) : makePractice(G, bid));
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState(null); // 決まった時に押したもの（間違いのときだけ入る）
  const [got, setGot] = useState([]); // 当たった選択肢（答えが2つ以上のとき積む）
  /* 結ぶ問題だけが使う。説明の番号 → 用語の名前。まだ入れていない説明は入らない */
  const [put, setPut] = useState({});
  const [hold, setHold] = useState(null); // いま持ち上げている説明の番号
  const [done, setDone] = useState(false); // その問題の答え合わせが出ているか
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
    const qn = plan.filter(x => x.kind !== "learn").length;
    rec.current = STORE.start({
      version: dataVersion(),
      block: bid,
      mode: isTest ? "test" : "practice",
      /* 出題範囲。作った問題は範囲という考えが無いので "generated" */
      set: isTest ? STORE.setKey(testChunks(bid)[ci]) : G && G.kind === "rules" ? "generated" : STORE.setKey(bank(bid) || []),
      of: qn,
      passLine: passLine(qn)
    });
  }
  const tries = useRef(0);
  const it = plan[at];
  const rights = it ? Array.isArray(it.right) ? it.right : [it.right] : [];
  const ok = done && picked === null;
  const cram = !isTest;

  /* 次の問題・結果の画面に移ったら、上から見せる */
  useEffect(() => {
    toTop();
  }, [at, end]);
  function choose(o) {
    if (done) return;
    tries.current += 1;
    if (rights.indexOf(o) >= 0) {
      if (got.indexOf(o) >= 0) return;
      const g = got.concat([o]);
      setGot(g);
      if (g.length >= rights.length) {
        // ぜんぶ当てた
        setDone(true);
        if (firstOk === null) {
          setFirstOk(true);
          setAsked(asked + 1);
          setScore(score + 1);
          writeAnswer(true, g);
        }
      }
      return;
    }
    setPicked(o);
    setDone(true);
    if (firstOk === null) {
      setFirstOk(false);
      setAsked(asked + 1);
      writeAnswer(false, got.concat([o]));
    }
  }

  /* その1問の結果を書きとめる。**点になるのは最初の答え** */
  function writeAnswer(ok, picked) {
    STORE.answer(rec.current, {
      no: rec.current.answers.length + 1,
      kind: it.kind,
      qid: it.note ? it.note.qid : null,
      /* どの確認項目でつまずいたかを残す。あとで、そこだけ練習し直すために使う。
         対応づけは look を持たないので、その用語の名前を入れる */
      spot: it.kind === "step" ? it.extra.step.look.length ? it.extra.step.look.join(" と ") : (G.blocks()[it.extra.i] || {}).name || null : null,
      spotNo: it.kind === "step" ? it.extra.i : null,
      firstOk: ok,
      tries: tries.current,
      picked: picked,
      right: rights,
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
    if (put[i] !== undefined) {
      const p = {
        ...put
      };
      delete p[i];
      setPut(p);
      setHold(null);
      return;
    }
    setHold(hold === i ? null : i);
  }
  function tapTarget(t) {
    if (done || hold === null) return;
    setPut({
      ...put,
      [hold]: t
    });
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
    setPicked(null);
    setGot([]);
    setDone(false);
    /* 結ぶ問題は、合っている組だけ残して、違う組を外す */
    if (it && it.kind === "match") {
      const keep = {};
      it.extra.pairs.forEach((p, i) => {
        if (put[i] === p.r) keep[i] = put[i];
      });
      setPut(keep);
      setHold(null);
    }
    toTop();
  }
  function next() {
    if (at + 1 >= plan.length) {
      /* 1回ぶんを、そのまま1件ためる（のちにサーバへ送るのと同じ形） */
      STORE.add(STORE.finish(rec.current));
      setProg(loadState());
      setEnd(true);
      return;
    }
    setAt(at + 1);
    setPicked(null);
    setGot([]);
    setDone(false);
    setFirstOk(null);
    setPut({});
    setHold(null);
    tries.current = 0;
    at0.current = Date.now();
  }
  useEffect(() => {
    function onKey(e) {
      if (!it) return;
      if (it.kind === "learn") {
        if (e.key === "Enter") {
          e.preventDefault();
          next();
        }
        return;
      }
      if (!done) {
        /* 結ぶ問題は押す所が2段あるので、キーでは選べない。Enter で答え合わせだけ */
        if (it.kind === "match") {
          if (e.key === "Enter" && Object.keys(put).length >= it.extra.pairs.length) {
            e.preventDefault();
            grade();
          }
          return;
        }
        const k = e.key.toLowerCase();
        let i = LETTERS.toLowerCase().indexOf(k);
        if (i < 0 && /^[1-8]$/.test(k)) i = parseInt(k, 10) - 1;
        if (i >= 0 && it.opts[i]) {
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

  /* 練習の材料が作れない分野（判定エンジンがない）で、空のまま入ったとき */
  if (!plan.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "wrap"
    }, /*#__PURE__*/React.createElement("div", {
      className: "head"
    }, /*#__PURE__*/React.createElement("button", {
      className: "back",
      onClick: back
    }, "\u2190 \u3082\u3069\u308B"), /*#__PURE__*/React.createElement("span", {
      className: "head-t"
    }, block.name)), /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("div", {
      className: "brief-b"
    }, "\u3053\u306E\u5206\u91CE\u306E\u7DF4\u7FD2\u306F\u3001\u307E\u3060\u7528\u610F\u3067\u304D\u3066\u3044\u307E\u305B\u3093\u3002")), /*#__PURE__*/React.createElement("button", {
      className: "go",
      onClick: back
    }, "\u3082\u3069\u308B"));
  }
  if (end) {
    const need = rec.current.passLine;
    const passed = isTest && score >= need;
    /* 間違えた確認項目を、記録から拾う。同じ項目は1つにまとめる。
       **名前ではなく番号で引く。**確認項目の名前は、ほかの項目と重なることがある */
    const bs2 = G ? G.blocks() : [];
    const wrong = [];
    (rec.current.answers || []).forEach(a => {
      if (a.kind !== "step" || a.firstOk) return;
      if (a.spotNo === null || a.spotNo === undefined) return;
      if (bs2[a.spotNo] && wrong.indexOf(a.spotNo) < 0) wrong.push(a.spotNo);
    });
    wrong.sort((x, y) => x - y);
    /* 次の分野（ホームの並び順で、次に来る用意のできた分野） */
    const all = CARDS.reduce((a, c) => a.concat(c.blocks), []).filter(b => isReady(b.id));
    const at2 = all.map(b => b.id).indexOf(bid);
    const nextB = at2 >= 0 && at2 + 1 < all.length ? all[at2 + 1] : null;
    return /*#__PURE__*/React.createElement("div", {
      className: "wrap"
    }, /*#__PURE__*/React.createElement("div", {
      className: "head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "head-t"
    }, isTest ? "テスト" : "練習", "\u3000\u7D50\u679C")), /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("div", {
      className: "brief-t"
    }, score, " / ", asked, " \u554F"), /*#__PURE__*/React.createElement("div", {
      className: "brief-b"
    }, isTest ? passed ? "この分野にバッジが付きました。" : need + " 問正解でバッジが付きます。あと " + (need - score) + " 問です。もう一度受けられます。" : again ? "間違えた確認項目だけを、もう一度解きました。得点になるのは最初の答えです。" : "確認項目を上から順に、すべて通しました。得点になるのは最初の答えです。")), !isTest && wrong.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, "\u9593\u9055\u3048\u305F\u78BA\u8A8D\u9805\u76EE"), wrong.map(i => /*#__PURE__*/React.createElement("div", {
      className: "brief-r",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "brief-k"
    }, i + 1), /*#__PURE__*/React.createElement("span", {
      className: "brief-v"
    }, bs2[i].name))), /*#__PURE__*/React.createElement("button", {
      className: "go ghost",
      onClick: () => {
        const p2 = makeReview(G, wrong);
        setPlan(p2);
        setAgain(true);
        setAt(0);
        setPicked(null);
        setGot([]);
        setDone(false);
        setFirstOk(null);
        setPut({});
        setHold(null);
        setScore(0);
        setAsked(0);
        setEnd(false);
        tries.current = 0;
        at0.current = Date.now();
        const qn = p2.filter(x => x.kind !== "learn").length;
        rec.current = STORE.start({
          version: dataVersion(),
          block: bid,
          mode: "practice",
          set: "generated",
          of: qn,
          passLine: passLine(qn)
        });
        toTop();
      }
    }, "\u3053\u306E ", wrong.length, " \u9805\u76EE\u3060\u3051\u3001\u3082\u3046\u4E00\u5EA6\u89E3\u304F")), /*#__PURE__*/React.createElement("div", {
      className: "dock"
    }, !isTest && /*#__PURE__*/React.createElement("button", {
      className: "go next",
      onClick: goTest
    }, "\u3053\u306E\u5206\u91CE\u306E\u30C6\u30B9\u30C8\u3092\u53D7\u3051\u308B"), isTest && passed && nextB && /*#__PURE__*/React.createElement("button", {
      className: "go next",
      onClick: () => goNext(nextB.id)
    }, "\u6B21\u306E\u5206\u91CE\uFF08", nextB.name, "\uFF09\u3078"), isTest && !passed && /*#__PURE__*/React.createElement("button", {
      className: "go next",
      onClick: () => {
        setPlan(makeTest(bid, ci));
        setAt(0);
        setPicked(null);
        setGot([]);
        setDone(false);
        setFirstOk(null);
        setPut({});
        setHold(null);
        setScore(0);
        setAsked(0);
        setEnd(false);
        tries.current = 0;
        at0.current = Date.now();
        rec.current = STORE.start({
          version: dataVersion(),
          block: bid,
          mode: "test",
          set: STORE.setKey(testChunks(bid)[ci]),
          of: chunks[ci].length,
          passLine: passLine(chunks[ci].length)
        });
        toTop();
      }
    }, "\u3082\u3046\u4E00\u5EA6\u53D7\u3051\u308B"), /*#__PURE__*/React.createElement("button", {
      className: "go ghost",
      onClick: back
    }, "\u30DB\u30FC\u30E0\u3078")));
  }

  /* 確認項目の説明 */
  if (it.kind === "learn") {
    const lb = it.extra.block,
      li = it.extra.i,
      lof = it.extra.of;
    return /*#__PURE__*/React.createElement("div", {
      className: "wrap"
    }, /*#__PURE__*/React.createElement("div", {
      className: "head"
    }, /*#__PURE__*/React.createElement("button", {
      className: "back",
      onClick: back
    }, "\u2190 \u3082\u3069\u308B"), /*#__PURE__*/React.createElement("span", {
      className: "head-t"
    }, G.kind === "match" ? "覚える用語　" : "確認項目　", li + 1, " / ", lof), /*#__PURE__*/React.createElement("span", {
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
    }, G.kind === "match" ? li + 1 + " 番目に覚える用語" : li + 1 + " 番目の確認項目"), /*#__PURE__*/React.createElement("div", {
      className: "brief-t"
    }, lb.name)), G.kind === "match" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, "\u3053\u306E\u7528\u8A9E\u306B\u5F53\u3066\u306F\u307E\u308B\u8AAC\u660E\uFF08\u904E\u53BB\u554F\u304B\u3089\uFF09"), lb.learn.map((p, i) => /*#__PURE__*/React.createElement("div", {
      className: "brief-r",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "brief-k"
    }, i + 1), /*#__PURE__*/React.createElement("span", {
      className: "brief-v"
    }, p.l)))), /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, "\u3069\u3046\u4F7F\u3046\u304B"), /*#__PURE__*/React.createElement("div", {
      className: "brief-b"
    }, "\u3053\u3053\u306B\u6319\u3052\u305F ", lb.learn.length, " \u500B\u306E\u8AAC\u660E\u306F\u3001\u3044\u305A\u308C\u3082\u300C", lb.name, "\u300D\u3092\u6307\u3057\u3066\u3044\u307E\u3059\u3002", li + 1 < lof ? "次の用語へ進みます。" : "これが最後の用語です。"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, "\u4F55\u3092\u8868\u3059\u304B"), lb.spots.map((s, i) => /*#__PURE__*/React.createElement("div", {
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
    }, "\u3069\u3046\u4F7F\u3046\u304B"), lb.spots.map((s, i) => /*#__PURE__*/React.createElement("div", {
      className: "brief-b",
      key: i
    }, s.use))), /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, "\u3053\u3053\u3067\u6C7A\u307E\u308B\u3068\u304D"), lb.cond.map((c, i) => /*#__PURE__*/React.createElement("div", {
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
    }, lb.verdict)), /*#__PURE__*/React.createElement("div", {
      className: "gloss"
    }, G.gloss(lb.verdict)), /*#__PURE__*/React.createElement("div", {
      className: "brief-b"
    }, li + 1 < lof ? "ここで決まらなければ、次の確認項目へ進みます。" : "ここまでで決まらなかったときに見る、最後の確認項目です。"))), /*#__PURE__*/React.createElement("button", {
      className: "go",
      onClick: next
    }, "\u3053\u306E\u78BA\u8A8D\u9805\u76EE\u306E\u554F\u984C\u3078\uFF08Enter\uFF09"));
  }

  /* **kind で場合分けしない。**あるものを出すだけ */
  const exv = exValue(it.exhibit);
  const hitWords = it.kind === "step" ? it.extra.step.look : done && G && exv ? (G.judge(G.read(exv)) || {}).look : null;
  const con = /*#__PURE__*/React.createElement(React.Fragment, null, it.image && /*#__PURE__*/React.createElement(Scan, {
    image: it.image,
    alt: it.note ? it.note.qid : ""
  }), !it.image && it.exhibit && it.exhibit.kind === "topology" ? /*#__PURE__*/React.createElement(Figure, {
    fig: it.exhibit.fig
  }) : it.exhibit && it.exhibit.kind !== "topology" ? /*#__PURE__*/React.createElement(Console, {
    text: it.exhibit.text,
    hits: hitWords
  }) : null, it.extra.maclist && /*#__PURE__*/React.createElement(MacList, {
    sw: it.extra.sw
  }));
  const vals = it.kind === "step" ? /*#__PURE__*/React.createElement("div", {
    className: "vals"
  }, it.extra.step.values.map((v, i) => /*#__PURE__*/React.createElement("div", {
    className: "val",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "val-k"
  }, v.name), /*#__PURE__*/React.createElement("span", {
    className: "val-v"
  }, v.value)))) : null;
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
      note = /*#__PURE__*/React.createElement(Note, {
        title: it.right[0],
        body: st.why,
        gloss: st.hit ? G.gloss(st.verdict) : ""
      });
    } else {
      note = it.kind === "match" ?
      /*#__PURE__*/
      /* 結ぶ問題の答えは、1本の長い行にしない。**組ごとに1行**にする */
      React.createElement("div", {
        className: "note"
      }, /*#__PURE__*/React.createElement("div", {
        className: "note-t"
      }, "\u6B63\u3057\u3044\u7D44\u307F\u5408\u308F\u305B"), /*#__PURE__*/React.createElement("div", {
        className: "mt-ans"
      }, it.extra.pairs.map((p, i) => /*#__PURE__*/React.createElement("div", {
        className: "mt-ans-r",
        key: i
      }, /*#__PURE__*/React.createElement("span", {
        className: "mt-ans-k"
      }, p.r), /*#__PURE__*/React.createElement("span", {
        className: "mt-ans-v"
      }, p.l)))), it.note && it.note.explanation && /*#__PURE__*/React.createElement("div", {
        className: "note-b"
      }, "\u672C\u306E\u89E3\u8AAC\uFF1A", it.note.explanation.slice(0, 150))) : /*#__PURE__*/React.createElement(React.Fragment, null, it.image && it.exhibit && it.exhibit.kind === "topology" && /*#__PURE__*/React.createElement(Figure, {
        fig: it.exhibit.fig
      }), /*#__PURE__*/React.createElement(Steps, {
        t: G && exv ? G.trace(exv) : null,
        answer: it.note ? rights.join(" ／ ") : null,
        book: it.note ? it.note.explanation : null
      }));
    }
  }
  const isMatchG = G && G.kind === "match";
  const head = isTest ? "テスト" : it.kind === "step" ? (isMatchG ? "覚える用語　" : "確認項目　") + (it.extra.i + 1) + " / " + it.extra.of : it.kind === "past" ? "練習" : isMatchG ? "覚えた組み合わせで" : "ぜんぶ見て判定";
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
  }, ask), it.kind === "match" ? /*#__PURE__*/React.createElement(Match, {
    pairs: it.extra.pairs,
    targets: it.extra.targets,
    put: put,
    hold: hold,
    done: done,
    onCard: tapCard,
    onTarget: tapTarget
  }) : /*#__PURE__*/React.createElement("div", {
    className: "opts"
  }, it.opts.map((o, i) => {
    const right = rights.indexOf(o) >= 0;
    const hitYet = got.indexOf(o) >= 0;
    let cls = "opt";
    if (done) {
      if (right) cls += " opt-ok";else if (o === picked) cls += " opt-ng";else cls += " opt-off";
    } else if (hitYet) cls += " opt-ok";
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      className: cls,
      onClick: () => choose(o),
      disabled: done
    }, /*#__PURE__*/React.createElement("span", {
      className: "opt-k"
    }, LETTERS[i] || ""), /*#__PURE__*/React.createElement("span", {
      className: "opt-t"
    }, o), done && right || hitYet ? /*#__PURE__*/React.createElement("span", {
      className: "opt-m"
    }, "\u2713") : null, done && o === picked && !right && /*#__PURE__*/React.createElement("span", {
      className: "opt-m"
    }, "\u2715"));
  })), note, it.kind === "match" && !done ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "go",
    onClick: grade,
    disabled: Object.keys(put).length < it.extra.pairs.length
  }, "\u7B54\u3048\u5408\u308F\u305B\uFF08Enter\uFF09"), /*#__PURE__*/React.createElement("div", {
    className: "src"
  }, hold === null ? "説明を押してから、入れる先を押します" : "入れる先を押します。もう一度説明を押すと外れます", "　／　あと " + (it.extra.pairs.length - Object.keys(put).length) + " つ")) : !done ? /*#__PURE__*/React.createElement("div", {
    className: "src"
  }, "A\u301C", LETTERS[it.opts.length - 1], " \u304B 1\u301C", it.opts.length, " \u306E\u30AD\u30FC\u3067\u3082\u9078\u3079\u307E\u3059", rights.length > 1 && got.length > 0 && "　／　あと " + (rights.length - got.length) + " つ") : cram && !ok ? /*#__PURE__*/React.createElement("button", {
    className: "go go-retry",
    onClick: retry
  }, "\u540C\u3058\u78BA\u8A8D\u9805\u76EE\u3092\u3001\u3082\u3046\u4E00\u5EA6\u89E3\u304F\uFF08Enter\uFF09") : /*#__PURE__*/React.createElement("button", {
    className: "go",
    onClick: next
  }, at + 1 >= plan.length ? "結果を見る（Enter）" : "次へ（Enter）"), it.note && /*#__PURE__*/React.createElement("div", {
    className: "src"
  }, it.note.qid));
}

/* ── 画面は2つだけ ─────────────────────────
 * ホーム（分野の一覧）と、練習・テストの画面。
 * **その間に「選ぶ画面」を置かない。**
 * 分野は、ホームの行を開いて出てくるボタンから直接はじまる。
 */
function App() {
  const [prog, setProg] = useState(loadState);
  const [bid, setBid] = useState(null); // いまやっている分野
  const [mode, setMode] = useState(null); // null=ホーム / "practice" / "test:0"
  const [open, setOpen] = useState(null); // ホームで開いている行
  const homeY = useRef(0);
  /* ホームに戻ったときだけ、見ていた所に戻す。ほかは上から */
  useEffect(() => {
    toTop(mode === null ? homeY.current : 0);
  }, [bid, mode]);
  if (mode === null) {
    return /*#__PURE__*/React.createElement(Home, {
      prog: prog,
      open: open,
      setOpen: setOpen,
      go: (id, m) => {
        homeY.current = nowY();
        setBid(id);
        setMode(m);
      }
    });
  }
  /* key に分野とやり方を入れて、別のものへ移ったときに作り直す。
     こうしないと、前の問題と点数がそのまま残る */
  return /*#__PURE__*/React.createElement(Drill, {
    key: bid + "/" + mode,
    bid: bid,
    mode: mode,
    prog: prog,
    setProg: setProg,
    back: () => {
      setOpen(bid);
      setMode(null);
    }
    /* 練習が終わったら、そのままテストへ進めるようにする。
       いちどホームまで戻らせない */,
    goTest: () => setMode("test:0")
    /* 次の分野へ。ホームに戻し、その行を開いた状態で見せる */,
    goNext: id => {
      homeY.current = 0;
      setOpen(id);
      setBid(id);
      setMode(null);
    }
  });
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
