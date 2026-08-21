/* 「そのほか」ブロック（過去問8問）。
 *
 * ほかのブロックに入らなかった、一点ものの集まり。決め方は5つ。
 *
 *   ① JSON の書き方が足りない        3問
 *   ② QoS の絵から動きを読む         2問
 *   ③ OSPF の代表ルータにする設定     1問
 *   ④ IPv6 の自動アドレス            1問
 *   ⑤ ARP を受け取ったスイッチの動き  1問
 *
 * **JSON の3問だけは、その場で作れる**（かっこを1つ落とした文を作る）。
 * ほかの5問は絵や1回きりの知識なので、覚える1枚だけを出し、
 * 問題は作らない（bookOnly。テストには本の問題が出る）。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "brace", name: "かっこの数（JSON）",
      re: /[{}\[\]]/,
      mean: "{ } と [ ] が、開いた数だけ閉じているか",
      use: "開いた数と閉じた数を数える。足りなければ、足りないほうのかっこが答え" },

    { key: "qos", name: "絵の右側の並び（QoS）",
      re: /(QoS|キューイング|ポリシング|シェーピング)/,
      mean: "パケットが1列に並んでいるか、捨てられているか",
      use: "右側が1列に並んでいたら、順番待ち（キューイング）。捨てているならポリシング" },

    { key: "dr", name: "OSPF の優先度",
      re: /(ip ospf priority|優先度|代表)/,
      mean: "代表ルータになりたい度合い。大きいほど強い",
      use: "中心にしたいルータの優先度を、最も大きく（255）する。0 にすると代表になれない" },

    { key: "eui", name: "IPv6 の自動アドレス",
      re: /(eui-64|自動アドレス)/i,
      mean: "機器の MAC アドレスから、住所の後ろ半分を自動で作る仕組み",
      use: "`ipv6 address （前半）::/64 eui-64` と書く。後ろ半分は機器が自分で作る" },

    { key: "arp", name: "ARP を受け取ったスイッチの動き",
      re: /(ARP|フラッディング)/,
      mean: "宛先を知らないスイッチが、どうするか",
      use: "受信したポート以外のすべてのポートへ転送する（フラッディング）。宛先を学習済みなら、そのポートだけに転送する" }
  ];

  function join(x) {
    if (x && typeof x === "object" && x.exhibit !== undefined) {
      return String(x.text || "") + "\n" + String(x.exhibit || "");
    }
    return String(x || "");
  }

  var PAT = {
    json: /(欠けている|足りない|不足)/,
    qos: /(ホップごとの\s*QoS|QoS\s*動作)/i,
    dr: /(中心点|代表|DR)/,
    eui: /(自動アドレス割り当て|eui-64)/i,
    arp: /(ARP)/,
    open: /[{[]/g,
    close: /[}\]]/g
  };

  function read(x) {
    var t = join(x), out = {};
    var q = (x && typeof x === "object" && x.text !== undefined)
      ? String(x.text) : t.split(/\n\s*\n/)[0];
    ["json", "qos", "dr", "eui", "arp"].forEach(function (k) {
      var m = q.match(PAT[k]);
      out[k] = m ? (m[1] || m[0]) : null;
    });
    out.open = (t.match(PAT.open) || []).length;
    out.close = (t.match(PAT.close) || []).length;
    out.all = t;
    return out;
  }

  function excerpt(x) {
    var t = join(x), lines = t.split("\n"), out = [lines[0], ""];
    lines.slice(1).forEach(function (l) {
      if (/欠けている|足りない|不足|QoS|中心点|代表|自動アドレス|ARP/.test(l)
          || /[{}\[\]]/.test(l)) out.push(l);
    });
    return out.join("\n");
  }

  /* ── 判定ルール ─────────────────────────── */
  var RULES = [
    { key: "qos", cue: "ホップごとの QoS 動作", cond: "QoS の絵から動きを読む",
      verdict: "キューイング（順番待ち）",
      why: "絵の右側が1列に並んでいたら、順番待ち。捨てているならポリシング、ならしているならシェーピング",
      look: ["絵の右側の並び（QoS）"],
      steps: function (v) { return [["問題文のことば", v.qos || "-"]]; },
      no: function () { return "QoS の絵の話ではない"; },
      test: function (v) { return !!v.qos; } },

    { key: "dr", cue: "中心点（代表ルータ）にする", cond: "OSPF の代表ルータにしたい",
      verdict: "ip ospf priority を、最も大きい 255 にする",
      why: "代表になりたい度合いが最も大きいルータが、代表になる。255 が最大。0 にすると代表になれない",
      look: ["OSPF の優先度"],
      steps: function (v) { return [["問題文のことば", v.dr || "-"]]; },
      no: function () { return "代表ルータの話ではない"; },
      test: function (v) { return !!v.dr; } },

    { key: "eui", cue: "自動アドレス割り当て", cond: "IPv6 の住所を自動で作りたい",
      verdict: "ipv6 address （前半）::/64 eui-64 と書く",
      why: "後ろ半分は、機器が自分の MAC アドレスから作る。だから前半だけ書けばよい",
      look: ["IPv6 の自動アドレス"],
      steps: function (v) { return [["問題文のことば", v.eui || "-"]]; },
      no: function () { return "IPv6 の自動アドレスの話ではない"; },
      test: function (v) { return !!v.eui; } },

    { key: "arp", cue: "ARP を受け取ったとき", cond: "ARP を受け取ったスイッチの動き",
      verdict: "受信したポート以外の、すべてのポートへ転送する",
      why: "相手の場所をまだ知らないので、入ってきた口以外のすべてのポートへ転送して探す",
      look: ["ARP を受け取ったスイッチの動き"],
      steps: function (v) { return [["問題文のことば", v.arp || "-"]]; },
      no: function () { return "ARP の話ではない"; },
      test: function (v) { return !!v.arp; } },

    { key: "json", cue: "出力に足りないもの", cond: "そのほか（JSON の書き方が足りない）",
      verdict: "末尾の閉じかっこ（}）が足りない",
      why: "開いた数だけ閉じる。{ } と [ ] を数えて、足りないほうを足す",
      look: ["かっこの数（JSON）"],
      steps: function (v) { return [["開いた数", v.open], ["閉じた数", v.close]]; },
      no: function () { return "ここまでで決まっている"; },
      test: function () { return true; } }
  ];

  var GLOSS = {
    "キューイング（順番待ち）": "捨ててはいない。列に並んで待っている",
    "ip ospf priority を、最も大きい 255 にする": "0 にすると代表になれない",
    "ipv6 address （前半）::/64 eui-64 と書く": "後ろ半分は機器が自分で作る",
    "受信したポート以外の、すべてのポートへ転送する": "相手の場所をまだ知らないので、すべてのポートへ転送して探す",
    "末尾の閉じかっこ（}）が足りない": "開いた数だけ閉じる"
  };

  var SAME = {
    "キューイング（順番待ち）": ["キューイング"],
    "ip ospf priority を、最も大きい 255 にする": ["ip ospf priority"],
    "ipv6 address （前半）::/64 eui-64 と書く": ["eui-64"],
    "受信したポート以外の、すべてのポートへ転送する": ["フラッディング"],
    "末尾の閉じかっこ（}）が足りない": ["中括弧"]
  };

  /* ── JSON を作る ─────────────────────────
   * かっこを1つ落とした文を作る。**落とす場所は毎回ちがう。**
   */
  function baseVals() {
    return {
      a: pick(["myCar", "SW1", "user", "device"]),
      b: pick(["oldCar", "SW2", "admin", "router"]),
      c: pick(["good", "warning", "up", "down"])
    };
  }

  function jsonText(v) {
    return [
      "{",
      '    "' + v.a + '": {',
      '        "name": "' + v.b + '",',
      '        "state": ["' + v.c + '", "' + v.c + '"],',
      '        "light": false',
      "    }"
      /* 末尾の } を、わざと落としてある */
    ].join("\n");
  }

  function build(v) { return v.need + "\n\n" + jsonText(v); }

  var MAKERS = {
    json: function (b) {
      b.need = "この出力を実行するには、何が足りないのでしょうか。";
      return b;
    }
  };

  function sample() {
    return [
      "この出力を実行するには、何が足りないのでしょうか。",
      "（ほかの聞かれ方：QoS のホップごとの動作／OSPF の中心点にする設定" +
        "（ip ospf priority で優先度を最も大きくする）／" +
        "IPv6 の自動アドレス割り当て（eui-64）／ARP を受け取った S1 の動き（フラッディング））",
      "",
      jsonText({ a: "myCar", b: "Thunder", c: "good" })
    ].join("\n");
  }


  var spec = {
    id: "misc",
    kind: "rules",
    card: "misc",
    name: "そのほか",
    note: "ほかに入らない一点ものを、1つずつ覚える",
    obj: "6.7",
    ask: "この出力なら、答えはどれですか。",
    wantsQuestion: true,
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample, walk: E.cueWalk(RULES),
    expect: { spots: 5, rules: 5, questions: 8 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.misc = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
