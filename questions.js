/* 過去問の入れ物。**中身はここに書かない。**
 *
 * ブロックごとに q/<ブロックの id>.js に分けて置く。
 *   BANKS[<ブロックの id>] = [ {qid, book, text, exhibit または fig, image, choices, answer, explanation}, … ]
 *
 * 分けてあるのは、ブロックを並行して作るときに、同じファイルを取り合わないため。
 * 読み込む順番は index.html（この入れ物を先に読む）。
 */
(function (global) {
  "use strict";
  global.BANKS = global.BANKS || {};
  var IDS = ["showint", "rootbridge", "json", "ospf", "ospfdr", "log",
                 "parts", "autoword", "ipv6word", "cable", "aaa", "guardword", "dhcpword",
                 "etherchannel", "trunk", "access", "ipsvc", "portsec",
                 "wlangui", "nolink", "misc"];
  /* Node から読むときは、ここでブロックごとのファイルを読み込む
     （ブラウザは index.html の <script> で読む） */
  if (typeof require !== "undefined") {
    IDS.forEach(function (id) { require("./q/" + id + ".js"); });
    if (!global.SYNONYM) { try { require("./q/synonym.js"); } catch (e) {} }
  }
  global.BANK_IDS = IDS;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { BANKS: global.BANKS, BANK_IDS: IDS };
  }
})(typeof window !== "undefined" ? window : globalThis);
