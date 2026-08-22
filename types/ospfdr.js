/* 「OSPF の代表ルータ」ブロックの中身（目標3.4・過去問2問）。
 *
 * 同じ線につながったルータの中から、代表（DR）を1台決める。
 * **ルートブリッジ（types/rootbridge.js）とまったく同じ作りで、向きだけが逆。**
 *   スイッチのルートブリッジ … 数が小さい方が勝つ
 *   ルータの DR              … 数が大きい方が勝つ
 * 本の解説の言い方では「スイッチは小、ルーターは大」。
 *
 * 提示物はテキストではなく図なので、rootbridge と同じく次の3つを自分で持つ。
 *   read    … 図の中身（fig）から値を読む
 *   excerpt … 決め手だけを残す
 *   answer  … 答えが決まった言葉ではなく、その場のルータ名になる
 *
 * 「OSPF の隣接関係」（types/ospf.js）と分けてある理由は、そちらの覚え書きに書いた。
 * ひとことで言うと、提示物が図とテキストで違い、答えもルータ名とコマンドで違うため。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick, n = E.n;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "pri", name: "OSPF の優先度",
      mean: "そのルータが代表に選ばれやすいかどうかを決める設定値。0 から 255 までの数で、大きいほど選ばれやすい",
      use: "各ルータの優先度を比べて、値が最も大きいルータを探す。それが1台だけなら、そのルータが代表になる。同じ値のルータが2台以上あるときは、次にルータ ID を比べる。スイッチのルートブリッジは値が小さいほうが選ばれるが、OSPF の代表は大きいほうが選ばれる。ここは逆なので注意する" },

    { key: "rid", name: "ルータ ID",
      mean: "OSPF がそのルータを見分けるための番号。IP アドレスと同じ形式で、ピリオドで区切った4つの数字で書く",
      use: "優先度が最も大きいルータが2台以上あるときに見る。その中でルータ ID が大きいほうが代表になる。比べ方は左の数字から順で、差がついたところで決まる。図にルータ ID が書かれていないときは Loopback インターフェースのアドレス、それも無ければインターフェースの IP アドレスがルータ ID になる" }
  ];

  /* ── 図から値を読む ─────────────────────────
   * ルータ ID が書いていないときの決まり（Loopback → IP アドレス）も、ここで当てる。
   * これは値の読み方であって、判定ルールではない。
   */
  function key(rid) {
    var p = String(rid || "").split(".");
    var out = "", i;
    for (i = 0; i < 4; i++) out += ("00" + (parseInt(p[i], 10) || 0)).slice(-3);
    return out;
  }
  function from(s) {
    if (s.rid) return { rid: s.rid, src: "ルータ ID" };
    if (s.lo) return { rid: s.lo, src: "Loopback" };
    return { rid: s.ip || "", src: "IP アドレス" };
  }

  function read(fig) {
    var list = (fig && (fig.node || fig.sw)) || [];
    var node = list.map(function (s) {
      var f = from(s);
      return { id: s.id, pri: n(s.pri), rid: f.rid, src: f.src, key: key(f.rid) };
    });
    var top = node.length
      ? Math.max.apply(null, node.map(function (x) { return x.pri; })) : 0;
    var tied = node.filter(function (x) { return x.pri === top; });
    var win = tied.slice().sort(byKeyDesc)[0];
    /* sw は画面側（app.jsx）が誤答を作るのに使う並び。node と同じもの */
    return { node: node, sw: node, top: top, tied: tied, win: win || null };
  }

  /* 答え。その場のルータ名になる */
  function answer(v) { return v.win ? v.win.id : ""; }

  function listPri(v) {
    return v.node.map(function (x) { return x.id + " " + x.pri; }).join("　");
  }
  /* 優先度が並んだ分だけを、ルータ ID の大きい順に並べる。
     **並べ替えて ＞ でつなぐ。**図の順のまま並べても、どちらが大きいのかは伝わらない。
     左に来たものが代表ルータ */
  function byKeyDesc(a, b) { return a.key < b.key ? 1 : a.key > b.key ? -1 : 0; }
  /* ルータ ID の行が無いルータは、Loopback やインターフェースの IP アドレスが
     そのまま番号になる。**どこの値を比べているのかを書く。**
     数字だけ並べると、図のどの行を見ればいいのか分からない */
  function listRid(v, max) {
    var s = v.tied.slice().sort(byKeyDesc);
    if (max && s.length > max) s = s.slice(0, max);
    return s.map(function (x) {
      return x.id + " " + x.rid + (x.src === "ルータ ID" ? "" : "（" + x.src + "）");
    }).join(" ＞ ");
  }

  /* ── 判定ルール。上から順に当てて、最初に当たったところで決める ── */
  var RULES = [
    { key: "pri", cond: "優先度が最も大きいルータが1台だけ",
      verdict: "OSPF の優先度で決まる",
      why: "優先度が最も大きいルータが1台しかないので、ルータ ID を見るまでもなく代表が決まる",
      look: ["OSPF の優先度"],
      steps: function (v) {
        return [["最も大きい優先度", v.top],
                ["その優先度のルータ", v.tied.length + " 台"],
                ["各ルータの優先度", listPri(v)]];
      },
      no: function (v) {
        return "優先度が最も大きい " + v.top + " のルータが " + v.tied.length +
               " 台あるので、優先度だけでは代表が決まらない";
      },
      test: function (v) { return v.tied.length === 1; } },

    { key: "rid", cond: "優先度が最も大きいルータが2台以上",
      verdict: "ルータ ID で決まる",
      why: "優先度では差がつかないので、その中でルータ ID が大きいほうが代表になる",
      look: ["ルータ ID"],
      steps: function (v) {
        return [["最も大きい優先度", v.top],
                ["その優先度のルータ", v.tied.length + " 台"],
                ["比べるルータ ID", listRid(v)]];
      },
      no: function (v) {
        return "優先度が最も大きい " + v.top +
               " のルータが1台だけなので、ルータ ID を見るまでもない";
      },
      test: function (v) { return v.tied.length >= 2; } }
  ];

  var GLOSS = {
    "OSPF の優先度で決まる": "優先度の値が最も大きいルータが代表になる",
    "ルータ ID で決まる": "優先度が並んだときの決め方。ルータ ID が大きいほうが代表になる"
  };

  /* ── 図を作る ─────────────────────────────
   * 中央にスイッチを1台置き、まわりに4台のルータをぶら下げる（shape: "star"）。
   * 線は答えに関係しないので、いつも同じつなぎ方でよい。
   */
  var AT = ["top", "left", "right", "bottom"];
  var NAMES = [["R2", "R1", "R4", "R3"], ["R1", "R2", "R3", "R4"],
               ["R11", "R12", "R13", "R14"]];
  var PRIS = [1, 2, 5, 20, 50, 100, 106, 108, 120, 150, 200, 204, 240, 255];
  var PORTS = ["Gi0/0", "Gi0/1", "g0/0", "g0/1"];

  /* 見分ける番号に使う値。**本の図に出てくるのと同じ書き方にそろえる。**
     前は 140.33.197.68 のような値をその場で作っていたが、本の図は
     1.1.1.1・4.4.4.4・2.2.2.1・192.168.2.6 のような値しか出てこない */
  var IDS = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4", "5.5.5.5", "9.9.9.9",
             "10.10.10.10", "10.1.1.1", "10.1.1.2", "172.16.0.1",
             "192.168.1.1", "192.168.1.2"];
  /* Loopback のアドレスは、機器ごとに1つだけ置く小さな番号。
     ルータ ID に使うものと同じ書き方だが、本の図では 2.2.2.1 のような値が出る */
  var LOS = ["1.1.1.1", "2.2.2.1", "3.3.3.1", "4.4.4.1", "5.5.5.1", "9.9.9.1",
             "10.0.0.1", "172.16.1.1"];

  /* 4台ぶんの「見分ける番号」と、その**書き場所**を決める。
   * 書き場所は3通り。**本の2問は、どちらもこの3通りが混ざっている。**
   *   rid … ルータ ID の行がある
   *   lo  … ルータ ID が無く、Loopback のアドレスがある
   *   ip  … どちらも無く、インターフェースの IP アドレスがそのまま番号になる
   * 前はどの図にも必ずルータ ID が書いてあり、**テストに出る形が練習に一度も出なかった。**
   */
  function idPlan(ips) {
    for (var t = 0; t < 40; t++) {
      var srcs = [0, 1, 2, 3].map(function () {
        var r = R(1, 10);
        return r <= 6 ? "rid" : r <= 8 ? "lo" : "ip";
      });
      var pool = E.shuffle(IDS), lop = E.shuffle(LOS);
      var p = 0, q = 0, vals = [], seen = {}, ok = true, i;
      for (i = 0; i < 4; i++) {
        vals.push(srcs[i] === "ip" ? ips[i]
                : srcs[i] === "lo" ? lop[q++] : pool[p++]);
      }
      vals.forEach(function (x) {
        var k = key(x);
        if (seen[k]) ok = false;
        seen[k] = 1;
      });
      if (ok) return { srcs: srcs, vals: vals };
    }
    return { srcs: ["rid", "rid", "rid", "rid"], vals: E.shuffle(IDS).slice(0, 4) };
  }

  function baseVals() {
    var third = R(1, 250);
    var ips = [0, 1, 2, 3].map(function (i) { return "192.168." + third + "." + (i * 2 + 1); });
    return {
      names: pick(NAMES), pid: pick([1, 10, 100]), port: pick(PORTS),
      ips: ips, plan: idPlan(ips), pris: null
    };
  }

  function build(v) {
    return {
      shape: "star",
      hub: "スイッチ",
      title: "OSPF " + v.pid,
      node: v.names.map(function (id, i) {
        var s = v.plan.srcs[i], val = v.plan.vals[i];
        return { id: id, at: AT[i], port: v.port, ip: v.ips[i],
                 lo: s === "lo" ? val : null,
                 rid: s === "rid" ? val : null,
                 pri: v.pris[i], tag: null };
      }),
      maclist: false,
      figvals: true
    };
  }

  var MAKERS = {
    /* 優先度だけで決まる：いちばん大きい数を1台だけにする */
    pri: function (b) {
      var hi = pick(PRIS.slice(4));
      var lo = PRIS.filter(function (p) { return p < hi; });
      b.pris = E.shuffle([hi, pick(lo), pick(lo), pick(lo)]);
      return b;
    },
    /* ルータ ID で決まる：いちばん大きい数を2台にする */
    rid: function (b) {
      var hi = pick(PRIS.slice(4));
      var lo = PRIS.filter(function (p) { return p < hi; });
      b.pris = E.shuffle([hi, hi, pick(lo), pick(lo)]);
      return b;
    }
  };

  /* ── 練習の問題文と選択肢 ─────────────────────
   *   OSPF の優先度 を確認しました。次にどうしますか。
   *     ・OSPF の優先度 で R4 に決まる
   *     ・ここでは決まらない。次に ルータ ID を確認する
   */
  function walkQ(st, v, shuffle) {
    var look = st.look.join(" と ");
    var ans = v.win ? v.win.id : "";
    var others = v.node.map(function (x) { return x.id; })
      .filter(function (id) { return id !== ans; });
    var right, opts;
    /* **「ここで決まりますか」とは聞かない。**
       何も起きていない所でそう聞かれても、何を答えればよいのか分からない。
       値は図に書いてあるので、「次にどうするか」だけを聞く */
    /* **問いは、本物の問い。**「ここで決まりますか」とは聞かない。
       代わりに「◯◯だけでは決められない」を選択肢に混ぜる。
       その選択肢が、次の確認項目へ進む思考をそのまま教える */
    var undecided = look + " だけでは決められない";
    if (st.hit) {
      right = ans;
      /* **次の確認項目があるときだけ**「決められない」を誤答に混ぜる。
         最後の確認項目でこれを出すと、正しくない選び方を教えてしまう */
      opts = [right].concat(st.next ? [undecided] : [])
        .concat(shuffle(others).slice(0, st.next ? 2 : 3));
    } else {
      /* **決まらない問題では、最後まで見たときの答えを誤答に入れない。**
         図には MACアドレス（ルータ ID）も書かれているので、その答えを並べると
         「決められない」とその答えの2つが正解になってしまう */
      right = undecided;
      opts = [right].concat(shuffle(others.filter(function (id) {
        return id !== ans;
      })).slice(0, 3));
    }
    var seen = {}, uniq = [];
    opts.forEach(function (o) { if (!seen[o]) { seen[o] = 1; uniq.push(o); } });
    return { ask: spec.ask,
             opts: shuffle(uniq), right: right };
  }

  /* 決め手だけを残す。図に書いてある数がそのまま決め手なので、図はそのまま出す */
  function excerpt(fig, look) {
    return {
      shape: "star", hub: fig.hub, title: fig.title,
      node: fig.node || fig.sw, maclist: false, figvals: true
    };
  }

  function sample() {
    return {
      shape: "star", hub: "スイッチ", title: "OSPF 1",
      node: [
        { id: "R2", at: "top", port: "Gi0/0", ip: null, lo: "2.2.2.1",
          rid: "192.168.2.1", pri: 1, tag: null },
        { id: "R1", at: "left", port: "Gi0/1", ip: "192.168.2.8", lo: null,
          rid: "1.1.1.1", pri: 108, tag: "DR" },
        { id: "R4", at: "right", port: "Gi0/1", ip: "192.168.2.4", lo: null,
          rid: "4.4.4.4", pri: 204, tag: null },
        { id: "R3", at: "bottom", port: "Gi0/0", ip: "192.168.2.6", lo: null,
          rid: null, pri: 106, tag: null }
      ],
      maclist: false, figvals: true
    };
  }

  /* ── 説明の1枚に出す見本 ──────────────────────
   * 提示物は図だが、説明の画面は図を出せない（app.jsx の learn は文字だけを出す）。
   * そこで、図の箱と同じ3つ（名前・優先度・ルータ ID）を4行の文字にして出す。
   * 確認項目ごとに1枚。**変えるのは R2 の優先度だけ。**
   *   1 OSPF の優先度 … 255 が R3 の1台だけ。R3 に決まる
   *   2 ルータ ID     … 255 が R2 と R3 の2台。ルータ ID が大きい R2 に決まる
   * 同じ4台のまま優先度が1つ変わると答えが入れかわるので、
   * 2枚を続けて見ると、2つ目の確認項目が何のためにあるのかが分かる。
   *
   * **ルータ ID は必ず書く。**書かないと read が Loopback や
   * インターフェースの IP アドレスから補ってしまい、
   * 「比べるルータ ID」に出る値が、見本の行と食い違う。
   *
   * ルータ ID は 3.3.3.3 と 10.10.10.10 にしてある。
   * 左の数字から順に比べると 10 のほうが大きい。
   * 文字の並びとして左から1字ずつ見ると 1 より 3 のほうが大きく見えるので、
   * 数として比べることが、この見本でそのまま分かる。
   */
  /* R3 には**わざとルータ ID の行を書かない。**Loopback のアドレスが
     そのまま番号になる、という本の形（B2-0076-01）をここで見せておく。
     この形は練習の図にも出るので、見本と問題で見え方がそろう */
  var LEARN = [
    [{ id: "R1", pri: 100, rid: "1.1.1.1" },
     { id: "R2", pri: 100, rid: "10.10.10.10" },
     { id: "R3", pri: 255, lo: "3.3.3.3" },
     { id: "R4", pri: 100, rid: "4.4.4.4" }],
    [{ id: "R1", pri: 100, rid: "1.1.1.1" },
     { id: "R2", pri: 255, rid: "10.10.10.10" },
     { id: "R3", pri: 255, lo: "3.3.3.3" },
     { id: "R4", pri: 100, rid: "4.4.4.4" }]
  ];
  /* **問題と同じ図で出す。**前は文字4行の表だったので、
     説明の1枚と問題とで、値の置き場所が変わっていた。
     光らせるのは **優先度がいちばん大きいルータ**。決まりは2枚とも同じで、
     1枚目は1台だけ光り、2枚目は並んだ2台が光る */
  function learnEx(block, i) {
    var list = LEARN[i] || [];
    return {
      shape: "star", hub: "スイッチ", title: "OSPF 1", figvals: true, maclist: false,
      node: list.map(function (s, k) {
        return { id: s.id, at: AT[k], port: "Gi0/0", ip: "192.168.2." + (k * 2 + 1),
                 lo: s.lo || null, rid: s.rid || null, pri: s.pri, tag: null };
      }),
      mark: read({ node: list }).tied.map(function (x) { return x.id; })
    };
  }

  /* ── どこを光らせるか ────────────────────
   * **この分野では持たない。**提示物も説明の1枚も図（SVG）で、
   * 行という単位が無いので、行や言葉を光らせる仕掛けは効かない。
   * 見比べるルータの箱は、図のほうで光らせる（learnEx が返す fig.mark）。
   */

  /* ── 短い説明の1枚 ────────────────────────
   * **文字は読まれない。**見たらすぐ「こう来たら、こう答える」と
   * 分かる形だけを残す。上の見本と合わせて、見る所と答えを1組ずつ出す。
   * ルートブリッジと向きが逆なので、そこだけ補足に1行入れる。
   */
  var BRIEF = [
    [{ if: "優先度が最も大きいルータが1台",
       then: "そのルータが代表ルータ（DR）",
       note: "既定は 1。大きいほうが選ばれる（スイッチのルートブリッジは小さいほう）" }],
    [{ if: "優先度が並んだ",
       then: "ルータ ID が大きいほう",
       /* **並べて見比べるものは、文章にしない。**値は上の見本（LEARN）から作る */
       note: { rows: [{ h: "優先度が同じ2台" }]
           .concat(LEARN[1].filter(function (s) { return s.pri === 255; })
             .map(function (s) {
               var f = from(s);
               return { c: s.id + "  " + f.src + " " + f.rid };
             }))
           .concat([{ t: "ルータ ID の行が無ければ Loopback、それも無ければ IP アドレス" },
                    { t: "10 と 3 では 10 のほうが大きいので R2" },
                    { t: "文字の並びではなく、数として比べる" }]) } }]
  ];
  function brief(block, i) { return BRIEF[i] || null; }

  /* ── 答え合わせの言葉 ───────────────────────
   * **決まりと、この図の数字を、別々の行に出す。**同じことを2回書かない。
   *   決まり  「優先度が最も大きいルータが1台 ＝ そのルータが代表ルータ（DR）」
   *   この図  「優先度 255 は R3 だけ」
   * 説明の1枚（brief）と同じ書き方にそろえてある。
   *
   * **いま見ている確認項目のことだけを書く。**
   * 優先度の所で決まらなかったのに「ルータ ID が大きいほう」まで書くと、
   * まだ見ていない所の答えを先に見せてしまう。
   */
  function answerNote(v, st) {
    if (!v || !v.node.length || !v.win) return null;
    var tied = v.tied.length;
    /* 決まらなかったとき。**次にどうするかは、答えの行にもう書いてある。**
       ここに書くのは「なぜ決まらないか」だけ */
    if (st && !st.hit) {
      return { gloss: "",
               body: "優先度 " + v.top + " のルータが " + tied +
                     " 台あるので、優先度だけでは決まらない" };
    }
    if (tied === 1) {
      return { gloss: "優先度が最も大きいルータが1台 ＝ そのルータが代表ルータ（DR）",
               body: "優先度 " + v.top + " は " + v.win.id + " だけ" };
    }
    /* **見比べる2台は、上下に並べる。**1行につなぐと、
       どちらが大きいのかを目で追い直すことになる */
    var two = v.tied.slice().sort(byKeyDesc).slice(0, 2);
    var head = (tied === v.node.length)
      ? v.node.length + " 台とも優先度が同じ"
      : "優先度 " + v.top + " が " + tied + " 台";
    return { gloss: "優先度が並んだ ＝ ルータ ID が大きいほう",
             body: { rows: [{ t: head }]
               .concat(two.map(function (x, i) {
                 var r = { c: x.id + "  " + x.rid +
                              (x.src === "ルータ ID" ? "" : "（" + x.src + "）") };
                 if (i === 0) r.m = "こちらが大きい";
                 return r;
               }))
               .concat(tied > 2 ? [{ t: "残りはもっと小さい" }] : []) } };
  }

  var spec = {
    id: "ospfdr",
    kind: "rules",
    view: "topology",          /* 画面は図で出す */
    card: "read",
    name: "OSPF の代表ルータ",
    note: "同じセグメントに接続されたルータの中から、代表を1台決める",
    obj: "3.4",
    spots: SPOTS, rules: RULES, gloss: GLOSS,
    read: read, answer: answer, excerpt: excerpt,
    ask: "この構成で、どのルータが DR になりますか。",
    walk: walkQ,
    /* 説明の1枚（見本と、短い決まり）と、答え合わせの言葉 */
    learnEx: learnEx,
    brief: brief, answerNote: answerNote,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample,
    expect: { spots: 2, rules: 2, questions: 2 },
    /* 本の答えが出力と食い違っていて使えない問題。いまは無い */
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.ospfdr = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
