/* 「DHCP・NAT・NTP・LLDP の設定」ブロック（過去問9問）。
 *
 * 網の世話をする道具まわりの設定。本の9問の決め方は5つ。
 *
 *   ① DHCP の中継（ip helper-address）   4問
 *   ② NAT の形（内側・外側・プール・overload）3問
 *   ③ NTP の相手を写す                    1問
 *   ④ LLDP の間隔を秒で入れる              1問
 *
 * いちばん多い DHCP の中継は、決め方がきれいに立つ。
 *   **パソコンと DHCP サーバが別のネットワークにいるなら、パソコン側の口に**
 *   **ip helper-address を打ち、サーバの IP を書く。**
 *
 * 決め手は問題文と設定の両方にあるので、両方を読む。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "what", name: "何の話か（問題文）",
      re: /(DHCP|NAT|NTP|LLDP)/,
      mean: "DHCP か NAT か NTP か LLDP か",
      use: "まずここで、入力するコマンドの種類が決まる。DHCP なら ip helper-address、NAT なら ip nat、NTP なら ntp server、LLDP なら lldp timer" },

    { key: "side", name: "どちら側のインターフェースか（DHCP）",
      re: /(クライアント|サーバ|helper-address)/,
      mean: "クライアント側のインターフェースか、サーバ側のインターフェースか",
      use: "ip helper-address は、クライアント側のインターフェースに設定する。指定するのは DHCP サーバの IP アドレス" },

    { key: "nat", name: "NAT の内側と外側",
      re: /(ip nat inside|ip nat outside|overload|pool)/i,
      mean: "どのインターフェースが内側で、どれが外側か。複数のアドレスを使うか、1つのアドレスにまとめるか",
      use: "内側と外側の両方を指定しないと動作しない。少ないアドレスで多数の通信を扱うなら overload を付ける" },

    { key: "unit", name: "指定する単位（LLDP）",
      re: /(lldp timer|lldp holdtime|秒|分)/,
      mean: "通知を送る間隔と、受け取った情報を保持する時間",
      use: "どちらも秒で指定する。「1分ごと」なら 60、「3分」なら 180" },

    { key: "src", name: "参照先が書かれている行（NTP）",
      re: /(ntp server|address\s+ref clock|show ntp)/i,
      mean: "いま時刻を問い合わせている相手が書かれている行",
      use: "show ntp associations の address の列が、時刻を問い合わせている相手。ref clock の列は、その相手がさらに参照している先なので、ここには書かない" }
  ];

  function join(x) {
    if (x && typeof x === "object" && x.exhibit !== undefined) {
      return String(x.text || "") + "\n" + String(x.exhibit || "");
    }
    return String(x || "");
  }

  var PAT = {
    dhcp: /(DHCP)/i,
    nat: /(NAT|同時接続|パブリック\s*IP|アドレスの消費)/i,
    ntp: /(NTP)/i,
    lldp: /(LLDP)/i,
    helper: /ip helper-address\s*([\d.]+)?/i,
    pool: /(ip nat pool|overload)/i,
    server: /([\d.]+|[0-9a-f:]{6,})\s*$/im,
    /* show ntp associations の address の列。ref clock（127.127.1.1）の
       すぐ左にある値が、いま時刻を問い合わせている相手 */
    ntpsrv: /\*~\s*([\dA-Fa-f.:]+)\s+127\.127\.1\.1/,
    minutes: /(\d+)\s*分/
  };

  function read(x) {
    var t = join(x), out = {};
    Object.keys(PAT).forEach(function (k) {
      var m = t.match(PAT[k]);
      out[k] = m ? (m[1] || m[0]) : null;
    });
    out.all = t;
    return out;
  }

  function excerpt(x) {
    var t = join(x), lines = t.split("\n"), out = [lines[0]];
    lines.slice(1).forEach(function (l) {
      if (/DHCP|NAT|NTP|LLDP/i.test(l)
          || /helper-address|ip nat|ntp server|lldp/i.test(l)
          || /127\.127\.1\.1|Outside interfaces|Inside interfaces/i.test(l)) out.push(l);
    });
    return out.join("\n");
  }

  /* ── 判定ルール ─────────────────────────── */
  var RULES = [
    { key: "lldp", cue: "LLDP の送信間隔", cond: "LLDP の間隔について問われている",
      verdict: "lldp timer と lldp holdtime を、秒で指定する",
      why: "どちらも単位は秒。「1分ごとに送る」なら 60、「3分で更新」なら 180 と指定する。分のつもりで 1 と入力すると、1秒ごとになってしまう",
      look: ["入れる単位（LLDP）"],
      steps: function (v) { return [["問題文のことば", v.minutes ? v.minutes + " 分" : "-"]]; },
      no: function () { return "LLDP の話ではない"; },
      test: function (v) { return !!v.lldp; } },

    { key: "ntp", cue: "NTP の設定を複製する", cond: "NTP の参照先について問われている",
      verdict: "ntp server に、いま時刻を問い合わせている相手を指定する",
      why: "show ntp associations の address の列が、時刻を問い合わせている相手。ref clock はその先なので、ここには書かない",
      look: ["写しもとの出力（NTP）"],
      steps: function (v) { return [["写す相手", v.ntpsrv || v.server || "-"]]; },
      no: function () { return "NTP の話ではない"; },
      test: function (v) { return !!v.ntp; } },

    { key: "nat", cue: "アドレスの節約と同時接続数", cond: "NAT について問われている",
      mark: ["まだ足りない手順", "Outside interfaces:"],
      verdict: "内側と外側を指定し、足りなければ overload を付ける",
      why: "内側のインターフェースに ip nat inside、外側に ip nat outside を設定する。両方そろわないと動作しない。少ないアドレスで多数の通信を扱うなら overload を付ける",
      look: ["NAT の内側と外側"],
      steps: function (v) { return [["現在の設定", v.pool || "（プールも overload も無い）"]]; },
      no: function () { return "NAT の話ではない"; },
      test: function (v) { return !!v.nat; } },

    { key: "helper", cue: "DHCP サーバが別のネットワークにある", cond: "そのほか（DHCP の中継）",
      mark: ["DHCP サーバ"],
      verdict: "クライアント側のインターフェースに ip helper-address を設定し、サーバの IP アドレスを指定する",
      why: "パソコンが最初に送る要求はブロードキャストなので、ルータを越えられない。クライアント側のインターフェースで受け取って、サーバまで転送してもらう",
      look: ["どちら側の口か（DHCP）"],
      steps: function (v) { return [["現在の中継先", v.helper || "（まだ無い）"]]; },
      no: function () { return "ここまでで決まっている"; },
      test: function () { return true; } }
  ];

  var GLOSS = {
    "lldp timer と lldp holdtime を、秒で指定する": "分のつもりで 1 と入力すると、1秒ごとになってしまう",
    "ntp server に、いま時刻を問い合わせている相手を指定する": "address の列を指定する。ref clock はその先の参照先",
    "内側と外側を指定し、足りなければ overload を付ける": "内側と外側の両方がそろわないと動作しない",
    "クライアント側のインターフェースに ip helper-address を設定し、サーバの IP アドレスを指定する": "サーバ側のインターフェースに設定しても、要求は届かない"
  };

  var SAME = {
    "lldp timer と lldp holdtime を、秒で指定する": ["lldp timer"],
    "ntp server に、いま時刻を問い合わせている相手を指定する": ["ntp server"],
    "内側と外側を指定し、足りなければ overload を付ける": ["NAT", "nat"],
    "クライアント側のインターフェースに ip helper-address を設定し、サーバの IP アドレスを指定する": ["helper-address"]
  };

  /* ── 出力を作る ─────────────────────────── */
  function baseVals() {
    return {
      dev: pick(["SW1", "R1", "CPE", "Switch2"]),
      cli: pick(["Fa0/1", "Gi0/0", "Gi1/0/2"]),
      srv: pick(["Gi0/1", "Fa0/2"]),
      ip: "192.168." + R(10, 40) + "." + R(2, 20),
      vlan: pick([10, 20, 30]),
      min: pick([1, 2, 3]),
      ntpsrv: pick(["192.168.10.9", "10.10.20.4", "172.16.5.8", "2001:DB8:12::1"])
    };
  }

  function conf(v) {
    return [
      v.dev + "# show running-config | section interface",
      "interface " + v.cli,
      " description パソコン側",
      " ip address 192.168." + v.vlan + ".1 255.255.255.0",
      "!",
      "interface " + v.srv,
      " description サーバ側",
      " ip address " + v.ip.replace(/\.\d+$/, ".1") + " 255.255.255.0"
    ].join("\n");
  }

  /* **説明で「ここを見る」と言っている出力を、練習の提示物にも入れる。**
     前は、どのルールでも show running-config | section interface しか出していなかった。
     NTP の一言に「show ntp associations の address の列」と書いてあるのに、
     その出力が練習に一度も出てこない、という状態だった。
     形は本の紙面そのまま（NTP は B1-P16-060、NAT は B1-P11-042）。 */
  function ntpTable(v) {
    return [
      v.dev + "> show ntp associations",
      "  address              ref clock       st when poll reach  delay  offset",
      "*~" + v.ntpsrv + "      127.127.1.1      3  39    64   377  23.903  -5.581",
      "  * sys.peer, # selected, + candidate, - outlyer, x falseticker, ~ configured"
    ].join("\n");
  }
  function natStats(v) {
    return [
      v.dev + "# show ip nat statistics",
      "Total active translations: 0 (0 static, 0 dynamic, 0 extended)",
      "Outside interfaces:",
      "Inside interfaces:",
      " " + v.cli,
      "Hits: 0  Misses: 0"
    ].join("\n");
  }

  function build(v) {
    return v.need + "\n\n" + (v.pre ? v.pre + "\n\n" : "") + conf(v);
  }

  var MAKERS = {
    lldp: function (b) {
      b.need = "LLDP のパケットを " + b.min + " 分ごとに送り、送った情報が " +
               (b.min * 3) + " 分で消えるようにします。どのコマンドを入れますか。";
      return b;
    },
    ntp: function (b) {
      b.need = "この機器の NTP の設定を、新しい機器に写します。どのコマンドを実行しますか。";
      b.pre = ntpTable(b);
      return b;
    },
    nat: function (b) {
      b.need = "NAT の設定を仕上げます。まだ足りない手順はどれですか。";
      b.pre = natStats(b);
      return b;
    },
    helper: function (b) {
      b.need = "VLAN " + b.vlan + " のパソコンが、別のネットワークにある DHCP サーバ（" + b.ip +
               "）からアドレスをもらえるようにします。どの設定をしますか。";
      return b;
    }
  };

  function sample() {
    return [
      "VLAN 10 のパソコンが、別のネットワークにある DHCP サーバ（192.168.20.2）からアドレスをもらえるようにします。",
      "（ほかの聞かれ方：NAT の足りない手順／NTP の設定を写す／LLDP を 1 分ごとに送る）",
      "",
      "SW1# show ntp associations",
      "  address        ref clock     st  when  poll reach",
      "*~192.168.20.9   127.127.1.1    3    39    64   377",
      "",
      "SW1# show running-config | section ip nat",
      "ip nat pool NATPOOL 209.165.201.1 209.165.201.3 netmask 255.255.255.248",
      "",
      conf({ dev: "SW1", cli: "Fa0/1", srv: "Fa0/2", ip: "192.168.20.2", vlan: 10 })
    ].join("\n");
  }


  /* ── 最後の3問のうち2問は、打つコマンドの並びで答える ─────────
   * **NAT だけは、本の選択肢が日本語の文**（「NAT外部インターフェイスを設定する」）
   * なので、コマンドの形にしない。null を返して今までの形のままにする。
   */
  function cmdSet(key, v) {
    var L = function () { return Array.prototype.slice.call(arguments).join("\n"); };
    if (key === "ntp") {                         /* B1-P16-060 */
      return { right: "ntp server " + v.ntpsrv,
               wrong: ["ntp server 127.127.1.1", "ntp master 3", "ntp master"] };
    }
    if (key === "lldp") {                        /* B3-M3-005 */
      var sec = v.min * 60, hold = v.min * 180;
      return { right: L("lldp timer " + sec, "lldp holdtime " + hold),
               wrong: [L("lldp timer " + v.min, "lldp holdtime " + (v.min * 3)),
                       L("lldp timer " + sec, "lldp tlv-select " + hold),
                       L("lldp timer " + v.min, "lldp tlv-select " + (v.min * 3))] };
    }
    if (key === "helper") {                      /* B1-P12-062。番地の取り違えが罠 */
      var pc = "192.168." + v.vlan + ".1";
      var srv = v.ip, srvIf = v.ip.replace(/\.\d+$/, ".1");
      return { right: "ip helper-address " + srv,
               wrong: ["ip helper-address " + pc,
                       "ip helper-address " + srvIf,
                       "ip helper-address 255.255.255.255"] };
    }
    return null;
  }

  var CMDMARK = {
    ntp: function (o, v) { return o.indexOf("ntp server " + v.ntpsrv) >= 0; },
    lldp: function (o, v) {
      return o.indexOf("lldp holdtime " + (v.min * 180)) >= 0
             && o.indexOf("lldp timer " + (v.min * 60)) >= 0;
    },
    helper: function (o, v) { return o.indexOf("ip helper-address " + v.ip) >= 0; },
    nat: null
  };

  function wholeQ(n, ctx) {
    if (n === 0) return null;
    for (var t = 0; t < 40; t++) {
      var key = pick(Object.keys(MAKERS));
      var v = MAKERS[key](baseVals());
      var text = build(v);
      var r = ctx.judge(ctx.read(text));
      if (!r || r.key !== key) continue;
      var c = cmdSet(key, v);
      if (!c) continue;                          /* コマンドの形にしない題材 */
      var seen = {}, opts = [c.right];
      seen[c.right] = 1;
      ctx.shuffle(c.wrong).forEach(function (w) {
        if (opts.length >= 4 || seen[w]) return;
        seen[w] = 1; opts.push(w);
      });
      if (opts.length < 4) continue;
      return { kind: "whole", ask: "どのコマンドを設定しますか。",
               exhibit: text, opts: ctx.shuffle(opts), right: c.right, extra: {} };
    }
    return null;
  }

  /* ── 説明の1枚に添える一言 ─────────────────────
   * **取り違えやすい所だけ。**判定ルールの理由（why）をもう一度書かない。
   */
  var NOTE = {
    lldp: "単位は秒。1分なら 60、3分なら 180。分のつもりで 1 と書くと、1秒ごとになる",
    ntp: "書き写すのは show ntp associations の address の列。" +
         "ref clock の列（127.127.1.1 など）は、その相手が見ている先なので書かない",
    nat: "内側と外側の両方を指定しないと動かない。" +
         "使えるアドレスが足りないときだけ overload を付ける",
    helper: "設定するのはパソコン側のインターフェース、書く IP アドレスは DHCP サーバのもの。" +
            "サーバ側の口や、ゲートウェイの IP アドレスを書かない"
  };

  var spec = {
    id: "ipsvc",
    /* 出題パターン＝どのルールで答えにたどり着くか。
       絞ったせいでパターンが消えていないかを、build.js が毎回見る */
    pattern: E.cuePattern, patterns: ["helper", "lldp", "nat", "ntp"],
    kind: "rules",
    card: "config",
    name: "DHCP・NAT・NTP の設定",
    note: "網の世話をする道具の設定を選ぶ",
    obj: "4.6",
    ask: "この要件を満たす設定はどれですか。",
    wantsQuestion: true,
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample, /* 決め手が出力の中にあるルール。ここだけ見本の現物を出す */
    learnOut: ["ntp"],
    wholeQ: wholeQ, cmdSet: cmdSet, cmdMark: CMDMARK,
    brief: E.cueBrief(RULES, NOTE), answerNote: E.cueAnswerNote(RULES, GLOSS),
    stepQ: E.cueStepQ(RULES),
    /* 規則では出せないが、テストには出す問題 */
    bookOnly: ["B2-0143-01"],
    expect: { spots: 5, rules: 4, questions: 8 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.ipsvc = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
