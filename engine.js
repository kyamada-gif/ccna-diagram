/* 共通エンジン。分類（ブロック）ごとの spec を受け取って、判定と生成の道具一式を返す。
 *
 * **ここには題材の中身を書かない。**show interface のことも JSON のことも知らない。
 * 題材ごとの中身は types/<id>.js に書く。
 *
 * spec の形（types/showint.js が見本）
 *   id       … ブロックの id
 *   kind     … "rules"（判定ルールと自動生成がある）／"bank"（過去問だけ）
 *   spots    … 見る所。{key,name,re,mean,use}
 *   pat      … 出力から値を読む正規表現。{キー: RegExp}
 *   rules    … 判定ルール。上から順に当てて、最初に当たったところで決まる
 *   gloss    … 答えの言葉の一言説明
 *   same     … 本の答えとの言い換え表（検算に使う）
 *   build/baseVals/makers/sample … 出力を作るところ（kind:"rules" のみ）
 *   expect   … 申告値。{spots: 13, rules: 10}。build.js が実物と突き合わせる
 */
(function (global) {
  "use strict";

  function R(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    var x = a.slice(), i, j, t;
    for (i = x.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1)); t = x[i]; x[i] = x[j]; x[j] = t;
    }
    return x;
  }
  function n(v) { var x = parseInt(v, 10); return isNaN(x) ? 0 : x; }

  function makeEngine(spec) {
    var SPOTS = spec.spots || [];
    var RULES = spec.rules || [];
    var PAT = spec.pat || {};
    var MAKERS = spec.makers || {};
    var GLOSS = spec.gloss || {};

    /* 答えの顔ぶれ。**ブロックごとに持つ。**
       ひとつにまとめると、JSON の問題に「不良 NIC」が誤答で出てしまう */
    var VERDICTS = [];
    RULES.forEach(function (r) {
      if (VERDICTS.indexOf(r.verdict) < 0) VERDICTS.push(r.verdict);
    });

    function read(text) {
      var out = {};
      Object.keys(PAT).forEach(function (k) {
        var m = text.match(PAT[k]);
        out[k] = m ? m[1] : null;
      });
      return out;
    }

    function judge(values) {
      for (var i = 0; i < RULES.length; i++) {
        if (RULES[i].test(values)) return RULES[i];
      }
      return null;
    }

    /* 答えの出し方を、実際の数字で書き出す。
       **そのルール自体は当たっているのに上で先に決まった**ときは、そう書く。
       「ふだんの数」のような嘘を書かない */
    function trace(text) {
      var v = read(text);
      var hit = judge(v);
      if (!hit) return null;
      var steps = hit.steps(v).map(function (x) {
        return { name: x[0], value: String(x[1]) };
      });
      var seen = {}, reject = [];
      RULES.forEach(function (r) {
        if (r.verdict === hit.verdict || seen[r.verdict]) return;
        seen[r.verdict] = 1;
        var same = RULES.filter(function (x) { return x.verdict === r.verdict; });
        var passes = same.filter(function (x) { return x.test(v); });
        if (passes.length) {
          reject.push({ verdict: r.verdict, later: true,
            why: "こちらも当てはまるが、" + hit.look.join("・") +
                 " のほうが先に決まる（上から順に見る）" });
        } else {
          reject.push({ verdict: r.verdict, later: false, why: same[0].no(v) });
        }
      });
      return { verdict: hit.verdict, why: hit.why, steps: steps, reject: reject };
    }

    /* 同じ答えになるルールが続くところは、1つの「見る所」にまとめる */
    function groups() {
      var g = [];
      RULES.forEach(function (r) {
        var last = g[g.length - 1];
        if (last && last.verdict === r.verdict) {
          last.rules.push(r);
          r.look.forEach(function (w) { if (last.look.indexOf(w) < 0) last.look.push(w); });
        } else {
          g.push({ verdict: r.verdict, why: r.why, look: r.look.slice(), rules: [r] });
        }
      });
      return g;
    }

    function walk(text) {
      var v = read(text), g = groups(), out = [];
      for (var i = 0; i < g.length; i++) {
        var hit = g[i].rules.some(function (r) { return r.test(v); });
        var vals = [];
        g[i].rules.forEach(function (r) {
          r.steps(v).forEach(function (x) {
            if (!vals.some(function (y) { return y[0] === x[0]; })) vals.push(x);
          });
        });
        out.push({
          look: g[i].look.slice(),
          values: vals.map(function (x) { return { name: x[0], value: String(x[1]) }; }),
          hit: hit,
          verdict: g[i].verdict,
          why: hit ? g[i].why : g[i].rules[0].no(v),
          next: i + 1 < g.length ? g[i + 1].look.join(" と ") : null,
          nextVerdict: i + 1 < g.length ? g[i + 1].verdict : null,
          step: i + 1, of: g.length
        });
        if (hit) break;
      }
      return out;
    }

    function gloss(v) { return GLOSS[v] || ""; }

    /* ブロックの中の「見る所」。上から順に練習すると、そのまま読む順番になる */
    function blocks() {
      return groups().map(function (x, i) {
        return {
          no: i + 1,
          name: x.look.join(" と "),
          look: x.look,
          verdict: x.verdict,
          why: x.why,
          cond: x.rules.map(function (r) { return r.cond; }),
          spots: SPOTS.filter(function (s) { return x.look.indexOf(s.name) >= 0; }),
          keys: x.rules.map(function (r) { return r.key; })
        };
      });
    }

    /* ねらったルールになる出力だけを返す。ならなければ作り直す */
    function make(key) {
      if (!MAKERS[key] || !spec.build || !spec.baseVals) return null;
      for (var i = 0; i < 40; i++) {
        var text = spec.build(MAKERS[key](spec.baseVals()));
        var r = judge(read(text));
        if (r && r.key === key) return text;
      }
      return null;
    }
    function makeAny() {
      var keys = Object.keys(MAKERS);
      if (!keys.length) return { key: null, text: null };
      var k = pick(keys);
      return { key: k, text: make(k) };
    }

    /* i 番目の見る所まで進む出力を作る。
       hit=true … そこで答えが決まる／hit=false … 決まらず次へ進む */
    function reach(i, hit) {
      var bs = blocks(), pool = [];
      if (!bs[i]) return null;
      if (hit) {
        pool = bs[i].keys.filter(function (k) { return MAKERS[k]; });
      } else {
        for (var j = i + 1; j < bs.length; j++) {
          bs[j].keys.forEach(function (k) { if (MAKERS[k]) pool.push(k); });
        }
      }
      if (!pool.length) return null;
      for (var t = 0; t < 60; t++) {
        var text = make(pick(pool));
        if (!text) continue;
        var path = walk(text);
        if (path.length <= i) continue;
        if (path[i].hit === hit) return { text: text, step: path[i], path: path };
      }
      return null;
    }

    /* 決め手の行だけを抜き出す（1行目は必ず残す） */
    function excerpt(text, look) {
      var lines = text.split("\n"), out = [lines[0]];
      for (var i = 1; i < lines.length; i++) {
        for (var j = 0; j < look.length; j++) {
          if (lines[i].indexOf(look[j]) >= 0) { out.push(lines[i]); break; }
        }
      }
      return out.join("\n");
    }

    return {
      id: spec.id, kind: spec.kind || "rules", spec: spec,
      SPOTS: SPOTS, RULES: RULES, VERDICTS: VERDICTS, MAKERS: MAKERS,
      read: read, judge: judge, trace: trace, walk: walk, groups: groups,
      blocks: blocks, reach: reach, gloss: gloss, make: make, makeAny: makeAny,
      excerpt: excerpt,
      sample: spec.sample || function () { return ""; },
      shuffle: shuffle, pick: pick
    };
  }

  var API = { makeEngine: makeEngine, R: R, pick: pick, shuffle: shuffle, n: n };
  global.ENGINE = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
