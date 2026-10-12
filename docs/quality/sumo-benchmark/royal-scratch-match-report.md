# Scratch Match — Sumo benchmark implementation report

Date: 2026-10-12. Runtime: **v0.6.0 Crown & Cadence**. Scope: Scratch Match only, existing offline Canvas/Web Audio standalone, 2–10 contestants and default one local human plus bots. The supplied v0.5 archive is unchanged. No Royal Sumo, shared catalog, dependency, transport or other game files were modified by this subtask.

## Source-grounded comparison

Read the binding design, root AGENTS/EDITING/GAME_SDK, Scratch Match source/guides/tests and actual Sumo `app/ui.js`, `controls.js`, `style.css`, `audio.js`, `core/settings.js`, `session.js`, `sim.js`, `quality.js`.

Sumo's UI provides intentional title/setup/pause/results routes, grouped persisted validated preferences and progressive advanced controls. Controls unify touch/keyboard/gamepad, clear held state when hidden, ignore keyboard repeat and use Start edges. Audio uses gesture unlock, active-voice limits, scheduling and semantic action events. Session explicitly separates a fresh seeded match from same-seed replay. Its renderer/simulation supplies distinct arena/character/action cues; reduced-motion/flash settings and the quality governor address access/performance. These are code findings, not a physical-device comparison or proof of subjective parity. Sumo requires WebGL2 and does not implement the authenticated online transport.

Scratch's previous quality work already supplied strong monotonic timing, hidden-page freezing, independent gameplay RNG, legal timed bot intents, two-lane chord completion, audio lookahead/stale suppression, linear notes and epoch-protected results. Retained the timing windows, score/combo/life rules for Crown Match, bot probabilities, existing camera-code math and input/configuration API. Actual gaps were a seconds-based countdown, no explicit pause/settings/help recovery, no persisted access tools or gamepad, limited replay/practice affordance, sparse generic hall/performers and timing feedback without a persistent visual reference.

## Implemented changes by category

| Category | Concrete player-facing change | Implementation/evidence |
| --- | --- | --- |
| Playable flow | Four-beat 96 BPM count-in; explicit pause/resume, soundcheck/help, setup return and clean results routes; compact match/rehearsal explanation; developer transport text removed from setup. | `setPaused`, `openSettings`, `returnToMenu`, reason-aware `freezeClock`; deferred finishing callbacks recheck gameplay blocking and retain round-generation protection. |
| Player control | Standard gamepad A/B/X/Y chords and Start; keyboard duplicate/repeat guards; pointer capture ownership and blur neutralization; held controller buttons require release after connection/reconnect/resume; 44px topbar/count targets. | `pollGamepad`, `clearHeldInput`, guarded pointer/keyboard handlers. Existing public lane routing and CAM behavior retained. |
| In-play presentation | Gold DJ call/cyan echo labels; linked two-rune chord rails including the remaining JOIN cue; signed timing meter; reactive mixer meters and vinyl markers; castle curtain folds, torch niches, gallery rails, speaker towers, gold proscenium and faceted stage apron; performer costume silhouettes/badges/name tags/recovery faces; DJ moves beside the highway in compact/ten-seat views. | `drawNotes`, `drawTimingMeter`, `drawDJ`, `drawBackground`, `drawStage`, `drawDummy`, `drawDummies`. Cosmetic effects remain separate from gameplay RNG. |
| Settings/access | Validated persisted volume, mute, reduced motion, vibration, beat guide, difficulty, contestant count and mode. OS reduced-motion default. Advanced local ±200 ms timing correction with reset and plain explanation. Focus outlines and settings focus/return handling. | Storage reads/writes guarded; bounded numeric/enum validation; settings do not restart the active phrase. Reduced motion removes shake, full-screen flash, particles and decorative movement while retaining note travel. |
| Gameplay/replay | Rehearsal removes elimination and lets the player retry the exact phrase, advance deliberately or finish; scores/misses accumulate across attempts. UI New match chooses a fresh seed; Replay same set reuses the seed. Results expose accuracy and recent successful-note median/early/on-time/late counts. | `repeatPracticePhrase` restores phrase RNG state; `reviewPractice`, `advancePracticePhrase`, `newSession`, `replaySession`. Timing correction shifts local judgment **and** its expiry; bots and other human slots use original timing. |
| Engineering | 18 new executable production-script regressions plus all 29 existing rhythm tests, syntax/smoke/archive checks, v0.6 manifest/readme/changelog and byte-bound provenance evidence. Audio cap is 64 active oscillators; automatic presentation starts do not enable audio. | `tests/royal-scratch-match-sumo-benchmark.test.mjs`, extended owned VM boundary harness, `tests/sumo-benchmark-evidence.json`. Multiplayer status remains not-integrated. |

## Files changed

- `games/royal-scratch-match/source/index.html`, `source/README.md`.
- `games/royal-scratch-match/README.md`, `CHANGELOG.md`, `manifest.json`, `integration/README.md`.
- `games/royal-scratch-match/tests/runtime.mjs`, `smoke.mjs`, `README.md`, `QUALITY.md`; new `sumo-benchmark-evidence.json`.
- New `tests/royal-scratch-match-sumo-benchmark.test.mjs` and this report.

## Verification

`node --test tests/royal-scratch-match-quality.test.mjs tests/royal-scratch-match-sumo-benchmark.test.mjs`: **47/47 passed** (29 retained, 18 new). New tests exercise real inline production code with controlled DOM/Web Audio/clock boundaries: overlapping pause/hidden freeze, CAM clock, four beat count-in, latency judgment and both signed miss deadlines, unaffected bot timing, settings persistence/malformed/denied storage, no active-phrase restart, exact practice retry/advance and survival beyond eight misses, gamepad chords/hold/reconnect/Start edges, blur/capture cleanup, seeded replay/new set, abandoned stale results, paused finishing, reduced-motion effects, unavailable gamepad API and automatic-start audio silence.

`node games/royal-scratch-match/tests/smoke.mjs`: passed. Parses the full production inline script with `vm.Script`, checks retained public integration/control markers and offline dependencies, and verifies exact original archive SHA-256. `git diff --check -- games/royal-scratch-match tests/royal-scratch-match-sumo-benchmark.test.mjs`: passed.

Current runtime SHA-256: `580417dc35c6cd5514354e6b90ac00586f4ce6ce6224a3e21f21f7920b55c1db`. Original archive SHA-256 remains `6c58614db13495393512e9f69496da686dc2962b3cabd49d71680493170cbb03`.

Parent owns generated catalog refresh, shared/global gates, browser checks, integration and publication. Shared lifecycle extraction harness requires a `gameplayBlocked: () => false` boundary stub for the production finishing callback; no production typeof workaround was left for that harness.

## Remaining limits and regression watch points

No browser startup retry, screenshot acceptance, audio-by-ear, physical touch/controller test, hardware latency measurement or FPS measurement is claimed here. Local Chromium process startup is known blocked by socket permissions; cloud WebGL2 is unavailable, although this game is Canvas and the parent plans browser checks through the supported route. Stage/DJ and 44px topbar changes need actual 390×844/844×390/1365×900 review, especially ten-seat landscape geometry, the chord JOIN cue and timing meter clearance above controls. Unusual saved CAM transforms can still intentionally move the playfield outside the viewport.

Audio remains lightweight local synthesis rather than authored music. Count-in is BPM based but sampled by the foreground clock/frame scheduler; a foreground stall skips expired counts rather than replaying a burst. Watch actual sound/note alignment on Bluetooth/mobile and handoff after pause. The manual latency correction and recent successful-note median cannot establish hardware calibration and omit missed inputs; use them as rehearsal guidance. Timing sample retention is bounded to the most recent 256 successful notes, while practice scores/miss counters accumulate.

Only the first connected standard-mapping gamepad controls slot 0; no nonstandard controller remapping or controller-only settings navigation was added. Existing `configure()` still reinitializes players and is a lobby/pre-round operation. Existing public numeric inputs are clamped, not authenticated network validation. This upgrade does not add online transport, seat credentials, reconnect, network sequence rejection or a full accepted-input replay log. All Crown Match mechanics and local/bot capacity remain intact; rehearsal intentionally has no competitive crown ranking.
