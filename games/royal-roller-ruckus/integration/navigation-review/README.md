# Bot navigation correction — held draft review

Branch `quality/royal-roller-ruckus`; base `785a15000abe11970c7b92c5f3cab197061fcedf`.
Playable entry: `games/royal-roller-ruckus/source/index.html`.
The coordinating conversation authorized a focused navigation/difficulty correction
and ordinary branch pushes to [held draft PR #21](https://github.com/edmondsonedits/CALLBACK-ARCADE/pull/21).
This is review work, not a merged, deployed or release-approved game.

The frozen first candidate is `e1141247bc44bc0d2188b6547624f94f5add8d60`.
Its evidence-only review is preserved at
[`5a790136481a9ba4e92df5272fb87c73d1430982`](https://github.com/edmondsonedits/CALLBACK-ARCADE/tree/5a790136481a9ba4e92df5272fb87c73d1430982/games/royal-roller-ruckus/integration/bot-review),
including all three exclusion patches and the failed full-course exclusion test.
No historical failure was removed or waived.

## Two separately reviewable corrections

1. `b5261553e341458cd13a7fbcfdf8bf8090946b2d` restores the original `.31`
   corner-speed penalty. Matched ablation did not support the optional `.50` slowdown.
2. The navigation commit adds a controller waypoint recovery target. On the
   finish hairpin, nearest-sample projection can jump from incoming sample 630
   to outgoing sample 8 before the racer crosses the required gate at sample 5.
   Previously the AI then aimed down the outgoing leg and took another circuit.
   A nearby missed gate now causes a physical return to four samples before the
   gate, then an approach through four samples after it. The target resets after
   credit or Respawn/Race Again. Existing acceleration, grip, braking, reaction,
   local avoidance, passing/defense and personality remain active.

The correction writes neither pose, velocity nor lap/checkpoint credit. It does
not change gate acceptance, track geometry, difficulty tables, race rules or human
controls. Two dependency-free tests pin target transitions, unchanged physical
state/progress and recovery resets. Source SHA-256:
`7bd88e9bc5508b965ed9185615de7b15ad874dd7ec28f436fbc5ab27629c0b4b`.

## Matched evidence and fresh seeds

Shipping simulation, actual spline, 120 Hz, three laps, all seats driven by the
shipping AI, visual/audio/DOM work stubbed. All seats stay participating until
all finish. No runtime pose, velocity or checkpoint injection. Initial RNG seed
and bot personality/decision/lane timer streams match the original study; later
random choices naturally diverge with trajectories. These are automated controller
measurements, not human gameplay or physical-device feel certification.

| Variant, seeds 123/456/789 | Finishers | Mean finish | Longest checkpoint gap | Raw missed-finish observations |
|---|---:|---:|---:|---:|
| Frozen e114 candidate | 144/144 | 169.80 s | 138.72 s | 81 |
| Restore `.31` only | 144/144 | 130.44 s | 80.27 s | 44 |
| Restore `.31` + navigation | 144/144 | 119.89 s | 10.45 s | 6 |

All 27 matched races and all 27 fresh-seed races (101/202/303) finish: **288/288
racers, 864 legal laps**, no falls, respawns, non-forward credit or two-second
low-speed stalls. Fresh-seed maximum checkpoint gap is 10.67 s. Maximum signed
route without checkpoint credit is 95/96 samples (640 samples per circuit).
Both mean and median finish times order **hard < normal < easy** at every seat
count in each seed set. Raw rows and aggregate difficulty results are retained in
`matched-seeds.jsonl`, `holdout-seeds.jsonl` and `summary.json`.

The raw missed-finish observer counts crossing eight samples beyond the finish
without an intervening lap after half a circuit of signed route travel. It also
counts a short overshoot followed by legal recovery. It is not itself proof of
an extra circuit. We retain all 6 matched/9 fresh observations and assert the
actual failure bounds: under 25 seconds and under half a circuit without credit.
The pre-fix seed-456 run fails 6/10 of these same tests, including difficulty
ordering (`pre-fix-tests.txt`); the corrected matched/fresh suites pass 28/28 each.

## Reproduction and checks

Node v24.19.0, Three.js 0.180.0 installed outside the checkout. From the branch root:

```sh
node games/royal-roller-ruckus/tests/source-smoke.mjs
npm test
THREE_MODULE=/tmp/roller-audit/node_modules/three/build/three.module.js node --test games/royal-roller-ruckus/tests/navigation.test.mjs
THREE_MODULE=/tmp/roller-audit/node_modules/three/build/three.module.js NAV_SEEDS=101,202,303 node --test games/royal-roller-ruckus/tests/navigation.test.mjs
THREE_MODULE=/tmp/roller-audit/node_modules/three/build/three.module.js node games/royal-roller-ruckus/tests/real-course.mjs
THREE_MODULE=/tmp/roller-audit/node_modules/three/build/three.module.js node games/royal-roller-ruckus/tests/camera.mjs
PLAYWRIGHT_MODULE=/tmp/roller-audit/node_modules/playwright/index.mjs THREE_BUILD_DIR=/tmp/roller-audit/node_modules/three/build EVIDENCE_DIR=/tmp/roller-navigation-browser node games/royal-roller-ruckus/tests/browser.mjs checks
npm run typecheck
npm run catalog:check
npm run build
PAGES_OUTPUT_DIR=/tmp/roller-navigation-pages npm run pages:build
cmp games/royal-roller-ruckus/source/index.html /tmp/roller-navigation-pages/games/royal-roller-ruckus/index.html
```

- **Passed:** 82 repository tests (22 Roller behavioral tests); both 28-test
  navigation suites; real-course 2/4/10-seat finishes with unique ranks; ten-cage
  shared-center contact recovery (38.09 units player travel in 12 seconds);
  supported landing without checkpoint credit.
- **Passed:** continuous maximum-normal-speed camera sweep (1,722 frames), CAM
  round trip; browser blur, touch cancellation, settings/manual resume, remote
  disconnect, CAM controls, dependency-failure UI and desktop/portrait framing.
  Chromium 154.0.8037.57; positive rendering uses a test-only local Three fixture.
- **Passed:** typecheck, unchanged catalog check, Worker dry-run build and Pages
  build with byte-identical game HTML. No deployment command was executed.
- **Failed as expected before correction:** seed-456 navigation baseline, retained.
- **Blocked:** Sumo reference materialization (both supported local attempts
  returned `library file transfer failed: download failed`); no Sumo pixel comparison.
- **Not run:** physical phone/gamepad, audio by ear, real GPU, successful public-CDN
  delivery certification. Emulated touch and screenshots do not certify feel.

## Assets, performance and remaining review

No assets, license notices or archives changed in this correction. New quality
visuals are procedural; no Sumo material or code was imported. Three.js still
loads from jsDelivr 0.180.0 and reports download failure honestly; no offline claim.
The archive SHA remains
`643eea4257d0ab94ba9aee6ca2706b83b43ae10e1d9a05de7d2fd83289c2b515`.

The original 60-second matched static ten-racer baseline/candidate measurements
and software-renderer investigation remain in `../quality/`. A final source
rendering measurement is recorded separately here; it is a stationary rendering
check, not racing throughput. This executor has no real GPU. Do not extrapolate
its frame timing to hardware or mobile performance.

Independent review and physical-device/game-feel validation remain open. The
coordinator owns metadata/version/catalog/packaging decisions and release status.
No shared game files or generated catalog/STATUS/manifest files were changed.

Final rendering run: Chromium 154.0.8037.57 / ANGLE Vulkan SwiftShader,
1280×720, DPR 1, balanced graphics, seed 123, fixed camera, ten stationary racers,
60.63 seconds / 37 frames. Mean/median/p95: **1638.59 / 1312.90 / 4060.30 ms**;
original baseline: **1669.92 / 1364.60 / 3931.00 ms**. Final p95 is 3.3% above
baseline and 55.5% above the first candidate, while mean/median stay close. The
navigation/penalty changes execute only during simulation, which this fixture
does not advance. Draw counts and triangles match the first candidate exactly
(302 / 68,302); neither corrective commit changes rendering or HUD functions.
The prior rendered/idle diagnostics remain applicable evidence of a noisy,
software-presented path, not proof of a specific driver cause. These 36–38-frame
samples cannot establish stable tail performance or real-device acceptability.
No hardware-independent FPS or performance improvement is claimed.

To reproduce this final rendering run, use the browser command above with mode
`perf` and a separate `EVIDENCE_DIR`; run it without concurrent QA workloads.
