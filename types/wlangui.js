/* 「無線の画面を読む」ブロック（過去問13問）。
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
      mean: "「合言葉で」「決めた機器だけ」「台数を制限」など、やりたいこと",
      use: "この画面の問題は、要件の言葉と画面の行が1対1で決まる。まず要件を読む" },

    { key: "tab", name: "どのタブか",
      re: /(General|Security|QoS|Policy-Mapping|Advanced|Commands)/,
      mean: "General は名前と載せる先、Security は守り、Advanced は細かい動き",
      use: "守りの話なら Security、載せる先なら General、端末どうしの通信や周波数なら Advanced" },

    { key: "l2", name: "Layer 2 の守り",
      re: /(Layer 2 Security|WPA|MAC Filtering|PSK|802\.1X|CCKM|SAE)/i,
      mean: "合言葉（PSK）で入るか、認証サーバ（802.1X）で入るか。決めた機器だけにするか（MAC Filtering）",
      use: "「サーバの代わりに合言葉」なら PSK。「決めた機器だけ」なら MAC Filtering。CCKM や FT はローミングを速くするもので、入る手段ではない" },

    { key: "l3", name: "Layer 3 の守り",
      re: /(Layer 3|Web ポリシー|Web Policy|認証)/i,
      mean: "先にブラウザで認証させてから、通信を許す仕組み",
      use: "先に DHCP と DNS だけ通して、認証の画面に飛ばしたいときは、ここの Web ポリシーを使う" },

    { key: "adv", name: "Advanced の行",
      re: /(P2P Blocking|Client Band Select|AAA Override|Maximum Allowed Clients|Fast Transition)/i,
      mean: "端末どうしの通信・周波数の選び方・台数の上限・ローミングの速さ",
      use: "名前の似ている行が並んでいる。端末どうしを止めるのは P2P Blocking Action。Wi-Fi Direct の行ではない" }
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
    aes: /(暗号化|AES|CCMP)/i,
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
    { key: "clients", cue: "接続できる台数を制限する", cond: "つなげる台数を決めたい",
      verdict: "Maximum Allowed Clients に、その数を入れる",
      why: "台数の上限は Advanced タブの Maximum Allowed Clients。Maximum Allowed Clients Per AP Radio は、親機1台あたりの数で別もの",
      look: ["Advanced の行"],
      steps: function (v) { return [["要件のことば", v.clients || "-"]]; },
      no: function () { return "台数の話ではない"; },
      test: function (v) { return !!v.clients; } },

    { key: "weblogin", cue: "DHCP と DNS だけ許可する", cond: "先に DHCP と DNS だけ通したい",
      verdict: "Layer 3 の Web ポリシーと認証を有効にする",
      why: "先にブラウザの画面で認証させたいときの形。認証が済むまでは、住所をもらう（DHCP）と名前を引く（DNS）だけ通す",
      look: ["Layer 3 の守り"],
      steps: function (v) { return [["要件のことば", v.weblogin || "-"]]; },
      no: function () { return "先に一部だけ通す話ではない"; },
      test: function (v) { return !!v.weblogin; } },

    { key: "macf", cue: "特定のクライアントのみ参加させる", cond: "決めた機器だけ入れたい",
      verdict: "WPA2 Policy を有効にし、MAC フィルタリングも有効にする",
      why: "合言葉だけでは、合言葉を知っている機器はどれでも入れる。機器を名指しで絞るのが MAC フィルタリング",
      look: ["Layer 2 の守り"],
      steps: function (v) { return [["要件のことば", v.macf || "-"], ["現在の守り", v.l2sec || "-"]]; },
      no: function () { return "機器を名指しで絞る話ではない"; },
      test: function (v) { return !!v.macf; } },

    { key: "download", cue: "ソフトウェアをインストールする", cond: "ソフトを入れたい",
      verdict: "File Type を Code、Transfer Mode を SFTP にして、サーバの住所を入れる",
      why: "ポート22 を使うのは SFTP。入れるのがソフト本体なので、File Type は Code",
      look: ["どのタブか"],
      steps: function (v) { return [["要件のことば", v.download || "-"]]; },
      no: function () { return "ソフトを入れる話ではない"; },
      test: function (v) { return !!v.download; } },

    { key: "p2p", cue: "クライアント同士の通信を止める", cond: "端末どうしの通信を止めたい",
      verdict: "P2P Blocking Action を Drop にする",
      why: "同じ SSID につながった端末どうしの通信を落とす。Wi-Fi Direct Clients Policy は名前が似ているだけの別の行",
      look: ["Advanced の行"],
      steps: function (v) { return [["要件のことば", v.p2p || "-"]]; },
      no: function () { return "端末どうしの通信の話ではない"; },
      test: function (v) { return !!v.p2p; } },

    { key: "band", cue: "デュアルバンドのクライアント", cond: "2つの周波数を使い分けたい",
      verdict: "Client Band Select と AAA Override を有効にする",
      why: "両方の周波数に対応する端末を、空いている側へ誘導する。接続ごとに設定を変えるには AAA Override も要る",
      look: ["Advanced の行"],
      steps: function (v) { return [["要件のことば", v.band || "-"]]; },
      no: function () { return "周波数の話ではない"; },
      test: function (v) { return !!v.band; } },

    { key: "subnet", cue: "別のサブネットに接続させる", cond: "別のサブネットに載せたい",
      verdict: "Status を有効にして、Interface/Interface Group で載せる先を選ぶ",
      why: "どのサブネットに載せるかは General タブ。守りの設定は Security タブなので、ここでは触れない",
      look: ["どのタブか"],
      steps: function (v) { return [["要件のことば", v.subnet || "-"]]; },
      no: function () { return "載せる先の話ではない"; },
      test: function (v) { return !!v.subnet; } },

    { key: "aes", cue: "暗号化の種類を選ぶ", cond: "暗号の種類を選びたい",
      verdict: "AES（CCMP128）を選び、認証の鍵は PSK にする",
      why: "WPA2 で合言葉を使うときの決まった組み合わせ。CCMP256 や GCMP は WPA3 のもの",
      look: ["Layer 2 の守り"],
      steps: function (v) { return [["要件のことば", v.aes || "-"]]; },
      no: function () { return "暗号の種類の話ではない"; },
      test: function (v) { return !!v.aes; } },

    { key: "psk", cue: "RADIUS サーバの代わりに事前共有キー", cond: "そのほか（合言葉で入れるようにする）",
      verdict: "WPA2 Policy を有効にし、PSK を有効にする",
      why: "「認証サーバの代わりに合言葉」なら PSK。802.1X はサーバを使うやり方なので、ここでは選ばない",
      look: ["Layer 2 の守り"],
      steps: function (v) { return [["現在の守り", v.l2sec || "-"]]; },
      no: function () { return "ここまでで決まっている"; },
      test: function () { return true; } }
  ];

  var GLOSS = {
    "Maximum Allowed Clients に、その数を入れる": "Per AP Radio は親機1台あたりの数。別もの",
    "Layer 3 の Web ポリシーと認証を有効にする": "先にブラウザで認証させる形",
    "WPA2 Policy を有効にし、MAC フィルタリングも有効にする": "合言葉に加えて、機器を名指しで絞る",
    "File Type を Code、Transfer Mode を SFTP にして、サーバの住所を入れる": "ポート22 は SFTP",
    "P2P Blocking Action を Drop にする": "Wi-Fi Direct の行と間違えやすい",
    "Client Band Select と AAA Override を有効にする": "すいている周波数へ寄せる",
    "Status を有効にして、Interface/Interface Group で載せる先を選ぶ": "載せる先は General タブ",
    "AES（CCMP128）を選び、認証の鍵は PSK にする": "CCMP256 や GCMP は WPA3 のもの",
    "WPA2 Policy を有効にし、PSK を有効にする": "802.1X はサーバを使うやり方"
  };

  var SAME = {
    "Maximum Allowed Clients に、その数を入れる": ["Maximam Allowed Clients", "Maximum Allowed Clients"],
    "Layer 3 の Web ポリシーと認証を有効にする": ["Web ポリシー"],
    "WPA2 Policy を有効にし、MAC フィルタリングも有効にする": ["MAC フィルタリング"],
    "File Type を Code、Transfer Mode を SFTP にして、サーバの住所を入れる": ["SFTP"],
    "P2P Blocking Action を Drop にする": ["P2P Blocking Action"],
    "Client Band Select と AAA Override を有効にする": ["バンド選択"],
    "Status を有効にして、Interface/Interface Group で載せる先を選ぶ": ["Interface/Interface Group"],
    "AES（CCMP128）を選び、認証の鍵は PSK にする": ["AES"],
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


  var spec = {
    id: "wlangui",
    kind: "rules",
    card: "misc",
    name: "無線の画面を読む",
    note: "無線 LAN コントローラの画面を読み、どの設定項目を変更するかを判断する",
    obj: "2.9",
    ask: "この要件なら、画面のどこを触りますか。",
    wantsQuestion: true,
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample, walk: E.cueWalk(RULES),
    /* 「この画面から何が分かるか」を聞く問題。規則では出せないが、テストには出す */
    bookOnly: ["B1-P15-046", "B1-P16-065"],
    expect: { spots: 5, rules: 9, questions: 13 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.wlangui = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
