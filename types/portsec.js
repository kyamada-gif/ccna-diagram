/* 「ポートの守り」ブロック（過去問4問）。
 *
 * その口につないでよい機器を、スイッチ側で決める設定。本の4問の決め方は3つ。
 *
 *   ① 何台までつないでよいか（port-security maximum）  2問
 *   ② 違反したときどうするか（violation の3種）        1問
 *   ③ MAC アドレスの覚え方（mac-address sticky）        1問
 *   ④ にせの DHCP を止める（dhcp snooping の trust）   1問
 *
 * ③ は B2-0016-01 の正解そのもの。**この問題は正解が2つ**（violation restrict と
 * mac-address sticky）なのに、前は restrict しか判定ルールになっておらず、
 * 見る所に「MAC アドレスの覚え方」があるのにルールだけが無かった。
 * ルールが3本しかないせいで、練習の3分の2が3択にもなっていた（2026-08-21 オーナー了承）。
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

  /* **決め手は問題文の中だけで探す。**
     提示物（入っている設定）にも sticky の行が出てくるので、
     問題文と提示物をつないだ文字から探すと、どの問題でも sticky が見つかってしまう。
     いまの設定がどうなっているか（cur）だけは、提示物のほうから読む */
  var FROM_TEXT = ["snoop", "viol", "num", "sticky", "uplink"];

  function read(x) {
    var t = join(x), out = {};
    var q = (x && typeof x === "object" && x.text !== undefined)
      ? String(x.text) : t.split(/\n\s*\n/)[0];
    Object.keys(PAT).forEach(function (k) {
      var m = (FROM_TEXT.indexOf(k) >= 0 ? q : t).match(PAT[k]);
      out[k] = m ? (m[1] || m[0]) : null;
    });
    out.all = t;
    return out;
  }

  /* 決め手の所だけを残す。
     **問題文と設定のあいだの空行は残す。**落とすと、読むほうが
     設定の行まで問題文だと思って読み、設定に出てくる sticky を決め手にしてしまう
     （`node build.js` の「決め手の行だけにしても判定が変わらない」で見つかった） */
  function excerpt(x) {
    var t = join(x), lines = t.split("\n"), out = [lines[0], ""];
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

    { key: "sticky", cue: "MAC アドレスは動的に学習される",
      cond: "MAC アドレスを自分で覚えさせたい",
      verdict: "switchport port-security mac-address sticky を設定する",
      why: "sticky を設定すると、つないだ機器の MAC アドレスをスイッチが自分で覚えて、設定に残す。手で mac-address を1つずつ書く形は「動的に」に当てはまらない",
      look: ["MAC アドレスの覚え方（sticky か手動か）"],
      steps: function (v) { return [["問題文のことば", v.sticky || "-"]]; },
      no: function () { return "MAC アドレスの覚え方の話ではない"; },
      test: function (v) { return !!v.sticky; } },

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
    "switchport port-security maximum で、接続を許可する台数を指定する": "既定値は1台。指定しなければ1台しか通信できない",
    "switchport port-security mac-address sticky を設定する": "つないだ機器の MAC アドレスを、スイッチが自分で覚えて設定に残す"
  };

  var SAME = {
    "DHCP スヌーピングを有効にし、上流のインターフェースだけを trust にする": ["dhcp snooping"],
    "violation restrict にして、通信を遮断しつつログを残す": ["violation restrict"],
    "switchport port-security maximum で、接続を許可する台数を指定する": ["port-security maximum", "ルーター"],
    "switchport port-security mac-address sticky を設定する": ["mac-address sticky"]
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

  /* **sticky を聞く問題では、その行を書かない。**
     入っている設定に答えがそのまま載っていたら、問題にならない。
     本の B2-0016-01 も、switchport port-security まで打った所で止まっている */
  function conf(v) {
    var out = [
      v.dev + "# show running-config interface " + v.ifn,
      "interface " + v.ifn,
      " switchport mode access",
      " switchport port-security"
    ];
    if (v.hasSticky !== false) out.push(" switchport port-security mac-address sticky");
    return out.join("\n");
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
    sticky: function (b) {
      b.need = "つないだ機器の MAC アドレスは動的に学習されるようにします。どの設定をしますか。";
      b.hasSticky = false;
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
      "（ほかの問われ方：違反時にログだけ残す／MAC アドレスは動的に学習される／" +
        "不正な DHCP サーバを遮断する。上流は Port-channel1）",
      "",
      conf({ dev: "SW1", ifn: "gi1/0/15" })
    ].join("\n");
  }


  /* ── 最後の3問のうち2問は、打つコマンドの並びで答える ─────────
   * 本の4問のうち3問は、選択肢が打つコマンドの並び。
   * 誤答は B2-0016-01 の5択と B1-P12-059 の4択から写す。
   */
  function cmdSet(key, v) {
    var L = function () { return Array.prototype.slice.call(arguments).join("\n"); };
    var mac = "0010.7B84.45E6";
    if (key === "max") {                         /* B1-P12-059 */
      return { right: L("interface " + v.ifn, "switchport port-security",
                        "switchport port-security maximum " + v.num),
               wrong: [L("interface " + v.ifn, "switchport port-security",
                         "switchport port-security mac-address " + mac),
                       L("interface " + v.ifn,
                         "switchport port-security mac-address " + mac),
                       L("interface " + v.ifn,
                         "switchport secure-mac limit " + v.num)] };
    }
    if (key === "viol") {                        /* B2-0016-01 */
      return { right: "switchport port-security violation restrict",
               wrong: ["switchport port-security violation shutdown",
                       "switchport port-security violation protect",
                       "switchport port-security mac-address " + mac] };
    }
    if (key === "sticky") {                      /* B2-0016-01 */
      return { right: "switchport port-security mac-address sticky",
               wrong: ["switchport port-security mac-address " + mac,
                       "switchport port-security maximum " + v.num,
                       "switchport port-security violation shutdown"] };
    }
    /* snoop。B1-P14-095 */
    return { right: L("ip dhcp snooping vlan 1-4094", "ip dhcp snooping", "!",
                      "interface " + v.up, "ip dhcp snooping trust"),
             wrong: [L("ip dhcp snooping", "!", "interface " + v.up,
                       "switchport port-security maximum 1", "switchport port-security"),
                     L("ip dhcp snooping vlan 1-4094", "!", "interface " + v.up,
                       "switchport protected", "switchport port-security maximum 1"),
                     L("ip arp inspection trust", "!", "interface " + v.up,
                       "ip verify source mac-check")] };
  }

  var CMDMARK = {
    max: function (o, v) { return o.indexOf("port-security maximum " + v.num) >= 0; },
    viol: function (o) { return o.indexOf("violation restrict") >= 0; },
    sticky: function (o) { return o.indexOf("mac-address sticky") >= 0; },
    snoop: function (o) { return o.indexOf("ip dhcp snooping trust") >= 0; }
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
    viol: "shutdown は口ごと止める（既定）。protect は通さないが、ログも残らない",
    sticky: "手で mac-address を1つずつ書く形は、「動的に」に当てはまらない",
    snoop: "trust にするのは、上流（正規のサーバがつながっている側）の口だけ",
    max: "既定は1台。台数の指定だけでなく、switchport port-security 本体の有効化も一緒に要る"
  };

  var spec = {
    id: "portsec",
    /* 出題パターン＝どのルールで答えにたどり着くか。
       絞ったせいでパターンが消えていないかを、build.js が毎回見る */
    /* **sticky は入れない。**本の B2-0016-01 は正解が2つ（restrict と sticky）で、
       上から当てると viol のほうで決まる。入れると「消えている」と誤って止まる */
    pattern: E.cuePattern, patterns: ["max", "snoop", "viol"],
    kind: "rules",
    card: "config",
    name: "ポートの守り",
    note: "そのインターフェースに接続できる機器を、スイッチ側で制限する",
    obj: "5.7",
    ask: "この要件を満たす設定はどれですか。",
    wantsQuestion: true,
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample, wholeQ: wholeQ, cmdSet: cmdSet, cmdMark: CMDMARK,
    brief: E.cueBrief(RULES, NOTE), answerNote: E.cueAnswerNote(RULES, GLOSS),
    stepQ: E.cueStepQ(RULES),
    expect: { spots: 5, rules: 4, questions: 4 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.portsec = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
