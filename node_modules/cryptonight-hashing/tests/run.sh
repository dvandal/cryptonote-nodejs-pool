#!/bin/bash -x

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd $DIR
node test.js || exit 1
node test_kawpow.js || exit 1
node test_astrobwt.js || exit 1
node test_k12.js || exit 1
node test_sync-1.js || exit 1
node test_sync-2.js || exit 1
node test_sync-r.js || exit 1
node test_sync-half.js || exit 1
node test_sync-msr.js || exit 1
node test_sync-xao.js || exit 1
node test_sync-rto.js || exit 1
node test_sync-gpu.js || exit 1
node test_sync-rwz.js || exit 1
node test_sync-zls.js || exit 1
node test_sync-ccx.js || exit 1
node test_sync-double.js || exit 1
node test_sync.js || exit 1
node test_sync_light.js || exit 1
node test_sync_light-1.js || exit 1
node test_sync_heavy.js || exit 1
node test_sync_heavy-xhv.js || exit 1
node test_sync_heavy-tube.js || exit 1
node test_sync_pico.js || exit 1
node test_rx0.js || exit 1
node test_rx_arq.js || exit 1
node test_rx_defyx.js || exit 1
node test_rx_xla.js || exit 1
node test_rx_wow.js || exit 1
node test_rx_loki.js || exit 1
node test_rx_keva.js || exit 1
node test_rx_switch.js || exit 1
node test_ar2_chukwa.js || exit 1
node test_ar2_wrkz.js || exit 1

node test_perf.js
node test_perf_xla.js
node test_perf_kawpow.js
node test_perf_astrobwt.js
node test_perf_k12.js
node test_perf_light.js
node test_perf_heavy.js
node test_perf_gpu.js
node test_perf_rx_defyx.js
node test_perf_rx_wow.js
node test_perf_rx_loki.js
node test_perf_rx_keva.js
node test_perf_rx_switch.js
node test_perf_pico.js
node test_perf_double.js
node test_perf_ar2_chukwa.js
node test_perf_ar2_wrkz.js