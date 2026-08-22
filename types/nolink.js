/* 「つながらない原因をさがす」ブロック（過去問5問）。
 *
 * つながらない機器の設定や配線を見て、原因を1つ名ざしする。決め方は4つ。
 *
 *   ① パソコンの出口（デフォルトゲートウェイ）が違う   2問
 *   ② まず何を確かめるか                              1問
 *   ③ ケーブルの種類が違う                            1問
 *   ④ 光の部品（トランシーバ）が距離に合っていない      1問
 *
 * **同じネットワークの中とは話せるが、外と話せない → 出口が違う。**
 * これがいちばん多い形なので、練習ではここを作って出す。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "reach", name: "どこまで通信できるか（問題文）",
      re: /(接続できません|接続できない|妨げている|原因|到達)/,
      mean: "同じネットワーク内とは通信できるのか、外のネットワークとだけ通信できないのか",
      use: "同じネットワーク内とは通信できて外とだけ通信できないなら、デフォルトゲートウェイの設定を疑う。同じネットワーク内とも通信できないなら、IP アドレスかサブネットマスクを疑う" },

    { key: "gw", name: "デフォルトゲートウェイ",
      re: /(Default gateway|デフォルトゲートウェイ)/i,
      mean: "そのネットワークから外へ出るときに、最初にパケットを渡す相手の IP アドレス",
      use: "図に書かれているルータの IP アドレスと一致していなければならない。1つでも数字が違うと、外のネットワークへ出られない" },

    { key: "mask", name: "IP アドレスとサブネットマスク",
      re: /(Subnet mask|IP address|サブネットマスク)/i,
      mean: "その機器の IP アドレスと、どこまでが同じネットワークかを区切る値",
      use: "IP アドレスが別のネットワークを指していたり、サブネットマスクがほかの機器と違っていると、同じネットワーク内とも通信できない" },

    { key: "cable", name: "ケーブルの種類",
      re: /(ケーブル|notconnect|クロス|ストレート)/,
      mean: "接続しているケーブルの種類",
      use: "インターフェースは有効なのに notconnect のままなら、ケーブルの種類が合っていない可能性がある" },

    { key: "optic", name: "トランシーバーと伝送距離",
      re: /(-SR|-LR|-ER|トランシーバ|シングルモード|マルチモード)/i,
      mean: "そのトランシーバーが対応している伝送距離",
      use: "-SR は最大 300m、-LR は最大 10km。距離に合わないトランシーバーを使うと、光が届かない" }
  ];

  function join(x) {
    if (x && typeof x === "object" && x.exhibit !== undefined) {
      return String(x.text || "") + "\n" + String(x.exhibit || "");
    }
    return String(x || "");
  }

  var PAT = {
    first: /(最初のステップ|最初に|確認する)/,
    cable: /(ケーブルの種類|notconnect|ケーブル)/,
    optic: /(-SR|-LR|-ER|トランシーバ|シングルモード\s*ファイバー)/i,
    gw: /Default gateway\s*[:：]?\s*([\d.]+)/i,
    ip: /IP address\s*[:：]?\s*([\d.]+)/i,
    mask: /Subnet mask\s*[:：]?\s*([\d.]+)/i,
    router: /(?:Router\s*A|ルータ)[^\n]*?([\d.]+\/\d+)/
  };

  function read(x) {
    var t = join(x), out = {};
    var q = (x && typeof x === "object" && x.text !== undefined)
      ? String(x.text) : t.split(/\n\s*\n/)[0];
    ["first", "optic"].forEach(function (k) {
      var m = q.match(PAT[k]);
      out[k] = m ? (m[1] || m[0]) : null;
    });
    /* ケーブルの話は、問題文ではなく**提示物の notconnect**で分かることがある */
    var mc = t.match(PAT.cable);
    out.cable = mc ? (mc[1] || mc[0]) : null;
    ["gw", "ip", "mask", "router"].forEach(function (k) {
      var m = t.match(PAT[k]);
      out[k] = m ? (m[1] || m[0]) : null;
    });
    out.all = t;
    return out;
  }

  function excerpt(x) {
    var t = join(x), lines = t.split("\n"), out = [lines[0], ""];
    lines.slice(1).forEach(function (l) {
      if (/最初のステップ|最初に|確認する|ケーブルの種類|notconnect|-SR|-LR|トランシーバ/.test(l)
          || /Default gateway|IP address|Subnet mask|デフォルトゲートウェイ/i.test(l)) out.push(l);
    });
    return out.join("\n");
  }

  /* ── 判定ルール ─────────────────────────── */
  var RULES = [
    { key: "optic", cue: "トランシーバーと距離", cond: "トランシーバーと伝送距離について問われている",
      say: "距離に対して、トランシーバーの種類が合っていない",
      verdict: "トランシーバーの種類が、必要な距離に合っていない",
      why: "-SR は最大 300m、-LR は最大 10km。距離に合わないトランシーバーを使うと、光が届かない",
      look: ["トランシーバーと距離"],
      steps: function (v) { return [["出ている部品", v.optic || "-"]]; },
      no: function () { return "光の部品の話ではない"; },
      test: function (v) { return !!v.optic; } },

    { key: "cable", cue: "notconnect のまま", cond: "ケーブルの種類について問われている",
      say: "口は有効なのに notconnect なので、線そのものが合っていない",
      verdict: "ケーブルの種類が合っていない",
      why: "インターフェースは有効なのに notconnect のままなので、ケーブルの種類（ストレートとクロス）が合っていない",
      look: ["ケーブルの種類"],
      steps: function (v) { return [["出ている印", v.cable || "-"]]; },
      no: function () { return "ケーブルの話ではない"; },
      test: function (v) { return !!v.cable; } },

    { key: "first", cue: "最初に確認するステップ", cond: "最初に何を確認するかを問われている",
      say: "外とだけ通信できないので、まずどこまで届くかを確かめる",
      verdict: "デフォルトゲートウェイまで到達できるかを、最初に確認する",
      why: "同じネットワーク内とは通信できて外とだけ通信できないなら、まずデフォルトゲートウェイまで到達できるかを確認する。そこで届いていなければ、その先を調べる必要がない",
      look: ["どこまで話せるか（問題文）"],
      steps: function (v) { return [["問題文のことば", v.first || "-"]]; },
      no: function () { return "手順を聞かれてはいない"; },
      test: function (v) { return !!v.first; } },

    { key: "gw", cue: "外部と通信できない", cond: "そのほか（外のネットワークと通信できない）",
      say: "同じネットワーク内は通じるので、外への出口の設定が違う",
      verdict: "デフォルトゲートウェイの設定が違う",
      why: "同じネットワーク内とは通信できるのに外と通信できないのは、デフォルトゲートウェイの IP アドレスが違うため。図に書かれているルータの IP アドレスと見比べる",
      look: ["デフォルトゲートウェイ", "IP アドレスとサブネットマスク"],
      steps: function (v) {
        return [["デフォルトゲートウェイ", v.gw || "-"], ["ルータの IP アドレス", v.router || "-"]];
      },
      no: function () { return "ここまでで決まっている"; },
      test: function () { return true; } }
  ];

  var GLOSS = {
    "トランシーバーの種類が、必要な距離に合っていない": "-SR は最大 300m、-LR は最大 10km",
    "ケーブルの種類が合っていない": "インターフェースは有効なのに、notconnect のままになっている",
    "デフォルトゲートウェイまで到達できるかを、最初に確認する": "そこで届いていなければ、その先を調べる必要がない",
    "デフォルトゲートウェイの設定が違う": "同じネットワーク内とは通信できるのに、外と通信できない"
  };

  var SAME = {
    "トランシーバーの種類が、必要な距離に合っていない": ["トランシーバー", "トランシーバ"],
    "ケーブルの種類が合っていない": ["ケーブルの種類"],
    "デフォルトゲートウェイまで到達できるかを、最初に確認する": ["デフォルトゲートウェイ"],
    "デフォルトゲートウェイの設定が違う": ["デフォルトゲートウェイ"]
  };

  /* ── 画面を作る ─────────────────────────── */
  function baseVals() {
    var net = "192.168." + R(1, 40);
    return {
      net: net,
      host: net + "." + R(2, 60),
      rt: net + ".254",
      bad: net + "." + R(100, 200),
      mask: "255.255.255.0"
    };
  }

  function pc(v) {
    return [
      /* **つなぎ方は文字で書かない。**画面が図として描く（下の figFor）。
         ただし**ルータの口の値は残す。**見比べる相手なので、
         これが無いと端末側の設定が正しいかどうか判断できない */
      "ルータ A の口   " + v.rt + "/24",
      "",
      "【HostC の画面：IPv4 の設定】",
      "  ● 次の IP アドレスを使う",
      "     IP address:        " + v.host,
      "     Subnet mask:       " + v.mask,
      "     Default gateway:   " + v.gwshow
    ].join("\n");
  }

  function build(v) { return v.need + "\n\n" + pc(v); }

  var MAKERS = {
    optic: function (b) {
      b.gwshow = b.rt;
      b.need = "サイト A と サイト B を、新しいシングルモード ファイバーで 5km つなぎました。" +
               "両端に -SR のトランシーバーを挿しています。通信できない原因はどれですか。";
      return b;
    },
    cable: function (b) {
      b.gwshow = b.rt;
      b.need = "インターフェースは有効なのに notconnect のままです。問題の原因は何ですか。";
      return b;
    },
    first: function (b) {
      b.gwshow = b.rt;
      b.need = "同じネットワークの機器とは話せますが、別のネットワークの機器とは話せません。" +
               "最初に確認するステップは何ですか。";
      return b;
    },
    gw: function (b) {
      b.gwshow = b.bad;              /* ルータの住所と違う数を入れる */
      b.need = "HostC がインターネットに接続できません。原因となっている設定はどれですか。";
      return b;
    }
  };

  function sample() {
    return [
      "HostC がインターネットに接続できません。原因となっている設定はどれですか。",
      "（ほかの聞かれ方：最初に確認するステップ／notconnect のままでケーブルの種類／" +
        "シングルモード ファイバーに -SR のトランシーバー）",
      "",
      pc({ rt: "192.168.1.254", host: "192.168.1.3",
           mask: "255.255.255.0", gwshow: "192.168.1.1" })
    ].join("\n");
  }


  /* ── 説明の1枚に添える一言 ─────────────────────
   * **取り違えやすい所だけ。**判定ルールの理由（why）をもう一度書かない。
   */
  var NOTE = {
    optic: "-SR は最大 300m、-LR は最大 10km。距離に合わないものを使うと光が届かない",
    cable: "インターフェースは有効なのに notconnect なら、ストレートとクロスの取り違え",
    first: "そこで届いていなければ、その先を調べる必要がない",
    gw: "パソコンの Default gateway の値を、図に書かれているルータの IP アドレスと見比べる"
  };

  /* 提示物から、画面に描く図を組み立てる。
     **並びに意味がある形**（インターネット ── ルータ ── スイッチ ── 端末）。
     見るのはルータの IP アドレスと、画面が出ている端末（HostC）なので、そこを光らせる */
  function figFor(text) {
    var t = String(text || "");
    var m = t.match(/Default gateway:\s*([\d.]+)/);
    var ip = t.match(/IP address:\s*([\d.]+)/);
    if (!m && !ip) return null;
    var rt = (t.match(/ルータ A の口\s+([\d.]+)\/24/) || [])[1] || null;
    if (!rt) return null;
    return { shape: "chain",
             nodes: [{ id: "インターネット" },
                     { id: "ルータ A", note: rt ? rt + "/24" : null },
                     { id: "スイッチ" }],
             leaves: ["HostA", "HostB", "HostC"],
             mark: ["ルータ A", "HostC"] };
  }

  var spec = {
    id: "nolink",
    /* 出題パターン＝どのルールで答えにたどり着くか。
       絞ったせいでパターンが消えていないかを、build.js が毎回見る */
    pattern: E.cuePattern, patterns: ["cable", "first", "gw", "optic"],
    kind: "rules",
    card: "misc",
    name: "繋がらない原因を探す",
    note: "設定や配線を見て、つながらない原因を1つ名ざしする",
    obj: "1.10",
    ask: "つながらない原因は、どれですか。",
    wantsQuestion: true,
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt,
    figFor: figFor,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample, /* 決め手が出力の中にあるルール。ここだけ見本の現物を出す */
    learnOut: ["gw"],
    brief: E.cueBrief(RULES, NOTE), answerNote: E.cueAnswerNote(RULES, GLOSS),
    stepQ: E.cueStepQ(RULES, "つながらない原因は、どれですか。"),
    expect: { spots: 5, rules: 4, questions: 5 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.nolink = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
