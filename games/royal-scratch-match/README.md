# Royal Scratch Match

Royal Scratch Match is a medieval call-and-response rhythm knockout. The Royal DJ performs an A/B/X/Y phrase, then contestants repeat the same pattern as notes approach the timing line. Misses remove lives; later phrases increase tempo, phrase length, syncopation, and chord pressure.

This folder contains the complete standalone v0.6.0 Crown & Cadence build. The exact supplied v0.5 attachment remains in `source/archive/`.

## Current status

- Source: imported and runnable as a standalone HTML game.
- Contestant slots: 2–10 total.
- Default local mode: one human in slot 0, all remaining slots bots.
- Additional human slots: supported by JavaScript input hooks, but there is no CALLBACK room-code transport yet.
- Multiplayer readiness: not-integrated. The existing input API is not authenticated online multiplayer.
- Lifecycle: experimental. Source import is complete, but repository checks do not substitute for human playtesting.

## Run

Open source/index.html in a modern browser. The file is self-contained and has no external runtime dependencies.

Useful query parameters:

- ?players=10 — configure ten contestant slots.
- ?scenario=ten-player&players=10 — auto-start the ten-player presentation scenario.
- ?scenario=mobile-ui — auto-start for UI inspection.

## Gameplay

1. A four-beat musical count-in at 96 BPM prepares the court. The Royal DJ plays a short phrase first.
2. Watch the four colored note lanes and remember the sequence.
3. During YOUR TURN, press A/B/X/Y when approaching notes reach the glowing hit rings.
4. Correct timing builds score and combo; misses remove lives.
5. Phrases become faster and longer. Later phrases can include two-button chords.
6. A contestant with no lives is eliminated. Final standings use survival/elimination order and score. Results show accuracy, recent median timing and early/on-time/late counts. Start a fresh set, replay the same seeded set, or return to setup.

**Rehearsal** keeps all contestants alive. At the end of each echo, repeat the exact phrase, advance to a harder phrase, or finish to review your attempts. Scores and misses accumulate across attempts; there is no rehearsal crown ranking.

The standalone menu supports 2–10 contestant slots. The intended party configuration includes one local human with as many as nine bots.

## Local controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| A lane | A button | D or Left Arrow |
| B lane | B button | F or Down Arrow |
| X lane | X button | J or Up Arrow |
| Y lane | Y button | K or Right Arrow |
| Replay same set | results button | R during a session |
| Pause/settings/help | pause button | Esc or P |
| Mute | sound button | M |
| Fullscreen | fullscreen button | browser-dependent |

A standard gamepad uses face buttons 0/1/2/3 for A/B/X/Y and Start for pause/resume (or a fresh set from setup/results). Held buttons require release after connection, blur, pause or a menu transition.

Mobile controls disable page scrolling and use four large touch targets aligned with the timing lanes.

## Soundcheck and access

Soundcheck is available from setup or pause. Master volume, mute, vibration, reduced motion, beat guide, difficulty, contestant count and match/rehearsal choice persist locally with validated defaults. Storage failure never prevents play. Reduced motion defaults to the OS preference and removes shake, full-screen flashes, particle bursts and decorative movement; note travel remains musical.

Advanced timing correction is bounded to ±200 ms. Positive correction compensates consistently late local taps and also shifts the local miss deadline; it never changes bot timing, note travel or remote human inputs. Use rehearsal and recent successful-note median timing for manual soundcheck. This is not an automatic hardware-latency measurement.

## Bot behavior

Any configured slot not listed in humanPlayers is controlled by the built-in bot resolver. Bots use phrase pressure, chord penalties, difficulty, and per-slot skill variation to decide each note. Successful bot intents use the shared local lane judgment helper at bounded timestamps; misses expire after the timing window. This is still not the future server-validated input path described in docs/GAME_SDK.md.

## Tuning locations

The game remains preserved as a standalone HTML document. Primary tuning is centralized in the TUNING object near the top of source/index.html:

- simulation.fixedDt and simulation.maxSubsteps
- round.maxPhrases, countdown, and phase gaps
- rhythm.baseBpm, bpmStep, maxBpm, event counts, and chord settings
- timing.easy, timing.normal, timing.hard
- ai.baseSkill, ai.skillSpread, pressure and chord penalties
- scoring.perfect, scoring.good, and combo tuning

Player-slot configuration lives near playerCount, humanSlots, and PLAYER_PROFILES. Runtime hooks are documented in integration/README.md.

## Modifying the game

1. Preserve a recoverable standalone source/index.html entry file.
2. Make gameplay changes in source and update CHANGELOG.md.
3. Keep required art/audio under assets/ with provenance notes.
4. Run `node --test tests/royal-scratch-match-quality.test.mjs tests/royal-scratch-match-sumo-benchmark.test.mjs` and `node games/royal-scratch-match/tests/smoke.mjs` from the repository root.
5. Perform the manual checks in tests/README.md for timing, touch layout, 2-player, and 10-player configurations.
6. If manifest.json changes, run npm run catalog:generate and npm run catalog:check.
7. Run repository checks: npm test, npm run typecheck, npm run catalog:check, and npm run build.

Do not mark multiplayer verified until the host/controller contract is implemented and hash-bound JSON verification evidence exists as required by docs/GAME_SDK.md.

## Known issues / limitations

- Only slot 0 has built-in on-screen/keyboard controls in standalone local play.
- Additional human slots require external calls to ScratchMatchAPI.press(playerIndex, lane).
- There is no room code, authenticated seat token, network sequence checking, reconnect, server rate limiting, or snapshot transport.
- Out-of-range API indices are clamped rather than rejected, so the hook is not a security boundary.
- Ordinary play uses Math.random(); an optional numeric `seed` makes phrase/bot decisions reproducible independently of cosmetic effects. `seed: null` restores ordinary randomness.
- Bot actions share local judgment; authenticated network validation remains unimplemented.
- configure() reinitializes player state; seat replacement is therefore a lobby/pre-round operation in v0.6, not a safe mid-round join/leave mechanism.
- Browser audio may require a user gesture because of autoplay policies.
- Procedural Web Audio remains synthesized rather than authored final music/SFX. A session enabling action unlocks audio; automatic presentation scenarios stay silent until sound/input is enabled.
- Fullscreen behavior varies by browser/platform.

Current benchmark audit: `../../docs/quality/sumo-benchmark/royal-scratch-match-report.md`. Source-bound automated evidence: `tests/sumo-benchmark-evidence.json`. Physical audio/touch/gamepad latency and final mobile pixels require browser/device review.
