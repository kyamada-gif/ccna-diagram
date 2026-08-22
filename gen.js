/* ブロックの組み立て。**ここに題材の中身は書かない。**
 *
 *   engine.js      共通の仕掛け（判定・道すじ・出力作り）
 *   types/<id>.js  ブロックごとの中身（見る所・判定ルール・出力の型）
 *   gen.js         その2つを組んで global.GENS[<id>] にする  ←ここ
 *
 * ブロックを増やすときは types/ にファイルを足し、下の BLOCK_IDS と
 * index.html の <script> に1行足す。ほかは触らない。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("./engine.js") : null);

  /* 規則で答えを出すブロック。中身は types/<id>.js に書く */
  var RULE_IDS = ["showint", "rootbridge", "json", "ospf", "ospfdr",
                  "wlangui", "nolink", "misc"];

  /* 言葉と説明を結んで覚えるブロックは、別のアプリ（wordmatch/）へ移した。
     ここには無い。engine.js の makeMatchEngine もこのアプリでは使わない */
  var MATCH_IDS = [];

  var BLOCK_IDS = RULE_IDS.concat(MATCH_IDS);

  /* Node から読むときは、ここで types を読み込む（ブラウザは index.html の script） */
  if (typeof require !== "undefined") {
    RULE_IDS.forEach(function (id) { require("./types/" + id + ".js"); });
    /* 対応づけのエンジンは過去問の対から組むので、先に問題を読み込む
       （ブラウザは index.html で questions.js を先に読んでいる） */
    if (!global.BANKS) require("./questions.js");
  }

  var SPECS = global.SPECS || {};
  var GENS = {};
  RULE_IDS.forEach(function (id) {
    if (SPECS[id]) GENS[id] = E.makeEngine(SPECS[id]);
  });
  MATCH_IDS.forEach(function (id) {
    var bank = (global.BANKS || {})[id];
    if (bank && bank.length) GENS[id] = E.makeMatchEngine({ id: id, bank: bank });
  });

  global.GENS = GENS;
  global.SPECS = SPECS;
  global.BLOCK_IDS = BLOCK_IDS;
  global.RULE_IDS = RULE_IDS;
  global.MATCH_IDS = MATCH_IDS;
  /* 前からある呼び方。1つ目のブロックを指す */
  global.GEN = GENS[BLOCK_IDS[0]];

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { GENS: GENS, SPECS: SPECS, BLOCK_IDS: BLOCK_IDS,
                      RULE_IDS: RULE_IDS, MATCH_IDS: MATCH_IDS, GEN: global.GEN };
  }
})(typeof window !== "undefined" ? window : globalThis);
