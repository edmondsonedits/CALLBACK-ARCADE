# Task 2 — independent Scratch Match review

Date: 2026-10-12. Reviewed `673d123..e77fc91`, supplied Task 2 diff package, task brief/report, binding worlds design, game source/guides/provenance and focused test implementation. Also reviewed parent addendum `1ae0bbf` (browser assertion wording and extracted lifecycle harness boundaries). No production edits, commits or delegation were performed by this reviewer.

## Explicit verdicts

- **Spec verdict: NEEDS WORK.** One small, concrete Watch-mode action availability gap remains below. Source/runtime implementation otherwise covers the requested four stages, real isolated demo, settings, practice/Tour and asset reuse. Desktop/portrait/landscape visual acceptance remains **unverified by this reviewer** pending parent screenshot inspection; this is not a complete visual acceptance.
- **Code-quality verdict: PASS within the inspected source/test scope.** No additional correctness, security, resource-bound or maintainability defect requiring a fix was found. The Watch issue is a product-contract omission, not a timing/simulation failure. No subjective numerical quality, measured frame rate, physical controller/touch feel or audio-by-ear rating is certified.

## Finding

### P2 — Watch mode hides the primary Start action

Evidence: `games/royal-scratch-match/source/index.html:570` hides the whole `#menu` in `watchDemo(true)`. The sole pointer/keyboard Start control is `#startBtn` inside that menu at line 163. The only replacement control outside the menu is `#returnWatchBtn` at line 168; the topbar has settings, sound and fullscreen controls, but no Start.

The binding design explicitly allows Watch to collapse the menu while requiring the main action to stay accessible. A viewer currently has to leave Watch before starting with ordinary pointer/keyboard UI (a gamepad Start shortcut does not supply that visible action). Keep a compact Start action next to Return while watching, using the same fresh-session and gesture-audio path as the title Start. Verify a Watch-to-Start click creates a clean session and removes both Watch controls.

This is established directly by the DOM and event handler; no unchanged suite was rerun to confirm a CSS-hidden ancestor.

## Evidence assessed

- Four rules are real: `createPhrase` constructs swing pairs and Foundry motifs/chords and stores explicit mirrored `responseLanes`. Call sound/visuals use the call timestamps; response display, bot intents and local judgment use the expected response lanes. Difficulty windows stay unchanged. Tempo scales count-in and phrase timing consistently; the monotonic clock, pause/hidden handling and local latency deadline remain intact.
- Classic phrase RNG calls remain in the classic construction path. Rehearsal restores the phrase RNG checkpoint. Replay captures stage, mode, tempo, goal, difficulty and seat rules; Tour resets records, visits all four stages and totals corresponding seat scores.
- Demo uses independent arrays/player records and an Alea stream, with synchronous capture/restore in `finally`; all demo seats are bots. Input and audio guards prevent real-session input and synthesis during demo simulation. Return stops existing voices; Start initializes fresh players and counters. This is source/runtime evidence, not a claim of browser sound measurement.
- Settings validate enums, numeric bounds, name and color; rule selections are staged, while style/access changes apply immediately. Native field key handling precedes shortcuts. Storage access is guarded. Menu scrolling/footer and ten-performer geometry are implemented, but actual pixel legibility awaits the parent review.
- Effects are capped at 240 particles, 48 rings and 64 active audio voices; recent successful timing samples cap at 256. The local sprite is drawn on impacts, and the optional decoded audio accent is guarded behind enabled audio. Resource failures fall back without blocking play. Full supplied Kenney notices and MIT header/upstream file are present.
- Independently matched actual source, worlds-test and selected asset hashes to the implementer evidence/provenance. Runtime SHA-256: `ec7457200e5d22f2881517fadefef5078a72294633b7b309af0ac4a949a375bb`. Reviewed diff contains no Royal Sumo or original archive changes.
- Inspected the 18 added worlds tests plus the retained harness and prior quality report. Implementer reports 65 focused tests and smoke passing on this same source; those unchanged suites were not blindly rerun. VM tests intentionally stub DOM/audio/time and do not establish pixels, real decoded sound or hardware behavior.
- Parent browser scenario exercises native title/settings/Watch/Start, all four stages, ten seats, keyboard/emulated-touch inputs, pause and exact retry at three viewports. It reads production state without adding production test accessors. Input assertions prove routing, not successful hardware timing. Its initially overbroad “silent demo” assertion label was corrected in `1ae0bbf` to match what it actually checks.
- Parent `1ae0bbf` adds only missing browser/state boundary stubs to the extracted lifecycle test harness. Existing timer cancellation, stale-callback and duplicate-fanfare assertions are unchanged. The added stubs do not replace the timer behavior under test.

## Acceptance boundaries

| Dimension | Review status |
| --- | --- |
| Core control and fairness | Pass, source/runtime evidence |
| Stage variety and teachable rules | Pass mechanically; legibility unverified |
| Title/demo and complete flow | Needs work: Watch Start availability |
| Functional customization/persistence | Pass, source/runtime evidence |
| World/character/effects coherence | Substantial source implementation; pixels unverified |
| Audio/mute discipline | Pass guards; mix and browser playback unverified |
| Accessible/mobile UI | Focus/scroll implementation inspected; pixels and hardware unverified |
| Replay/mastery and results | Pass, source/runtime evidence |
| Reliability/performance | Pass bounded resources; measured FPS unverified |
| Sources/licenses/regressions | Pass within supplied evidence and inspected diff |

Parent should fix the Watch action omission and complete the pending real screenshot/resource inspection before advancing to the next game. No broader redesign or additional unchanged-suite rerun is requested by this review.
