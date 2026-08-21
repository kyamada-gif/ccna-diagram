/* 「そのほか」ブロック（過去問5問）。
 *
 * ほかのブロックに入らなかった、一点ものの集まり。決め方は4つ。
 *
 *   ① QoS の図から動作を読み取る      2問
 *   ② OSPF の代表ルータにする設定     1問
 *   ③ IPv6 の自動アドレス            1問
 *   ④ ARP を受け取ったスイッチの動き  1問
 *
 * **どれも図か、1回きりの知識**なので、その場で作り直せる問題が無い。
 * 説明の1枚だけを出し、問題は作らない。テストには本の問題がそのまま出る。
 *
 * 2026-08-21：JSON の「何が足りないか」3問は、JSON のブロックへ移した。
 * 中身が JSON の書き方そのものなので、そちらで練習したほうが身に付く。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "qos", name: "図の右側のパケットの並び（QoS）",
      re: /(QoS|キューイング|ポリシング|シェーピング)/,
      mean: "パケットが1列に並んでいるか、破棄されているか",
      use: "右側が1列に並んでいたらキューイング（順番待ち）。破棄されているならポリシング" },

    { key: "dr", name: "OSPF の優先度",
      re: /(ip ospf priority|優先度|代表)/,
      mean: "そのルータが代表ルータに選ばれやすいかどうかを決める設定値。大きいほど選ばれやすい",
      use: "代表にしたいルータの優先度を、最大の 255 にする。0 にすると代表ルータには選ばれない" },

    { key: "eui", name: "IPv6 の自動アドレス",
      re: /(eui-64|自動アドレス)/i,
      mean: "機器の MAC アドレスから、アドレスの後半 64 ビットを自動で生成する仕組み",
      use: "ipv6 address （前半）::/64 eui-64 と設定する。後半は機器が自分で生成する" },

    { key: "arp", name: "ARP を受け取ったスイッチの動き",
      re: /(ARP|フラッディング)/,
      mean: "宛先の MAC アドレスを学習していないスイッチが、どう動作するか",
      use: "受信したポート以外のすべてのポートへ転送する（フラッディング）。宛先を学習済みであれば、そのポートだけに転送する" }
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
    { key: "qos", cue: "ホップごとの QoS 動作", cond: "QoS の図から動作を読み取る",
      verdict: "キューイング（順番待ち）",
      why: "図の右側が1列に並んでいたらキューイング。破棄されているならポリシング、流量をならしているならシェーピング",
      look: ["絵の右側の並び（QoS）"],
      steps: function (v) { return [["問題文のことば", v.qos || "-"]]; },
      no: function () { return "QoS の絵の話ではない"; },
      test: function (v) { return !!v.qos; } },

    { key: "dr", cue: "中心点（代表ルータ）にする", cond: "OSPF の代表ルータにしたい",
      verdict: "ip ospf priority を、最も大きい 255 にする",
      why: "優先度の値が最も大きいルータが代表になる。設定できる最大値は 255。0 にすると代表ルータには選ばれない",
      look: ["OSPF の優先度"],
      steps: function (v) { return [["問題文のことば", v.dr || "-"]]; },
      no: function () { return "代表ルータの話ではない"; },
      test: function (v) { return !!v.dr; } },

    { key: "eui", cue: "自動アドレス割り当て", cond: "IPv6 のアドレスを自動で生成したい",
      verdict: "ipv6 address （前半）::/64 eui-64 と設定する",
      why: "後半 64 ビットは、機器が自分の MAC アドレスから生成する。そのため前半だけ指定すればよい",
      look: ["IPv6 の自動アドレス"],
      steps: function (v) { return [["問題文のことば", v.eui || "-"]]; },
      no: function () { return "IPv6 の自動アドレスの話ではない"; },
      test: function (v) { return !!v.eui; } },

    /* いちばん下は受け皿。ここまでで決まらなければ、これになる */
    { key: "arp", cue: "ARP を受け取ったとき", cond: "そのほか（ARP を受け取ったスイッチの動き）",
      verdict: "受信したポート以外の、すべてのポートへ転送する",
      why: "宛先の MAC アドレスをまだ学習していないので、受信したポート以外のすべてのポートへ転送して探す",
      look: ["ARP を受け取ったスイッチの動き"],
      steps: function (v) { return [["問題文のことば", v.arp || "-"]]; },
      no: function () { return "ここまでで決まっている"; },
      test: function () { return true; } }
  ];

  var GLOSS = {
    "キューイング（順番待ち）": "破棄はされていない。順番待ちの列に並んでいる",
    "ip ospf priority を、最も大きい 255 にする": "0 にすると代表ルータには選ばれない",
    "ipv6 address （前半）::/64 eui-64 と設定する": "後半 64 ビットは、機器が自分で生成する",
    "受信したポート以外の、すべてのポートへ転送する": "宛先をまだ学習していないので、すべてのポートへ転送して探す",
  };

  var SAME = {
    "キューイング（順番待ち）": ["キューイング"],
    "ip ospf priority を、最も大きい 255 にする": ["ip ospf priority"],
    "ipv6 address （前半）::/64 eui-64 と設定する": ["eui-64"],
    "受信したポート以外の、すべてのポートへ転送する": ["フラッディング"]
  };

  /* ── 問題は作らない ────────────────────────
   * この分野は、図か1回きりの知識ばかりで、その場で作り直せる形が無い。
   * **無理に作ると、本に無い問題になってしまう。**
   * 説明の1枚だけを出し、テストには本の問題をそのまま出す。
   */
  function sample() {
    return [
      "（この分野は、その場で作り直せる問題がありません。説明の1枚だけを出します）",
      "",
      "本に出ている聞かれ方",
      "  ・QoS の図から、ホップごとの動作を読み取る",
      "  ・OSPF の代表ルータにする設定（ip ospf priority を 255 にする）",
      "  ・IPv6 の自動アドレス割り当て（eui-64）",
      "  ・ARP を受け取ったスイッチの動作（フラッディング）"
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
    sample: sample, walk: E.cueWalk(RULES),
    expect: { spots: 4, rules: 4, questions: 5 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.misc = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
