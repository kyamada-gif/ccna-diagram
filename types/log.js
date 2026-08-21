/* 「ログの読み取り」ブロック（過去問3問）。
 *
 * 機器が出したログの行を読んで、何が起きているかを当てる。
 * いまは「衝突が多すぎる（excessive collisions）」1種類だけ。
 * 別のログが出てくる問題が見つかったら、見る所とルールを足す。
 *
 * もとは目標3.4（OSPF）に分類されていたが、中身は
 * 「出力を読んで当てる」で、OSPF の規則では解けない。
 */
(function (global) {
  "use strict";
  var E = global.ENGINE ||
    (typeof require !== "undefined" ? require("../engine.js") : null);
  var R = E.R, pick = E.pick;

  /* ── 見る所 ───────────────────────────── */
  var SPOTS = [
    { key: "kind", name: "ログの種類",
      re: /-\d-([A-Z]+)/,
      mean: "ログの見出しの最後にある英字。そのログが何についてのものかを表す",
      use: "COLL なら衝突についてのログ。ここでログの種類が決まるので、まずここを見る" },
    { key: "word", name: "本文の言葉",
      re: /(excessive collisions|Excessive collisions)/i,
      mean: "ログの本文に書かれている言葉。何が起きているのかがここに出ている",
      use: "excessive collisions は「衝突が多すぎる」という意味。送り直しに16回続けて失敗すると、そのフレームは破棄される" }
  ];

  var PAT = {
    kind: /-\d-([A-Z]+)/,
    coll: /(excessive collisions)/i,
    retry: /(Retry limit)/i
  };

  /* ログを読む。共通の読み方（engine.js）と同じものに、本文そのものを足す。
     答え合わせで「このログの何行が当てはまるか」を出すのに要る。
     判定に使う値（kind・coll・retry）の出し方は共通のものと同じ */
  function read(ex) {
    var text = String(ex == null ? "" : ex);
    var v = { text: text };
    Object.keys(PAT).forEach(function (k) {
      var m = text.match(PAT[k]);
      v[k] = m ? m[1] : null;
    });
    return v;
  }

  /* ── 判定ルール ─────────────────────────── */
  var RULES = [
    { key: "coll", cond: "ログに excessive collisions と書かれている",
      verdict: "送信に16回失敗すると、そのフレームは破棄される",
      why: "衝突が多すぎることを知らせるログ。衝突するたびに送り直すが、16回続けて失敗した時点で、そのフレームは破棄される",
      look: ["ログの種類", "本文の言葉"],
      steps: function (v) {
        return [["ログの種類", v.kind || "-"], ["本文の言葉", v.coll || "-"]];
      },
      no: function (v) {
        return "excessive collisions というログが出ていないので、衝突の話ではない";
      },
      test: function (v) { return !!v.coll; } }
  ];

  var GLOSS = {
    "送信に16回失敗すると、そのフレームは破棄される":
      "衝突するたびに送り直すが、16回続けて失敗したらそこで打ち切る決まりになっている"
  };

  var SAME = {
    "送信に16回失敗すると、そのフレームは破棄される":
      ["16回の送信試行に失敗", "送信試行が 16 回失敗", "16 回失敗"]
  };

  /* ── ログを作る ─────────────────────────── */
  var UNIT = ["AMDP2_FE", "DEC21140", "ILACC", "LANCE", "PQUICC", "PQUICC_ETHER"];

  function baseVals() { return { n: R(2, 5) }; }

  function build(v) {
    var out = [];
    var us = E.shuffle(UNIT).slice(0, v.n);
    us.forEach(function (u) {
      out.push("%" + u + "-5-COLL: Unit [DEC], excessive collisions. TDR=[DEC]");
    });
    return out.join("\n");
  }

  var MAKERS = {
    coll: function (b) { return b; }
  };

  /* ── 説明の1枚に出す見本 ────────────────────
   * 機器が出す書き方を3行だけ並べる。**値は決め打ち。**毎回同じものが出る。
   * 1行目は Excessive collisions と大文字で始まり、2行目と3行目は小文字。
   * **同じ言葉が大文字でも小文字でも出る**ことが、見ただけで分かるようにしてある。
   * 3行目の Retry limit exceeded は「送り直しの上限を超えた」と書いている行。
   */
  var LEARN = [
    "%AMDP2_FE-5-COLL: AMDP2/FE 0/0/[DEC], Excessive collisions, TDR=[DEC], TRC=[DEC]",
    "%DEC21140-5-COLL: [chars] excessive collisions",
    "%PQUICC-5-COLL: Unit [DEC], excessive collisions. Retry limit [DEC] exceeded"
  ].join("\n");

  function sample() { return LEARN; }
  function learnEx() { return LEARN; }

  /* ── 短い説明の1枚 ─────────────────────────
   * **文字は読まれない。**「こう出ていたら、こう答える」だけを残す。
   * もし の側には、ログに実際に書いてある目印だけを入れる。
   * 確認項目は1つ、判定ルールも1本なので、ここに並ぶ行も1行。
   */
  var IF = "見出しの末尾が COLL、本文に excessive collisions";
  /* 添える一言。**取り違えやすい所だけ。**
     答えには16回と出てくるが、ログのどこにも 16 とは書かれていない。
     数はイーサネットの決まりのほうにある */
  var NOTE = "16 という数字はログに出てこない。送り直しの上限が16回と決まっている";

  function brief() {
    return [{ if: IF, then: RULES[0].verdict, note: NOTE }];
  }

  /* ── 答え合わせの言葉 ──────────────────────
   * **決まりと、このログの目印を、別々の行に出す。**同じことを2回書かない。
   *   決まり  「見出しの末尾が COLL、本文に excessive collisions ＝ 送信に16回…」
   *   この場合「この 4 行は、先頭の名前が違うだけで、どれも末尾が COLL …」
   * 決まりの側は説明の1枚（brief）と同じ言葉にそろえる。
   */
  function answerNote(v, st) {
    if (!v) return null;
    /* ここで決まらなかったとき。**なぜ決まらないかだけ。**
       確認項目は1つしかないので、練習ではここを通らない */
    if (st && !st.hit) return { gloss: "", body: RULES[0].no(v) };
    if (!v.coll) return null;
    var lines = String(v.text || "").split("\n").filter(function (l) {
      return l.replace(/\s/g, "") !== "";
    });
    var up = lines.filter(function (l) {
      return l.indexOf("Excessive collisions") >= 0;
    }).length;
    return {
      gloss: IF + " ＝ " + RULES[0].verdict,
      body: "この " + lines.length + " 行は、先頭の名前が違うだけで、" +
            "どれも末尾が COLL、本文に excessive collisions" +
            (up ? "（大文字で始まる行もある）" : "")
    };
  }

  /* ── どこを光らせるか ─────────────────────
   *   hits  …… 塗る行。**空にする。**この分野はどの行も当てはまるので、
   *             行を塗ると画面ぜんぶが光って、どこを見ればいいのか伝わらない
   *   marks …… 行の中で光らせる言葉。ここが本体。**目印の語だけ。**
   * **大文字と小文字の両方を入れる。**行の中を探す仕組みは大文字小文字を
   * 区別するので、小文字だけにすると Excessive collisions の行が光らない。
   */
  var SPOTNAME = SPOTS.map(function (s) { return s.name; });
  var MARKS = {
    "ログの種類": ["COLL"],
    "本文の言葉": ["excessive collisions", "Excessive collisions"]
  };
  function hits(name) { return SPOTNAME.indexOf(name) >= 0 ? [] : [name]; }
  function marks(name) { return MARKS[name] || [name]; }

  var spec = {
    id: "log",
    ask: "このログは、何が起きたことを知らせていますか。",
    kind: "rules",
    card: "read",
    name: "ログの読み取り",
    note: "機器が出したログを読んで、何が起きているかを当てる",
    obj: "1.4",
    spots: SPOTS, pat: PAT, rules: RULES, gloss: GLOSS, same: SAME,
    read: read,
    /* 説明の1枚と、答え合わせの見せ方。**判定そのものは変えていない。**
       focus は置かない。確認項目は1つで、光らせる所は look がそのまま指している */
    brief: brief, answerNote: answerNote,
    hits: hits, marks: marks, learnEx: learnEx,
    build: build, baseVals: baseVals, makers: MAKERS, sample: sample,
    expect: { spots: 2, rules: 1, questions: 3 },
    dropped: []
  };

  global.SPECS = global.SPECS || {};
  global.SPECS.log = spec;
  if (typeof module !== "undefined" && module.exports) module.exports = spec;
})(typeof window !== "undefined" ? window : globalThis);
