#!/bin/sh
# Runs every browser test against dist/index.html, one after another. A failing test is retried ONCE (headless Chromium +
# software GL on a busy machine occasionally stalls a profile flush); a retry that passes is reported as "flaky".
# usage: tools/e2e_all.sh [logdir]
LOG=${1:-/tmp/e2e_logs}; mkdir -p "$LOG"; cd "$(dirname "$0")/.."
: > "$LOG/summary.txt"
for t in smoke regress matrix desk touch audio cup p2 robust setup visual glerrors; do
  if [ -f test/e2e/$t.py ]; then
    s=$(date +%s); note=""
    timeout 600 python3 test/e2e/$t.py > "$LOG/$t.log" 2>&1; rc=$?
    if [ $rc -ne 0 ]; then
      cp "$LOG/$t.log" "$LOG/$t.first.log"
      timeout 600 python3 test/e2e/$t.py > "$LOG/$t.log" 2>&1; rc=$?
      [ $rc -eq 0 ] && note=" (flaky: passed on retry)"
    fi
    echo "$t rc=$rc $(( $(date +%s)-s ))s  $(grep -c '^FAIL' "$LOG/$t.log") FAIL lines$note" >> "$LOG/summary.txt"
  fi
done
echo DONE >> "$LOG/summary.txt"
