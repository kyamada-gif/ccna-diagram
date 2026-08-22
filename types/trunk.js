/* 「トランクと VLAN」ブロック（過去問19問）。
 *
 * スイッチどうしの線に、複数の VLAN を通すための設定。
 * もとは「トランク11問」と「VLAN 10問」に分かれていたが、
 * VLAN の8問は同じ話題だったので1つにまとめた（2026-08-21）。
 *
 * 本の19問を読むと、決め方は9つ。
 *
 *   ① ルータにぶら下げる（サブインターフェース）      2問
 *   ② 電話をつなぐ（音声VLAN）                      2問
 *   ③ DTP に任せる                                  1問
 *   ④ タグに対応していない相手 → ネイティブVLANで通す 1問
 *   ⑤ カプセル化が isl → dot1q に直す                2問
 *   ⑥ 通したい VLAN が許可の一覧に無い → add で足す   1問
 *   ⑦ ネイティブVLANを既定（1）以外にする             2問
 *   ⑧ つなぐ相手で決める（スイッチ間＝トランク）      1問
 *   ⑨ アクセスのままなので、トランクにする            6問
 *
 * **決め手は問題文と、相手側の出力の両方にある。**
 * だから read は問題文と提示物をつないでから読む（etherchannel と同じ）。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick, shuffle = E.shuffle;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "where", name: "どこにつなぐか（問題文）",
      re: /(サブインターフェース|IP Phone|電話|DTP|タグ|スイッチ|プリンタ|VLAN)/,
      mean: "接続する相手が、ルータか、IP 電話か、スイッチか、VLAN タグに対応しない機器か",
      use: "ルータに接続するならサブインターフェース、IP 電話なら音声VLAN を使う。接続する相手によって入力するコマンドが変わるので、まずここを見る" },

    { key: "encap", name: "カプセル化（Encapsulation）",
      re: /(Encapsulation|encapsulation)\s*[:：]?\s*(isl|dot1q|dot1Q|negotiate)/i,
      mean: "VLAN タグの付け方。dot1q が標準規格で、isl はシスコ独自の古い方式",
      use: "両側で同じ方式にしないと、トランクとして成立しない。片方が isl なら、no で削除してから dot1q に設定し直す" },

    { key: "mode", name: "現在のモード（Administrative Mode）",
      re: /Administrative Mode\s*[:：]\s*(static access|trunk|dynamic \w+)/i,
      mean: "そのインターフェースが、いまアクセスかトランクか、相手との交渉に任せる設定（dynamic）か",
      use: "static access のままではトランクにならない。switchport mode trunk で切り替える" },

    { key: "native", name: "ネイティブVLAN",
      re: /(Trunking Native Mode VLAN|native vlan|ネイティブ\s*VLAN)/i,
      mean: "VLAN タグを付けずに転送する VLAN。既定は 1",
      use: "「既定以外にする」と書かれていたら、1 以外の番号にする。番号は両側でそろえる" },

    { key: "allow", name: "通してよい VLAN の一覧（Trunking VLANs Enabled）",
      re: /(Trunking VLANs Enabled|allowed vlan)/i,
      mean: "そのトランクで転送してよい VLAN の番号",
      use: "転送したい番号が一覧に無ければ追加する。add を付けないと、いまの一覧が置き換わって消えてしまう" }
  ];

  /* **問題文と提示物を1つにつないでから読む。**決め手が問題文にあるため */
  function join(x) {
    if (x && typeof x === "object" && x.exhibit !== undefined) {
      return String(x.text || "") + "\n" + String(x.exhibit || "");
    }
    return String(x || "");
  }

  var PAT = {
    sub: /(サブインターフェース|相互に通信できる)/,
    voice: /(IP Phone|音声|VoIP|ボイス)/i,
    dtp: /(DTP)/,
    notag: /(トランク\s*ポートをサポートしていない|タグ.*対応していない|サードパーティ)/,
    isl: /(?:Encapsulation|encapsulation)\s*[:：]?\s*isl/i,
    addvlan: /(新しく\s*VLAN\s*\d+|VLAN\s*\d+\s*を実装)/i,
    native1: /(ネイティブ\s*VLAN\s*を\s*デフォルト以外|デフォルト以外の値)/,
    role: /(完全な接続|両方のスイッチに接続)/,
    access: /Administrative Mode\s*[:：]\s*static access/i,
    enabled: /Trunking VLANs Enabled\s*[:：]\s*([\d,\- ]+)/i,
    nativeNo: /Trunking Native Mode VLAN\s*[:：]\s*(\d+)/i,
    ifname: /(?:interface|インターフェイス|インターフェース)\s*([A-Za-z]+[\d\/]+)/
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

  function excerpt(x) {
    var t = join(x), lines = t.split("\n"), out = [lines[0]];
    lines.slice(1).forEach(function (l) {
      if (/サブインターフェース|相互に通信|Router-on-a-stick|IP Phone|音声|VoIP|DTP|サポートしていない|サードパーティ|デフォルト以外|新しく\s*VLAN|完全な接続/.test(l)
          || /Administrative Mode|Encapsulation|Trunking VLANs Enabled|Trunking Native Mode VLAN/i.test(l)) out.push(l);
    });
    return out.join("\n");
  }

  /* ── 判定ルール ─────────────────────────── */
  var RULES = [
    { key: "sub", cue: "ルータのサブインターフェース", cond: "ルータに接続して、VLAN どうしをつなぐ",
      verdict: "ルータにサブインターフェースを作り、encapsulation dot1Q と IP アドレスを設定する",
      why: "1本のリンクに複数の VLAN を通すときは、VLAN ごとにサブインターフェースを作る。サブインターフェースの番号と VLAN 番号は、一致していなくてもよい",
      look: ["どこにつなぐか（問題文）"],
      steps: function (v) { return [["問題文のことば", v.sub || "-"]]; },
      no: function () { return "ルータに接続する話ではない"; },
      test: function (v) { return !!v.sub; } },

    { key: "voice", cue: "IP Phone をつなぐ", cond: "電話をつなぐ",
      verdict: "switchport access vlan と switchport voice vlan を設定する",
      why: "IP 電話とパソコンを1本のケーブルで接続するときは、トランクにしない。データ用に access vlan、音声用に voice vlan を設定する",
      look: ["どこにつなぐか（問題文）"],
      steps: function (v) { return [["問題文のことば", v.voice || "-"]]; },
      no: function () { return "電話の話ではない"; },
      test: function (v) { return !!v.voice; } },

    { key: "dtp", cue: "DTP を使う", cond: "DTP に任せる、と書いてある",
      verdict: "switchport mode dynamic desirable にする",
      why: "DTP は、相手と交渉してトランクにするかどうかを決める仕組み。desirable は、自分から交渉を始める側",
      look: ["どこにつなぐか（問題文）"],
      steps: function (v) { return [["問題文のことば", v.dtp || "-"]]; },
      no: function () { return "DTP を使えとは書かれていない"; },
      test: function (v) { return !!v.dtp; } },

    { key: "notag", cue: "タグに対応していない機器", cond: "相手が VLAN のタグに対応していない",
      verdict: "ネイティブVLAN として、タグなしで転送する",
      why: "VLAN タグの付いたフレームを扱えない機器には、タグを付けない VLAN（ネイティブVLAN）で転送する",
      look: ["どこにつなぐか（問題文）"],
      steps: function (v) { return [["問題文のことば", v.notag || "-"]]; },
      no: function () { return "札に対応しない機器の話ではない"; },
      test: function (v) { return !!v.notag; } },

    { key: "access2trunk", cue: "Administrative Mode が static access", cond: "いまアクセスのままになっている",
      mark: ["static access"],
      verdict: "switchport mode trunk にして、カプセル化を dot1q にする",
      why: "Administrative Mode が static access のままでは、複数の VLAN を転送できない。カプセル化の設定より先に、まず mode trunk にする",
      look: ["現在のモード（Administrative Mode）"],
      steps: function (v) { return [["現在のモード", v.access || "-"]]; },
      no: function () { return "アクセスのままではない"; },
      test: function (v) { return !!v.access; } },

    { key: "isl", cue: "カプセル化が isl", cond: "トランクだが、カプセル化が isl になっている",
      verdict: "isl を削除して dot1q にし、足りない VLAN を add で追加する",
      why: "isl はシスコ独自の古い方式。両側で同じにしないとトランクにならないので、標準の dot1q に直す",
      look: ["カプセル化（Encapsulation）"],
      steps: function (v) { return [["現在のカプセル化", v.isl || "-"]]; },
      no: function () { return "カプセル化は isl ではない"; },
      test: function (v) { return !!v.isl; } },

    { key: "addvlan", cue: "新しい VLAN を通す", cond: "新しい VLAN を、そのトランクで転送したい",
      verdict: "switchport trunk allowed vlan add で追加する",
      why: "add を付けないと、いま転送している VLAN が一覧から消える。置き換えではなく追加するつもりで設定する",
      look: ["通してよい VLAN の一覧（Trunking VLANs Enabled）"],
      steps: function (v) { return [["現在の一覧", v.enabled || "-"]]; },
      no: function () { return "新しい VLAN を足す話ではない"; },
      test: function (v) { return !!v.addvlan; } },

    { key: "native", cue: "ネイティブVLAN を既定以外にする", cond: "ネイティブVLAN を既定（1）以外にする、と書いてある",
      verdict: "switchport trunk native vlan を 1 以外にする",
      why: "ネイティブVLAN が 1 のままだと、タグの付いていないフレームが既定の VLAN に流れ込む。安全のために 1 以外にする",
      look: ["ネイティブVLAN"],
      steps: function (v) { return [["現在のネイティブVLAN", v.nativeNo || "1（既定）"]]; },
      no: function () { return "ネイティブVLAN を変える話ではない"; },
      test: function (v) { return !!v.native1; } },

    { key: "role", cue: "スイッチ間と端末側の両方を設定する", cond: "スイッチ間と、端末側の両方を設定する",
      verdict: "スイッチ間はトランク、端末側はアクセスにする",
      why: "トランクにするのはスイッチどうしをつなぐ線だけ。パソコンやサーバを接続するインターフェースはアクセスにする",
      look: ["どこにつなぐか（問題文）"],
      steps: function (v) { return [["問題文のことば", v.role || "-"]]; },
      no: function () { return "両方を設定する話ではない"; },
      test: function (v) { return !!v.role; } },

    { key: "totrunk", cue: "対向の出力に合わせる", cond: "そのほか（いまアクセスのままなので、トランクにする）",
      mark: ["同じにそろえ"],
      verdict: "switchport mode trunk にして、カプセル化を dot1q にする",
      why: "Administrative Mode が static access のままでは、複数の VLAN を転送できない。まず mode trunk にする",
      look: ["現在のモード（Administrative Mode）", "カプセル化（Encapsulation）"],
      steps: function (v) {
        return [["現在のモード", v.access || v.mode || "（出力に無い）"],
                ["カプセル化", v.encap || "-"]];
      },
      no: function () { return "ここまでで決まっている"; },
      test: function () { return true; } }
  ];

  var GLOSS = {
    "ルータにサブインターフェースを作り、encapsulation dot1Q と IP アドレスを設定する": "VLAN ごとに、ルータ側の受け口を1つずつ作る",
    "switchport access vlan と switchport voice vlan を設定する": "1本のケーブルで、パソコンと IP 電話を別々の VLAN に分ける",
    "switchport mode dynamic desirable にする": "自分から交渉を始めて、相手とトランクを組む",
    "ネイティブVLAN として、タグなしで転送する": "VLAN タグを扱えない機器には、タグを付けずに転送する",
    "isl を削除して dot1q にし、足りない VLAN を add で追加する": "シスコ独自の古い方式をやめて、標準の方式にそろえる",
    "switchport trunk allowed vlan add で追加する": "add を忘れると、いまの一覧が置き換わって消える",
    "switchport trunk native vlan を 1 以外にする": "既定のままだと、タグの付いていないフレームが既定の VLAN に流れ込む",
    "スイッチ間はトランク、端末側はアクセスにする": "トランクにするのは、スイッチどうしをつなぐ線だけ",
    "switchport mode trunk にして、カプセル化を dot1q にする": "アクセスのままでは、複数の VLAN を転送できない"
  };

  /* 本の答えの言い回しと突き合わせるための言葉 */
  var SAME = {
    "ルータにサブインターフェースを作り、encapsulation dot1Q と IP アドレスを設定する": ["encapsulation dot1"],
    "switchport access vlan と switchport voice vlan を設定する": ["voice vlan"],
    "switchport mode dynamic desirable にする": ["dynamic desirable"],
    "ネイティブVLAN として、タグなしで転送する": ["native vlan"],
    "isl を削除して dot1q にし、足りない VLAN を add で追加する": ["no switchport trunk encapsulation isl"],
    "switchport trunk allowed vlan add で追加する": ["allowed vlan add"],
    "switchport trunk native vlan を 1 以外にする": ["native vlan"],
    "スイッチ間はトランク、端末側はアクセスにする": ["switchport mode access"],
    "switchport mode trunk にして、カプセル化を dot1q にする": ["mode trunk"]
  };

  /* ── 出力を作る ─────────────────────────── */
  function baseVals() {
    return {
      sw: pick(["SW1", "SW2", "Cat9300-1", "AccSw1"]),
      ifn: pick(["Gi1/0/1", "Fa0/1", "Et0/0"]),
      mode: "static access",
      encap: pick(["dot1q", "negotiate"]),
      nat: 1,
      list: pick(["1,22", "100,200,300", "1-10"]),
      v: pick([5, 10, 20, 23, 100]),
      nv: pick([99, 321, 500]),
      ip: "10." + R(10, 30) + "." + R(1, 30) + ".1"
    };
  }

  function sw(v) {
    return [
      v.sw + "# show interface " + v.ifn + " switchport",
      "Name: " + v.ifn,
      "Switchport: Enabled",
      "Administrative Mode: " + v.mode,
      "Operational Mode: " + (v.mode === "trunk" ? "trunk" : "static access"),
      "Administrative Trunking Encapsulation: " + v.encap,
      "Negotiation of Trunking: On",
      "Access Mode VLAN: 1 (default)",
      "Trunking Native Mode VLAN: " + v.nat + (v.nat === 1 ? " (default)" : ""),
      "Trunking VLANs Enabled: " + v.list
    ].join("\n");
  }

  function build(v) { return v.need + "\n\n" + sw(v); }

  var MAKERS = {
    sub: function (b) {
      b.mode = "trunk"; b.encap = "dot1q";
      b.need = "ルータの " + b.ifn + " にサブインターフェースを足して、VLAN " + b.v +
               "（" + b.ip + "/24）を通します。どのコマンドが必要ですか。";
      return b;
    },
    voice: function (b) {
      b.mode = "trunk"; b.encap = "dot1q";
      b.need = "この口に Cisco IP Phone とパソコンをつなぎます。音声は VLAN " + b.v +
               " を使います。どの設定をしますか。";
      return b;
    },
    dtp: function (b) {
      b.mode = "trunk"; b.encap = "dot1q";
      b.need = "相手のスイッチとは DTP を使ってつなぎます。どの設定をしますか。";
      return b;
    },
    notag: function (b) {
      b.mode = "trunk"; b.encap = "dot1q";
      b.need = "相手はトランク ポートをサポートしていないサードパーティ製の機器です。" +
               "現在の通信を保ったまま、どの設定をしますか。";
      return b;
    },
    access2trunk: function (b) {
      b.mode = "static access"; b.encap = "negotiate";
      b.need = "この線に VLAN をいくつも通せるようにします。どの設定をしますか。";
      return b;
    },
    isl: function (b) {
      b.mode = "trunk"; b.encap = "isl";
      b.need = "相手側は dot1q です。この線をトランクにして、VLAN " + b.v +
               " も通したい。どの設定をしますか。";
      return b;
    },
    addvlan: function (b) {
      b.mode = "trunk"; b.encap = "dot1q";
      b.need = "この線に、新しく VLAN " + b.v + " を実装します。どの設定をしますか。";
      return b;
    },
    native: function (b) {
      b.mode = "trunk"; b.encap = "dot1q";
      b.need = "2つの VLAN を通します。会社の決まりで、ネイティブ VLAN をデフォルト以外の値にします。どの設定をしますか。";
      return b;
    },
    role: function (b) {
      b.mode = "trunk"; b.encap = "dot1q";
      b.need = "スイッチどうしと、サーバをつなぐ口の両方を設定して、完全な接続にします。どの設定をしますか。";
      return b;
    },
    totrunk: function (b) {
      b.mode = "trunk"; b.encap = "dot1q"; b.nat = b.nv;
      b.need = "相手側の " + b.ifn + " の出力を見て、こちら側を同じにそろえます。どの設定をしますか。";
      return b;
    }
  };

  function sample() {
    return [
      "ルータの Gi0/0 にサブインターフェースを足して、VLAN 20 を通します。どのコマンドが必要ですか。",
      "（ほかの聞かれ方：IP Phone をつなぐ／DTP を使う／タグに対応していない相手／" +
        "新しく VLAN 23 を実装する／ネイティブ VLAN をデフォルト以外にする／完全な接続にする）",
      "",
      sw({ sw: "SW1", ifn: "Et0/0", mode: "static access", encap: "isl",
           nat: 1, list: "1,22" })
    ].join("\n");
  }


  /* ── 最後の3問のうち2問は、打つコマンドの並びで答える ─────────
   * 本の19問のうち17問は、選択肢が打つコマンドの並び。
   * **誤答の顔ぶれは、本の同じ問題が出しているものを写す。**出どころは各行に書いた。
   */
  function cmdSet(key, v) {
    var L = function () {
      return Array.prototype.slice.call(arguments).join("\n");
    };
    if (key === "sub") {                         /* B1-P15-083。番号のずらしが罠 */
      return { right: L("interface " + v.ifn + "." + v.v,
                        "encapsulation dot1Q " + v.v,
                        "ip address " + v.ip + " 255.255.255.0"),
               wrong: [L("interface " + v.ifn + "." + v.v,
                         "encapsulation dot1Q " + v.nv,
                         "ip address " + v.ip + " 255.255.255.0"),
                       L("interface " + v.ifn,
                         "ip address " + v.ip + " 255.255.255.0"),
                       L("interface " + v.ifn + "." + v.v,
                         "encapsulation dot1Q " + v.v + " native",
                         "ip address " + v.ip + " 255.255.255.0")] };
    }
    if (key === "voice") {                       /* B2-0150-01 */
      return { right: L("interface " + v.ifn, "switchport mode access",
                        "switchport access vlan " + v.v,
                        "switchport voice vlan " + v.nv),
               wrong: [L("interface " + v.ifn, "switchport voice vlan dot1p"),
                       L("interface " + v.ifn, "switchport mode trunk",
                         "switchport trunk allowed vlan " + v.v + "," + v.nv),
                       L("interface " + v.ifn, "switchport mode trunk",
                         "channel-group " + v.nv + " mode active")] };
    }
    if (key === "dtp") {                         /* B2-0140-01 */
      return { right: L("switchport mode dynamic desirable",
                        "switchport trunk allowed vlan add " + v.v),
               wrong: [L("switchport mode dynamic auto",
                         "switchport trunk encapsulation negotiate"),
                       L("switchport mode trunk",
                         "switchport trunk pruning vlan add " + v.v),
                       L("switchport mode dynamic auto",
                         "switchport private-vlan association host " + v.v)] };
    }
    if (key === "notag") {                       /* B1-P11-038 */
      return { right: L("switchport mode trunk",
                        "switchport trunk native vlan " + v.v),
               wrong: [L("switchport mode access",
                         "switchport trunk native vlan " + v.v),
                       L("switchport mode trunk",
                         "switchport trunk native vlan 1"),
                       L("switchport mode access",
                         "switchport access vlan " + v.v)] };
    }
    if (key === "access2trunk" || key === "totrunk") {   /* B1-P12-048・B1-P11-053 */
      return { right: L("switchport mode trunk",
                        "switchport trunk encapsulation dot1q"),
               wrong: [L("switchport mode trunk",
                         "switchport trunk allowed vlan all",
                         "switchport dot1q ethertype 0800"),
                       L("switchport mode dynamic desirable",
                         "switchport trunk allowed vlan all"),
                       L("switchport dynamic auto", "switchport nonegotiate")] };
    }
    if (key === "isl") {                         /* B1-P13-001 */
      return { right: L("no switchport trunk encapsulation isl",
                        "switchport trunk encapsulation dot1q",
                        "switchport trunk allowed vlan add " + v.v),
               wrong: [L("no switchport mode trunk",
                         "switchport trunk encapsulation isl",
                         "switchport mode access vlan " + v.v),
                       L("switchport nonegotiate",
                         "switchport trunk allowed vlan " + v.list + "," + v.v),
                       L("switchport mode dynamic",
                         "switchport trunk allowed vlan " + v.list)] };
    }
    if (key === "addvlan") {                     /* B1-P16-001 */
      return { right: "switchport trunk allowed vlan add " + v.v,
               wrong: ["switchport trunk allowed vlan " + v.v,
                       "switchport trunk allowed vlan " + v.list,
                       "switchport trunk allowed vlan 2-1001"] };
    }
    if (key === "native") {                      /* B1-P13-091 */
      return { right: L("switchport mode trunk",
                        "switchport trunk encapsulation dot1q",
                        "switchport trunk native vlan " + v.nv),
               wrong: [L("switchport mode trunk",
                         "switchport trunk encapsulation isl",
                         "switchport trunk native vlan " + v.nv),
                       L("switchport mode trunk",
                         "switchport trunk encapsulation dot1q",
                         "switchport trunk native vlan 1"),
                       L("switchport mode access",
                         "switchport access vlan " + v.nv)] };
    }
    /* role。B2-0111-01。スイッチ間はトランク、端末側はアクセス */
    return { right: L("interface " + v.ifn, "switchport mode access",
                      "switchport access vlan " + v.v,
                      "!", "interface Gi1/0/24", "switchport mode trunk"),
             wrong: [L("interface " + v.ifn, "switchport access vlan " + v.v,
                       "!", "interface Gi1/0/24", "switchport mode trunk"),
                     L("interface " + v.ifn, "switchport mode trunk",
                       "!", "interface Gi1/0/24", "switchport mode trunk"),
                     L("interface " + v.ifn, "switchport mode access",
                       "switchport access vlan " + v.v,
                       "!", "interface Gi1/0/24", "switchport mode access")] };
  }

  /* その答えだけが当てはまる印。誤答が1つも当てはまらないことを build.js が見る */
  var CMDMARK = {
    sub: function (o, v) { return o.indexOf("encapsulation dot1Q " + v.v + "\n") >= 0; },
    voice: function (o, v) { return o.indexOf("switchport voice vlan " + v.nv) >= 0; },
    dtp: function (o) { return o.indexOf("mode dynamic desirable") >= 0; },
    notag: function (o, v) {
      return o.indexOf("mode trunk") >= 0 && o.indexOf("native vlan " + v.v) >= 0;
    },
    access2trunk: function (o) {
      return o.indexOf("mode trunk") >= 0 && o.indexOf("encapsulation dot1q") >= 0;
    },
    totrunk: function (o) {
      return o.indexOf("mode trunk") >= 0 && o.indexOf("encapsulation dot1q") >= 0;
    },
    isl: function (o) { return o.indexOf("no switchport trunk encapsulation isl") >= 0; },
    addvlan: function (o, v) { return o.indexOf("allowed vlan add " + v.v) >= 0; },
    native: function (o, v) {
      return o.indexOf("encapsulation dot1q") >= 0 && o.indexOf("native vlan " + v.nv) >= 0;
    },
    role: function (o) {
      return o.indexOf("switchport mode access") >= 0 && o.indexOf("mode trunk") >= 0;
    }
  };

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
    sub: "サブインターフェースの番号（0/0.20 の .20）は名前にすぎない。" +
         "VLAN を決めているのは encapsulation dot1q の後ろの番号のほう",
    voice: "1本のケーブルにパソコンと IP 電話をつなぐが、トランクにはしない。" +
           "データが access vlan、音声が voice vlan",
    dtp: "desirable は自分から交渉を始める側、auto は受けたときだけ応じる側",
    notag: "タグを付けない VLAN がネイティブVLAN。そこにその機器の VLAN 番号を入れて通す",
    access2trunk: "決め手は自分側の出力の Administrative Mode。" +
                  "dot1q は業界の標準の方式で、isl はシスコ独自の古い方式",
    isl: "両側で同じ方式でないとトランクにならない。no で isl を消してから dot1q にする",
    addvlan: "add を付けないと置きかえになり、いま通っている VLAN が消える",
    native: "既定は 1。1 以外であれば番号は自由に選んでよい",
    role: "トランクにするのはスイッチどうしをつなぐ線だけ。パソコンやサーバの側はアクセス",
    totrunk: "決め手は相手側の出力。自分側の出力の Administrative Mode を見る問題とは、見る場所が逆になる"
  };

  var spec = {
    id: "trunk",
    /* 出題パターン＝どのルールで答えにたどり着くか。
       絞ったせいでパターンが消えていないかを、build.js が毎回見る */
    pattern: E.cuePattern, patterns: ["access2trunk", "addvlan", "dtp", "isl", "native", "notag", "role", "sub", "totrunk", "voice"],
    kind: "rules",
    card: "config",
    name: "トランクと VLAN",
    note: "スイッチどうしの線に、複数の VLAN を通す設定を選ぶ",
    obj: "2.2",
    ask: "この要件を満たす設定はどれですか。",
    wantsQuestion: true,
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample, /* 決め手が出力の中にあるルール。ここだけ見本の現物を出す */
    learnOut: ["access2trunk", "isl", "addvlan", "native"],
    wholeQ: wholeQ, cmdSet: cmdSet, cmdMark: CMDMARK,
    brief: E.cueBrief(RULES, NOTE), answerNote: E.cueAnswerNote(RULES, GLOSS),
    stepQ: E.cueStepQ(RULES),
    /* 規則では出せないが、テストには出す問題 */
    bookOnly: ["B3-M3-020"],
    expect: { spots: 5, rules: 10, questions: 17 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.trunk = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
