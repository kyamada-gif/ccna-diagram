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

  function svg(fig) {
    if (!fig || !fig.sw || !fig.sw.length) return "";
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
               '" rx="8" class="fg-box" />');
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
