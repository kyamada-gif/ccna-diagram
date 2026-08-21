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
 *   **パソコンと DHCP サーバが別の網にいるなら、パソコン側の口に**
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
          || /helper-address|ip nat|ntp server|lldp/i.test(l)) out.push(l);
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
      steps: function (v) { return [["写す相手", v.server || "-"]]; },
      no: function () { return "NTP の話ではない"; },
      test: function (v) { return !!v.ntp; } },

    { key: "nat", cue: "アドレスの節約と同時接続数", cond: "NAT について問われている",
      verdict: "内側と外側を指定し、足りなければ overload を付ける",
      why: "内側のインターフェースに ip nat inside、外側に ip nat outside を設定する。両方そろわないと動作しない。少ないアドレスで多数の通信を扱うなら overload を付ける",
      look: ["NAT の内側と外側"],
      steps: function (v) { return [["現在の設定", v.pool || "（プールも overload も無い）"]]; },
      no: function () { return "NAT の話ではない"; },
      test: function (v) { return !!v.nat; } },

    { key: "helper", cue: "DHCP サーバが別のネットワークにある", cond: "そのほか（DHCP の中継）",
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
      min: pick([1, 2, 3])
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

  function build(v) { return v.need + "\n\n" + conf(v); }

  var MAKERS = {
    lldp: function (b) {
      b.need = "LLDP のパケットを " + b.min + " 分ごとに送り、送った情報が " +
               (b.min * 3) + " 分で消えるようにします。どのコマンドを入れますか。";
      return b;
    },
    ntp: function (b) {
      b.need = "この機器の NTP の設定を、新しい機器に写します。どのコマンドを実行しますか。";
      return b;
    },
    nat: function (b) {
      b.need = "NAT の設定を仕上げます。まだ足りない手順はどれですか。";
      return b;
    },
    helper: function (b) {
      b.need = "VLAN " + b.vlan + " のパソコンが、別の網にある DHCP サーバ（" + b.ip +
               "）からアドレスをもらえるようにします。どの設定をしますか。";
      return b;
    }
  };

  function sample() {
    return [
      "VLAN 10 のパソコンが、別の網にある DHCP サーバ（192.168.20.2）からアドレスをもらえるようにします。",
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


  var spec = {
    id: "ipsvc",
    kind: "rules",
    card: "config",
    name: "DHCP・NAT・NTP の設定",
    note: "網の世話をする道具の設定を選ぶ",
    obj: "4.6",
    ask: "この要件を満たす設定はどれですか。",
    wantsQuestion: true,
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample, walk: E.cueWalk(RULES),
    /* 規則では出せないが、テストには出す問題 */
    bookOnly: ["B2-0143-01"],
    expect: { spots: 5, rules: 4, questions: 9 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.ipsvc = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
