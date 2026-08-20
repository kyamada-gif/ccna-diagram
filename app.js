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
/* 番号。トップの札が 1・2・3・4、その中の分野が 1.1・1.2 … */
const cardNo = cid => CARDS.findIndex(c => c.id === cid) + 1;
const blockNo = (cid, bid) => {
  const c = CARDS.filter(x => x.id === cid)[0];
  return cardNo(cid) + "." + (c.blocks.findIndex(b => b.id === bid) + 1);
};
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
  /* 判定エンジンを持たないブロック（言葉と意味の組み合わせなど）は、
     **過去問そのものを練習にする。**間違えたら、正解するまでやり直す形。
     テストは同じ問題を、点を付けて解く（lpic-reflex と同じ考え方） */
  if (!G || G.kind !== "rules") {
    const qs = bank(id) || [];
    if (!qs.length) return [];
    return shuffleAny(qs).map(q => asPast(q));
  }
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
    [true, false].forEach(hit => {
      const r = G.reach(i, hit);
      if (!r) return;
      const st = r.step;
      /* 聞き方と選択肢を、その題材が自分で持っているときは、そちらを使う。
         **画面側では文を組み立てない**（判定と同じ考え方） */
      let ask, opts, right;
      if (G.spec.walk) {
        const w = G.spec.walk(st, G.read(r.text), G.shuffle);
        ask = w.ask;
        opts = w.opts;
        right = w.right;
      } else {
        right = st.hit ? "答えは「" + st.verdict + "」" : "次に " + st.next + " を見る";
        opts = [right];
        if (st.hit) {
          if (st.next) opts.push("次に " + st.next + " を見る");
        } else {
          opts.push("答えは「" + st.verdict + "」");
        }
        const other = G.shuffle(G.VERDICTS.filter(v => v !== st.verdict))[0];
        if (other) opts.push("答えは「" + other + "」");
        opts = G.shuffle(opts.slice(0, 3));
        ask = "この値なら、どうしますか。";
      }
      out.push(item({
        kind: "step",
        ask: ask,
        exhibit: asExhibit(r.text),
        opts: opts,
        right: right,
        extra: {
          step: st,
          i: i,
          of: bs.length
        }
      }));
    });
  });
  for (let k = 0; k < 3; k++) {
    const g = G.makeAny();
    if (!g.text) continue;
    const r = G.RULES.filter(x => x.key === g.key)[0];
    /* 答えが「その場の選択肢」になるブロック（ルートブリッジなど）は、
       誤答も同じ提示物の中の別のものから作る */
    let opts, right;
    if (G.answer) {
      const v = G.read(g.text);
      right = G.answer(v);
      opts = G.shuffle(v.sw.map(x => x.id));
    } else {
      right = r.verdict;
      opts = G.shuffle([r.verdict].concat(G.shuffle(G.VERDICTS.filter(v => v !== r.verdict)).slice(0, 3)));
    }
    out.push(item({
      kind: "whole",
      ask: G.spec && G.spec.ask || "この出力で起きていることはどれですか。",
      exhibit: asExhibit(g.text),
      opts: opts,
      right: right,
      extra: {
        i: bs.length,
        of: bs.length
      }
    }));
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

/* 過去問1問を、画面が読む形にする */
function asPast(q) {
  return item({
    kind: "past",
    ask: q.text,
    exhibit: asExhibit(q.fig || q.exhibit || null),
    image: q.image || null,
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

/* 判定エンジンが無いブロックでも混ぜられるように */
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
function Home({
  prog,
  go
}) {
  const [pick, setPick] = useState(null);
  const done = CARDS.filter(c => c.blocks.every(b => prog.blocks[b.id] && prog.blocks[b.id].badge)).length;
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
    const clear = c.blocks.filter(b => prog.blocks[b.id] && prog.blocks[b.id].badge).length;
    return /*#__PURE__*/React.createElement("div", {
      className: "road",
      key: c.id
    }, i > 0 && /*#__PURE__*/React.createElement("div", {
      className: "link"
    }), /*#__PURE__*/React.createElement("div", {
      className: "tile" + (clear === c.blocks.length ? " tile-clear" : "") + (pick === c.id ? " pick" : "")
    }, /*#__PURE__*/React.createElement("div", {
      className: "t-top"
    }, /*#__PURE__*/React.createElement("button", {
      className: "t-h",
      onClick: () => setPick(pick === c.id ? null : c.id)
    }, /*#__PURE__*/React.createElement("span", {
      className: "tile-n"
    }, i + 1), /*#__PURE__*/React.createElement("span", {
      className: "tile-b"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tile-t"
    }, c.name), /*#__PURE__*/React.createElement("span", {
      className: "tile-s"
    }, c.note, "\u3000\uFF0F\u3000", c.blocks.length, " \u30D6\u30ED\u30C3\u30AF\u30FB\u904E\u53BB\u554F ", cardCount(c), " \u554F"))), clear === c.blocks.length ? /*#__PURE__*/React.createElement("span", {
      className: "badge badge-gold"
    }, "\uD83C\uDFC5") : /*#__PURE__*/React.createElement("span", {
      className: "trow-p"
    }, ready.length, " / ", c.blocks.length, " \u3067\u304D\u3066\u3044\u307E\u3059")), pick === c.id && /*#__PURE__*/React.createElement("div", {
      className: "t-go"
    }, /*#__PURE__*/React.createElement("button", {
      className: "go",
      onClick: () => go(c.id, "practice")
    }, "\u7DF4\u7FD2\u3092\u3059\u308B"), /*#__PURE__*/React.createElement("button", {
      className: "go",
      onClick: () => go(c.id, "test")
    }, "\u30C6\u30B9\u30C8\u3092\u3059\u308B"))));
  }), /*#__PURE__*/React.createElement("div", {
    className: "foot"
  }, "\u56F3\u8868\u554F\u984C\u306F\u5168\u90E8\u3067 335 \u554F\u3042\u308A\u307E\u3059\u3002\u3069\u306E\u554F\u984C\u3082\u3001\u5FC5\u305A\u3069\u308C\u304B\u306E\u672D\u306E\u3069\u308C\u304B\u306E\u30D6\u30ED\u30C3\u30AF\u306B\u5165\u308A\u307E\u3059\u3002 \u3044\u307E\u4E2D\u8EAB\u304C\u3067\u304D\u3066\u3044\u308B\u306E\u306F\u300Cshow interface \u306E\u969C\u5BB3\u300D\u3060\u3051\u3067\u3059\u3002"));
}

/* ── どの分野をやるか選ぶ ───────────────────────
 * 上のタブで分野（ブロック）を選び、中身を見てから、
 * いちばん下のボタンで始める。練習もテストも同じ形。
 */
/* 上のタブ＋中身＋いちばん下のボタン */
function Choose({
  cid,
  kind,
  bid,
  prog,
  setBid,
  start,
  back
}) {
  const c = CARDS.filter(x => x.id === cid)[0];
  const block = c.blocks.filter(b => b.id === bid)[0] || c.blocks[0];
  const isPractice = kind === "practice";
  const st = prog.blocks[block.id] || {};
  const G = engine(block.id);
  const bs = G && G.kind === "rules" ? G.blocks() : [];
  const chunks = testChunks(block.id);
  const spec = G ? G.spec : null;
  const ready = isReady(block.id);
  const canGo = isPractice ? bs.length > 0 || ready && !G : chunks.length > 0;
  let nextRound = 0;
  for (let i = 0; i < chunks.length; i++) {
    const r = (st.rounds || {})[STORE.setKey(chunks[i])] || {};
    if (!r.passed) {
      nextRound = i;
      break;
    }
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
  }, cardNo(cid), " ", c.name, "\u3000", isPractice ? "練習" : "テスト"), st.badge && /*#__PURE__*/React.createElement("span", {
    className: "head-n"
  }, "\uD83C\uDFC5")), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u3069\u306E\u5206\u91CE\u3092\u3084\u308A\u307E\u3059\u304B")), /*#__PURE__*/React.createElement("div", {
    className: "tabs"
  }, c.blocks.map(b => /*#__PURE__*/React.createElement("button", {
    key: b.id,
    className: "tab" + (b.id === block.id ? " on" : "") + (isReady(b.id) ? "" : " tab-yet"),
    onClick: () => setBid(b.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "tab-n"
  }, blockNo(cid, b.id)), b.name))), !ready ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u3053\u3053\u306B\u5165\u308B\u554F\u984C"), /*#__PURE__*/React.createElement("div", {
    className: "brief-t"
  }, "\u904E\u53BB\u554F ", block.n, " \u554F"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, c.note, "\u3002")), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u307E\u3060\u3067\u304D\u3066\u3044\u306A\u3044\u3053\u3068"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, "\u3053\u306E\u984C\u6750\u306E\u300C\u898B\u308B\u6240\u300D\u3068\u300C\u6C7A\u3081\u65B9\u300D\u3092\u3001\u904E\u53BB\u554F\u3068\u89E3\u8AAC\u304B\u3089\u8D77\u3053\u3059\u4F5C\u696D\u304C\u3053\u308C\u304B\u3089\u3067\u3059\u3002 \u3067\u304D\u308B\u3068\u3001\u307B\u304B\u306E\u5206\u91CE\u3068\u540C\u3058\u3088\u3046\u306B\u3001\u7DF4\u7FD2\u3067\u899A\u3048\u3066\u304B\u3089\u30C6\u30B9\u30C8\u306B\u9032\u3081\u307E\u3059\u3002"))) : isPractice ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u3053\u306E\u5206\u91CE\u3067\u3084\u308B\u3053\u3068"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, spec ? spec.note + "。決め手は決まった所にあります。上から順に見ていって、当たったところで答えが決まります。" : c.note + "。1問ずつ出します。間違えたら、正解するまでやり直します。")), bs.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u898B\u308B\u9806\u756A\uFF08\u4E0A\u304B\u3089\u4E00\u500B\u305A\u3064\u899A\u3048\u307E\u3059\uFF09"), /*#__PURE__*/React.createElement("div", {
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
  }, "\u7DF4\u7FD2\u306E\u4E2D\u8EAB"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, bs.length > 0 ? "見る所ごとに、覚える1枚とその所の問題2問。最後に、出力ぜんぶで判定する問題が3問あります。" : bank(block.id).length + " 問を、順番を混ぜて1問ずつ出します。点は付きません。"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-l"
  }, "\u30C6\u30B9\u30C8\u306E\u4E2D\u8EAB"), /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, "\u3053\u306E\u5206\u91CE\u3067\u899A\u3048\u305F\u6240\u304C\u3001\u305D\u306E\u307E\u307E\u30C6\u30B9\u30C8\u306E\u7BC4\u56F2\u3067\u3059\u3002 \u904E\u53BB\u554F ", bank(block.id).length, " \u554F\u3092 ", chunks.length, " \u56DE\u306B\u5206\u3051\u3066\u3042\u308A\u307E\u3059\u3002 1\u554F\u307E\u3067\u9593\u9055\u3048\u3066\u3082\u3001\u305D\u306E\u56DE\u306B\u5370\u304C\u4ED8\u304D\u307E\u3059\u3002"), spec && spec.dropped && spec.dropped.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "brief-b"
  }, "\u3053\u306E\u984C\u6750\u306E\u56F3\u8868\u554F\u984C\u306F\u5168\u90E8\u3067 ", bank(block.id).length + spec.dropped.length, " \u554F\u3042\u308A\u307E\u3059\u304C\u3001", spec.dropped.length, " \u554F\u306F\u672C\u306E\u7B54\u3048\u304C\u51FA\u529B\u3068\u98DF\u3044\u9055\u3046\u305F\u3081\u5916\u3057\u3066\u3044\u307E\u3059\u3002")), chunks.map((ch, i) => {
    const r = (st.rounds || {})[STORE.setKey(ch)] || {};
    return /*#__PURE__*/React.createElement("button", {
      className: "trow",
      key: i,
      onClick: () => start("test:" + i)
    }, /*#__PURE__*/React.createElement("span", {
      className: "trow-n"
    }, i + 1), /*#__PURE__*/React.createElement("span", {
      className: "trow-b"
    }, /*#__PURE__*/React.createElement("span", {
      className: "trow-t"
    }, "\u30C6\u30B9\u30C8 ", i + 1), /*#__PURE__*/React.createElement("span", {
      className: "trow-s"
    }, ch.length, " \u554F\u3000", ch[0].qid, " \u301C ", ch[ch.length - 1].qid)), r.passed ? /*#__PURE__*/React.createElement("span", {
      className: "badge badge-gold"
    }, "\uD83C\uDFC5") : r.best !== null && r.best !== undefined ? /*#__PURE__*/React.createElement("span", {
      className: "trow-p"
    }, r.best, " / ", ch.length) : /*#__PURE__*/React.createElement("span", {
      className: "trow-p trow-yet"
    }, "\u307E\u3060"));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dock"
  }, /*#__PURE__*/React.createElement("button", {
    className: "go next",
    disabled: !canGo,
    onClick: () => start(isPractice ? "practice" : "test:" + nextRound)
  }, isPractice ? "この分野を練習する" : "テスト " + (nextRound + 1) + " を受ける")));
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
  const [plan] = useState(() => isTest ? makeTest(bid, ci) : makePractice(G, bid));
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState(null); // 決まった時に押したもの（間違いのときだけ入る）
  const [got, setGot] = useState([]); // 当たった選択肢（答えが2つ以上のとき積む）
  const [done, setDone] = useState(false); // その問題の答え合わせが出ているか
  const [firstOk, setFirstOk] = useState(null);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(0);
  const [end, setEnd] = useState(false);
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
      spot: it.kind === "step" ? it.extra.step.look.join(" と ") : null,
      firstOk: ok,
      tries: tries.current,
      picked: picked,
      right: rights,
      ms: Date.now() - at0.current
    });
    at0.current = Date.now();
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
    const need = rec.current.passLine;
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
    }, "\u898B\u308B\u6240\u3000", li + 1, " / ", lof), /*#__PURE__*/React.createElement("span", {
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
    }, li + 1, " \u756A\u76EE\u306B\u898B\u308B\u6240"), /*#__PURE__*/React.createElement("div", {
      className: "brief-t"
    }, lb.name)), /*#__PURE__*/React.createElement("div", {
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
    }, li + 1 < lof ? "決まらなければ、次の所を見ます。" : "ここまでで決まらないときの、最後の所です。")), /*#__PURE__*/React.createElement("button", {
      className: "go",
      onClick: next
    }, "\u3053\u306E\u6240\u306E\u554F\u984C\u3078\uFF08Enter\uFF09"));
  }

  /* **kind で場合分けしない。**あるものを出すだけ */
  const exv = exValue(it.exhibit);
  const hitWords = it.kind === "step" ? it.extra.step.look : done && G && exv ? (G.judge(G.read(exv)) || {}).look : null;
  const con = /*#__PURE__*/React.createElement(React.Fragment, null, it.image ? /*#__PURE__*/React.createElement(Scan, {
    image: it.image,
    alt: it.note ? it.note.qid : ""
  }) : it.exhibit && it.exhibit.kind === "topology" ? /*#__PURE__*/React.createElement(Figure, {
    fig: it.exhibit.fig
  }) : it.exhibit ? /*#__PURE__*/React.createElement(Console, {
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
  if (rights.length > 1 && !/つ選|選択して/.test(ask)) {
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
      note = /*#__PURE__*/React.createElement(React.Fragment, null, it.image && it.exhibit && it.exhibit.kind === "topology" && /*#__PURE__*/React.createElement(Figure, {
        fig: it.exhibit.fig
      }), /*#__PURE__*/React.createElement(Steps, {
        t: G && exv ? G.trace(exv) : null,
        answer: it.note ? rights.join(" ／ ") : null,
        book: it.note ? it.note.explanation : null
      }));
    }
  }
  const head = isTest ? "テスト " + (ci + 1) : it.kind === "step" ? "見る所　" + (it.extra.i + 1) + " / " + it.extra.of : it.kind === "past" ? "練習" : "ぜんぶ見て判定";
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
  }, at + 1 >= plan.length ? "結果を見る（Enter）" : "次へ（Enter）"), it.note && /*#__PURE__*/React.createElement("div", {
    className: "src"
  }, it.note.qid));
}
function App() {
  const [prog, setProg] = useState(loadState);
  const [cid, setCid] = useState(null); // 札
  const [kind, setKind] = useState(null); // "practice" / "test"
  const [bid, setBid] = useState(null); // 分野（ブロック）
  const [mode, setMode] = useState(null); // null=分野を選ぶ / "practice" / "test:N"
  const homeY = useRef(0);
  /* ホームに戻ったときだけ、見ていた所に戻す。ほかは上から */
  useEffect(() => {
    toTop(cid === null ? homeY.current : 0);
  }, [cid, kind, bid, mode]);
  if (cid === null) {
    return /*#__PURE__*/React.createElement(Home, {
      prog: prog,
      go: (c, k) => {
        homeY.current = nowY();
        const card = CARDS.filter(x => x.id === c)[0];
        const first = card.blocks.filter(b => isReady(b.id))[0] || card.blocks[0];
        setCid(c);
        setKind(k);
        setBid(first.id);
        setMode(null);
      }
    });
  }
  if (mode === null) {
    return /*#__PURE__*/React.createElement(Choose, {
      cid: cid,
      kind: kind,
      bid: bid,
      prog: prog,
      setBid: id => setBid(id),
      start: m => setMode(m),
      back: () => {
        setCid(null);
        setKind(null);
        setBid(null);
      }
    });
  }
  return /*#__PURE__*/React.createElement(Drill, {
    bid: bid,
    mode: mode,
    prog: prog,
    setProg: setProg,
    back: () => setMode(null)
  });
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
