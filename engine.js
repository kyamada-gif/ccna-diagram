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
     * 決め方が1つしかない分野は、答えの顔ぶれも1つになる。
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

    /* 選ぶものが4つに満たないとき、本の誤答で埋める。
       **本のテストは4択**なので、練習も4つにそろえる。
       前は3つで止めていたので、ログの練習だけ3択になっていた */
    function padOpts(opts, right) {
      if (opts.length >= 4) return opts;
      var seen = {};
      opts.forEach(function (o) { seen[o] = 1; });
      spareWrongs().forEach(function (w) {
        if (opts.length >= 4 || seen[w] || w === right) return;
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
    function makeAny(chooser) {
      var keys = Object.keys(MAKERS);
      if (!keys.length) return { key: null, text: null };
      var k = (chooser || pick)(keys);
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
                                  judge: judge, VERDICTS: VERDICTS,
                                  make: make, gloss: gloss, pat: PAT,
                                  figFor: spec.figFor });
      }
      /* **最後の確認項目には「決まらない出力」が無い。**
         そこまで来たら必ず決まるので、次へ進む出力が作れず、2問目が空になっていた。
         そのときは、決まる問題をもう1問（別の出力で）作る */
      var r = reach(i, n === 0);
      if (!r && n > 0) r = reach(i, true);
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
        /* 「◯◯だけでは決められない」に入れる名前。
           **look をそのままつなぐと、選択肢として長すぎることがある。**
           「txload と rxload と input errors と CRC だけでは決められない」など。
           分野が短い名前（spec.short）を持っていれば、そちらを使う */
        var bsi = blocks()[i];
        var shortName = (spec.short && bsi) ? spec.short[bsi.keys[0]] : null;
        var look = shortName ||
          ((st.look && st.look.length) ? st.look.join(" と ") : "この値");
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

    /* 最後の3問で、**同じパターンを2度出さない。**
       身に付けたい力は「どのパターンかを見分けること」なので、
       同じものが2回出ると練習にならない（ルールが4本の分野では
       4分の3の回で重なっていた）。1問目（n===0）で数え直す */
    var wholeUsed = [];
    function pickKey(keys) {
      var left = keys.filter(function (k) { return wholeUsed.indexOf(k) < 0; });
      return pick(left.length ? left : keys);
    }
    /* **問題が作れたときだけ「使った」に数える。**
       作れずにやり直した分まで数えると、選べるパターンが早く尽きて、
       3問目で同じものが出てしまう */
    function markUsed(k) { if (k && wholeUsed.indexOf(k) < 0) wholeUsed.push(k); }

    function wholeQ(n) {
      if (!n) wholeUsed = [];
      /* **分野が自分で作れるなら、そちらを先に使う。**
         n は何問目か（0・1・2）。null を返してきたら、下の共通の形にする。
         OSPF の隣接関係は、2問目と3問目を「打つコマンドの並び」で出す */
      if (typeof spec.wholeQ === "function") {
        var own = spec.wholeQ(n, { read: read, judge: judge, shuffle: shuffle,
                                   blocks: blocks, VERDICTS: VERDICTS,
                                   pickKey: pickKey, markUsed: markUsed });
        if (own) return own;
      }
      var g = makeAny(pickKey);
      if (!g.text) return null;
      markUsed(g.key);
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
        /* **見ている所を丸ごとふくむ答えは、誤答にしない。**
           「Hello だけ違う」出力に「Hello と Dead の両方をそろえる」を並べると、
           そちらでも直ってしまい、正解が2つになる。
           練習の1問ずつ（stepQ）では外していたのに、ここでは外していなかった。
           見る所どうしにこの関係が無い分野では、何も起きない */
        var pool = [];
        RULES.forEach(function (x) {
          if (x.verdict === r.verdict || pool.indexOf(x.verdict) >= 0) return;
          if ((r.look || []).every(function (w) {
            return (x.look || []).indexOf(w) >= 0;
          })) return;
          pool.push(x.verdict);
        });
        opts = shuffle(padOpts([right].concat(shuffle(pool).slice(0, 3)), right));
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

    /* ── 決め手が出力の中にあるルールだけ、見本の現物を出す ────────
     * **問題文の中にある決め手には、見本を出さない。**
     * 説明の1枚の「もし」の行に、その言葉がもう大きく出ているので、
     * 見本を足すと同じものを2度見せることになる（実測で 33 ルールがこれ）。
     * 出力の中にある決め手（Administrative Mode: static access を
     * 長い出力から探す、など）は、現物を1度見せる値打ちがある（13 ルール）。
     *
     * **値は毎回作る。**showint の見本は決め打ちだが、あれは光らせる言葉を
     * 手で書いた表と対にしていたため。ここは光らせる言葉を
     * その本文から取り出すので、値が変わってもずれない。
     */
    if (spec.learnOut && spec.learnOut.length && !spec.learnEx) {
      var LSAMPLE = {};
      var lineOf = function (k) {
        if (!(k in LSAMPLE)) LSAMPLE[k] = make(k) || null;
        return LSAMPLE[k];
      };
      spec.learnEx = function (block) {
        var k = block && block.keys && block.keys[0];
        if (!k || spec.learnOut.indexOf(k) < 0) return null;
        return lineOf(k);
      };
      /* 見本の中で光らせる言葉。**その見本から取り出す**ので、必ず本文にある */
      spec.hits = function () { return []; };
      spec.marks = function (name) {
        var out = [];
        RULES.forEach(function (r) {
          if ((r.look || []).indexOf(name) < 0) return;
          if (spec.learnOut.indexOf(r.key) < 0) return;
          var t = lineOf(r.key);
          if (!t) return;
          var v = read(t);
          (r.mark || []).forEach(function (w) {
            if (t.indexOf(w) >= 0 && out.indexOf(w) < 0) out.push(w);
          });
          (r.steps ? r.steps(v) : []).forEach(function (x) {
            var w = String(x[1] == null ? "" : x[1]).trim();
            if (!w || w === "-" || w.length > 24) return;
            if (t.indexOf(w) < 0 || out.indexOf(w) >= 0) return;
            out.push(w);
          });
        });
        return out;
      };
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

  /* ── 決め手が問題文にある題材の、練習の1問 ────────────────
   * **札1 の「上から順に絞る」やり方を、そのまま使ってはいけない。**
   * こちらは絞り込みではないので、「この項目では決まらない提示物」という考えが無い。
   * ところが前は、共通の stepQ が2問目にそれを作っていた。その結果、
   * 問1で「問題文の中の決め手を探せ」と教えた直後に、
   * **問題文を読むと別の答えに見える提示物**で解かせていた（8分野の 83%）。
   *
   *   問1 … その確認項目の提示物を出し、答えを決めている言葉を選ばせる
   *   問2 … 同じ確認項目の提示物（値は作り直す）を出し、打つ設定を選ばせる
   *
   * **ルールは key で引く。**前は答え（verdict）で引いていたので、
   * 答えが同じルールが2本あると、別のルールの決め手が正解になっていた
   * （EtherChannel の vendor と peer、トランクの access2trunk と totrunk）。
   *
   * 誤答は、ほかのルールの決め手・答えから採る。**こちらで文を作らない。**
   *
   * ask2 … 問2の聞き方。渡さなければ「この要件を満たす設定はどれですか。」
   */
  function cueStepQ(rules, ask2) {
    return function (i, n, ctx) {
      var bs = ctx.blocks(), b = bs[i];
      if (!b || !b.keys || !b.keys.length) return null;
      var key = b.keys[0];
      var me = null, k;
      for (k = 0; k < rules.length; k++) if (rules[k].key === key) me = rules[k];
      if (!me) return null;
      var text = ctx.make(key);
      if (!text) return null;

      var opts = [], right, ask, why, look, hit = true, markNow = false;
      /* ── 答え合わせのあとに光らせる言葉 ─────────────
       * **表を手で書かない。**手で書くと、提示物に無い言葉を書いてしまい、
       * どこも光らないうえに、書き間違いにも気づけない。
       * 判定ルールが「何を見て決めたか」を出す steps() の値を使う。
       * これは実際に読み取れた文字なので、**提示物に必ずある。**
       * 長すぎるもの（問題文まるごとなど）は、光らせても意味が無いので外す */
      var vv = ctx.read(text);
      var q1 = String(text).split(/\n\s*\n/)[0];
      var mark = [];
      /* ルールが自分で書いている言葉があれば、そちらを先に使う。
         steps() の値が長すぎて光らせられない所（問題文まるごとなど）のため。
         **書いた言葉が提示物に無ければ、下の突き合わせで落ちる**ので、
         書き間違えたまま気づかない、ということにはならない
         （`node build.js` も、全ルールぶん確かめている） */
      (me.mark || []).forEach(function (w) {
        if (String(text).indexOf(w) >= 0 && mark.indexOf(w) < 0) mark.push(w);
      });
      (me.steps ? me.steps(vv) : []).forEach(function (x) {
        var w = String(x[1] == null ? "" : x[1]).trim();
        /* 24字より長いものと、問題文まるごとは光らせない。
           1行ぜんぶが光ると、どこを見ればいいのかが逆に伝わらない */
        if (!w || w === "-" || w.length > 24) return;
        if (w === q1.trim()) return;
        if (String(text).indexOf(w) < 0) return;
        if (mark.indexOf(w) < 0) mark.push(w);
      });
      if (n === 0 && me.say) {
        /* ── 問1（本物の問い）──────────────────────
         * **その分野が本当に聞いていることを、そのまま問う。**
         * 「どれが決め手ですか」「光っている所を見てどう判断しますか」は、
         * どちらも画面の説明であって、設問として成り立っていない。
         * show interface と同じで、決め手の所を光らせたうえで、
         * **毎回おなじ本物の問いを出す。**変わるのは提示物のほう。
         * 判断の道すじは、答え合わせで「こう判断する → だから、こうする」と出す */
        right = me.verdict;
        opts = [right];
        ctx.shuffle(rules.filter(function (r) {
          return r.verdict !== me.verdict;
        })).forEach(function (r) {
          if (opts.length < 4 && opts.indexOf(r.verdict) < 0) opts.push(r.verdict);
        });
        ask = ask2 || "この要件を満たす設定はどれですか。";
        look = [];
        why = null;
        hit = false;
        markNow = true;
      } else if (n === 0) {
        /* 問1（いままでの形）。**決め手は、問題文にあることも、出力の中にあることもある。**
           だから「問題文の中に」とは言い切らない */
        if (!me.cue) return null;
        right = me.cue;
        opts = [right];
        /* **誤答の決め手が、この問題文にも当てはまってはいけない。**
           暗号化を聞く問題文には「事前共有キー」が入るので、
           「RADIUS サーバの代わりに事前共有キー」を誤答に並べると、
           それも当てはまって見え、正解が2つになる。
           読み取りの目印（pat）が問題文の段に当たる決め手は、誤答にしない */
        var head = String(text).split(/\n\s*\n/)[0];
        ctx.shuffle(rules.filter(function (r) {
          if (!r.cue || r.cue === me.cue) return false;
          var p = ctx.pat && ctx.pat[r.key];
          return !(p && p.test(head));
        })).forEach(function (r) { if (opts.length < 4) opts.push(r.cue); });
        ask = "この問題で、答えを決めているのはどれですか。";
        /* 答えの行を先に光らせない（答えが見えてしまう） */
        look = [];
        why = "「" + me.cue + "」が決め手";
        /* **問1では、まだ答え（打つ設定）は決まっていない。**
           hit を true にしておくと、画面が「その確認項目の答えの一言説明」を
           答え合わせに出してしまい、**問2の答えを先に教えることになる**
           （8分野の確認項目 43 か所すべてで起きていた）。
           false にすると、その行が空になる。
           `node build.js` の「決まらない問題の答え合わせに先の答えが出ていないか」も、
           これで問1を見るようになる */
        hit = false;
      } else {
        right = me.verdict;
        opts = [right];
        ctx.shuffle(rules.filter(function (r) {
          return r.verdict !== me.verdict;
        })).forEach(function (r) {
          if (opts.length < 4 && opts.indexOf(r.verdict) < 0) opts.push(r.verdict);
        });
        /* 問2。**決め手を文字で教えない。**提示物の中で光っているので、
           そこを見れば分かる。文で言うと、見る練習にならない。
           say を持たない分野は、いままでどおり前置きを付ける */
        ask = (me.say ? "" : (me.cue ? "決め手は「" + me.cue + "」です。" : "")) +
              (ask2 || "この要件を満たす設定はどれですか。");
        markNow = !!me.say;
        look = (b.look || []).slice();
        /* 決め手は問いにもう書いてある。**判定ルールの理由をそのまま出さない。**
           答えの一言説明（gloss）だけが、答えの下に出ればよい */
        why = ctx.gloss(me.verdict);
      }
      var seen = {}, uq = [];
      opts.forEach(function (o) { if (o && !seen[o]) { seen[o] = 1; uq.push(o); } });
      return {
        kind: "step", ask: ask, exhibit: text,
        opts: ctx.shuffle(uq), right: right,
        /* key も渡す。**答え（verdict）でルールを引かない。**
           答えが同じルールが2本ある分野で、別のルールを引いてしまう */
        /* 分野が「提示物から図を組み立てる」やり方を持っていれば、図も添える */
        fig: (typeof ctx.figFor === "function") ? ctx.figFor(text) : null,
        extra: { i: i, step: { look: look, values: [], hit: hit, key: key,
                               mark: mark.length ? mark : null, markNow: markNow,
                               verdict: me.verdict, cue: me.cue,
                               why: why, next: null, nextVerdict: null,
                               step: i + 1, of: bs.length } }
      };
    };
  }

  /* ── 決め手型の分野の、出題パターン ────────────────────
   * パターン＝**どのルールで答えにたどり着くか。**答えでまとめない。
   * 絞ったせいでパターンが1つでも消えていないかを、build.js が毎回確かめる。
   */
  function cuePattern(q, G) {
    if (!G || !G.read || !G.judge) return null;
    var ex = q.fig || q.exhibit || "";
    var r = G.judge(G.read({ text: q.text, exhibit: ex }));
    return r ? r.key : null;
  }

  /* ── 決め手型の分野の、短い説明の1枚 ──────────────────
   * **文字は読まれない。**見たらすぐ「こう来たら、こう答える」と分かる形だけを残す。
   *   もし … その問題で答えを決めている言葉（＝練習の問1の答えと同じ言葉）
   *   なら … 打つ設定
   *   一言 … 取り違えやすい所だけ（note の表を分野ごとに渡す）
   * 覚えた行が、そのまま問1の答えになるように、もし の側は cue と同じ言葉にする。
   */
  function cueBrief(rules, note) {
    function ruleOf(k) {
      for (var i = 0; i < rules.length; i++) if (rules[i].key === k) return rules[i];
      return null;
    }
    return function (block) {
      var out = [];
      ((block && block.keys) || []).forEach(function (k) {
        var r = ruleOf(k);
        if (!r || !r.cue) return;
        out.push({ if: r.cue, then: r.verdict, note: (note && note[k]) || null });
      });
      return out.length ? out : null;
    };
  }

  /* ── 決め手型の分野の、答え合わせ ────────────────────
   * **同じことを2回書かない。**決め手は問いに、答えは見出しに、もう書いてある。
   *
   *   問1（決め手を選ぶ）… null を返す。画面は「「◯◯」が決め手」だけを出す
   *   問2（設定を選ぶ）  … 答えの一言説明だけ。
   *                        前は判定ルールの理由と一言説明が同じ文で、2行並んでいた（43か所中32か所）
   *   テスト・練習の最後 … 決め手と、答えの一言説明
   *
   * body(v, rule) を渡すと、この問題の値を1行足せる（渡さなくてよい）。
   * **ルールは key で引く。**答えが同じルールが2本ある分野で取り違えるため。
   */
  function cueAnswerNote(rules, gloss, body) {
    function ruleOf(k) {
      for (var i = 0; i < rules.length; i++) if (rules[i].key === k) return rules[i];
      return null;
    }
    return function (v, st) {
      if (!v) return null;
      if (st) {
        if (!st.look || !st.look.length) {
          /* 問1。**判断を選んだあとに、そこから何をするかまで見せる。**
             覚える札（もし→なら）で先に教えている中身なので、先漏れにはならない。
             say を持たない分野は、いままでどおり「「◯◯」が決め手」だけ */
          var m0 = ruleOf(st.key);
          if (!m0 || !m0.say) return null;
          /* **答えは見出しにもう出ている。**ここに verdict を並べると2回読ませる。
             出すのは「なぜそう判断したか」だけ */
          return { gloss: m0.say, body: "" };
        }
        var me = ruleOf(st.key);
        if (!me) return null;
        return { gloss: gloss[me.verdict] || "",
                 body: (body && body(v, me)) || "" };
      }
      /* 提示物ぜんぶを見て答える問題（テストの本の問題・練習の最後の3問）。
         **「どこを見て、だからどうするか」を上下に並べる。**
         1行の文にすると、決め手と打つ設定が続き字になって目で追いにくい */
      var hit = null, i;
      for (i = 0; i < rules.length; i++) if (rules[i].test(v)) { hit = rules[i]; break; }
      if (!hit) return null;
      var rows = [];
      if (hit.cue) rows.push({ h: "この問題の決め手" }, { t: hit.cue });
      rows.push({ h: "だから、こうする" }, { t: hit.verdict });
      var one = (body && body(v, hit)) || gloss[hit.verdict] || "";
      if (one) rows.push({ t: one });
      return { gloss: "", body: { rows: rows } };
    };
  }

  var API = { makeEngine: makeEngine, makeMatchEngine: makeMatchEngine, cueStepQ: cueStepQ,
              cueAnswerNote: cueAnswerNote, cueBrief: cueBrief, cuePattern: cuePattern, R: R, pick: pick, shuffle: shuffle, n: n };
  global.ENGINE = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
