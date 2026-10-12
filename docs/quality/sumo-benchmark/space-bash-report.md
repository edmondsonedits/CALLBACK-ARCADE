# Space Bash v1.14.0 — Sumo benchmark implementation

Space Bash has been upgraded in place within its existing standalone Canvas 2D renderer and 1/120-second fixed-step simulation. This is a source-grounded quality upgrade; it does not claim subjective visual/game-feel parity or hardware playtesting.

## Comparison findings

Read the binding benchmark spec, game/source guides, existing source/harness/quality/stress checks, and Royal Sumo's `app/ui.js`, `controls.js`, `style.css`, `audio.js`, `core/settings.js`, `session.js`, `sim.js` and `quality.js`.

Sumo separates title/setup/HUD/pause/help/results, exposes validated persistent settings and contextual controls, supports standard gamepads, records tie-aware standings, separates simulation randomness from presentation, and has arena/session variety. Its procedural characters/environment effects improve anticipation, identity and impact readability. Its quality governor addresses WebGL resolution; Space Bash already caps Canvas DPR at 1.5 and has no need to copy a WebGL renderer/governor.

Space Bash's prior quality work already provided swept height-aware impacts, reciprocal crate ownership cleanup, non-extending TNT fuses, unsupported-crate retirement, safety-aware CPU routing, repeat-safe keyboard actions, touch/pause cleanup, local contrast, blast/fuse cues and natural-match stress checks. Those mechanics were retained. The meaningful remaining gaps were automatic boot into play, limited match presentation/options, no gamepad or independent aim, nonpersistent settings with contestant changes silently restarting, immediate CPU grabs, flat astronaut/deck rendering and a compressed landscape playfield.

## Changes across the six categories

| Category | Implemented changes |
| --- | --- |
| Playable flow | Flight briefing/setup before gameplay, explicit Launch, flight manual, pause button/Escape/Start, setup/help return routes, held complete match results listing every seat with equal-crown ranks, rematch/setup actions. Default round transitions, timeout health ranking, original first-seat health tiebreak and no-survivor no-crown remain. |
| Player control | Standard pad left stick/D-pad movement, right-stick aim, X grab/throw, B kick, A jump and Start pause. Action edges reject held-button entry across menus; pad disconnect neutralizes its movement. IJKL aim can remain independent of movement. Existing touch ownership/repeat gating is preserved. Native menu arrows/Space are available, header targets are 44px and menus have visible focus states. |
| In-play presentation/feedback | Full throw path integrated with existing gravity/drag/clamp, landing/GAP and fuse-first labels; rivals may intercept. Supply-drop target footprints, contextual grab/fuse/cooldown/airborne button text. Numbered pressure suits, visors, backpack, gloves/boots, articulated moving/carrying/throwing limbs, contact rings and hit recovery cue. Deck hull sides, bolts/service seams and hole-adjacent safety hatching. Desktop deck cap 700→900; short landscape controls separate to corners and projected clear-middle deck grows ~267→413px at 844×390. |
| Settings/access | Validated storage with exception-safe fallback for crew, difficulty, deck rules, volume/mute, reduced motion, high deck/fighter contrast and swapped touch hands. Crew/difficulty/rules apply only with explicit launch/restart; edits preserve active state. Access/audio settings apply immediately. Reduced motion follows the OS default when unset and removes particles/wobble/flash. Procedural audio waits for a gesture, caps concurrent voices at 12 and disconnects finished audio nodes. |
| Gameplay/replay depth | Flight school uses safe normal cargo, passive moving CPU targets and a one-crown session; Volatile cargo starts with an explosive supply mix. Standard remains 90 seconds/first to three. Nearby CPU grabs now wait for their reaction interval, and a grab inserts a bounded throw-decision interval; urgent held TNT release and safe routing remain. Cosmetic particle/animation RNG is separate from gameplay RNG. |
| Engineering evidence | Added 18 benchmark regressions against the real inline script. Existing 40 checks preserved (one landscape geometry fixture now reflects side-control clear space). Active version, manifest, README, CHANGELOG and smoke assertion updated to 1.14.0. Current active/archive hashes are in `games/space-bash/integration/provenance.json`. Original bytes untouched. |

No new runtime dependency, network service, online claim, shared framework or engine rewrite was added. `window.SpaceBash` and `window.CallbackCamera` remain available; `getState()` adds the active rule, and default boot phase is now `setup`. `setPlayers()` still explicitly restarts a bounded 2–10-seat match without silently applying pending rule/difficulty choices. Existing CAM code format/settings are unchanged.

## Files changed

- `games/space-bash/source/index.html`
- `games/space-bash/manifest.json`
- `games/space-bash/README.md`
- `games/space-bash/CHANGELOG.md`
- `games/space-bash/integration/README.md`
- `games/space-bash/integration/provenance.json` (new source-bound evidence)
- `games/space-bash/tests/harness.mjs` (optional browser-boundary settings/pad fixtures and test-only export injection)
- `games/space-bash/tests/stress.test.mjs` (landscape clear-middle geometry fixture)
- `games/space-bash/tests/source-smoke.mjs` (active version assertion)
- `games/space-bash/tests/README.md`
- `tests/space-bash-sumo-benchmark.test.mjs` (new)
- This report.

No originals/archive files, shared/catalog files, other games, commits or pushes were changed by this task.

## Verification

- `node --test tests/space-bash-sumo-benchmark.test.mjs tests/space-bash-quality.test.mjs` — **58 passed, 0 failed** (18 benchmark + 40 existing behavior/stress/render-path checks).
- `node games/space-bash/tests/source-smoke.mjs` — passed; original SHA-256 remains `e6fc6342764b743bc125c0519b2f61d9384411b69b563799e26a10ac834b46d8`.
- Inline script parsed by `new vm.Script(...)` — passed.
- Scoped `git diff --check` — passed.
- Provenance digest comparison against both manifest source paths — passed.

Test-first evidence: the initial 12 desired-feature checks were red against the existing source. Cosmetic-RNG isolation, native menu keyboard navigation, urgent-TNT preview and landscape deck size each failed before correction. Other coverage verifies established behaviors on the new paths. The full-source VM substitutes only browser boundaries; no test export is shipped. It verifies setup/menu gating, safe persistent validation, stage-only match choices, all rule modes, CPU grab reaction, pad action edges/aim/held release/disconnect, keyboard independent aim, predictor agreement with real crate integration, reduced-motion gameplay preservation, gesture audio gating and all-seat results/rematch/menu routes.

Natural default matches still reach exactly three crowns at 2, 4 and 10 seats and remain terminal afterward. Existing repeated rematch and 10-seat action stress checks pass. With the same injected gameplay seed, normal/reduced-motion runs produce identical fighter/crate/crown state after 30 simulated seconds. Renderer call paths include carried TNT throw guide, airborne cargo, destroyed deck panels and ten fighters, and do not mutate simulation state.

Parent owns whole-repository gates, generated catalog updates and available rendered browser checks. The shared legacy fragment lifecycle harness needs the newly real `rules`, `clearInput` and `showResults` dependencies stubbed; the parent was notified. This task did not edit that harness or run broad repository gates.

## Remaining limitations and regressions to watch

- Local browser startup was already known to fail `socket() failed: Operation not permitted`; no repeat bypass attempts were made. No browser screenshots, physical touch/controller session, audio-by-ear or device frame-rate measurement were performed here. VM rendering is a JavaScript call-path check, not pixel QA.
- Check 390×844 portrait and 844×390 landscape in a supported browser: header targets, long briefing/settings scrolling, swapped touch controls, lower deck hull versus the integrity meter, and character/label crowding at ten seats.
- Check real standard pad reconnection and first release after pause/countdown. Different controller mapping conventions are not supported beyond standard mapping.
- Throw marker predicts first deck-height crossing using current launch physics, not collision avoidance or a guaranteed hit. Urgent TNT may explode sooner and is explicitly marked FUSE FIRST.
- Flight school intentionally cannot collapse the deck through explosives; completion is by elimination kicks/throws or health timeout. CPU targets still move and collide. Practice is a learning variant rather than invulnerability.
- Existing equal-health timeout ranking favors the first seat; this historical rule is preserved rather than silently rewritten.
- No custom fighter names/looks, seed UI, replay viewer, multi-arena cup or resolution governor was added. The game stays focused on its existing orbital brawler identity.
- Online multiplayer remains not integrated and unverified. Source evidence is not a readiness attestation.
