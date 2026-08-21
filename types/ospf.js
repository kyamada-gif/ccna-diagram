/* 「OSPF の隣接関係」ブロックの中身（目標3.4・過去問7問）。
 *
 * 提示物はテキスト。**二つのルータの様子が上下に並んでいる**ので、
 * 1台ぶんを読む showint とちがい、read で二つに切り分けてから見くらべる。
 *
 * 出てくる形は2つある。どちらも同じ値（OSPF が動いているか／エリア／Hello／
 * Dead／Router ID）に読み下す。
 *   show の形    R1#show ip ospf interface … を2台ぶん並べたもの
 *   設定の形     設定を2台ぶん並べたもの。過去問には2通りの刷り方がある
 *                  cfg   … running-config をそのまま並べたもの（B1-P12-087）
 *                  typed … 打ったコマンドが合図つきで残っているもの（B3-M2-058）
 *
 * 見る所5か所・判定ルール5本は、過去問7問とその解説から起こした。思いつきで足さない。
 *
 * **この分野でいちばん難しいのは「どこに書いてあるか」。**
 * エリアの番号は Internet address の行の末尾、Hello と Dead は
 * Timer intervals configured の行に4つ並ぶ数字の1つめと2つめ、
 * Router ID は Process ID の行の中。どれも行の名前と中身が一致していない。
 * そこで hits() で決め手の行を光らせ、learnEx() で現物を先に見せ、
 * stepQ() の1問目で「どの行を見ますか」を直接たずねる。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick;

  /* 設定に書いていないときの、もとから決まっている秒数 */
  var DEF_HELLO = 10, DEF_DEAD = 40;

  /* ── 見る所 ─────────────────────────────
   * use には「どの行の、どこに書いてあるか」を必ず書く。
   * 値の意味だけを書いても、初めて見る人は出力の中からその値を探せない。
   */
  var SPOTS = [
    { key: "run", name: "OSPF が動いているか",
      re: /Process ID \d+|router ospf \d+/,
      mean: "そのインターフェースで OSPF が動いているかどうか",
      use: "show の出力なら Process ID で始まる行、設定なら router ospf で始まる行。この行があれば、そのルータでは OSPF が動いている。片方にこの行が無ければ、無いほうで OSPF を動かす設定を追加する。なお Process ID の数字は2台で違っていてもよい。ここを見比べて答えにしない" },

    { key: "area", name: "エリアの番号",
      re: /[Aa]rea \d+/,
      mean: "そのインターフェースを、どのエリアに所属させているか",
      use: "show の出力では Internet address is で始まる行の末尾に、Area 0 のように書いてある。行の頭が Internet address なので、Area という文字だけを探すと目が行かない。設定では network で始まる行の末尾。OSPF を動かしていない側で有効にするときは、この番号を相手と同じにする" },

    { key: "hello", name: "Hello",
      re: /Hello \d+|hello-interval \d+/,
      mean: "何秒おきに「動いています」という通知を送るか",
      use: "show の出力では Timer intervals configured で始まる行に、数字が4つ並ぶ。その1つめが Hello。すぐ下にある Hello due in の行は、次の通知までの残り時間なので別のもの。設定では ip ospf hello-interval の行。その行が無ければ、書いていないという意味で 10 秒になる。両側の値を比べて、違っていれば片方を相手に合わせる" },

    { key: "dead", name: "Dead",
      re: /Dead \d+|dead-interval \d+/,
      mean: "通知が何秒届かなかったら、相手が停止したと判断するか",
      use: "show の出力では Timer intervals configured で始まる行に並ぶ4つの数字の、2つめが Dead。設定では ip ospf dead-interval の行。その行が無ければ、書いていないという意味で 40 秒になる。両側の値を比べて、違っていれば片方を相手に合わせる" },

    { key: "rid", name: "Router ID",
      re: /Router ID [\d.]+|router-id [\d.]+/,
      mean: "OSPF がそのルータを見分けるための番号",
      use: "show の出力では Process ID で始まる行の中に、Router ID 192.168.1.2 のように書いてある。Router ID だけの行は無い。設定では router-id の行。両側を比べて同じ番号なら、片方の router-id の設定を削除する。Hello と Dead がそろっているのに隣接関係にならないときは、ここを見る" }
  ];

  /* ── 確認項目の名前 → 出力の中に実際にある文字 ──────────
   * 画面はこの文字を含む行を光らせる。**確認項目の名前は出力に書かれていない**ので、
   * 名前のまま探しても1行も光らない。
   * Hello を「Hello」で探すと Hello due in の行まで光ってしまうため、
   * 数字が書いてある Timer intervals configured の行だけを指す。
   */
  var HITS = {
    "OSPF が動いているか": ["Process ID", "router ospf "],
    "エリアの番号": ["Internet address", "network "],
    "Hello": ["Timer intervals configured", "hello-interval"],
    "Dead": ["Timer intervals configured", "dead-interval"],
    "Router ID": ["Process ID", "router-id"]
  };
  function hits(name) { return HITS[name] || [name]; }

  /* ── 提示物から値を読む ───────────────────────
   * 1) 何行目からが何というルータの話か、で切り分ける
   * 2) 1台ぶんから、5つの値を取り出す
   */
  function num(s) { return s == null ? null : parseInt(s, 10); }
  function grab(t, re, i) { var m = t.match(re); return m ? m[i || 1] : null; }

  function cut(text) {
    var lines = String(text || "").split("\n");
    var secs = [], cur = null, i, ln, m, host;
    for (i = 0; i < lines.length; i++) {
      ln = lines[i];
      host = null;
      /* R1#show ip ospf interface … */
      m = ln.match(/^\s*(\S+?)\s*[#>]\s*show\s+ip\s+ospf/i);
      if (m) host = m[1];
      /* Router1(config-if)#… 設定を打った跡がそのまま残っている形 */
      if (!host) {
        m = ln.match(/^\s*([A-Za-z][\w-]*)\s*\(config[^)]*\)\s*#/);
        if (m && (!cur || cur.host !== m[1])) host = m[1];
      }
      /* R1 とだけ書いてある行（running-config を並べた形） */
      if (!host) {
        m = ln.match(/^\s*([A-Za-z][A-Za-z0-9_-]*)\s*$/);
        if (m) host = m[1];
      }
      if (host) { cur = { host: host, lines: [ln] }; secs.push(cur); continue; }
      if (cur) cur.lines.push(ln);
    }
    return secs;
  }

  function one(sec) {
    var t = sec.lines.join("\n");
    var on = /Process ID\s+\d+/i.test(t) || /router\s+ospf\s+\d+/i.test(t) ||
             /ip\s+ospf\s+\d+\s+area\s+\d+/i.test(t);
    var tm = t.match(/Hello\s+(\d+)\s*,\s*Dead\s+(\d+)/);
    var hello = tm ? num(tm[1]) : num(grab(t, /ip\s+ospf\s+hello-interval\s+(\d+)/i));
    var dead = tm ? num(tm[2]) : num(grab(t, /ip\s+ospf\s+dead-interval\s+(\d+)/i));
    /* **行そのものが無いのか、書いてある値なのかを分けて覚えておく。**
       行が無いときは既定の秒数で動くが、画面には「書いていない」と出す。
       B3-M2-058 の答えは、まさにこの「行が無い」ことを見抜く問題 */
    var helloDef = false, deadDef = false;
    if (on && hello === null) { hello = DEF_HELLO; helloDef = true; }
    if (on && dead === null) { dead = DEF_DEAD; deadDef = true; }
    return {
      host: sec.host,
      on: on,
      hello: hello, helloDef: helloDef,
      dead: dead, deadDef: deadDef,
      rid: grab(t, /Router ID\s+([\d.]+)/i) || grab(t, /router-id\s+([\d.]+)/i),
      area: num(grab(t, /[Aa]rea\s+(\d+)/))
    };
  }

  var NONE = { host: "", on: false, hello: null, dead: null, rid: null, area: null,
               helloDef: false, deadDef: false };

  function read(ex) {
    var text = typeof ex === "string" ? ex : (ex && ex.text) || "";
    var secs = cut(text).map(one);
    return { A: secs[0] || NONE, B: secs[1] || NONE, text: text };
  }

  /* 二つとも数が入っていて、しかもちがうときだけ「食いちがい」とする。
     片方が空（OSPF が動いていない）のときは、ここでは決めない */
  function diff(a, b) { return a !== null && b !== null && a !== b; }
  /* 画面に出る言葉。**書いていない所を null と出さない** */
  function shown(x, k) {
    if (x[k] === null || x[k] === undefined) return "書いていない";
    if (x[k + "Def"]) return "書いていない（既定の " + x[k] + " を使う）";
    return String(x[k]);
  }
  function pair(v, k) {
    return v.A.host + " " + shown(v.A, k) + "　" + v.B.host + " " + shown(v.B, k);
  }
  function half(v, k) { return v.A[k] === null || v.B[k] === null; }

  /* ── 判定ルール。上から順に当てて、最初に当たったところで決める ──
   * frag は検算に使う。「その規則が指すコマンド片が、正しい選択肢だけに入っているか」。
   * 前の組ほど強い（数まで見る）。前が合わなければ次の組で見る。
   */
  var RULES = [
    { key: "off", cond: "片側で OSPF が動いていない",
      verdict: "動いていない側で、相手と同じエリア番号の OSPF を有効にする",
      why: "片側だけが動いていても、相手が応答しなければ隣接関係にはならない",
      look: ["OSPF が動いているか", "エリアの番号"],
      steps: function (v) {
        return [[v.A.host + " の OSPF", v.A.on ? "動いている" : "動いていない"],
                [v.B.host + " の OSPF", v.B.on ? "動いている" : "動いていない"],
                ["動いている方のエリア", v.A.on ? v.A.area : v.B.area]];
      },
      no: function (v) { return "二つとも OSPF は動いている"; },
      test: function (v) { return v.A.on !== v.B.on; },
      frag: function (v) {
        var a = v.A.on ? v.A.area : v.B.area;
        return [["area " + a]];
      } },

    { key: "both", cond: "Hello と Dead の両方が、両側で違う",
      verdict: "Hello と Dead の両方を、相手と同じ値にそろえる",
      why: "二つとも値が違うので、片方だけ直しても隣接関係にならない",
      look: ["Hello", "Dead"],
      steps: function (v) { return [["Hello", pair(v, "hello")], ["Dead", pair(v, "dead")]]; },
      no: function (v) {
        return half(v, "hello") || half(v, "dead")
          ? "片方で OSPF が動いていないので、Hello と Dead は比べられない"
          : "Hello と Dead が両方違う、という形にはなっていない";
      },
      test: function (v) { return diff(v.A.hello, v.B.hello) && diff(v.A.dead, v.B.dead); },
      frag: function (v) {
        return [["hello-interval " + v.A.hello, "dead-interval " + v.A.dead],
                ["hello", "dead"]];
      } },

    { key: "hello", cond: "Hello だけが、両側で違う",
      verdict: "Hello を、相手と同じ値にそろえる",
      why: "通知を送る間隔がそろっていないと、相手を隣として認識できない",
      look: ["Hello"],
      steps: function (v) { return [["Hello", pair(v, "hello")], ["Dead", pair(v, "dead")]]; },
      no: function (v) {
        return half(v, "hello")
          ? "片方で OSPF が動いていないので、Hello は比べられない"
          : "Hello は " + pair(v, "hello") + " で、そろっている";
      },
      test: function (v) { return diff(v.A.hello, v.B.hello); },
      frag: function (v) { return [["hello-interval " + v.A.hello], ["hello"]]; } },

    { key: "dead", cond: "Dead だけが、両側で違う",
      verdict: "Dead を、相手と同じ値にそろえる",
      why: "相手の停止を判断するまでの時間がそろっていないと、隣接関係になれない",
      look: ["Dead"],
      steps: function (v) { return [["Dead", pair(v, "dead")], ["Hello", pair(v, "hello")]]; },
      no: function (v) {
        return half(v, "dead")
          ? "片方で OSPF が動いていないので、Dead は比べられない"
          : "Dead は " + pair(v, "dead") + " で、そろっている";
      },
      test: function (v) { return diff(v.A.dead, v.B.dead); },
      frag: function (v) { return [["dead-interval " + v.A.dead], ["dead"]]; } },

    { key: "rid", cond: "両側の Router ID が同じ番号",
      verdict: "両側の Router ID が同じなので、片方の設定を削除する",
      why: "見分けるための番号が同じだと、相手と自分を区別できない",
      look: ["Router ID"],
      steps: function (v) { return [["Router ID", pair(v, "rid")]]; },
      no: function (v) {
        if (!v.A.rid && !v.B.rid) return "Router ID は、どちらにも書いていない";
        if (!v.A.rid || !v.B.rid) return "Router ID は、片方にしか書いていない";
        return "Router ID は " + pair(v, "rid") + " で、別の番号";
      },
      test: function (v) { return !!v.A.rid && v.A.rid === v.B.rid; },
      frag: function (v) { return [["no router-id"]]; } }
  ];

  function judge(v) {
    for (var i = 0; i < RULES.length; i++) if (RULES[i].test(v)) return RULES[i];
    return null;
  }

  var GLOSS = {
    "動いていない側で、相手と同じエリア番号の OSPF を有効にする":
      "OSPF は両側で動いて、はじめて相手を見つけられる",
    "Hello と Dead の両方を、相手と同じ値にそろえる":
      "二つの秒数がどちらも違うので、両方とも書き換える",
    "Hello を、相手と同じ値にそろえる":
      "通知を送る間隔。ここが違うと隣接関係になれない",
    "Dead を、相手と同じ値にそろえる":
      "相手の停止を判断するまでの時間。ここが違うと隣接関係になれない",
    "両側の Router ID が同じなので、片方の設定を削除する":
      "設定を削除すると、そのルータのアドレスから番号が自動で付け直される"
  };

  /* 本の答えとの言い換え表。本に印刷された文言と突き合わせるのに使う */
  var SAME = {
    "動いていない側で、相手と同じエリア番号の OSPF を有効にする": ["area", "エリア"],
    "Hello と Dead の両方を、相手と同じ値にそろえる": ["hello-interval", "hello"],
    "Hello を、相手と同じ値にそろえる": ["hello-interval", "hello"],
    "Dead を、相手と同じ値にそろえる": ["dead-interval", "dead"],
    "両側の Router ID が同じなので、片方の設定を削除する": ["router-id", "ルータ ID", "ルーター ID"]
  };

  /* ── 出力を作る ─────────────────────────────
   * 3つの形。どれも二つのルータを上下に並べる。
   *   show   show ip ospf interface の出力
   *   cfg    running-config を並べたもの
   *   typed  打ったコマンドが合図つきで残っているもの
   * hello・dead が null のときは、**その行を書かない。**
   * 書かない＝既定の秒数、という読み方を練習させるため。
   */
  function showOne(o) {
    return [
      o.host + "#show ip ospf interface " + o.shortIntf,
      o.intf + " is up, line protocol is up",
      "  Internet address is " + o.ip + "/24, Area " + o.area,
      "  Process ID " + o.pid + ", Router ID " + o.rid +
        ", Network Type POINT-TO-POINT, Cost: 1",
      "  Transmit Delay is 1 sec, State POINT-TO-POINT,",
      "  Timer intervals configured, Hello " + o.hello + ", Dead " + o.dead +
        ", Wait " + o.dead + ", Retransmit 5",
      "    Hello due in 00:00:" + o.due,
      "  Index 1/1, flood queue length 0",
      "  Next 0x0(0)/0x0(0)",
      "  Last flood scan length is 1, maximum is 1",
      "  Last flood scan time is 0 msec, maximum is 0 msec",
      "  Suppress hello for 0 neighbor(s)"
    ].join("\n");
  }

  function cfgOne(o) {
    var out = [o.host,
      "interface " + o.intf,
      " ip address " + o.ip + " " + o.mask];
    if (o.hello !== null) out.push(" ip ospf hello-interval " + o.hello);
    if (o.dead !== null) out.push(" ip ospf dead-interval " + o.dead);
    out.push(" no shutdown");
    if (o.on) {
      out.push("router ospf " + o.pid);
      out.push(" router-id " + o.rid);
      out.push(" network " + o.net + " " + o.wild + " area " + o.area);
    }
    return out.join("\n");
  }

  function typedOne(o) {
    var p = o.host + "(config";
    var out = [p + ")#interface " + o.intf,
      p + "-if)#description ***Connection to " + o.peer + "***",
      p + "-if)#ip address " + o.ip + " " + o.mask];
    if (o.hello !== null) out.push(p + "-if)#ip ospf hello-interval " + o.hello);
    if (o.dead !== null) out.push(p + "-if)#ip ospf dead-interval " + o.dead);
    if (o.on) {
      out.push(p + ")#router ospf " + o.pid);
      out.push(p + "-router)#router-id " + o.rid);
      out.push(p + "-router)#network " + o.net + " " + o.wild + " area " + o.area);
    }
    return out.join("\n");
  }

  /* 1台ぶんの値をそろえる。show の形では秒数を空にできない
     （Timer intervals の行には必ず数字が出るため）ので、既定の秒数を入れる */
  function side(v, i) {
    var h = v["hello" + i], d = v["dead" + i];
    if (v.shape === "show") {
      if (h === null) h = DEF_HELLO;
      if (d === null) d = DEF_DEAD;
    }
    return {
      host: v["n" + i], peer: v["n" + (i === 1 ? 2 : 1)],
      intf: v.intf, shortIntf: v.shortIntf, mask: v.mask,
      ip: v["ip" + i], net: v["net" + i], wild: v.wild,
      on: i === 1 ? true : v.on2 !== false,
      pid: v["pid" + i], rid: v["rid" + i], area: v["area" + i],
      hello: h, dead: d, due: v["due" + i]
    };
  }

  function build(v) {
    var a = side(v, 1), b = side(v, 2);
    if (v.shape === "cfg") return cfgOne(a) + "\n\n" + cfgOne(b);
    if (v.shape === "typed") return typedOne(a) + "\n\n" + typedOne(b);
    return showOne(a) + "\n\n" + showOne(b);
  }

  var PAIRS = [["R1", "R2"], ["R1", "R3"], ["R4", "R7"], ["OldR", "R2"], ["R2", "R5"],
               ["Router1", "Router2"], ["RtrA", "RtrB"]];
  var HELLOS = [5, 10, 15, 20, 25, 30];
  var DEADS = [20, 30, 40, 45, 60, 80, 120];
  var PIDS = [1, 2, 10, 20, 100, 1000, 1001];
  var RIDS = ["1.1.1.1", "2.2.2.2", "4.4.4.4", "10.1.1.1", "10.1.1.2",
              "192.168.1.1", "192.168.1.2", "172.16.0.1"];
  var INTFS = [["GigabitEthernet0/0/0", "g0/0/0"], ["GigabitEthernet0/1", "g0/1"],
               ["GigabitEthernet1/1", "g1/1"], ["GigabitEthernet0/0/1", "g0/0/1"]];

  function other(list, x) {
    return pick(list.filter(function (y) { return y !== x; }));
  }
  /* Dead は Hello より長い。**過去問の提示物も、必ずそうなっている。**
     Hello 30 秒に対して Dead 20 秒のような、ありえない組み合わせを作らない */
  function otherHello(x, dead) {
    return pick(HELLOS.filter(function (y) { return y !== x && y < dead; }));
  }
  function otherDead(x, hello) {
    return pick(DEADS.filter(function (y) { return y !== x && y > hello; }));
  }

  /* **本の提示物と同じ文章にならないようにする。**
     本が使っているアドレスは 192.168.1.x・192.168.12.x・10.10.10.x の3つだけ。
     3つめの数を 20 以上にすれば、どの本の提示物とも文字が一致しない */
  function baseVals() {
    var p = pick(PAIRS), h = pick(HELLOS);
    var d = pick(DEADS.filter(function (x) { return x > h; }));
    var r1 = pick(RIDS), r2 = other(RIDS, r1);
    var a = pick([0, 1, 2]);
    var pid1 = pick(PIDS);
    var it = pick(INTFS);
    var shape = pick(["show", "show", "show", "cfg", "typed"]);
    var third = R(20, 250);
    var v = {
      shape: shape,
      n1: p[0], n2: p[1],
      /* Process ID は2台で違っていてよい（B3-M2-058 の解説）。
         ときどき違う数にして、そこが答えではないことを体でおぼえてもらう */
      pid1: pid1, pid2: Math.random() < 0.4 ? other(PIDS, pid1) : pid1,
      intf: it[0], shortIntf: it[1],
      area1: a, area2: a, rid1: r1, rid2: r2,
      hello1: h, hello2: h, dead1: d, dead2: d,
      due1: "0" + R(1, 9), due2: "0" + R(1, 9),
      on2: true
    };
    if (shape === "typed") {                     /* /30 の2台つなぎ（B3-M2-058 の形） */
      v.mask = "255.255.255.252";
      v.ip1 = "10." + third + ".10.1";
      v.ip2 = "10." + third + ".10.2";
      /* 相手もふくむ範囲を1行で書く形。2台とも同じ行になる */
      v.net1 = v.net2 = "10." + third + ".10.0";
      v.wild = "0.0.0.3";
    } else {
      v.mask = "255.255.255.0";
      v.ip1 = "192.168." + third + ".1";
      v.ip2 = "192.168." + third + ".2";
      /* 自分のアドレスだけを書く形。2台で行が変わる */
      v.net1 = v.ip1; v.net2 = v.ip2;
      v.wild = "0.0.0.0";
    }
    return v;
  }

  var MAKERS = {
    /* 片方で OSPF が動いていない。show の出力では出しようがないので、設定の形にする */
    off: function (b) {
      /* show の形で作りかけたときは、アドレスの組はそのままで設定の形に切りかえる */
      if (b.shape === "show") b.shape = "cfg";
      b.on2 = false;
      /* 動いていない側には、秒数の行も書かない（B1-P12-087 と同じ見え方） */
      b.hello2 = null; b.dead2 = null;
      return b;
    },
    /* Hello も Dead もちがう */
    both: function (b) {
      /* 設定の形では「両方の行がそもそも無い」という出し方もできる。
         片側だけが 5 秒と 20 秒を書いていて、相手は何も書いていない形 */
      if (b.shape !== "show" && b.hello1 !== DEF_HELLO && b.dead1 !== DEF_DEAD &&
          Math.random() < 0.4) {
        b.hello2 = null; b.dead2 = null;
      } else {
        b.hello2 = other(HELLOS, b.hello1);
        b.dead2 = otherDead(b.dead1, b.hello2);
      }
      return b;
    },
    /* Hello だけちがう。設定の形では B3-M2-058 と同じ「行が無い」形も作る */
    hello: function (b) {
      if (b.shape !== "show" && b.hello1 !== DEF_HELLO && Math.random() < 0.5) {
        b.hello2 = null; b.dead1 = null; b.dead2 = null;   /* Dead は両側とも既定の 40 */
      } else {
        b.hello2 = otherHello(b.hello1, b.dead2);
      }
      return b;
    },
    /* Dead だけちがう */
    dead: function (b) {
      if (b.shape !== "show" && b.dead1 !== DEF_DEAD && Math.random() < 0.5) {
        b.dead2 = null; b.hello1 = null; b.hello2 = null;  /* Hello は両側とも既定の 10 */
      } else {
        b.dead2 = otherDead(b.dead1, b.hello2);
      }
      return b;
    },
    /* Router ID が同じ */
    rid: function (b) { b.rid2 = b.rid1; return b; }
  };

  /* 決め手だけを残す。**どちらの形でも、値の書いてある行だけを残す。**
     残した行だけで読み直しても、同じ判定にならなければならない */
  var KEEP = /show\s+ip\s+ospf|\(config[^)]*\)\s*#|Internet address|Process ID|Timer intervals|hello-interval|dead-interval|router\s+ospf|router-id|^\s*network\s|ip\s+ospf\s+\d+\s+area|^\s*interface\s|^\s*ip address\s/i;
  function excerpt(text, look) {
    var lines = String(text || "").split("\n"), out = [], i;
    for (i = 0; i < lines.length; i++) {
      if (/^\s*[A-Za-z][A-Za-z0-9_-]*\s*$/.test(lines[i]) || KEEP.test(lines[i])) {
        out.push(lines[i]);
      }
    }
    return out.join("\n");
  }

  /* ── 練習の問題文と選択肢 ─────────────────────
   * **「この値なら、どうしますか」では何を聞かれているか分からない。**
   * その所で何をたしかめるのかを、そのまま文にする。
   *   Hello と Dead を確認します。「Hello も Dead も、二つの数がちがう」になっていますか。
   *     ・はい。Hello と Dead を、どちらも相手と同じ数にする
   *     ・いいえ。次に「Hello だけ、二つの数がちがう」を見る
   */
  var VERDICTS = [];
  RULES.forEach(function (r) {
    if (VERDICTS.indexOf(r.verdict) < 0) VERDICTS.push(r.verdict);
  });
  function condOf(verdict) {
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].verdict === verdict) return RULES[i].cond;
    }
    return "";
  }

  function walkQ(st, v, shuffle) {
    var yes = "はい。" + st.verdict;
    var no = st.nextVerdict
      ? "いいえ。次に「" + condOf(st.nextVerdict) + "」を見る"
      : "いいえ。ここでは決まらない";
    var wrong = shuffle(VERDICTS.filter(function (x) { return x !== st.verdict; }))[0];
    var right = st.hit ? yes : no;
    var opts = [right, st.hit ? no : yes];
    if (wrong) opts.push("はい。" + wrong);
    var seen = {}, uniq = [];
    opts.forEach(function (o) { if (!seen[o]) { seen[o] = 1; uniq.push(o); } });
    return { ask: st.look.join(" と ") + " を確認します。「" + condOf(st.verdict) +
                  "」になっていますか。",
             opts: shuffle(uniq), right: right };
  }

  /* ── 練習の1問を、この分野で組み立てる ───────────────
   * 1つの確認項目につき、次の順で出す。
   *   ① その確認項目が、出力のどの行に書いてあるか（確認項目の数だけ）
   *   ② その行を見て、ここで答えが決まるか
   *   ③ 決まらないので、次の確認項目へ進むか
   * ①を先に置くのは、**どこを見るか分からないままでは②が解けない**ため。
   */
  function genKey(key) {
    for (var t = 0; t < 60; t++) {
      var text = build(MAKERS[key](baseVals()));
      var r = judge(read(text));
      if (r && r.key === key) return text;
    }
    return null;
  }
  function genAny() {
    var keys = Object.keys(MAKERS);
    for (var t = 0; t < 60; t++) {
      var text = genKey(pick(keys));
      if (text) return text;
    }
    return null;
  }
  /* i 番目の確認項目まで進む出力。hit=true … そこで決まる／false … 決まらず次へ */
  function genReach(i, hit, bs) {
    var pool = [], j;
    if (hit) pool = bs[i].keys.slice();
    else for (j = i + 1; j < bs.length; j++) pool = pool.concat(bs[j].keys);
    if (!pool.length) return null;
    for (var t = 0; t < 60; t++) {
      var text = genKey(pick(pool));
      if (text) return text;
    }
    return null;
  }

  /* ①「どの行を見ますか」。
     正解は、その確認項目が実際に書いてある行。
     まちがいは、**同じ出力の中の別の行**（Hello due in の行、Process ID の行など）。
     こちらで文を作らない。どちらも出力にそのまま出ている行を使う */
  /* まちがいの選択肢に選びたい行。**値が書いてある行を先に出す。**
     Last flood scan … のような、何も書いていない行だけが並ぶと、
     見ただけでよけられてしまい、練習にならない */
  var NEAR = ["Internet address", "Process ID", "Timer intervals configured",
              "Hello due in", "hello-interval", "dead-interval", "router-id",
              "network ", "router ospf ", "ip address", "interface "];
  function nearish(ln) {
    return NEAR.some(function (w) { return ln.indexOf(w) >= 0; });
  }

  function lineQ(spot, shuffle) {
    var hs = hits(spot.name);
    var isHit = function (ln) {
      return hs.some(function (w) { return ln.indexOf(w) >= 0; });
    };
    for (var t = 0; t < 60; t++) {
      var text = genAny();
      if (!text) continue;
      var secs = cut(text), target = null, k;
      for (k = 0; k < secs.length; k++) {
        if (secs[k].lines.slice(1).some(isHit)) { target = secs[k]; break; }
      }
      if (!target) continue;
      var right = null, good = [], rest = [], seen = {};
      var take = function (s) {
        s.lines.forEach(function (ln, li) {
          var x = ln.trim();
          if (!x || li === 0) return;      /* 各段の1行目は、どのルータの話かの見出し */
          if (isHit(ln)) {
            if (s === target && right === null) right = x;
            return;                        /* 同じ行が相手側にもあるので、誤答にしない */
          }
          if (seen[x]) return;
          seen[x] = 1;
          (nearish(ln) ? good : rest).push(x);
        });
      };
      /* まちがいは、まず**たずねているルータの中**から取る。
         そこで足りないときだけ、相手側の行も使う */
      take(target);
      var pool = shuffle(good).concat(shuffle(rest));
      if (pool.length < 3) {
        secs.forEach(function (s) { if (s !== target) take(s); });
        pool = shuffle(good).concat(shuffle(rest));
      }
      if (!right || pool.length < 2) continue;
      return { text: text, host: target.host, right: right,
               opts: shuffle([right].concat(pool.slice(0, 3))) };
    }
    return null;
  }

  /* ②③ で画面に渡す道すじ。engine の walk と同じ形にそろえる */
  function stepOf(i, v, hit, bs) {
    var b = bs[i];
    var rules = RULES.filter(function (r) { return b.keys.indexOf(r.key) >= 0; });
    var vals = [];
    rules.forEach(function (r) {
      r.steps(v).forEach(function (x) {
        if (!vals.some(function (y) { return y[0] === x[0]; })) vals.push(x);
      });
    });
    return {
      look: b.look.slice(),
      values: vals.map(function (x) { return { name: x[0], value: String(x[1]) }; }),
      hit: hit, verdict: b.verdict,
      why: hit ? b.why : rules[0].no(v),
      next: i + 1 < bs.length ? bs[i + 1].look.join(" と ") : null,
      nextVerdict: i + 1 < bs.length ? bs[i + 1].verdict : null,
      step: i + 1, of: bs.length
    };
  }

  function stepQ(i, n, ctx) {
    var bs = ctx.blocks(), b = bs[i];
    if (!b) return null;
    var sp = b.spots || [];
    if (n >= sp.length + 2) return null;
    /* ① どの行を見るか */
    if (n < sp.length) {
      var q = lineQ(sp[n], ctx.shuffle);
      if (!q) return null;
      return { kind: "step",
        ask: "「" + sp[n].name + "」を確かめるには、" + q.host + " のどの行を見ますか。",
        exhibit: q.text, opts: q.opts, right: q.right,
        /* look を空にしておく。**問題を出している間に、答えの行を光らせない** */
        extra: { step: { look: [], values: [], hit: false, verdict: b.verdict,
                         why: sp[n].use, next: null, nextVerdict: null,
                         step: i + 1, of: bs.length }, i: i } };
    }
    /* ②③ その行を見て、ここで決まるか */
    var hit = (n === sp.length);
    var text = genReach(i, hit, bs);
    if (!text) return null;
    var v = ctx.read(text);
    var st = stepOf(i, v, hit, bs);
    var w = walkQ(st, v, ctx.shuffle);
    return { kind: "step", ask: w.ask, exhibit: text, opts: w.opts, right: w.right,
             extra: { step: st, i: i } };
  }

  /* ── 説明の1枚に出す現物 ─────────────────────
   * **同じ1台を、二つの形で並べる。**上が show の出力、下が同じルータの設定。
   * 確認項目ごとに光る行が変わるので、5枚を通ると
   * 「同じ値が、形によってどの行に出るか」がそのまま見える。
   */
  var LEARN_EX = [
    "【show ip ospf interface の出力】",
    "R1#show ip ospf interface g0/0/1",
    "GigabitEthernet0/0/1 is up, line protocol is up",
    "  Internet address is 192.168.30.1/24, Area 0",
    "  Process ID 1, Router ID 1.1.1.1, Network Type POINT-TO-POINT, Cost: 1",
    "  Transmit Delay is 1 sec, State POINT-TO-POINT,",
    "  Timer intervals configured, Hello 5, Dead 20, Wait 20, Retransmit 5",
    "    Hello due in 00:00:03",
    "  Index 1/1, flood queue length 0",
    "",
    "【同じ1台の設定】",
    "R1",
    "interface GigabitEthernet0/0/1",
    " ip address 192.168.30.1 255.255.255.0",
    " ip ospf hello-interval 5",
    " ip ospf dead-interval 20",
    " no shutdown",
    "router ospf 1",
    " router-id 1.1.1.1",
    " network 192.168.30.1 0.0.0.0 area 0"
  ].join("\n");
  function learnEx() { return LEARN_EX; }

  /* 見本（検算に使う。5つの確認項目がすべて出ている出力） */
  function sample() {
    return build({ shape: "show", n1: "R1", n2: "R2", pid1: 1, pid2: 2,
                   intf: "GigabitEthernet0/0/1", shortIntf: "g0/0/1",
                   mask: "255.255.255.0",
                   ip1: "192.168.30.1", ip2: "192.168.30.2",
                   net1: "192.168.30.1", net2: "192.168.30.2", wild: "0.0.0.0",
                   area1: 0, area2: 0, rid1: "1.1.1.1", rid2: "2.2.2.2",
                   hello1: 15, hello2: 5, dead1: 60, dead2: 60,
                   due1: "03", due2: "07", on2: true });
  }

  var spec = {
    id: "ospf",
    kind: "rules",
    card: "read",
    name: "OSPF の隣接関係",
    note: "両側のルータの設定を見比べて、隣接関係になれない原因を直す",
    obj: "3.4",
    spots: SPOTS, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt,
    hits: hits, learnEx: learnEx, stepQ: stepQ, perSpot: 4,
    ask: "両側の設定を見比べて、どこをどう直しますか。",
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample,
    expect: { spots: 5, rules: 5, questions: 7 },
    /* **本の答えが出力と食い違っていて使えない問題。**いまは無い */
    dropped: [],
    /* 中身が別の題材なので、よそのブロックへ送った問題。
       使えない問題（dropped）とは分けて書く。理由は scripts/ospf_block.py の MOVED */
    movedTo: {
      "B1-P14-049": "ospfdr（OSPF の代表ルータ）",
      "B2-0076-01": "ospfdr（OSPF の代表ルータ）",
      "B1-P16-005": "ログの読み取り（目標1.4）",
      "B2-0054-01": "ログの読み取り（目標1.4）",
      "B3-M3-047": "ログの読み取り（目標1.4）",
      "B1-P13-030": "足りない設定を選ぶ"
    }
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.ospf = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
