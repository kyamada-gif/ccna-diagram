/* 「JSON の読み取り」ブロックの中身（目標6.7・過去問37問）。
 *
 * 見る所5か所と判定ルール8本は、過去問38問とその解説から起こした。思いつきで足さない。
 *
 * **このブロックだけの決まり：提示物のいちばん上の1行は「何が聞かれているか」。**
 * show interface の出力は、出力さえ見れば答えが決まる。JSON はそうではない。
 * 同じ JSON でも「2行目には何が表されるか」と「port は何を表すか」では答えが違う。
 * そこで、提示物の1行目に、聞かれているものを1行で書いてある。
 *
 *     聞かれているのは 「port」 という言葉
 *     1  [
 *     2  {"IDS": "IPS_pittsburgh", "port":"te8/30"},
 *     …
 *
 * 過去問の1行目は scripts/json_block.py が本の問題文から起こす。練習の問題は build が作る。
 * 1行目の書き方は5通りだけ。
 *     聞かれているのは 「◯◯」 という言葉
 *     聞かれているのは N 行目           ／  聞かれているのは N 行目から M 行目
 *     聞かれているのは 全体
 *     聞かれているのは ◯◯ の数
 *     聞かれているのは オブジェクト と キー と 配列 の数
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick, shuffle = E.shuffle;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "colon", name: "コロン ( : )",
      re: /:/,
      mean: "名前と中身を区切る印",
      use: "聞かれた言葉がコロンの左にあれば キー、右にあれば 値。左と右のどちらにあるかだけを見る" },
    { key: "brace", name: "中かっこ { }",
      re: /[{}]/,
      mean: "名前と中身の組を、ひとまとめにする入れ物",
      use: "聞かれた行が { で始まっていれば、その行はオブジェクト。全体が { で始まっていれば、全体がオブジェクト" },
    { key: "bracket", name: "角かっこ [ ]",
      re: /\[|\]/,
      mean: "同じ仲間をいくつも並べる入れ物",
      use: "聞かれた行が [ で始まっていれば、その行は配列。聞かれた言葉が [ と ] の間に並んでいれば、その言葉が直接いるのは配列" },
    { key: "lineno", name: "行の番号",
      re: /^\s*\d+[\s　]/,
      mean: "左の端に打ってある番号",
      use: "N 行目を聞かれたら、この番号でその行を探す。番号が打っていないときは、上から順に数える" },
    { key: "howmany", name: "かっこの組の数",
      re: /[[{]/,
      mean: "同じかっこが何組あるか",
      use: "数を聞かれたら、開くかっこを上から数える。{ の組の数がオブジェクトの数、[ の組の数が配列の数、コロンの左にある言葉の数がキーの数" }
  ];

  /* ── JSON を読む ─────────────────────────
   * 文字を1つずつ見て、引用符でくくられた言葉ごとに、
   * それが「コロンの左」「コロンの右」「角かっこの中の並び」のどれにいるかを決める。
   * かっこの開いた数も、このときに数える。
   */
  function scan(src) {
    var stack = [], toks = [], objs = 0, arrs = 0, keys = 0;
    for (var i = 0; i < src.length; i++) {
      var ch = src.charAt(i);
      if (ch === '"') {
        var j = i + 1, s = "";
        while (j < src.length && src.charAt(j) !== '"') { s += src.charAt(j); j++; }
        var k = j + 1;
        while (k < src.length && /\s/.test(src.charAt(k))) k++;
        var role;
        if (src.charAt(k) === ":") role = "コロンの左";
        else if (stack[stack.length - 1] === "[") role = "角かっこの中";
        else role = "コロンの右";
        if (role === "コロンの左") keys++;
        toks.push({ text: s, role: role });
        i = j;
      } else if (ch === "{") { objs++; stack.push("{"); }
      else if (ch === "[") { arrs++; stack.push("["); }
      else if (ch === "}" || ch === "]") { stack.pop(); }
    }
    return { toks: toks, objs: objs, arrs: arrs, keys: keys };
  }

  /* 提示物を、判定に使う形にほどく */
  function read(ex) {
    var text = String(ex == null ? "" : ex);
    var all = text.split("\n");
    var head = all[0] || "";
    var body = all.slice(1);
    /* 行の番号を外す。番号は「N 行目」を探すのに取っておく */
    var lines = [], nums = [], at = [], numbered = 0, i, m;
    for (i = 0; i < body.length; i++) {
      if (!body[i].replace(/\s/g, "")) continue;
      m = body[i].match(/^\s*(\d+)[\s　]+(.*)$/);
      if (m) { nums.push(parseInt(m[1], 10)); lines.push(m[2]); numbered++; }
      else { nums.push(null); lines.push(body[i].replace(/^\s+/, "")); }
      at.push(i);
    }
    /* 全角のコロンで刷られている問題があるので、半角にそろえる */
    var sc = scan(lines.join("\n").replace(/：/g, ":"));
    var v = { head: head, lines: lines, nums: nums, at: at,
              numbered: numbered * 2 >= lines.length && numbered > 0,
              objs: sc.objs, arrs: sc.arrs, keys: sc.keys,
              mode: null, word: null, side: null, lineno: null, row: -1,
              top: "", what: null, num: null };

    if ((m = head.match(/「(.+?)」/))) { v.mode = "word"; v.word = m[1]; }
    else if (/オブジェクト と キー と 配列 の数/.test(head)) { v.mode = "countset"; }
    else if ((m = head.match(/(オブジェクト|キー|配列)\s*の数/))) {
      v.mode = "count"; v.what = m[1];
    } else if ((m = head.match(/(\d+)\s*行目/))) {
      v.mode = "line"; v.lineno = parseInt(m[1], 10);
    } else if (/全体/.test(head)) { v.mode = "line"; v.lineno = 0; }

    if (v.mode === "word") {
      for (i = 0; i < sc.toks.length; i++) {
        if (sc.toks[i].text === v.word) { v.side = sc.toks[i].role; break; }
      }
    }
    if (v.mode === "line") {
      var idx = -1;
      if (v.lineno === 0) idx = 0;
      else if (v.numbered) {
        for (i = 0; i < nums.length; i++) { if (nums[i] === v.lineno) { idx = i; break; } }
      }
      if (idx < 0) idx = v.lineno > 0 ? v.lineno - 1 : 0;
      if (idx >= lines.length) idx = lines.length - 1;
      v.row = idx;
      v.top = (lines[idx] || "").charAt(0);
    }
    if (v.mode === "count") {
      v.num = v.what === "オブジェクト" ? v.objs : v.what === "配列" ? v.arrs : v.keys;
    }
    return v;
  }

  /* 聞かれているものを、そのまま文にする（答え合わせで見せる） */
  function asked(v) {
    if (v.mode === "word") return "「" + v.word + "」という言葉";
    if (v.mode === "line") return v.lineno === 0 ? "全体" : v.lineno + " 行目";
    if (v.mode === "count") return v.what + " の数";
    if (v.mode === "countset") return "オブジェクトとキーと配列の数";
    return "（読み取れない）";
  }
  function shownLine(v) {
    return v.row >= 0 ? (v.lines[v.row] || "").slice(0, 40) : "";
  }
  /* 「聞かれているのが言葉ではない」ときの、消える理由 */
  function notWord(v) {
    return v.mode === "word" ? null :
      "聞かれているのは " + asked(v) + " なので、コロンの左右を見ても決まらない";
  }
  function notLine(v) {
    return v.mode === "line" ? null :
      "聞かれているのは " + asked(v) + " なので、行の先頭を見ても決まらない";
  }
  function notCount(v) {
    return (v.mode === "count" || v.mode === "countset") ? null :
      "聞かれているのは " + asked(v) + " で、数ではない";
  }

  /* ── 判定ルール。上から順に当てて、最初に当たったところで決まる ──
   * 1行目で「何が聞かれているか」が分かれているので、当たるルールは必ず1本だけ。
   */
  var RULES = [
    { key: "key", cond: "聞かれた言葉が、コロンの左にある",
      verdict: "キー",
      why: "コロンの左に書いてあるので、これは中身につけた名前",
      look: ["コロン ( : )"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["コロンのどちら側か", v.side || "見つからない"]];
      },
      no: function (v) {
        return notWord(v) || "「" + v.word + "」はコロンの左にはない（" + (v.side || "見つからない") + "）";
      },
      test: function (v) { return v.mode === "word" && v.side === "コロンの左"; } },

    { key: "value", cond: "聞かれた言葉が、コロンの右にある",
      verdict: "値",
      why: "コロンの右に書いてあるので、これは名前につけた中身",
      look: ["コロン ( : )"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["コロンのどちら側か", v.side || "見つからない"]];
      },
      no: function (v) {
        return notWord(v) || "「" + v.word + "」はコロンの右にはない（" + (v.side || "見つからない") + "）";
      },
      test: function (v) { return v.mode === "word" && v.side === "コロンの右"; } },

    { key: "line_object", cond: "聞かれた行が、中かっこ { で始まっている",
      verdict: "オブジェクト",
      why: "中かっこで始まって中かっこで閉じているので、その行はひとまとまりの入れ物",
      look: ["中かっこ { }", "行の番号"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["その行の先頭の記号", v.top || "なし"],
                ["その行", shownLine(v)]];
      },
      no: function (v) {
        return notLine(v) || "その行は " + (v.top || "なし") + " で始まっていて、{ ではない";
      },
      test: function (v) { return v.mode === "line" && v.top === "{"; } },

    { key: "in_array", cond: "聞かれた言葉が、角かっこの中に並んでいる",
      verdict: "配列",
      why: "角かっこの中に、ほかの言葉と並べて書いてあるので、直接いる入れ物は並びのほう",
      look: ["角かっこ [ ]"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["どこにいるか", v.side || "見つからない"]];
      },
      no: function (v) {
        return notWord(v) || "「" + v.word + "」は角かっこの中の並びにはない（" + (v.side || "見つからない") + "）";
      },
      test: function (v) { return v.mode === "word" && v.side === "角かっこの中"; } },

    { key: "line_array", cond: "聞かれた行が、角かっこ [ で始まっている",
      verdict: "配列",
      why: "角かっこで始まって角かっこで閉じているので、そこは同じ仲間を並べた入れ物",
      look: ["角かっこ [ ]", "行の番号"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["その行の先頭の記号", v.top || "なし"],
                ["その行", shownLine(v)]];
      },
      no: function (v) {
        return notLine(v) || "その行は " + (v.top || "なし") + " で始まっていて、[ ではない";
      },
      test: function (v) { return v.mode === "line" && v.top === "["; } },

    { key: "one", cond: "数えたら 1 つだった",
      verdict: "1 つ",
      why: "開くかっこを上から数えると、1 つしかない",
      look: ["かっこの組の数"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["オブジェクト", v.objs],
                ["配列", v.arrs], ["キー", v.keys]];
      },
      no: function (v) {
        return notCount(v) || "数えると " + v.num + " つあって、1 つではない";
      },
      test: function (v) { return v.mode === "count" && v.num === 1; } },

    { key: "three", cond: "数えたら 3 つだった",
      verdict: "3 つ",
      why: "開くかっこを上から数えると、3 つある",
      look: ["かっこの組の数"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["オブジェクト", v.objs],
                ["配列", v.arrs], ["キー", v.keys]];
      },
      no: function (v) {
        return notCount(v) || "数えると " + v.num + " つあって、3 つではない";
      },
      test: function (v) { return v.mode === "count" && v.num === 3; } },

    { key: "set", cond: "外側の中かっこが 1 組で、キーと配列が同じ数だけある",
      verdict: "オブジェクト 1 つ、キーと配列が同じ数",
      why: "いちばん外側の中かっこが 1 組。その中に、名前と角かっこの組が同じ数だけ並んでいる",
      look: ["かっこの組の数"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["オブジェクト", v.objs],
                ["キー", v.keys], ["配列", v.arrs]];
      },
      no: function (v) {
        return notCount(v) || "オブジェクトが " + v.objs + " つ、キーが " + v.keys +
               " つ、配列が " + v.arrs + " つで、この形にならない";
      },
      test: function (v) {
        return v.mode === "countset" && v.objs === 1 && v.keys === v.arrs && v.keys > 0;
      } }
  ];

  var GLOSS = {
    "キー": "コロンの左に書いてある名前",
    "値": "コロンの右に書いてある中身",
    "オブジェクト": "中かっこ { } でひとまとめにしたもの",
    "配列": "角かっこ [ ] に並べたもの",
    "1 つ": "数えた結果が 1",
    "3 つ": "数えた結果が 3",
    "オブジェクト 1 つ、キーと配列が同じ数": "外側の中かっこが 1 組で、その中に名前と並びが同じ数だけある"
  };

  /* 本の答えとの言い換え表。本には日本語と英語が混ざって刷られている */
  var SAME = {
    "キー": ["キー", "key"],
    "値": ["値", "value", "バリュー"],
    "オブジェクト": ["オブジェクト", "object"],
    "配列": ["配列", "array", "シーケンス"],
    "1 つ": ["1"],
    "3 つ": ["3"],
    "オブジェクト 1 つ、キーと配列が同じ数": ["1 つのオブジェクト", "1つのオブジェクト"]
  };

  /* ── JSON を作る ───────────────────────────
   * 本に出てくる形は3つだけ。
   *   rows  … 機器を並べた形   [ {"switch":"SW18","port":"ge2/41"}, … ]
   *   pairs … 名前と並びの形   { "Test_Questions": ["Automation","Configuration"], … }
   *   plain … 並びだけの形     ["red", "one"]
   */
  var KINDS = [
    { key: "switch", name: ["SW18", "SW25", "SW31", "SW_dallas", "SW_toronto", "SWseattle"] },
    { key: "router", name: ["R20", "R29", "R41", "R_paris", "R_pittsburgh", "R_frankfurt"] },
    { key: "firewall", name: ["FW12", "FW28", "FW42", "FW_chicago", "FWboston", "FW_portland"] },
    { key: "IDS", name: ["IPS22", "IPS31", "IPS_admin", "IPS_frankfurt", "IPSsydney"] },
    { key: "load balancer", name: ["LB12", "LB13", "LB33", "LB48", "LB_munich", "LB_milwaukee"] },
    { key: "VPN concentrator", name: ["VPN11", "VPN36", "VPN47", "VPNadmin", "VPN_finance"] }
  ];
  var PORTKEY = ["port", "interface"];
  var PORTVAL = ["ge2/41", "te5/5", "fe3/24", "e0/23", "te8/30", "ge9/23",
                 "fe7/12", "e1/39", "ge5/28", "te6/21", "fe2/25", "e6/37"];
  var PAIRKEY = ["Test_Questions", "Test_Exam_Level", "Test_Response",
                 "Wired_Ports", "Wireless_Ports", "Uplink_Ports", "Access_Ports",
                 "Trunk_Ports", "Site_List", "Vlan_Names"];
  /* 角かっこの中に並べる言葉。**キーには使わない言葉だけ。**
     同じ言葉がキーと並びの両方に出ると、聞かれたときにどちらか分からなくなる */
  var WORDS = ["Automation", "Configuration", "CCNA", "CCNP", "Correct", "Incorrect",
               "red", "one", "blue", "rust", "good", "warning", "up", "down",
               "ethernet0/3", "ethernet0/4", "ethernet0/5", "tokyo", "osaka", "nagoya"];

  function some(list, n) { return shuffle(list).slice(0, n); }

  function rowsOf(n) {
    var ks = some(KINDS, n), pk = pick(PORTKEY), pv = some(PORTVAL, n);
    return ks.map(function (k, i) {
      return { kind: k.key, name: pick(k.name), pkey: pk, pval: pv[i] };
    });
  }
  function pairsOf(n) {
    var ks = some(PAIRKEY, n);
    return ks.map(function (k) { return { key: k, items: some(WORDS, R(2, 3)) }; });
  }

  function q(s) { return '"' + s + '"'; }

  function bodyOf(v) {
    var out = [], i;
    if (v.shape === "plain") return ["[" + v.plain.map(q).join(", ") + "]"];
    if (v.shape === "pairs") {
      out.push("{");
      for (i = 0; i < v.n; i++) {
        out.push("  " + q(v.pairs[i].key) + ": [" + v.pairs[i].items.map(q).join(", ") + "]" +
                 (i + 1 < v.n ? "," : ""));
      }
      out.push("}");
      return out;
    }
    out.push("[");
    for (i = 0; i < v.n; i++) {
      out.push("{" + q(v.rows[i].kind) + ": " + q(v.rows[i].name) + ", " +
               q(v.rows[i].pkey) + ": " + q(v.rows[i].pval) + "}" + (i + 1 < v.n ? "," : ""));
    }
    out.push("]");
    return out;
  }

  function headOf(a) {
    if (a.kind === "word") return "聞かれているのは 「" + a.word + "」 という言葉";
    if (a.kind === "line") return "聞かれているのは " + a.line + " 行目";
    if (a.kind === "range") return "聞かれているのは " + a.from + " 行目から " + a.to + " 行目";
    if (a.kind === "whole") return "聞かれているのは 全体";
    if (a.kind === "count") return "聞かれているのは " + a.what + " の数";
    return "聞かれているのは オブジェクト と キー と 配列 の数";
  }

  function build(v) {
    var body = bodyOf(v);
    if (v.numbered) {
      body = body.map(function (l, i) { return (i + 1) + "  " + l; });
    }
    return [headOf(v.ask)].concat(body).join("\n");
  }

  function baseVals() {
    return { shape: "rows", n: 3, numbered: true, ask: null,
             rows: rowsOf(4), pairs: pairsOf(4), plain: some(WORDS, R(2, 3)) };
  }

  var MAKERS = {
    /* コロンの左にある言葉を聞く */
    key: function (b) {
      b.shape = "rows"; b.n = 3; b.numbered = true;
      var row = pick(b.rows.slice(0, 3));
      b.ask = { kind: "word", word: pick([row.kind, row.pkey]) };
      return b;
    },
    /* コロンの右にある言葉を聞く */
    value: function (b) {
      b.shape = "rows"; b.n = 3; b.numbered = true;
      var row = pick(b.rows.slice(0, 3));
      b.ask = { kind: "word", word: pick([row.name, row.pval]) };
      return b;
    },
    /* 角かっこの中に並んでいる言葉を聞く */
    in_array: function (b) {
      b.shape = "pairs"; b.n = R(2, 3); b.numbered = false;
      var p = pick(b.pairs.slice(0, b.n));
      b.ask = { kind: "word", word: pick(p.items) };
      return b;
    },
    /* 中かっこで始まる行を聞く */
    line_object: function (b) {
      b.shape = "rows"; b.n = 3; b.numbered = true;
      b.ask = { kind: "line", line: R(2, 4) };
      return b;
    },
    /* 角かっこで始まる行、または全体を聞く */
    line_array: function (b) {
      if (R(0, 1)) {
        b.shape = "rows"; b.n = 3; b.numbered = true;
        b.ask = R(0, 1) ? { kind: "line", line: 1 }
                        : { kind: "range", from: 1, to: 5 };
      } else {
        b.shape = "plain"; b.numbered = false;
        b.ask = { kind: "whole" };
      }
      return b;
    },
    /* 数えると 1 つになる形 */
    one: function (b) {
      b.numbered = false;
      if (R(0, 1)) { b.shape = "pairs"; b.n = R(2, 4); b.ask = { kind: "count", what: "オブジェクト" }; }
      else { b.shape = "pairs"; b.n = 1; b.ask = { kind: "count", what: pick(["配列", "キー"]) }; }
      return b;
    },
    /* 数えると 3 つになる形 */
    three: function (b) {
      b.numbered = false;
      if (R(0, 1)) { b.shape = "pairs"; b.n = 3; b.ask = { kind: "count", what: pick(["配列", "キー"]) }; }
      else { b.shape = "rows"; b.n = 3; b.ask = { kind: "count", what: "オブジェクト" }; }
      return b;
    },
    /* オブジェクト・キー・配列を、まとめて数える形 */
    set: function (b) {
      b.shape = "pairs"; b.n = R(2, 4); b.numbered = false;
      b.ask = { kind: "set" };
      return b;
    }
  };

  /* 見本（説明の1枚で使う、いつも同じ JSON） */
  function sample() {
    return [
      "聞かれているのは 「port」 という言葉",
      '1  [',
      '2  {"switch": "SW18", "port": "ge2/41"},',
      '3  {"router": "R20", "port": "te5/5"},',
      '4  {"firewall": "FW42", "port": "fe3/24"}',
      '5  ]'
    ].join("\n");
  }

  /* 決め手の所だけを残す。
   * 言葉を聞かれていれば、その言葉が出てくる行だけ。
   * 行を聞かれていれば、その行だけ（行の番号はそのまま残すので、探し方は変わらない）。
   * 数を聞かれているときは、1行でも落とすと数が変わるので、そのまま返す。
   */
  function excerpt(text, look) {
    var v = read(text);
    var all = text.split("\n"), body = all.slice(1), keep = [], i;
    if (v.mode === "word") {
      for (i = 0; i < body.length; i++) {
        if (body[i].indexOf(v.word) >= 0) keep.push(body[i]);
      }
    } else if (v.mode === "line" && v.row >= 0) {
      keep.push(body[v.at[v.row]]);
    }
    if (!keep.length) return text;
    return [all[0]].concat(keep).join("\n");
  }

  /* ── 練習の問題文と選択肢 ─────────────────────
   * 「この値なら、どうしますか」では何を聞かれているか分からないので、
   * 何を見て、何が決まるのかを、そのまま文にする。
   */
  var VERDICTS = [];
  RULES.forEach(function (r) {
    if (VERDICTS.indexOf(r.verdict) < 0) VERDICTS.push(r.verdict);
  });

  /* 誤答に使う答え。**聞かれているものに合うものだけ。**
     「言葉は何か」を聞いているのに「3 つ」を並べると、見ただけで消えてしまう */
  var NEARBY = {
    word: ["キー", "値", "配列"],
    line: ["オブジェクト", "配列"],
    count: ["1 つ", "3 つ", "オブジェクト 1 つ、キーと配列が同じ数"],
    countset: ["オブジェクト 1 つ、キーと配列が同じ数", "1 つ", "3 つ"]
  };

  function walkQ(st, v, sh) {
    var look = st.look.join(" と ");
    var near = NEARBY[v.mode] || VERDICTS;
    var others = shuffle(near.filter(function (x) { return x !== st.verdict; }));
    if (!others.length) {
      others = shuffle(VERDICTS.filter(function (x) { return x !== st.verdict; }));
    }
    var yes = look + " を見ると、答えは " + st.verdict;
    /* 次に見る所が、いま見ている所と同じ名前になることがある。
       （コロンの左と右、かっこの数と数）そのときは「次に◯◯を見る」と書かない */
    var no = (st.next && st.next !== look)
      ? look + " だけでは決まらない。次に " + st.next + " を見る"
      : "答えは " + st.verdict + " にはならない";
    var right = st.hit ? yes : no;
    var opts = [yes, no, look + " を見ると、答えは " + others[0]];
    var seen = {}, uniq = [];
    opts.forEach(function (o) { if (!seen[o]) { seen[o] = 1; uniq.push(o); } });
    return { ask: look + " を見ます。ここで答えは決まりますか。",
             opts: sh(uniq), right: right };
  }

  var spec = {
    id: "json",
    kind: "rules",
    card: "read",
    name: "JSON の読み取り",
    note: "JSON を見て、どこが名前で、どこが中身かを読む",
    obj: "6.7",
    spots: SPOTS, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt, walk: walkQ,
    /* 提示物ぜんぶを見て答える問題の、聞き方。
       聞かれているものは提示物のいちばん上の行に書いてある */
    ask: "いちばん上の行で聞かれていることの答えは、どれですか。",
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample,
    expect: { spots: 5, rules: 8, questions: 37 },
    /* 本の答えが、同じ聞き方のほかの問題と食い違うため外した1問 */
    dropped: ["B2-0031-03"]
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.json = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
