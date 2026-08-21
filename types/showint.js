/* 「show interface の障害」ブロックの中身。
 *
 * 見る所13か所と判定ルール10本は、過去問35問とその解説から起こした。
 * 思いつきで足さない。出どころは out/full/checkpoints.md にある。
 *
 * **この形（spec）に沿って書けば、新しいブロックが作れる。**共通の仕掛けは engine.js。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick, n = E.n;

  var SPOTS = [
    { key: "line", name: "line protocol",
      re: /line protocol is (up|down)/,
      mean: "そのインターフェースが通信できる状態かどうか",
      use: "down ならリンクが切れている。up なら物理的にはつながっているので、下に並んでいるエラーの数を順に見ていく" },
    { key: "duplex", name: "duplex",
      re: /(Half|Full)-duplex/,
      mean: "全二重か半二重か",
      use: "collisions と組にして見る。Full なのに collisions が出ていたら、両側の設定が食い違っている。Half でも collisions か CRC が出ていたら同じ" },
    { key: "speed", name: "speed",
      re: /100 Mb\/s/,
      mean: "そのインターフェースの通信速度",
      use: "両側で一致していないとリンクが確立しない。ただしこの種類の問題では、答えを決める手がかりにはならない" },
    { key: "txload", name: "txload",
      re: /txload (\d+)\/255/,
      mean: "送信方向で、帯域をどれだけ使っているか",
      use: "255 が使用率 100%。1/255 はほとんど流れていない状態を表す。rxload と両方が 255/255 で、input errors と CRC がどちらも 0 なら、単に流量が多いだけで故障ではない" },
    { key: "rxload", name: "rxload",
      re: /rxload (\d+)\/255/,
      mean: "受信方向で、帯域をどれだけ使っているか",
      use: "255 が使用率 100%。1/255 はほとんど流れていない状態を表す。txload と両方が 255/255 で、input errors と CRC がどちらも 0 なら、単に流量が多いだけで故障ではない" },
    { key: "inq", name: "Input queue",
      re: /Input queue: (\d+)\//,
      mean: "受信して、処理を待っているパケットの数",
      use: "0 でなければ、パケットが順番待ちで滞留している。ほかのエラーより先にここを見る" },
    { key: "drops", name: "Total output drops",
      re: /Total output drops: (\d+)/,
      mean: "送信しきれずに破棄したパケットの数",
      use: "桁違いに多ければ、そのインターフェースが運べる量を超えて流れてきている" },
    { key: "outq", name: "Output queue",
      re: /Output queue: (\d+)\//,
      mean: "送信待ちで滞留しているパケットの数",
      use: "0 でなければ、送信側でパケットが順番待ちになっている" },
    { key: "bcast", name: "broadcasts",
      re: /Received (\d+) broadcasts/,
      mean: "受信したブロードキャストの数",
      use: "ほかのエラーがすべて 0 のときだけ見る。ほかが 0 でこの数だけ多ければ、ブロードキャストが増えすぎている。時間とともに自然に増える値なので、これだけで判断はしない" },
    { key: "runts", name: "runts",
      re: /(\d+) runts/,
      mean: "64 バイトに満たない、途中で切れたフレームの数",
      use: "0 でなければ、途中で切れたフレームが届いている。CRC も collisions も 0 なら送信側の機器の問題。CRC が出ているなら、そちらを先に見る" },
    { key: "inerr", name: "input errors",
      re: /(\d+) input errors/,
      mean: "受信時に起きたエラーの合計",
      use: "合計値なので、この数だけでは判断できない。同じ行のすぐ右にある CRC を見る。input errors とほぼ同じ数が CRC なら、ケーブルか機器の不良。CRC が 0 なら、ほかの項目を見る" },
    { key: "crc", name: "CRC",
      re: /(\d+) CRC/,
      mean: "中身が壊れた状態で届いたフレームの数",
      use: "0 でなければ、中身が壊れたフレームが届いている。collisions が 0 ならケーブルか機器の不良。collisions も出ていたら、両側の全二重・半二重の設定が食い違っている" },
    { key: "coll", name: "collisions",
      re: /(\d+) collisions/,
      mean: "送信しようとして衝突が起きた回数",
      use: "0 でなければ、まず duplex を見る。全二重では衝突は起きないので、Full-duplex で衝突が出ていれば設定の食い違い。Half-duplex で出ている場合も、相手が全二重になっている" }
  ];

  var PAT = {
    line: /line protocol is (up|down)/, duplex: /(Half|Full)[- ]?[Dd]uplex/, speed: /(\d+)\s?Mb/,
    txload: /txload\s+(\d+)\/255/, rxload: /rxload\s+(\d+)\/255/,
    inq: /Input queue[:：]\s*(\d+)\//, outq: /Output queue[:：]\s*(\d+)\//,
    drops: /Total output drops[:：]\s*(\d+)/, bcast: /Received\s+(\d+)\s+broadcasts/,
    runts: /(\d+)\s+runts/, crc: /(\d+)\s+CRC/, inerr: /(\d+)\s+input errors/,
    coll: /(\d+)\s+collisions/
  };
  var RULES = [
    /* **いちばん先に見る。**リンクが落ちていたら、下のエラーの数は過去の記録で、
       いま起きていることの手がかりにならない。
       デュプレックスの不一致では line protocol は落ちない（up のまま衝突が増える） */
    { key: "linkdown", cond: "line protocol が down になっている",
      verdict: "リンクが切れている（ケーブルか機器の故障）",
      why: "line protocol が down なので、そもそもつながっていない。下に並んでいるエラーの数は、切れる前に記録されたもの",
      look: ["line protocol"],
      steps: function (v) { return [["line protocol", v.line]]; },
      no: function (v) { return "line protocol is up なので、線はつながっている"; },
      test: function (v) { return v.line === "down"; } },

    { key: "queue", cond: "Input queue か Output queue にパケットが溜まっている",
      verdict: "キューイング（順番待ち）",
      why: "送り出す先が詰まっていて、パケットが順番待ちの列に並んでいる",
      look: ["Input queue", "Output queue"],
      steps: function (v) { return [["Input queue", v.inq], ["Output queue", v.outq]]; },
      no: function (v) { return "Input queue が " + v.inq + "、Output queue が " + v.outq + " で、どちらも溜まっていない"; },
      test: function (v) { return n(v.inq) > 10 || n(v.outq) > 10; } },

    { key: "oversub", cond: "Total output drops が桁違いに多い",
      verdict: "ポートのオーバーサブスクリプション",
      why: "そのインターフェースが運べる量を超えて流れてきているため、あふれた分を破棄している",
      look: ["Total output drops"],
      steps: function (v) { return [["Total output drops", v.drops]]; },
      no: function (v) { return "Total output drops が " + v.drops + " で、多くない"; },
      test: function (v) { return n(v.drops) > 1000; } },

    { key: "throughput", cond: "txload と rxload が両方 255/255 で、input errors と CRC が 0",
      verdict: "高スループット",
      why: "帯域を使い切っているが、input errors も CRC も 0。エラーは起きていないので、単に流量が多いだけ",
      look: ["txload", "rxload", "input errors", "CRC"],
      steps: function (v) { return [["txload", v.txload + "/255"], ["rxload", v.rxload + "/255"], ["CRC", v.crc], ["input errors", v.inerr]]; },
      no: function (v) { return (n(v.txload) === 255 && n(v.rxload) === 255) ? "txload も rxload も 255/255 だが、input errors が " + v.inerr + "、CRC が " + v.crc + " でこわれている" : "txload が " + v.txload + "/255、rxload が " + v.rxload + "/255。255 が満杯なので、ほとんど流れていない"; },
      test: function (v) {
        return n(v.txload) === 255 && n(v.rxload) === 255 &&
               n(v.inerr) === 0 && n(v.crc) === 0;
      } },

    { key: "dup_full", cond: "Full-duplex なのに collisions が出ている",
      verdict: "デュプレックスの不一致",
      why: "全二重では衝突は起きない。相手側が半二重になっている",
      look: ["duplex", "collisions"],
      steps: function (v) { return [["duplex", v.duplex], ["collisions", v.coll]]; },
      no: function (v) { return "collisions が " + v.coll + " で、ぶつかっていない"; },
      test: function (v) { return v.duplex === "Full" && n(v.coll) > 0; } },

    { key: "dup_half", cond: "Half-duplex で collisions か CRC が出ている",
      verdict: "デュプレックスの不一致",
      why: "こちらが半二重で、相手側が全二重になっている",
      look: ["duplex", "collisions", "CRC"],
      steps: function (v) { return [["duplex", v.duplex], ["collisions", v.coll], ["CRC", v.crc]]; },
      no: function (v) { return "collisions が " + v.coll + " で、ぶつかっていない"; },
      test: function (v) {
        return v.duplex === "Half" && (n(v.coll) > 0 || n(v.crc) > 0);
      } },

    { key: "coll_many", cond: "collisions が桁違いに多い",
      verdict: "デュプレックスの不一致",
      why: "衝突が桁違いに多い。両側の duplex の設定が一致していない",
      look: ["collisions"],
      steps: function (v) { return [["collisions", v.coll]]; },
      no: function (v) { return "collisions が " + v.coll + " で、ぶつかっていない"; },
      test: function (v) { return n(v.coll) > 100; } },

    { key: "physical", cond: "CRC が多く、collisions は 0",
      verdict: "物理エラー（ケーブルか NIC）",
      why: "中身が壊れたフレームが届いている。ケーブルの不良か、機器そのものの故障",
      look: ["CRC", "input errors"],
      steps: function (v) { return [["CRC", v.crc], ["input errors", v.inerr], ["collisions", v.coll]]; },
      no: function (v) { return n(v.crc) === 0 ? "CRC が 0 で、中身は壊れていない" : "CRC は " + v.crc + " だが、collisions も " + v.coll + " 出ている"; },
      test: function (v) { return n(v.crc) > 0 && n(v.coll) === 0; } },

    { key: "bad_nic", cond: "runts が出ていて、CRC も collisions も 0",
      verdict: "不良 NIC",
      why: "途中で切れたフレームだけが届いている。送信側の機器に問題がある",
      look: ["runts", "CRC", "collisions"],
      steps: function (v) { return [["runts", v.runts], ["CRC", v.crc], ["collisions", v.coll]]; },
      no: function (v) { return n(v.runts) === 0 ? "runts が 0 で、切れたフレームは来ていない" : "runts は " + v.runts + " だが、CRC が " + v.crc + "、collisions が " + v.coll + " も出ている"; },
      test: function (v) {
        return n(v.runts) > 0 && n(v.crc) === 0 && n(v.coll) === 0;
      } },

    { key: "storm", cond: "ほかに手がかりが無く、broadcasts だけが多い",
      verdict: "ブロードキャストストーム",
      why: "全員宛ての通信が増えすぎて、帯域を占有している",
      look: ["broadcasts"],
      steps: function (v) { return [["broadcasts", v.bcast]]; },
      no: function (v) { return "broadcasts が " + v.bcast + " で、ふだんの数"; },
      test: function (v) { return n(v.bcast) > 1000; } },

    { key: "half_only", cond: "ほかに手がかりが無く、Half-duplex になっている",
      verdict: "インターフェースの設定（デュプレックス）",
      why: "相手側と duplex の設定が一致していない",
      look: ["duplex"],
      steps: function (v) { return [["duplex", v.duplex]]; },
      no: function (v) { return "Full-duplex になっている"; },
      test: function (v) { return v.duplex === "Half"; } }
  ];

  var GLOSS = {
    "リンクが切れている（ケーブルか機器の故障）": "線そのものがつながっていない。設定の問題ではない",
    "キューイング（順番待ち）": "パケットが順番待ちの列に並んでいる。壊れてはいない",
    "ポートのオーバーサブスクリプション": "運べる量を超えて流れてきている",
    "高スループット": "流量が多いだけで、故障ではない",
    "デュプレックスの不一致": "全二重と半二重が、両側で一致していない",
    "物理エラー（ケーブルか NIC）": "ケーブルか、機器そのものが傷んでいる",
    "不良 NIC": "送信側の LAN カードが壊れかけている",
    "ブロードキャストストーム": "全員宛ての通信が増えすぎて、帯域を占有している",
    "インターフェースの設定（デュプレックス）": "こちらの設定が、相手側と一致していない"
  };
  var NAMES = ["R7", "R16", "R19", "R30", "R36", "R43", "SW2", "SW4"];
  var SEG = ["sanfrancisco_subnet", "madrid_subnet", "atlanta_subnet",
             "brussels_subnet", "admin_subnet"];

  function build(v) {
    return [
      v.host + "# show interface fa0/0",
      "FastEthernet0/0 is up, line protocol is " + (v.line || "up") + ",",
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

  /* 見本（第1部・第2部で使う、いつも同じ出力） */
  function sample() {
    return build({ host: "R19", seg: "sales_subnet", duplex: "Full", txload: 1,
                   rxload: 1, inq: 0, outq: 185, drops: 0, bcast: 73115,
                   runts: 1876, crc: 4, inerr: 0, coll: 11, rate: 0 });
  }


  /* 本の答えとの言い換え表。判定の答えと、本に印刷された文言を突き合わせるのに使う */
  var SAME = {
    "リンクが切れている（ケーブルか機器の故障）": ["ケーブルの切断"],
    "キューイング（順番待ち）": ["キューイング", "順番待ち"],
    "ポートのオーバーサブスクリプション": ["オーバーサブスクリプション", "過剰使用", "過剰利用"],
    "高スループット": ["高スループット", "高いスループット"],
    "デュプレックスの不一致": ["デュプレックス", "duplex", "半二重ネゴシエーション",
                       "全二重/半二重", "速度設定が一致", "インターフェース構成"],
    "物理エラー（ケーブルか NIC）": ["物理エラー", "物理的エラー", "ケーブル", "チェックサム", "CRC"],
    "不良 NIC": ["不良 NIC", "NIC が不良"],
    "ブロードキャストストーム": ["ブロードキャスト"],
    "インターフェースの設定（デュプレックス）": ["インターフェース構成", "インターフェース設定"]
  };

  /* ── 出題パターン ─────────────────────────
   * 本の31問は、**どのルールで答えにたどり着くか**で10通りに分かれる。
   * **答えでまとめてはいけない。**「デュプレックスの不一致」は3つのルール
   * （Full なのに衝突／Half で衝突か CRC／衝突が桁違いに多い）から来るので、
   * 答えでまとめると読み方の道筋が2つ消えてしまう。
   * 同じパターンが何問も並んでいたので2問までに絞った（31 → 17 問）。
   * 絞り方は scripts/trim.js。パターンが消えていないかは build.js が毎回見る。
   */
  function patternOf(q, G) {
    if (!G) return null;
    var r = G.judge(G.read(q.fig || q.exhibit));
    return r ? r.key : null;
  }
  var PATTERNS = ["linkdown", "queue", "oversub", "throughput", "dup_full",
                  "dup_half", "coll_many", "physical", "bad_nic", "storm"];

  var spec = {
    id: "showint",
    pattern: patternOf, patterns: PATTERNS,
    kind: "rules",
    card: "read",
    name: "show interface の障害",
    note: "出力を見て、何が起きているかを当てる",
    obj: "1.4",
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample,
    expect: { spots: 13, rules: 11, questions: 17 },
    /* 本の答えが出力と食い違うため、演習から外した4問 */
    dropped: ["B1-P14-072", "B2-0251-02", "B1-P12-076", "B2-0084-02",
              /* B2-0137-01 と出力も選択肢も同じなのに、本の答えが違う。
                 line protocol is down のときリンクは落ちている。
                 デュプレックスの不一致では line protocol は落ちないので、
                 「ケーブルの切断」とする B2 のほうが正しい */
              "B1-P14-050"]
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.showint = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
