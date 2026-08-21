#!/usr/bin/env node
/* ビルド: app.jsx -> app.js ＋ 中身の検査
 *   1) Babel で JSX をコンパイル
 *   2) ブラウザが素で読める形に直す（import を外し、末尾に描画を足す）
 *   3) index.html の ?v=… を中身に合わせて更新
 *   4) **ブロックごとに**中身を確かめる
 *
 * 直したら必ず `node build.js` を通す。**通さないと app.js が古いまま。**
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

process.chdir(__dirname);
execSync("npx babel app.jsx --presets @babel/preset-react -o app.js", { stdio: "inherit" });

let code = fs.readFileSync("app.js", "utf8");
code = code.replace(
  /^import React,\s*\{([^}]*)\}\s*from\s*"react";?\s*$/m,
  (_, names) => `const {${names}} = React;`
);
code = code.replace(/export default function App/, "function App");
const boot =
  'ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));';
if (!code.includes(boot)) code = code.trimEnd() + "\n" + boot + "\n";
fs.writeFileSync(
  "app.js",
  "/* 自動生成: build.js（app.jsx -> app.js）。手で編集せず app.jsx を直して再ビルド。 */\n" + code
);

const sum = (f) => fs.readFileSync(f, "utf8").length;
const gv = sum("gen.js") + sum("engine.js") + sum("fig.js") + sum("store.js") +
  fs.readdirSync("types").reduce((a, f) => a + sum(path.join("types", f)), 0);
const js = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith(".js"))
  .map((f) => path.join(dir, f));
const qv = sum("questions.js") + js("q").reduce((a, f) => a + sum(f), 0);
let html = fs.readFileSync("index.html", "utf8");
const next = html
  .replace(/(\.\/app\.js)(\?v=\d+)?/, `$1?v=${code.length}`)
  .replace(/(\.\/gen\.js)(\?v=\d+)?/, `$1?v=${gv}`)
  .replace(/(\.\/engine\.js)(\?v=\d+)?/, `$1?v=${gv}`)
  .replace(/(\.\/fig\.js)(\?v=\d+)?/, `$1?v=${gv}`)
  .replace(/(\.\/store\.js)(\?v=\d+)?/, `$1?v=${gv}`)
  .replace(/(\.\/types\/[\w-]+\.js)(\?v=\d+)?/g, `$1?v=${gv}`)
  .replace(/(\.\/questions\.js)(\?v=\d+)?/, `$1?v=${qv}`)
  .replace(/(\.\/q\/(?:practice\/)?[\w-]+\.js)(\?v=\d+)?/g, `$1?v=${qv}`);
if (next !== html) if (next !== html) fs.writeFileSync("index.html", next);
console.log(`built app.js (${code.length} bytes)`);

/* ── 見張り ───────────────────────────────── */
const { GENS, SPECS, BLOCK_IDS } = require(path.join(__dirname, "gen.js"));
const { BANKS } = require(path.join(__dirname, "questions.js"));
const bad = [];
let totalQ = 0;

/* **まだ練習を作っていないブロック。**
   ここに載っている間は「練習が無い」ことを止める理由にしない。
   1つ作るたびに、この行から消していく。**空にするのが仕上がり。**
   決まり：テストは本の問題そのまま、練習はそれを解くための生成問題。
   だから「練習に本の問題を出す」で穴を埋めることはしない */
const YET = [];

BLOCK_IDS.forEach((id) => {
  const G = GENS[id];
  const spec = SPECS[id] || {};
  const qs = BANKS[id] || [];
  const tag = spec.name || id;
  if (!G) { bad.push(`${id} のエンジンが作れていない`); return; }
  const exp = spec.expect || {};

  /* 申告した数と、実物が合っているか */
  if (exp.spots !== undefined && G.SPOTS.length !== exp.spots)
    bad.push(`${tag}: 見る所が ${G.SPOTS.length} 個（申告は ${exp.spots}）`);
  if (exp.rules !== undefined && G.RULES.length !== exp.rules)
    bad.push(`${tag}: 判定ルールが ${G.RULES.length} 本（申告は ${exp.rules}）`);
  if (exp.questions !== undefined && qs.length !== exp.questions)
    bad.push(`${tag}: 過去問が ${qs.length} 問（申告は ${exp.questions}）`);

  if (G.kind === "rules") {
    /* 見本の出力の中に、見る所がすべて出てくるか。
       図のブロックは提示物がテキストではないので、この検査はしない */
    const sample = G.sample();
    if (typeof sample === "string") {
      G.SPOTS.forEach((s) => {
        if (!sample.split("\n").some((l) => s.re.test(l)))
          bad.push(`${tag}: 見本に ${s.name} が無い`);
      });
    } else if (!G.judge(G.read(sample))) {
      bad.push(`${tag}: 見本が判定できない`);
    }
    /* 作った出力が、ねらったルールになるか（各300回） */
    Object.keys(G.MAKERS).forEach((k) => {
      for (let i = 0; i < 300; i++) {
        const t = G.make(k);
        if (!t) { bad.push(`${tag}: ${k} の出力が作れない`); return; }
        const r = G.judge(G.read(t));
        if (!r || r.key !== k) { bad.push(`${tag}: ${k} が ${r ? r.key : "判定なし"} になった`); return; }
        /* 決め手の行だけにしても、同じ判定のままか */
        const r2 = G.judge(G.read(G.excerpt(t, r.look)));
        if (!r2 || r2.verdict !== r.verdict) {
          bad.push(`${tag}: ${k} は決め手の行だけにすると判定が変わる`); return;
        }
      }
    });
  }

  /* **その問題が、画面に出るものだけで本当に解けるか。**
     ルートブリッジのように答えが選択肢の1つになる問題は、
     優先度とMACアドレスが「図の中」か「選択肢の中」か「MACの一覧」の
     どこかに必ず出ていないと、解きようがない */
  if (G.answer) {
    qs.forEach((q) => {
      const f = q.fig;
      if (!f) return;
      const inChoice = q.choices.some((c) => /[0-9a-f]{2}:[0-9a-f]{2}:/i.test(c));
      const inList = !!f.maclist;
      const inFig = !!f.figvals;   /* 図そのものに値が書かれている */
      if (!inChoice && !inList && !inFig && q.image) {
        bad.push(`${tag}: ${q.qid} は MACアドレスが画面のどこにも出ない（解けない）`);
      }
    });
  }

  /* 紙面から切り出した図が、ちゃんと置いてあるか */
  qs.forEach((q) => {
    if (!q.image) return;
    if (!fs.existsSync(q.image.src)) bad.push(`${tag}: ${q.qid} の図が無い（${q.image.src}）`);
  });

  /* 過去問の形。ここは kind によらず全ブロック共通 */
  /* **配列に穴（空の要素）が無いか。**forEach も filter も穴を飛ばすので、
     ふつうの検査では見つからない。手で編集したときに入りやすい */
  for (let i = 0; i < qs.length; i++) {
    if (!(i in qs)) bad.push(`${tag}: 過去問の並びの ${i} 番目が空`);
  }
  const seen = {};
  qs.forEach((q) => {
    if (seen[q.qid]) bad.push(`${tag}: ${q.qid} が2回入っている`);
    seen[q.qid] = 1;
    /* 左と右を結ぶ問題は、選ぶ形ではないので確かめる所が違う */
    if (q.pairs) {
      if (q.pairs.length < 2) bad.push(`${tag}: ${q.qid} の組が2つに満たない`);
      if (!q.targets || !q.targets.length) bad.push(`${tag}: ${q.qid} に入れ先が無い`);
      q.pairs.forEach((p) => {
        if (!p.l || !p.r) bad.push(`${tag}: ${q.qid} の組の中身が欠けている`);
        else if ((q.targets || []).indexOf(p.r) < 0)
          bad.push(`${tag}: ${q.qid} の入れ先「${p.r}」が一覧に無い`);
      });
      if (new Set(q.targets || []).size !== (q.targets || []).length)
        bad.push(`${tag}: ${q.qid} の入れ先が重複している`);
      return;
    }
    const ans = Array.isArray(q.answer) ? q.answer : [q.answer];
    if (!q.choices || !q.choices.length) bad.push(`${tag}: ${q.qid} に選択肢が無い`);
    if (!ans.length || !ans[0]) bad.push(`${tag}: ${q.qid} に答えが無い`);
    (q.choices || []).length && ans.forEach((a) => {
      if (q.choices.indexOf(a) < 0) bad.push(`${tag}: ${q.qid} の答えが選択肢に無い`);
    });
  });

  /* 判定エンジンがあるブロックは、過去問の判定が本の答えと合うか。
     **bookOnly に入れた問題は、この検査から外す。**
     規則では出せないが、本の答えで出題はできる問題（1問だけ違う聞き方、など）。
     **外すのは判定の検査だけで、問題はテストに出る。**取りこぼしを作らない */
  if (G.kind === "rules" && (spec.same || G.answer)) {
    const skip = spec.bookOnly || [];
    let hit = 0, only = 0;
    qs.forEach((q) => {
      if (skip.indexOf(q.qid) >= 0) { only++; return; }
      const ex = q.fig || q.exhibit;
      /* 問題文だけで決まる題材（wantsQuestion）は、提示物が無くてもよい。
         例「2つのスイッチはすべて既定の設定です。トランクにするには」 */
      if (!ex && !spec.wantsQuestion) { bad.push(`${tag}: ${q.qid} に提示物が無い`); return; }
      /* 「足りない設定を選ぶ」系は、決め手が**問題文のほう**にある
         （例「別のベンダーと」「応答するが開始しない」）。
         その題材は問題文もいっしょに渡す（spec.wantsQuestion） */
      const v = G.read(spec.wantsQuestion ? { text: q.text, exhibit: ex } : ex);
      const r = G.judge(v);
      const ans = Array.isArray(q.answer) ? q.answer.join(" ") : q.answer;
      let ok;
      /* 本の答えと突き合わせる道が2つある。**どちらかで当たれば合格。**
           ① answer(v) … その場で計算した答え（ルートブリッジの SW 名、数える問題の数）
           ② same      … 判定の答えと同じ意味の言い方の一覧
         ②が要るのは、**本が同じ答えを3冊で違う書き方で刷っている**ため。
         例「末尾に中括弧（}）」「末尾の中括弧 ( } )」。共通するのは「中括弧」だけ */
      const byAnswer = G.answer
        ? (() => { const a = G.answer(v); return !!a && ans.replace(/\s/g, "").indexOf(a) >= 0; })()
        : false;
      const bySame = spec.same
        ? (spec.same[(r || {}).verdict] || []).some(
            (w) => ans.toLowerCase().indexOf(w.toLowerCase()) >= 0)
        : false;
      ok = !!r && (byAnswer || bySame);
      if (ok) hit++;
      else bad.push(`${tag}: ${q.qid} の判定が本の答えと合わない（${r ? r.verdict : "判定なし"}）`);
    });
    console.log(`  ${tag}: 見る所 ${G.SPOTS.length} / ルール ${G.RULES.length} / ` +
      `過去問の判定が本と合う ${hit} / ${qs.length - only}` +
      (only ? `（本の答えだけで出す ${only} 問は判定の検査から外す）` : ""));
  } else {
    console.log(`  ${tag}: 過去問 ${qs.length} 問（判定エンジンなし。形だけ確かめた）`);
  }
  totalQ += qs.length;
});

/* ── 画面に出る言葉に、書きかけの印が残っていないか ──────
 * `**ここが大事**` のような書き方は、覚え書き（コメント）の中だけ。
 * spec の文字列は**そのまま画面に出る**ので、印が残っていると
 * 「**この題材は…**」と、記号ごと表示されてしまう。
 */
{
  const bad2 = [];
  const look = (v, where) => {
    if (typeof v === "string") {
      if (v.indexOf("**") >= 0) bad2.push(`${where}: ${v.slice(0, 40)}…`);
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => look(x, `${where}[${i}]`)); return; }
    if (v && typeof v === "object") {
      Object.keys(v).forEach((k) => {
        if (k === "re" || k === "pat" || typeof v[k] === "function") return;
        look(v[k], `${where}.${k}`);
      });
    }
  };
  BLOCK_IDS.forEach((id) => {
    const sp = SPECS[id];
    if (!sp) return;
    ["spots", "rules", "gloss", "name", "note", "ask"].forEach((k) => look(sp[k], `${id}.${k}`));
  });
  bad2.forEach((b) => bad.push(`画面の言葉に ** が残っている … ${b}`));
}

/* ── 画面の言葉が、決めた用語で書かれているか ──────────
 * こちらで作った言い回しは使わない。**講義でそのまま使える言葉にそろえる。**
 *
 *   見る所   → 確認項目        入れ先 → 用語
 *   札・束・ブロック → 分野      印   → バッジ
 *   覚える1枚 → （使わない。構成をそのまま書く）
 */
{
  const OLD = {
    "見る所": "確認項目",
    "入れ先": "用語",
    "覚える1枚": "説明の1枚（構成をそのまま書く）",
    "印が付": "バッジが付",
    "ブロック": "分野",
    "この題材": "この分野"
  };
  const found = [];
  const look = (v, where) => {
    if (typeof v === "string") {
      Object.keys(OLD).forEach((k) => {
        if (v.indexOf(k) >= 0) found.push(`${where}: 「${k}」→「${OLD[k]}」（${v.slice(0, 26)}…）`);
      });
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => look(x, `${where}[${i}]`)); return; }
    if (v && typeof v === "object") {
      Object.keys(v).forEach((k) => {
        if (k === "re" || k === "pat" || typeof v[k] === "function") return;
        look(v[k], `${where}.${k}`);
      });
    }
  };
  BLOCK_IDS.forEach((id) => {
    const sp = SPECS[id];
    if (!sp) return;
    ["spots", "rules", "gloss", "name", "note", "ask"].forEach((k) => look(sp[k], `${id}.${k}`));
  });
  /* 画面そのもの（app.jsx）も見る。文字列の中だけを見て、覚え書きは見ない */
  const jsx = fs.readFileSync(path.join(__dirname, "app.jsx"), "utf8").split("\n");
  let inC = false;
  jsx.forEach((line, i) => {
    const t = line.trim();
    if (!inC && t.startsWith("/*") && t.indexOf("*/") < 0) { inC = true; return; }
    if (inC) { if (t.indexOf("*/") >= 0) inC = false; return; }
    if (t.startsWith("//") || t.startsWith("*")) return;
    (line.match(/"(?:[^"\\]|\\.)*"/g) || []).forEach((lit) => {
      if (lit.indexOf("className") >= 0) return;
      Object.keys(OLD).forEach((k) => {
        if (lit.indexOf(k) >= 0) found.push(`app.jsx:${i + 1}: 「${k}」→「${OLD[k]}」`);
      });
    });
    /* JSX の中に、囲みなしで直接書いた文（<div>…</div> の中身）も見る。
       文字列の中だけを見ていたときは、ここが素通りしていた */
    const plain = line
      .replace(/\/\*[\s\S]*?\*\//g, "")            /* 1行で閉じている覚え書き */
      .replace(/"(?:[^"\\]|\\.)*"/g, "")
      .replace(/\/\/.*$/, "");
    Object.keys(OLD).forEach((k) => {
      if (plain.indexOf(k) >= 0) found.push(`app.jsx:${i + 1}: 「${k}」→「${OLD[k]}」`);
    });
  });
  found.forEach((f) => bad.push(`古い言い回しが残っている … ${f}`));
}

/* ── 画面の言葉が、自然な日本語になっているか ──────────
 * **講義でそのまま使える文にする。**
 * 分かりやすくするつもりで、ふだん使わない言い方に置きかえない。
 *   ・常用漢字はひらがなにしない（くらべる → 比べる）
 *   ・自分で作った言いかえを使わない（住所 → IP アドレス、合言葉 → 事前共有キー）
 *   ・話し言葉に寄せない（打つ → 入力する、〜の話 → 〜について）
 * `` はコード用の記号で、画面にはそのまま文字として出る。
 */
{
  const NG = {
    "くらべ": "比べ",
    "こわれ": "壊れ",
    "しくじ": "失敗",
    "ちがう": "違う",
    "ちがい": "違い",
    "住所": "IP アドレス",
    "合言葉": "事前共有キー",
    "載せる先": "所属させるインターフェース",
    "なりたい度合い": "選ばれやすさを決める設定値",
    "を打つ": "を入力する",
    "けた違い": "桁違い",
    "`": "（画面にそのまま出るので使わない）"
  };
  const found = [];
  const look = (v, where) => {
    if (typeof v === "string") {
      Object.keys(NG).forEach((k) => {
        if (v.indexOf(k) >= 0) found.push(`${where}: 「${k}」→「${NG[k]}」（${v.slice(0, 26)}…）`);
      });
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => look(x, `${where}[${i}]`)); return; }
    if (v && typeof v === "object") {
      Object.keys(v).forEach((k) => {
        if (k === "re" || k === "pat" || typeof v[k] === "function") return;
        look(v[k], `${where}.${k}`);
      });
    }
  };
  BLOCK_IDS.forEach((id) => {
    const sp = SPECS[id];
    if (!sp) return;
    ["spots", "rules", "gloss", "name", "note", "ask"].forEach((k) => look(sp[k], `${id}.${k}`));
  });
  found.forEach((f) => bad.push(`画面の言葉が不自然 … ${f}`));
}

/* ── 絵の問題に、紙面の画像があるか ─────────────────
 * **絵（ネットワーク図・機器の画面・表）は、言葉で作り直さない。紙面の実物を出す。**
 * 元データ（master.jsonl）で提示物に図が入っている問題は、
 * showread/img/index.js に切り出しが無ければ止める。
 */
{
  const scans = fs.existsSync(path.join(__dirname, "img", "index.js"))
    ? require(path.join(__dirname, "img", "index.js")) : {};
  const mp = path.join(__dirname, "..", "out", "full", "master.jsonl");
  if (fs.existsSync(mp)) {
    const kind = {};
    fs.readFileSync(mp, "utf8").split("\n").forEach((l) => {
      if (!l.trim()) return;
      const r = JSON.parse(l);
      kind[r.qid] = r.exhibit || "none";
    });
    const hasFig = (k) => /topology|gui|table/.test(k);
    const missing = [];
    Object.keys(BANKS).forEach((id) => (BANKS[id] || []).forEach((q) => {
      const from = q.from || [String(q.qid).replace(/#\d+$/, "")];
      if (!from.some((f) => hasFig(kind[f] || "none"))) return;
      if (!scans[String(q.qid).replace(/#\d+$/, "")]) missing.push(`${id}: ${q.qid}`);
    }));
    if (missing.length) {
      bad.push(`絵をふくむ問題 ${missing.length} 問に、紙面の切り出しが無い` +
        `（${missing.slice(0, 3).join(" / ")}…）`);
    }
    /* 台帳にあるのに、ファイルが置かれていない */
    Object.keys(scans).forEach((qid) => {
      if (!fs.existsSync(path.join(__dirname, scans[qid].src)))
        bad.push(`${qid} の切り出しが無い（${scans[qid].src}）`);
      if (!/^(fig|all)$/.test(scans[qid].covers))
        bad.push(`${qid} の covers が fig でも all でもない`);
    });
    console.log(`紙面から切り出した提示物 ${Object.keys(scans).length} 枚`);
  }
}

/* ── 本の1問が、画面の1問として出ているか ─────────────
 * **テストは、問題集に載っている問題そのものを出す。**
 * こちらの都合で1問を2問以上に分けたら、それはもう本の問題ではない。
 * 分けたものは練習用（q/practice/）に置く。テストの入れ物には入れない。
 */
{
  const split = [];
  Object.keys(BANKS).forEach((id) => (BANKS[id] || []).forEach((q) => {
    if (/#\d+$/.test(String(q.qid))) split.push(`${id}: ${q.qid}`);
  }));
  if (split.length) {
    bad.push(`テストの入れ物に、本の1問を分けたものが ${split.length} 問ある` +
      `（${split.slice(0, 3).join(" / ")}…）`);
  }
}

/* ── 同じ問題が2つのブロックに入っていないか ───────────
 * ブロックを分けて作っていると、同じ問題が別々のブロックに入ることがある。
 * テストで同じ問題が2回出るので、見つけたら止める。
 */
{
  const where = {};
  Object.keys(BANKS).forEach((id) => (BANKS[id] || []).forEach((q) => {
    (q.from || [String(q.qid).replace(/#\d+$/, "")]).forEach((f) => {
      (where[f] = where[f] || []).push(id);
    });
  }));
  Object.keys(where).forEach((f) => {
    const ids = Array.from(new Set(where[f]));
    if (ids.length > 1) bad.push(`${f} が ${ids.join(" と ")} の両方に入っている`);
  });
}

/* ── 出題パターンの見張り ─────────────────────
 * **同じ聞かれ方の問題が何問も並んでいると、テストが長いだけで身に付かない。**
 * そこで分野ごとに上限を決めて絞っている（JSON は 41 → 25 問）。
 * ただし**絞ったせいで、出題パターンが1つでも消えてはいけない。**
 * 分野が pattern(q) を持っていれば、本にあったパターンが全部
 * 残っているかを、ここで毎回確かめる。
 *
 *   spec.patterns  … 本にあった出題パターンの一覧（絞る前に数えたもの）
 *   spec.pattern(q) … 過去問1問 → そのパターンの名前
 */
{
  BLOCK_IDS.forEach((id) => {
    const sp = SPECS[id];
    if (!sp || typeof sp.pattern !== "function" || !sp.patterns) return;
    const qs = BANKS[id] || [];
    /* 判定エンジンを渡す。**パターンは「どのルールで答えが出るか」で決まる**
       ことが多く、それを知っているのはエンジンのほうだから */
    const have = new Set(qs.map((q) => sp.pattern(q, GENS[id])).filter(Boolean));
    const lost = sp.patterns.filter((p) => !have.has(p));
    lost.forEach((p) => bad.push(`${sp.name}: 出題パターン「${p}」がテストから消えている`));
    const extra = [...have].filter((p) => sp.patterns.indexOf(p) < 0);
    extra.forEach((p) => bad.push(`${sp.name}: 見覚えのない出題パターン「${p}」がある`));
    console.log(`  ${sp.name}: 出題パターン ${sp.patterns.length} 種類がすべて残っている`);
  });
}

/* ── 全問カバーの見張り ───────────────────────
 * **束B の335問が、どれかのブロックに入っているか。**
 * 入っていない問題は、out/full/not_used.csv に理由つきで載っていなければならない。
 * **黙って落ちた問題を、ここで見つける。**
 */
{
  const csvPath = path.join(__dirname, "..", "out", "full", "bucket_review.csv");
  const notUsed = path.join(__dirname, "..", "out", "full", "not_used.csv");
  if (fs.existsSync(csvPath) && fs.existsSync(notUsed)) {
    const cell = (line) => {
      /* 「,」を含む値は引用符でくくられている。素朴に割らない */
      const out = []; let cur = "", q = false;
      for (const ch of line) {
        if (ch === '"') q = !q;
        else if (ch === "," && !q) { out.push(cur); cur = ""; }
        else cur += ch;
      }
      out.push(cur); return out;
    };
    const rows = fs.readFileSync(csvPath, "utf8").split("\n").filter(Boolean).map(cell);
    const head = rows[0];
    const iQid = head.indexOf("問題番号"), iB1 = head.indexOf("束（機械）"),
          iB2 = head.indexOf("束（直したもの）");
    const all = rows.slice(1).filter((r) => (r[iB2] || r[iB1]) === "B").map((r) => r[iQid]);
    const placed = new Set();
    Object.keys(BANKS).forEach((id) => (BANKS[id] || []).forEach((q) => {
      (q.from || [String(q.qid).replace(/#\d+$/, "")]).forEach((f) => placed.add(f));
    }));
    const excused = new Set(fs.readFileSync(notUsed, "utf8").split("\n")
      .slice(1).filter(Boolean).map((l) => cell(l)[0]));
    const lost = all.filter((q) => !placed.has(q) && !excused.has(q));
    const covered = all.filter((q) => placed.has(q)).length;
    console.log(`束B ${all.length} 問中 ${covered} 問がブロックに入っている` +
      `（出さないと決めた ${excused.size} 問をのぞく）`);
    lost.forEach((q) => bad.push(`${q} がどのブロックにも入らず、理由も書かれていない`));
  }
}

/* ── 引き継ぎの見張り ─────────────────────────
 * ブロックが「この問題はよそのブロック行き」と言ったら（spec.movedTo）、
 * **その問題が本当にどこかのブロックに入っているか**を確かめる。
 * 入っていなければ、まだ宙に浮いている。**取りこぼしはここで見つける。**
 */
{
  const placed = new Set();
  Object.keys(BANKS).forEach((id) => (BANKS[id] || []).forEach((q) => {
    placed.add(q.qid);
    (q.from || []).forEach((f) => placed.add(f));
  }));
  const waiting = [];
  BLOCK_IDS.forEach((id) => {
    const m = (SPECS[id] || {}).movedTo || {};
    Object.keys(m).forEach((qid) => {
      if (!placed.has(qid)) waiting.push(`${qid} → ${m[qid]}（${id} から）`);
    });
  });
  if (waiting.length) {
    console.log(`引き継ぎ待ち ${waiting.length} 問（まだどのブロックにも入っていない）`);
    waiting.forEach((w) => console.log("   ・" + w));
  } else {
    console.log("引き継ぎ待ちの問題はありません");
  }
}

/* 画面に出る1問1問の形（練習・テストとも同じ形か、正解が選択肢の中にあるか） */
const { run } = require(path.join(__dirname, "selftest.js"));
run().forEach((b) => bad.push(b));

console.log(`ブロック ${BLOCK_IDS.length} / 過去問 ${totalQ} 問`);
if (bad.length) {
  console.error("\n止まりました。直してからもう一度：");
  bad.slice(0, 20).forEach((b) => console.error("  NG  " + b));
  process.exit(1);
}
console.log("検査はすべて通りました。");
