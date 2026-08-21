/* 「機器への入り方」ブロック（過去問10問）。
 *
 * 遠くから機器に入るための設定（Telnet と SSH）。本の10問の決め方は6つ。
 *
 *   ① 要らないコマンドを消す                       1問
 *   ② SSH を使えるようにする（最小の部品）          2問
 *   ③ SSH だけ許して、パスワードを隠す              2問
 *   ④ Telnet で、入ったらすぐ特権モード             1問
 *   ⑤ Telnet だけ許して、enable を安全にする        1問
 *   ⑥ ユーザー名とパスワードを、暗号化して作る       1問
 *
 * 残り2問は規則では出せないので bookOnly（テストには出す）。
 *
 * **決め手は問題文の「要件」にある。**だから問題文もいっしょに読む。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "need", name: "要件の言葉（問題文）",
      re: /(要件|許可|アクセス|設定|削除)/,
      mean: "「SSH だけ」「Telnet のみ」「パスワードを隠す」など、問題文が出している条件",
      use: "まず要件を読む。打つコマンドは、要件の言葉とほぼ1対1で決まる" },

    { key: "pw", name: "パスワードの入れ方（password か secret か）",
      re: /(password|secret)/i,
      mean: "password はそのまま保存、secret は取り出せない形にして保存",
      use: "「安全に保存する」なら secret。`service password-encryption` は隠すだけで、secret ほど強くない" },

    { key: "trans", name: "接続方式の許可（transport input）",
      re: /transport input\s*(ssh|telnet|all|none)?/i,
      mean: "そのインターフェースに、どのやり方で入ってよいか",
      use: "指定しないと Telnet だけが許可される。SSH だけにするなら transport input ssh を設定する" },

    { key: "login", name: "ログインの確かめ方（login local）",
      re: /(login local|login)/i,
      mean: "接続時に、機器に登録したユーザー名とパスワードで認証するかどうか",
      use: "username を作成したら、vty 側にも login local が必要。どちらか一方だけでは接続できない" },

    { key: "sshparts", name: "SSH に必要な設定",
      re: /(hostname|ip domain-name|crypto key|ip ssh version)/i,
      mean: "SSH を使うには、名前・ドメイン名・鍵の3つがそろっている必要がある",
      use: "hostname → ip domain-name → crypto key generate rsa の順。鍵がすでにあるなら作り直さない" }
  ];

  function join(x) {
    if (x && typeof x === "object" && x.exhibit !== undefined) {
      return String(x.text || "") + "\n" + String(x.exhibit || "");
    }
    return String(x || "");
  }

  var PAT = {
    remove: /(削除|必要のない|不要)/,
    sshsetup: /(Secure Shell\s*バージョン|公開キーと秘密キー|SSH\s*を設定)/i,
    sshonly: /(SSH\s*アクセスだけ|安全で暗号化|SSH のみ)/i,
    priv: /(特権モード|privilege)/,
    telnetonly: /(Telnet\s*アクセスのみ|Telnet のみ)/i,
    haskey: /show crypto key|RSA/i,
    curTrans: /transport input\s+(ssh|telnet|all)/i,
    user: /username\s+(\S+)/i
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
      if (/削除|必要のない|不要|Secure Shell|公開キー|SSH|特権モード|Telnet/i.test(l)
          || /transport input|login|username|enable|crypto key/i.test(l)) out.push(l);
    });
    return out.join("\n");
  }

  /* ── 判定ルール ─────────────────────────── */
  var RULES = [
    { key: "remove", cue: "必要のないコマンドを削除する", cond: "要らないコマンドを消す、と書いてある",
      verdict: "SSH に関係のないコマンドを no で削除する",
      why: "名前を引く設定（ip name-server）や、secret を使っているのに要らない service password-encryption は、SSH には関係がない",
      look: ["要件の言葉（問題文）"],
      steps: function (v) { return [["問題文のことば", v.remove || "-"]]; },
      no: function () { return "消す話ではない"; },
      test: function (v) { return !!v.remove; } },

    { key: "sshsetup", cue: "SSH を使えるようにする", cond: "SSH を使えるようにしたい",
      verdict: "hostname・ip domain-name・crypto key generate rsa をそろえる",
      why: "鍵を作るには、機器の名前とドメイン名が先に必要。この3つがそろって、はじめて SSH が使える",
      look: ["SSH に必要な設定"],
      steps: function (v) { return [["いまある鍵", v.haskey || "（無し）"]]; },
      no: function () { return "SSH を使えるようにする話ではない"; },
      test: function (v) { return !!v.sshsetup; } },

    { key: "sshonly", cue: "SSH だけ許可する", cond: "SSH だけ許して、パスワードを隠したい",
      verdict: "transport input ssh と service password-encryption を打つ",
      why: "書かないと Telnet が通る。transport input ssh で SSH だけにする。パスワードの見え方は service password-encryption で隠す",
      look: ["接続方式の許可（transport input）", "パスワードの入れ方（password か secret か）"],
      steps: function (v) { return [["現在の入口", v.curTrans || "（書いていない＝Telnet）"]]; },
      no: function () { return "SSH だけにする話ではない"; },
      test: function (v) { return !!v.sshonly; } },

    { key: "priv", cue: "入ったらすぐ特権モード", cond: "入ったらすぐ特権モードにしたい",
      verdict: "username に privilege 15 を付け、vty 側に login local を打つ",
      why: "privilege 15 を付けたユーザーで入ると、そのまま特権モードになる。vty 側に login local が無いと、そのユーザーで確かめてくれない",
      look: ["ログインの確かめ方（login local）"],
      steps: function (v) { return [["問題文のことば", v.priv || "-"], ["いるユーザー", v.user || "-"]]; },
      no: function () { return "特権モードの話ではない"; },
      test: function (v) { return !!v.priv; } },

    { key: "telnetonly", cue: "Telnet だけ許可する", cond: "Telnet だけ許して、enable を安全にしたい",
      verdict: "transport input telnet と enable secret を打つ",
      why: "Telnet だけにするなら transport input telnet。enable のパスワードは secret で、取り出せない形にする",
      look: ["接続方式の許可（transport input）", "パスワードの入れ方（password か secret か）"],
      steps: function (v) { return [["問題文のことば", v.telnetonly || "-"]]; },
      no: function () { return "Telnet だけにする話ではない"; },
      test: function (v) { return !!v.telnetonly; } },

    { key: "secret", cue: "パスワードを取り出せない形で保存する", cond: "そのほか（ユーザー名とパスワードを作る）",
      verdict: "username（名前）secret（パスワード）で作る",
      why: "secret は、取り出せない形にして保存する。password で作ると、そのままの形で残る",
      look: ["パスワードの入れ方（password か secret か）"],
      steps: function (v) { return [["要件", (v.all || "").split("\n")[0]]]; },
      no: function () { return "ここまでで決まっている"; },
      test: function () { return true; } }
  ];

  var GLOSS = {
    "SSH に関係のないコマンドを no で削除する": "名前を引く設定などは、SSH には要らない",
    "hostname・ip domain-name・crypto key generate rsa をそろえる": "この3つがそろって、はじめて SSH が使える",
    "transport input ssh と service password-encryption を打つ": "接続方式を SSH だけにし、設定上のパスワードを見えない形にする",
    "username に privilege 15 を付け、vty 側に login local を打つ": "入った瞬間から、何でもできる状態になる",
    "transport input telnet と enable secret を打つ": "入口は Telnet だけ。enable は取り出せない形で保存",
    "username（名前）secret（パスワード）で作る": "secret は取り出せない形。password はそのまま残る"
  };

  var SAME = {
    "SSH に関係のないコマンドを no で削除する": ["no ip name-server", "no service password-encryption"],
    "hostname・ip domain-name・crypto key generate rsa をそろえる": ["crypto key generate rsa"],
    "transport input ssh と service password-encryption を打つ": ["transport input ssh"],
    "username に privilege 15 を付け、vty 側に login local を打つ": ["privilege 15"],
    "transport input telnet と enable secret を打つ": ["transport input telnet"],
    "username（名前）secret（パスワード）で作る": ["secret"]
  };

  /* ── 出力を作る ─────────────────────────── */
  function baseVals() {
    return {
      dev: pick(["R1", "SW1", "R15", "Router"]),
      user: pick(["admin", "CCUser", "test1", "netops"]),
      pw: pick(["NA!2$cc", "p@ss1234", "Test123", "S0m3s3cr3t"]),
      dom: pick(["cisco.com", "CC-Net.com", "example.local"]),
      vty: pick(["0 4", "0 15"]),
      trans: pick(["telnet", "all"]),
      key: pick([true, false])
    };
  }

  function conf(v) {
    var out = [v.dev + "# show running-config | section line vty",
               "line vty " + v.vty];
    if (v.trans) out.push(" transport input " + v.trans);
    out.push(" login");
    out.push("");
    out.push(v.dev + "# show crypto key mypubkey rsa");
    out.push(v.key ? "% Key pair was generated at: 12:00:00 JST Aug 1 2026"
                   : "（鍵はまだ作られていない）");
    return out.join("\n");
  }

  function build(v) { return v.need + "\n\n" + conf(v); }

  var MAKERS = {
    remove: function (b) {
      b.need = "SSH に必要のないコマンドが混ざっています。削除するコマンドはどれですか。";
      return b;
    },
    sshsetup: function (b) {
      b.key = false;
      b.need = "Secure Shell バージョン 2 で " + b.dev + " に入れるようにします。最小の設定はどれですか。";
      return b;
    },
    sshonly: function (b) {
      b.need = "SSH アクセスだけを許可し、パスワードを隠します。どのコマンドが必要ですか。";
      return b;
    },
    priv: function (b) {
      b.need = "ローカルのユーザー名とパスワードで、入ったらすぐ特権モードになるようにします。どの設定を足しますか。";
      return b;
    },
    telnetonly: function (b) {
      b.need = "Telnet アクセスのみを許可し、enable のパスワードは安全に保存します。どの設定をしますか。";
      return b;
    },
    secret: function (b) {
      b.need = "ユーザー名 " + b.user + " を作り、パスワード " + b.pw +
               " を取り出せない形で保存します。どの設定をしますか。";
      return b;
    }
  };

  function sample() {
    return [
      "SSH アクセスだけを許可し、パスワードを隠します。どのコマンドが必要ですか。",
      "（ほかの聞かれ方：必要のないコマンドを削除する／Secure Shell バージョン 2 で入れるようにする／" +
        "入ったらすぐ特権モードにする／Telnet アクセスのみを許可する／username と secret を作る）",
      "",
      conf({ dev: "R1", vty: "0 15", trans: "telnet", key: true })
    ].join("\n");
  }


  var spec = {
    id: "access",
    kind: "rules",
    card: "config",
    name: "機器への入り方",
    note: "遠くから機器に入るための設定を選ぶ",
    obj: "5.3",
    ask: "この要件を満たす設定はどれですか。",
    wantsQuestion: true,
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample, walk: E.cueWalk(RULES),
    /* 規則では出せないが、テストには出す問題 */
    bookOnly: ["B3-M1-092", "B3-M3-095"],
    expect: { spots: 5, rules: 6, questions: 10 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.access = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
