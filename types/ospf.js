/* 「OSPF のとなり関係」ブロックの中身（目標3.4・過去問7問）。
 *
 * 提示物はテキスト。**二つのルータの様子が上下に並んでいる**ので、
 * 1台ぶんを読む showint とちがい、read で二つに切り分けてから見くらべる。
 *
 * 出てくる形は2つある。どちらも同じ値（OSPF が動いているか／エリア／Hello／
 * Dead／Router ID）に読み下す。
 *   show の形    R1#show ip ospf interface … を2台ぶん並べたもの
 *   設定の形     R1 / R2 の running-config を2台ぶん並べたもの
 *
 * 見る所5か所・判定ルール5本は、過去問7問とその解説から起こした。思いつきで足さない。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick;

  /* 設定に書いていないときの、もとから決まっている秒数 */
  var DEF_HELLO = 10, DEF_DEAD = 40;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "run", name: "OSPF が動いているか",
      re: /Process ID \d+|router ospf \d+/,
      mean: "そのインターフェースで OSPF が動いているかどうか",
      use: "Process ID の行か router ospf の行があれば動いている。片方に無ければ、そちら側で OSPF を動かす設定を追加する" },

    { key: "area", name: "エリアの番号",
      re: /[Aa]rea \d+/,
      mean: "そのインターフェースを、どのエリアに所属させているか",
      use: "エリア番号が相手と違うと、隣接関係にならない。show の出力では Internet address の行の後ろ、設定では network の行の末尾に書かれている" },

    { key: "hello", name: "Hello",
      re: /Hello \d+|hello-interval \d+/,
      mean: "何秒おきに「動いています」という通知を送るか",
      use: "Timer intervals の行にある Hello の値を、両側で比べる。値が違っていれば、片方を相手に合わせる。設定に書かれていないときは 10 秒" },

    { key: "dead", name: "Dead",
      re: /Dead \d+|dead-interval \d+/,
      mean: "通知が何秒届かなかったら、相手が停止したと判断するか",
      use: "Timer intervals の行にある Dead の値を、両側で比べる。値が違っていれば、片方を相手に合わせる。設定に書かれていないときは 40 秒" },

    { key: "rid", name: "Router ID",
      re: /Router ID [\d.]+|router-id [\d.]+/,
      mean: "OSPF がそのルータを見分けるための番号",
      use: "両側の Router ID を比べる。同じ番号なら、片方の router-id の設定を削除する。Hello と Dead がそろっているのに隣接関係にならないときは、ここを見る" }
  ];

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
    if (on && hello === null) hello = DEF_HELLO;
    if (on && dead === null) dead = DEF_DEAD;
    return {
      host: sec.host,
      on: on,
      hello: hello,
      dead: dead,
      rid: grab(t, /Router ID\s+([\d.]+)/i) || grab(t, /router-id\s+([\d.]+)/i),
      area: num(grab(t, /[Aa]rea\s+(\d+)/))
    };
  }

  var NONE = { host: "", on: false, hello: null, dead: null, rid: null, area: null };

  function read(ex) {
    var text = typeof ex === "string" ? ex : (ex && ex.text) || "";
    var secs = cut(text).map(one);
    return { A: secs[0] || NONE, B: secs[1] || NONE, text: text };
  }

  /* 二つとも数が入っていて、しかもちがうときだけ「食いちがい」とする。
     片方が空（OSPF が動いていない）のときは、ここでは決めない */
  function diff(a, b) { return a !== null && b !== null && a !== b; }
  /* 画面に出る言葉。**書いていない所を null と出さない** */
  function show(x) { return x === null || x === undefined ? "書いていない" : String(x); }
  function pair(v, k) {
    return v.A.host + " " + show(v.A[k]) + "　" + v.B.host + " " + show(v.B[k]);
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
          ? "片方で OSPF が動いていないので、Hello と Dead はくらべられない"
          : "Hello と Dead が両方ちがう、という形にはなっていない";
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
          ? "片方で OSPF が動いていないので、Hello はくらべられない"
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
          ? "片方で OSPF が動いていないので、Dead はくらべられない"
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
   * show の形と、設定の形。どちらも二つのルータを上下に並べる。
   */
  function showOne(host, ip, area, pid, rid, hello, dead, due) {
    return [
      host + "#show ip ospf interface g0/0/0",
      "GigabitEthernet0/0/0 is up, line protocol is up",
      "  Internet address is " + ip + ", Area " + area,
      "  Process ID " + pid + ", Router ID " + rid + ", Network Type POINT-TO-POINT, Cost: 1",
      "  Transmit Delay is 1 sec, State POINT-TO-POINT,",
      "  Timer intervals configured, Hello " + hello + ", Dead " + dead +
        ", Wait " + dead + ", Retransmit 5",
      "    Hello due in 00:00:" + due,
      "  Index 1/1, flood queue length 0",
      "  Next 0x0(0)/0x0(0)",
      "  Last flood scan length is 1, maximum is 1",
      "  Last flood scan time is 0 msec, maximum is 0 msec",
      "  Suppress hello for 0 neighbor(s)"
    ].join("\n");
  }

  function build(v) {
    if (v.shape === "config") {
      return [
        v.n1,
        "interface " + v.intf,
        " ip address " + v.cip1 + " " + v.mask,
        " no shutdown",
        "router ospf " + v.pid,
        " network " + v.cip1 + " 0.0.0.0 area " + v.area1,
        "",
        v.n2,
        "interface " + v.intf,
        " ip address " + v.cip2 + " " + v.mask,
        " no shutdown"
      ].join("\n");
    }
    return showOne(v.n1, v.ip1, v.area1, v.pid, v.rid1, v.hello1, v.dead1, "08") +
      "\n\n" +
      showOne(v.n2, v.ip2, v.area2, v.pid, v.rid2, v.hello2, v.dead2, "11");
  }

  var PAIRS = [["R1", "R2"], ["R1", "R3"], ["R4", "R7"], ["OldR", "R2"], ["R2", "R5"]];
  var HELLOS = [5, 10, 15, 20, 25, 30];
  var DEADS = [20, 30, 40, 45, 60, 80, 120];
  var RIDS = ["1.1.1.1", "2.2.2.2", "4.4.4.4", "10.1.1.1", "10.1.1.2",
              "192.168.1.1", "192.168.1.2", "172.16.0.1"];

  function baseVals() {
    var p = pick(PAIRS), h = pick(HELLOS), d = pick(DEADS);
    var r1 = pick(RIDS), r2 = pick(RIDS.filter(function (x) { return x !== r1; }));
    var a = pick([0, 1, 2]);
    var third = R(1, 250);
    return {
      shape: "show", n1: p[0], n2: p[1], pid: pick([1, 10, 100]),
      intf: "GigabitEthernet0/1", mask: "255.255.255.128",
      ip1: "192.168." + third + ".2/24", ip2: "192.168." + third + ".1/24",
      cip1: "192.168." + third + ".1", cip2: "192.168." + third + ".2",
      area1: a, area2: a, rid1: r1, rid2: r2,
      hello1: h, hello2: h, dead1: d, dead2: d
    };
  }

  function other(list, x) {
    return pick(list.filter(function (y) { return y !== x; }));
  }

  var MAKERS = {
    /* 片方で OSPF が動いていない。設定の形で出す */
    off: function (b) { b.shape = "config"; return b; },
    /* Hello も Dead もちがう */
    both: function (b) {
      b.hello2 = other(HELLOS, b.hello1);
      b.dead2 = other(DEADS, b.dead1);
      return b;
    },
    /* Hello だけちがう */
    hello: function (b) { b.hello2 = other(HELLOS, b.hello1); return b; },
    /* Dead だけちがう */
    dead: function (b) { b.dead2 = other(DEADS, b.dead1); return b; },
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
   *   Hello と Dead を見ます。「Hello も Dead も、二つの数がちがう」になっていますか。
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

  /* 見本（説明の1枚で使う、いつも同じ出力） */
  function sample() {
    return build({ shape: "show", n1: "R1", n2: "R2", pid: 1,
                   ip1: "192.168.1.2/24", ip2: "192.168.1.1/24",
                   area1: 0, area2: 0, rid1: "192.168.1.2", rid2: "10.1.1.1",
                   hello1: 15, hello2: 10, dead1: 20, dead2: 40 });
  }

  var spec = {
    id: "ospf",
    kind: "rules",
    card: "read",
    name: "OSPF のとなり関係",
    note: "両側のルータの設定を見比べて、隣接関係になれない原因を直す",
    obj: "3.4",
    spots: SPOTS, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt, walk: walkQ,
    ask: "両側の設定を見比べて、どこをどう直しますか。",
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample,
    expect: { spots: 5, rules: 5, questions: 7 },
    /* **本の答えが出力と食い違っていて使えない問題。**いまは無い */
    dropped: [],
    /* 中身が別の題材なので、よそのブロックへ送った問題。
       使えない問題（dropped）とは分けて書く。理由は scripts/ospf_block.py の MOVED */
    movedTo: {
      "B1-P14-049": "ospfdr（DR の決まり方）",
      "B2-0076-01": "ospfdr（DR の決まり方）",
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
