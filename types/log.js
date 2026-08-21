/* 「ログの読み取り」ブロック（過去問3問）。
 *
 * 機器が出したログの行を読んで、何が起きているかを当てる。
 * いまは「衝突が多すぎる（excessive collisions）」1種類だけ。
 * 別のログが出てくる問題が見つかったら、見る所とルールを足す。
 *
 * もとは目標3.4（OSPF）に分類されていたが、中身は
 * 「出力を読んで当てる」で、OSPF の規則では解けない。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "kind", name: "ログの種類",
      re: /-\d-([A-Z]+)/,
      mean: "ログの見出しの最後にある英字。そのログが何についてのものかを表す",
      use: "COLL なら衝突についてのログ。ここでログの種類が決まるので、まずここを見る" },
    { key: "word", name: "本文の言葉",
      re: /(excessive collisions|Excessive collisions)/i,
      mean: "ログの本文に書かれている言葉。何が起きているのかがここに出ている",
      use: "excessive collisions は「衝突が多すぎる」という意味。送り直しに16回続けて失敗すると、そのフレームは破棄される" }
  ];

  var PAT = {
    kind: /-\d-([A-Z]+)/,
    coll: /(excessive collisions)/i,
    retry: /(Retry limit)/i
  };

  /* ── 判定ルール ─────────────────────────── */
  var RULES = [
    { key: "coll", cond: "ログに excessive collisions と書かれている",
      verdict: "送信に16回失敗すると、そのフレームは破棄される",
      why: "衝突が多すぎることを知らせるログ。衝突するたびに送り直すが、16回続けて失敗した時点で、そのフレームは破棄される",
      look: ["ログの種類", "本文の言葉"],
      steps: function (v) {
        return [["ログの種類", v.kind || "-"], ["本文の言葉", v.coll || "-"]];
      },
      no: function (v) {
        return "excessive collisions というログが出ていないので、衝突の話ではない";
      },
      test: function (v) { return !!v.coll; } }
  ];

  var GLOSS = {
    "送信に16回失敗すると、そのフレームは破棄される":
      "衝突するたびに送り直すが、16回続けて失敗したらそこで打ち切る決まりになっている"
  };

  var SAME = {
    "送信に16回失敗すると、そのフレームは破棄される":
      ["16回の送信試行に失敗", "送信試行が 16 回失敗", "16 回失敗"]
  };

  /* ── ログを作る ─────────────────────────── */
  var UNIT = ["AMDP2_FE", "DEC21140", "ILACC", "LANCE", "PQUICC", "PQUICC_ETHER"];

  function baseVals() { return { n: R(2, 5) }; }

  function build(v) {
    var out = [];
    var us = E.shuffle(UNIT).slice(0, v.n);
    us.forEach(function (u) {
      out.push("%" + u + "-5-COLL: Unit [DEC], excessive collisions. TDR=[DEC]");
    });
    return out.join("\n");
  }

  var MAKERS = {
    coll: function (b) { return b; }
  };

  function sample() {
    return ["%AMDP2_FE-5-COLL: AMDP2/FE 0/0/[DEC], Excessive collisions, TDR=[DEC], TRC=[DEC]",
            "%DEC21140-5-COLL: [chars] excessive collisions",
            "%LANCE-5-COLL: Unit [DEC], excessive collisions. TDR=[DEC]"].join("\n");
  }

  var spec = {
    id: "log",
    kind: "rules",
    card: "read",
    name: "ログの読み取り",
    note: "機器が出したログを読んで、何が起きているかを当てる",
    obj: "1.4",
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample,
    expect: { spots: 2, rules: 1, questions: 3 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.log = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
