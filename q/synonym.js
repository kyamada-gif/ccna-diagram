/* 言い換え表。手で直さない。scripts/matching.py が作る。
   **テストの選択肢は本の言葉のまま。**この表は練習で
   「同じものを指す言い方」を1つにまとめるためだけに使う。 */
(function (global) {
  "use strict";
  global.SYNONYM = {
 "承認": "認可",
 "認可": "認可",
 "Accounting": "アカウンティング",
 "アカウンティング": "アカウンティング",
 "単一モードファイバー": "シングルモードファイバー",
 "シングルモードファイバー": "シングルモードファイバー",
 "シングルモード光ファイバー": "シングルモードファイバー",
 "銅": "銅線",
 "銅線": "銅線",
 "同軸": "銅線",
 "無線LANコントローラー": "ワイヤレス LAN コントローラ",
 "ワイヤレス LAN コントローラ": "ワイヤレス LAN コントローラ",
 "ユニークローカルアドレス": "ユニークローカル",
 "ユニークローカル": "ユニークローカル",
 "ユニーク ローカルアドレス": "ユニークローカル",
 "リンクローカル": "リンクローカルアドレス",
 "リンクローカルアドレス": "リンクローカルアドレス",
 "Cisco DNA センター": "Cisco DNA Center",
 "Cisco DNA Center": "Cisco DNA Center",
 "Cisco DNA Center デバイス管理": "Cisco DNA Center",
 "従来のキャンパスデバイス管理": "従来型",
 "従来型": "従来型",
 "従来のデバイス管理": "従来型",
 "特徴（Ansible）": "Ansible",
 "Ansible": "Ansible"
};
  if (typeof module !== "undefined" && module.exports) module.exports = global.SYNONYM;
})(typeof window !== "undefined" ? window : globalThis);
