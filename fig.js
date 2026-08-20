/* 図を描く。**React を使わない。**データを渡すと SVG の文字列が返るだけ。
 *
 * 本番環境が React でなくても、このファイルだけ持っていけば同じ図が出せる。
 * 画面側（app.jsx）は、返ってきた文字列をそのまま入れているだけ。
 *
 *   fig = {
 *     sw:   [{id:"SW1", pri:8192, mac:"00:24:98:6f:3b:41"}, …],   ← 4台
 *     link: [["SW1","Gi1/0/1","SW2","Gi1/0/1"], …],               ← 線
 *     host: [["SW1","User1.lab"], …],                             ← ぶら下がる機器
 *     where:"fig" | "choice"   値が図に書いてあるか、選択肢に書いてあるか
 *   }
 *
 * where が "choice" のときは、図に優先度とMACを書かない。
 * **本の問題がそうなっているから。**書いてしまうと、本番と違う問題になる。
 */
(function (global) {
  "use strict";

  var W = 320, BW = 132, GAPY = 92, PAD = 8;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function layout(fig) {
    var showVals = fig.where !== "choice";
    var bh = showVals ? 60 : 38;
    var ids = fig.sw.map(function (s) { return s.id; }).sort();
    var pos = {};
    ids.forEach(function (id, i) {
      pos[id] = { x: (i % 2 === 0) ? PAD : W - PAD - BW, y: PAD + Math.floor(i / 2) * (bh + GAPY) };
    });
    var hasHost = (fig.host || []).length > 0;
    var h = PAD + bh + GAPY + bh + PAD + (hasHost ? 34 : 0);
    return { pos: pos, ids: ids, bw: BW, bh: bh, h: h, showVals: showVals };
  }

  function svg(fig) {
    if (!fig || !fig.sw || !fig.sw.length) return "";
    var L = layout(fig);
    var byId = {};
    fig.sw.forEach(function (s) { byId[s.id] = s; });
    var out = [];

    /* 線を先に描く。箱をあとから重ねるので、線が箱の縁で止まって見える */
    (fig.link || []).forEach(function (lk) {
      var a = L.pos[lk[0]], b = L.pos[lk[2]];
      if (!a || !b) return;
      out.push('<line x1="' + (a.x + L.bw / 2) + '" y1="' + (a.y + L.bh / 2) +
               '" x2="' + (b.x + L.bw / 2) + '" y2="' + (b.y + L.bh / 2) +
               '" class="fg-l" />');
    });

    /* ぶら下がる機器（User1.lab など）。下の段の箱から下へ短い線を引く */
    (fig.host || []).forEach(function (hs) {
      var p = L.pos[hs[0]];
      if (!p) return;
      var cx = p.x + L.bw / 2, y0 = p.y + L.bh, y1 = L.h - 26;
      out.push('<line x1="' + cx + '" y1="' + y0 + '" x2="' + cx + '" y2="' + y1 + '" class="fg-l" />');
      out.push('<text x="' + cx + '" y="' + (y1 + 14) + '" class="fg-host">' + esc(hs[1]) + '</text>');
    });

    /* 箱 */
    L.ids.forEach(function (id) {
      var p = L.pos[id], s = byId[id] || {};
      out.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + L.bw + '" height="' + L.bh +
               '" rx="8" class="fg-box" />');
      out.push('<text x="' + (p.x + L.bw / 2) + '" y="' + (p.y + (L.showVals ? 17 : 24)) +
               '" class="fg-id">' + esc(id) + '</text>');
      if (L.showVals) {
        out.push('<text x="' + (p.x + L.bw / 2) + '" y="' + (p.y + 34) +
                 '" class="fg-v">優先度 ' + esc(s.pri) + '</text>');
        out.push('<text x="' + (p.x + L.bw / 2) + '" y="' + (p.y + 50) +
                 '" class="fg-v">' + esc(s.mac) + '</text>');
      }
    });

    return '<svg viewBox="0 0 ' + W + ' ' + L.h + '" class="fg" ' +
           'preserveAspectRatio="xMidYMid meet" role="img">' + out.join("") + '</svg>';
  }

  var API = { svg: svg };
  global.FIG = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
