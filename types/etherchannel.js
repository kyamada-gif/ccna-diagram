/* 「EtherChannel」ブロック（過去問20問）。
 *
 * 何本かの線を1本に束ねる設定。本の20問を読むと、聞かれ方は5つしかない。
 *
 *   ① 相手のモードに合わせる          9問
 *   ② 別のベンダーとつなぐ            4問
 *   ③ 何本切れたら止めるか            3問
 *   ④ レイヤ3の束にメンバーを足す      3問
 *   ⑤ 両側でそろっていないものを直す    1問
 *
 * どれも「提示物のどこを見るか」がはっきりしているので、規則で解ける。
 * **判定ルールは本の問題と解説から起こした。思いつきで足していない。**
 *
 * 提示物は show etherchannel summary の出力と、そのときの要件。
 * 要件は【要件】の見出しの下に置く（画面はそのまま文字で出す）。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick, shuffle = E.shuffle, n = E.n;

  /* ── 見る所 ─────────────────────────────
   * 上から順に見る。**上で決まったら、下は見なくてよい。**
   */
  var SPOTS = [
    { key: "need", name: "要件の行（問題文）",
      re: /要件|したい|しますか|ますか/,
      mean: "問題文に書かれた要件。この分野では、答えを決める手がかりの多くが問題文にある",
      use: "最初に問題文を読む。「別のベンダー」「応答するが開始しない」「ダウンしたとき」「新しいメンバー」のいずれかがあれば、その時点で入力するコマンドが決まる" },

    { key: "add", name: "メンバーポートの追加かどうか",
      re: /新しいメンバー|バンドルに追加|メンバーとして/,
      mean: "既存のポートチャネルに、物理インターフェースをもう1つ追加する要件かどうか",
      use: "追加であれば、次にポートチャネルの階層（Flags）を確認する。レイヤ3のポートチャネルには、先に no switchport が必要" },

    { key: "layer", name: "ポートチャネルの階層（Po1(RU) か Po1(SU) か）",
      re: /Po\d+\((R[UD]|S[UD])\)/,
      mean: "Po1(SU) の S はレイヤ2、Po1(RU) の R はレイヤ3を表す",
      use: "R があればレイヤ3のポートチャネル。追加する物理インターフェースにも、先に no switchport を実行する必要がある" },

    { key: "vendor", name: "相手が別のベンダーか",
      re: /別のベンダー|同じベンダー/,
      mean: "接続する相手の機器が Cisco 以外かどうか",
      use: "別ベンダーの場合、使えるのは標準規格の LACP（active／passive）だけ。PAgP（desirable／auto）は Cisco 機器どうしでしか成立しない。出力に PAgP と表示されていても、別ベンダーとつなぐなら active を選ぶ" },

    { key: "peer", name: "相手のモード",
      re: /channel-group\s+\d+\s+mode\s+(active|passive|desirable|auto|on)/i,
      mean: "対向のインターフェースが active／passive／desirable／auto／on のどれに設定されているか",
      use: "LACP は active-active または active-passive で成立する。passive どうしでは、どちらも交渉を始めないため成立しない。対向が passive なら、こちら側は active にする" }
  ];

  /* **問題文と提示物を1つにつないでから読む。**
     この題材は、決め手が問題文のほうにある（「別のベンダーと」「応答するが開始しない」）。
     練習で作る出力も、同じ形（要件の行 ＋ 出力）にしてある */
  function join(x) {
    if (x && typeof x === "object" && x.exhibit !== undefined) {
      return String(x.text || "") + "\n" + String(x.exhibit || "");
    }
    return String(x || "");
  }

  var PAT = {
    add: /(新しいメンバー|バンドルに追加|メンバーとして)/,
    layer: /Po\d+\((R[UD])\)/,
    vendor: /(別のベンダー)/,
    passive: /(開始しない)/,
    keep: /(ダウンしたとき|障害が発生した場合でも|稼働状態を維持|ダウンした場合)/,
    bundle: /(2\s*番目のメンバー|正常にバンドル)/,
    peer: /channel-group\s+\d+\s+mode\s+(active|passive|desirable|auto|on)/i,
    proto: /(LACP|PAgP|PAGP)/i,
    group: /(?:channel-group|Port-Channel|ポート\s*チャネル|ポートチャネル)\s*(\d+)/i
  };

  function read(x) {
    var t = join(x), out = {};
    Object.keys(PAT).forEach(function (k) {
      var m = t.match(PAT[k]);
      out[k] = m ? (m[1] || m[0]) : null;
    });
    out.all = t;
    return out;
  }

  /* 決め手の所だけを残す。**問題文の行と、モードの行だけ。** */
  function excerpt(x, look) {
    var t = join(x);
    var lines = t.split("\n");
    var out = [lines[0]];
    lines.slice(1).forEach(function (l) {
      if (/別のベンダー|開始しない|ダウンしたとき|障害が発生した場合でも|稼働状態を維持|新しいメンバー|バンドルに追加|メンバーとして|正常にバンドル/.test(l)
          || /Po\d+\((R[UD]|S[UD])\)/.test(l)
          || /channel-group\s+\d+\s+mode/i.test(l)) out.push(l);
    });
    return out.join("\n");
  }

  /* 束ねる決まり。**本の解説そのまま。** */
  var PAIR = {
    LACP: { self: "active", answer: "active", say: "LACP は active-active か active-passive で成立する" },
    PAgP: { self: "desirable", answer: "desirable", say: "PAgP は desirable-desirable か desirable-auto で成立する" }
  };

  /* ── 判定ルール ───────────────────────────
   * 上から当てて、最初に当たった所で決まる。
   */
  var RULES = [
    { key: "vlan", cue: "ポートチャネルに参加できないインターフェースがある", cond: "1本だけポートチャネルに参加できず、許可VLAN が一致していない",
      mark: ["2 番目のメンバー", "正常にバンドル"],
      verdict: "不足しているインターフェース側に、許可VLAN を追加する",
      why: "まとめるインターフェースは、許可VLAN が両側で一致していないとポートチャネルに参加できない。ポートチャネル側ではなく、不足しているインターフェース側に add で追加する",
      look: ["要件の行（問題文）"],
      steps: function (v) { return [["要件", (v.all || "").split("\n")[0]]]; },
      no: function () { return "束に入らない線の話ではない"; },
      test: function (v) { return !!v.bundle; } },

    { key: "l3add", cue: "新しいメンバーとして追加する", cond: "メンバーポートを追加する。ポートチャネルはレイヤ3（Po1(RU)）",
      verdict: "no switchport のあとに channel-group を入力する",
      why: "R はレイヤ3のポートチャネルを表す。レイヤ2のままのインターフェースは参加できないため、先に no switchport でレイヤ3に切り替える",
      look: ["メンバーを足す話か", "ポートチャネルの階層（Po1(RU) か Po1(SU) か）"],
      steps: function (v) { return [["足す話か", v.add || "-"], ["ポートチャネルの階層", v.layer || "-"]]; },
      no: function (v) { return v.add ? "束がレイヤ3ではない" : "メンバーを足す話ではない"; },
      test: function (v) { return !!v.add; } },

    { key: "minlinks", cue: "リンクがダウンしたとき", cond: "リンク障害が起きたときのポートチャネルの扱いが書かれている",
      verdict: "port-channel min-links で、必要な最小リンク数を指定する",
      why: "min-links は、ポートチャネルが動作するために必要な最小のリンク数。稼働しているリンクがこの数を下回ると、ポートチャネル全体が停止する",
      look: ["要件の行（問題文）"],
      steps: function (v) { return [["要件のことば", v.keep || "-"]]; },
      no: function () { return "線が切れたときの話が出ていない"; },
      test: function (v) { return !!v.keep; } },

    { key: "vendor", cue: "別のベンダー", cond: "相手が別のベンダー",
      verdict: "channel-group（番号）mode active",
      why: "別ベンダーと接続する場合は LACP しか使えない。出力に PAgP と表示されていても active を選ぶ",
      look: ["相手が別のベンダーか"],
      steps: function (v) { return [["相手", v.vendor || "-"], ["いま出ている決まり", v.proto || "-"]]; },
      no: function () { return "相手は同じベンダー"; },
      test: function (v) { return !!v.vendor; } },

    { key: "passive", cue: "応答するが、交渉は開始しない", cond: "応答はするが、自分からは始めない",
      verdict: "channel-group（番号）mode passive",
      why: "passive は、対向から交渉を受けたときだけ応答し、自分からは交渉を開始しない動作",
      look: ["要件の行（問題文）"],
      steps: function (v) { return [["要件のことば", v.passive || "-"]]; },
      no: function () { return "「自分からは始めない」とは書かれていない"; },
      test: function (v) { return !!v.passive; } },

    { key: "peer", cue: "対向のモードに合わせる", cond: "上記以外（対向のモードに合わせてポートチャネルを組む）",
      verdict: "channel-group（番号）mode active",
      why: "LACP は active-active または active-passive で成立する。passive どうしでは成立しないため、こちら側は active にする",
      look: ["相手のモード"],
      steps: function (v) { return [["相手のモード", v.peer || "（出力に無い）"], ["決まり", v.proto || "-"]]; },
      no: function () { return "ここまでで決まっている"; },
      test: function (v) { return true; } }
  ];

  var GLOSS = {
    "不足しているインターフェース側に、許可VLAN を追加する": "ポートチャネル側に設定しても解決しない",
    "no switchport のあとに channel-group を入力する": "レイヤ3のポートチャネルには、レイヤ3にしたインターフェースしか参加できない",
    "port-channel min-links で、必要な最小リンク数を指定する": "この数を下回ると、ポートチャネル全体が停止する",
    "channel-group（番号）mode active": "自分から交渉を開始する。LACP で使う",
    "channel-group（番号）mode passive": "対向から交渉を受けたときだけ応答する"
  };

  /* 本の答えの言い回しと突き合わせるための言葉 */
  var SAME = {
    "不足しているインターフェース側に、許可VLAN を追加する": ["allowed vlan add"],
    "no switchport のあとに channel-group を入力する": ["no switchport"],
    "port-channel min-links で、必要な最小リンク数を指定する": ["min-links"],
    "channel-group（番号）mode active": ["mode active"],
    "channel-group（番号）mode passive": ["mode passive"]
  };

  /* ── 出力を作る ───────────────────────────
   * show etherchannel summary の形は本のとおり。数字と名前だけ入れ替える。
   */
  function baseVals() {
    return {
      g: R(1, 4),
      proto: pick(["LACP", "PAgP"]),
      layer: pick(["SU", "RU"]),
      ports: R(2, 4),
      sw: pick(["SW1", "SW2", "Switch1", "SwitchA"]),
      peer: pick(["active", "passive", "desirable", "auto"]),
      vlan: pick([100, 200, 300]),
      keep: R(1, 3),
      ifname: pick(["Gi0/1", "Fa0/13", "Et0/0"])
    };
  }

  function summary(v) {
    var flag = v.layer;
    var ports = [];
    for (var i = 0; i < v.ports; i++) {
      ports.push("Fa0/" + (13 + i) + "(P)");
    }
    var peer = v.peer
      ? ["", "（相手側の設定）", "interface " + v.ifname,
         " channel-group " + v.g + " mode " + v.peer]
      : [];
    return [
      v.sw + "# show etherchannel summary",
      "Flags:  D - down        P - bundled in port-channel",
      "        R - Layer3      S - Layer2",
      "        U - in use      f - failed to allocate aggregator",
      "",
      "Number of channel-groups in use: 1",
      "Number of aggregators:           1",
      "",
      "Group  Port-channel  Protocol    Ports",
      "------+-------------+-----------+----------------------------",
      String(v.g) + "      Po" + v.g + "(" + flag + ")        " +
        (v.proto === "LACP" ? "LACP" : "PAgP") + "        " + ports.join("  ")
    ].concat(peer).join("\n");
  }

  function build(v) {
    /* **1行目が問題文（要件）。**本の問題を読むときと同じ形にそろえる */
    return v.need + "\n\n" + summary(v);
  }

  /* 出す場面を6つ作る。どれも本の問題の聞かれ方をなぞっている */
  var MAKERS = {
    vlan: function (b) {
      b.layer = "SU"; b.peer = null;
      b.need = "束の 2 番目のメンバーを正常にバンドルするには、どれをすればよいですか。";
      return b;
    },
    l3add: function (b) {
      b.layer = "RU"; b.peer = null;
      b.need = "既存の Port-Channel" + b.g +
               " バンドルに、別の物理インターフェイスを新しいメンバーとして追加します。どのコマンドを設定しますか。";
      return b;
    },
    minlinks: function (b) {
      b.layer = "SU"; b.peer = null;
      b.need = b.sw + " の " + b.ifname +
               " がダウンしたときに、この束を止めたい。どの設定をしますか。";
      return b;
    },
    vendor: function (b) {
      b.layer = "SU"; b.peer = null;
      /* **出力はいつも PAgP にする。**本の罠（B1-P11-068）はここにある。
         出力に PAgP と出ているのを見て desirable を選んでしまうが、
         別のベンダーと組めるのは LACP だけ。
         出力が LACP のときもあると、この罠を一度も通らない回ができてしまう */
      b.proto = "PAgP";
      b.need = "別のベンダーのスイッチと、同じグループ番号で EtherChannel を確立します。どの設定をしますか。";
      return b;
    },
    passive: function (b) {
      b.layer = "SU"; b.proto = "LACP"; b.peer = null;
      b.need = "受け取ったパケットには応答するが、こちらからネゴシエーションを開始しないようにします。何を設定しますか。";
      return b;
    },
    peer: function (b) {
      b.layer = "SU"; b.proto = "LACP";
      b.peer = pick(["active", "passive"]);
      b.need = "相手側の設定はこうなっています。こちら側を設定して LACP EtherChannel を確立します。どの設定をしますか。";
      return b;
    }
  };

  /* 見本。**見る所が5つとも出てくる形にする**（build.js がそれを確かめる）。
     実際に出す問題は、このうち1つの場面だけを使う */
  function sample() {
    return [
      "別のベンダーのスイッチと、同じグループ番号で EtherChannel を確立します。どの設定をしますか。",
      "（ほかの聞かれ方：新しいメンバーとして追加する／ダウンしたときに止める／応答するが開始しない）",
      "",
      summary({ sw: "SW1", g: 1, layer: "RU", proto: "LACP", ports: 2,
                peer: "passive", ifname: "Gi0/1" })
    ].join("\n");
  }


  /* ── 最後の3問のうち2問は、打つコマンドの並びで答える ─────────
   * **本の20問は、選択肢がすべて打つコマンドの並び。**
   * 日本語の行動文で「どこを直すか」まで答えられても、
   * テストでは「どのコマンドを、どこに打つか」まで要る。
   *
   * **誤答の顔ぶれは、本の同じ問題が出しているものをそのまま写す。**
   * こちらで考え出さない。出どころは各ルールの下に書いた。
   */
  function cmdSet(key, v) {
    var g = v.g, phy = v.ifname, po = "port-channel " + g;
    var cg = "channel-group " + g + " mode ";
    if (key === "vlan") {
      /* B1-P13-006。打つ場所（物理か、ポートチャネルか）と add の有無で分かれる */
      var add = "「switchport trunk allowed vlan add " + v.vlan + "」コマンドを設定します";
      var noadd = "「switchport trunk allowed vlan " + v.vlan + "」コマンドを設定します";
      return { right: v.sw + " の " + phy + " で" + add,
               wrong: [v.sw + " の " + po + " に" + add,
                       v.sw + " の " + po + " に" + noadd,
                       v.sw + " の " + phy + " で" + noadd] };
    }
    if (key === "l3add") {                       /* B1-P15-082 */
      return { right: "no switchport\n" + cg + "active",
               wrong: ["switchport mode trunk\n" + cg + "active",
                       "no switchport\n" + cg + "on",
                       "switchport\nswitchport mode trunk"] };
    }
    if (key === "minlinks") {                    /* B1-P11-030 */
      var head = v.sw + "(config)#interface " + po + "\n" + v.sw + "(config-if)#";
      return { right: head + "port-channel min-links " + v.keep,
               wrong: [head + "lacp max-bundle " + v.keep,
                       head + "lacp port-priority 32000",
                       v.sw + "(config)#lacp system-priority 32000"] };
    }
    if (key === "vendor") {                      /* B1-P11-068 */
      return { right: "interface " + phy + "\n" + cg + "active",
               wrong: ["interface " + po + "\n" + cg + "desirable",
                       "interface " + phy + "\n" + cg + "on",
                       "interface " + po + "\n" + cg + "auto"] };
    }
    if (key === "passive") {                     /* B1-P11-064 */
      return { right: "interface " + po + "\n" + cg + "passive",
               wrong: ["interface range " + phy + " - 15\n" + cg + "desirable",
                       "interface range " + phy + " - 15\n" + cg + "on",
                       "interface " + po + "\n" + cg + "auto"] };
    }
    /* peer。B1-P13-082。相手側の行も並べて、こちら側だけを選ばせる */
    var mine = function (m) {
      return v.sw + "(config-if-range)#" + cg + m + "\n" +
             "（相手側）" + cg + (v.peer || "passive");
    };
    return { right: mine("active"),
             wrong: [mine("desirable"), mine("on"), mine("auto")] };
  }

  /* その答えだけが持っている印。**誤答が1つも当てはまらないこと**を build.js が見る。
     打つ場所（物理インターフェースか、ポートチャネルか）まで見ないと分けられないので、
     作った値をいっしょに渡して判定する */
  var CMDMARK = {
    vlan: function (o, v) {
      return o.indexOf("allowed vlan add") >= 0 && o.indexOf(" の " + v.ifname + " で") >= 0;
    },
    l3add: function (o) {
      return o.indexOf("no switchport") === 0 && o.indexOf("mode active") >= 0;
    },
    minlinks: function (o) { return o.indexOf("port-channel min-links") >= 0; },
    vendor: function (o, v) {
      return o.indexOf("interface " + v.ifname) >= 0 && o.indexOf("mode active") >= 0;
    },
    passive: function (o) { return o.indexOf("mode passive") >= 0; },
    /* **見るのは、こちら側の行だけ。**下に並ぶ相手側の行にも mode が書いてあるので、
       全体で探すと、相手が active のときに誤答まで当てはまってしまう */
    peer: function (o) { return String(o).split("\n")[0].indexOf("mode active") >= 0; }
  };

  /* 最後の3問。1問目は今までどおり日本語、2問目と3問目はコマンドの並び */
  function wholeQ(n, ctx) {
    if (n === 0) return null;
    for (var t = 0; t < 40; t++) {
      var key = pick(Object.keys(MAKERS));
      var v = MAKERS[key](baseVals());
      var text = build(v);
      var r = ctx.judge(ctx.read(text));
      if (!r || r.key !== key) continue;
      var c = cmdSet(key, v);
      var seen = {}, opts = [c.right];
      seen[c.right] = 1;
      ctx.shuffle(c.wrong).forEach(function (w) {
        if (opts.length >= 4 || seen[w]) return;
        seen[w] = 1; opts.push(w);
      });
      if (opts.length < 4) continue;
      return { kind: "whole", ask: "どのコマンドを設定しますか。",
               exhibit: text, opts: ctx.shuffle(opts), right: c.right, extra: {} };
    }
    return null;
  }

  /* ── 説明の1枚に添える一言 ─────────────────────
   * **取り違えやすい所だけ。**判定ルールの理由（why）をもう一度書かない。
   */
  var NOTE = {
    vlan: "設定するのはポートチャネルの側ではなく、許可VLAN が足りない物理インターフェースの側。" +
          "add を付けないと、いま通っている VLAN の一覧が置きかわる",
    l3add: "出力の Flags にある R はレイヤ3、S はレイヤ2。" +
           "Po1(SU) と出ていればレイヤ2なので、no switchport は要らない",
    minlinks: "指定する数は「残っていてほしい本数」。" +
              "名前の似た lacp max-bundle は、束に入れられる上限なので別のもの",
    vendor: "出力に PAgP と出ていても、別のベンダーと組めるのは LACP だけ。desirable を選ばない。" +
            "設定するのは物理インターフェースの側",
    passive: "自分から交渉を始めるのが active、受けたときだけ応答するのが passive。" +
             "PAgP で同じ組になるのは desirable と auto",
    peer: "相手が passive なので、こちらも passive にすると、どちらも交渉を始めず束にならない"
  };

  var spec = {
    id: "etherchannel",
    /* 出題パターン＝どのルールで答えにたどり着くか。
       絞ったせいでパターンが消えていないかを、build.js が毎回見る */
    pattern: E.cuePattern, patterns: ["l3add", "minlinks", "passive", "peer", "vendor", "vlan"],
    kind: "rules",
    card: "config",
    name: "EtherChannel",
    note: "複数のリンクを1本にまとめる設定を選ぶ",
    obj: "2.4",
    ask: "この要件を満たす設定はどれですか。",
    /* **問題文もいっしょに読む。**この題材は決め手が問題文にある */
    wantsQuestion: true,
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample, /* 決め手が出力の中にあるルール。ここだけ見本の現物を出す */
    learnOut: ["l3add", "vendor", "peer"],
    wholeQ: wholeQ, cmdSet: cmdSet, cmdMark: CMDMARK,
    brief: E.cueBrief(RULES, NOTE), answerNote: E.cueAnswerNote(RULES, GLOSS),
    stepQ: E.cueStepQ(RULES),
    expect: { spots: 5, rules: 6, questions: 16 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.etherchannel = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
