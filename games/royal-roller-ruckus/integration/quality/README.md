# Roller quality review evidence

Local review branch: `quality/royal-roller-ruckus`.
Base: `785a15000abe11970c7b92c5f3cab197061fcedf`, fetched and verified against
`origin/main` on 2026-10-12. No merge, push, deployment or multiplayer promotion.
Playable entry: `games/royal-roller-ruckus/source/index.html`.

The coordinator approved the bounded brief before source changes. Changes stay
inside this game and `tests/royal-roller-ruckus-quality.test.mjs`.

## Behavior and design

- Ordered, forward, supported checkpoint sweeps replace proximity credit. They
  reject backward movement, a different deck, airborne credit, off-road crossings
  and discontinuous jumps. Landing/respawn reseed sweep history without credit.
- Lap credit and the finish arch now align with the **existing gold stripe at
  sample 5**. The unchanged spline doubles back at sample 0; a tangent-plane gate
  there is not reliably traversable in the forward direction. Checkpoints 1–7,
  track geometry, raised crossover and three-lap rule remain intact.
- Standings use validated checkpoint progress and bounded segment distance, so
  starting just behind the wrap or skipping ahead cannot jump the rankings.
- Collisions respect vertical separation, use deterministic normals for coincident
  centers and make three bounded separation passes. Existing restitution,
  momentum transfer and pack-release impulses remain. Camera shake responds to
  player contact and is bounded; existing tiered sparks/audio/haptics remain.
- Bot steering had a double-`dt` damping error. Correct units, shorter look-ahead
  on sharp bends, conservative corner braking and gate-directed target points
  allow physical races to finish. Avoidance, passing, defense, mistakes, reaction
  delays and personality remain; perception now ignores another vertical deck.
  There is no bot teleport or checkpoint award in the controller.
- Camera target smoothing, same-deck rival influence, reset/respawn framing and
  shorter look-ahead keep the player above the controls. CAM code format and
  controls are unchanged. HUD refresh is capped at 10 Hz rather than rebuilding
  standings at each 120 Hz simulation substep and again each render frame.
- Active gate labels, edge lines, persistent next-checkpoint text and larger
  ten-seat standings improve route/rank readability. Existing landing cues stay.
- Blur/visibility/pause/settings/reset neutralize held input. Settings still need
  manual resume. Disconnect clears packet, smoothed steering and public input
  state. Local hooks remain local hooks, without an authenticated transport claim.
- Dependency download failure has an explicit error and Retry control. The
  product still imports Three.js 0.180.0 from jsDelivr; no offline build or
  vendoring is claimed.

## Measured feel

Source-extracted `updatePlayer`, 120 Hz, fixed tangent and grade, starting at rest;
stop/reverse begins at forward speed 7. These isolate acceleration/grade behavior,
not human-driven whole-segment trials. World units are game units.

| Segment | Acceleration to 7, base → candidate | Opposing stop distance | Stop time | Reverse to −7 |
| --- | --- | --- | --- | --- |
| Flat, sample 226 | .608 → .608 s | 2.522 → 2.090 | .608 → .492 s | 1.150 → 1.033 s |
| Elevated, sample 351 | .617 → .617 s | 2.440 → 2.031 | .592 → .483 s | 1.125 → 1.017 s |
| Raised crossover approach, sample 512 | .642 → .642 s | 2.357 → 1.976 | .575 → .467 s | 1.083 → .983 s |

Stopping distance improves 16.1–17.1%; acceleration time is unchanged. Normal
speed remains 7.7; slope, rush/rough surfaces, coast drag and airborne control
remain. Both raw measurement files are included.

## Checks

See `../../tests/README.md` for runnable commands and test dependency setup.

| Check | Result / scope |
| --- | --- |
| Baseline regressions | 10 failed, 5 passed before fixes; log included |
| Owned behavioral tests | Passed: forward/order/height/airborne/shortcut credit, ranking, landing/respawn, coincident 2/10-cage separation, finish uniqueness/reveal/reset, input and braking guards |
| Archive smoke | Passed; SHA-256 pins original bytes, replacing stale active==archive assumption |
| Full repository `npm test` | Passed, 80 tests including Ballistix mobile, Twisted camera, Space Bash and Scratch Match lifecycle contracts |
| Actual Three.js course | Passed: 2/4/10 seats, three laps, unique ranks, finite state; 141.43 / 189.73 / 234.23 simulated seconds, seed 123, normal difficulty |
| Ten-cage physical recovery | Passed: exact shared starting center; player moved 27.39 units in 12 simulated seconds; finite state |
| Legal airborne landing | Passed: actual course landing, one landing counted, no checkpoint/lap credit |
| Maximum-speed camera sweep | Passed: 7.7 units/sec, 1,722 frames at 60 Hz around actual spline; maximum frame rotation .04825 rad; cage bottom no lower than 527.72 px, desktop controls start 536 px |
| Browser DOM and presentation | Passed: blur, pointer cancellation, settings/manual resume, disconnect, CAM codes, blocked-dependency error; desktop 1280×720 and emulated portrait 390×844 framing |
| Visual inspection | Actual Roller screenshots inspected. Screenshots demonstrate framing, not game feel. No Sumo visual comparison |
| Physical phone / gamepad / audio-by-ear / real GPU | Not run |
| Normal external jsDelivr availability | Not certified; positive browser checks use a test-only local copy of the same Three.js version; failure handling is tested explicitly |

The complete-race test deliberately gives every seat the real bot controller and
keeps all seats participating until the finish. It invokes real fixed-step
physics and checkpoint functions, with rendering/audio substitutes; it does not
write race progress or teleport racers during races. The ordinary one-human
finish policy remains unchanged. Synthetic unit fixtures alone are not counted
as complete course races.

## Matched performance and investigation

Sequential 60-second, ten-racer stationary grid, seed 123, identical fixed camera,
balanced graphics, 1280×720, DPR 1. Chromium **154.0.8037.57**; renderer **ANGLE
(Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader
driver)**. Container reports Intel Xeon Platinum 8573C, a four-CPU cgroup quota,
16 GiB memory limit and no `/dev/dri` device.

| Measure | Baseline | Candidate |
| --- | ---: | ---: |
| Duration | 60,117.3 ms | 60,953.1 ms |
| Frames | 36 | 38 |
| Median interval | 1,364.6 ms | 1,365.2 ms |
| Mean interval | 1,669.925 ms | 1,604.029 ms |
| p95 interval | 3,931.0 ms | 2,610.6 ms |
| Main render draw calls | 299 | 302 |
| Main render triangles | 68,298 | 68,302 |

Median difference is +0.044%; no >10% measured regression. Raw JSON is included.
This controlled render scene excludes ongoing race simulation/HUD updates and
is not a playable frame-rate claim. The final camera look-ahead adjustment and
paused-action neutralization do not affect this fixed-camera, inactive-input
scene. Highly variable software presentation limits any broader inference.

Investigation separated idle scheduling from WebGL canvas presentation: idle
requestAnimationFrame averaged 18.42 ms, render-with-UI 1,058 ms, render-without-UI
1,473 ms (short sequential diagnostics). Synchronous render calls were much
shorter than frame intervals; removing HUD did not resolve the slowdown. Turning
shadows off also did not expose an expensive synchronous rendering call. This
isolates the issue to the rendered/presented path in this executor, but does not
prove a specific driver/compositor cause. Do not extrapolate hardware FPS or
claim that reducing HUD work cured software rendering.

## Asset/reference provenance and blockers

All new visible cues use the existing procedural Three.js geometry/text approach.
No third-party game assets, Sumo code, images, audio or licensed bundles were
imported. The original upload remains unchanged with SHA-256
`643eea4257d0ab94ba9aee6ca2706b83b43ae10e1d9a05de7d2fd83289c2b515`.
Three.js was installed from npm only into `/tmp/roller-audit` for tests; its MIT
license was not incorporated into the product because nothing was vendored.

The Sumo Library reference `libfile_699ce89727b08191bc207e0244a85a24`, expected
455,469 bytes, could not be materialized in this consuming executor. The current
Library transfer helper returned the exact stderr **`library file transfer
failed: download failed`**, exit code **1**, on the first attempt and one bounded
consumer-local retry. No more specific underlying network cause was exposed.
Both destination files were absent on subsequent `stat`. Therefore reference
pixels could not be inspected, and no visual comparison is claimed.

## Coordinator follow-up

Independent review is still required. Suggested release metadata: retain
experimental/imported status and existing multiplayer classification; describe
ordered checkpoints, height-aware contacts, input recovery and camera/readability
polish. The coordinator owns version selection, STATUS/catalog/manifest changes,
packaging and any later draft PR authorization. No shared/generated metadata was
edited here. Physical device/game-feel validation and real-GPU performance remain
open, alongside the unavailable Sumo reference.
