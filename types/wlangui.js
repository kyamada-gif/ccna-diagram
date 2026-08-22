/* 「無線の画面を読む」ブロック（過去問14問）。
 *
 * 無線の親機をまとめる機械（WLC）の設定画面を見て、どこを触るかを答える。
 * 本の13問は「要件の言葉 → 画面のどの行か」の対応で決まる。決め方は9つ。
 *
 *   ① 台数を制限したい            → Maximum Allowed Clients
 *   ② 合言葉で入れたい            → WPA2 Policy ＋ PSK
 *   ③ 決めた機器だけ入れたい      → WPA2 Policy ＋ MAC フィルタリング
 *   ④ 先に DHCP と DNS だけ通したい → レイヤ3 の Web ポリシーと認証
 *   ⑤ 別のサブネットに載せたい    → Interface/Interface Group
 *   ⑥ ソフトを入れたい（ポート22）→ File Type と Transfer Mode
 *   ⑦ 端末どうしの通信を止めたい  → P2P Blocking Action を Drop
 *   ⑧ 2つの周波数を使い分けたい   → Client Band Select ＋ AAA Override
 *   ⑨ 暗号の種類を選びたい        → AES（CCMP128）＋ PSK
 *
 * **誤答は「名前の似ている別の行」。**本の解説にも「ひっかけ」と書いてある。
 * だから練習では、画面のどの行かを1つずつ覚える。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "need", name: "要件の言葉（問題文）",
      re: /(したい|しますか|ますか|要件|設定)/,
      mean: "「事前共有キーで接続させる」「特定の機器だけ許可する」「接続台数を制限する」など、問題文に書かれた条件",
      use: "この種類の問題は、要件の言葉と設定画面の項目がほぼ1対1で対応する。まず要件を読む" },

    { key: "tab", name: "どのタブか",
      re: /(General|Security|QoS|Policy-Mapping|Advanced|Commands)/,
      mean: "General は SSID 名と所属させるインターフェース、Security はセキュリティ、Advanced は細かい動作の設定",
      use: "セキュリティについてなら Security、所属させるインターフェースなら General、端末どうしの通信や周波数帯なら Advanced" },

    { key: "l2", name: "Layer 2 のセキュリティ",
      re: /(Layer 2 Security|WPA|MAC Filtering|PSK|802\.1X|CCKM|SAE)/i,
      mean: "事前共有キー（PSK）で認証するか、認証サーバ（802.1X）で認証するか。特定の機器だけを許可するか（MAC Filtering）",
      use: "「認証サーバの代わりに事前共有キーを使う」なら PSK。「特定の機器だけ許可する」なら MAC Filtering。CCKM や FT はローミングを速くする仕組みで、認証の方式ではない" },

    { key: "l3", name: "Layer 3 のセキュリティ",
      re: /(Layer 3|Web ポリシー|Web Policy|認証)/i,
      mean: "先にブラウザ上で認証させてから、通信を許可する仕組み",
      use: "認証が済むまで DHCP と DNS だけ通し、認証画面へ誘導したいときは、ここの Web ポリシーを使う" },

    { key: "adv", name: "Advanced の行",
      re: /(P2P Blocking|Client Band Select|AAA Override|Maximum Allowed Clients|Fast Transition)/i,
      mean: "端末どうしの通信、周波数帯の選び方、接続台数の上限、ローミングの速さ",
      use: "名前の似た項目が並んでいる。端末どうしの通信を遮断するのは P2P Blocking Action で、Wi-Fi Direct の項目ではない" }
  ];

  function join(x) {
    if (x && typeof x === "object" && x.exhibit !== undefined) {
      return String(x.text || "") + "\n" + String(x.exhibit || "");
    }
    return String(x || "");
  }

  var PAT = {
    clients: /(デバイスの数|台に制限|クライアント数)/,
    psk: /(RADIUS\s*サーバーの代わり|事前共有キー|セットアップ\s*パスワード)/,
    macf: /(特定のクライアントのみ|決めた機器|MAC\s*フィルタ)/i,
    weblogin: /(DHCP\s*パケットと\s*DNS|DNS\s*パケットのみ)/i,
    subnet: /(別サブネット|別のサブネット|サブネットに接続)/,
    download: /(ソフトウェアをインストール|Download File|ポート\s*22)/i,
    p2p: /(P2P|ピアツーピア|クライアント同士)/i,
    band: /(デュアルバンド|バンド選択)/i,
    /* 「事前共有キー ベースの SSID」は、本（B2-0250-01）の問題文の言い方。
       この問題の正解は2つ（AES(CCMP128) を選ぶ ＋ PSK を選ぶ）だが、
       「事前共有キー」だけを見て psk と判定していたので、
       答えの半分（AES）が答え合わせに出ていなかった */
    aes: /(暗号化|AES|CCMP|事前共有キー\s*ベース)/i,
    ft: /(Fast Transition|ローミング)/i,
    l2sec: /Layer 2 Security\s*[:：]?\s*(\S+)/i
  };

  /* 要件の言葉は**問題文のほうだけ**を見る。
     画面の中にも「P2P Blocking Action」「WPA2 Encryption」といった言葉が
     並んでいるので、全体から探すと取り違える */
  var NEEDKEYS = ["clients", "psk", "macf", "weblogin", "subnet",
                  "download", "p2p", "band", "aes", "ft"];

  function read(x) {
    var t = join(x), out = {};
    var q = (x && typeof x === "object" && x.text !== undefined)
      ? String(x.text)
      : t.split(/\n\s*\n/)[0];       /* 作った問題は、1つめの段が問題文 */
    Object.keys(PAT).forEach(function (k) {
      var src = NEEDKEYS.indexOf(k) >= 0 ? q : t;
      var m = src.match(PAT[k]);
      out[k] = m ? (m[1] || m[0]) : null;
    });
    out.all = t;
    return out;
  }

  function excerpt(x) {
    /* **問題文の段と、画面の段の間の空行を残す。**
       この空行で「どこまでが問題文か」を見分けているため */
    var t = join(x), lines = t.split("\n"), out = [lines[0], ""];
    lines.slice(1).forEach(function (l) {
      if (/デバイスの数|台に制限|RADIUS|事前共有|特定のクライアント|DHCP|DNS|サブネット|インストール|P2P|デュアルバンド|暗号化|ローミング/.test(l)
          || /Layer 2 Security|Layer 3|MAC Filtering|PSK|P2P Blocking|Band Select|Maximum Allowed|Fast Transition|File Type/i.test(l)) out.push(l);
    });
    return out.join("\n");
  }

  /* ── 判定ルール ─────────────────────────── */
  var RULES = [
    { key: "clients", cue: "接続できる台数を制限する", cond: "接続できる台数を制限したい",
      say: "この SSID につなげる台数を決めたい",
      verdict: "Maximum Allowed Clients に、許可する台数を指定する",
      why: "接続台数の上限は Advanced タブの Maximum Allowed Clients。Maximum Allowed Clients Per AP Radio はアクセスポイント1台あたりの上限で、別の設定",
      look: ["Advanced の行"],
      steps: function (v) { return [["要件のことば", v.clients || "-"]]; },
      no: function () { return "台数の話ではない"; },
      test: function (v) { return !!v.clients; } },

    { key: "weblogin", cue: "DHCP と DNS だけ許可する", cond: "認証前に DHCP と DNS だけ通したい",
      say: "認証が済むまでは、最低限の通信だけ通したい",
      verdict: "Layer 3 の Web ポリシーと認証を有効にする",
      why: "先にブラウザ上で認証させたいときの設定。認証が済むまでは、IP アドレスの取得（DHCP）と名前解決（DNS）だけを通す",
      look: ["Layer 3 の守り"],
      steps: function (v) { return [["要件のことば", v.weblogin || "-"]]; },
      no: function () { return "先に一部だけ通す話ではない"; },
      test: function (v) { return !!v.weblogin; } },

    { key: "macf", cue: "特定のクライアントのみ参加させる", cond: "特定の機器だけ接続させたい",
      say: "決めた機器だけを参加させたい",
      verdict: "WPA2 Policy を有効にし、MAC フィルタリングも有効にする",
      why: "事前共有キーだけでは、キーを知っている機器はすべて接続できてしまう。接続できる機器を MAC アドレスで限定するのが MAC フィルタリング",
      look: ["Layer 2 の守り"],
      steps: function (v) { return [["要件のことば", v.macf || "-"], ["現在の守り", v.l2sec || "-"]]; },
      no: function () { return "機器を名指しで絞る話ではない"; },
      test: function (v) { return !!v.macf; } },

    { key: "download", cue: "ソフトウェアをインストールする", cond: "ソフトウェアを転送したい",
      say: "機器にソフトウェアを入れたい",
      verdict: "File Type を Code、Transfer Mode を SFTP にして、サーバの IP アドレスを指定する",
      why: "ポート 22 を使うのは SFTP。転送するのがソフトウェア本体なので、File Type は Code を選ぶ",
      look: ["どのタブか"],
      steps: function (v) { return [["要件のことば", v.download || "-"]]; },
      no: function () { return "ソフトを入れる話ではない"; },
      test: function (v) { return !!v.download; } },

    { key: "p2p", cue: "クライアント同士の通信を止める", cond: "端末どうしの通信を遮断したい",
      say: "同じ SSID の端末どうしを通信させたくない",
      verdict: "P2P Blocking Action を Drop にする",
      why: "同じ SSID に接続した端末どうしの通信を破棄する。Wi-Fi Direct Clients Policy は名前が似ているだけの別の設定",
      look: ["Advanced の行"],
      steps: function (v) { return [["要件のことば", v.p2p || "-"]]; },
      no: function () { return "端末どうしの通信の話ではない"; },
      test: function (v) { return !!v.p2p; } },

    { key: "band", cue: "デュアルバンドのクライアント", cond: "2つの周波数帯を使い分けたい",
      say: "両方の周波数に対応する端末を、空いている側へ寄せたい",
      verdict: "Client Band Select と AAA Override を有効にする",
      why: "両方の周波数帯に対応する端末を、空いている側へ誘導する。接続ごとに設定を変えるには AAA Override も必要",
      look: ["Advanced の行"],
      steps: function (v) { return [["要件のことば", v.band || "-"]]; },
      no: function () { return "周波数の話ではない"; },
      test: function (v) { return !!v.band; } },

    { key: "subnet", cue: "別のサブネットに接続させる", cond: "別のサブネットに所属させたい",
      say: "つないだ人を、別のサブネットに所属させたい",
      verdict: "Status を有効にして、Interface/Interface Group で所属させる先を選ぶ",
      why: "どのサブネットに所属させるかは General タブで設定する。セキュリティは Security タブなので、ここでは扱わない",
      look: ["どのタブか"],
      steps: function (v) { return [["要件のことば", v.subnet || "-"]]; },
      no: function () { return "載せる先の話ではない"; },
      test: function (v) { return !!v.subnet; } },

    { key: "aes", cue: "暗号化の種類を選ぶ", cond: "暗号化方式を選びたい",
      say: "WPA2 で使う暗号の種類を選ぶ話",
      verdict: "AES（CCMP128）を選び、認証方式は PSK にする",
      why: "WPA2 で事前共有キーを使うときの、決まった組み合わせ。CCMP256 や GCMP は WPA3 で使うもの",
      look: ["Layer 2 の守り"],
      steps: function (v) { return [["要件のことば", v.aes || "-"]]; },
      no: function () { return "暗号の種類の話ではない"; },
      test: function (v) { return !!v.aes; } },

    { key: "psk", cue: "RADIUS サーバの代わりに事前共有キー", cond: "そのほか（事前共有キーで接続させる）",
      say: "認証サーバを使わず、事前共有キーで入れたい",
      verdict: "WPA2 Policy を有効にし、PSK を有効にする",
      why: "「認証サーバの代わりに事前共有キーを使う」なら PSK。802.1X は認証サーバを使う方式なので、ここでは選ばない",
      look: ["Layer 2 の守り"],
      steps: function (v) { return [["現在の守り", v.l2sec || "-"]]; },
      no: function () { return "ここまでで決まっている"; },
      test: function () { return true; } }
  ];

  var GLOSS = {
    "Maximum Allowed Clients に、許可する台数を指定する": "Per AP Radio はアクセスポイント1台あたりの上限で、別の設定",
    "Layer 3 の Web ポリシーと認証を有効にする": "先にブラウザ上で認証させる設定",
    "WPA2 Policy を有効にし、MAC フィルタリングも有効にする": "事前共有キーに加えて、接続できる機器を MAC アドレスで限定する",
    "File Type を Code、Transfer Mode を SFTP にして、サーバの IP アドレスを指定する": "ポート 22 を使うのは SFTP",
    "P2P Blocking Action を Drop にする": "Wi-Fi Direct の設定と間違えやすい",
    "Client Band Select と AAA Override を有効にする": "空いている周波数帯へ端末を誘導する",
    "Status を有効にして、Interface/Interface Group で所属させる先を選ぶ": "所属させる先は General タブで設定する",
    "AES（CCMP128）を選び、認証方式は PSK にする": "CCMP256 や GCMP は WPA3 で使うもの",
    "WPA2 Policy を有効にし、PSK を有効にする": "802.1X は認証サーバを使う方式"
  };

  var SAME = {
    /* 本によって書き方が違う。B1 は英語の項目名、B2 は日本語に訳してある */
    "Maximum Allowed Clients に、許可する台数を指定する": ["Maximam Allowed Clients", "Maximum Allowed Clients", "最大許可クライアント数"],
    "Layer 3 の Web ポリシーと認証を有効にする": ["Web ポリシー"],
    "WPA2 Policy を有効にし、MAC フィルタリングも有効にする": ["MAC フィルタリング"],
    "File Type を Code、Transfer Mode を SFTP にして、サーバの IP アドレスを指定する": ["SFTP"],
    "P2P Blocking Action を Drop にする": ["P2P Blocking Action"],
    "Client Band Select と AAA Override を有効にする": ["バンド選択"],
    "Status を有効にして、Interface/Interface Group で所属させる先を選ぶ": ["Interface/Interface Group"],
    "AES（CCMP128）を選び、認証方式は PSK にする": ["AES"],
    "WPA2 Policy を有効にし、PSK を有効にする": ["PSK"]
  };

  /* ── 画面を作る ─────────────────────────── */
  function baseVals() {
    return {
      ssid: pick(["USERWL", "My_WLAN", "Office_WLan", "Guest"]),
      n: pick([50, 125, 200]),
      iface: pick(["Data", "Voice", "Guest"]),
      l2: pick(["WPA+WPA2", "WPA2+WPA3", "None"])
    };
  }

  function gui(v) {
    return [
      "【WLC の画面：WLAN の設定】",
      "（タブ： General ／ Security ／ QoS ／ Policy-Mapping ／ Advanced）",
      "",
      "General",
      "  Profile Name        " + v.ssid,
      "  Status              チェックなし",
      "  Interface/Interface Group(G)   management",
      "",
      "Security ＞ Layer 2",
      "  Layer 2 Security    " + v.l2,
      /* 暗号の種類は、選べるものを並べて出す。
         説明の一言で「CCMP256 や GCMP は WPA3 で使うもの」と注意しているので、
         その名前が画面にも並んでいないと、注意のしようがない */
      "  WPA2/WPA3 Encryption    AES(CCMP128) ／ CCMP256 ／ GCMP128 ／ GCMP256",
      "  MAC Filtering       チェックなし",
      "  PSK                 Enable（チェックなし）",
      "  802.1X              Enable（チェックなし）",
      "",
      "Security ＞ Layer 3",
      "  Web ポリシー        チェックなし",
      "",
      "Advanced",
      "  P2P Blocking Action        Disabled",
      "  Client Band Select         チェックなし",
      "  Allow AAA Override         チェックなし",
      "  Maximum Allowed Clients    0",
      /* **名前の似た項目を、画面にも並べる。**
         説明の一言で「名前が似ているだけの別の設定」と注意しているのに、
         その行が画面に無いと、注意のしようがない（本の紙面には並んでいる） */
      "  Maximum Allowed Clients Per AP Radio    200",
      "  Wi-Fi Direct Clients Policy    Disabled",
      "  Fast Transition            Adaptive"
    ].join("\n");
  }

  function build(v) { return v.need + "\n\n" + gui(v); }

  var MAKERS = {
    clients: function (b) {
      b.need = "SSID「" + b.ssid + "」につなげるデバイスの数を " + b.n + " 台に制限します。どの設定をしますか。";
      return b;
    },
    weblogin: function (b) {
      b.need = "認証が済むまでは、DHCP パケットと DNS パケットのみを許可します。どの設定をしますか。";
      return b;
    },
    macf: function (b) {
      b.need = "WPA2 の合言葉に加えて、特定のクライアントのみが参加できるようにします。どの設定をしますか。";
      return b;
    },
    download: function (b) {
      b.need = "TCP ポート 22 を使って、新しいソフトウェアをインストールします。どのタスクを実行しますか。";
      return b;
    },
    p2p: function (b) {
      b.need = "選んだ SSID で、クライアント同士（P2P）の通信をブロックします。どの設定をしますか。";
      return b;
    },
    band: function (b) {
      b.need = "デュアルバンドのクライアントを、すいている周波数へ寄せます。接続ごとに設定も変えます。どの設定をしますか。";
      return b;
    },
    subnet: function (b) {
      b.need = "「" + b.ssid + "」につなぐ人を、別のサブネット「" + b.iface + "」に接続させます。どの追加設定をしますか。";
      return b;
    },
    aes: function (b) {
      b.need = "WPA2 で、安全な事前共有キーによる暗号化を使います。どのオプションを選びますか。";
      return b;
    },
    psk: function (b) {
      b.need = "認証には RADIUS サーバーの代わりに、セットアップ パスワードを使います。どの設定をしますか。";
      return b;
    }
  };

  function sample() {
    return [
      "認証には RADIUS サーバーの代わりに、セットアップ パスワードを使います。どの設定をしますか。",
      "（ほかの聞かれ方：デバイスの数を 125 台に制限／特定のクライアントのみ参加／" +
        "DHCP パケットと DNS パケットのみ許可／別のサブネットに接続／ポート 22 でソフトウェアをインストール／" +
        "P2P の通信をブロック／デュアルバンドのバンド選択／暗号化に AES を選ぶ／Fast Transition でローミング）",
      "",
      gui({ ssid: "My_WLAN", l2: "WPA+WPA2" })
    ].join("\n");
  }


  /* ── 説明の1枚に添える一言 ─────────────────────
   * **取り違えやすい所だけ。**判定ルールの理由（why）をもう一度書かない。
   */
  var NOTE = {
    clients: { rows: [
      { c: "Maximum Allowed Clients", m: "この SSID の上限" },
      { c: "… Per AP Radio", m: "AP 1台あたりの上限（別）" }] },
    weblogin: "認証が済むまで通すのは、IP アドレスの取得（DHCP）と名前解決（DNS）だけ",
    macf: "事前共有キーだけでは、キーを知っている機器がすべてつながってしまう",
    download: "ポート 22 を使うのは SFTP。入れるのがソフトウェア本体なので、File Type は Code",
    p2p: { rows: [
      { c: "P2P Blocking Action", m: "端末どうしの通信を止める" },
      { c: "Wi-Fi Direct Clients Policy", m: "名前が似た別の設定" }] },
    band: "接続ごとに設定を変えることになるので、AAA Override も一緒に有効にする",
    subnet: { rows: [
      { c: "General タブ", m: "所属させる先を選ぶ" },
      { c: "Security タブ", m: "ここではない" }] },
    aes: "CCMP256 や GCMP は WPA3 で使うもの。WPA2 で選ぶのは AES（CCMP128）",
    psk: "802.1X は認証サーバを使う方式なので、ここでは選ばない"
  };

  var spec = {
    id: "wlangui",
    /* 出題パターン＝どのルールで答えにたどり着くか。
       絞ったせいでパターンが消えていないかを、build.js が毎回見る */
    pattern: E.cuePattern, patterns: ["aes", "band", "clients", "download", "macf", "p2p", "psk", "subnet", "weblogin"],
    kind: "rules",
    card: "misc",
    name: "無線の画面を読む",
    note: "無線 LAN コントローラの画面を読み、どの設定項目を変更するかを判断する",
    obj: "2.9",
    ask: "この要件なら、画面のどこを触りますか。",
    wantsQuestion: true,
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample, /* 決め手が出力の中にあるルール。ここだけ見本の現物を出す */
    learnOut: ["psk", "macf"],
    brief: E.cueBrief(RULES, NOTE), answerNote: E.cueAnswerNote(RULES, GLOSS),
    stepQ: E.cueStepQ(RULES, "画面のどこを触りますか。"),
    /* 「この画面から何が分かるか」を聞く問題。規則では出せないが、テストには出す */
    bookOnly: ["B1-P15-046", "B1-P16-065"],
    expect: { spots: 5, rules: 9, questions: 14 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.wlangui = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
