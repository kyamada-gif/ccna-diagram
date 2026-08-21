/* 「DR の決まり方」ブロックの中身（目標3.4・過去問2問）。
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
 * 「OSPF のとなり関係」（types/ospf.js）と分けてある理由は、そちらの覚え書きに書いた。
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
    var win = tied.slice().sort(function (a, b) {
      return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
    })[0];
    /* sw は画面側（app.jsx）が誤答を作るのに使う並び。node と同じもの */
    return { node: node, sw: node, top: top, tied: tied, win: win || null };
  }

  /* 答え。その場のルータ名になる */
  function answer(v) { return v.win ? v.win.id : ""; }

  function listPri(v) {
    return v.node.map(function (x) { return x.id + " " + x.pri; }).join("　");
  }
  function listRid(v) {
    return v.tied.map(function (x) { return x.id + " " + x.rid; }).join("　");
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

  function quad() {
    return R(1, 250) + "." + R(0, 250) + "." + R(0, 250) + "." + R(1, 250);
  }
  function quads4() {
    var out = [], q;
    while (out.length < 4) {
      q = quad();
      if (out.indexOf(q) < 0 && !out.some(function (x) { return key(x) === key(q); })) {
        out.push(q);
      }
    }
    return out;
  }

  function baseVals() {
    var third = R(1, 250);
    return {
      names: pick(NAMES), pid: pick([1, 10, 100]), port: pick(PORTS),
      ips: [0, 1, 2, 3].map(function (i) { return "192.168." + third + "." + (i * 2 + 1); }),
      rids: quads4(), pris: null
    };
  }

  function build(v) {
    return {
      shape: "star",
      hub: "スイッチ",
      title: "OSPF " + v.pid,
      node: v.names.map(function (id, i) {
        return { id: id, at: AT[i], port: v.port, ip: v.ips[i], lo: null,
                 rid: v.rids[i], pri: v.pris[i], tag: null };
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
    if (st.hit) {
      right = "ここで決まる。答えは " + ans;
      opts = [right,
              "ここでは決まらない。次に " + (st.next || "ほかの所") + " を確認する",
              "ここで決まる。答えは " + pick(others)];
    } else {
      right = "ここでは決まらない。次に " + st.next + " を確認する";
      opts = [right, "ここで決まる。答えは " + ans,
              "ここで決まる。答えは " + pick(others)];
    }
    var seen = {}, uniq = [];
    opts.forEach(function (o) { if (!seen[o]) { seen[o] = 1; uniq.push(o); } });
    return { ask: look + " を確認しました。次にどうしますか。",
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

  var spec = {
    id: "ospfdr",
    kind: "rules",
    view: "topology",          /* 画面は図で出す */
    card: "read",
    name: "DR の決まり方",
    note: "同じセグメントに接続されたルータの中から、代表を1台決める",
    obj: "3.4",
    spots: SPOTS, rules: RULES, gloss: GLOSS,
    read: read, answer: answer, excerpt: excerpt,
    ask: "この構成で、どのルータが DR になりますか。",
    walk: walkQ,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample,
    expect: { spots: 2, rules: 2, questions: 2 },
    /* 本の答えが出力と食い違っていて使えない問題。いまは無い */
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.ospfdr = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
