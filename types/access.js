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
      mean: "「SSH だけ許可する」「Telnet のみ」「パスワードを隠す」など、問題文に書かれた条件",
      use: "まず要件を読む。入力するコマンドは、要件に書かれた言葉とほぼ1対1で決まる" },

    { key: "pw", name: "パスワードの入れ方（password か secret か）",
      re: /(password|secret)/i,
      mean: "password は入力した文字がそのまま設定に残る。secret は元に戻せない形に変換して保存される",
      use: "「安全に保存する」と書かれていれば secret。service password-encryption は見た目を隠すだけで、secret ほど強くない" },

    { key: "trans", name: "接続方式の許可（transport input）",
      re: /transport input\s*(ssh|telnet|all|none)?/i,
      mean: "その回線に、どの方式で接続してよいか",
      use: "指定しないと Telnet だけが許可される。SSH だけにするなら transport input ssh を設定する" },

    { key: "login", name: "ログインの確かめ方（login local）",
      re: /(login local|login)/i,
      mean: "接続してきた相手を、機器に登録したユーザー名とパスワードで認証するかどうか",
      use: "username を作成したら、vty 側にも login local が必要。どちらか一方だけでは接続できない" },

    { key: "sshparts", name: "SSH に必要な設定",
      re: /(hostname|ip domain-name|crypto key|ip ssh version)/i,
      mean: "SSH を使うには、ホスト名・ドメイン名・暗号鍵の3つがそろっている必要がある",
      use: "hostname → ip domain-name → crypto key generate rsa の順に設定する。鍵がすでに作られていれば、作り直さない" }
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
    { key: "remove", cue: "必要のないコマンドを削除する", cond: "不要なコマンドを削除する、と書かれている",
      mark: ["ip name-server", "service password-encryption"],
      verdict: "SSH に関係のないコマンドを no で削除する",
      why: "名前解決の設定（ip name-server）や、secret を使っているのに残っている service password-encryption は、SSH の動作には関係がない",
      look: ["要件の言葉（問題文）"],
      steps: function (v) { return [["問題文のことば", v.remove || "-"]]; },
      no: function () { return "消す話ではない"; },
      test: function (v) { return !!v.remove; } },

    { key: "sshsetup", cue: "SSH を使えるようにする", cond: "SSH を使えるようにしたい",
      verdict: "hostname・ip domain-name・crypto key generate rsa の3つを設定する",
      why: "暗号鍵を作るには、ホスト名とドメイン名が先に必要。この3つがそろって、はじめて SSH が使える",
      look: ["SSH に必要な設定"],
      steps: function (v) { return [["いまある鍵", v.haskey || "（無し）"]]; },
      no: function () { return "SSH を使えるようにする話ではない"; },
      test: function (v) { return !!v.sshsetup; } },

    { key: "sshonly", cue: "SSH だけ許可する", cond: "SSH だけ許して、パスワードを隠したい",
      verdict: "transport input ssh と service password-encryption を設定する",
      why: "指定しないと Telnet での接続が通ってしまう。transport input ssh で SSH だけに限定し、設定に残るパスワードは service password-encryption で見えない形にする",
      look: ["接続方式の許可（transport input）", "パスワードの入れ方（password か secret か）"],
      steps: function (v) { return [["現在の入口", v.curTrans || "（書いていない＝Telnet）"]]; },
      no: function () { return "SSH だけにする話ではない"; },
      test: function (v) { return !!v.sshonly; } },

    { key: "priv", cue: "入ったらすぐ特権モード", cond: "入ったらすぐ特権モードにしたい",
      verdict: "username に privilege 15 を付け、vty 側に login local を設定する",
      why: "privilege 15 を付けたユーザーで接続すると、その時点で特権モードになる。vty 側に login local が無いと、そのユーザー名とパスワードで認証されない",
      look: ["ログインの確かめ方（login local）"],
      steps: function (v) { return [["問題文のことば", v.priv || "-"], ["いるユーザー", v.user || "-"]]; },
      no: function () { return "特権モードの話ではない"; },
      test: function (v) { return !!v.priv; } },

    { key: "telnetonly", cue: "Telnet だけ許可する", cond: "Telnet だけ許して、enable を安全にしたい",
      verdict: "transport input telnet と enable secret を設定する",
      why: "Telnet だけに限定するなら transport input telnet。enable のパスワードは secret で、元に戻せない形にして保存する",
      look: ["接続方式の許可（transport input）", "パスワードの入れ方（password か secret か）"],
      steps: function (v) { return [["問題文のことば", v.telnetonly || "-"]]; },
      no: function () { return "Telnet だけにする話ではない"; },
      test: function (v) { return !!v.telnetonly; } },

    { key: "secret", cue: "パスワードを取り出せない形で保存する", cond: "そのほか（ユーザー名とパスワードを作成する）",
      mark: ["取り出せない形で保存"],
      verdict: "username（名前）secret（パスワード）で作成する",
      why: "secret は元に戻せない形に変換して保存される。password で作成すると、入力した文字がそのまま設定に残る",
      look: ["パスワードの入れ方（password か secret か）"],
      steps: function (v) { return [["要件", (v.all || "").split("\n")[0]]]; },
      no: function () { return "ここまでで決まっている"; },
      test: function () { return true; } }
  ];

  var GLOSS = {
    "SSH に関係のないコマンドを no で削除する": "名前解決の設定などは、SSH の動作には関係がない",
    "hostname・ip domain-name・crypto key generate rsa の3つを設定する": "この3つがそろって、はじめて SSH が使える",
    "transport input ssh と service password-encryption を設定する": "接続方式を SSH だけに限定し、設定に残るパスワードを見えない形にする",
    "username に privilege 15 を付け、vty 側に login local を設定する": "接続した時点で、すべての操作ができる状態になる",
    "transport input telnet と enable secret を設定する": "接続方式は Telnet だけ。enable のパスワードは元に戻せない形で保存する",
    "username（名前）secret（パスワード）で作成する": "secret は元に戻せない形で保存される。password は入力した文字がそのまま残る"
  };

  var SAME = {
    "SSH に関係のないコマンドを no で削除する": ["no ip name-server", "no service password-encryption"],
    "hostname・ip domain-name・crypto key generate rsa の3つを設定する": ["crypto key generate rsa"],
    "transport input ssh と service password-encryption を設定する": ["transport input ssh"],
    "username に privilege 15 を付け、vty 側に login local を設定する": ["privilege 15"],
    "transport input telnet と enable secret を設定する": ["transport input telnet"],
    "username（名前）secret（パスワード）で作成する": ["secret"]
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
      key: pick([true, false]),
      ns: pick(["198.51.100.210", "192.0.2.53", "203.0.113.9"]),
      hash: pick(["Kx8q", "Tr4d", "9Lmz"])
    };
  }

  function conf(v) {
    var out = [];
    /* **「削除するコマンドはどれですか」の問題には、消す行そのものを出す。**
       前は line vty と鍵の行しか出しておらず、消すべき行が提示物のどこにも無かった。
       出す行は、本の B1-P12-065 の紙面と同じ（名前解決の設定と、
       secret を使っているのに残っている service password-encryption）。 */
    if (v.extra) {
      out.push(v.dev + "# show running-config | include name-server|password-encryption|secret");
      out.push("ip name-server " + v.ns);
      out.push("service password-encryption");
      out.push("username " + v.user + " secret 5 $1$mERr$" + v.hash);
      out.push("");
    }
    out.push(v.dev + "# show running-config | section line vty");
    out.push("line vty " + v.vty);
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
      b.extra = true;
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


  /* ── 最後の3問のうち2問は、打つコマンドの並びで答える ─────────
   * 本の10問は、選択肢がすべて打つコマンドの並び。
   * **誤答の顔ぶれは、本の同じ問題が出しているものを写す。**
   */
  function cmdSet(key, v) {
    var L = function () { return Array.prototype.slice.call(arguments).join("\n"); };
    if (key === "secret") {                      /* B1-P11-058 */
      return { right: "username " + v.user + " secret " + v.pw,
               wrong: ["username " + v.user + " password " + v.pw,
                       "username " + v.user + " privilege 15 password " + v.pw,
                       "username " + v.user + " privilege 10 password " + v.pw] };
    }
    if (key === "telnetonly") {                  /* B1-P11-069 */
      var vty = "line vty " + v.vty;
      return { right: L("enable secret level 15 0 " + v.pw, "!", vty,
                        "login local", "transport input telnet"),
               wrong: [L("enable password level 15 0 " + v.pw, "!", vty,
                         "password " + v.pw, "transport input all"),
                       L("enable secret level 1 0 " + v.pw, "!", vty,
                         "login authentication", "password " + v.pw),
                       L("enable password level 1 7 " + v.pw, "!", vty,
                         "accounting exec default", "transport input telnet")] };
    }
    if (key === "sshonly") {                     /* B1-P12-015 */
      return { right: L(v.dev + "(config)#line vty " + v.vty,
                        v.dev + "(config-line)#transport input ssh",
                        v.dev + "(config)#service password-encryption"),
               wrong: [L(v.dev + "(config)#line vty " + v.vty,
                         v.dev + "(config-line)#transport input all"),
                       L(v.dev + "(config)#crypto key generate rsa"),
                       L(v.dev + "(config)#username " + v.user + " secret " + v.pw)] };
    }
    if (key === "priv") {                        /* B1-P12-110 */
      return { right: L(v.dev + "(config)#username " + v.user + " privilege 15 secret " + v.pw,
                        v.dev + "(config)#line vty " + v.vty,
                        v.dev + "(config-line)#login local"),
               wrong: [L(v.dev + "(config)#username " + v.user + " secret " + v.pw,
                         v.dev + "(config)#line vty " + v.vty,
                         v.dev + "(config-line)#login local"),
                       L(v.dev + "(config)#username " + v.user,
                         v.dev + "(config)#line vty " + v.vty,
                         v.dev + "(config-line)#password " + v.pw),
                       L(v.dev + "(config)#username " + v.user,
                         v.dev + "(config)#line vty " + v.vty,
                         v.dev + "(config-line)#password " + v.pw,
                         v.dev + "(config-line)#transport input telnet")] };
    }
    if (key === "sshsetup") {                    /* B3-M3-057 */
      return { right: L("hostname " + v.dev, "ip domain-name " + v.dom,
                        "crypto key generate rsa general-keys modulus 1024"),
               wrong: [L("crypto key generate rsa general-keys modulus 1024",
                         "ip ssh version 2", "line vty " + v.vty),
                       L("hostname " + v.dev,
                         "crypto key generate rsa general-keys modulus 1024",
                         "line vty " + v.vty),
                       L("ip domain-name " + v.dom,
                         "crypto key generate rsa general-keys modulus 1024",
                         "ip ssh version 2")] };
    }
    /* remove。B1-P12-065。消す行を選ぶ */
    return { right: L("no ip name-server " + v.ns, "no service password-encryption"),
             wrong: ["no ip domain name " + v.dom, "no login local", "no hostname " + v.dev] };
  }

  var CMDMARK = {
    secret: function (o, v) { return o.indexOf("secret " + v.pw) >= 0 && o.indexOf("privilege") < 0; },
    telnetonly: function (o) {
      return o.indexOf("enable secret level 15") >= 0 && o.indexOf("transport input telnet") >= 0;
    },
    sshonly: function (o) { return o.indexOf("transport input ssh") >= 0; },
    priv: function (o) { return o.indexOf("privilege 15 secret") >= 0 && o.indexOf("login local") >= 0; },
    sshsetup: function (o, v) {
      return o.indexOf("hostname " + v.dev) >= 0 && o.indexOf("ip domain-name") >= 0
             && o.indexOf("crypto key generate") >= 0;
    },
    remove: function (o) { return o.indexOf("no ip name-server") >= 0; }
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
      if (!c) continue;                          /* コマンドの形にしない題材 */
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
    remove: "名前解決の設定は SSH の動作と関係がない。" +
            "パスワードを secret で保存しているなら、service password-encryption も要らない",
    sshsetup: "鍵はホスト名とドメイン名が無いと作れないので、この順で設定する。" +
              "出力に鍵ができたと出ていれば、作り直さない",
    sshonly: "transport input を書かないと Telnet も通ってしまう。" +
             "service password-encryption は見た目を隠すだけで、secret ほど強くない",
    priv: "privilege 15 のユーザーで入ると、その時点で特権モードになる。" +
          "vty 側に login local が無いと、そのユーザー名では認証されない",
    telnetonly: "SSH だけを許す設定とは、transport input の後ろが違うだけ。" +
                "enable のパスワードは password ではなく secret で保存する",
    secret: "secret は元に戻せない形で保存される。password で作ると、打った文字がそのまま設定に残る"
  };

  var spec = {
    id: "access",
    /* 出題パターン＝どのルールで答えにたどり着くか。
       絞ったせいでパターンが消えていないかを、build.js が毎回見る */
    pattern: E.cuePattern, patterns: ["priv", "remove", "secret", "sshonly", "sshsetup", "telnetonly"],
    kind: "rules",
    card: "config",
    name: "機器への入り方",
    note: "遠くから機器に入るための設定を選ぶ",
    obj: "5.3",
    ask: "この要件を満たす設定はどれですか。",
    wantsQuestion: true,
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    read: read, excerpt: excerpt,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample, /* 決め手が出力の中にあるルール。ここだけ見本の現物を出す */
    learnOut: ["sshsetup", "sshonly"],
    wholeQ: wholeQ, cmdSet: cmdSet, cmdMark: CMDMARK,
    brief: E.cueBrief(RULES, NOTE), answerNote: E.cueAnswerNote(RULES, GLOSS),
    stepQ: E.cueStepQ(RULES),
    /* 規則では出せないが、テストには出す問題 */
    bookOnly: ["B3-M1-092", "B3-M3-095"],
    expect: { spots: 5, rules: 6, questions: 10 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.access = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
