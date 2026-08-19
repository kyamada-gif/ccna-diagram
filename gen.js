/* show interface の読み取り：見る所・判定ルール・出力を作るところ。
 *
 * **計算と判定はここに置く。画面側（app.jsx）では判定しない。**
 * ipcalc2 の gen.js と同じ役目。
 *
 * 見る所13か所と判定ルール10本は、過去問35問とその解説から起こした。
 * 思いつきで足さない。出どころは out/full/checkpoints.md にある。
 */
(function (global) {
  "use strict";

  /* ── 見る所13か所 ─────────────────────────────
   * mean … その値が何か（一言）
   * use  … **その値を見たら、答えをどう決めるか。**ここが選択肢に直結する
   */
  var SPOTS = [
    { key: "line", name: "line protocol",
      re: /line protocol is (up|down)/,
      mean: "リンクが上がっているかどうか",
      use: "down ならリンクが切れている。up なら、つながってはいるので、下のエラーの数を見にいく" },
    { key: "duplex", name: "duplex",
      re: /(Half|Full)-duplex/,
      mean: "全二重か半二重か",
      use: "collisions とセットで見る。Full なのに collisions が出ていたら「デュプレックスの不一致」。Half でも collisions か CRC が出ていたら同じ" },
    { key: "speed", name: "speed",
      re: /100 Mb\/s/,
      mean: "リンクの速さ",
      use: "両側でそろっていないとリンクが上がらない。この型の問題では、答えを決める手がかりにはならない" },
    { key: "txload", name: "txload",
      re: /txload (\d+)\/255/,
      mean: "送信で帯域をどれだけ使っているか",
      use: "255 が満杯。1/255 は 255分の1で、ほとんど流れていない。rxload と両方 255/255 で、しかも input errors と CRC が 0 なら「高スループット」" },
    { key: "rxload", name: "rxload",
      re: /rxload (\d+)\/255/,
      mean: "受信で帯域をどれだけ使っているか",
      use: "255 が満杯。1/255 は 255分の1で、ほとんど流れていない。txload と両方 255/255 で、しかも input errors と CRC が 0 なら「高スループット」" },
    { key: "inq", name: "Input queue",
      re: /Input queue: (\d+)\//,
      mean: "入ってきて順番待ちしているパケットの数",
      use: "0 でなければ「キューイング（順番待ち）」。ほかのエラーより先にこれを見る" },
    { key: "drops", name: "Total output drops",
      re: /Total output drops: (\d+)/,
      mean: "出しきれずに捨てたパケットの数",
      use: "けた違いに多ければ「ポートのオーバーサブスクリプション」。運べる量を超えて来ている" },
    { key: "outq", name: "Output queue",
      re: /Output queue: (\d+)\//,
      mean: "出ていけずに順番待ちしているパケットの数",
      use: "0 でなければ「キューイング（順番待ち）」。出口が詰まっている" },
    { key: "bcast", name: "broadcasts",
      re: /Received (\d+) broadcasts/,
      mean: "受け取ったブロードキャストの数",
      use: "ほかが全部 0 のときだけ見る。ほかが 0 でこれだけ多ければ「ブロードキャストストーム」。時間とともに増えるので、単独では決め手にしない" },
    { key: "runts", name: "runts",
      re: /(\d+) runts/,
      mean: "64バイトに満たない、途中で切れたフレームの数",
      use: "0 でなければ、途中で切れたフレームが来ている。CRC も collisions も 0 なら「不良 NIC」。CRC が出ていたら「物理エラー」が先" },
    { key: "inerr", name: "input errors",
      re: /(\d+) input errors/,
      mean: "受信でしくじった数の合計",
      use: "合計なので、これ自体では決めない。すぐ右にある CRC を見る（同じ行）。input errors とほぼ同じ数が CRC なら「物理エラー（ケーブルか NIC）」。CRC が 0 なら別の所を見る" },
    { key: "crc", name: "CRC",
      re: /(\d+) CRC/,
      mean: "中身が壊れて届いたフレームの数",
      use: "0 でなければ中身が壊れて届いている。collisions が 0 なら「物理エラー（ケーブルか NIC）」。collisions も出ていたら「デュプレックスの不一致」" },
    { key: "coll", name: "collisions",
      re: /(\d+) collisions/,
      mean: "送ろうとしてぶつかった数",
      use: "0 でなければ、まず duplex を見る。Full-duplex なら衝突は起きないはずなので「デュプレックスの不一致」。Half でも出ていたら相手が Full で同じ答え" }
  ];

  /* ── 出力から値を読む ───────────────────────── */
  var PAT = {
    duplex: /(Half|Full)[- ]?[Dd]uplex/, speed: /(\d+)\s?Mb/,
    txload: /txload\s+(\d+)\/255/, rxload: /rxload\s+(\d+)\/255/,
    inq: /Input queue[:：]\s*(\d+)\//, outq: /Output queue[:：]\s*(\d+)\//,
    drops: /Total output drops[:：]\s*(\d+)/, bcast: /Received\s+(\d+)\s+broadcasts/,
    runts: /(\d+)\s+runts/, crc: /(\d+)\s+CRC/, inerr: /(\d+)\s+input errors/,
    coll: /(\d+)\s+collisions/
  };
  function read(text) {
    var out = {};
    Object.keys(PAT).forEach(function (k) {
      var m = text.match(PAT[k]);
      out[k] = m ? m[1] : null;
    });
    return out;
  }
  function n(v) { var x = parseInt(v, 10); return isNaN(x) ? 0 : x; }

  /* ── 判定ルール10本。上から順に当てて、最初に当たったところで決める ── */
  var RULES = [
    { key: "queue", cond: "Input queue か Output queue に溜まっている",
      verdict: "キューイング（順番待ち）",
      why: "出ていく先が詰まっていて、パケットが列に並んでいる",
      look: ["Input queue", "Output queue"],
      steps: function (v) { return [["Input queue", v.inq], ["Output queue", v.outq]]; },
      no: function (v) { return "Input queue が " + v.inq + "、Output queue が " + v.outq + " で、どちらも溜まっていない"; },
      test: function (v) { return n(v.inq) > 10 || n(v.outq) > 10; } },

    { key: "oversub", cond: "Total output drops がとても多い",
      verdict: "ポートのオーバーサブスクリプション",
      why: "そのポートで運べる量より多くのトラフィックが来ていて、捨てている",
      look: ["Total output drops"],
      steps: function (v) { return [["Total output drops", v.drops]]; },
      no: function (v) { return "Total output drops が " + v.drops + " で、多くない"; },
      test: function (v) { return n(v.drops) > 1000; } },

    { key: "throughput", cond: "txload と rxload が両方 255/255 で、input errors と CRC が 0",
      verdict: "高スループット",
      why: "帯域を使い切っていて、input errors も CRC も 0。こわれてはいない",
      look: ["txload", "rxload", "input errors", "CRC"],
      steps: function (v) { return [["txload", v.txload + "/255"], ["rxload", v.rxload + "/255"], ["CRC", v.crc], ["input errors", v.inerr]]; },
      no: function (v) { return (n(v.txload) === 255 && n(v.rxload) === 255) ? "txload も rxload も 255/255 だが、input errors が " + v.inerr + "、CRC が " + v.crc + " でこわれている" : "txload が " + v.txload + "/255、rxload が " + v.rxload + "/255。255 が満杯なので、ほとんど流れていない"; },
      test: function (v) {
        return n(v.txload) === 255 && n(v.rxload) === 255 &&
               n(v.inerr) === 0 && n(v.crc) === 0;
      } },

    { key: "dup_full", cond: "Full-duplex なのに collisions がある",
      verdict: "デュプレックスの不一致",
      why: "全二重では衝突は起きないはず。相手が半二重になっている",
      look: ["duplex", "collisions"],
      steps: function (v) { return [["duplex", v.duplex], ["collisions", v.coll]]; },
      no: function (v) { return "collisions が " + v.coll + " で、ぶつかっていない"; },
      test: function (v) { return v.duplex === "Full" && n(v.coll) > 0; } },

    { key: "dup_half", cond: "Half-duplex で collisions か CRC が出ている",
      verdict: "デュプレックスの不一致",
      why: "相手が全二重で、こちらが半二重になっている",
      look: ["duplex", "collisions", "CRC"],
      steps: function (v) { return [["duplex", v.duplex], ["collisions", v.coll], ["CRC", v.crc]]; },
      no: function (v) { return "collisions が " + v.coll + " で、ぶつかっていない"; },
      test: function (v) {
        return v.duplex === "Half" && (n(v.coll) > 0 || n(v.crc) > 0);
      } },

    { key: "coll_many", cond: "collisions がとても多い",
      verdict: "デュプレックスの不一致",
      why: "衝突が桁違いに多い。両側の duplex がそろっていない",
      look: ["collisions"],
      steps: function (v) { return [["collisions", v.coll]]; },
      no: function (v) { return "collisions が " + v.coll + " で、ぶつかっていない"; },
      test: function (v) { return n(v.coll) > 100; } },

    { key: "physical", cond: "CRC が多く、collisions が 0",
      verdict: "物理エラー（ケーブルか NIC）",
      why: "中身が壊れて届いている。ケーブルの不良か機器の故障",
      look: ["CRC", "input errors"],
      steps: function (v) { return [["CRC", v.crc], ["input errors", v.inerr], ["collisions", v.coll]]; },
      no: function (v) { return n(v.crc) === 0 ? "CRC が 0 で、中身は壊れていない" : "CRC は " + v.crc + " だが、collisions も " + v.coll + " 出ている"; },
      test: function (v) { return n(v.crc) > 0 && n(v.coll) === 0; } },

    { key: "bad_nic", cond: "runts があり、CRC も collisions も 0",
      verdict: "不良 NIC",
      why: "途中で切れたフレームだけが来ている。送り手の機器がおかしい",
      look: ["runts", "CRC", "collisions"],
      steps: function (v) { return [["runts", v.runts], ["CRC", v.crc], ["collisions", v.coll]]; },
      no: function (v) { return n(v.runts) === 0 ? "runts が 0 で、切れたフレームは来ていない" : "runts は " + v.runts + " だが、CRC が " + v.crc + "、collisions が " + v.coll + " も出ている"; },
      test: function (v) {
        return n(v.runts) > 0 && n(v.crc) === 0 && n(v.coll) === 0;
      } },

    { key: "storm", cond: "ほかに手がかりが無く、broadcasts が多い",
      verdict: "ブロードキャストストーム",
      why: "ブロードキャストが増えすぎて、帯域を食っている",
      look: ["broadcasts"],
      steps: function (v) { return [["broadcasts", v.bcast]]; },
      no: function (v) { return "broadcasts が " + v.bcast + " で、ふだんの数"; },
      test: function (v) { return n(v.bcast) > 1000; } },

    { key: "half_only", cond: "Half-duplex になっている（ほかに手がかりが無い）",
      verdict: "インターフェースの設定（デュプレックス）",
      why: "相手と設定がそろっていない",
      look: ["duplex"],
      steps: function (v) { return [["duplex", v.duplex]]; },
      no: function (v) { return "Full-duplex になっている"; },
      test: function (v) { return v.duplex === "Half"; } }
  ];

  function judge(values) {
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].test(values)) return RULES[i];
    }
    return null;
  }
  var VERDICTS = [];
  RULES.forEach(function (r) {
    if (VERDICTS.indexOf(r.verdict) < 0) VERDICTS.push(r.verdict);
  });


  /* ── 答えの出し方を、実際の数字で書き出す ──────────────
   * steps  … 見る所と、そこに入っている数
   * reject … ほかの選択肢が消える理由
   */
  function trace(text) {
    var v = read(text);
    var hit = judge(v);
    if (!hit) return null;
    var steps = hit.steps(v).map(function (x) {
      return { name: x[0], value: String(x[1]) };
    });
    /* 消える理由。**そのルール自体は当たっているのに、上のルールで先に決まった**
       ときは、そう書く。「ふだんの数」のような嘘を書かない */
    var order = {}, seen = {}, reject = [];
    RULES.forEach(function (r, i) { order[r.key] = i; });
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


  /* ── 読む順番（決め手が出るまで、上から順に見ていく道すじ）──────
   * 同じ答えになるルールが続くところは、1つの「見る所」にまとめる。
   * 返すのは「この所を見た → 値はこれ → 答えが出た／出ないので次へ」の並び。
   */
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
      g[i].rules[0].steps(v).forEach(function (x) {
        if (!vals.some(function (y) { return y[0] === x[0]; })) vals.push(x);
      });
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



  /* ── 答えの言葉の、一言説明 ─────────────────
   * 初めて見る言葉が多いので、1行だけ足す。長く書かない。
   */
  var GLOSS = {
    "キューイング（順番待ち）": "パケットが列に並んで待っている。壊れてはいない",
    "ポートのオーバーサブスクリプション": "運べる量より多く来ている。詰め込みすぎ",
    "高スループット": "たくさん流れているだけ。故障ではない",
    "デュプレックスの不一致": "全二重と半二重が、両側でそろっていない",
    "物理エラー（ケーブルか NIC）": "ケーブルか機器そのものが傷んでいる",
    "不良 NIC": "相手側の LAN カードが壊れかけている",
    "ブロードキャストストーム": "全員あての通信が増えすぎて、回線を食っている",
    "インターフェースの設定（デュプレックス）": "機器の設定が、相手と合っていない"
  };
  function gloss(v) { return GLOSS[v] || ""; }

  /* ── ブロック（＝見る所のまとまり）。上から順に見ていく ──────
   * ブロックを1つずつ練習すると、そのまま「読む順番」になる。
   */
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

  /* i 番目のブロックまで進む出力を作る。
   * hit=true  … そのブロックで答えが決まる
   * hit=false … そこでは決まらず、次のブロックへ進む
   */
  function reach(i, hit) {
    var bs = blocks(), pool = [];
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

  /* ── 出力を作る ─────────────────────────────── */
  function R(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    var x = a.slice(), i, j, t;
    for (i = x.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1)); t = x[i]; x[i] = x[j]; x[j] = t;
    }
    return x;
  }
  var NAMES = ["R7", "R16", "R19", "R30", "R36", "R43", "SW2", "SW4"];
  var SEG = ["sanfrancisco_subnet", "madrid_subnet", "atlanta_subnet",
             "brussels_subnet", "admin_subnet"];

  function build(v) {
    return [
      v.host + "# show interface fa0/0",
      "FastEthernet0/0 is up, line protocol is up",
      "  Hardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)",
      "  Description: " + v.seg,
      "  Internet address is 10.32.102.2/30",
      "  MTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,",
      "     reliability 255/255, txload " + v.txload + "/255, rxload " + v.rxload + "/255",
      "  Encapsulation ARPA, loopback not set",
      "  Keepalive set (60 sec)",
      "  " + v.duplex + "-duplex, 100 Mb/s, 100BaseTX/FX",
      "  ARP type: ARPA, ARP Timeout 04:00:00",
      "  Last input 00:00:01, output 00:00:00, output hang never",
      "  Input queue: " + v.inq + "/300/0/0 (size/max/drops/flushes); Total output drops: " + v.drops,
      "  Queueing strategy: fifo",
      "  Output queue: " + v.outq + "/300 (size/max)",
      "  30 second input rate " + v.rate + " bits/sec, 0 packets/sec",
      "  30 second output rate " + v.rate + " bits/sec, 0 packets/sec",
      "     7331 packets input, 7101162 bytes",
      "     Received " + v.bcast + " broadcasts (0 IP multicasts)",
      "     " + v.runts + " runts, 0 giants, 0 throttles",
      "     " + v.inerr + " input errors, " + v.crc + " CRC, 0 frame, 0 overrun, 0 ignored",
      "     0 watchdog",
      "     3927 packets output, 1440403 bytes, 0 underruns",
      "     0 output errors, " + v.coll + " collisions, 0 interface resets",
      "     0 babbles, 0 late collision, 0 deferred",
      "     0 lost carrier, 0 no carrier"
    ].join("\n");
  }

  function baseVals() {
    return { host: pick(NAMES), seg: pick(SEG), duplex: "Full", txload: 1, rxload: 1,
             inq: 0, outq: 0, drops: 0, bcast: 267, runts: 0, crc: 0, inerr: 0,
             coll: 0, rate: 0 };
  }
  var MAKERS = {
    queue: function (b) { b.outq = R(40, 260); return b; },
    oversub: function (b) { b.drops = R(20000, 900000000); return b; },
    throughput: function (b) {
      b.txload = 255; b.rxload = 255; b.rate = R(180000000, 240000000); return b;
    },
    dup_full: function (b) { b.duplex = "Full"; b.coll = R(11, 99); return b; },
    dup_half: function (b) { b.duplex = "Half"; b.coll = R(60, 900); return b; },
    physical: function (b) {
      var c = R(300, 300000); b.crc = c; b.inerr = c + R(0, 2000); return b;
    },
    bad_nic: function (b) { b.runts = R(40, 3000); return b; },
    storm: function (b) { b.bcast = R(2000, 4000000); return b; },
    half_only: function (b) { b.duplex = "Half"; return b; }
  };

  /* ねらったルールになる出力だけを返す。ならなければ作り直す */
  function make(key) {
    for (var i = 0; i < 40; i++) {
      var text = build(MAKERS[key](baseVals()));
      var r = judge(read(text));
      if (r && r.key === key) return text;
    }
    return null;
  }
  function makeAny() {
    var keys = Object.keys(MAKERS), k = pick(keys);
    return { key: k, text: make(k) };
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

  /* 見本（第1部・第2部で使う、いつも同じ出力） */
  function sample() {
    return build({ host: "R19", seg: "sales_subnet", duplex: "Full", txload: 1,
                   rxload: 1, inq: 0, outq: 185, drops: 0, bcast: 73115,
                   runts: 1876, crc: 4, inerr: 0, coll: 11, rate: 0 });
  }

  global.GEN = {
    SPOTS: SPOTS, RULES: RULES, VERDICTS: VERDICTS, MAKERS: MAKERS,
    read: read, judge: judge, trace: trace, walk: walk, groups: groups, blocks: blocks, reach: reach, gloss: gloss, make: make, makeAny: makeAny,
    excerpt: excerpt, sample: sample, shuffle: shuffle, pick: pick
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.GEN;
})(typeof window !== "undefined" ? window : globalThis);
