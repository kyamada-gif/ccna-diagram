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

  var BLOCK_IDS = ["showint", "rootbridge", "json", "ospf", "ospfdr", "log"];

  /* Node から読むときは、ここで types を読み込む（ブラウザは index.html の script） */
  if (typeof require !== "undefined") {
    BLOCK_IDS.forEach(function (id) { require("./types/" + id + ".js"); });
  }

  var SPECS = global.SPECS || {};
  var GENS = {};
  BLOCK_IDS.forEach(function (id) {
    if (SPECS[id]) GENS[id] = E.makeEngine(SPECS[id]);
  });

  global.GENS = GENS;
  global.SPECS = SPECS;
  global.BLOCK_IDS = BLOCK_IDS;
  /* 前からある呼び方。1つ目のブロックを指す */
  global.GEN = GENS[BLOCK_IDS[0]];

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { GENS: GENS, SPECS: SPECS, BLOCK_IDS: BLOCK_IDS, GEN: global.GEN };
  }
})(typeof window !== "undefined" ? window : globalThis);
