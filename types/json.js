/* 「JSON の読み取り」ブロックの中身（過去問41問）。
 *
 * 見る所6か所と判定ルール7本は、過去問41問とその解説から起こした。思いつきで足さない。
 *
 * ── 提示物の形 ─────────────────────────────
 * show interface の出力は、出力さえ見れば答えが決まる。JSON はそうではない。
 * 同じ JSON でも「2行目には何が表されるか」と「port は何を表すか」では答えが違う。
 * そこで提示物を2つに分けてある。**本には無い行を足さない。**
 *
 *   { src: "…",  asked: { mode: …, … } }
 *
 *   src    本の提示物そのまま（行の番号が刷ってあれば、それも入っている）。画面に出るのはこれだけ
 *   asked  何が聞かれているか。本の問題文から起こす（scripts/json_block.py）
 *
 *   mode        いっしょに入るもの            聞いていること
 *   ─────────────────────────────────────────────
 *   "word"      word   … 言葉               その言葉が何にあたるか（キー／値／配列）
 *   "line"      lineno … 行の番号            その行に何が表されるか（オブジェクト／配列）
 *              （to  … 終わりの行。「1 行目から 5 行目」のときだけ入る）
 *   "whole"     なし                        全体が何か（オブジェクト／配列）
 *   "count"     what   … 数えるもの          その数
 *   "countset"  whats  … 数えるものの並び     まとめて数えた結果
 *   "type"      word   … 言葉               その言葉のデータの種類
 *   "missing"   なし                        この JSON を成り立たせるのに足りないもの
 *
 * "type" だけは、判定ルールが答えを出さない（当たるルールが無い）。
 * 言葉の役目ではなくデータの種類を聞いていて、ほかの20問と同じ規則では答えられないため。
 * spec.bookOnly に入れてあり、本の答えで出題だけする。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick, shuffle = E.shuffle;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "colon", name: "コロン ( : )",
      mean: "名前と、その中身を区切る記号",
      use: "問われている言葉がコロンの左にあればキー、右にあれば値。左右のどちらにあるかだけで決まる" },
    { key: "brace", name: "中かっこ { }",
      mean: "名前と値の組を、ひとまとめにする入れ物",
      use: "問われている行が { で始まっていれば、その行はオブジェクト。出力全体が { で始まっていれば、全体がオブジェクト" },
    { key: "bracket", name: "角かっこ [ ]",
      mean: "同じ種類の値を、順番に並べる入れ物",
      use: "問われている行が [ で始まっていれば、その行は配列。問われている言葉が [ と ] の間に並んでいれば、その言葉が直接入っているのは配列" },
    { key: "lineno", name: "行の番号",
      mean: "出力の左端に振ってある行番号",
      use: "何行目かを問われたら、この番号で該当する行を探す。番号が振られていないときは、上から順に数える" },
    { key: "howmany", name: "かっこの組の数",
      mean: "同じ種類のかっこが何組あるか",
      use: "個数を問われたら、開くかっこを上から数える。{ の組の数がオブジェクトの数、[ の組の数が配列の数、コロンの左にある言葉の数がキーの数" },

    { key: "close", name: "かっこの閉じ忘れ",
      mean: "開いたかっこと、閉じたかっこの数が合っているか",
      use: "「何が足りないか」と問われたら、{ } と [ ] をそれぞれ数える。開いた数のほうが多ければ、その閉じかっこが足りない。JSON は開いたかっこを必ず同じ数だけ閉じる決まりなので、数が合わなければ読み込めない" }
  ];

  /* ── JSON を読む ─────────────────────────
   * 文字を1つずつ見て、引用符でくくられた言葉ごとに、
   * それが「コロンの左」「コロンの右」「角かっこの中」のどれにいるかを決める。
   * かっこの開いた数も、このときに数える。
   */
  function scan(src) {
    var stack = [], toks = [], objs = 0, arrs = 0, keys = 0;
    var shutObj = 0, shutArr = 0;
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
      else if (ch === "}") { shutObj++; stack.pop(); }
      else if (ch === "]") { shutArr++; stack.pop(); }
    }
    return { toks: toks, objs: objs, arrs: arrs, keys: keys,
             shutObj: shutObj, shutArr: shutArr };
  }

  /* 答えの書き方。本には英語だけで刷ってある問題が3問ある（選択肢が object / key /
     value / array）。**どちらの言葉で書くかだけの話で、判定は変わらない。**
     どの言葉で刷ってあるかは asked.lang に入っている（scripts/json_block.py が
     選択肢から決める。どれが正解かは見ていない） */
  var SAY = {
    ja: { key: "キー", value: "値", object: "オブジェクト", array: "配列" },
    en: { key: "key", value: "value", object: "object", array: "array" }
  };

  /* 数えるものの言葉 → 数。本は配列を「JSON リスト値」とも書く */
  function countOf(v, what) {
    if (/オブジェクト/.test(what)) return v.objs;
    if (/キー|key/i.test(what)) return v.keys;
    return v.arrs;                       /* 配列・リスト値 */
  }

  /* 提示物を、判定に使う形にほどく */
  function read(ex) {
    ex = ex || {};
    var src = String(ex.src == null ? "" : ex.src);
    var asked = ex.asked || {};
    var raw = src.split("\n");
    /* 行の番号を外す。番号は「N 行目」を探すのに取っておく */
    var lines = [], nums = [], at = [], numbered = 0, i, m;
    for (i = 0; i < raw.length; i++) {
      if (!raw[i].replace(/\s/g, "")) continue;
      m = raw[i].match(/^\s*(\d+)[\s　]+(.*)$/);
      if (m) { nums.push(parseInt(m[1], 10)); lines.push(m[2]); numbered++; }
      else { nums.push(null); lines.push(raw[i].replace(/^\s+/, "")); }
      at.push(i);
    }
    /* 全角のコロンで刷られている問題があるので、半角にそろえる */
    var sc = scan(lines.join("\n").replace(/：/g, ":"));
    var v = { src: src, asked: asked, lines: lines, nums: nums, at: at,
              numbered: numbered * 2 >= lines.length && numbered > 0,
              objs: sc.objs, arrs: sc.arrs, keys: sc.keys,
              /* 閉じ忘れを見つけるための数。開いた数と閉じた数の差 */
              shutObj: sc.shutObj, shutArr: sc.shutArr,
              lackObj: sc.objs - sc.shutObj, lackArr: sc.arrs - sc.shutArr,
              mode: asked.mode || null, word: asked.word || null,
              lineno: asked.lineno == null ? null : asked.lineno,
              to: asked.to == null ? null : asked.to,
              what: asked.what || null, whats: asked.whats || null,
              lang: asked.lang === "en" ? "en" : "ja",
              side: null, row: -1, top: "", num: null };

    if (v.mode === "word" || v.mode === "type") {
      for (i = 0; i < sc.toks.length; i++) {
        if (sc.toks[i].text === v.word) { v.side = sc.toks[i].role; break; }
      }
    }
    if (v.mode === "line" || v.mode === "whole") {
      var idx = -1;
      if (v.mode === "whole") idx = 0;
      else if (v.numbered) {
        for (i = 0; i < nums.length; i++) { if (nums[i] === v.lineno) { idx = i; break; } }
      }
      if (idx < 0) idx = v.lineno > 0 ? v.lineno - 1 : 0;
      if (idx >= lines.length) idx = lines.length - 1;
      if (idx < 0) idx = 0;
      v.row = idx;
      v.top = (lines[idx] || "").charAt(0);
    }
    if (v.mode === "count") v.num = countOf(v, v.what);
    /* 画面が選択肢を作るのに使う。**engine と app.jsx は v.sw を見る**
       （答えがその場の値になるブロックの決まり。rootbridge はスイッチの一覧） */
    v.sw = choices(v).map(function (x) { return { id: x }; });
    return v;
  }

  /* ── 答え。決まった言葉ではなく、その場で計算した値になる ──────── */
  function answer(v) {
    var say = SAY[v.lang] || SAY.ja;
    if (v.mode === "word") {
      return v.side === "コロンの左" ? say.key
           : v.side === "コロンの右" ? say.value
           : v.side === "角かっこの中" ? say.array : "";
    }
    if (v.mode === "line" || v.mode === "whole") {
      return v.top === "{" ? say.object : v.top === "[" ? say.array : "";
    }
    /* 足りないかっこは、開いた数と閉じた数の差から決める。
       本の答えは「末尾に中括弧（}）」「末尾の中括弧 ( } )」のように
       刷り方が3冊で違うので、かっこの字そのものを返して照らし合わせる */
    if (v.mode === "missing") {
      if (v.lackObj > 0) return LACK.brace;
      if (v.lackArr > 0) return LACK.bracket;
      return "";
    }
    /* 数は、数えた結果をそのまま返す。本の答えも数字だけで刷ってある */
    if (v.mode === "count") return String(v.num);
    if (v.mode === "countset") {
      return (v.whats || []).map(function (w) {
        return countOf(v, w) + "つの" + w.replace(/\s/g, "");
      }).join("、");
    }
    return "";                            /* type … 判定ルールでは答えを出さない */
  }

  /* 足りないものの言い方。**選択肢の顔ぶれは、本の4つに合わせてある**
     （閉じかっこ／先頭の角かっこ／二重引用符／感嘆符）。こちらで考え出さない */
  var LACK = {
    brace: "閉じる中かっこ } が1つ足りない",
    bracket: "閉じる角かっこ ] が1つ足りない",
    head: "先頭に角かっこ [ が足りない",
    quote: "名前を二重引用符でくくる",
    bang: "各行の先頭に感嘆符 ! を付ける"
  };

  /* 練習で出す選択肢。**正解は必ず入れる。**同じものは入れない */
  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }
  function choices(v) {
    var a = answer(v);
    if (!a) return [];
    var say = SAY[v.lang] || SAY.ja;
    if (v.mode === "word") {
      return uniq([a, say.key, say.value, say.array, say.object]).slice(0, 4);
    }
    if (v.mode === "line" || v.mode === "whole") {
      return uniq([a, say.object, say.array, say.key, say.value]).slice(0, 4);
    }
    if (v.mode === "count") {
      var n = v.num;
      return uniq([String(n), String(n + 1), String(n + 2), String(Math.max(1, n - 1)),
                   String(n + 3)]).slice(0, 4);
    }
    if (v.mode === "missing") {
      return uniq([a, LACK.brace, LACK.bracket, LACK.head, LACK.quote, LACK.bang]).slice(0, 4);
    }
    if (v.mode === "countset") {
      var ws = v.whats || [], out = [a];
      ws.forEach(function (_, i) {
        out.push(ws.map(function (w, j) {
          return (countOf(v, w) + (i === j ? 1 : 0)) + "つの" + w.replace(/\s/g, "");
        }).join("、"));
      });
      return uniq(out).slice(0, 4);
    }
    return [];
  }

  /* 聞かれているものを、そのまま文にする（答え合わせで見せる） */
  function asked(v) {
    if (v.mode === "word") return "「" + v.word + "」という言葉";
    if (v.mode === "type") return "「" + v.word + "」のデータの種類";
    if (v.mode === "whole") return "全体";
    if (v.mode === "line") {
      return v.to ? v.lineno + " 行目から " + v.to + " 行目" : v.lineno + " 行目";
    }
    if (v.mode === "count") return v.what + " の数";
    if (v.mode === "countset") return (v.whats || []).join("と") + " の数";
    if (v.mode === "missing") return "この JSON に足りないもの";
    return "（読み取れない）";
  }
  function shownLine(v) {
    return v.row >= 0 ? (v.lines[v.row] || "").slice(0, 40) : "";
  }
  function notWord(v) {
    return v.mode === "word" ? null :
      "聞かれているのは " + asked(v) + " なので、コロンの左右を見ても決まらない";
  }
  function notLine(v) {
    return (v.mode === "line" || v.mode === "whole") ? null :
      "聞かれているのは " + asked(v) + " なので、行の先頭を見ても決まらない";
  }

  /* ── 判定ルール。上から順に当てて、最初に当たったところで決まる ──
   * 何が聞かれているかで分かれているので、当たるルールは必ず1本だけ。
   * 答えそのものは answer(v) が出す。ここで決めるのは「どこを見て決めたか」。
   */
  var RULES = [
    { key: "key", cond: "問われている言葉が、コロンの左にある",
      verdict: "キー",
      why: "コロンの左に書かれているので、これは値に付けた名前",
      look: ["コロン ( : )"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["コロンのどちら側か", v.side || "見つからない"]];
      },
      no: function (v) {
        return notWord(v) || "「" + v.word + "」はコロンの左にはない（" + (v.side || "見つからない") + "）";
      },
      test: function (v) { return v.mode === "word" && v.side === "コロンの左"; } },

    { key: "value", cond: "問われている言葉が、コロンの右にある",
      verdict: "値",
      why: "コロンの右に書かれているので、これは名前に対応する値",
      look: ["コロン ( : )"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["コロンのどちら側か", v.side || "見つからない"]];
      },
      no: function (v) {
        return notWord(v) || "「" + v.word + "」はコロンの右にはない（" + (v.side || "見つからない") + "）";
      },
      test: function (v) { return v.mode === "word" && v.side === "コロンの右"; } },

    { key: "line_object", cond: "問われている行が、中かっこ { で始まっている",
      verdict: "オブジェクト",
      why: "中かっこで始まって中かっこで閉じているので、そこはひとまとまりの入れ物",
      look: ["中かっこ { }", "行の番号"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["その行の先頭の記号", v.top || "なし"],
                ["その行", shownLine(v)]];
      },
      no: function (v) {
        return notLine(v) || "その行は " + (v.top || "なし") + " で始まっていて、{ ではない";
      },
      test: function (v) {
        return (v.mode === "line" || v.mode === "whole") && v.top === "{";
      } },

    { key: "in_array", cond: "問われている言葉が、角かっこの中に並んでいる",
      verdict: "配列",
      why: "角かっこの中に、ほかの値と並べて書かれている。その言葉が直接入っているのは配列のほう",
      look: ["角かっこ [ ]"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["どこにいるか", v.side || "見つからない"]];
      },
      no: function (v) {
        return notWord(v) || "「" + v.word + "」は角かっこの中の並びにはない（" + (v.side || "見つからない") + "）";
      },
      test: function (v) { return v.mode === "word" && v.side === "角かっこの中"; } },

    { key: "line_array", cond: "問われている行が、角かっこ [ で始まっている",
      verdict: "配列",
      why: "角かっこで始まって角かっこで閉じているので、そこは値を順番に並べた入れ物",
      look: ["角かっこ [ ]", "行の番号"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["その行の先頭の記号", v.top || "なし"],
                ["その行", shownLine(v)]];
      },
      no: function (v) {
        return notLine(v) || "その行は " + (v.top || "なし") + " で始まっていて、[ ではない";
      },
      test: function (v) {
        return (v.mode === "line" || v.mode === "whole") && v.top === "["; } },

    /* 数える問題は1本。いくつでも数えられる。答えは answer(v) が計算して出す */
    { key: "count", cond: "個数を問われている",
      verdict: "数えた数",
      why: "開くかっこを上から数える。その数がそのまま答えになる",
      look: ["かっこの組の数"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)], ["オブジェクト", v.objs],
                ["キー", v.keys], ["配列", v.arrs]];
      },
      no: function (v) {
        return "聞かれているのは " + asked(v) + " で、数ではない";
      },
      test: function (v) { return v.mode === "count" || v.mode === "countset"; } },

    /* 「何が足りないか」。**どのかっこが足りないかは、数えて決める。**
       本の3問はどれも末尾の中かっこ ( } ) が1つ足りない形だが、
       ここで「} と決めうち」にはしない。開いた数と閉じた数の差から出す */
    { key: "missing", cond: "この JSON を読み込むのに何が足りないかを問われている",
      verdict: "閉じかっこが足りない",
      why: "JSON は、開いたかっこを同じ数だけ閉じる決まり。開いた数のほうが多ければ、その閉じかっこが足りない",
      look: ["かっこの閉じ忘れ"],
      steps: function (v) {
        return [["聞かれているもの", asked(v)],
                ["中かっこ { }", v.objs + " 個開いて " + v.shutObj + " 個閉じている"],
                ["角かっこ [ ]", v.arrs + " 個開いて " + v.shutArr + " 個閉じている"]];
      },
      no: function (v) {
        return "聞かれているのは " + asked(v) + " で、足りないものではない";
      },
      test: function (v) { return v.mode === "missing"; } }
  ];

  var GLOSS = {
    "キー": "コロンの左に書かれている名前",
    "値": "コロンの右に書かれている値",
    "オブジェクト": "中かっこ { } でひとまとめにしたもの",
    "配列": "角かっこ [ ] の中に並べたもの",
    "数えた数": "開くかっこを上から数えた個数が、そのまま答えになる",
    "閉じかっこが足りない": "開いた数と閉じた数を比べて、足りないほうの閉じかっこを補う"
  };

  /* 本の答えとの言い換え表。本には答えが日本語と英語で混ざって刷ってある。
     いまの答え合わせは answer(v) が受け持つので build.js は使わないが、
     どの言い方が同じものを指すかの覚え書きとして残す */
  var SAME = {
    "キー": ["キー", "key"],
    "値": ["値", "value", "バリュー"],
    "オブジェクト": ["オブジェクト", "object"],
    "配列": ["配列", "array", "シーケンス"],
    /* 本は「末尾に中括弧（}）」「末尾の中括弧 ( } )」と3冊で書き方が違う。
       3つに共通するのは「中括弧」の3文字だけ */
    "閉じかっこが足りない": ["中括弧", "大括弧"]
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
  var COUNTWORD = ["オブジェクト", "キー", "配列"];

  function some(list, n) { return shuffle(list).slice(0, n); }

  function rowsOf(n) {
    var ks = some(KINDS, n), pk = pick(PORTKEY), pv = some(PORTVAL, n);
    return ks.map(function (k, i) {
      return { kind: k.key, name: pick(k.name), pkey: pk, pval: pv[i] };
    });
  }
  function pairsOf(n) {
    return some(PAIRKEY, n).map(function (k) {
      return { key: k, items: some(WORDS, R(2, 3)) };
    });
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

  function build(v) {
    var body = bodyOf(v);
    /* 「何が足りないか」の問題だけ、**閉じかっこを1つ落とす。**
       落とすのは、いちばん最後の閉じかっこ（本の3問と同じ形）。
       どのかっこが足りないかは、判定側が数えて決める */
    if (v.asked && v.asked.mode === "missing") {
      for (var k = body.length - 1; k >= 0; k--) {
        if (/^[}\]]$/.test(body[k].trim())) { body.splice(k, 1); break; }
      }
    }
    if (v.numbered) {
      body = body.map(function (l, i) { return (i + 1) + "  " + l; });
    }
    return { src: body.join("\n"), asked: v.asked };
  }

  function baseVals() {
    return { shape: "rows", n: 3, numbered: true, asked: null,
             rows: rowsOf(5), pairs: pairsOf(5), plain: some(WORDS, R(2, 3)) };
  }

  var MAKERS = {
    /* コロンの左にある言葉を聞く */
    key: function (b) {
      b.shape = "rows"; b.n = R(2, 5); b.numbered = true;
      var row = pick(b.rows.slice(0, b.n));
      b.asked = { mode: "word", word: pick([row.kind, row.pkey]) };
      return b;
    },
    /* コロンの右にある言葉を聞く */
    value: function (b) {
      b.shape = "rows"; b.n = R(2, 5); b.numbered = true;
      var row = pick(b.rows.slice(0, b.n));
      b.asked = { mode: "word", word: pick([row.name, row.pval]) };
      return b;
    },
    /* 角かっこの中に並んでいる言葉を聞く */
    in_array: function (b) {
      b.shape = "pairs"; b.n = R(1, 5); b.numbered = false;
      var p = pick(b.pairs.slice(0, b.n));
      b.asked = { mode: "word", word: pick(p.items) };
      return b;
    },
    /* 中かっこで始まる行を聞く */
    line_object: function (b) {
      if (R(0, 1)) {
        b.shape = "rows"; b.n = R(2, 5); b.numbered = true;
        b.asked = { mode: "line", lineno: R(2, b.n + 1) };
      } else {
        b.shape = "pairs"; b.n = R(1, 5); b.numbered = false;
        b.asked = { mode: "whole" };
      }
      return b;
    },
    /* 角かっこで始まる行、または全体を聞く */
    line_array: function (b) {
      var r = R(0, 2);
      if (r === 0) {
        b.shape = "rows"; b.n = R(2, 5); b.numbered = true;
        b.asked = { mode: "line", lineno: 1 };
      } else if (r === 1) {
        b.shape = "rows"; b.n = R(2, 5); b.numbered = true;
        b.asked = { mode: "line", lineno: 1, to: b.n + 2 };
      } else {
        b.shape = "plain"; b.numbered = false;
        b.asked = { mode: "whole" };
      }
      return b;
    },
    /* 数える。1つだけ数えるときと、まとめて数えるときがある。
       数は 1〜9 でばらつく（pairs は オブジェクト1・キーn・配列n、
       rows は オブジェクトn・キー2n・配列1）。
       **rows は 4 組まで。**5 組にするとキーが 10 になり、「10つ」という書き方になってしまう */
    count: function (b) {
      b.numbered = false;
      b.shape = pick(["pairs", "rows"]);
      b.n = b.shape === "rows" ? R(1, 4) : R(1, 5);
      b.asked = R(0, 3)
        ? { mode: "count", what: pick(COUNTWORD) }
        : { mode: "countset", whats: COUNTWORD.slice() };
      return b;
    },
    /* 閉じかっこを1つ落とした JSON を出して、何が足りないかを聞く。
       落とすかっこは形によって変わる（{ のこともあれば [ のこともある） */
    missing: function (b) {
      b.numbered = false;
      b.shape = pick(["pairs", "rows"]);
      b.n = b.shape === "rows" ? R(1, 3) : R(1, 3);
      b.asked = { mode: "missing" };
      return b;
    }
  };

  /* 見本（説明の1枚で使う、いつも同じ JSON） */
  function sample() {
    return {
      src: ['1  [',
            '2  {"switch": "SW18", "port": "ge2/41"},',
            '3  {"router": "R20", "port": "te5/5"},',
            '4  {"firewall": "FW42", "port": "fe3/24"}',
            '5  ]'].join("\n"),
      asked: { mode: "word", word: "port" }
    };
  }

  /* 決め手の所だけを残す。
   * 言葉を聞かれていれば、その言葉が出てくる行だけ。
   * 行を聞かれていれば、その行だけ（行の番号はそのまま残すので、探し方は変わらない）。
   * 数を聞かれているときは、1行でも落とすと数が変わるので、そのまま返す。
   */
  function excerpt(ex, look) {
    var v = read(ex), body = String(ex.src || "").split("\n"), keep = [], i;
    if (v.mode === "word" || v.mode === "type") {
      for (i = 0; i < body.length; i++) {
        if (body[i].indexOf(v.word) >= 0) keep.push(body[i]);
      }
    } else if ((v.mode === "line" || v.mode === "whole") && v.row >= 0) {
      keep.push(body[v.at[v.row]]);
    }
    if (!keep.length) return ex;
    return { src: keep.join("\n"), asked: v.asked };
  }

  /* ── 練習の問題文と選択肢 ─────────────────────
   * 「この値なら、どうしますか」では何を聞かれているか分からないので、
   * 何を見て、何が決まるのかを、そのまま文にする。
   */
  var VERDICTS = [];
  RULES.forEach(function (r) {
    if (VERDICTS.indexOf(r.verdict) < 0) VERDICTS.push(r.verdict);
  });
  function walkQ(st, v, sh) {
    var look = st.look.join(" と ");
    /* 誤答に使う答え。**聞かれているものに合うものだけ。**
       ここで答えが決まるときは、同じ提示物の選択肢から取る（数なら別の数）。
       決まらないときは、次に見る所の答えを取る。
       「言葉は何か」を聞いているのに「数えた数」を並べると、見ただけで消えてしまう */
    var a = answer(v);
    var other = st.hit
      ? shuffle(choices(v).filter(function (x) { return x !== a; }))[0]
      : (st.nextVerdict && st.nextVerdict !== st.verdict ? st.nextVerdict : null);
    if (!other) {
      other = shuffle(VERDICTS.filter(function (x) { return x !== st.verdict; }))[0];
    }
    /* 当たったときは、その場で出した答えをそのまま見せる（数なら数字） */
    var yes = look + " を見ると、答えは " + (st.hit ? (a || st.verdict) : st.verdict);
    /* 次に見る所が、いま見ている所と同じ名前になることがある（コロンの左と右）。
       そのときは「次に◯◯を見る」と書かない。最後の見る所には、次が無い */
    var no = !st.next ? look + " を見ても決まらない"
      : st.next !== look ? look + " だけでは決まらない。次に " + st.next + " を見る"
      : "答えは " + st.verdict + " にはならない";
    var right = st.hit ? yes : no;
    var opts = [yes, no, look + " を見ると、答えは " + other];
    var seen = {}, u = [];
    opts.forEach(function (o) { if (!seen[o]) { seen[o] = 1; u.push(o); } });
    return { ask: look + " を確認します。ここで答えは決まりますか。",
             opts: sh(u), right: right };
  }

  var spec = {
    id: "json",
    kind: "rules",
    view: "json",              /* 画面は src を そのまま文字で出す */
    card: "read",
    name: "JSON の読み取り",
    note: "JSON を見て、どこが名前で、どこが中身かを読む",
    obj: "6.7",
    spots: SPOTS, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt, walk: walkQ,
    /* 答えは決まった言葉ではなく、その場で計算した値になる */
    answer: answer, choices: choices,
    /* 提示物ぜんぶを見て答える問題の、聞き方。
       **「何が足りないか」だけは聞き方が別**なので、読み取った値で切り替える */
    ask: function (v) {
      return v && v.mode === "missing"
        ? "この JSON を読み込むには、何が足りないですか。"
        : "聞かれていることの答えは、どれですか。";
    },
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample,
    expect: { spots: 6, rules: 7, questions: 41 },
    /* 判定ルールでは答えを出さないが、本の答えで出題はする1問。
       B2-0031-03 は「apple は何を表しますか」に対して、選択肢が
       配列／オブジェクト／番号／文字列 で、キーも値も無い。本の答えは「文字列」。
       ほかの20問は同じ聞き方で「キー」「値」と答えている。
       紙面（work/B2/0031.png）で確かめたが、書き起こしは合っている。
       言葉の役目ではなくデータの種類を聞いていて、同じ規則では両方に答えられない。
       規則を本に合わせにいかず、この1問だけ本の答えで出す。 */
    bookOnly: ["B2-0031-03"],
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.json = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
