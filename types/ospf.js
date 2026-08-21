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

  /* ── 行の中で光らせる言葉（marks） ────────────────
   * **行を塗るだけでは、どの数字かが伝わらない。**
   * Timer intervals configured の行は
   *   Timer intervals configured, Hello 15, Dead 20, Wait 20, Retransmit 5
   * と、1行に数字が4つ並ぶ。Wait も Retransmit も同じ顔で並んでいるので、
   * 行を塗ると「どれを見ればいいのか」が消えてしまう。
   * そこで、その確認項目で見る数字だけを重ねて光らせる。
   *
   * **「Hello」とだけ書いて探さない。**すぐ下の Hello due in の行まで光ってしまう。
   * 出てくる数は決まっている（HELLOS・DEADS）ので、「Hello 15」のように
   * 数までふくめた形で探す。こうすると Hello due in には当たらない。
   */
  var AREAS = [0, 1, 2];
  function withNums(word, list) {
    return list.map(function (x) { return word + " " + x; });
  }
  function marks(name) {
    if (name === "OSPF が動いているか") return ["Process ID", "router ospf"];
    if (name === "エリアの番号") {
      return withNums("Area", AREAS).concat(withNums("area", AREAS));
    }
    if (name === "Hello") {
      return withNums("Hello", HELLOS)
        .concat(withNums("hello-interval", HELLOS), ["hello-interval"]);
    }
    if (name === "Dead") {
      return withNums("Dead", DEADS)
        .concat(withNums("dead-interval", DEADS), ["dead-interval"]);
    }
    if (name === "Router ID") return ["Router ID", "router-id"];
    return [];
  }

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
      /* **条件は verdict に書かない。**説明の1枚では
         「両側の Router ID が同じ番号 ▼ 片方の Router ID の設定を削除する」と
         上下に並ぶので、verdict にも「同じなので」と入れると2回読ませることになる */
      verdict: "片方の Router ID の設定を削除する",
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
    "片方の Router ID の設定を削除する":
      "設定を削除すると、そのルータのアドレスから番号が自動で付け直される"
  };

  /* 本の答えとの言い換え表。本に印刷された文言と突き合わせるのに使う */
  var SAME = {
    "動いていない側で、相手と同じエリア番号の OSPF を有効にする": ["area", "エリア"],
    "Hello と Dead の両方を、相手と同じ値にそろえる": ["hello-interval", "hello"],
    "Hello を、相手と同じ値にそろえる": ["hello-interval", "hello"],
    "Dead を、相手と同じ値にそろえる": ["dead-interval", "dead"],
    "片方の Router ID の設定を削除する": ["router-id", "ルータ ID", "ルーター ID"]
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
    var a = pick(AREAS);
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
   * **問いは、いつもこの分野が最後に答えるべき問い（spec.ask）。**
   * 「Hello と Dead を確認します。…になっていますか」のような聞き方はしない。
   * 何を目指しているのか分からないまま、進み方だけ聞かれても答えようがない。
   *
   * 代わりに、選択肢に「◯◯だけでは決められない」を混ぜる。
   * その選択肢が、次の確認項目へ進む思考をそのまま教える。
   *
   *   両側の設定を見比べて、どこをどう直しますか。
   *     ・Hello を、相手と同じ値にそろえる
   *     ・Dead を、相手と同じ値にそろえる
   *     ・片方の Router ID の設定を削除する
   *     ・Hello と Dead だけでは決められない
   */
  var VERDICTS = [];
  RULES.forEach(function (r) {
    if (VERDICTS.indexOf(r.verdict) < 0) VERDICTS.push(r.verdict);
  });

  /* 確認項目を短く言った名前。「◯◯だけでは決められない」に入れる。
     look をそのままつなぐと「OSPF が動いているか と エリアの番号」になって、
     選択肢として読みにくい */
  var SHORT = {
    off: "OSPF とエリアの番号",
    both: "Hello と Dead",
    hello: "Hello",
    dead: "Dead",
    rid: "Router ID"
  };

  function ruleOf(key) {
    for (var i = 0; i < RULES.length; i++) if (RULES[i].key === key) return RULES[i];
    return null;
  }
  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  /* 提示物ぜんぶを見たときの答えと、その決め手 */
  function fullRule(v) { return judge(v); }

  function walkQ(st, key, v, shuffle) {
    var undecided = SHORT[key] + " だけでは決められない";
    var opts, right, full = fullRule(v);
    if (st.hit) {
      right = st.verdict;
      opts = [right];
      /* **次の確認項目があるときだけ**「決められない」を混ぜる。
         最後の確認項目（Router ID）で出すと、正しくない選び方を教えてしまう。
         決まる問題にも混ぜるのは、決まらない問題だけに出すと
         「この選択肢が見えたらそれが正解」と形で覚えられてしまうため */
      if (st.next) opts.push(undecided);
      shuffle(VERDICTS.filter(function (x) { return x !== right; }))
        .forEach(function (x) { if (opts.length < 4) opts.push(x); });
    } else {
      right = undecided;
      /* **決まらない問題の誤答に、最後まで見たときの答えを入れない。**
         提示物には後の決め手も写っているので、その答えを並べると
         「決められない」とその答えの2つが正解になってしまう。
         **食い違っている所を丸ごとふくむ答えも外す。**
         Dead だけが違う出力に「Hello と Dead の両方をそろえる」を並べると、
         そちらでも直ってしまい、やはり正解が2つになる */
      opts = [right];
      shuffle(RULES.filter(function (r) {
        if (r.verdict === st.verdict) return false;
        return !(full && within(full.look, r.look));
      })).forEach(function (r) { if (opts.length < 4) opts.push(r.verdict); });
    }
    return { ask: spec.ask, opts: shuffle(uniq(opts)), right: right };
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
  /* i 番目の確認項目まで進む出力。hit=true … そこで決まる／false … 決まらず次へ
   *
   * **「◯◯だけでは決められない」と言い切れる出力だけを作る。**
   * Hello と Dead の両方を見る所で「Hello だけが違う」出力を出すと、
   * Hello と Dead を見れば決まってしまい、決められないが正しくなくなる。
   * そこで、決め手がこの確認項目の中に収まってしまうルールは外す。
   */
  function within(look, mine) {
    return look.every(function (w) { return mine.indexOf(w) >= 0; });
  }
  function genReach(i, hit, bs) {
    var pool = [], j;
    if (hit) pool = bs[i].keys.slice();
    else for (j = i + 1; j < bs.length; j++) {
      if (within(bs[j].look, bs[i].look)) continue;
      pool = pool.concat(bs[j].keys);
    }
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
    return {
      look: b.look.slice(),
      /* **読み取った値の表は出さない。**「Hello　R1 15　R2 10」と先に出すと、
         出力の中から数字を探す所が丸ごと済んでしまい、答える前に答えが見える。
         この分野で難しいのは、まさにその「どこに書いてあるか」のほう。
         数字は答え合わせ（answerNote）で出す */
      values: [],
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
    var w = walkQ(st, b.keys[0], v, ctx.shuffle);
    return { kind: "step", ask: w.ask, exhibit: text, opts: w.opts, right: w.right,
             extra: { step: st, i: i } };
  }

  /* ── 説明の1枚に出す現物 ─────────────────────
   * **同じ1台を、二つの形で並べる。**上が show の出力、下が同じルータの設定。
   * 確認項目ごとに光る行が変わるので、5枚を通ると
   * 「同じ値が、形によってどの行に出るか」がそのまま見える。
   */
  /* ── 説明の1枚に出す見本 ───────────────────
   * **判定ルールは「両側を見比べる」話なので、見本も2台出す。**
   * 1台だけ見せて「片側に…が無い」と書いても、どこの何を言っているのか分からない。
   * 確認項目ごとに、その決まりがそのまま目で見える2台を出す。
   *
   *   OSPF が動いているか … 設定の形。片側に router ospf の行が無い
   *   Hello と Dead など  … show の出力。その値だけが両側で違う
   */
  function learnTwo(a, b) { return a.concat([""], b).join("\n"); }

  /* show ip ospf interface の出力を1台ぶん作る */
  function learnShow(name, area, pid, rid, hello, dead) {
    return ["【" + name + " の show ip ospf interface】",
            name + "#show ip ospf interface g0/0/1",
            "GigabitEthernet0/0/1 is up, line protocol is up",
            "  Internet address is 192.168.30." + (name === "R1" ? "1" : "2") +
              "/24, Area " + area,
            "  Process ID " + pid + ", Router ID " + rid +
              ", Network Type POINT-TO-POINT, Cost: 1",
            "  Timer intervals configured, Hello " + hello + ", Dead " + dead +
              ", Wait " + dead + ", Retransmit 5",
            "    Hello due in 00:00:03"];
  }

  /* 設定を1台ぶん作る。ospf が false のときは OSPF の行を書かない */
  function learnConf(name, last, ospf) {
    var out = ["【" + name + " の設定】",
               "interface GigabitEthernet0/0/1",
               " ip address 192.168.30." + last + " 255.255.255.0",
               " no shutdown"];
    if (ospf) {
      out.push("router ospf 1");
      out.push(" network 192.168.30." + last + " 0.0.0.0 area 0");
    }
    return out;
  }

  /* 見本に使う値。**説明の一言も、ここから作る。**
     別々に書くと、片方を直したときにもう片方とずれる */
  var LV = {
    both:  { h1: 5,  d1: 20, h2: 10, d2: 40 },
    hello: { h1: 5,  d1: 40, h2: 10, d2: 40 },
    dead:  { h1: 10, d1: 20, h2: 10, d2: 40 },
    rid:   { h1: 10, d1: 40, h2: 10, d2: 40, rid1: "1.1.1.1", rid2: "1.1.1.1" }
  };
  var LEARN_EX = {
    /* 片側で OSPF が動いていない。**設定の形でしか見えない**
       （動いていない側は show ip ospf interface に何も出ない） */
    off: learnTwo(learnConf("R1", "1", true), learnConf("R2", "2", false)),
    both: learnTwo(learnShow("R1", 0, 1, "1.1.1.1", LV.both.h1, LV.both.d1),
                   learnShow("R2", 0, 1, "2.2.2.2", LV.both.h2, LV.both.d2)),
    hello: learnTwo(learnShow("R1", 0, 1, "1.1.1.1", LV.hello.h1, LV.hello.d1),
                    learnShow("R2", 0, 1, "2.2.2.2", LV.hello.h2, LV.hello.d2)),
    dead: learnTwo(learnShow("R1", 0, 1, "1.1.1.1", LV.dead.h1, LV.dead.d1),
                   learnShow("R2", 0, 1, "2.2.2.2", LV.dead.h2, LV.dead.d2)),
    rid: learnTwo(learnShow("R1", 0, 1, LV.rid.rid1, LV.rid.h1, LV.rid.d1),
                  learnShow("R2", 0, 1, LV.rid.rid2, LV.rid.h2, LV.rid.d2))
  };

  function learnEx(block) {
    var k = (block && block.keys && block.keys[0]) || "off";
    return LEARN_EX[k] || LEARN_EX.off;
  }

  /* ── 短い説明の1枚 ────────────────────────
   * **文字は読まれない。**見たらすぐ「こう出ていたら、こう直す」と
   * 分かる形だけを残す。判定ルール5本を、そのまま1行の言葉にしたもの。
   * **ルールは増やさない。**ここにある行と RULES は1対1で対応する。
   *
   * この分野でいちばん難しいのは「どこに書いてあるか」なので、
   * if には出力に実際に書いてある目印（Process ID・Timer intervals configured）を入れる。
   * 値の名前だけを書いても、初めて見る人は出力の中からその値を探せない。
   */
  var IF = {
    off: "片側に router ospf の行が無い",
    both: "Hello も Dead も、両側で数が違う",
    hello: "Hello だけ、両側で数が違う",
    dead: "Dead だけ、両側で数が違う",
    rid: "両側の Router ID が同じ番号"
  };

  /* 添える一言。**取り違えやすい所だけ。**説明を足さない */
  /* 添える一言。**上の見本を指して、具体的に書く。**
     初めて見る人は「片側に router ospf の行が無い」と言われても、
     どの行のことか分からない。見本のどこを見ればよいかまで書く */
  var NOTE = {
    off: "R1 には router ospf 1 と network …… area 0 の2行がある。R2 にはこの2行が無いので、" +
         "R2 にも同じ2行を足す。show の出力で見るときは Process ID の行が無く、" +
         "エリアは Internet address の行の末尾に出る",
    both: "R1 は Hello " + LV.both.h1 + "・Dead " + LV.both.d1 +
          "、R2 は Hello " + LV.both.h2 + "・Dead " + LV.both.d2 +
          "。どちらも違うので両方そろえる。数字は Timer intervals configured の行に4つ並び、" +
          "1つめが Hello、2つめが Dead",
    hello: "R1 は Hello " + LV.hello.h1 + "、R2 は Hello " + LV.hello.h2 +
           "。Dead はどちらも " + LV.hello.d1 + " で同じ。" +
           "すぐ下の Hello due in は次に送るまでの残り時間なので、別のもの",
    dead: "R1 は Dead " + LV.dead.d1 + "、R2 は Dead " + LV.dead.d2 +
          "。Hello はどちらも " + LV.dead.h1 + " で同じ。" +
          "設定の形で見るときは ip ospf dead-interval の行",
    rid: "R1 も R2 も Router ID が " + LV.rid.rid1 + " で同じ。" +
         "Router ID は Process ID の行の中にある。設定の形では router-id の行"
  };

  function brief(block, i) {
    var keys = (block && block.keys) || [];
    var out = [];
    keys.forEach(function (k) {
      var r = ruleOf(k);
      if (!r || !IF[k]) return;
      out.push({ if: IF[k], then: r.verdict, note: NOTE[k] || null });
    });
    return out.length ? out : null;
  }

  /* ── 答え合わせの言葉 ──────────────────────
   * **決まりと、この出力の数字を、別々の行に出す。**同じことを2回書かない。
   * 決まりは説明の1枚（brief）と同じ言葉にそろえる。
   *   決まり  「Hello だけ、両側で数が違う ＝ Hello を、相手と同じ値にそろえる」
   *   この場合「Hello は R1 15　R2 10。Dead は R1 40　R2 40 で同じ」
   *
   * **いま見ている確認項目のことだけを書く。**
   * まだ見ていない所の答えを先に出すと、練習の順番が壊れる。
   *   ここで決まったとき   … その決まりと、この出力の数字
   *   ここで決まらないとき … なぜ決まらないかだけ（次にどうするかは、答えの行にある）
   */
  /* 両側が同じ数のときの言い方。**同じ数を2回並べない。**
     「Dead は R1 書いていない（既定の 40 を使う）　R2 書いていない（既定の 40 を使う）」
     と並べても、そろっていることが読み取れない */
  function level(v, k, label) {
    var a = v.A[k], b = v.B[k];
    if (a === null || b === null || a !== b) return label + " は " + pair(v, k);
    if (v.A[k + "Def"] && v.B[k + "Def"]) {
      return label + " は両側とも書いていないので、どちらも既定の " + a + " 秒";
    }
    if (v.A[k + "Def"] || v.B[k + "Def"]) {
      return label + " は " + pair(v, k) + " で、どちらも " + a + " 秒";
    }
    return label + " は両側とも " + a;
  }

  function bodyHit(key, v) {
    if (key === "off") {
      var on = v.A.on ? v.A : v.B, off = v.A.on ? v.B : v.A;
      return off.host + " には OSPF の行が無い。" + on.host + " のエリアは " + on.area;
    }
    if (key === "both") {
      return "Hello は " + pair(v, "hello") + "、Dead は " + pair(v, "dead");
    }
    /* Hello だけ・Dead だけのときは、**そろっているほうも書く。**
       「だけ」と言い切れる理由が、そこにあるため */
    if (key === "hello") {
      return "Hello は " + pair(v, "hello") + "。" + level(v, "dead", "Dead");
    }
    if (key === "dead") {
      return "Dead は " + pair(v, "dead") + "。" + level(v, "hello", "Hello");
    }
    return "Router ID は " + pair(v, "rid") + " で、同じ番号";
  }
  function bodyNot(key, v) {
    if (key === "off") {
      return "OSPF は " + v.A.host + " も " + v.B.host + " も動いていて、エリアはどちらも " +
             v.A.area;
    }
    if (key === "both") {
      return level(v, "hello", "Hello") + "。" + level(v, "dead", "Dead");
    }
    if (key === "hello") return level(v, "hello", "Hello");
    if (key === "dead") return level(v, "dead", "Dead");
    return "";
  }

  function answerNote(v, st) {
    if (!v) return null;
    if (st) {
      /* 1問目「どの行を見ますか」は、確認項目の look が空。
         ここで決まりを出すと、まだ答えていない問題の答えになってしまう。
         null を返すと、いままでどおり確認項目の説明（st.why）が出る */
      if (!st.look || !st.look.length) return null;
      var mine = RULES.filter(function (r) {
        return r.look.join(" と ") === st.look.join(" と ");
      })[0];
      if (!mine) return null;
      if (st.hit) {
        return { gloss: IF[mine.key] + " ＝ " + mine.verdict,
                 body: bodyHit(mine.key, v) };
      }
      return { gloss: "", body: bodyNot(mine.key, v) };
    }
    /* 提示物ぜんぶを見て答える問題 */
    var full = judge(v);
    if (!full || !IF[full.key]) return null;
    return { gloss: IF[full.key] + " ＝ " + full.verdict, body: bodyHit(full.key, v) };
  }

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
    /* 説明の1枚（短い決まり）と、答え合わせの言葉。**判定そのものは変えていない** */
    brief: brief, answerNote: answerNote,
    hits: hits, marks: marks, learnEx: learnEx, stepQ: stepQ, perSpot: 4,
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
