# Royal Ballistix — Sumo benchmark upgrade

Build: **0.13.0** (`0.13.0-sumo-benchmark` in runtime state). Game-specific implementation only; no Sumo, shared catalog, archive or other game edits.

## Source-grounded comparison

Reference inspected: Sumo `app/ui.js` title/setup/pause/help/results flow; `app/controls.js` gamepad deadzone/actions and held-input reset; `app/style.css` focus targets/panels; `app/audio.js` gesture unlock, voice limits and node disposal; `core/settings.js` grouped, validated persistent preferences; `core/session.js` quick/replay/cup planning; `core/sim.js` charge/release and event feedback; `core/quality.js` active-frame-only resolution adaptation.

Ballistix already had useful qualities worth preserving: 120 Hz fixed-step simulation and substeps; lateral collision geometry; one-life scoring and epoch-guarded results; 2–10 gate scaling; bot personalities and existing difficulty; simultaneous radial-stick/Magnet/Pulse touch; cancellation/blur/key-repeat cleanup; contact/recoil, critical gates, charge arc and Pulse cooldown; independent camera/CAM public hooks.

The actual gaps were immediate countdown without setup, rule edits implicitly resetting matches, no gamepad, no persisted audio/access preferences, synthesized audio allocation from simulation without a user gesture, featureless court/identical silhouettes, no practice mode, and a Magnet target line that followed an incoming ball even while holding a volley instead of showing release aim. Sumo's multi-arena cup, seeded session/replays and adaptive renderer are more extensive than this scoped upgrade. No subjective quality-parity claim is made.

## Changes by category

1. **Playable flow:** start on a paused setup with saved gates/bot/crown summary; Start Siege and Defense Drill choices. How to Play from setup/pause; explicit resume, menu and rematch routes. Rules stage for the next start or explicit Apply & Restart; closing settings returns to setup/pause. Siege results list crowns, lives and sealed gates in sorted order. Win target offers 1, 3 or 5 crowns; classic default stays 3.
2. **Player control:** standard gamepad left-stick deadzone/remap, A catch/release, X edge counter, B run and Start edge pause/resume. Disconnect and lifecycle reset neutralize pad input; reconnect/resume requires neutral controls before held inputs can apply again. Preserve keyboard/Shift, simultaneous touch pointers and existing external APIs. Escape pauses/resumes the active game. Touch action buttons now state their actual hold/release/counter intent and top icons have 44px targets; desktop gets concise keyboard/gamepad hints.
3. **In-play presentation/feedback:** procedural shoreline foam, palms, sand speckles, crown court marking, castle turrets, numbered gate pennants and colored jackets/headwear. Gate numbers match the roster and defender numbers. A landing ring/chevron projects the most imminent incoming shot onto the human defense line, with a centered/near-contact cue. Cannon launch plans store the actual direction during their charge; the warning uses that same vector at emission. Captured-ball guides show the actual release vector and spread used by physics. Existing impact/critical/cooldown effects remain.
4. **Settings/access:** guarded persistent, validated count/size/difficulty/crown choices plus mute, stepped volume, reduced motion and high contrast. OS reduced-motion preference supplies the initial default. Reduced motion removes camera shake/recoil and decorative ball rotation/pulsing, steadies shoreline motion and limits particle counts. High contrast strengthens panels, gates, pennants and shot cues. Audio requires a user gesture, caps live voices at 16, disconnects nodes after playback and frees the budget if allocation/start fails.
5. **Gameplay/replay depth:** 60-second Defense Drill retains configured contestant count and bots but limits the court to one active ball, aims successive training shots through left/center/right lanes, prevents life loss/elimination/crown awards, and reports human catches, counters, Perfect counters, volley releases and misses. Siege keeps existing core tuning and bot behavior. Cosmetic particles use a separate RNG and shake uses time functions, so draw/effect calls cannot consume gameplay randomness. This is not a seeded replay system.
6. **Engineering evidence:** new real-script behavioral tests run through the game's owned browser-substitute harness; smoke version updated; browser tools updated to enter the new setup flow. Manifest/version/changelog/provenance updated with current standalone hash and a new scoped evidence record. Historical evidence remains clearly historical.

## Files changed

- `games/royal-ballistix/source/index.html`
- `games/royal-ballistix/source/README.md`
- `games/royal-ballistix/README.md`
- `games/royal-ballistix/CHANGELOG.md`
- `games/royal-ballistix/manifest.json`
- `games/royal-ballistix/assets/PROVENANCE.md`
- `games/royal-ballistix/tests/runtime-harness.mjs`
- `games/royal-ballistix/tests/source-smoke.test.mjs`
- `games/royal-ballistix/tests/browser-quality.py`
- `games/royal-ballistix/tests/capture-feedback.py`
- `games/royal-ballistix/tests/README.md`
- `games/royal-ballistix/tests/evidence/sumo-benchmark-checks.json`
- `games/royal-ballistix/tests/evidence/sumo-benchmark-focused-tests.txt`
- `tests/royal-ballistix-sumo-benchmark.test.mjs`
- this report

## Verification

Passed:

```sh
node --test tests/royal-ballistix-import.test.mjs tests/royal-ballistix-mobile-ui.test.mjs tests/royal-ballistix-quality.test.mjs tests/royal-ballistix-sumo-benchmark.test.mjs
```

**70 tests, 70 passed, 0 failed**, including 23 new benchmark behavior tests. The existing suite exercises complete bot matches at 2/4/10 seats, collisions at max speed, touch/API/keyboard actions, pulse timing/cooldown, capacity/overheat, cancellation and stale result callbacks. New tests cover staged setup, preference corruption/storage failure, pad axes/edges/pause/disconnect/reconnect, timed non-damaging practice/metrics/lanes, shot and release direction identity, landing projection, first-to-one crowns, cosmetics not affecting random launches, bounded gesture-only audio and allocation failure cleanup. Review found global key suppression affected native setup range/checkbox controls; two event-target regressions reproduced the issue, then passed after native input/select/textarea/contenteditable targets bypass gameplay handling and default suppression gates on accepted gameplay. Additional review exposed the focused-button edge: button movement keys remain accepted, button Space/Enter retains native activation, and Start/Resume/in-game Sound restores canvas focus for subsequent gameplay Space; three behavioral regressions cover those interactions. Inline JavaScript syntax and dependency independence are checked by the smoke test.

```sh
python -m py_compile games/royal-ballistix/tests/browser-quality.py games/royal-ballistix/tests/capture-feedback.py
```

Passed. Python caches removed. No local Chromium retry/bypass attempted; startup is known blocked by `socket() failed: Operation not permitted`. Parent plans official Pages Canvas browser inspection after publication and owns shared repository gates/catalog generation. Browser evidence is not implied by Node substitutes.

Current SHA-256 is in manifest provenance, `assets/PROVENANCE.md` and `tests/evidence/sumo-benchmark-checks.json`.

## Remaining limits / regressions to watch

- Physical-phone multitouch, real gamepad reconnect mappings, audio-by-ear and visual layout at 390×844 / 844×390 / 1365×900 still require device/browser review. Node canvas stubs establish code execution/vector correctness, not rendered beauty or pixel overlap.
- Watch new 44px header icons/roster wrapping at tight widths, menu/settings scroll reachability in landscape, shore props outside the court, and numbered pennants at ten gates. Added art is cosmetic; court and physics geometry remain unchanged.
- Saved rule edits deliberately apply on next Start or Apply & Restart. Public count/arena APIs retain their immediate semantics; API callers should still treat count changes as resets. External seat state remains the existing trusted local hook, without transport authentication or sequencing validation.
- Neutral-before-resume is deliberate for gamepad safety: a held stick/button must be released once after pause, blur or reconnect. Keyboard/touch cancellation remains covered.
- Practice is a one-ball defense exercise with existing bots and ricochets, not isolated guaranteed repeated human-hit feeding or a replay recorder. It never grants crowns. Long siege progression at crowded gates remains as before.
- Sumo's arena variety/cup, seeded replay/session and adaptive quality are not ported. No engine rewrite, imported Sumo implementation or new dependencies were introduced.
- Multiplayer remains **not-integrated**. No commits, pushes or publication performed by this worker.
