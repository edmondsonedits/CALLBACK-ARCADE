# Worlds v1.6.0 evidence

Implementation source commit: `50f6661`, followed by the results-classification/evidence commit listed in the task handoff. The current exact source SHA-256 and all shipped file hashes are in `verification.json`. Original archive SHA-256 remains `643eea4257d0ab94ba9aee6ca2706b83b43ae10e1d9a05de7d2fd83289c2b515`.

## Behavioral and real-Three checks

- `focused-tests.txt`: 61/61 focused tests (41 preserved + 20 worlds). The four initial worlds tests failed before implementation because course/rules/demo/Series contracts did not yet exist.
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

## Independent review fix round 1

Both P2 findings were reproduced with failing shipping-source tests before correction. Skygarden cone tips now use the corresponding track normal multiplied by the announced gust side at creation and update; actual-force alignment exceeds0.999 at all six arrow positions in both cycles. Steam loading now publishes one shared pending promise before awaiting it; stale generations cannot attach sprites or change resource ownership. Newest-first completion, repeated transitions, cached failure, resource identity and disposal checks pass. A failed request stays unavailable until reload with the procedural fallback active. The combined focused suite is now60/60. No simulation force, checkpoint, route or camera behavior changed, so full navigation sweeps were not rerun for these rendering/resource fixes.

## Browser fix round 2 — model resource closure

The first ordinary Chromium run exposed a missing Castle Kit dependency: both castle GLBs reference `Textures/colormap.png`. The exact licensed upstream512×512 PNG (7,529bytes) is now shipped at that relative path, with manifest, source/archive/per-file hashes and the existing complete Castle Kit CC0 notice. Its SHA-256 is `66fd49be148f32e88f6c8cace67120250d1943a7856601158ad0ff24651db0b0`. The prior no-external-resource documentation was corrected. A new recursive GLB/glTF closure test first failed on the missing path and now follows every image/buffer URI, rejects remote/out-of-root references and verifies every reached file's hash and manifest entry. The full focused suite is61/61. The same browser round corrects compact-title word spacing, places the short-landscape coach below the speed HUD, restores pointer input on the visible recovery button and hides redundant title branding in short landscape. Recovery hides the secondary title/meter so its44px action fits the100px control panel. These scoped layout fixes change no physics. The complete source/file hash manifest is refreshed; the parent will verify fresh rendered bounds and a real fall/tap-recovery flow.
