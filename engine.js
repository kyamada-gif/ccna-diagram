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

    /* ── 誤答が足りないときの借り先 ──────────────
     * 決め方が1つしかない分野（ログの読み取りなど）は、答えの顔ぶれも1つになる。
     * そのままだと選択肢が1個しか出ず、問題にならない。
     * **そこで、同じ分野の本の問題が出している「正解でない選択肢」を借りる。**
     * こちらで誤答を考え出さない。借りるのは本の言葉だけ。
     * （借りるのは選択肢の文だけで、問題文や提示物は借りない。
     *   練習に本の問題そのものを出さない、という決まりは崩れない）
     */
    function spareWrongs() {
      var spare = [];
      var bank = (global.BANKS || {})[spec.id];
      if (!bank) return spare;
      /* この分野で「正解」になっている文は、誤答にできない */
      var right = {};
      bank.forEach(function (q) {
        [].concat(q.answer || []).forEach(function (a) { right[a] = 1; });
      });
      /* 判定の答えと同じ意味の言い換え（SAME）も、誤答にできない */
      var same = spec.same || {};
      Object.keys(same).forEach(function (k) {
        right[k] = 1;
        same[k].forEach(function (x) { right[x] = 1; });
      });
      var plain = [], polite = [];
      bank.forEach(function (q) {
        (q.choices || []).forEach(function (c) {
          if (right[c]) return;
          if (plain.indexOf(c) >= 0 || polite.indexOf(c) >= 0) return;
          /* **言い回しをそろえる。**本によって「〜する」と「〜します。」が混じっている。
             混ぜたまま並べると、言い回しの違いだけで正解が当てられてしまう。
             ふだん形（句点で終わらない）を先に使う */
          (/[。]$/.test(c) ? polite : plain).push(c);
        });
      });
      spare = shuffle(plain).concat(shuffle(polite));
      return spare;
    }

    /* 選ぶものが3つに満たないとき、本の誤答で埋める */
    function padOpts(opts, right) {
      if (opts.length >= 3) return opts;
      var seen = {};
      opts.forEach(function (o) { seen[o] = 1; });
      spareWrongs().forEach(function (w) {
        if (opts.length >= 3 || seen[w] || w === right) return;
        seen[w] = 1; opts.push(w);
      });
      return opts;
    }

    /* 提示物から値を読む。
       ふつうはテキストを正規表現で読む。**図の問題は形が違う**ので、
       その題材が自分の読み方（spec.read）を持っていればそちらを使う */
    function read(ex) {
      if (spec.read) return spec.read(ex);
      var out = {};
      Object.keys(PAT).forEach(function (k) {
        var m = ex.match(PAT[k]);
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

    /* 決め手の所だけを残す。テキストなら「決め手の行だけ」。
       図の問題は形が違うので、その題材の やり方（spec.excerpt）を使う */
    function excerpt(text, look) {
      if (spec.excerpt) return spec.excerpt(text, look);
      var lines = text.split("\n"), out = [lines[0]];
      for (var i = 1; i < lines.length; i++) {
        for (var j = 0; j < look.length; j++) {
          if (lines[i].indexOf(look[j]) >= 0) { out.push(lines[i]); break; }
        }
      }
      return out.join("\n");
    }

    /* ── 練習の1問を組み立てる ─────────────────────
     * **画面側では組み立てない。**ここで作って、画面はあるものを出すだけ。
     *   stepQ(i, n)  … i 番目の見る所の問題。n は 0／1（2問作る）
     *   wholeQ()     … 最後の「提示物ぜんぶで判定」
     * どちらも作れなければ null。
     */
    function stepQ(i, n) {
      /* **分野が自分で問題を組み立てられるようにする。**
         上から順に見ていく題材（show interface）は下の共通の形でよいが、
         聞かれ方が問題文で決まる題材（JSON）は形が違う。
         stepQ を持たない分野は、いままでどおり下の共通の形になる */
      if (typeof spec.stepQ === "function") {
        return spec.stepQ(i, n, { blocks: blocks, read: read, shuffle: shuffle,
                                  judge: judge, VERDICTS: VERDICTS });
      }
      var r = reach(i, n === 0);
      if (!r) return null;
      var st = r.step, ask, opts, right;
      if (spec.walk) {
        var w = spec.walk(st, read(r.text), shuffle, n);
        ask = w.ask; opts = w.opts; right = w.right;
        /* 答え合わせに出す文も、問いを作る側が決められるようにする。
           **判定ルールの理由（why）は長い。**答えるのに要らない話まで並ぶので、
           判断のもとになった所だけを短く差し替える */
        /* null なら、その分野が持っている一言の説明を出す */
        if (w.why !== undefined) {
          st.why = (w.why === null) ? gloss(st.verdict) : w.why;
        }
      } else {
        /* 上から順に確認していく題材の、共通の聞き方。
         * **問いは、その分野が最後に答えるべき本物の問い。**
         * 「ここで決まりますか」のようなメタな聞き方はしない。
         * 何を目指しているのか分からないまま、進み方だけ聞かれても答えられない。
         *
         * 代わりに、**選択肢に「◯◯だけでは決められない」を混ぜる。**
         * その選択肢が、次の確認項目へ進む思考をそのまま教える。
         *
         *   ルートブリッジになるのはどれですか。
         *     SW1 ／ SW2 ／ SW3 ／ 優先度だけでは決められない
         *
         * 説明の1枚で「優先度が最も小さい1台が答え」と学ぶ
         *   → それを使う問題を解く
         *   → 決まらない図に当たって「優先度だけでは決められない」を選ぶ
         *   → 次の確認項目（MACアドレス）を学ぶ
         * この順で「まず優先度、次に MAC」という思考が積み上がる。
         */
        var look = (st.look && st.look.length) ? st.look.join(" と ") : "この値";
        var undecided = look + " だけでは決められない";
        right = st.hit ? st.verdict : undecided;
        opts = [right];
        /* **次の確認項目があるときだけ**「決められない」を誤答に混ぜる。
           最後の確認項目でこれを出すと、正しくない選び方を教えてしまう */
        if (st.hit && st.next) opts.push(undecided);
        /* **決まらない問題では、最後まで見たときの答えを誤答に入れない。**
           提示物には後の決め手も写っているので、その答えを並べると
           「決められない」と「最後まで見た答え」の2つが正解になってしまう */
        var full = st.hit ? null : (judge(read(r.text)) || {}).verdict;
        shuffle(VERDICTS.filter(function (v) {
          return v !== st.verdict && v !== full;
        })).forEach(function (v) { if (opts.length < 4) opts.push(v); });
        /* 決め方が1つしかない分野は、ここで選択肢が足りなくなる。
           そのときだけ、本の誤答を借りて足す */
        spareWrongs().forEach(function (w) {
          if (opts.length >= 4) return;
          opts.push(w);
        });
        var seen1 = {}, uq = [];
        opts.forEach(function (o) { if (!seen1[o]) { seen1[o] = 1; uq.push(o); } });
        opts = shuffle(uq.slice(0, 4));
        ask = spec.ask || "この出力で起きていることはどれですか。";
      }
      return { kind: "step", ask: ask, exhibit: r.text,
               opts: opts, right: right, extra: { step: st, i: i } };
    }

    function wholeQ() {
      var g = makeAny();
      if (!g.text) return null;
      var r = RULES.filter(function (x) { return x.key === g.key; })[0];
      var opts, right;
      /* 答えが「その場の選択肢」になる題材（ルートブリッジなど）は、
         誤答も同じ提示物の中の別のものから作る */
      if (spec.answer) {
        var v = read(g.text);
        right = spec.answer(v);
        opts = shuffle(v.sw.map(function (x) { return x.id; }));
      } else {
        right = r.verdict;
        opts = shuffle(padOpts([r.verdict].concat(
          shuffle(VERDICTS.filter(function (v) { return v !== r.verdict; })).slice(0, 3)), right));
      }
      /* 聞き方は分野ごとに1つ。ただし**同じ分野の中で聞かれ方が変わる題材**
         （JSON の「何を表すか」と「何が足りないか」）は、
         spec.ask を関数にして、読み取った値から聞き方を選べるようにしてある */
      var askText = typeof spec.ask === "function"
        ? spec.ask(read(g.text))
        : (spec.ask || "この出力で起きていることはどれですか。");
      return { kind: "whole", ask: askText,
               exhibit: g.text, opts: opts, right: right, extra: {} };
    }

    return {
      id: spec.id, kind: spec.kind || "rules", spec: spec,
      /* 練習の始めに1回だけ呼ばれる。**同じ提示物を練習の間ずっと使う分野**が、
         ここで1つ作って持っておく。持たない分野では何も起きない */
      begin: typeof spec.begin === "function" ? spec.begin : null,
      stepQ: stepQ, wholeQ: wholeQ,
      SPOTS: SPOTS, RULES: RULES, VERDICTS: VERDICTS, MAKERS: MAKERS,
      read: read, judge: judge, trace: trace, walk: walk, groups: groups,
      blocks: blocks, reach: reach, gloss: gloss, make: make, makeAny: makeAny,
      excerpt: excerpt,
      /* 答えが決まった言葉ではなく「その場の選択肢の1つ」になる題材で使う。
         例：ルートブリッジは毎回ちがうスイッチ名が答えになる */
      answer: spec.answer || null,
      view: spec.view || "console",
      sample: spec.sample || function () { return ""; },
      shuffle: shuffle, pick: pick
    };
  }

  /* ══════════════════════════════════════════════════
   * 対応づけ（言葉と説明を結ぶ）ブロックのエンジン。
   *
   * 上の makeEngine は「見る所を順に見て、規則で答えを出す」題材のもの。
   * こちらは規則ではなく**覚える**題材。作りは同じ形にそろえてあるので、
   * 画面側（app.jsx）は2つを見分けなくてよい。
   *
   *   blocks()      見る所。入れ先ひとつ、または本の1問がもつ話題ひとつ
   *   stepQ(i, n)   その見る所の問題。説明を1つ見せて、入れ先を選ばせる
   *   wholeQ()      最後の問題。対の一覧から**毎回ちがう組み合わせ**を作って結ばせる
   *
   * 中身はすべて本の対から作る。**説明も入れ先も、こちらでは書かない。**
   * ただし組み合わせは毎回作るので、本には無い1問になる（＝生成問題）。
   * ══════════════════════════════════════════════════ */
  function makeMatchEngine(spec) {
    var bank = spec.bank || [];
    /* 言い換え表（q/synonym.js）。**テストの選択肢は本の言葉のまま**なので、
       同じものを指す言い方が2通り出てくる。練習では1つにまとめる。
       まとめないと、見る所が同じ意味で2つに割れ、誤答に「同じ意味の別の言い方」が
       混ざって、答えが2つある問題になってしまう */
    var SYN = spec.synonym ||
      (typeof global.SYNONYM !== "undefined" ? global.SYNONYM : {});
    /* 言い換え表に無くても、**空白や中黒だけが違う書き方**はそろえる。
       例「グローバル ユニキャスト アドレス」と「グローバルユニキャストアドレス」。
       いちばん多く出てくる書き方を代表にする */
    var FLAT = (function () {
      var cnt = {};
      bank.forEach(function (q) {
        (q.pairs || []).forEach(function (p) {
          var t = SYN[p.r] || p.r;
          var k = String(t).replace(/[\s・‐-‒–—ー]/g, "").toLowerCase();
          (cnt[k] = cnt[k] || {})[t] = (cnt[k][t] || 0) + 1;
        });
      });
      var rep = {};
      Object.keys(cnt).forEach(function (k) {
        var best = null, n = -1;
        Object.keys(cnt[k]).forEach(function (t) {
          if (cnt[k][t] > n) { n = cnt[k][t]; best = t; }
        });
        rep[k] = best;
      });
      return rep;
    })();
    function same(t) {
      var v = SYN[t] || t;
      var k = String(v).replace(/[\s・‐-‒–—ー]/g, "").toLowerCase();
      return FLAT[k] || v;
    }
    /* 対の一覧。
       **ほとんど同じ説明は1つにまとめる。**本ごとに言い回しが少しずつ違うので、
       まとめないと「覚える1枚」に似た文が何行も並んで読めなくなる。
       まとめ方は、句読点と空白を落として同じになるものを1つとみなし、
       いちばん多く出てくる言い方を代表にする。入れ先が食い違うときは多いほうを採る */
    function flat(t) {
      return String(t).replace(/[\s、。，．・「」『』（）()"'']/g, "").toLowerCase();
    }
    var pairs = (function () {
      var box = {};
      bank.forEach(function (q) {
        (q.pairs || []).forEach(function (p) {
          var k = flat(p.l);
          var b = box[k] || (box[k] = { words: {}, rs: {}, from: q.qid,
                                        targets: (q.targets || []).map(same) });
          b.words[p.l] = (b.words[p.l] || 0) + 1;
          var r = same(p.r);
          b.rs[r] = (b.rs[r] || 0) + 1;
        });
      });
      function top(o) {
        var best = null, n = -1;
        Object.keys(o).forEach(function (k) { if (o[k] > n) { n = o[k]; best = k; } });
        return best;
      }
      return Object.keys(box).map(function (k) {
        var b = box[k];
        return { l: top(b.words), r: top(b.rs), from: b.from, targets: b.targets };
      });
    })();
    var targets = [];
    pairs.forEach(function (p) { if (targets.indexOf(p.r) < 0) targets.push(p.r); });

    /* 見る所の決め方。
       入れ先が少ないブロック（ケーブルなど）は**入れ先ひとつ＝見る所ひとつ**。
       入れ先が多いブロック（部品と役割など）は、入れ先を並べると数が多すぎるので
       **本の1問がもつ「入れ先の組」＝1つの話題**を見る所にする */
    var byTarget = targets.length <= (spec.maxTargets || 9);

    var GROUPS = (function () {
      var out = [];
      if (byTarget) {
        targets.forEach(function (t) {
          out.push({ name: t, targets: [t],
                     pairs: pairs.filter(function (p) { return p.r === t; }) });
        });
        return out;
      }
      var mark = {};
      bank.forEach(function (q) {
        var ts = [];
        (q.targets || []).forEach(function (t) {
          if (ts.indexOf(same(t)) < 0) ts.push(same(t));
        });
        if (!ts.length) return;
        var key = ts.slice().sort().join(" / ");
        if (mark[key]) {                       /* 同じ入れ先の組は1つの話題にまとめる */
          var g = mark[key];
          (q.pairs || []).forEach(function (p) {
            if (!g.pairs.some(function (x) { return x.l === p.l && x.r === p.r; }))
              g.pairs.push({ l: p.l, r: p.r, from: q.qid, targets: ts });
          });
          return;
        }
        var g2 = { name: ts.join(" と "), targets: ts,
                   pairs: (q.pairs || []).map(function (p) {
                     return { l: p.l, r: p.r, from: q.qid, targets: ts };
                   }) };
        mark[key] = g2;
        out.push(g2);
      });
      return out;
    })();

    function blocks() {
      return GROUPS.map(function (g, i) {
        return {
          no: i + 1, name: g.name, look: [], verdict: g.name,
          cond: [], keys: [],
          targets: g.targets,
          /* 覚える1枚に出すもの。**本の対をそのまま並べる。**
             こちらで説明文を書かない（書くと、それは生成した中身になる） */
          learn: g.pairs.map(function (p) { return { l: p.l, r: p.r }; }),
          spots: []
        };
      });
    }

    /* 誤答は、同じ見る所の中のほかの入れ先から借りる。
       足りなければ、同じブロックのほかの入れ先から借りる */
    function wrongs(g, right, k) {
      var pool = g.targets.filter(function (t) { return t !== right; });
      var more = shuffle(targets.filter(function (t) {
        return t !== right && pool.indexOf(t) < 0;
      }));
      return shuffle(pool).concat(more).slice(0, k);
    }

    function stepQ(i, n) {
      var g = GROUPS[i];
      if (!g || !g.pairs.length || targets.length < 2) return null;
      var p = g.pairs[(n + Math.floor(Math.random() * g.pairs.length)) % g.pairs.length];
      var opts = shuffle([p.r].concat(wrongs(g, p.r, 3)));
      var st = {
        look: [], hit: true, verdict: p.r, next: null,
        values: [{ name: "説明", value: p.l }],
        why: "この説明は「" + p.r + "」のもの。本の " + p.from + " に出ています。"
      };
      return { kind: "step", ask: "この説明は、どれにあてはまりますか。",
               exhibit: null, opts: opts, right: p.r,
               extra: { step: st, i: i } };
    }

    /* 最後の問題。**本には無い組み合わせを、その場で作る。**
       決まり3つ。
         ・同じ説明を2回入れない（本どうしで入れ先が食い違う説明があるため）
         ・入れ先は必ず2つ以上（1つだと問題にならない）
         ・組はいつも4つ（数がぶれると、練習の進み具合が回ごとに変わる）
    */
    function wholeQ() {
      /* 説明ひとつにつき入れ先を1つに決める。先に出てきたほうを採る */
      var uniq = [], byL = {};
      pairs.forEach(function (p) {
        if (byL[p.l]) return;
        byL[p.l] = 1; uniq.push(p);
      });
      if (uniq.length < 4 || targets.length < 2) return null;

      var pool = shuffle(uniq);
      var take = [pool[0]];
      /* 2つめは、1つめと入れ先がちがうものにする */
      var other = pool.filter(function (p) { return p.r !== take[0].r; })[0];
      if (!other) return null;
      take.push(other);
      for (var i = 0; i < pool.length && take.length < 4; i++) {
        var p = pool[i];
        if (take.some(function (x) { return x.l === p.l; })) continue;
        take.push(p);
      }
      if (take.length < 4) return null;
      take = shuffle(take);
      var ts = [];
      take.forEach(function (p) { if (ts.indexOf(p.r) < 0) ts.push(p.r); });
      return {
        kind: "match", ask: "左の説明を、右のどれにあてはめますか。",
        exhibit: null, opts: shuffle(ts),
        right: take.map(function (p) { return p.l + " → " + p.r; }),
        extra: { pairs: take.map(function (p) { return { l: p.l, r: p.r }; }),
                 targets: shuffle(ts) }
      };
    }

    return {
      id: spec.id, kind: "match", spec: spec,
      SPOTS: [], RULES: [], VERDICTS: targets, MAKERS: {},
      PAIRS: pairs, TARGETS: targets,
      blocks: blocks, stepQ: stepQ, wholeQ: wholeQ,
      read: function (x) { return x; },
      judge: function () { return null; },
      trace: function () { return null; },
      gloss: function () { return ""; },
      answer: null, view: "match",
      sample: function () { return ""; },
      shuffle: shuffle, pick: pick
    };
  }

  /* 設定を選ぶ題材の、共通の聞き方。
   *
   * この種類の問題は「上から順に絞り込む」形ではない。
   * 問題文の中の**決め手になる言葉**を見つけ、そこから打つコマンドが1つに決まる。
   * だから練習も2段にする。
   *
   *   1問目 … この問題文で、答えを決めているのはどれか（決め手を探す）
   *   2問目 … その決め手なら、何をするか（設定を選ぶ）
   *
   * 各ルールに cue（決め手を短く言った言葉）が要る。
   */
  /* 問題文が決め手になる分野の、2段の聞き方。
   * **どこを探すか → 何を答えるか**の順にたどらせる。
   *   1問目「この問題文の中に、答えを決める言葉があります。どれですか。」
   *   2問目 その分野の本物の問い（spec.ask）。決め手を示したうえで答えさせる
   *
   * ask2 … 2問目の聞き方。分野ごとに変えたいときに渡す
   *        （例 つながらない原因は「何をしますか」ではなく「原因はどれですか」）
   */
  function cueWalk(rules, ask2) {
    return function (step, v, sh, n) {
      var me = rules.filter(function (r) { return r.verdict === step.verdict; })[0]
        || rules[rules.length - 1];
      if (n === 0 && me.cue) {
        var opts = [me.cue];
        sh(rules.filter(function (r) { return r.cue && r.cue !== me.cue; }))
          .slice(0, 3).forEach(function (r) { opts.push(r.cue); });
        return { ask: "この問題文の中に、答えを決める言葉があります。どれですか。",
                 opts: sh(opts), right: me.cue,
                 why: "問題文の中の「" + me.cue + "」が決め手" };
      }
      var opts2 = [step.verdict];
      sh(rules.filter(function (r) { return r.verdict !== step.verdict; }))
        .slice(0, 3).forEach(function (r) { opts2.push(r.verdict); });
      var seen2 = {}, uq2 = [];
      opts2.forEach(function (o) { if (!seen2[o]) { seen2[o] = 1; uq2.push(o); } });
      var tail = ask2 || "この要件を満たす設定はどれですか。";
      /* 決め手は問いにもう書いてある。答えも上に出る。
         **ここに判定ルールの理由をそのまま出さない。**
         一言の説明（gloss）だけが、答えの下に出ればよい */
      return { ask: me.cue ? "決め手は「" + me.cue + "」です。" + tail : tail,
               opts: sh(uq2), right: step.verdict, why: null };
    };
  }

  var API = { makeEngine: makeEngine, makeMatchEngine: makeMatchEngine, cueWalk: cueWalk, R: R, pick: pick, shuffle: shuffle, n: n };
  global.ENGINE = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
