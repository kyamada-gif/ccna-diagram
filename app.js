/* 自動生成: build.js（app.jsx -> app.js）。手で編集せず app.jsx を直して再ビルド。 */
const { useState, useEffect, useLayoutEffect, useRef } = React;
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
 * 束B のうち、このアプリで出す分を問題の型で2枚に分け、その中を題材ごとのブロックに割る。
 * 「言葉と意味の組み合わせ」は wordmatch/、「足りない設定を選ぶ」は configpick/ に移した。
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
    n: 17
  }, {
    id: "json",
    name: "JSON の読み取り",
    n: 25
  }, {
    id: "rootbridge",
    name: "ルートブリッジの決まり方",
    n: 10
  }, {
    id: "ospf",
    name: "OSPF の隣接関係",
    n: 7
  }, {
    id: "ospfdr",
    name: "OSPF の代表ルータ",
    n: 2
  }]
}, {
  id: "misc",
  name: "図表付きの問題を覚える",
  note: "想定問題を、図や出力ごとそのまま覚えてから解く",
  blocks: [{
    id: "wlangui",
    name: "無線の画面を読む",
    n: 14
  }, {
    id: "nolink",
    name: "繋がらない原因を探す",
    n: 5
  }, {
    id: "misc",
    name: "その他",
    n: 11
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
/* 番号。トップの札が 1・2、その中の分野が 1.1・1.2 … */
/* 練習が「過去問を覚える」になる分野。**札2「そのほか」の3分野。**
   規則で解ける題材ではないので、本の問題をそのまま覚えてテストに進む */
const isLearnCard = id => {
  const b = blockOf(id);
  return !!b && b.card.id === "misc";
};
const cardNo = cid => CARDS.findIndex(c => c.id === cid) + 1;
const blockNo = (cid, bid) => {
  const c = CARDS.filter(x => x.id === cid)[0];
  return cardNo(cid) + "." + (c.blocks.findIndex(b => b.id === bid) + 1);
};
/* ── 名前の付け方（画面に出る言葉の決まり）──────────────
 * ここに全部まとめる。**画面のあちこちで別々に組み立てない。**
 *
 *   札      「1 出力を読んで当てる」          番号は 1〜2。ホームの小見出しにだけ出る
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
 * 分野は8ある。ホームの上に「n / 8 分野」と出す。
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
/* 字の大きさを、文の長さで決める。**折り返して単語が割れないように。**
   短い答え（配列・キー）は大きく、長い答え（インターフェースの設定…）は小さく */
function sizeOf(text, small) {
  const n = (text || "").length;
  if (small) return n > 26 ? " xs" : n > 16 ? " sm" : "";
  return n <= 5 ? " lg" : n <= 10 ? "" : n <= 16 ? " sm" : " xs";
}
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
/* 打ったコマンドの行か。**1行目を無条件にコマンド扱いしない。**
   show の出力や設定は「R1#show ip ospf interface」で始まるが、
   JSON の1行目は中身そのもの。コマンド扱いすると色が変わるうえ、
   決め手の行として光らせることもできなくなる */
const isCmd = line => /^\S*[#>]\s*\S/.test(line);

/* 行の中の、決め手の言葉だけを光らせる。
   **行ごと光らせると、どこを見ればいいのか分からない。**
   例「コロンの左」なら、その行の "firewall" だけを光らせたい */
function marked(line, marks) {
  if (!marks || !marks.length) return line;
  /* 長い言葉から先に当てる。短い言葉が先だと、長い言葉の一部を先に取ってしまう */
  const ws = marks.slice().sort((a, b) => b.length - a.length);
  const out = [];
  let rest = line,
    guard = 0;
  while (rest && guard++ < 200) {
    let at = -1,
      hit = null;
    ws.forEach(w => {
      if (!w) return;
      const i = rest.indexOf(w);
      if (i >= 0 && (at < 0 || i < at)) {
        at = i;
        hit = w;
      }
    });
    if (at < 0) {
      out.push(rest);
      break;
    }
    if (at > 0) out.push(rest.slice(0, at));
    out.push(/*#__PURE__*/React.createElement("span", {
      className: "cmark",
      key: out.length
    }, hit));
    rest = rest.slice(at + hit.length);
  }
  return out;
}
function Console({
  text,
  hits,
  marks
}) {
  const lines = text.split("\n");
  const head = isCmd(lines[0] || "");
  return /*#__PURE__*/React.createElement("pre", {
    className: "con"
  }, lines.map((line, i) => {
    const cmd = i === 0 && head;
    const on = !cmd && hits && hits.some(w => line.indexOf(w) >= 0);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "cline" + (cmd ? " ccmd" : "") + (on ? " chit" : "")
    }, cmd ? line : marked(line, marks));
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
    fig: o.fig || null,
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
    out.push(item({
      kind: "learn",
      exhibit: learnEx(G, b, i),
      extra: {
        block: b,
        i: i,
        of: bs.length
      }
    }));
    /* その確認項目の問題。**組み立てるのはエンジン側**（画面では作らない） */
    for (let n = 0; n < per; n++) {
      const q = G.stepQ(i, n);
      if (!q) continue;
      out.push(item({
        kind: q.kind,
        ask: q.ask,
        exhibit: asExhibit(q.exhibit),
        fig: q.fig || null,
        opts: q.opts,
        right: q.right,
        extra: Object.assign({}, q.extra, {
          i: q.extra.i,
          of: bs.length
        })
      }));
    }
  });
  for (let k = 0; k < 3; k++) {
    /* 何問目かを渡す。**分野によっては、問い方を変える**
       （OSPF の隣接関係は、2問目と3問目を「打つコマンドの並び」で出す） */
    const q = G.wholeQ(k);
    if (!q) continue;
    out.push(item({
      kind: q.kind,
      ask: q.ask,
      exhibit: asExhibit(q.exhibit),
      fig: q.fig || null,
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
  if (G.begin) G.begin();
  const bs = G.blocks();
  const out = [];
  const per = perSpot(G);
  idx.forEach(i => {
    if (!bs[i]) return;
    out.push(item({
      kind: "learn",
      exhibit: learnEx(G, bs[i], i),
      extra: {
        block: bs[i],
        i: i,
        of: bs.length
      }
    }));
    for (let n = 0; n < per; n++) {
      const q = G.stepQ(i, n);
      if (!q) continue;
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
/* 並びを必ず変える。**同じ並びが出ると、位置を覚えて押せてしまう。**
   1回混ぜただけでは、たまたま元と同じ並びになることがある */
function reshuffle(a) {
  if (!a || a.length < 2) return a;
  const same = x => x.every((v, i) => v === a[i]);
  let out = shuffleAny(a);
  for (let k = 0; k < 12 && same(out); k++) out = shuffleAny(a);
  return out;
}
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

/* 覚えた過去問を、答えを隠して解く。**札2「図表付きの問題を覚える」の練習。**
   出るのはテストと同じ本の問題。並びは毎回変える。得点は記録するが、バッジは付かない */
function makeCram(id) {
  return shuffleAny((bank(id) || []).slice()).map(q => asPast(q));
}
function makeTest(id, ci) {
  return shuffleAny(testChunks(id)[ci]).map(q => asPast(q));
}

/* ── 答えの出し方を、実際の数字で見せる ───────── */
/* 本の解説は、**文の途中で切らない。**
   前は 150字で機械的に切っていたので、札1だけで8問が文の途中で終わっていた。
   100字を過ぎたところにある最初の句点までを出す。句点が無ければ、そのまま全部出す */
function trimBook(t) {
  const s = String(t == null ? "" : t).trim();
  if (s.length <= 150) return s;
  const at = s.indexOf("。", 100);
  return at >= 0 ? s.slice(0, at + 1) : s;
}
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
    }, "\u60F3\u5B9A\u554F\u984C\u306E\u89E3\u8AAC\uFF1A", trimBook(book)));
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
  }, "\u60F3\u5B9A\u554F\u984C\u306E\u89E3\u8AAC\uFF1A", trimBook(book)));
}

/* ── 説明の1枚に添える一言 ────────────────────────
 * **並べて見比べるものが2つ以上あるときは、文章にしない。**
 * 「R1 には…、R2 には…」と書くと、読む人が頭の中で並べ直すことになる。
 * その形の一言は、文字列ではなく { rows: […] } で書く。
 *
 *   { h: "R1 の設定" }                      → 【R1 の設定】
 *   { c: "router ospf 1", m: "OSPF を動かす" } → ・router ospf 1　＝ OSPF を動かす
 *   { c: "…" }                              → ・…（コマンドだけ）
 *   { t: "この2行が無い" }                    → ・この2行が無い（コマンドでない行）
 *
 * **下に文章を足さない。**文章にしないための形なので、
 * 最後に一文を付けると元に戻ってしまう。要ることは行か見出しに入れる。
 *
 * **・ と ＝ は画面が付ける。**データに書くと二重になる（build.js が見る）。
 * 1つの事実だけの一言は、いままでどおり文字列のままでよい。
 */
function RuleNote({
  n
}) {
  if (typeof n === "string") return /*#__PURE__*/React.createElement("span", {
    className: "rule-n"
  }, n);
  return /*#__PURE__*/React.createElement("div", {
    className: "rule-nb"
  }, (n.rows || []).map((w, i) => w.h !== undefined ? /*#__PURE__*/React.createElement("div", {
    className: "rule-nh",
    key: i
  }, "\u3010", w.h, "\u3011") : /*#__PURE__*/React.createElement("div", {
    className: "rule-nr",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "rule-nd"
  }, "\u30FB"), w.c !== undefined && /*#__PURE__*/React.createElement("span", {
    className: "rule-nc"
  }, w.c), w.t !== undefined && /*#__PURE__*/React.createElement("span", null, w.t), w.m !== undefined && /*#__PURE__*/React.createElement("span", {
    className: "rule-nm"
  }, "\u3000\uFF1D ", w.m))));
}
function Note({
  title,
  body,
  gloss,
  book
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "note"
  }, /*#__PURE__*/React.createElement("div", {
    className: "note-t"
  }, title), gloss && /*#__PURE__*/React.createElement("div", {
    className: "gloss"
  }, gloss), body && (typeof body === "string" ? /*#__PURE__*/React.createElement("div", {
    className: "note-b"
  }, body) : /*#__PURE__*/React.createElement(RuleNote, {
    n: body
  })), book && /*#__PURE__*/React.createElement("div", {
    className: "note-b"
  }, "\u60F3\u5B9A\u554F\u984C\u306E\u89E3\u8AAC\uFF1A", trimBook(book)));
}

/* ── ホーム。札＝問題の型 ──────────────────────
 * **はじめは札だけ。押した札にだけ、2つのボタンが出る**（ipcalc2 と同じ）。
 * 鍵は無い。どの札も、練習もテストも、いつでも押せる。
 */
/* ── ホーム ───────────────────────────────
 * **この1枚に全部ある。**分野を選ぶための画面は作らない。
 * 8つの分野が縦に並び、行を押すとその場で開いて
 * 「練習をする」「テストをする」が出る。開くのは1行だけ。
 * 2つの札は、押せない小見出しとして行のかたまりを区切るだけ。
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
    }, "\u60F3\u5B9A\u554F\u984C ", n, " \u554F")), /*#__PURE__*/React.createElement(Mark, {
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
      disabled: !isLearnCard(b.id) && bs.length === 0,
      onClick: () => go(b.id, "practice")
    }, "\u7DF4\u7FD2\u3092\u3059\u308B"), /*#__PURE__*/React.createElement("button", {
      className: "go ghost",
      onClick: () => go(b.id, "test:0")
    }, "\u30C6\u30B9\u30C8\u3092\u53D7\u3051\u308B")) : /*#__PURE__*/React.createElement("div", {
      className: "row-d"
    }, "\u3053\u306E\u5206\u91CE\u306E\u300C\u78BA\u8A8D\u9805\u76EE\u300D\u3068\u300C\u6C7A\u3081\u65B9\u300D\u3092\u3001\u60F3\u5B9A\u554F\u984C\u3068\u89E3\u8AAC\u304B\u3089\u66F8\u304D\u8D77\u3053\u3059\u4F5C\u696D\u304C\u3053\u308C\u304B\u3089\u3067\u3059\u3002 \u3067\u304D\u308B\u3068\u3001\u307B\u304B\u306E\u5206\u91CE\u3068\u540C\u3058\u3088\u3046\u306B\u3001\u7DF4\u7FD2\u3067\u899A\u3048\u3066\u304B\u3089\u30C6\u30B9\u30C8\u306B\u9032\u3081\u307E\u3059\u3002")));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "legend"
  }, /*#__PURE__*/React.createElement("span", {
    className: "slot got"
  }, "\uD83C\uDFC5"), /*#__PURE__*/React.createElement("span", {
    className: "legend-t"
  }, "\u30D0\u30C3\u30B8\u306F\u5206\u91CE\u3054\u3068\u306B1\u3064\u3002\u305D\u306E\u5206\u91CE\u306E\u30C6\u30B9\u30C8\u30679\u5272\u6B63\u89E3\u3059\u308B\u3068\u4ED8\u304D\u307E\u3059\u3002")), /*#__PURE__*/React.createElement("button", {
    className: "wipe",
    onClick: () => {
      if (window.confirm("これまでの記録をすべて消します。よろしいですか。")) {
        STORE.wipe();
        window.location.reload();
      }
    }
  }, "\u8A18\u9332\u3092\u6D88\u3059"));
}

/* ── 論点（この問題の決め手と、答えの言葉）──────────────
 * points/<分野>.js に、過去問1問ずつの「決め手 → 答え」を書いてある。
 * **問題文（または提示物）と、正解の選択肢に、一字一句ある言葉だけ。**
 * 無ければ下線も決め手の行も出ない（画面は空くだけで、こわれない）。
 */
const pointOf = qid => typeof POINTS !== "undefined" && POINTS[String(qid).replace(/#\d+$/, "")] || null;
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* その言葉だけに下線を引く。**本文は変えない。**含まれない言葉は何もしない */
function Underline({
  text,
  keys,
  cls
}) {
  const t = String(text == null ? "" : text);
  const ws = (keys || []).filter(w => w && t.indexOf(w) >= 0);
  if (!ws.length) return /*#__PURE__*/React.createElement(React.Fragment, null, t);
  const re = new RegExp("(" + ws.map(escRe).join("|") + ")");
  return /*#__PURE__*/React.createElement(React.Fragment, null, t.split(re).map((s, i) => ws.indexOf(s) >= 0 ? /*#__PURE__*/React.createElement("b", {
    key: i,
    className: cls
  }, s) : s));
}

/* ── 覚える（過去問をそのまま覚える）────────────────
 * 札2「そのほか」の分野は、規則を組み立てて解くのではなく、
 * **本の問題を1問ずつ覚える。**練習で覚えて、テストで同じ問題を解く。
 *
 *   提示物（図・出力。無い問題もある）
 *   問題文        … 決め手の言葉に青い下線
 *   選択肢        … 正解を緑にし、答えの言葉に黄色い下線
 *   決め手の1行   … 「決め手 ◯◯ → ◯◯」
 *   覚え方        … 取り違えやすい所だけ（無くてよい）
 *   本の解説
 */
function Learn({
  bid,
  back,
  goPractice
}) {
  const qs = (bank(bid) || []).slice().sort(function (a, b) {
    return a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0;
  });
  const b = blockOf(bid);
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "head"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back",
    onClick: back
  }, "\u2190 \u30C8\u30C3\u30D7\u753B\u9762\u306B\u623B\u308B"), /*#__PURE__*/React.createElement("span", {
    className: "head-t"
  }, "\u899A\u3048\u308B"), /*#__PURE__*/React.createElement("span", {
    className: "head-n"
  }, qs.length, " \u554F")), /*#__PURE__*/React.createElement("div", {
    className: "lc-top"
  }, b ? b.block.name : "", "\u306E\u60F3\u5B9A\u554F\u984C\u3092\u30011\u554F\u305A\u3064\u899A\u3048\u307E\u3059\u3002 \u899A\u3048\u305F\u3089\u3001\u540C\u3058\u554F\u984C\u3092\u7B54\u3048\u3092\u96A0\u3057\u3066\u89E3\u304D\u307E\u3059\u3002"), qs.map((q, i) => {
    const it = asPast(q);
    const p = pointOf(q.qid);
    const rights = [].concat(it.right);
    return /*#__PURE__*/React.createElement("div", {
      className: "lc",
      key: q.qid
    }, /*#__PURE__*/React.createElement("div", {
      className: "lc-h"
    }, /*#__PURE__*/React.createElement("span", {
      className: "lc-n"
    }, i + 1, " / ", qs.length), /*#__PURE__*/React.createElement("span", {
      className: "lc-id"
    }, q.qid)), it.image && /*#__PURE__*/React.createElement(Scan, {
      image: it.image,
      alt: q.qid
    }), !it.image && it.fig && /*#__PURE__*/React.createElement(Figure, {
      fig: it.fig
    }), !it.image && it.exhibit && it.exhibit.kind === "topology" ? /*#__PURE__*/React.createElement(Figure, {
      fig: it.exhibit.fig
    }) : it.exhibit && it.exhibit.kind !== "topology" ? /*#__PURE__*/React.createElement(Console, {
      text: it.exhibit.text,
      hits: [],
      marks: p ? p.q : null
    }) : null, it.extra.maclist && /*#__PURE__*/React.createElement(MacList, {
      sw: it.extra.sw
    }), /*#__PURE__*/React.createElement("div", {
      className: "lc-q"
    }, /*#__PURE__*/React.createElement(Underline, {
      text: it.ask,
      keys: p ? p.q : null,
      cls: "uq"
    })), /*#__PURE__*/React.createElement("div", {
      className: "opts"
    }, it.opts.map((o, k) => {
      const right = rights.indexOf(o) >= 0;
      return /*#__PURE__*/React.createElement("div", {
        className: "opt " + (right ? "opt-ok" : "opt-off"),
        key: k
      }, /*#__PURE__*/React.createElement("span", {
        className: "opt-k"
      }, LETTERS[k] || ""), /*#__PURE__*/React.createElement("span", {
        className: "opt-t"
      }, right ? /*#__PURE__*/React.createElement(Underline, {
        text: String(o).replace(/\s+$/, ""),
        keys: p ? p.a : null,
        cls: "ua"
      }) : String(o).replace(/\s+$/, "")), right && /*#__PURE__*/React.createElement("span", {
        className: "opt-m"
      }, "\u2713"));
    })), p && /*#__PURE__*/React.createElement("div", {
      className: "pt"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pt-k"
    }, "\u6C7A\u3081\u624B"), /*#__PURE__*/React.createElement("span", {
      className: "pt-q"
    }, (p.q || []).join(" ・ ")), /*#__PURE__*/React.createElement("span", {
      className: "pt-arw"
    }, "\u2192"), /*#__PURE__*/React.createElement("span", {
      className: "pt-a"
    }, (p.a || []).join(" ・ "))), p && p.why && /*#__PURE__*/React.createElement("div", {
      className: "lc-b"
    }, p.why), p && p.tip && /*#__PURE__*/React.createElement("div", {
      className: "pt-tip"
    }, p.tip), q.explanation && trimBook(q.explanation).length >= 20 && /*#__PURE__*/React.createElement("div", {
      className: "lc-b"
    }, "\u60F3\u5B9A\u554F\u984C\u306E\u89E3\u8AAC\uFF1A", trimBook(q.explanation)));
  }), /*#__PURE__*/React.createElement("button", {
    className: "go dock",
    onClick: goPractice
  }, "\u3053\u306E\u5206\u91CE\u306E\u7DF4\u7FD2\u3092\u3059\u308B"));
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
  /* 覚えた過去問を解く回。作った問題ではなく、本の問題がそのまま出る */
  const isCram = mode === "cram";
  /* 札2「図表付きの問題を覚える」の分野かどうか。答え合わせの出し方が変わる */
  const isLearn = isLearnCard(bid);
  const [plan, setPlan] = useState(() => isTest ? makeTest(bid, ci) : isCram ? makeCram(bid) : makePractice(G, bid));
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
      set: isTest || isCram ? STORE.setKey(isTest ? testChunks(bid)[ci] : bank(bid) || []) : G && G.kind === "rules" ? "generated" : STORE.setKey(bank(bid) || []),
      of: qn,
      passLine: passLine(qn)
    });
  }
  const tries = useRef(0);
  const it = plan[at];
  const rights = it ? Array.isArray(it.right) ? it.right : [it.right] : [];
  const ok = done && picked === null;
  const cram = !isTest;

  /* 次の問題・結果の画面に移ったら、上から見せる。
     **描く前に戻す（useLayoutEffect）。**useEffect だと描き終わってから動くので、
     一瞬だけ前の位置が見えてしまう */
  useLayoutEffect(() => {
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
    } else if (it && it.opts && it.opts.length > 1) {
      /* **選択肢の並びを変える。**
         同じ並びのまま出すと、位置を覚えて機械的に押せてしまう。
         この教材は言葉を覚えるものではなく、**判断の道すじをたどるもの**なので、
         毎回いちから読み直してもらう */
      setPlan(p => p.map((x, i) => i === at ? Object.assign({}, x, {
        opts: reshuffle(x.opts)
      }) : x));
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
    }, "\u2190 \u30C8\u30C3\u30D7\u753B\u9762\u306B\u623B\u308B"), /*#__PURE__*/React.createElement("span", {
      className: "head-t"
    }, block.name)), /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("div", {
      className: "brief-b"
    }, "\u3053\u306E\u5206\u91CE\u306E\u7DF4\u7FD2\u306F\u3001\u307E\u3060\u7528\u610F\u3067\u304D\u3066\u3044\u307E\u305B\u3093\u3002")), /*#__PURE__*/React.createElement("button", {
      className: "go",
      onClick: back
    }, "\u30C8\u30C3\u30D7\u753B\u9762\u306B\u623B\u308B"));
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

  /* 決め手の行を光らせるための言葉。
     **確認項目の日本語名は、出力の中には書かれていない。**
     例「エリアの番号」は出力に無く、実際に書いてあるのは Internet address の行。
     そこで、分野が hits() を持っていれば、名前を「出力に実際にある文字」に置きかえる。
     持っていない分野は、いままでどおり名前のまま当てる */
  /* 行の中で光らせる言葉。分野が marks() を持っていれば使う。
     持っていなければ何も光らせない（いままでどおり） */
  const toMarks = look => {
    if (!look || !look.length) return null;
    if (!G || !G.spec || typeof G.spec.marks !== "function") return null;
    return look.reduce((a, w) => a.concat(G.spec.marks(w) || []), []);
  };
  const toHits = look => {
    if (!look || !look.length) return look;
    if (!G || !G.spec || typeof G.spec.hits !== "function") return look;
    return look.reduce((a, w) => a.concat(G.spec.hits(w) || [w]), []);
  };

  /* 確認項目の説明 */
  if (it.kind === "learn") {
    const lb = it.extra.block,
      li = it.extra.i,
      lof = it.extra.of;
    /* 短い説明を持っている分野は、そちらを出す。[{if, then, note}] の並び */
    const brief = G && G.spec && typeof G.spec.brief === "function" ? G.spec.brief(lb, li) : null;
    return /*#__PURE__*/React.createElement("div", {
      className: "wrap"
    }, /*#__PURE__*/React.createElement("div", {
      className: "head"
    }, /*#__PURE__*/React.createElement("button", {
      className: "back",
      onClick: back
    }, "\u2190 \u30C8\u30C3\u30D7\u753B\u9762\u306B\u623B\u308B"), /*#__PURE__*/React.createElement("span", {
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
    }, !brief && /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, G.kind === "match" ? li + 1 + " 番目に覚える用語" : li + 1 + " 番目の確認項目"), /*#__PURE__*/React.createElement("div", {
      className: "brief-t"
    }, lb.name)), it.exhibit && /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, !brief && /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, "\u3069\u3053\u306B\u66F8\u3044\u3066\u3042\u308B\u304B"), it.exhibit.image && /*#__PURE__*/React.createElement(Scan, {
      image: it.exhibit.image,
      alt: lb.name
    }), it.exhibit.text && G.spec && typeof G.spec.figFor === "function" && G.spec.figFor(it.exhibit.text) && /*#__PURE__*/React.createElement(Figure, {
      fig: G.spec.figFor(it.exhibit.text)
    }), it.exhibit.kind === "topology" ? /*#__PURE__*/React.createElement(Figure, {
      fig: it.exhibit.fig
    }) : it.exhibit.text ? /*#__PURE__*/React.createElement(Console, {
      text: it.exhibit.text,
      hits: toHits(lb.look),
      marks: toMarks(lb.look)
    }) : null), G.kind === "match" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "sec"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sec-l"
    }, "\u3053\u306E\u7528\u8A9E\u306B\u5F53\u3066\u306F\u307E\u308B\u8AAC\u660E\uFF08\u60F3\u5B9A\u554F\u984C\u304B\u3089\uFF09"), lb.learn.map((p, i) => /*#__PURE__*/React.createElement("div", {
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
    }, "\u3053\u3053\u306B\u6319\u3052\u305F ", lb.learn.length, " \u500B\u306E\u8AAC\u660E\u306F\u3001\u3044\u305A\u308C\u3082\u300C", lb.name, "\u300D\u3092\u6307\u3057\u3066\u3044\u307E\u3059\u3002", li + 1 < lof ? "次の用語へ進みます。" : "これが最後の用語です。"))) : brief ?
    /*#__PURE__*/
    /* ── 短い説明の1枚 ─────────────────────
     * **文字は読まれない。**見たらすぐ「こう来たら、こう答える」と
     * 分かる形だけを残す。分野が brief() を持っていれば、こちらを出す。
     * 持っていない分野は、下のいままでの形のまま */
    React.createElement("div", {
      className: "sec"
    }, brief.map((r, i) => /*#__PURE__*/React.createElement("div", {
      className: "rule",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "rule-if" + sizeOf(String(r.if), true)
    }, r.if), /*#__PURE__*/React.createElement("span", {
      className: "rule-ar"
    }, "\u25BC"), (Array.isArray(r.then) ? r.then : [r.then]).map((x, k) => /*#__PURE__*/React.createElement("span", {
      className: "rule-then" + sizeOf(String(x)),
      key: k
    }, x)), r.note && /*#__PURE__*/React.createElement(RuleNote, {
      n: r.note
    })))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
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
  /* ── 判定に渡す中身 ─────────────────────────
   * **問題文が決め手になる分野（`spec.wantsQuestion`）では、問題文もいっしょに渡す。**
   * 渡さないと提示物だけで判定してしまい、決め手が見つからず、
   * いちばん下の受け皿ルールに落ちる。答え合わせに別の問題の説明が出ていた
   * （本の問題 86問のうち 47問）。`build.js` は前から正しく渡していて、
   * 取りこぼしていたのは画面だけだった。
   *
   * **練習の問題は、そのままでよい。**作った提示物の1行目に問題文が入っているので、
   * 判定側（各分野の read）が自分でそこを読む。ここで ask を渡すと、
   * 問2の「決め手は『◯◯』です。」の中の言葉まで読んでしまう。
   */
  const jv = G && exv && G.spec && G.spec.wantsQuestion && it.kind === "past" ? {
    text: it.ask || "",
    exhibit: exv
  } : exv;
  /* 問題の画面で光らせる所。
     **確認項目の名前ではなく、その問題が実際に聞いている所を光らせる。**
     「IDS は何を表しますか」なら、光らせるのは IDS だけ。
     確認項目の名前（コロンの左）から引くと、キーを全部光らせてしまう。
     focus() を持たない分野は、いままでどおり確認項目の名前から引く */
  const look = it.kind === "step" ? it.extra.step.look : done && G && exv ? (G.judge(G.read(jv)) || {}).look : null;
  const focus = G && G.spec && typeof G.spec.focus === "function" && exv && (it.kind === "step" || done) ? G.spec.focus(G.read(jv)) : null;
  /* 「どの行を見ますか」の問題は、答えたあとに**その行を出力の中で光らせる。**
     どこにあったのかが、そこで初めて目で分かる。
     答える前は光らせない（答えが見えてしまう） */
  const lineAns = done && it.kind === "step" && typeof exv === "string" ? rights.map(String).filter(r => exv.split("\n").some(l => l.trim() === r.trim())) : [];
  /* 決め手型の分野では、**答えたあとに、決め手になった言葉を提示物の中で光らせる。**
     答える前は光らせない（答えが見えてしまう）。
     光らせる言葉は判定側が渡してくる（提示物から実際に読み取れた文字なので、必ずある） */
  /* **markNow の問題は、答える前から光らせる。**
     「光っている所を見て、どう判断しますか」という問いなので、
     答えたあとに光らせたのでは、問いが成り立たない */
  const cueMark = it.kind === "step" && it.extra.step && it.extra.step.mark && (done || it.extra.step.markNow) ? [].concat(it.extra.step.mark) : [];
  const hitWords = lineAns.length ? lineAns : cueMark.length ? [] : focus ? focus.hits : toHits(look);
  const markWords = lineAns.length ? null : cueMark.length ? cueMark : focus ? focus.marks : toMarks(look);
  const con = /*#__PURE__*/React.createElement(React.Fragment, null, it.image && /*#__PURE__*/React.createElement(Scan, {
    image: it.image,
    alt: it.note ? it.note.qid : ""
  }), !it.image && it.fig && /*#__PURE__*/React.createElement(Figure, {
    fig: it.fig
  }), !it.image && it.exhibit && it.exhibit.kind === "topology" ? /*#__PURE__*/React.createElement(Figure, {
    fig: it.exhibit.fig
  }) : it.exhibit && it.exhibit.kind !== "topology" ? /*#__PURE__*/React.createElement(Console, {
    text: it.exhibit.text,
    hits: hitWords,
    marks: markWords
  }) : null, it.extra.maclist && /*#__PURE__*/React.createElement(MacList, {
    sw: it.extra.sw
  }));
  /* 読み取った値の札は出さない。
     **問いが本物の問いになったので、値を抜き出して見せると
     読む練習ごと答えを渡してしまう。**
     例「その優先度のルータ 1 台」と出ると、答えが決まることまで先に分かる。
     決め手の語は提示物の中で光るので、どこを見るかは伝わる。
     答え合わせでは、いままでどおり数字を出す（answerNote の body） */
  const vals = null;
  let ask = it.ask || "";
  /* 問題文が自分で「2つ選択」と言っているときは、重ねて書かない */
  /* 結ぶ問題は「いくつ選ぶ」ではないので、この一言を足さない */
  if (it.kind !== "match" && rights.length > 1 && !/つ選|選択して/.test(ask)) {
    ask = ask + "（" + rights.length + "つ選びます）";
  }

  /* 本の答えでしか出せない問題（`spec.bookOnly`）。
     判定ルールでは答えが出せないので、**こちらの説明は出さない。本の解説だけを出す。**
     出すと、まったく別のルールの説明が並ぶ
     （機器への入り方の B3-M1-092 は、本の答えが「SW3」なのに
       「username（名前）secret（パスワード）で作成する」が出ていた） */
  const bookOnly = !!(it.note && G && G.spec && (G.spec.bookOnly || []).indexOf(it.note.qid) >= 0);

  /* 提示物ぜんぶを見て答える問題（テストの本の問題・練習の最後の3問）の答え合わせ。
     **いま見ている確認項目は無い**ので、st は渡さない */
  const fullNote = done && !bookOnly && it.kind !== "step" && it.kind !== "match" && G && G.spec && typeof G.spec.answerNote === "function" && exv ? G.spec.answerNote(G.read(jv)) : null;

  /* 札2「図表付きの問題を覚える」の答え合わせ。
     **覚える画面と同じものを出す。**別の言い方の説明が2つあると、どちらを覚えるのか分からなくなる */
  const learnPoint = isLearn && done && it.kind === "past" && it.note ? pointOf(it.note.qid) : null;
  let note = null;
  if (done) {
    if (it.kind === "step") {
      const st = it.extra.step;
      /* 答え合わせの言葉。分野が answerNote() を持っていれば、そちらを使う。
         **決まりと、この場合の数字を、別々の行に出す。**
         持っていない分野は、いままでどおり判定ルールの文をそのまま出す */
      /* **いま見ている確認項目も渡す。**渡さないと、提示物ぜんぶを見て
         最後の答えを出してしまい、まだ見ていない所の解説が出てしまう */
      const sn = G && G.spec && typeof G.spec.answerNote === "function" && exv ? G.spec.answerNote(G.read(jv), st) : null;
      note = /*#__PURE__*/React.createElement(Note, {
        title: it.right[0],
        body: sn ? sn.body : st.why,
        gloss: sn ? sn.gloss : st.hit ? G.gloss(st.verdict) : ""
      });
    } else if (learnPoint) {
      const bk = it.note && it.note.explanation ? trimBook(it.note.explanation) : "";
      note = /*#__PURE__*/React.createElement("div", {
        className: "note"
      }, /*#__PURE__*/React.createElement("div", {
        className: "note-t"
      }, rights.join(" ／ ")), /*#__PURE__*/React.createElement("div", {
        className: "pt"
      }, /*#__PURE__*/React.createElement("span", {
        className: "pt-k"
      }, "\u6C7A\u3081\u624B"), /*#__PURE__*/React.createElement("span", {
        className: "pt-q"
      }, (learnPoint.q || []).join(" ・ ")), /*#__PURE__*/React.createElement("span", {
        className: "pt-arw"
      }, "\u2192"), /*#__PURE__*/React.createElement("span", {
        className: "pt-a"
      }, (learnPoint.a || []).join(" ・ "))), learnPoint.why && /*#__PURE__*/React.createElement("div", {
        className: "note-b"
      }, learnPoint.why), learnPoint.tip && /*#__PURE__*/React.createElement("div", {
        className: "pt-tip"
      }, learnPoint.tip), bk.length >= 20 && /*#__PURE__*/React.createElement("div", {
        className: "note-b"
      }, "\u60F3\u5B9A\u554F\u984C\u306E\u89E3\u8AAC\uFF1A", bk));
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
      }, "\u60F3\u5B9A\u554F\u984C\u306E\u89E3\u8AAC\uFF1A", trimBook(it.note.explanation))) : /*#__PURE__*/React.createElement(React.Fragment, null, it.image && it.exhibit && it.exhibit.kind === "topology" && /*#__PURE__*/React.createElement(Figure, {
        fig: it.exhibit.fig
      }), fullNote ? /*#__PURE__*/React.createElement(Note, {
        title: it.note ? rights.join(" ／ ") : it.right[0] || "",
        gloss: fullNote.gloss,
        body: fullNote.body,
        book: it.note ? it.note.explanation : null
      }) : /*#__PURE__*/React.createElement(Steps, {
        t: G && exv && !bookOnly ? G.trace(jv) : null,
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
  }, "\u2190 \u30C8\u30C3\u30D7\u753B\u9762\u306B\u623B\u308B"), /*#__PURE__*/React.createElement("span", {
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
    }, String(o).replace(/\s+$/, "")), done && right || hitYet ? /*#__PURE__*/React.createElement("span", {
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
  /* 分野・やり方が変わったときも、描く前に戻す。
     ホームへ戻るときだけは、見ていた行の位置に戻す */
  useLayoutEffect(() => {
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
  /* 札2「そのほか」の分野は、練習が「過去問を覚える」画面になる。
     ほかの分野は、いままでどおり作った問題を解く（Drill） */
  if (mode === "practice" && isLearnCard(bid)) {
    return /*#__PURE__*/React.createElement(Learn, {
      key: bid + "/learn",
      bid: bid,
      back: () => {
        setOpen(bid);
        setMode(null);
      }
      /* 覚えたら、同じ問題を答えを隠して解く */,
      goPractice: () => setMode("cram")
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
