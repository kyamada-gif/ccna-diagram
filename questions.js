/* 過去問。out/full/checkpoints_app.json から作った。手で直さない。
 * 出典：対策問題1・2・3。出力も選択肢も本のまま。
 * 目標1.4 の束Bのうち、本の答えが出力と食い違う4問は外してある。
 */
var QUESTIONS = [
 {
  "qid": "B1-P11-032",
  "book": "B1",
  "text": "R19 のパフォーマンスが低下する原因は何ですか。",
  "exhibit": "R19#show int fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription: SALES_SUBNET\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 1/255, rxload 1/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nFull-duplex, 100Mb/s, 100BaseTX/FX\nARP type: ARPA, ARP Timeout 04:00:00\nLast input 00:00:01, output 00:00:00, output hang never\nLast clearing of \"show interface\" counters never\nInput queue: 0/300/0/0 (size/max/drops/flushes); Total output drops: 135298429\nQueueing strategy: fifo\nOutput queue: 0/300 (size/max)\n30 second input rate 0 bits/sec, 0 packets/sec\n30 second output rate 0 bits/sec, 0 packets/sec\n73310 packets input, 7101162 bytes\nReceived 73115 broadcasts (0 IP multicasts)\n0 runts, 0 giants, 0 throttles\n0 input errors, 4 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927513096455 packets output, 14404034810952 bytes, 0 underruns\n0 output errors, 11 collisions, 0 interface resets",
  "choices": [
   "過度の衝突",
   "速度とデュプレックスの不一致",
   "ポートのオーバーサブスクリプション",
   "過度の CRC エラー"
  ],
  "answer": "ポートのオーバーサブスクリプション",
  "explanation": "アウトプットのときに帯域不足でドロップしてしまっていると考えられる。4 CRCや11 collisionsも気になるが、\"過度\"(選択肢A)とは言えない。"
 },
 {
  "qid": "B1-P11-067",
  "book": "B1",
  "text": "本社でホストされているアプリケーションのパフォーマンスが低いという件で支社から電話を受けました。ethernet1は、Router1と LAN スイッチの間に接続されています。何が原因ですか。",
  "exhibit": "Router1#show interface ethernet 1\nEthernet1 is up, line protocol is up\nHardware is Lance, address is 0010.7b36.Ibe8 (bia 0010.7b36.Ibe8)\nInternet address is 10.100.48.240/24\nMTU 1500 bytes, BW 10000 Kbit, DLY 1000 usec,\nreliability 255/255, txload 1/255, rxload 1/255 Encapsulation ARPA, loopback not set\nKeepalive set (10 sec)\nARP type: ARPA, ARP Timeout 04:00:00\nLast input 00:00:00, output 00:00:06, output hang never\nLast clearing of \"show interface\" counters never\nInput queue: 1/75/1/0 (size/max/drops/flushes); Total output drops: 0\nQueueing strategy: random early detection(RED)\nOutput queue :0/40 (size/max)\n5 minute input rate 1000 bits/sec, 2 packets/sec\n5 minute output rate 0 bits/sec, 0 packets/sec\n7558065 packets input, 783768942 bytes, 1 no buffer\nReceived 8280963 broadcasts, 0 runts, 0 giants, 1 throttles\n15 input errors, 14278 CRC, 0 frame, 0 overrun, 3 ignored\n0 input packets with dribble condition detected\n798092 packets output, 50280266 bytes, 0 underruns\n0 output errors, 15000 collisions, 0 interface resets\n0 babbles, 0 late collision, 179 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "デュプレックスの不一致があります",
   "MTU がデフォルト値に設定されていません",
   "リンクが過剰に使用されています",
   "QoS ポリシーによってトラフィックがドロップされています"
  ],
  "answer": "デュプレックスの不一致があります",
  "explanation": "14278 CRC：NIC破損、ケーブル断線の可能性あり 15000 collisions：デュプレックス不一致の可能性あり（半二重/全二重） →選択肢から考えてA"
 },
 {
  "qid": "B1-P12-077",
  "book": "B1",
  "text": "技術者がネットワーク速度の低下に関するレポートを受け取り、問題はインターフェイス FastEthernet0/13 に特定されました。この問題の根本的な原因は何ですか。",
  "exhibit": "FastEthernet0/13 is up, line protocol is up\nHardware is Fast Ethernet, address is 0001.4d27.66cd (bia 0001.4d27.66cd)\nMTU 1500 bytes, BW 100000 Kbit, DLY 100 usec,\nreliability 250/255, txload 1/255, ndoad 1/255\nEncapsulation ARPA, loopback not set\nKeepalive not set\nAuto-duplex (Full), Auto Speed (100), 100BaseTX/FX\nARP type： ARPA, ARP Timeout 04：00：00\nLast input 18：52：43, output 00：00：01, output hang never\nLast clearing of \"show interface\" counters never\nQueueing strategy： fifo\nOutput queue 0/40,0 drops; input queue 0/75, 0 drops\n5 minute input rate 12000 bits/sec, 6 packets/sec\n5 minute output rate 24000 bits/sec, 6 packets/sec\n14488019 packets input, 2441805322 bytes\nReceived 345346 broadcasts, 0 runts, 0 giants, 0 throttles\n261028 input errors, 259429 CRC, 1599 frame, 0 overrun, 0 ignored\n0 watchdog, 84207 multicast 0 input packets with dribble condition detected\n19658279 packets output, 3529106068 bytes, 0 underruns\n0 output errors, 0 collisions, 1 interface resets\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "物理エラー",
   "ローカル バッファの過負荷",
   "IP アドレスの重複",
   "遠端のポートがエラー無効"
  ],
  "answer": "物理エラー",
  "explanation": "\"259429 CRC\"に着目"
 },
 {
  "qid": "B1-P12-083",
  "book": "B1",
  "text": "どのようなインターフェース状態ですか。",
  "exhibit": "R25# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription： atlanta_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 1/255, rxload 1/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nFull-duplex, 100 Mb/s, 100BaseTX/FX\nARP type： ARPA, ARP Timeout 04：00：00\nLast input 00：00：01, output 00：00：00, output hang never\nLast clearing of \"show interface\" counters never\nInput queue： 0/300/0/0 (size/max/drops/flushes); Total output drops： 0\nQueueing strategy： fifo\nOutput queue： 0/300 (size/max)\n30 second input rate 0 bits/sec, 0 packets/sec\n30 second output rate 0 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n1876 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 0 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "不良 NIC",
   "デュプレックスの不一致",
   "衝突",
   "高スループット"
  ],
  "answer": "不良 NIC",
  "explanation": "\"1876 runts\"に着目します。イーサネットでは、64バイト未満のフレームは \"Runt\"（小さいフレーム＝不完全なフレーム）と見なされます。通常、NIC（ネットワークインターフェースカード）の不具合や、デュプレックスの不一致によって発生します。本問では「0 collisions」なので、不良NICです。"
 },
 {
  "qid": "B1-P12-084",
  "book": "B1",
  "text": "どのようなインターフェース状態ですか。",
  "exhibit": "R25# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription： singapore_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 255/255, rxload 255/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nFull-duplex, 100 Mb/s, 100BaseTX/FX\nARP type： ARPA, ARP Timeout 04：00：00\nLast input 00：00：01, output 00：00：00, output hang never\nLast clearing of \"show interface\" counters never\nInput queue： 0/300/0/0 (size/max/drops/flushes); Total output drops： 0\nQueueing strategy： fifo\nOutput queue： 0/300 (size/max)\n30 second input rate 225953751 bits/sec, 0 packets/sec\n30 second output rate 232423817 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n0 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 0 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "不良 NIC",
   "デュプレックスの不一致",
   "衝突",
   "高スループット"
  ],
  "answer": "高スループット",
  "explanation": "txload 255/255 → 送信トラフィックが100%（帯域幅を完全に使用）、rxload 255/255 → 受信トラフィックも100%（帯域幅を完全に使用）。"
 },
 {
  "qid": "B1-P12-093",
  "book": "B1",
  "text": "どのようなインターフェース状態ですか。",
  "exhibit": "R19# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription： portland_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 1/255, rxload 1/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nFull-duplex, 100 Mb/s, 100BaseTX/FX\nARP type： ARPA, ARP Timeout 04：00：00\nLast input 00：00：01, output 00：00：00, output hang never\nLast clearing of \"show interface\" counters never\nInput queue： 0/300/0/0 (size/max/drops/flushes); Total output drops： 0\nQueueing strategy： fifo\nOutput queue： 0/300 (size/max)\n30 second input rate 0 bits/sec, 0 packets/sec\n30 second output rate 0 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n0 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 139 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "キューイング",
   "デュプレックスの不一致",
   "衝突",
   "高スループット"
  ],
  "answer": "デュプレックスの不一致",
  "explanation": "\"139 collisions\"から、BとCが考えられますが、\"Full-duplex\"となっており、Full-duplex（全二重）では理論上衝突は起こらないため、Bが正答。"
 },
 {
  "qid": "B1-P12-095",
  "book": "B1",
  "text": "どのようなインターフェース状態ですか。",
  "exhibit": "R17# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription： chicago_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 255/255, rxload 255/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nFull-duplex, 100 Mb/s, 100BaseTX/FX\nARP type： ARPA, ARP Timeout 04：00：00\nLast input 00：00：01, output 00：00：00, output hang never\nLast clearing of \"show interface\" counters never\nInput queue： 0/300/0/0 (size/max/drops/flushes); Total output drops： 0\nQueueing strategy： fifo\nOutput queue： 0/300 (size/max)\n30 second input rate 201240151 bits/sec, 0 packets/sec\n30 second output rate 228594263 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n1876 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 0 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "高いスループット",
   "キューイング",
   "不良 NIC",
   "ブロードキャスト ストーム"
  ],
  "answer": "高いスループット",
  "explanation": "txload 255/255, rxload 255/255(問84参照)。\"1876 runts\"であり、Cも考えられるが、0 CRCなので微妙(問77,83参照)"
 },
 {
  "qid": "B1-P12-103",
  "book": "B1",
  "text": "どのようなインターフェース状態ですか。",
  "exhibit": "R25# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription： tokyo_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 1/255, rxload 1/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nFull-duplex, 100 Mb/s, 100BaseTX/FX\nARP type： ARPA, ARP Timeout 04：00：00\nLast input 00：00：01, output 00：00：00, output hang never\nLast clearing of \"show interface\" counters never\nInput queue： 0/300/0/0 (size/max/drops/flushes); Total output drops： 0\nQueueing strategy： fifo\nOutput queue： 185/300 (size/max)\n30 second input rate 0 bits/sec, 0 packets/sec\n30 second output rate 0 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n1876 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 0 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "不良 NIC",
   "ブロードキャスト ストーム",
   "キューイング",
   "デュプレックスの不一致"
  ],
  "answer": "キューイング",
  "explanation": "【難問】出力キューが185パケットも溜まっているため、\"C. キューイング\" が正しい。\"1876 runts\"も気になりますが、\"Full-duplex\"であることや\"0 collisions\"であることから、Aは正答とは言い切れません。"
 },
 {
  "qid": "B1-P13-056",
  "book": "B1",
  "text": "アプリケーションのパフォーマンスの問題、VoIP オーディオ品質の低下、ダウンロードの遅延が発生しています。問題の原因は何ですか。",
  "exhibit": "Router# show interface FastEthernet0/0\nFastEthernet0/0 is up, line protocol is up\n  Hardware is Gt96k FE, address is 0017.59b2.7fb2 (bia 0017.59b2.7fb2) Internet address is 10.0.0.2/30\n  MTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\n    reliability 255/255, txload 1/255, rxload 1/255\n  Encapsulation ARPA, loopback not set\n  Keepalive set (10 sec)\n  Half-duplex, 100Mb/s, 100BaseTX/FX\n  ARP type: ARPA, ARP Timeout 04:00:00\n  Last input 00:00:04, output 00:00:04, output hang sever\n  Last clearing of \"show interface\" counters never\n  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 1 Queueing strategy: fifo\n  Output queue: 0/40 (size/max)\n  5 minute input rate 516000 bits/sec, 45 packets/sec\n  5 minute output rate 516000 bits/sec, 46 packets/sec\n    13282 packets input, 20075670 bytes\n    Received 25 broadcasts, 0 runts, 0 giants, 0 throttles\n    383 input errors, 383 CRC, 0 frame, 0 overrun, 0 ignored\n    0 watchdog\n    0 input packets with dribble condition detected\n    13438 packets output, 20084258 bytes, 0 underruns\n    0 output errors, 831 collision, 5 interface resets\n    11 unknown protocol drops\n    0 babbles, 0 late collision, 0 deferred\n    0 lost carrier, 0 no carrier\n    0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "QoS キューイング",
   "インターフェース構成",
   "ブロードキャスト ストーム",
   "過剰使用"
  ],
  "answer": "インターフェース構成",
  "explanation": "Half-duplex（半二重＝一方通行）に着目。対向がFull-duplex（全二重、二車線通行）であると考えられます。HalfとFullの通信はコリジョンの発生、スピードの低下など様々な問題が発生します。"
 },
 {
  "qid": "B1-P14-037",
  "book": "B1",
  "text": "どのようなインターフェース状態ですか。",
  "exhibit": "R30# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription: madrid_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 1/255, rxload 1/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nHalf-duplex, 100 Mb/s, 100BaseTX/FX\nARP type: ARPA, ARP Timeout 04:00:00\nLast input 00:00:01, output 00:00:00, output hang never\nLast clearing of \"show interface\" counters 00:00:18\nInput queue: 0/300/0/0 (size/max/drops/flushes); Total output drops: 0\nQueueing strategy: fifo\nOutput queue: 0/300 (size/max)\n30 second input rate 0 bits/sec, 0 packets/sec\n30 second output rate 0 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n35 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 480 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "不良 NIC",
   "ブロードキャスト ストーム",
   "キューイング",
   "デュプレックスの不一致"
  ],
  "answer": "デュプレックスの不一致",
  "explanation": "「Half-duplex」「480 collisions」に注目。相手側はおそらく「Full-duplex」であり、通信モード不一致のためにcollisionが発生しています。"
 },
 {
  "qid": "B1-P14-050",
  "book": "B1",
  "text": "インターフェイス GigabitEthernet0/0/1 の問題は何ですか。",
  "exhibit": "Output from R1\nGigabitEthernet0/0/1 is up, line protocol is down\nHardware is SPA--10X1GE-V2, address is 0023.33ee.7o00 (bia 0023.33ee.7c00)\nMTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,\nreliability 255/255, txload 1/255, rxload 1/255\nEncapsulation ARPA, loopback not set\nKeepalive not supported\nHalf Duplex, 1000Mbps, link type is auto, media type is LX\noutput flow-control is off, input flow-control is off\nARP type: ARPA, ARP Timeout 04:00:00\nLast input 00:00:01, output 00:02:31, output hang never\n10 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog, 314 multicast, 0 pause input\n1 packets output, 77 bytes, 0 underruns\n0 output errors, 50 collisions, 6 interface resets\n17 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred",
  "choices": [
   "ケーブルの切断",
   "デュプレックスの不一致",
   "ポートのセキュリティ",
   "高スループット"
  ],
  "answer": "デュプレックスの不一致",
  "explanation": "問37参照。ちなみに、本問では2行目はup/downになっている。これは、L1（物理）では繋がっているが、L2（データリンク）では接続できていないという意味。「Half Duplex」で 1000Mbps 通信を行おうとしていることも考えにくい。"
 },
 {
  "qid": "B1-P14-066",
  "book": "B1",
  "text": "どのようなインターフェース状態ですか。",
  "exhibit": "R9# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription: atlanta_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 1/255, rxload 1/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nfull-duplex, 100 Mb/s, 100BaseTX/FX\nARP type: ARPA, ARP Timeout 04:00:00\nLast input 00:00:01, output 00:00:00, output hang never\nLast clearing of \"show interface\" counters 00:00:18\nInput queue: 175/300/0/0 (size/max/drops/flushes); Total output drops: 100\nQueueing strategy: fifo\nOutput queue: 50/300 (size/max)\n30 second input rate 0 bits/sec, 0 packets/sec\n30 second output rate 0 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n0 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 0 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "ブロードキャスト ストーム",
   "不良 NIC",
   "キューイング",
   "デュプレックスの不一致"
  ],
  "answer": "キューイング",
  "explanation": "インプットの順番待ちが175パケット、アウトプット側で処理できずに捨てたのは100パケット、正常にアウトプットできたのは50パケット。負荷分散やQOS(優先順位付け)などの対策が必要です。"
 },
 {
  "qid": "B1-P15-005",
  "book": "B1",
  "text": "インターネットへの接続が不安定です。インターフェイスの問題の原因は何ですか。",
  "exhibit": "Router-WAN1#show interface g0/0\nGigabitEthernet0/0 is up, line protocol is up\n  Hardware is CSR NIC, address is 5000.0001.0000 (bia 5000.0001.0000)\n  Internet address is 192.168.0.0/31\n  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,\n    reliability 255/255, txload 1/255, rxload 1/255\n  Encapsulation ARPA, loopback not set\n  Keepalive set (10 sec)\n  Full Duplex, 1000Mbps, link type is auto, media type is NIC\n  output flow-control is unsupported, input flow-control is unsupported\n  ARP type: ARPA, ARP Timeout 04:00:00\n  Last input never, output 00:00:03, output hang never\n  Last clearing of \"show interface\" counters never\n  Input queue: 0/375/0/0 (size/max/drops/flushes); Total output drops: 0\n  Queueing strategy: fifo\n  Output queue: 0/40 (size /max)\n  5 minute input rate 1000 bits/sec, 0 packets/sec\n  5 minute output rate 2000 bits/sec, 1 packets/sec\n    0 packets input, 0 bytes, 0 no buffer\n    Received 110 broadcasts (0 IP multicasts)\n    0 runts, 0 giants, 0 throttles\n    100 input errors, 100 CRC, 100 frame, 0 overrun, 0 ignored\n    0 watchdog, 0 multicast, 0 pause input\n    260 packets output, 89070 bytes, 0 underruns\n    Output 0 broadcasts (0 IP multicasts)\n    0 output errors, 100 collisions, 0 interface resets\n    0 unknown protocol drops\n    0 babbles, 0 late collision, 0 deferred\n    1 lost carrier, 0 no carrier, 0 pause output",
  "choices": [
   "ARPタイムアウトが有効になっているためブロードキャストパケットが拒否される",
   "ブロードキャストストームにより受信バッファがいっぱいになる",
   "半二重ネゴシエーションによりフレームが破棄される",
   "64バイト未満の小さなフレームはサイズが小さいため拒否される"
  ],
  "answer": "半二重ネゴシエーションによりフレームが破棄される",
  "explanation": "太字のエラー内容から、通信モードの不一致（相手が Half Duplex）、物理的なエラー（ケーブル破損、NIC故障など）が考えられます。 outputにエラーカウントが無いのは、自身の送信動作は制御できるため。"
 },
 {
  "qid": "B2-0039-01",
  "book": "B2",
  "text": "展示品をご参照ください。インターフェイス TenGigabitEthemet0/0/0 を流れるトラフィックでは、転送速度が遅くなります。この問題の原因は何ですか?",
  "exhibit": "TenGigabitEthernet0/0/0 is up, line protocol is up\n  Hardware is BUILT-IN-2T+6X1GE, address is 74a0.2f7a.0123 (bia 74a0.2f7a.0123)\n  Description: Uplink\n  Internet address is 10.1.1.1/24\n  MTU 1500 bytes, BW 10000000 Kbit/sec, DLY 10 usec,\n     reliability 255/255, txload 1/255, rxload 1/255\n  Encapsulation ARPA, loopback not set\n  Keepalive not supported\n  Full Duplex, 10000Mbps, link type is force-up, media type is unknown media type\n  output flow-control is on, input flow-control is on\n  ARP type: ARPA, ARP Timeout 04:00:00\n  Last input 00:00:00, output 00:05:40, output hang never\n  Last clearing of \"show interface\" counters never\n  Input queue: 0/375/0/0 (size/max/drops/flushes); Total output drops: 0\n  Queueing strategy: fifo\n  Output queue: 0/40 (size/max)\n  5 minute input rate 6160000 bits/sec, 1113 packets/sec\n  5 minute output rate 11213000 bits/sec, 1553 packets/sec\n     12652416065 packets input, 12607032232894 bytes, 0 no buffer\n     Received 14117163 broadcasts (0 IP multicasts)\n     0 runts, 0 giants, 0 throttles\n     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n     0 watchdog, 26271385 multicast, 0 pause input\n     7907779058 packets output, 5073750426832 bytes, 0 underruns\n     0 output errors, 8662416065 collisions, 1 interface resets\n     0 unknown protocol drops\n     0 babbles, 0 late collision, 0 deferred\n     0 lost carrier, 0 no carrier, 0 pause output\n     0 output buffer failures, 0 output buffers swapped out\n     1 carrier transitions",
  "choices": [
   "速度の競合",
   "キューイングドロップ",
   "デュプレックスの非互換性",
   "大渋滞"
  ],
  "answer": "デュプレックスの非互換性",
  "explanation": "出力には、インターフェイス上で 8662416065 の衝突があることが示されており、これが転送速度の低下の原因である可能性があります。"
 },
 {
  "qid": "B2-0086-02",
  "book": "B2",
  "text": "この出力ではどのインターフェイス状態が発生していますか?",
  "exhibit": "R43# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription: munich_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 255/255, rxload 255/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nFull-duplex, 100 Mb/s, 100BaseTX/FX\nARP type: ARPA, ARP Timeout 04:00:00\nLast input 00:00:01, output 00:00:00, output hang never\nLast clearing of \"show interface\" counters never\nInput queue: 0/300/0/0 (size/max/drops/flushes); Total output drops: 0\nQueueing strategy: fifo\nOutput queue: 0/300 (size/max)\n30 second input rate 200234873 bits/sec, 0 packets/sec\n30 second output rate 233830309 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n0 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 0 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "ブロードキャストストーム",
   "デュプレックスの不一致",
   "高スループット",
   "順番待ち"
  ],
  "answer": "高スループット",
  "explanation": ""
 },
 {
  "qid": "B2-0093-02",
  "book": "B2",
  "text": "この出力ではどのインターフェイス状態が発生していますか?",
  "exhibit": "R45# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription: atlanta_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 255/255, rxload 255/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nFull-duplex, 100 Mb/s, 100BaseTX/FX\nARP type: ARPA, ARP Timeout 04:00:00\nLast input 00:00:01, output 00:00:00, output hang never\nLast clearing of \"show interface\" counters never\nInput queue: 0/300/0/0 (size/max/drops/flushes); Total output drops: 0\nQueueing strategy: fifo\nOutput queue: 0/300 (size/max)\n30 second input rate 234712855 bits/sec, 0 packets/sec\n30 second output rate 228528957 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n0 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 0 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "ブロードキャストストーム",
   "衝突",
   "高スループット",
   "デュプレックスの不一致"
  ],
  "answer": "高スループット",
  "explanation": ""
 },
 {
  "qid": "B2-0101-01",
  "book": "B2",
  "text": "この出力ではどのインターフェイス状態が発生していますか?",
  "exhibit": "R7# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription: admin_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 1/255, rxload 1/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nHalf-duplex, 100 Mb/s, 100BaseTX/FX\nARP type: ARPA, ARP Timeout 04:00:00\nLast input 00:00:01, output 00:00:00, output hang never\nLast clearing of \"show interface\" counters never\nInput queue: 0/300/0/0 (size/max/drops/flushes); Total output drops: 0\nQueueing strategy: fifo\nOutput queue: 0/300 (size/max)\n30 second input rate 0 bits/sec, 0 packets/sec\n30 second output rate 0 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n0 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 119 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "衝突",
   "ブロードキャストストーム",
   "デュプレックスの不一致",
   "順番待ち"
  ],
  "answer": "デュプレックスの不一致",
  "explanation": ""
 },
 {
  "qid": "B2-0117-04",
  "book": "B2",
  "text": "この出力ではどのインターフェイス状態が発生していますか?",
  "exhibit": "R19# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription: brussels_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 1/255, rxload 1/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nFull-duplex, 100 Mb/s, 100BaseTX/FX\nARP type: ARPA, ARP Timeout 04:00:00\nLast input 00:00:01, output 00:00:00, output hang never\nLast clearing of \"show interface\" counters never\nInput queue: 0/300/0/0 (size/max/drops/flushes); Total output drops: 0\nQueueing strategy: fifo\nOutput queue: 0/300 (size/max)\n30 second input rate 0 bits/sec, 0 packets/sec\n30 second output rate 0 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 3553 broadcasts (0 IP multicasts)\n0 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 0 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "衝突",
   "不良 NIC",
   "デュプレックスの不一致",
   "ブロードキャストストーム"
  ],
  "answer": "ブロードキャストストーム",
  "explanation": ""
 },
 {
  "qid": "B2-0125-02",
  "book": "B2",
  "text": "展示品をご参照ください。ブランチ オフィスのユーザーは、アプリケーションのパフォーマンスの問題、VoIP の音声品質の低下、ダウンロードの遅さに直面しています。問題の原因は何ですか?",
  "exhibit": "Router# show interface FastEthernet0/0\nFastEthernet0/0 is up, line protocol is up\n  Hardware is Gt96k FE, address is 0017.59b2.7fb2 (bia 0017.59b2.7fb2)\n  Internet address is 10.0.0.2/30\n  MTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\n     reliability 255/255, txload 1/255, rxload 1/255\n  Encapsulation ARPA, loopback not set\n  Keepalive set (10 sec)\n  Half-duplex, 100Mb/s, 100BaseTX/FX\n  ARP type: ARPA, ARP Timeout 04:00:00\n  Last input 00:00:04, output 00:00:04, output hang never\n  Last clearing of \"show interface\" counters never\n  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 1\n  Queueing strategy: fifo\n  Output queue: 0/40 (size/max)\n  5 minute input rate 516000 bits/sec, 45 packets/sec\n  5 minute output rate 516000 bits/sec, 46 packets/sec\n     13282 packets input, 20075670 bytes\n     Received 29 broadcasts, 0 runts, 0 giants, 0 throttles\n     383 input errors, 383 CRC, 0 frame, 0 overrun, 0 ignored\n     0 watchdog\n     0 input packets with dribble condition detected\n     13438 packets output, 20064252 bytes, 0 underruns\n     0 output errors, 831 collisions, 5 interface resets\n     11 unknown protocol drops\n     0 babbles, 0 late collision, 0 deferred\n     0 lost carrier, 0 no carrier\n     0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "QoS キューイング",
   "インターフェース構成",
   "ブロードキャストストーム",
   "過剰利用"
  ],
  "answer": "インターフェース構成",
  "explanation": ""
 },
 {
  "qid": "B2-0132-02",
  "book": "B2",
  "text": "この出力ではどのインターフェイス状態が発生していますか?",
  "exhibit": "R36# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription: sanfrancisco_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 255/255, rxload 255/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nFull-duplex, 100 Mb/s, 100BaseTX/FX\nARP type: ARPA, ARP Timeout 04:00:00\nLast input 00:00:01, output 00:00:00, output hang never\nLast clearing of \"show interface\" counters never\nInput queue: 0/300/0/0 (size/max/drops/flushes); Total output drops: 0\nQueueing strategy: fifo\nOutput queue: 0/300 (size/max)\n30 second input rate 217244011 bits/sec, 0 packets/sec\n30 second output rate 236536306 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n0 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 0 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "デュプレックスの不一致",
   "高スループット",
   "不良 NIC",
   "ブロードキャストストーム"
  ],
  "answer": "高スループット",
  "explanation": ""
 },
 {
  "qid": "B2-0159-03",
  "book": "B2",
  "text": "展示品をご参照ください。スイッチ cat9k-acc-1 は、ユーザーをキャンパス LAN に接続します。ネットワーク経由で印刷サービスにアクセスできません。接続の問題を引き起こしているインターフェイスの問題はどれですか?",
  "exhibit": "cat9k-acc-1# show interfaces gigabitethernet 1/0/1\n   gigabitethernet 1/0/1 is up, line protocol is up\n   Hardware is gigabitethernet, address is aa00.0400.0134 (via 0000.0c00.4369)\n   MTU 1500 bytes, BW 1000 Kbit, DLY 1000 usec, rely 255/255, load 1/255\n   Encapsulation ARPA, loopback not set, keepalive set (10 sec)\n   ARP type: ARPA, PROBE, ARP Timeout 4:00:00\n   Last input 0:00:00, output 0:00:00, output hang never\n   Output queue 1/1, 1 drops; input queue 0/0, 0 drops\n   Five minute input rate 61000 bits/sec, 200 packets/sec\n   Five minute output rate 1000 bits/sec, 200 packets/sec\n   2295197 packets input, 305539992 bytes, 0 no buffer\n   Received 1925500 broadcasts, 0 runts, 0 giants\n   0 input errors, 1790 CRC, 1790 frame, 0 overrun, 0 ignored, 0 abort\n   0 input packets with dribble condition detected\n   3594664 packets output, 436549843 bytes, 1 underruns\n   0 output errors, 1 collisions, 1 interface resets, 0 restarts",
  "choices": [
   "不正なチェックサムにより、イーサネット フレームがドロップされます。",
   "過度の衝突によりフレームがドロップされる。",
   "大量のブロードキャスト パケットによりポートがリセットされる。",
   "インターフェイス出力キューはイーサネット フレームを処理できません。"
  ],
  "answer": "大量のブロードキャスト パケットによりポートがリセットされる。",
  "explanation": ""
 },
 {
  "qid": "B2-0166-01",
  "book": "B2",
  "text": "この出力ではどのインターフェイス状態が発生していますか?",
  "exhibit": "R9# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription: atlanta_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 1/255, rxload 1/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nFull-duplex, 100 Mb/s, 100BaseTX/FX\nARP type: ARPA, ARP Timeout 04:00:00\nLast input 00:00:01, output 00:00:00, output hang never\nLast clearing of \"show interface\" counters 00:00:18\nInput queue: 175/300/0/0 (size/max/drops/flushes); Total output drops: 100\nQueueing strategy: fifo\nOutput queue: 50/300 (size/max)\n30 second input rate 0 bits/sec, 0 packets/sec\n30 second output rate 0 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n0 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 0 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "ブロードキャストストーム",
   "順番待ち",
   "不良 NIC",
   "デュプレックスの不一致"
  ],
  "answer": "順番待ち",
  "explanation": ""
 },
 {
  "qid": "B2-0187-01",
  "book": "B2",
  "text": "この出力ではどのインターフェイス状態が発生していますか?",
  "exhibit": "R18# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription: dallas_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 255/255, rxload 255/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nFull-duplex, 100 Mb/s, 100BaseTX/FX\nARP type: ARPA, ARP Timeout 04:00:00\nLast input 00:00:01, output 00:00:00, output hang never\nLast clearing of \"show interface\" counters 00:00:18\nInput queue: 0/300/0/0 (size/max/drops/flushes); Total output drops: 0\nQueueing strategy: fifo\nOutput queue: 0/300 (size/max)\n30 second input rate 230000000 bits/sec, 40 packets/sec\n30 second output rate 200000000 bits/sec, 40 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n0 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 0 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "NIC が不良です",
   "ブロードキャストストーム",
   "デュプレックスの不一致",
   "高スループット"
  ],
  "answer": "高スループット",
  "explanation": ""
 },
 {
  "qid": "B2-0213-01",
  "book": "B2",
  "text": "この出力ではどのインターフェイス状態が発生していますか?",
  "exhibit": "R30# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\nHardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\nDescription: madrid_subnet\nInternet address is 10.32.102.2/30\nMTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,\nreliability 255/255, txload 1/255, rxload 1/255\nEncapsulation ARPA, loopback not set\nKeepalive set (60 sec)\nHalf-duplex, 100 Mb/s, 100BaseTX/FX\nARP type: ARPA, ARP Timeout 04:00:00\nLast input 00:00:01, output 00:00:00, output hang never\nLast clearing of \"show interface\" counters 00:00:18\nInput queue: 0/300/0/0 (size/max/drops/flushes); Total output drops: 0\nQueueing strategy: fifo\nOutput queue: 0/300 (size/max)\n30 second input rate 0 bits/sec, 0 packets/sec\n30 second output rate 0 bits/sec, 0 packets/sec\n7331 packets input, 7101162 bytes\nReceived 267 broadcasts (0 IP multicasts)\n35 runts, 0 giants, 0 throttles\n0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n0 watchdog\n0 input packets with dribble condition detected\n3927 packets output, 1440403 bytes, 0 underruns\n0 output errors, 480 collisions, 0 interface resets\n0 unknown protocol drops\n0 babbles, 0 late collision, 0 deferred\n0 lost carrier, 0 no carrier\n0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "デュプレックスの不一致",
   "高スループット",
   "不良 NIC",
   "順番待ち"
  ],
  "answer": "デュプレックスの不一致",
  "explanation": ""
 },
 {
  "qid": "B2-0239-01",
  "book": "B2",
  "text": "展示品をご参照ください。 Router-WAN1 は、Gi0/0 経由で ISP への新しい接続を確立します。Web アプリケーションを実行しているユーザーは、インターネットへの接続が不安定であることを示しています。インターフェースの問題の原因は何ですか?",
  "exhibit": "Router-WAN1#show interface g0/0\nGigabitEthernet0/0 is up, line protocol is up\n  Hardware is CSR NIC, address is 5000.0001.0000 (bia 5000.0001.0000)\n  Internet address is 192.168.0.0/31\n  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,\n     reliability 255/255, txload 1/255, rxload 1/255\n  Encapsulation ARPA, loopback not set\n  Keepalive set (10 sec)\n  Full Duplex, 1000Mbps, link type is auto, media type is NIC\n  output flow-control is unsupported, input flow-control is unsupported\n  ARP type: ARPA, ARP Timeout 04:00:00\n  Last input never, output 00:00:03, output hang never\n  Last clearing of \"show interface\" counters never\n  Input queue: 0/375/0/0 (size/max/drops/flushes); Total output drops: 0\n  Queueing strategy: fifo\n  Output queue: 0/40 (size /max)\n  5 minute input rate 1000 bits/sec, 0 packets/sec\n  5 minute output rate 2000 bits/sec, 1 packets/sec\n     0 packets input, 0 bytes, 0 no buffer\n     Received 110 broadcasts (0 IP multicasts)\n     0 runts, 0 giants, 0 throttles\n     100 input errors, 100 CRC, 100 frame, 0 overrun, 0 ignored\n     0 watchdog, 0 multicast, 0 pause input\n     260 packets output, 89070 bytes, 0 underruns\n     Output 0 broadcasts (0 IP multicasts)\n     0 output errors, 100 collisions, 0 interface resets\n     0 unknown protocol drops\n     0 babbles, 0 late collision, 0 deferred\n     1 lost carrier, 0 no carrier, 0 pause output",
  "choices": [
   "ブロードキャスト ストームにより受信バッファがいっぱいです。",
   "半二重ネゴシエーションによりフレームが破棄されます。",
   "ARP タイムアウトが有効になっているため、ブロードキャスト パケットが拒否されます。",
   "64 バイト未満の小さなフレームはサイズの理由で拒否されます。"
  ],
  "answer": "半二重ネゴシエーションによりフレームが破棄されます。",
  "explanation": ""
 },
 {
  "qid": "B3-M1-030",
  "book": "B3",
  "text": "上記出力を確認してください。インターフェイス TenGigabitEthernet0/0/0 を流れるトラフィックでは、転送速度が遅くなります。この問題の原因は何ですか。",
  "exhibit": "TenGigabitEthernet0/0/0 is up, line protocol is up\n  Hardware is BUILT-IN-2T+6X1GE, address is 74a0.2f7a.0123 (bia 74a0.2f7a.0123)\n  Description: Uplink\n  Internet address is 10.1.1.1/24\n  MTU 1500 bytes, BW 10000000 kbit/sec, DLY 10 usec,\n     reliability 255/255, txload 1/255, rxload 1/255\n  Encapsulation ARPA, loopback not set\n  Keepalive not supported\n  Half-duplex, 10000Mbps, link type is force-up, media type is unknown media type\n  output flow-control is on, input flow-control is on\n  ARP type: ARPA, ARP Timeout 04:00:00\n  Last input 00:00:00, output 00:05:40, output hang never\n  Last clearing of \"show interface\" counters never\n  Input queue: 0/375/0/0 (size/max/drops/flushes); Total output drops: 0\n  Queueing strategy: fifo\n  Output queue: 0/40 (size/max)\n  5 minute input rate 6160000 bits/sec, 1113 packets/sec\n  5 minute output rate 11213000 bits/sec, 1553 packets/sec\n     12662416065 packets input, 12607032232894 bytes, 0 no buffer\n     Received 14117163 broadcasts (0 IP multicasts)\n     0 runts, 0 giants, 0 throttles\n     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n     0 watchdog, 26271385 multicast, 0 pause input\n     7907779058 packets output, 5073750426832 bytes, 0 underruns\n     0 output errors, 8662416065 collisions, 1 interface resets\n     0 unknown protocol drops\n     0 babbles, 0 late collision, 0 deferred\n     0 lost carrier, 0 no carrier, 0 pause output\n     0 output buffer failures, 0 output buffers swapped out\n     1 carrier transitions",
  "choices": [
   "速度(speed)の競合",
   "キューイングのドロップ",
   "全二重/半二重が不一致(duplex mismatch)",
   "トラフィックの混雑"
  ],
  "answer": "全二重/半二重が不一致(duplex mismatch)",
  "explanation": "8662416065 collisions 上記出力より、インターフェイス上で8662416065回の衝突があることがわかり、これが転送速度の低下の原因であることがわかります。 txload 1/255 上記出力より、送信トラフィック負荷が総帯域幅容量の1/255であることと、 rxload 1/255 上記出力より、受信トラフィック負荷が総帯域幅容量の1/255であることがわかり、duplex mismatchであることがわかります。 duplexが不一致の場合、通信速度が低下することがあります。 https://www.n-study.com/layer2switch/cisco-duplex-mismatch/"
 },
 {
  "qid": "B3-M1-037",
  "book": "B3",
  "text": "上記を参照してください。技術者はネットワークが遅いというレポートを受け取り、問題はインターフェイス FastEthernet0/13 に特定されています。問題の根本原因は何ですか。",
  "exhibit": "FastEthernet0/13 is up, line protocol is up\n  Hardware is Fast Ethernet, address is 0001.4d27.66cd (bia 0001.4d27.66cd)\n  MTU 1500 bytes, BW 100000 Kbit, DLY 100 usec,\n  reliability 250/255, txload 1/255, rxload 1/255\n  Encapsulation ARPA, loopback not set\n  Keepalive not set\n  Auto-duplex (Full) Auto Speed (100), 100BaseTX/FX\n  ARP type: ARPA, ARP Timeout 04:00:00\n  Last input 18:52:43, output 00:00:01, output hang never\n  Last clearing of \"show interface\" counters never\n  Queueing strategy: fifo\n  Output queue 0/40, 0 drops; input queue 0/75, 0 drops\n  5 minute input rate 12000 bits/sec, 6 packets/sec\n  5 minute output rate 24000 bits/sec, 6 packets/sec\n  14488019 packets input, 2434163609 bytes\n  Received 345348 broadcasts, 0 runts, 0 giants, 0 throttles\n  261028 input errors, 259429 CRC, 1599 frame, 0 overrun, 0 ignored\n  0 watchdog, 84207 multicast\n  0 input packets with dribble condition detected\n  19658279 packets output, 3529106068 bytes, 0 underruns\n  0 output errors, 0 collisions, 1 interface resets\n  0 babbles, 0 late collision, 0 deferred\n  0 lost carrier, 0 no carrier\n  0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "ローカルバッファの過負荷",
   "遠端の err-disabled ポート",
   "物理的エラー",
   "重複した IP アドレス指定"
  ],
  "answer": "物理的エラー",
  "explanation": "以下の情報から判断すると、インターフェイスFastEthernet0/13は物理的なエラーが発生していることがわかります。 input errorsの数が261028あり、そのうち259429はCRCエラーです。 output errorsの数は0であり、collisionエラーは0です。 CRCエラーは、フレームの受信中にデータの破損が発生していることを示します。このエラーの多くは物理的な問題、つまりケーブルの問題や接続の不良によるものです。したがって、インターフェイスFastEthernet0/13には物理的なエラーがあり、これがネットワークの遅さの原因となっています。"
 },
 {
  "qid": "B3-M1-095",
  "book": "B3",
  "text": "上記を参照してください。Router-WAN1 は、Gi0/0 経由で ISP への新しい接続を確立しています。Web アプリケーションを実行しているユーザーは、インターネットへの接続が不安定であることを示しています。インターフェースの問題の原因は何ですか。",
  "exhibit": "Router-WAN1#show interface g0/0\nGigabitEthernet0/0 is up, line protocol is up\n  Hardware is CSR NIC, address is 5000.0001.0000 (bia 5000.0001.0000)\n  Internet address is 192.168.0.0/31\n  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec, reliability 255/255, txload 1/255, rxload 1/255\n  Encapsulation ARPA, loopback not set\n  Keepalive set (10 sec)\n  Full Duplex, 1000Mbps, link type is auto, media type is NIC\n  output flow-control is unsupported, input flow-control is unsupported\n  ARP type: ARPA, ARP Timeout 04:00:00\n  Last input never, output 00:00:03, output hang never\n  Last clearing of \"show interface\" counters never\n  Input queue: 0/375/0/0 (size/max/drops/flushes); Total output drops: 0\n  Queueing strategy: fifo\n  Output queue: 0/40 (size /max)\n  5 minute input rate 1000 bits/sec, 0 packets/sec\n  5 minute output rate 2000 bits/sec, 1 packets/sec\n     0 packets input, 0 bytes, 0 no buffer\n     Received 110 broadcasts (0 IP multicasts)\n     0 runts, 0 giants, 0 throttles\n     100 input errors, 100 CRC, 100 frame, 0 overrun, 0 ignored\n     0 watchdog, 0 multicast, 0 pause input\n     260 packets output, 89070 bytes, 0 underruns\n     Output 0 broadcasts (0 IP multicasts)\n     0 output errors, 100 collisions, 0 interface resets\n     0 unknown protocol drops\n     0 babbles, 0 late collision, 0 deferred\n     1 lost carrier, 0 no carrier, 0 pause output",
  "choices": [
   "半二重ネゴシエーションによりフレームが破棄されている",
   "ブロードキャスト ストームにより受信バッファが一杯である",
   "64 バイト未満の小さなフレームはサイズの関係で拒否されている",
   "ARP タイムアウトが有効になっているため、ブロードキャスト パケットは拒否されている"
  ],
  "answer": "半二重ネゴシエーションによりフレームが破棄されている",
  "explanation": "Full Duplex, 1000Mbps と表示されていますが、100 collisions が発生しています。フルデュプレックスでは通常、衝突は発生しないはずです。衝突が発生していることは、デュプレックスの不一致やネゴシエーションの問題を示しています。 衝突（collisions）が発生している場合、半二重環境では一般的ですが、フルデュプレックス環境で衝突が発生するのは異常です。これは通常、デュプレックスの不一致（例えば、片方がフルデュプレックス、もう片方が半二重）によって引き起こされます。この不一致により、パケットが破棄され、接続の不安定さが生じます。 「ブロードキャスト ストームにより受信バッファが一杯である」出力を見ると、Input queue は 0/375 で、受信バッファがいっぱいではありません。また、Received 110 broadcasts は、ブロードキャストストームと呼べるほど多くはありません。 「ARP タイムアウトが有効になっているため、ブロードキャスト パケットは拒否されている」ARP タイムアウトが設定されているのは正常で、特に問題とは言えません。また、ブロードキャストパケットが拒否されている兆候も見られません。 「64 バイト未満の小さなフレームはサイズの関係で拒否されている」出力に小さなフレーム（runts）の発生は報告されておらず、0 runts です。したがって、この選択肢は当てはまりません。"
 },
 {
  "qid": "B3-M2-073",
  "book": "B3",
  "text": "上記を参照してください。ルーター R19 のパフォーマンス低下の原因は何ですか。",
  "exhibit": "R19#show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\n  Hardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000)\n  Description: SALES_SUBNET\n  Internet address is 10.32.102.2/30\n  MTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec, reliability 255/255, txload 1/255, rxload 1/255\n  Encapsulation ARPA, loopback not set\n  Keepalive set (60 sec)\n  Full-duplex, 100Mb/s, 100BaseTX/FX\n  ARP type: ARPA, ARP Timeout 04:00:00\n  Last input 00:00:01, output 00:00:00, output hang never\n  Last clearing of \"show interface\" counters never\n  Input queue: 0/300/0/0 (size/max/drops/flushes); Total output drops: 135298429\n  Queueing strategy: fifo\n  Output queue: 0/300 (size/max)\n  30 second input rate 0 bits/sec, 0 packets/sec\n  30 second output rate 0 bits/sec, 0 packets/sec\n  73310 packets input, 7101162 bytes\n  Received 73115 broadcasts (0 IP multicasts)\n  0 runts, 0 giants, 0 throttles\n  0 input errors, 4 CRC, 0 frame, 0 overrun, 0 ignored\n  0 watchdog\n  0 input packets with dribble condition detected\n  3927513096455 packets output, 14404034810952 bytes, 0 underruns\n  0 output errors, 11 collisions, 0 interface resets\n  0 unknown protocol drops\n  0 babbles, 0 late collision, 0 deferred\n  0 lost carrier, 0 no carrier\n  0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "過剰なCRCエラー",
   "過度の衝突",
   "速度とデュプレックスの不一致",
   "ポートのオーバーサブスクリプション"
  ],
  "answer": "ポートのオーバーサブスクリプション",
  "explanation": "ポートのオーバーサブスクリプション は、インターフェースが処理できる以上のトラフィックが流れている状態を指します。出力では、次の点がこれを示唆しています: Total output drops: 135298429:非常に多くの出力ドロップ(パケットがキューからドロップされた回数)が発生しています。これが、インターフェースが過負荷状態にあることを示しています。 Output queue: 0/300 (size/max):出力キューが満杯になり、パケットがドロップされる原因です。ポートが処理しきれないトラフィックを扱おうとしていることがわかります。 これらの情報は、ポートに過剰なトラフィックが流れており、パフォーマンスの低下やパケットの損失を引き起こしていることを示しています。したがって、インターフェースがトラフィックを処理する能力を超えている、つまり オーバーサブスクリプション が発生していると判断できます。 一部の CRC エラーや衝突はありますが、これらの数は大量の出力ドロップに比べてはるかに小さく、ポートがトラフィックで圧倒されていること、つまり衝突や CRC エラーなどの問題ではなく、オーバーサブスクリプションの典型的な兆候であることを示しています。"
 },
 {
  "qid": "B3-M3-014",
  "book": "B3",
  "text": "上記を参照してください。ネットワーク インターフェイスのパフォーマンスが低下する理由は何ですか。",
  "exhibit": "Router# show interface g0/0/0\nGigabitEthernet0/0/0 is up, line protocol is up\n  Hardware is ISR4331-3x1GE, address is 5486.bc25.1170 (bia 5486.bc25.1170)\n  Description: << WAN Link >>\n  Internet address is 192.0.2.2/30\n  MTU 1500 bytes, BW 1000000 kbit/sec, DLY 10 usec,\n     reliability 255/255, txload 1/255, rxload 1/255\n  Encapsulation ARPA, loopback not set\n  Keepalive not supported\n  Full Duplex, 1000Mbps, link type is auto, media type is RJ45\n  output flow-control is off, input flow-control is off\n  ARP type: ARPA, ARP Timeout 04:00:00\n  Last input 00:00:00, output 00:00:11, output hang never\n  Last clearing of \"show interface\" counters never\n  Input queue: 0/375/0/0 (size/max/drops/flushes); Total output drops: 0\n  Queueing strategy: fifo\n  Output queue: 0/40 (size/max)\n  5 minute input rate 7000 bits/sec, 4 packets/sec\n  5 minute output rate 4000 bits/sec, 4 packets/sec\n     22579370 packets input, 8825545968 bytes, 0 no buffer\n     Received 67 broadcasts (0 IP multicasts)\n     0 runts, 0 giants, 0 throttles\n     3612699 input errors, 3612699 CRC, 0 frame, 0 overrun, 0 ignored\n     0 watchdog, 10747057 multicast, 0 pause input\n     12072167 packets output, 1697953637 bytes, 0 underruns\n     0 output errors, 0 collisions, 1 interface resets\n     6 unknown protocol drops\n     0 babbles, 0 late collision, 0 deferred\n     5 lost carrier, 0 no carrier, 0 pause output\n     0 output buffer failures, 0 output buffers swapped",
  "choices": [
   "インターフェイスが過剰なブロードキャスト トラフィックを受信している。",
   "インターフェイスの帯域幅設定が間違っている。",
   "2 つのデバイス間のケーブル接続に欠陥がある。",
   "インターフェイスは、接続されたデバイスとは異なる速度で動作している。"
  ],
  "answer": "2 つのデバイス間のケーブル接続に欠陥がある。",
  "explanation": "インターフェースのパフォーマンス低下の主な原因は、ケーブル接続に問題がある可能性があります。受信エラーとCRCエラーの発生は、データが正常に受信されていないことを示しています。ケーブルの問題はデータの送信や受信に影響を与える可能性があります。"
 },
 {
  "qid": "B3-M3-089",
  "book": "B3",
  "text": "この出力ではどのインターフェイス状態が発生していますか。",
  "exhibit": "R45# show interface fa0/0\nFastEthernet0/0 is up, line protocol is up\n  Hardware is DEC21140, address is ca02.7788.0000 (bia ca02.7788.0000) Description: atlanta_subnet\n  Internet address is 10.32.102.2/30\n  MTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec, reliability 255/255, txload 255/255, rxload 255/255 Encapsulation ARPA, loopback not set\n  Keepalive set (60 sec)\n  Full-duplex, 100 Mb/s, 100BaseTX/FX\n  ARP type: ARPA, ARP Timeout 04:00:00\n  Last input 00:00:01, output 00:00:00, output hang never\n  Last clearing of \"show interface\" counters never\n  Input queue: 0/300/0/0 (size/max/drops/flushes); Total output drops: 0 Queueing strategy: fifo\n  Output queue: 0/300 (size/max)\n  30 second input rate 234712855 bits/sec, 0 packets/sec 30 second output rate 228528957 bits/sec, 0 packets/sec 7331 packets input, 7101162 bytes\n  Received 267 broadcasts (0 IP multicasts)\n  0 runts, 0 giants, 0 throttles\n  0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored 0 watchdog\n  0 input packets with dribble condition detected 3927 packets output, 1440403 bytes, 0 underruns 0 output errors, 0 collisions, 0 interface resets 0 unknown protocol drops\n  0 babbles, 0 late collision, 0 deferred\n  0 lost carrier, 0 no carrier\n  0 output buffer failures, 0 output buffers swapped out",
  "choices": [
   "ブロードキャストストーム",
   "コリジョン",
   "高スループット",
   "duplex不一致"
  ],
  "answer": "高スループット",
  "explanation": "rxload と txload が最大であるだけでなく、入力エラーがなく、入出力レートが高いため、高スループットです。"
 }
];
if (typeof module !== "undefined" && module.exports) module.exports = { QUESTIONS: QUESTIONS };
