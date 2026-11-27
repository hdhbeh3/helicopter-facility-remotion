#!/usr/bin/env bash
# Measures real seconds-per-frame on THIS machine for the most demanding moments, then extrapolates.
# Per-frame time = (time to render 9 frames - time to render 3 frames) / 6  -> removes browser/bundle start-up.
# Usage: bash scripts/benchmark.sh            (env: CONC=2 BENCH_POINTS="435 630 1290 1575 1860" EXTRA_ARGS="--props={\"aa\":true}")
set -euo pipefail
cd "$(dirname "$0")/.."
CONC="${CONC:-$(( $(nproc) / 2 ))}"; [ "$CONC" -lt 1 ] && CONC=1
POINTS="${BENCH_POINTS:-435 630 1290 1575 1860}"   # pour | rotor-wash+furniture | underground cutaway | rain+hangar build | final wide
TOTAL=$(node -e "const d=require('./src/audioTimeline.json').duration;console.log(Math.ceil((d+0.4)*30))")
mkdir -p out
render() { # start n
  local s=$1 n=$2 t0 t1
  t0=$(date +%s.%N)
  npx remotion render src/index.ts HelicopterFacility out/bench.mp4 --frames="$s-$((s+n-1))" --muted --gl=swangle --concurrency="$CONC" --log=error ${EXTRA_ARGS:-} >/dev/null
  t1=$(date +%s.%N)
  python3 -c "print(round($t1-$t0,2))"
}
declare -a names=("scene3 concrete pour" "scene4 rotor wash + furniture" "scene6 underground cutaway" "scene7 storm + hangar build" "scene8 final wide")
echo "machine: $(nproc) cores, concurrency $CONC, total frames $TOTAL"
rows=""; sum=0; n=0; worst=0; i=0
for f in $POINTS; do
  a=$(render "$f" 3); b=$(render "$f" 9)
  pf=$(python3 -c "print(round(max(($b-$a)/6,0.01),2))")
  echo "frame $f (${names[$i]:-sample}): 3f=${a}s 9f=${b}s -> ${pf} s/frame"
  rows="$rows| $f | ${names[$i]:-sample} | $pf |\n"
  sum=$(python3 -c "print($sum+$pf)"); n=$((n+1)); worst=$(python3 -c "print(max($worst,$pf))"); i=$((i+1))
done
avg=$(python3 -c "print(round($sum/$n,2))")
hours=$(python3 -c "print(round($avg*$TOTAL/3600,2))")
whours=$(python3 -c "print(round($worst*$TOTAL/3600,2))")
echo "average ${avg} s/frame -> full render ~${hours} h on one job (worst-case sample ${worst} s/frame -> ${whours} h)"
for N in 4 8 12; do echo "  with $N parallel chunks: ~$(python3 -c "print(round($hours/$N*60))") min per chunk (worst-case $(python3 -c "print(round($whours/$N*60))") min)"; done
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## Render benchmark ($(nproc) cores, concurrency $CONC)"
    echo "| frame | moment | s/frame |"; echo "|---|---|---|"; printf "$rows"
    echo; echo "**Average $avg s/frame -> $hours h single job** (worst sample: $whours h)."
    echo; echo "Parallel chunks: 4 -> $(python3 -c "print(round($hours/4*60))") min each, 8 -> $(python3 -c "print(round($hours/8*60))") min each, 12 -> $(python3 -c "print(round($hours/12*60))") min each."
  } >> "$GITHUB_STEP_SUMMARY"
fi
