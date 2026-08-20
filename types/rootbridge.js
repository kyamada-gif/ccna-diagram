/* 「ルートブリッジの決まり方」ブロックの中身（目標2.5・過去問23問）。
 *
 * show interface のブロックと形は同じ（spots / rules / makers）だが、
 * **提示物がテキストではなく図**なので、次の3つを自分で持つ。
 *   read    … 図の中身（fig）から値を読む
 *   excerpt … 決め手だけを残す
 *   answer  … 答えが決まった言葉ではなく、その場のスイッチ名になる
 *
 * 判定は2本だけ。過去問23問すべてで本の答えと一致する。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "pri", name: "ブリッジ優先度",
      mean: "そのスイッチが代表になりたい度合い。数が小さいほど強い",
      use: "4台をくらべて、いちばん小さい数を探す。それが1台だけなら、そのスイッチが答え。同じ数が2台以上あるときは、次に MACアドレス を見る" },
    { key: "mac", name: "MACアドレス",
      mean: "機器につけられた番号。16進数（0〜9 と a〜f）で書く",
      use: "優先度がいちばん小さいスイッチが2台以上あるとき、その中で MACアドレス が小さい方が答え。左から1文字ずつくらべる。数字は文字より小さい（0 < 9 < a < f）" }
  ];

  /* ── 図から値を読む ─────────────────────────
   * 返すのは「4台の並び」と、そこから作った手がかり。
   */
  function read(fig) {
    var sw = (fig && fig.sw ? fig.sw : []).map(function (s) {
      return { id: s.id, pri: s.pri, mac: s.mac, hex: String(s.mac || "").replace(/:/g, "").toLowerCase() };
    });
    var lowest = sw.length ? Math.min.apply(null, sw.map(function (s) { return s.pri; })) : 0;
    var tied = sw.filter(function (s) { return s.pri === lowest; });
    var win = tied.slice().sort(function (a, b) { return a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0; })[0];
    return { sw: sw, lowest: lowest, tied: tied, win: win || null };
  }

  /* 答え。その場のスイッチ名になる */
  function answer(v) { return v.win ? v.win.id : ""; }

  function listPri(v) {
    return v.sw.map(function (s) { return s.id + " " + s.pri; }).join("　");
  }
  function listMac(v) {
    return v.tied.map(function (s) { return s.id + " " + s.mac; }).join("　");
  }

  /* ── 判定ルール。上から順に当てて、最初に当たったところで決める ── */
  var RULES = [
    { key: "pri", cond: "いちばん小さい優先度のスイッチが、1台だけ",
      verdict: "ブリッジ優先度で決まる",
      why: "優先度がいちばん小さいスイッチが1台しかないので、そこで決まる",
      look: ["ブリッジ優先度"],
      steps: function (v) {
        return [["いちばん小さい優先度", v.lowest], ["その優先度のスイッチ", v.tied.length + " 台"],
                ["4台の優先度", listPri(v)]];
      },
      no: function (v) {
        return "いちばん小さい優先度 " + v.lowest + " のスイッチが " + v.tied.length + " 台あるので、これだけでは決まらない";
      },
      test: function (v) { return v.tied.length === 1; } },

    { key: "mac", cond: "いちばん小さい優先度のスイッチが、2台以上",
      verdict: "MACアドレスで決まる",
      why: "優先度が同じなので、その中で MACアドレス が小さい方になる",
      look: ["MACアドレス"],
      steps: function (v) {
        return [["いちばん小さい優先度", v.lowest], ["その優先度のスイッチ", v.tied.length + " 台"],
                ["くらべる MACアドレス", listMac(v)]];
      },
      no: function (v) {
        return "いちばん小さい優先度 " + v.lowest + " のスイッチが1台だけなので、MACアドレスを見るまでもない";
      },
      test: function (v) { return v.tied.length >= 2; } }
  ];

  var GLOSS = {
    "ブリッジ優先度で決まる": "優先度の数がいちばん小さいスイッチが、代表になる",
    "MACアドレスで決まる": "優先度が同じときの決着のつけ方"
  };

  /* ── 図を作る ─────────────────────────────
   * 4台を四角に並べ、優先度と MACアドレス を配る。
   * 「線」は答えに関係しないので、いつも同じつなぎ方でよい。
   */
  var NAMES = [["SW1", "SW2", "SW3", "SW4"], ["MDF-DC-1", "MDF-DC-2", "MDF-DC-3", "MDF-DC-4"]];
  var PRIS = [4096, 8192, 12288, 16384, 20480, 24576, 28672, 32768, 36864, 40960, 45056, 49152, 53248, 57344, 61440];

  function hex2() { return ("0" + R(0, 255).toString(16)).slice(-2); }
  function mac() {
    var out = [];
    for (var i = 0; i < 6; i++) out.push(hex2());
    return out.join(":");
  }

  function baseVals() {
    var names = pick(NAMES);
    return { names: names, pris: null, macs: null };
  }

  function build(v) {
    var sw = v.names.map(function (id, i) {
      return { id: id, pri: v.pris[i], mac: v.macs[i] };
    });
    var n = v.names;
    return {
      sw: sw,
      link: [[n[0], "Gi1/0/1", n[1], "Gi1/0/1"], [n[0], "Gi1/0/3", n[3], "Gi1/0/1"],
             [n[0], "Gi1/0/2", n[2], "Gi1/0/3"], [n[1], "Gi1/0/2", n[2], "Gi1/0/1"],
             [n[3], "Gi1/0/2", n[2], "Gi1/0/2"]],
      host: []
    };
  }

  /* 4つとも違う MACアドレス を作る */
  function macs4() {
    var out = [];
    while (out.length < 4) {
      var m = mac();
      if (out.indexOf(m) < 0) out.push(m);
    }
    return out;
  }

  var MAKERS = {
    /* 優先度だけで決まる：いちばん小さい数を1台だけにする */
    pri: function (b) {
      var lo = pick(PRIS.slice(0, 10));
      var hi = PRIS.filter(function (p) { return p > lo; });
      b.pris = [lo, pick(hi), pick(hi), pick(hi)];
      b.pris = E.shuffle(b.pris);
      b.macs = macs4();
      return b;
    },
    /* MACアドレスで決まる：いちばん小さい数を2台にする */
    mac: function (b) {
      var lo = pick(PRIS.slice(0, 10));
      var hi = PRIS.filter(function (p) { return p > lo; });
      b.pris = E.shuffle([lo, lo, pick(hi), pick(hi)]);
      b.macs = macs4();
      return b;
    }
  };

  /* 決め手だけを残す。図はそのまま、答えに関係しない線を落とす */
  function excerpt(fig, look) {
    return { sw: fig.sw, link: [], host: [] };
  }

  function sample() {
    return {
      sw: [{ id: "SW1", pri: 8192, mac: "00:24:98:6f:3b:41" },
           { id: "SW2", pri: 16384, mac: "00:24:98:6f:3b:43" },
           { id: "SW3", pri: 32768, mac: "00:24:98:6f:3b:42" },
           { id: "SW4", pri: 8192, mac: "00:24:98:6f:3b:40" }],
      link: [["SW1", "Gi1/0/1", "SW2", "Gi1/0/1"], ["SW1", "Gi1/0/3", "SW4", "Gi1/0/1"],
             ["SW1", "Gi1/0/2", "SW3", "Gi1/0/3"], ["SW2", "Gi1/0/2", "SW3", "Gi1/0/1"],
             ["SW4", "Gi1/0/2", "SW3", "Gi1/0/2"]],
      host: []
    };
  }

  var spec = {
    id: "rootbridge",
    kind: "rules",
    view: "topology",          /* 画面は図で出す */
    card: "read",
    name: "ルートブリッジの決まり方",
    note: "つながったスイッチの中から、代表を1台決める",
    obj: "2.5",
    spots: SPOTS, rules: RULES, gloss: GLOSS,
    read: read, answer: answer, excerpt: excerpt,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample,
    expect: { spots: 2, rules: 2, questions: 23 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.rootbridge = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
