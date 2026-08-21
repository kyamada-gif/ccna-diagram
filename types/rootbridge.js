/* 「ルートブリッジの決まり方」ブロックの中身（目標2.5・過去問23問）。
 *
 * show interface のブロックと形は同じ（spots / rules / makers）だが、
 * **提示物がテキストではなく図**なので、次の3つを自分で持つ。
 *   read    … 図の中身（fig）から値を読む
 *   excerpt … 決め手だけを残す
 *   answer  … 答えが決まった言葉ではなく、その場のスイッチ名になる
 *
 * 判定は2本だけ。過去問23問すべてで本の答えと一致する。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "pri", name: "ブリッジ優先度",
      mean: "そのスイッチがルートブリッジに選ばれやすいかどうかを決める設定値。既定は 32768 で、値が小さいほど選ばれやすい",
      use: "各スイッチの優先度を比べて、値が最も小さいスイッチを探す。それが1台だけなら、そのスイッチがルートブリッジになる。同じ値のスイッチが2台以上あるときは、次に MACアドレスを比べる" },
    { key: "mac", name: "MACアドレス",
      mean: "機器ごとに割り当てられた固有の番号。16進数（0〜9 と a〜f）で書く",
      use: "優先度が最も小さいスイッチが2台以上あるときに見る。その中で MACアドレスが小さいほうがルートブリッジになる。比べ方は左の文字から順で、差がついたところで決まる。数字は英字より小さい（0 < 9 < a < f）" }
  ];

  /* ── 図から値を読む ─────────────────────────
   * 返すのは「4台の並び」と、そこから作った手がかり。
   */
  /* MACアドレスの小さい順。左の文字から順に比べる（16進数なので 0 < 9 < a < f） */
  function byHex(a, b) { return a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0; }

  function read(fig) {
    var sw = (fig && fig.sw ? fig.sw : []).map(function (s) {
      return { id: s.id, pri: s.pri, mac: s.mac, hex: String(s.mac || "").replace(/:/g, "").toLowerCase() };
    });
    var lowest = sw.length ? Math.min.apply(null, sw.map(function (s) { return s.pri; })) : 0;
    var tied = sw.filter(function (s) { return s.pri === lowest; });
    var win = tied.slice().sort(byHex)[0];
    return { sw: sw, lowest: lowest, tied: tied, win: win || null };
  }

  /* 答え。その場のスイッチ名になる */
  function answer(v) { return v.win ? v.win.id : ""; }

  function listPri(v) {
    return v.sw.map(function (s) { return s.id + " " + s.pri; }).join("　");
  }
  /* 優先度が並んだ分だけを、MACアドレスの小さい順に並べる。
     **並べ替えて ＜ でつなぐ。**図の順のまま並べても、どちらが小さいのかは伝わらない。
     左に来たものがルートブリッジ */
  function listMac(v) {
    return v.tied.slice().sort(byHex).map(function (s) {
      return s.id + " " + s.mac;
    }).join(" ＜ ");
  }

  /* ── 判定ルール。上から順に当てて、最初に当たったところで決める ── */
  var RULES = [
    { key: "pri", cond: "優先度が最も小さいスイッチが1台だけ",
      verdict: "ブリッジ優先度で決まる",
      why: "優先度が最も小さいスイッチが1台しかないので、MACアドレスを見るまでもなくルートブリッジが決まる",
      look: ["ブリッジ優先度"],
      steps: function (v) {
        return [["最も小さい優先度", v.lowest], ["その優先度のスイッチ", v.tied.length + " 台"],
                ["4台の優先度", listPri(v)]];
      },
      no: function (v) {
        return "最も小さい優先度 " + v.lowest + " のスイッチが " + v.tied.length + " 台あるので、これだけでは決まらない";
      },
      test: function (v) { return v.tied.length === 1; } },

    { key: "mac", cond: "優先度が最も小さいスイッチが2台以上",
      verdict: "MACアドレスで決まる",
      why: "優先度では差がつかないので、その中で MACアドレスが小さいほうがルートブリッジになる",
      look: ["MACアドレス"],
      steps: function (v) {
        return [["最も小さい優先度", v.lowest], ["その優先度のスイッチ", v.tied.length + " 台"],
                ["比べる MACアドレス", listMac(v)]];
      },
      no: function (v) {
        return "最も小さい優先度 " + v.lowest + " のスイッチが1台だけなので、MACアドレスを見るまでもない";
      },
      test: function (v) { return v.tied.length >= 2; } }
  ];

  var GLOSS = {
    "ブリッジ優先度で決まる": "優先度の値が最も小さいスイッチがルートブリッジになる",
    "MACアドレスで決まる": "優先度が並んだときの決め方。MACアドレスが小さいほうがルートブリッジになる"
  };

  /* ── 図を作る ─────────────────────────────
   * 4台を四角に並べ、優先度と MACアドレス を配る。
   * 「線」は答えに関係しないので、いつも同じつなぎ方でよい。
   */
  var NAMES = [["SW1", "SW2", "SW3", "SW4"], ["MDF-DC-1", "MDF-DC-2", "MDF-DC-3", "MDF-DC-4"]];
  var PRIS = [4096, 8192, 12288, 16384, 20480, 24576, 28672, 32768, 36864, 40960, 45056, 49152, 53248, 57344, 61440];

  function hex2() { return ("0" + R(0, 255).toString(16)).slice(-2); }
  function mac() {
    var out = [];
    for (var i = 0; i < 6; i++) out.push(hex2());
    return out.join(":");
  }

  function baseVals() {
    var names = pick(NAMES);
    return { names: names, pris: null, macs: null };
  }

  function build(v) {
    var sw = v.names.map(function (id, i) {
      return { id: id, pri: v.pris[i], mac: v.macs[i] };
    });
    var n = v.names;
    return {
      sw: sw,
      link: [[n[0], "Gi1/0/1", n[1], "Gi1/0/1"], [n[0], "Gi1/0/3", n[3], "Gi1/0/1"],
             [n[0], "Gi1/0/2", n[2], "Gi1/0/3"], [n[1], "Gi1/0/2", n[2], "Gi1/0/1"],
             [n[3], "Gi1/0/2", n[2], "Gi1/0/2"]],
      host: []
    };
  }

  /* 4つとも違う MACアドレス を作る */
  function macs4() {
    var out = [];
    while (out.length < 4) {
      var m = mac();
      if (out.indexOf(m) < 0) out.push(m);
    }
    return out;
  }

  var MAKERS = {
    /* 優先度だけで決まる：いちばん小さい数を1台だけにする */
    pri: function (b) {
      var lo = pick(PRIS.slice(0, 10));
      var hi = PRIS.filter(function (p) { return p > lo; });
      b.pris = [lo, pick(hi), pick(hi), pick(hi)];
      b.pris = E.shuffle(b.pris);
      b.macs = macs4();
      return b;
    },
    /* MACアドレスで決まる：いちばん小さい数を2台にする */
    mac: function (b) {
      var lo = pick(PRIS.slice(0, 10));
      var hi = PRIS.filter(function (p) { return p > lo; });
      b.pris = E.shuffle([lo, lo, pick(hi), pick(hi)]);
      b.macs = macs4();
      return b;
    }
  };

  /* ── 練習の問題文と選択肢 ─────────────────────
   * **「この値なら、どうしますか」では何を聞かれているか分からない。**
   * 何を見て、何が決まるのかを、そのまま文にする。
   *   ブリッジ優先度 を確認しました。次にどうしますか。
   *     ・ブリッジ優先度 で SW4 に決まる
   *     ・ここでは決まらない。次に MACアドレス を確認する
   */
  function walkQ(st, v, shuffle) {
    /* 問題文の上に出る値の表は空にする。
       「その優先度のスイッチ 1 台」まで先に出ると、答える前に答えが見えてしまう。
       見るものは図の中にすべて書いてある */
    st.values = [];
    var look = st.look.join(" と ");
    var ans = v.win ? v.win.id : "";
    var others = v.sw.map(function (s) { return s.id; })
      .filter(function (id) { return id !== ans; });
    var right, opts;
    /* **「ここで決まりますか」とは聞かない。**
       何も起きていない所でそう聞かれても、何を答えればよいのか分からない。
       値は図に書いてあるので、「次にどうするか」だけを聞く */
    if (st.hit) {
      right = "ここで決まる。答えは " + ans;
      opts = [right,
              "ここでは決まらない。次に " + (st.next || "ほかの所") + " を確認する",
              "ここで決まる。答えは " + pick(others)];
    } else {
      right = "ここでは決まらない。次に " + st.next + " を確認する";
      opts = [right,
              "ここで決まる。答えは " + ans,
              "ここで決まる。答えは " + pick(others)];
    }
    /* 同じ文が2つ出ないようにする */
    var seen = {}, uniq = [];
    opts.forEach(function (o) { if (!seen[o]) { seen[o] = 1; uniq.push(o); } });
    return { ask: look + " を確認しました。次にどうしますか。",
             opts: shuffle(uniq), right: right };
  }

  /* 決め手だけを残す。図はそのまま、答えに関係しない線を落とす */
  function excerpt(fig, look) {
    return { sw: fig.sw, link: [], host: [] };
  }

  function sample() {
    return {
      sw: [{ id: "SW1", pri: 8192, mac: "00:24:98:6f:3b:41" },
           { id: "SW2", pri: 16384, mac: "00:24:98:6f:3b:43" },
           { id: "SW3", pri: 32768, mac: "00:24:98:6f:3b:42" },
           { id: "SW4", pri: 8192, mac: "00:24:98:6f:3b:40" }],
      link: [["SW1", "Gi1/0/1", "SW2", "Gi1/0/1"], ["SW1", "Gi1/0/3", "SW4", "Gi1/0/1"],
             ["SW1", "Gi1/0/2", "SW3", "Gi1/0/3"], ["SW2", "Gi1/0/2", "SW3", "Gi1/0/1"],
             ["SW4", "Gi1/0/2", "SW3", "Gi1/0/2"]],
      host: []
    };
  }

  /* ── 説明の1枚に出す見本 ──────────────────────
   * 提示物は図だが、説明の画面は図を出せない（app.jsx の learn は文字だけを出す）。
   * そこで、図の箱と同じ3つ（名前・優先度・MACアドレス）を4行の文字にして出す。
   * 確認項目ごとに1枚。**変えるのは SW3 の優先度だけ。**
   *   1 ブリッジ優先度 … 4096 が SW2 の1台だけ。SW2 に決まる
   *   2 MACアドレス   … 4096 が SW2 と SW3 の2台。MACアドレスが小さい SW3 に決まる
   * 同じ4台のまま優先度が1つ変わると答えが入れかわるので、
   * 2枚を続けて見ると、2つ目の確認項目が何のためにあるのかが分かる。
   */
  var LEARN = [
    [{ id: "SW1", pri: 32768, mac: "00:10:a1:6c:11:40" },
     { id: "SW2", pri: 4096, mac: "00:10:a1:b4:2f:07" },
     { id: "SW3", pri: 32768, mac: "00:10:a1:3a:9d:52" },
     { id: "SW4", pri: 32768, mac: "00:10:a1:c7:60:18" }],
    [{ id: "SW1", pri: 32768, mac: "00:10:a1:6c:11:40" },
     { id: "SW2", pri: 4096, mac: "00:10:a1:b4:2f:07" },
     { id: "SW3", pri: 4096, mac: "00:10:a1:3a:9d:52" },
     { id: "SW4", pri: 32768, mac: "00:10:a1:c7:60:18" }]
  ];
  /* 優先度のけたをそろえる。数の大小は、けたがそろっていないと見比べられない */
  function pad5(v) { return ("     " + v).slice(-5); }
  function learnEx(block, i) {
    return (LEARN[i] || []).map(function (s) {
      return s.id + "  優先度 " + pad5(s.pri) + "  " + s.mac;
    }).join("\n");
  }

  /* ── どこを光らせるか ────────────────────
   * 上の見本の中で、その確認項目で見比べる所だけを光らせる。
   *   hits  … 塗る行。1つ目は4台とも見るので塗らない。
   *           2つ目は、優先度が並んだ2台の行だけを塗る
   *   marks … 行の中で光らせる言葉。見比べる数そのもの
   * **問題の画面では効かない。**提示物が図（SVG）で、行という単位が無いため。
   */
  function marks(name) {
    if (name === "ブリッジ優先度") {
      var out = [];
      LEARN[0].forEach(function (s) {
        var p = String(s.pri);
        if (out.indexOf(p) < 0) out.push(p);
      });
      return out;
    }
    if (name === "MACアドレス") {
      return read({ sw: LEARN[1] }).tied.map(function (s) { return s.mac; });
    }
    return [];
  }
  function hits(name) {
    if (name !== "MACアドレス") return [];
    return read({ sw: LEARN[1] }).tied.map(function (s) { return s.id; });
  }

  /* ── 短い説明の1枚 ────────────────────────
   * **文字は読まれない。**見たらすぐ「こう来たら、こう答える」と
   * 分かる形だけを残す。上の見本と合わせて、見る所と答えを1組ずつ出す。
   */
  var BRIEF = [
    [{ if: "優先度が最も小さいスイッチが1台",
       then: "そのスイッチがルートブリッジ",
       note: "既定は 32768。小さいほうが選ばれる（OSPF の代表ルータは大きいほう）" }],
    [{ if: "優先度が並んだ",
       then: "MACアドレスが小さいほう",
       note: "左の文字から順に比べる。数字は英字より小さい（0 < 9 < a < f）" }]
  ];
  function brief(block, i) { return BRIEF[i] || null; }

  /* ── 答え合わせの言葉 ───────────────────────
   * **決まりと、この図の数字を、別々の行に出す。**同じことを2回書かない。
   *   決まり  「優先度が最も小さいスイッチが1台 ＝ そのスイッチがルートブリッジ」
   *   この図  「優先度 4096 は SW2 だけ」
   * 説明の1枚（brief）と同じ書き方にそろえてある。
   */
  /* 答え合わせの言葉。
   * **いま見ている確認項目のことだけを書く。**
   * 優先度の所で決まらなかったのに「MACアドレスが小さいほう」まで書くと、
   * まだ見ていない所の答えを先に見せてしまう。
   */
  function answerNote(v, st) {
    if (!v || !v.sw.length || !v.win) return null;
    var tied = v.tied.length;
    /* 練習の1問ずつ。決まらなかったときは、次に何を見るかまで */
    /* 決まらなかったとき。**次にどうするかは、答えの行にもう書いてある。**
       ここに書くのは「なぜ決まらないか」だけ */
    if (st && !st.hit) {
      return { gloss: "",
               body: "優先度 " + v.lowest + " のスイッチが " + tied +
                     " 台あるので、優先度だけでは決まらない" };
    }
    if (tied === 1) {
      return { gloss: "優先度が最も小さいスイッチが1台 ＝ そのスイッチがルートブリッジ",
               body: "優先度 " + v.lowest + " は " + v.win.id + " だけ" };
    }
    return { gloss: "優先度が並んだ ＝ MACアドレスが小さいほう",
             body: "優先度 " + v.lowest + " が " + tied + " 台。" + listMac(v) };
  }

  var spec = {
    id: "rootbridge",
    kind: "rules",
    view: "topology",          /* 画面は図で出す */
    card: "read",
    name: "ルートブリッジの決まり方",
    note: "つながったスイッチの中から、代表を1台決める",
    obj: "2.5",
    spots: SPOTS, rules: RULES, gloss: GLOSS,
    read: read, answer: answer, excerpt: excerpt,
    /* 図ぜんぶを見て答える問題の、聞き方 */
    ask: "この構成の中で、どのスイッチがルートブリッジになりますか。",
    walk: walkQ,
    /* 説明の1枚（見本と、短い決まり）と、答え合わせの言葉 */
    learnEx: learnEx, hits: hits, marks: marks,
    brief: brief, answerNote: answerNote,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample,
    expect: { spots: 2, rules: 2, questions: 23 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.rootbridge = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
