/* 学習の記録をためる所。**いまは localStorage だが、サーバのDBのつもりで扱う。**
 *
 * **練習もテストも、同じ1つの形（attempt）でためる。**
 * あとでサーバに載せ替えるときは、下の save/load だけを差し替える。
 * 中の形と、集計のしかた（summarize）は、そのまま持っていける。
 *
 * ── ためるもの（attempts。1回の演習＝1件。追記だけ。書き換えない）
 *
 *   { id        "a-1755…-7f3k"       一意。二重に入れないための番号
 *     app       "showread"
 *     version   "31-23"              問題データの版（ブロックごとの問数）
 *     user      null                 いまは無し。サーバでは必須になる
 *     block     "rootbridge"         どの分野か
 *     mode      "practice" | "test"  練習かテストか
 *     set       "B1-P12-034..B1-P15-026" | "generated"
 *                                    出題範囲の名前。**番号ではなく中身で決める。**
 *                                    番号（0,1,2）だと、過去問が増えたとき
 *                                    同じ番号が別の問題の集まりを指してしまう
 *     startedAt / endedAt  ISO8601
 *     seconds   208
 *     asked / score / of   答えた数 / 正解した数 / 出した数
 *     passLine / passed    印が付く線 / 届いたか
 *     answers   [ 1問ずつ ] }
 *
 * ── 1問ぶん
 *
 *   { no       1                     何問目か
 *     kind     "past"|"step"|"whole" 過去問／見る所ごと／ぜんぶ見て
 *     qid      "B1-P15-007" | null   過去問だけ。作った問題は null
 *     spot     "ブリッジ優先度"|null  練習のとき、どの見る所か
 *     firstOk  true                  **最初の答えが合っていたか。点になるのはこれ**
 *     tries    1                     何回で正解したか
 *     picked   [...]                 最初に押したもの
 *     right    [...]                 正解
 *     ms       18400 }               その1問にかかった時間
 *
 * ── 画面が使うもの（summarize が attempts から作る。ためない）
 *
 *   { blocks: { rootbridge: {
 *       practiced: true,
 *       rounds: { "B1-…..B1-…": {best:9, of:10, passed:true, at:"…"} },
 *       badge: false } } }
 */
(function (global) {
  "use strict";

  var KEY = "showread.attempts";
  var MAX = 500;               /* localStorage は無限ではない。古いものから捨てる */

  function nowIso() { return new Date().toISOString(); }
  function uid() {
    return "a-" + Date.now().toString(36) + "-" +
      Math.random().toString(36).slice(2, 6);
  }

  /* 出題範囲の名前。**中身で決める。**問題が増減しても、同じ集まりなら同じ名前になる */
  function setKey(qs) {
    if (!qs || !qs.length) return "empty";
    var ids = qs.map(function (q) { return q.qid; }).slice().sort();
    return ids[0] + ".." + ids[ids.length - 1] + "#" + ids.length;
  }

  function load() {
    try {
      var v = JSON.parse(global.localStorage.getItem(KEY));
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  function save(list) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    } catch (e) {}
  }

  /* 1件ためる。同じ id が既にあれば足さない（二重送信よけ） */
  function add(attempt) {
    var list = load();
    if (list.some(function (a) { return a.id === attempt.id; })) return list;
    list.push(attempt);
    save(list);
    return list;
  }

  /* ── 1回の演習を組み立てる ───────────────────── */
  function start(o) {
    return {
      id: uid(), app: "showread", version: o.version || "", user: o.user || null,
      block: o.block, mode: o.mode, set: o.set,
      startedAt: nowIso(), endedAt: null, seconds: 0,
      asked: 0, score: 0, of: o.of || 0,
      passLine: o.passLine || 0, passed: false,
      answers: []
    };
  }

  function answer(a, rec) {
    a.answers.push(rec);
    a.asked = a.answers.length;
    a.score = a.answers.filter(function (x) { return x.firstOk; }).length;
    return a;
  }

  function finish(a) {
    a.endedAt = nowIso();
    a.seconds = Math.round(
      (new Date(a.endedAt) - new Date(a.startedAt)) / 1000);
    a.passed = a.score >= a.passLine;
    return a;
  }

  /* ── 画面が使う形にまとめる ─────────────────────
   * blockIds … 全ブロックの id。**触っていないブロックもキーを作る。**
   *            無いと、受け取る側が毎回「無いのか 0 なのか」を考えることになる
   * roundsOf … その分野のテストの回（範囲の名前の配列）を返す関数
   */
  function summarize(attempts, blockIds, roundsOf) {
    var out = {};
    blockIds.forEach(function (id) {
      var rounds = {};
      (roundsOf ? roundsOf(id) : []).forEach(function (k) {
        rounds[k] = { best: null, of: null, passed: false, at: null };
      });
      out[id] = { practiced: false, rounds: rounds, badge: false };
    });
    attempts.forEach(function (a) {
      var b = out[a.block];
      if (!b) return;
      if (a.mode === "practice") { b.practiced = true; return; }
      var r = b.rounds[a.set];
      if (!r) { r = b.rounds[a.set] = { best: null, of: null, passed: false, at: null }; }
      if (r.best === null || a.score > r.best) { r.best = a.score; r.of = a.of; }
      if (a.passed) r.passed = true;
      r.at = a.endedAt || a.startedAt;
    });
    blockIds.forEach(function (id) {
      var ks = Object.keys(out[id].rounds);
      out[id].badge = ks.length > 0 && ks.every(function (k) { return out[id].rounds[k].passed; });
    });
    return { blocks: out };
  }

  var API = { KEY: KEY, uid: uid, setKey: setKey, load: load, save: save, add: add,
              start: start, answer: answer, finish: finish, summarize: summarize };
  global.STORE = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
