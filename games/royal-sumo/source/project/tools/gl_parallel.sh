#!/bin/sh
# GL error hygiene on all six maps in two parallel halves (2-core sandbox). usage: tools/gl_parallel.sh [steps] [logdir]
STEPS=${1:-300}; LOG=${2:-/tmp}; cd "$(dirname "$0")/.."
RS_GL_STEPS=$STEPS timeout 900 python3 test/e2e/glerrors.py keep floe plaza > "$LOG/gl_a.log" 2>&1 &
RS_GL_STEPS=$STEPS timeout 900 python3 test/e2e/glerrors.py wharf teeter mesa > "$LOG/gl_b.log" 2>&1 &
wait
