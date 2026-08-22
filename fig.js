/* 図を描く。**React を使わない。**データを渡すと SVG の文字列が返るだけ。
 *
 * 本番環境が React でなくても、このファイルだけ持っていけば同じ図が出せる。
 * 画面側（app.jsx）は、返ってきた文字列をそのまま入れているだけ。
 *
 *   fig = {
 *     sw:   [{id:"SW1", pri:8192, mac:"00:24:98:6f:3b:41"}, …],   ← 4台
 *     link: [["SW1","Gi1/0/1","SW2","Gi1/0/1"], …],               ← 線
 *     host: [["SW1","User1.lab"], …]                              ← ぶら下がる機器
 *   }
 *
 * **図はいつも同じ形にする。**優先度とMACアドレスは、必ず箱の中に書く。
 * 本の紙面では、値が選択肢の側に書かれている問題もあるが、
 * 見るたびに置き場所が変わると、見る順番を覚えられない。
 */
(function (global) {
  "use strict";

  var W = 320, BW = 132, GAPY = 92, PAD = 8;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function layout(fig) {
    var bh = 60;
    /* 置き場所は**並び順**で決める。名前で引かない。
       本の誤植で同じ名前が2回出てくる問題があり、名前で引くと箱が重なる */
    var order = fig.sw.map(function (s, i) { return { id: s.id, i: i }; })
      .sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : a.i - b.i; });
    var slot = order.map(function (o, k) {
      return { i: o.i, id: o.id,
               x: (k % 2 === 0) ? PAD : W - PAD - BW,
               y: PAD + Math.floor(k / 2) * (bh + GAPY) };
    });
    var byId = {};
    slot.forEach(function (s) { if (!byId[s.id]) byId[s.id] = s; });
    var hasHost = (fig.host || []).length > 0;
    var h = PAD + bh + GAPY + bh + PAD + (hasHost ? 34 : 0);
    return { slot: slot, byId: byId, bw: BW, bh: bh, h: h };
  }

  /* ── 星形（中央に1つ、まわりに4つ）─────────────────
   * OSPF の DR 選出の図。中央のスイッチに、上下左右からルータがつながる。
   *   { shape:"star", hub:"スイッチ", title:"OSPF 1",
   *     node:[ {id:"R1", at:"top|left|right|bottom", pri:108, rid:"1.1.1.1", tag:"DR"}, … ] }
   */
  function star(fig) {
    /* **箱の幅は中身に合わせて決める。**
       決め打ちにすると、ルータ ID が長いときに文字がはみ出し、
       左右の箱が中央の箱と重なる（左 8〜130、中央 114〜206 で 16 重なっていた）。 */
    var HH = 30, NH = 54, GAP = 62, GAPX = 14;
    /* 見分ける番号は、**どこに書いてあるかで名前が変わる。**
       ルータ ID の行があればそれ、無ければ Loopback、それも無ければ
       インターフェースの IP アドレス。名前を付けずに数字だけ出すと、
       どれを見ているのか分からない（本の図には名前が書いてある） */
    var idText = function (n) {
      if (n.rid) return "ルータ ID " + n.rid;
      if (n.lo) return "Loopback " + n.lo;
      return n.ip ? "IP アドレス " + n.ip : "";
    };
    var wide = 0;
    (fig.node || []).forEach(function (n) {
      [String(n.id) + (n.tag ? "（" + n.tag + "）" : ""),
       "優先度 " + n.pri,
       idText(n)].forEach(function (t) {
        if (t.length > wide) wide = t.length;
      });
    });
    var HB = Math.max(92, String(fig.hub || "").length * 7.4 + 20);
    var NB = Math.max(122, wide * 6.6 + 18);
    var SW = PAD * 2 + NB * 2 + GAPX * 2 + HB;
    var cx = SW / 2, cy = PAD + NH + GAP + HH / 2;
    var H = cy + HH / 2 + GAP + NH + PAD;
    var spot = {
      top:    { x: cx - NB / 2, y: PAD },
      left:   { x: PAD, y: cy - NH / 2 },
      right:  { x: SW - PAD - NB, y: cy - NH / 2 },
      bottom: { x: cx - NB / 2, y: H - PAD - NH }
    };
    var out = [];
    /* 線。中央から各ルータの中心へ引き、箱をあとから重ねる */
    (fig.node || []).forEach(function (n) {
      var p = spot[n.at];
      if (!p) return;
      out.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + (p.x + NB / 2) +
               '" y2="' + (p.y + NH / 2) + '" class="fg-l" />');
    });
    /* 中央 */
    out.push('<rect x="' + (cx - HB / 2) + '" y="' + (cy - HH / 2) + '" width="' + HB +
             '" height="' + HH + '" rx="8" class="fg-box" />');
    out.push('<text x="' + cx + '" y="' + (cy + 4) + '" class="fg-id">' + esc(fig.hub || "") + '</text>');
    /* まわりのルータ。**名前・優先度・RID の3段** */
    (fig.node || []).forEach(function (n) {
      var p = spot[n.at];
      if (!p) return;
      /* fig.mark に名前があれば、その箱を光らせる。
         **説明の1枚で、どの2台を見比べているのかを目で見せるため。** */
      out.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + NB + '" height="' + NH +
               '" rx="8" class="fg-box' +
               ((fig.mark || []).indexOf(n.id) >= 0 ? " fg-on" : "") + '" />');
      out.push('<text x="' + (p.x + NB / 2) + '" y="' + (p.y + 16) + '" class="fg-id">' +
               esc(n.id) + (n.tag ? "（" + esc(n.tag) + "）" : "") + '</text>');
      out.push('<text x="' + (p.x + NB / 2) + '" y="' + (p.y + 32) +
               '" class="fg-v">優先度 ' + esc(n.pri) + '</text>');
      out.push('<text x="' + (p.x + NB / 2) + '" y="' + (p.y + 47) +
               '" class="fg-v">' + esc(idText(n)) + '</text>');
    });
    return '<svg viewBox="0 0 ' + SW + ' ' + H + '" class="fg" ' +
           'preserveAspectRatio="xMidYMid meet" role="img">' + out.join("") + '</svg>';
  }

  function svg(fig) {
    if (!fig) return "";
    if (fig.shape === "star") return star(fig);
    if (!fig.sw || !fig.sw.length) return "";
    var L = layout(fig);
    var out = [];

    /* 線を先に描く。箱をあとから重ねるので、線が箱の縁で止まって見える */
    (fig.link || []).forEach(function (lk) {
      var a = L.byId[lk[0]], b = L.byId[lk[2]];
      if (!a || !b) return;
      out.push('<line x1="' + (a.x + L.bw / 2) + '" y1="' + (a.y + L.bh / 2) +
               '" x2="' + (b.x + L.bw / 2) + '" y2="' + (b.y + L.bh / 2) +
               '" class="fg-l" />');
    });

    /* ぶら下がる機器（User1.lab など）。下の段の箱から下へ短い線を引く */
    (fig.host || []).forEach(function (hs) {
      var p = L.byId[hs[0]];
      if (!p) return;
      var cx = p.x + L.bw / 2, y0 = p.y + L.bh, y1 = L.h - 26;
      out.push('<line x1="' + cx + '" y1="' + y0 + '" x2="' + cx + '" y2="' + y1 + '" class="fg-l" />');
      out.push('<text x="' + cx + '" y="' + (y1 + 14) + '" class="fg-host">' + esc(hs[1]) + '</text>');
    });

    /* 箱。**いつも 名前・優先度・MACアドレス の3段** */
    L.slot.forEach(function (p) {
      var s = fig.sw[p.i] || {};
      out.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + L.bw + '" height="' + L.bh +
               '" rx="8" class="fg-box' +
               ((fig.mark || []).indexOf(s.id) >= 0 ? " fg-on" : "") + '" />');
      out.push('<text x="' + (p.x + L.bw / 2) + '" y="' + (p.y + 17) +
               '" class="fg-id">' + esc(s.id) + '</text>');
      out.push('<text x="' + (p.x + L.bw / 2) + '" y="' + (p.y + 34) +
               '" class="fg-v">優先度 ' + esc(s.pri) + '</text>');
      out.push('<text x="' + (p.x + L.bw / 2) + '" y="' + (p.y + 50) +
               '" class="fg-v">' + esc(s.mac) + '</text>');
    });

    return '<svg viewBox="0 0 ' + W + ' ' + L.h + '" class="fg" ' +
           'preserveAspectRatio="xMidYMid meet" role="img">' + out.join("") + '</svg>';
  }

  var API = { svg: svg };
  global.FIG = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
