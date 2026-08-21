/* 「ポートの守り」ブロック（過去問4問）。
 *
 * その口につないでよい機器を、スイッチ側で決める設定。本の4問の決め方は3つ。
 *
 *   ① 何台までつないでよいか（port-security maximum）  2問
 *   ② 違反したときどうするか（violation の3種）        1問
 *   ③ にせの DHCP を止める（dhcp snooping の trust）   1問
 *
 * **違反したときの動きは3つ。ここを取り違える問題が本に多い。**
 *   shutdown … 口を止める（既定）
 *   restrict … 通さないが、口は生きたまま。**記録に残る**
 *   protect  … 通さない。記録も残らない
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "what", name: "何を守る話か（問題文）",
      re: /(MAC|DHCP|ARP|台|接続)/,
      mean: "接続してよい機器の台数についてか、不正な DHCP サーバについてか",
      use: "MAC アドレスや台数について問われていれば port-security。不正な DHCP や ARP について問われていれば dhcp snooping" },

    { key: "max", name: "何台まで許すか（maximum）",
      re: /(port-security maximum|\d+\s*台|\d+\s*つ)/,
      mean: "そのインターフェースに接続してよい機器の台数",
      use: "「2台に制限」なら maximum 2。既定値は1台のため、指定しなければ1台しか通信できない" },

    { key: "learn", name: "MAC アドレスの覚え方（sticky か手動か）",
      re: /(sticky|動的に学習|手動)/,
      mean: "接続された機器の MAC アドレスを自動で学習するか、手動で設定するか",
      use: "「動的に学習して設定に残す」と書かれていれば sticky。台数が多いと手動では現実的でないので、通常は sticky を使う" },

    { key: "viol", name: "違反したときの動き（violation）",
      re: /(violation|shutdown|restrict|protect|ログ|記録)/,
      mean: "許可していない機器が接続されたとき、インターフェースをどう扱うか",
      use: "遮断しつつログを残すなら restrict。インターフェースごと停止するなら shutdown（既定）。ログも残さないなら protect" },

    { key: "trust", name: "信頼するインターフェース（DHCP スヌーピング）",
      re: /(trust|アップリンク|上流)/,
      mean: "正規の DHCP サーバが接続されている側のインターフェース",
      use: "上流（サーバ側）のインターフェースだけを trust にする。クライアント側は信頼しないため、不正なサーバからの応答が遮断される" }
  ];

  function join(x) {
    if (x && typeof x === "object" && x.exhibit !== undefined) {
      return String(x.text || "") + "\n" + String(x.exhibit || "");
    }
    return String(x || "");
  }

  var PAT = {
    snoop: /(ARP\s*スプーフィング|DHCP\s*スヌーピング|dhcp snooping|不正な\s*DHCP)/i,
    viol: /(ログ|記録|違反|violation)/,
    num: /(\d+)\s*(?:台|つ)/,
    sticky: /(sticky|動的に学習)/i,
    cur: /switchport port-security maximum\s*(\d+)/i,
    uplink: /(アップリンク|Port-channel|上流)/i
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
      if (/スプーフィング|スヌーピング|ログ|記録|違反|台|つ|sticky|動的に学習|アップリンク/.test(l)
          || /port-security|dhcp snooping/i.test(l)) out.push(l);
    });
    return out.join("\n");
  }

  /* ── 判定ルール ─────────────────────────── */
  var RULES = [
    { key: "viol", cue: "違反時にログだけ残す", cond: "違反したときの動きが書かれている",
      verdict: "violation restrict にして、通信を遮断しつつログを残す",
      why: "restrict は、通信は遮断するがインターフェースは有効なままで、違反をログに残す。shutdown はインターフェースごと停止し、protect はログも残さない",
      look: ["違反したときの動き（violation）"],
      steps: function (v) { return [["問題文のことば", v.viol || "-"]]; },
      no: function () { return "違反したときの話ではない"; },
      test: function (v) { return !!v.viol; } },

    { key: "snoop", cue: "不正な DHCP サーバ", cond: "不正な DHCP サーバや ARP のなりすましを止めたい",
      verdict: "DHCP スヌーピングを有効にし、上流のインターフェースだけを trust にする",
      why: "信頼するのは、正規のサーバが接続された側のインターフェースだけ。クライアント側を信頼しないので、不正なサーバからの応答は転送されない",
      look: ["信頼するインターフェース（DHCP スヌーピング）"],
      steps: function (v) { return [["信じる口", v.uplink || "-"]]; },
      no: function () { return "不正なサーバの話ではない"; },
      test: function (v) { return !!v.snoop; } },

    { key: "max", cue: "接続できる台数を制限する", cond: "そのほか（何台まで許すか）",
      verdict: "switchport port-security maximum で、接続を許可する台数を指定する",
      why: "既定値は1台。2台接続したいなら maximum 2 を設定する。switchport port-security 自体の有効化も必要",
      look: ["何台まで許すか（maximum）"],
      steps: function (v) { return [["許す台数", v.num || "-"], ["現在の数", v.cur || "（既定の1）"]]; },
      no: function () { return "ここまでで決まっている"; },
      test: function () { return true; } }
  ];

  var GLOSS = {
    "DHCP スヌーピングを有効にし、上流のインターフェースだけを trust にする": "信頼するのは、正規のサーバが接続された側のインターフェースだけ",
    "violation restrict にして、通信を遮断しつつログを残す": "インターフェースは有効なまま。違反はログに記録される",
    "switchport port-security maximum で、接続を許可する台数を指定する": "既定値は1台。指定しなければ1台しか通信できない"
  };

  var SAME = {
    "DHCP スヌーピングを有効にし、上流のインターフェースだけを trust にする": ["dhcp snooping"],
    "violation restrict にして、通信を遮断しつつログを残す": ["violation restrict"],
    "switchport port-security maximum で、接続を許可する台数を指定する": ["port-security maximum", "ルーター"]
  };

  /* ── 出力を作る ─────────────────────────── */
  function baseVals() {
    return {
      dev: pick(["SW1", "SW", "AccessSw1"]),
      ifn: pick(["gi1/0/15", "fa0/1", "Et0/1"]),
      num: R(2, 4),
      up: pick(["Port-channel1", "Gi1/0/24"])
    };
  }

  function conf(v) {
    return [
      v.dev + "# show running-config interface " + v.ifn,
      "interface " + v.ifn,
      " switchport mode access",
      " switchport port-security",
      " switchport port-security mac-address sticky"
    ].join("\n");
  }

  function build(v) { return v.need + "\n\n" + conf(v); }

  var MAKERS = {
    snoop: function (b) {
      b.need = "不正な DHCP サーバからの応答を遮断します。上流のインターフェースは " + b.up +
               " です。どの設定をしますか。";
      return b;
    },
    viol: function (b) {
      b.need = "許可していない機器が接続されたとき、インターフェースは遮断せず、ログだけを残します。どの設定をしますか。";
      return b;
    },
    max: function (b) {
      b.need = "このインターフェースに接続できる機器を " + b.num + " 台に制限します。どの設定をしますか。";
      return b;
    }
  };

  function sample() {
    return [
      "このインターフェースに接続できる機器を 2 台に制限します。どの設定をしますか。",
      "（ほかの問われ方：違反時にログだけ残す／不正な DHCP サーバを遮断する。上流は Port-channel1）",
      "",
      conf({ dev: "SW1", ifn: "gi1/0/15" })
    ].join("\n");
  }


  var spec = {
    id: "portsec",
    kind: "rules",
    card: "config",
    name: "ポートの守り",
    note: "そのインターフェースに接続できる機器を、スイッチ側で制限する",
    obj: "5.7",
    ask: "この要件を満たす設定はどれですか。",
    wantsQuestion: true,
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample, walk: E.cueWalk(RULES),
    expect: { spots: 5, rules: 3, questions: 4 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.portsec = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
