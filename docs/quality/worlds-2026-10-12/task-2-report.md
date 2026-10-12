# Task 2 — Scratch Match Four Courts Tour

Date: 2026-10-12. Runtime **v0.7.0**. Implementer handoff; parent owns independent review, actual Chromium screenshots, shared build/catalog gates and publication. Only Scratch Match package, its unique worlds test and this report are implementation-owned. Royal Sumo, other games and the original v0.5 archive are untouched.

## Implemented behavior

- Compact live title with current court/skill, Start and Watch/Return. Production note construction, monotonic clock, bot-intent scheduler, lane judge and renderer execute in a separate title state with a scoped MIT Alea stream. `finally` restores real session state; real stats/seed/inputs are unaffected. Demo is all-bot, silent before and after sounded play, never allocates audio automatically and writes no progress/preferences. Menu configuration changes deliberately rebuild its stage/seats; Start initializes a fresh real session.
- Royal Hall retains original seeded phrase construction and Crown elimination/scoring. Tide Pavilion uses coherent 2/3–1/3 swing pairs. Clockwork Foundry uses half-beat motifs and alternating two-rune chords. Mirror Ballroom explicitly announces A↔Y/B↔X, annotates each call note with its ECHO target, displays transformed response notes and judges the same transformed lanes for humans and bots. Note timestamps and difficulty windows are shared unchanged between sound/display/bot/judgment; tempo selection scales count-in, musical spacing and note travel consistently.
- Each stage can be rehearsed with exact-phrase retry and deliberate advance. Four Courts Tour visits all four courts for two phrases each, removes elimination, records per-seat scores and local accuracy counts, shows next-court flow and combines final standings. Replay starts the same seed and captured rules from the first court; fresh Start resets records and chooses a fresh UI seed.
- Rules/Player/Controls/Audio & Access groups expose 18 meaningful settings: stage, session, phrase goal, tempo, difficulty, seats, name, color, costume, instrument, beat guide, vibration, volume, mute, reduced motion, high contrast, local timing correction and reset defaults. Rules stage until Start; access/style are immediate. Name editing allows spaces and empty text until blur normalization. Native focused inputs never consume rhythm/shortcut keys. Settings have a scroll area and separate visible footer.
- Tide has an open timber pavilion, scalloped roof, pilings, lanterns, moon and animated sea; Foundry has layered gear trains, overhead pipes, opposing presses and hazard stripes; Mirror has tall beveled reflecting panels, crystal chandelier and checkerboard floor. Existing Royal architecture remains. Ten performers use bounded side rows, with roster above and highway/controls clearance. High contrast strengthens highway dividers as well as DOM panels. Per-note feedback retains timing meter, worst-chord timing, impact/recovery, with bounded 240 particles, 48 rings and 64 audio voices.
- A local CC0 Kenney star sprite is actually drawn on note impacts, and a quiet local CC0 metal accent plays on completed local perfect notes. The image has a geometric fallback; fetch/decode failure leaves synthesized sound. Audio decoding starts only after an explicit enabling gesture. All imported originals/licenses/hashes and the exact MIT upstream file are present locally.

## Verification

First red run: **10/10 new behavior tests failed** against the preceding implementation (missing stages, mirror rules, Tour, isolated demo, staged settings and native-field shortcut guard). Implemented those contracts, then added eight targeted edge regressions.

Initial implementation full focused command:

```
node --test tests/royal-scratch-match-quality.test.mjs tests/royal-scratch-match-sumo-benchmark.test.mjs tests/royal-scratch-match-worlds.test.mjs
```

**65/65 passed**: 47 retained timing/input/lifecycle tests plus 18 new worlds tests. They execute the complete production inline script with controlled DOM/audio/time boundaries. New checks cover all four stages/exact retry/legal bot scoring, swing/offbeat/chord timing, explicit mirror transformation and wrong-lane/chord semantics, sound scheduling at stage timestamps, unchanged scoring windows, real demo progression/silence/no RNG or stats leakage/clean Start, staged rules/seats/difficulty, immediate style, native field focus, malformed/denied storage, API seat changes, seeded replay despite staged rules/demo use, Tour aggregation/reset and bounded renderer effects at ten seats.

`node games/royal-scratch-match/tests/smoke.mjs`: passed. Parses the full inline source, checks preserved input/API/offline markers and verifies the unchanged archive SHA-256. `git diff --check -- games/royal-scratch-match tests/royal-scratch-match-worlds.test.mjs`: passed.

Current runtime SHA-256: **4866174e89a07e444091ab2a550b74cc25f6ef211277aea44f45ad5fe5cb7d18**. Archive: **6c58614db13495393512e9f69496da686dc2962b3cabd49d71680493170cbb03**. Machine-readable evidence: `games/royal-scratch-match/tests/worlds-evidence.json`. Tests do not attest uninspected pixels, audible mixing or physical input feel.

## Acceptance rubric at implementer handoff

| Dimension | Status | Evidence / remaining limit |
| --- | --- | --- |
| Core control/fairness | pass | All retained timing, pause, correction/expiry, legal bot and chord tests plus mirror checks |
| Stage variety/learnability | pass (source/runtime) | Four distinct note rules with explicit cues; graphical legibility awaits browser review |
| Title/demo/flow | pass (runtime) | Real independent call/response demo, Watch/Return, silence, clean Start and tour records tests |
| Customization/persistence | pass | Validated defaults, staged rules, style/access, storage/focus tests |
| World/character/FX coherence | unverified visually | Substantial source scenes/costumes/feedback and bounded rendering; parent pixel review pending |
| Audio clarity/mute | pass discipline; unverified mix | Timestamp/mute/stale tests, optional local sound guard; no audio-by-ear claim |
| Accessible/mobile UI | unverified pixels/hardware | Scroll/footer, responsive reservations, contrast and focus code; parent viewport review pending |
| Replay/mastery | pass | Exact phrase retry, captured-rule same-seed replay, stage Tour aggregate/reset tests |
| Reliability/performance | pass bounds; unverified FPS | Input/clock/voice/particle bounds, denied storage; no measured frame-rate claim |
| Sources/licenses/regressions | pass | Local MIT and CC0 originals/licenses/hash provenance, 65 tests and immutable archive |

## Provenance and integration

`source/assets/provenance.json` includes official Kenney particle/impact page URLs, original ZIP hashes, selected per-file hashes and MIT source URL/commit/hash. `particles-License.txt` and `impacts-License.txt` are complete supplied upstream notices. `alea-upstream.js` is byte-identical to the intake library at David Bau seedrandom commit `4460ad325a0a15273a211e509f03ae0beb99511a`, SHA-256 `9f821c9ede583e1c1f1d3263d6d016d13d562768de6c477d8262f7e8028a09cb`. The production inline copy retains full MIT header and algorithm; only the module export wrapper becomes a local factory. Its independent deterministic stream schedules title phrases/bots, never replaces global Math.random or the classic PRNG.

Preserved Canvas, monotonic timing, CAM/public API, 2–10 seats and keyboard/touch/standard-gamepad input. `getState` adds stage/rules, demo `{active,phase,phaseTime,phrase,stage,resolved}`, Tour index/records/totalScore and per-note `responseLanes`; original `lanes` remains DJ call. Parent has production selector/API handoff for native UI scenarios. No production test accessor or external runtime dependency was introduced.

## Remaining limits

Parent must inspect all four scenes and ten seats at desktop 1440×900, portrait 390×844 and landscape 844×390; fix concrete readability/layout failures before acceptance. Keyboard/touch emulation, actual local image/audio resource success and browser console/network health are parent-owned. Physical touch/controller timing, hardware latency, audio-by-ear, measured FPS and subjective target rating remain unverified. Optional audio file fetch can be unavailable under `file://`; synthesis continues. Existing host configure remains lobby/pre-round, not seamless active seat joining. Multiplayer remains not integrated/authenticated; no online transport is claimed.


## Review fix round 1 — Watch action availability

Independent review identified P2: collapsing the title hid the only visible Start. Added `#watchBar` with Return and `#watchStartBtn`, bounded to the viewport with safe-area offsets and 44px targets. Both title and Watch Start use the same `startFromGesture` function: unlock audio, create a fresh real session and focus Pause. Watch opens with focus on Start; Return focuses title Start; dismissing settings while watching restores focus to Watch Start. Starting or restarting the demo hides the whole action bar.

The new production-runtime regression was first run red (missing Watch Start focus/action), then green. It advances real demo bots, clicks the new DOM handler, checks countdown/fresh zero stats and lives/audio unlock, verifies the action bar is hidden, and checks focus through Watch→Start and Watch→Return. Fresh command `node --test tests/royal-scratch-match-worlds.test.mjs`: **19/19 passed**. Smoke/archive and scoped diff checks passed. The unchanged 47 retained tests were not rerun for this isolated action fix; the earlier full65 evidence remains labeled in `worlds-evidence.json`. Parent owns the new real UI Watch→Start assertion and pending screenshots.


## Screenshot fix round 2 — responsive feedback and review layout

Inspected the actual first-run Chromium images at `/workspace/scratch/89700bddec30/scratch-browser-1/`: landscape Mirror response, landscape rehearsal review and portrait Mirror demo. Those screenshots attest source `ec7457200e5d22f2881517fadefef5078a72294633b7b309af0ac4a949a375bb`; parent reports the first browser run passed 252 combined checks (129 Ballistix, 123 Scratch), with zero runtime/console/request errors. Passing mechanical checks did not conceal the concrete pixel defects: landscape PERFECT was behind the topbar, the large review heading/instructions overlapped HUD/buttons, stale canvas miss feedback remained underneath, and portrait demo status was clipped.

Fixed causes: compact canvas rating/detail are anchored to the cached actual topbar-to-highway gap (140px topbar bottom → 158px rating baseline / 172px detail, before 180px highway in the recorded landscape); rehearsal review uses a dedicated bounded text panel centered between measured topbar bottom and practice-action top, with responsive title/detail sizes and relayout on resize; entering review clears transient hit text/flash/shake. Leaving review clears its layout styles. Narrow title status now says DEMO · LISTEN / ECHO / GET READY, since the stage identity and mechanic are already displayed in the title. The prior Watch Start action/focus fix is preserved.

Three new targeted tests failed before the edits and passed afterward: measured landscape canvas text positions, stale-feedback clearing/review midpoint bounds and exit cleanup, and compact narrow demo labels. Fresh `node --test tests/royal-scratch-match-worlds.test.mjs`: **22/22 passed**; smoke/archive and scoped diff checks passed. No unchanged timing suite repetition. Parent owns fresh exact-source screenshots and added DOM checks for status clipping and review placement; current-source visual acceptance remains pending, not inferred from the VM tests. No new startRound/endRound dependency was added; resize calls the guarded review layout helper.
