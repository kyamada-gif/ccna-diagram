/* 紙面から切り出した提示物。**手で直さない。**
   scripts/build_exhibit_images.py が work/exhibit_boxes.jsonl から作る。
   covers … fig（図だけ）／all（図と出力が同じ箱） */
(function (global) {
  "use strict";
  global.SCANS = {
 "B1-P11-019": {
  "src": "img/B1-P11-019.png",
  "w": 619,
  "h": 189,
  "covers": "fig"
 },
 "B1-P11-030": {
  "src": "img/B1-P11-030.png",
  "w": 760,
  "h": 294,
  "covers": "fig"
 },
 "B1-P11-038": {
  "src": "img/B1-P11-038.png",
  "w": 760,
  "h": 362,
  "covers": "all"
 },
 "B1-P11-054": {
  "src": "img/B1-P11-054.png",
  "w": 710,
  "h": 198,
  "covers": "fig"
 },
 "B1-P11-064": {
  "src": "img/B1-P11-064.png",
  "w": 454,
  "h": 312,
  "covers": "fig"
 },
 "B1-P11-069": {
  "src": "img/B1-P11-069.png",
  "w": 662,
  "h": 288,
  "covers": "fig"
 },
 "B1-P12-014": {
  "src": "img/B1-P12-014.png",
  "w": 760,
  "h": 708,
  "covers": "all"
 },
 "B1-P12-034": {
  "src": "img/B1-P12-034.png",
  "w": 416,
  "h": 396,
  "covers": "fig"
 },
 "B1-P12-048": {
  "src": "img/B1-P12-048.png",
  "w": 619,
  "h": 132,
  "covers": "fig"
 },
 "B1-P12-059": {
  "src": "img/B1-P12-059.png",
  "w": 568,
  "h": 390,
  "covers": "fig"
 },
 "B1-P12-062": {
  "src": "img/B1-P12-062.png",
  "w": 760,
  "h": 164,
  "covers": "fig"
 },
 "B1-P12-076": {
  "src": "img/B1-P12-076.png",
  "w": 629,
  "h": 202,
  "covers": "fig"
 },
 "B1-P13-001": {
  "src": "img/B1-P13-001.png",
  "w": 643,
  "h": 304,
  "covers": "fig"
 },
 "B1-P13-006": {
  "src": "img/B1-P13-006.png",
  "w": 442,
  "h": 119,
  "covers": "fig"
 },
 "B1-P13-028": {
  "src": "img/B1-P13-028.png",
  "w": 532,
  "h": 242,
  "covers": "fig"
 },
 "B1-P13-030": {
  "src": "img/B1-P13-030.png",
  "w": 760,
  "h": 154,
  "covers": "fig"
 },
 "B1-P13-082": {
  "src": "img/B1-P13-082.png",
  "w": 512,
  "h": 92,
  "covers": "fig"
 },
 "B1-P13-091": {
  "src": "img/B1-P13-091.png",
  "w": 479,
  "h": 482,
  "covers": "fig"
 },
 "B1-P14-016": {
  "src": "img/B1-P14-016.png",
  "w": 667,
  "h": 212,
  "covers": "fig"
 },
 "B1-P14-049": {
  "src": "img/B1-P14-049.png",
  "w": 539,
  "h": 463,
  "covers": "fig"
 },
 "B1-P14-053": {
  "src": "img/B1-P14-053.png",
  "w": 551,
  "h": 392,
  "covers": "fig"
 },
 "B1-P14-074": {
  "src": "img/B1-P14-074.png",
  "w": 660,
  "h": 308,
  "covers": "fig"
 },
 "B1-P14-091": {
  "src": "img/B1-P14-091.png",
  "w": 480,
  "h": 312,
  "covers": "fig"
 },
 "B1-P14-102": {
  "src": "img/B1-P14-102.png",
  "w": 532,
  "h": 154,
  "covers": "fig"
 },
 "B1-P15-001": {
  "src": "img/B1-P15-001.png",
  "w": 434,
  "h": 688,
  "covers": "all"
 },
 "B1-P15-007": {
  "src": "img/B1-P15-007.png",
  "w": 441,
  "h": 384,
  "covers": "fig"
 },
 "B1-P15-010": {
  "src": "img/B1-P15-010.png",
  "w": 657,
  "h": 463,
  "covers": "fig"
 },
 "B1-P15-011": {
  "src": "img/B1-P15-011.png",
  "w": 427,
  "h": 370,
  "covers": "fig"
 },
 "B1-P15-025": {
  "src": "img/B1-P15-025.png",
  "w": 410,
  "h": 356,
  "covers": "fig"
 },
 "B1-P15-026": {
  "src": "img/B1-P15-026.png",
  "w": 411,
  "h": 356,
  "covers": "fig"
 },
 "B1-P15-046": {
  "src": "img/B1-P15-046.png",
  "w": 593,
  "h": 418,
  "covers": "all"
 },
 "B1-P15-057": {
  "src": "img/B1-P15-057.png",
  "w": 760,
  "h": 418,
  "covers": "all"
 },
 "B1-P15-069": {
  "src": "img/B1-P15-069.png",
  "w": 492,
  "h": 225,
  "covers": "fig"
 },
 "B1-P15-083": {
  "src": "img/B1-P15-083.png",
  "w": 679,
  "h": 289,
  "covers": "fig"
 },
 "B1-P16-001": {
  "src": "img/B1-P16-001.png",
  "w": 386,
  "h": 461,
  "covers": "fig"
 },
 "B1-P16-008": {
  "src": "img/B1-P16-008.png",
  "w": 760,
  "h": 311,
  "covers": "all"
 },
 "B1-P16-022": {
  "src": "img/B1-P16-022.png",
  "w": 558,
  "h": 80,
  "covers": "fig"
 },
 "B1-P16-045": {
  "src": "img/B1-P16-045.png",
  "w": 760,
  "h": 368,
  "covers": "all"
 },
 "B1-P16-056": {
  "src": "img/B1-P16-056.png",
  "w": 760,
  "h": 175,
  "covers": "fig"
 },
 "B1-P16-064": {
  "src": "img/B1-P16-064.png",
  "w": 632,
  "h": 232,
  "covers": "fig"
 },
 "B1-P16-065": {
  "src": "img/B1-P16-065.png",
  "w": 482,
  "h": 97,
  "covers": "all"
 },
 "B2-0001-02": {
  "src": "img/B2-0001-02.png",
  "w": 736,
  "h": 267,
  "covers": "all"
 },
 "B2-0003-01": {
  "src": "img/B2-0003-01.png",
  "w": 734,
  "h": 265,
  "covers": "all"
 },
 "B2-0005-01": {
  "src": "img/B2-0005-01.png",
  "w": 760,
  "h": 237,
  "covers": "all"
 },
 "B2-0006-01": {
  "src": "img/B2-0006-01.png",
  "w": 735,
  "h": 254,
  "covers": "all"
 },
 "B2-0007-01": {
  "src": "img/B2-0007-01.png",
  "w": 760,
  "h": 230,
  "covers": "all"
 },
 "B2-0011-01": {
  "src": "img/B2-0011-01.png",
  "w": 760,
  "h": 182,
  "covers": "all"
 },
 "B2-0013-01": {
  "src": "img/B2-0013-01.png",
  "w": 760,
  "h": 246,
  "covers": "all"
 },
 "B2-0016-01": {
  "src": "img/B2-0016-01.png",
  "w": 484,
  "h": 266,
  "covers": "all"
 },
 "B2-0019-05": {
  "src": "img/B2-0019-05.png",
  "w": 728,
  "h": 346,
  "covers": "all"
 },
 "B2-0021-01": {
  "src": "img/B2-0021-01.png",
  "w": 760,
  "h": 285,
  "covers": "all"
 },
 "B2-0027-03": {
  "src": "img/B2-0027-03.png",
  "w": 747,
  "h": 389,
  "covers": "all"
 },
 "B2-0031-04": {
  "src": "img/B2-0031-04.png",
  "w": 732,
  "h": 389,
  "covers": "all"
 },
 "B2-0034-02": {
  "src": "img/B2-0034-02.png",
  "w": 760,
  "h": 225,
  "covers": "all"
 },
 "B2-0037-01": {
  "src": "img/B2-0037-01.png",
  "w": 728,
  "h": 344,
  "covers": "all"
 },
 "B2-0047-02": {
  "src": "img/B2-0047-02.png",
  "w": 604,
  "h": 556,
  "covers": "fig"
 },
 "B2-0048-01": {
  "src": "img/B2-0048-01.png",
  "w": 760,
  "h": 263,
  "covers": "fig"
 },
 "B2-0054-02": {
  "src": "img/B2-0054-02.png",
  "w": 727,
  "h": 454,
  "covers": "all"
 },
 "B2-0076-01": {
  "src": "img/B2-0076-01.png",
  "w": 728,
  "h": 535,
  "covers": "fig"
 },
 "B2-0077-05": {
  "src": "img/B2-0077-05.png",
  "w": 404,
  "h": 370,
  "covers": "fig"
 },
 "B2-0090-04": {
  "src": "img/B2-0090-04.png",
  "w": 733,
  "h": 582,
  "covers": "all"
 },
 "B2-0095-02": {
  "src": "img/B2-0095-02.png",
  "w": 695,
  "h": 532,
  "covers": "fig"
 },
 "B2-0097-01": {
  "src": "img/B2-0097-01.png",
  "w": 719,
  "h": 460,
  "covers": "fig"
 },
 "B2-0103-01": {
  "src": "img/B2-0103-01.png",
  "w": 729,
  "h": 444,
  "covers": "all"
 },
 "B2-0105-02": {
  "src": "img/B2-0105-02.png",
  "w": 696,
  "h": 446,
  "covers": "fig"
 },
 "B2-0111-01": {
  "src": "img/B2-0111-01.png",
  "w": 728,
  "h": 619,
  "covers": "all"
 },
 "B2-0113-01": {
  "src": "img/B2-0113-01.png",
  "w": 696,
  "h": 444,
  "covers": "fig"
 },
 "B2-0121-01": {
  "src": "img/B2-0121-01.png",
  "w": 695,
  "h": 443,
  "covers": "fig"
 },
 "B2-0131-01": {
  "src": "img/B2-0131-01.png",
  "w": 696,
  "h": 533,
  "covers": "fig"
 },
 "B2-0135-02": {
  "src": "img/B2-0135-02.png",
  "w": 732,
  "h": 572,
  "covers": "all"
 },
 "B2-0140-01": {
  "src": "img/B2-0140-01.png",
  "w": 632,
  "h": 335,
  "covers": "all"
 },
 "B2-0141-01": {
  "src": "img/B2-0141-01.png",
  "w": 725,
  "h": 200,
  "covers": "fig"
 },
 "B2-0150-01": {
  "src": "img/B2-0150-01.png",
  "w": 733,
  "h": 487,
  "covers": "all"
 },
 "B2-0154-04": {
  "src": "img/B2-0154-04.png",
  "w": 733,
  "h": 383,
  "covers": "fig"
 },
 "B2-0158-02": {
  "src": "img/B2-0158-02.png",
  "w": 724,
  "h": 323,
  "covers": "all"
 },
 "B2-0162-02": {
  "src": "img/B2-0162-02.png",
  "w": 696,
  "h": 441,
  "covers": "fig"
 },
 "B2-0175-01": {
  "src": "img/B2-0175-01.png",
  "w": 696,
  "h": 534,
  "covers": "fig"
 },
 "B2-0185-01": {
  "src": "img/B2-0185-01.png",
  "w": 697,
  "h": 444,
  "covers": "fig"
 },
 "B2-0191-02": {
  "src": "img/B2-0191-02.png",
  "w": 696,
  "h": 444,
  "covers": "fig"
 },
 "B2-0201-02": {
  "src": "img/B2-0201-02.png",
  "w": 760,
  "h": 274,
  "covers": "all"
 },
 "B2-0201-04": {
  "src": "img/B2-0201-04.png",
  "w": 736,
  "h": 344,
  "covers": "all"
 },
 "B2-0202-02": {
  "src": "img/B2-0202-02.png",
  "w": 735,
  "h": 343,
  "covers": "all"
 },
 "B2-0203-02": {
  "src": "img/B2-0203-02.png",
  "w": 730,
  "h": 330,
  "covers": "all"
 },
 "B2-0207-02": {
  "src": "img/B2-0207-02.png",
  "w": 760,
  "h": 264,
  "covers": "all"
 },
 "B2-0211-01": {
  "src": "img/B2-0211-01.png",
  "w": 732,
  "h": 318,
  "covers": "fig"
 },
 "B2-0212-01": {
  "src": "img/B2-0212-01.png",
  "w": 731,
  "h": 408,
  "covers": "fig"
 },
 "B2-0213-02": {
  "src": "img/B2-0213-02.png",
  "w": 734,
  "h": 154,
  "covers": "fig"
 },
 "B2-0226-01": {
  "src": "img/B2-0226-01.png",
  "w": 550,
  "h": 272,
  "covers": "fig"
 },
 "B2-0230-01": {
  "src": "img/B2-0230-01.png",
  "w": 505,
  "h": 467,
  "covers": "all"
 },
 "B2-0235-02": {
  "src": "img/B2-0235-02.png",
  "w": 721,
  "h": 687,
  "covers": "fig"
 },
 "B2-0237-01": {
  "src": "img/B2-0237-01.png",
  "w": 587,
  "h": 547,
  "covers": "fig"
 },
 "B2-0242-03": {
  "src": "img/B2-0242-03.png",
  "w": 728,
  "h": 510,
  "covers": "all"
 },
 "B2-0245-01": {
  "src": "img/B2-0245-01.png",
  "w": 724,
  "h": 576,
  "covers": "all"
 },
 "B2-0246-01": {
  "src": "img/B2-0246-01.png",
  "w": 721,
  "h": 672,
  "covers": "fig"
 },
 "B2-0250-01": {
  "src": "img/B2-0250-01.png",
  "w": 556,
  "h": 515,
  "covers": "all"
 },
 "B2-0253-02": {
  "src": "img/B2-0253-02.png",
  "w": 723,
  "h": 634,
  "covers": "fig"
 }
};
  if (typeof module !== "undefined" && module.exports) module.exports = global.SCANS;
})(typeof window !== "undefined" ? window : globalThis);
