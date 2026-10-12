# Worlds v1.6.0 evidence

Implementation source commit: `50f6661`, followed by the results-classification/evidence commit listed in the task handoff. The current exact source SHA-256 and all shipped file hashes are in `verification.json`. Original archive SHA-256 remains `643eea4257d0ab94ba9aee6ca2706b83b43ae10e1d9a05de7d2fd83289c2b515`.

## Behavioral and real-Three checks

- `focused-tests.txt`: 57/57 focused tests (41 preserved + 16 worlds). The four initial worlds tests failed before implementation because course/rules/demo/Series contracts did not yet exist.
- `navigation.json`: 24 actual-simulation, three-lap races at maximum hazard intensity across every course, 2/10 seats and seeds 123/456/789. Every racer finished with finite state, unique places, and no non-forward gate credit. Crownway 115.24–123.58s; Frostglass 86.39–88.87s; Foundry 115.91–123.18s; Skygarden 80.74–82.66s (simulated time). Foundry's ten-seat seed456 had six real falls and physical recoveries; all finished legally. No hidden progress, teleport-to-finish or fabricated timestamp was used.
- `camera.json`: all-course, full-spline 7.7-unit/s camera sweeps. Worst projected player bottom: Crownway/Foundry 527.72px, Frostglass 492.13px, Skygarden 508.23px, all below 532px at 1280×720. Worst frame turn 0.04825rad, below 0.1.
- Existing real-course check: 2/4/10 seats finish three laps; coincident-pack physical release and crossover landing without credit pass.
- Existing seeded navigation: 28/28 tests pass, including 27 races over three difficulties and effective difficulty ordering.
- Existing CAM-code save/load and classic framing pass. Inline module and both new vendor modules pass syntax checks; source-smoke/archive checks and scoped diff whitespace checks pass.

## Resource and license checks

Real Three CPU scene tests prove finite rider poses, rematch disposal, a bounded two-course-group scene over 12 switches and exactly eight rebuilt checkpoint markers. They do not prove GPU memory or framerate. Scenery uses up to four cached templates and 22 model clones plus three steam sprites. Full local Kenney notices and source/archive/per-file hashes are under `source/assets/`. Official matching Three r180 loader provenance is under `source/vendor/loader-provenance.json`; no extra decoder or runtime CDN exists.

## Rubric at implementation handoff

| Dimension | Status | Evidence / remaining check |
| --- | --- | --- |
| Core control/fairness | pass | Classic 41 focused checks and legal full-course bots; physical device feel unverified. |
| Course variety/counterplay | pass | Four actual rule sets, two new route profiles, bounded effects and warned safe choices; rendered readability requires browser review. |
| Title demo/flow | pass | Every course loops 32 legal gate credits for four bots; no records/session RNG/input leakage. UI pixels require browser review. |
| Customization/persistence | pass | Validated enums/numbers, staged rules, native editing and immediate working style/access settings; denied storage guarded. |
| World/character/FX coherence | unverified | Actual licensed GLBs, unique materials/scenery and particle use implemented; awaiting rendered-scene review. |
| Audio clarity/mute | unverified | Silence, unlock and voice-cap behavior tested; no audible-mix or device claim. |
| Accessible/mobile UI | unverified | Responsive compact HUD and scrolling native controls implemented; parent owns 390×844/844×390 browser inspection. |
| Replay/results | pass | Scoped records, fixed-seed replay and four-course Series; only finishers get timestamps/finish ranks/points. |
| Reliability/performance | unverified | Behavioral/resource regression checks pass, fall/recovery behavior recorded; no GPU/FPS claim. |
| Source/license/regression | pass | Local source/archive hashes, full notices, loader import-only modifications and unchanged original/renderer. |

The coordinator owns independent review and exact-source Chromium/WebGL screenshots. No subjective 9/10, hardware touch/gamepad/audio or measured-device FPS certification is claimed. Authenticated online transport remains unintegrated.
