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
const LETTERS = "ABCDEFGH";

/* ── 札とブロック ────────────────────────────
 * 束B 335問を、問題の型で4枚に分け、その中を題材ごとのブロックに割る。
 * n は、そのブロックに入る過去問の数（できていないブロックは見込み）。
 * できたブロックは questions.js の BANKS に入るので、そちらの数を使う。
 */
const CARDS = [{
  id: "read",
  name: "出力を読んで当てる",
  note: "値を読んで、決まった規則で答えを出す",
  blocks: [{
    id: "showint",
    name: "show interface の障害",
    n: 31
  }, {
    id: "json",
    name: "JSON の読み取り",
    n: 38
  }, {
    id: "rootbridge",
    name: "ルートブリッジの決まり方",
    n: 23
  }, {
    id: "ospf",
    name: "OSPF のとなり関係",
    n: 13
  }]
}, {
  id: "words",
  name: "言葉と意味の組み合わせ",
  note: "説明と用語の対を覚える",
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
  note: "要件と今の設定を読んで、打つコマンドを選ぶ",
  blocks: [{
    id: "etherchannel",
    name: "EtherChannel",
    n: 22
  }, {
    id: "access",
    name: "機器への入り方",
    n: 14
  }, {
    id: "trunk",
    name: "トランク",
    n: 10
  }, {
    id: "vlan",
    name: "VLAN",
    n: 9
  }, {
    id: "othercfg",
    name: "そのほかの設定",
    n: 18
  }]
}, {
  id: "misc",
  name: "そのほか",
  note: "決まった見る所が立たない、一点物",
  blocks: [{
    id: "misc",
    name: "題材ごとに分けます",
    n: 32
  }]
}];
const bank = id => typeof BANKS !== "undefined" && BANKS[id] || null;
const engine = id => typeof GENS !== "undefined" && GENS[id] || null;
const isReady = id => !!bank(id);
const blockOf = id => {
  for (const c of CARDS) for (const b of c.blocks) if (b.id === id) return {
    card: c,
    block: b
  };
  return null;
};
const cardCount = c => c.blocks.reduce((a, b) => a + (bank(b.id) ? bank(b.id).length : b.n), 0);
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
function makePractice(G) {
  if (!G || G.kind !== "rules") return [];
  const bs = G.blocks();
  const out = [];
  bs.forEach((b, i) => {
    out.push({
      kind: "learn",
      b: b,
      i: i,
      of: bs.length
    });
    [true, false].forEach(hit => {
      const r = G.reach(i, hit);
      if (!r) return;
      const st = r.step;
      const right = st.hit ? "答えは「" + st.verdict + "」" : "次に " + st.next + " を見る";
      const opts = [right];
      if (st.hit) {
        if (st.next) opts.push("次に " + st.next + " を見る");
      } else {
        opts.push("答えは「" + st.verdict + "」");
      }
      const other = G.shuffle(G.VERDICTS.filter(v => v !== st.verdict))[0];
      opts.push("答えは「" + other + "」");
      out.push({
        kind: "walk",
        text: r.text,
        st: st,
        b: b,
        i: i,
        of: bs.length,
        opts: G.shuffle(opts.slice(0, 3)),
        right: right
      });
    });
  });
  for (let k = 0; k < 3; k++) {
    const g = G.makeAny();
    if (!g.text) continue;
    const r = G.RULES.filter(x => x.key === g.key)[0];
    const wrong = G.shuffle(G.VERDICTS.filter(v => v !== r.verdict)).slice(0, 3);
    out.push({
      kind: "judge",
      text: g.text,
      i: bs.length,
      of: bs.length,
      opts: G.shuffle([r.verdict].concat(wrong)),
      right: r.verdict
    });
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
function passLine(len) {
  return Math.max(1, len - 1);
}
function makeTest(id, ci) {
  const G = engine(id);
  const sh = G ? G.shuffle : a => a.slice();
  return sh(testChunks(id)[ci]).map(q => ({
    kind: "past",
    q: q,
    opts: q.choices,
    right: Array.isArray(q.answer) ? q.answer : [q.answer]
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

/* ── ホーム。札＝問題の型 ────────────────────── */
function Home({
  prog,
  open
}) {
  const done = CARDS.filter(c => c.blocks.every(b => prog[b.id] && prog[b.id].badge)).length;
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
      width: done / CARDS.length * 100 + "%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "hero-n"
  }, done, " / ", CARDS.length, " \u306E\u672D\u306B\u5370\u304C\u4ED8\u304D\u307E\u3057\u305F")), CARDS.map((c, i) => {
    const ready = c.blocks.filter(b => isReady(b.id));
    const clear = c.blocks.filter(b => prog[b.id] && prog[b.id].badge).length;
    return /*#__PURE__*/React.createElement("div", {
      className: "road",
      key: c.id
    }, i > 0 && /*#__PURE__*/React.createElement("div", {
      className: "link"
    }), /*#__PURE__*/React.createElement("button", {
      className: "tile" + (clear === c.blocks.length ? " tile-clear" : ""),
      onClick: () => open(c.id)
    }, /*#__PURE__*/React.createElement("span", {
      className: "tile-n"
    }, i + 1), /*#__PURE__*/React.createElement("span", {
      className: "tile-b"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tile-t"
    }, c.name), /*#__PURE__*/React.createElement("span", {
      className: "tile-s"
    }, c.note, "\u3000\uFF0F\u3000", c.blocks.length, " \u30D6\u30ED\u30C3\u30AF\u30FB\u904E\u53BB\u554F ", cardCount(c), " \u554F")), clear === c.blocks.length ? /*#__PURE__*/React.createElement("span", {
      className: "badge badge-gold"
    }, "\uD83C\uDFC5") : ready.length ? /*#__PURE__*/React.createElement("span", {
      className: "trow-p"
    }, ready.length, " / ", c.blocks.length, " \u3067\u304D\u3066\u3044\u307E\u3059") : /*#__PURE__*/React.createElement("span", {
      className: "badge badge-soon"
    }, "\u3053\u308C\u304B\u3089")));
  }), /*#__PURE__*/React.createElement("div", {
    className: "foot"
  }, "\u56F3\u8868\u554F\u984C\u306F\u5168\u90E8\u3067 335 \u554F\u3042\u308A\u307E\u3059\u3002\u3069\u306E\u554F\u984C\u3082\u3001\u5FC5\u305A\u3069\u308C\u304B\u306E\u672D\u306E\u3069\u308C\u304B\u306E\u30D6\u30ED\u30C3\u30AF\u306B\u5165\u308A\u307E\u3059\u3002 \u3044\u307E\u4E2D\u8EAB\u304C\u3067\u304D\u3066\u3044\u308B\u306E\u306F\u300Cshow interface \u306E\u969C\u5BB3\u300D\u3060\u3051\u3067\u3059\u3002"));
}

/* ── 札の中。ブロックの一覧 ───────────────────── */
function Card({
  cid,
  prog,
  open,
  back
}) {
  const c = CARDS.filter(x => x.id === cid)[0];
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "head"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back",
    onClick: back
  }, "\u2190 \u3082\u3069\u308B"), /*#__PURE__*/React.createElement("span", {
    className: "head-t"
  }, c.name)), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u3053\u306E\u672D\u3067\u3084\u308B\u3053\u3068"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, c.note, "\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, "\u30D6\u30ED\u30C3\u30AF\u3054\u3068\u306B\u3001\u307E\u305A\u4ED5\u7D44\u307F\u3092\u899A\u3048\u3066\u3001\u305D\u306E\u3042\u3068\u540C\u3058\u6240\u306E\u904E\u53BB\u554F\u3092\u89E3\u304D\u307E\u3059\u3002")), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u30D6\u30ED\u30C3\u30AF")), c.blocks.map((b, i) => {
    const st = prog[b.id] || {};
    const ready = isReady(b.id);
    const num = ready ? bank(b.id).length : b.n;
    return /*#__PURE__*/React.createElement("button", {
      className: "trow",
      key: b.id,
      onClick: () => open(b.id)
    }, /*#__PURE__*/React.createElement("span", {
      className: "trow-n"
    }, i + 1), /*#__PURE__*/React.createElement("span", {
      className: "trow-b"
    }, /*#__PURE__*/React.createElement("span", {
      className: "trow-t"
    }, b.name), /*#__PURE__*/React.createElement("span", {
      className: "trow-s"
    }, "\u904E\u53BB\u554F ", num, " \u554F")), st.badge ? /*#__PURE__*/React.createElement("span", {
      className: "badge badge-gold"
    }, "\uD83C\uDFC5") : ready ? /*#__PURE__*/React.createElement("span", {
      className: "trow-p trow-yet"
    }, "\u307E\u3060") : /*#__PURE__*/React.createElement("span", {
      className: "badge badge-soon"
    }, "\u3053\u308C\u304B\u3089"));
  }));
}

/* ── 説明の1枚（ブロック1つぶん） ───────────────── */
function Brief({
  bid,
  prog,
  go,
  back
}) {
  const {
    card,
    block
  } = blockOf(bid);
  const st = prog[bid] || {};
  const G = engine(bid);
  const bs = G && G.kind === "rules" ? G.blocks() : [];
  const chunks = testChunks(bid);
  const spec = G ? G.spec : null;

  /* まだ中身を作っていないブロック。**押せなくするのではなく、
     何がここに入るのかを見せる。**進み具合で止めているわけではない */
  if (!isReady(bid)) {
    return /*#__PURE__*/React.createElement("div", {
      className: "wrap"
    }, /*#__PURE__*/React.createElement("div", {
      className: "head"
    }, /*#__PURE__*/React.createElement("button", {
      className: "back",
      onClick: back
    }, "\u2190 \u3082\u3069\u308B"), /*#__PURE__*/React.createElement("span", {
      className: "head-t"
    }, block.name), /*#__PURE__*/React.createElement("span", {
      className: "badge badge-soon"
    }, "\u3053\u308C\u304B\u3089")), /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, "\u3053\u3053\u306B\u5165\u308B\u554F\u984C"), /*#__PURE__*/React.createElement("div", {
      className: "brief-t"
    }, "\u904E\u53BB\u554F ", block.n, " \u554F"), /*#__PURE__*/React.createElement("div", {
      className: "brief-b"
    }, card.name, "\u306E\u672D\u306E ", block.name, " \u3067\u3059\u3002", card.note, "\u3002")), /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, "\u307E\u3060\u3067\u304D\u3066\u3044\u306A\u3044\u3053\u3068"), /*#__PURE__*/React.createElement("div", {
      className: "brief-b"
    }, "\u3053\u306E\u984C\u6750\u306E\u300C\u898B\u308B\u6240\u300D\u3068\u300C\u6C7A\u3081\u65B9\u300D\u3092\u3001\u904E\u53BB\u554F\u3068\u89E3\u8AAC\u304B\u3089\u8D77\u3053\u3059\u4F5C\u696D\u304C\u3053\u308C\u304B\u3089\u3067\u3059\u3002 \u3067\u304D\u308B\u3068\u3001\u307B\u304B\u306E\u30D6\u30ED\u30C3\u30AF\u3068\u540C\u3058\u3088\u3046\u306B\u3001\u7DF4\u7FD2\u3067\u899A\u3048\u3066\u304B\u3089\u30C6\u30B9\u30C8\u306B\u9032\u3081\u307E\u3059\u3002")), /*#__PURE__*/React.createElement("button", {
      className: "go",
      onClick: back
    }, "\u30D6\u30ED\u30C3\u30AF\u306E\u4E00\u89A7\u306B\u3082\u3069\u308B"));
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "wrap has-dock"
  }, /*#__PURE__*/React.createElement("div", {
    className: "head"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back",
    onClick: back
  }, "\u2190 \u3082\u3069\u308B"), /*#__PURE__*/React.createElement("span", {
    className: "head-t"
  }, block.name), st.badge && /*#__PURE__*/React.createElement("span", {
    className: "head-n"
  }, "\uD83C\uDFC5")), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u3053\u306E\u30D6\u30ED\u30C3\u30AF\u3067\u3084\u308B\u3053\u3068"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, spec ? spec.note : card.note, "\u3002\u6C7A\u3081\u624B\u306F\u6C7A\u307E\u3063\u305F\u6240\u306B\u3042\u308A\u307E\u3059\u3002 \u4E0A\u304B\u3089\u9806\u306B\u898B\u3066\u3044\u3063\u3066\u3001\u5F53\u305F\u3063\u305F\u3068\u3053\u308D\u3067\u7B54\u3048\u304C\u6C7A\u307E\u308A\u307E\u3059\u3002")), bs.length > 0 && /*#__PURE__*/React.createElement("div", {
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
  }, G.gloss(x.verdict))))))), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u30C6\u30B9\u30C8\u306E\u4E2D\u8EAB"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, "\u3053\u306E\u30D6\u30ED\u30C3\u30AF\u306E\u904E\u53BB\u554F ", bank(bid).length, " \u554F\u3092 ", chunks.length, " \u56DE\u306B\u5206\u3051\u3066\u3042\u308A\u307E\u3059\u3002 \u3069\u306E\u554F\u984C\u3082\u3001\u5FC5\u305A\u3069\u308C\u304B\u306E\u56DE\u306B\u5165\u3063\u3066\u3044\u307E\u3059\u3002 1\u554F\u307E\u3067\u9593\u9055\u3048\u3066\u3082\u3001\u305D\u306E\u56DE\u306B\u5370\u304C\u4ED8\u304D\u307E\u3059\u3002"), spec && spec.dropped && spec.dropped.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, "\u3053\u306E\u984C\u6750\u306E\u56F3\u8868\u554F\u984C\u306F\u5168\u90E8\u3067 ", bank(bid).length + spec.dropped.length, " \u554F\u3042\u308A\u307E\u3059\u304C\u3001", spec.dropped.length, " \u554F\u306F\u672C\u306E\u7B54\u3048\u304C\u51FA\u529B\u3068\u98DF\u3044\u9055\u3046\u305F\u3081\u5916\u3057\u3066\u3044\u307E\u3059\u3002"))), /*#__PURE__*/React.createElement("div", {
    className: "dock"
  }, /*#__PURE__*/React.createElement("button", {
    className: "go next",
    onClick: () => go("practice"),
    disabled: !bs.length
  }, "\u7DF4\u7FD2\u3092\u3059\u308B"), /*#__PURE__*/React.createElement("button", {
    className: "go next ghost",
    onClick: () => go("testpick")
  }, "\u30C6\u30B9\u30C8\u3092\u3059\u308B")));
}

/* ── どのテストを受けるか選ぶ ────────────────── */
function TestPick({
  bid,
  prog,
  go,
  back
}) {
  const {
    block
  } = blockOf(bid);
  const st = prog[bid] || {};
  const chunks = testChunks(bid);
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "head"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back",
    onClick: back
  }, "\u2190 \u3082\u3069\u308B"), /*#__PURE__*/React.createElement("span", {
    className: "head-t"
  }, block.name, "\u3000\u30C6\u30B9\u30C8")), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u3069\u306E\u30C6\u30B9\u30C8\u3092\u53D7\u3051\u307E\u3059\u304B"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, "\u3053\u306E\u30D6\u30ED\u30C3\u30AF\u3067\u899A\u3048\u305F\u6240\u304C\u3001\u305D\u306E\u307E\u307E\u30C6\u30B9\u30C8\u306E\u7BC4\u56F2\u3067\u3059\u3002 1\u554F\u307E\u3067\u9593\u9055\u3048\u3066\u3082\u3001\u305D\u306E\u56DE\u306B\u5370\u304C\u4ED8\u304D\u307E\u3059\u3002")), chunks.map((c, i) => {
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
  }));
}

/* ── 一問一答 ────────────────────────── */
function Drill({
  bid,
  mode,
  prog,
  setProg,
  back
}) {
  const {
    block
  } = blockOf(bid);
  const G = engine(bid);
  const ci = mode.indexOf("test:") === 0 ? parseInt(mode.slice(5), 10) : -1;
  const isTest = ci >= 0;
  const [plan] = useState(() => isTest ? makeTest(bid, ci) : makePractice(G));
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState(null); // 決まった時に押したもの（間違いのときだけ入る）
  const [got, setGot] = useState([]); // 当たった選択肢（答えが2つ以上のとき積む）
  const [done, setDone] = useState(false); // その問題の答え合わせが出ているか
  const [firstOk, setFirstOk] = useState(null);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(0);
  const [end, setEnd] = useState(false);
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
        }
      }
      return;
    }
    setPicked(o);
    setDone(true);
    if (firstOk === null) {
      setFirstOk(false);
      setAsked(asked + 1);
    }
  }
  /* やり直しは問題が上に出直すので、こちらも上へ戻す */
  function retry() {
    setPicked(null);
    setGot([]);
    setDone(false);
    toTop();
  }
  function next() {
    if (at + 1 >= plan.length) {
      const p = Object.assign({}, prog);
      const prev = p[bid] || {};
      const tests = Object.assign({}, prev.tests);
      if (isTest) {
        const t0 = tests[ci] || {};
        tests[ci] = {
          best: Math.max(t0.best || 0, score),
          badge: t0.badge || false || score >= passLine(plan.length)
        };
      }
      const all = testChunks(bid).length;
      let cleared = 0;
      for (let k = 0; k < all; k++) if (tests[k] && tests[k].badge) cleared++;
      p[bid] = {
        tests: tests,
        badge: all > 0 && cleared === all,
        practiced: prev.practiced || !isTest
      };
      setProg(p);
      setEnd(true);
      return;
    }
    setAt(at + 1);
    setPicked(null);
    setGot([]);
    setDone(false);
    setFirstOk(null);
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

  /* 練習の材料が作れないブロック（判定エンジンがない）で、空のまま入ったとき */
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
    }, "\u3053\u306E\u30D6\u30ED\u30C3\u30AF\u306E\u7DF4\u7FD2\u306F\u3001\u307E\u3060\u7528\u610F\u3067\u304D\u3066\u3044\u307E\u305B\u3093\u3002")), /*#__PURE__*/React.createElement("button", {
      className: "go",
      onClick: back
    }, "\u3082\u3069\u308B"));
  }
  if (end) {
    const need = passLine(plan.length);
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
    }, "\u3082\u3069\u308B"));
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
    }, G.gloss(it.b.verdict)), /*#__PURE__*/React.createElement("div", {
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
    const r = done ? G.judge(G.read(it.text)) : null;
    con = /*#__PURE__*/React.createElement(Console, {
      text: it.text,
      hits: r ? r.look : null
    });
    ask = "この出力で起きていることはどれですか。";
  } else {
    const r = done && G ? G.judge(G.read(it.q.exhibit)) : null;
    con = it.q.exhibit ? /*#__PURE__*/React.createElement(Console, {
      text: it.q.exhibit,
      hits: r ? r.look : null
    }) : null;
    ask = it.q.text;
  }
  /* 問題文が自分で「2つ選択」と言っているときは、重ねて書かない */
  if (rights.length > 1 && !/つ選|選択して/.test(ask)) {
    ask = ask + "（" + rights.length + "つ選びます）";
  }
  let note = null;
  if (done) {
    if (it.kind === "walk") {
      note = /*#__PURE__*/React.createElement(Note, {
        title: it.right,
        body: it.st.why,
        gloss: it.st.hit ? G.gloss(it.st.verdict) : ""
      });
    } else if (it.kind === "judge") note = /*#__PURE__*/React.createElement(Steps, {
      t: G.trace(it.text)
    });else note = /*#__PURE__*/React.createElement(Steps, {
      t: G && it.q.exhibit ? G.trace(it.q.exhibit) : null,
      answer: rights.join(" ／ "),
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
  })), note, !done ? /*#__PURE__*/React.createElement("div", {
    className: "src"
  }, "A\u301C", LETTERS[it.opts.length - 1], " \u304B 1\u301C", it.opts.length, " \u306E\u30AD\u30FC\u3067\u3082\u9078\u3079\u307E\u3059", rights.length > 1 && got.length > 0 && "　／　あと " + (rights.length - got.length) + " つ") : cram && !ok ? /*#__PURE__*/React.createElement("button", {
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
  const [cid, setCid] = useState(null); // 札
  const [bid, setBid] = useState(null); // ブロック
  const [mode, setMode] = useState(null); // null=説明 / "practice" / "testpick" / "test:N"
  const homeY = useRef(0);
  useEffect(() => {
    save(prog);
  }, [prog]);
  /* ホームに戻ったときだけ、見ていた所に戻す。ほかは上から */
  useEffect(() => {
    toTop(cid === null ? homeY.current : 0);
  }, [cid, bid, mode]);
  if (cid === null) {
    return /*#__PURE__*/React.createElement(Home, {
      prog: prog,
      open: id => {
        homeY.current = nowY();
        setCid(id);
        setBid(null);
        setMode(null);
      }
    });
  }
  if (bid === null) {
    return /*#__PURE__*/React.createElement(Card, {
      cid: cid,
      prog: prog,
      open: id => {
        setBid(id);
        setMode(null);
      },
      back: () => setCid(null)
    });
  }
  if (mode === null) {
    return /*#__PURE__*/React.createElement(Brief, {
      bid: bid,
      prog: prog,
      go: setMode,
      back: () => setBid(null)
    });
  }
  if (mode === "testpick") {
    return /*#__PURE__*/React.createElement(TestPick, {
      bid: bid,
      prog: prog,
      go: setMode,
      back: () => setMode(null)
    });
  }
  return /*#__PURE__*/React.createElement(Drill, {
    bid: bid,
    mode: mode,
    prog: prog,
    setProg: setProg,
    back: () => setMode(mode.indexOf("test:") === 0 ? "testpick" : null)
  });
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
