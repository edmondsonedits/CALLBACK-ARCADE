# Royal Twisted — Sumo benchmark upgrade

Date: 2026-10-12. Active version: **0.6.0**. Scope: Twisted only and its uniquely named root behavior test. The supplied v0.5 original, v0.4 archive, bundled Three.js files, Royal Sumo, shared integration/catalog files and public camera defaults are unchanged. No commit, push or publication was performed by this task.

## Source-grounded comparison

Read the task brief and binding design spec, repository instructions, editing/SDK guidance, Twisted's standalone source, guide, prior review and runtime tests. Read Sumo's `app/ui.js`, `controls.js`, `style.css`, `audio.js` and `core/settings.js`, `session.js`, `sim.js`, `quality.js`.

Sumo has a deliberate title/setup/play/help/pause/results flow, clear rematch routes, validated grouped preferences, bounded procedural sound, seeded gameplay simulation, named session state and expressive map/character feedback. Its settings derive reduced-motion defaults from the system, its control layer treats input edges and holds separately, and its quality governor handles render resolution independently of gameplay. Sumo's arena/session variety is broader than Twisted's one-keep survival game. Online transport is not implemented in the Sumo reference; none was added here.

Twisted already had strong mechanics from its prior review: 120 Hz fixed simulation, conservative arrival-gap enforcement under acceleration/recovery, one collision outcome per rod/seat, 130 ms jump buffering, independent duck sources, fair imperfect bot plans, seven-hit elimination, pause-aware rounds and tie overtime. It also already preserved the selected P1-focused camera and bounded knockback. Duplicating or numerically retuning these mechanics would add risk without fixing the actual gaps.

Actual gaps were automatic startup, a rematch hidden inside Settings, no durable preferences or meaningful match statistics, limited anticipation beyond one current action label, gamepad pause omission, and largely identical character movement states. Those gaps drove this implementation. This is a substantial source-grounded improvement, not a claim of subjective parity or hardware playtest superiority.

## Changes by benchmark category

| Category | Player-visible and behavioral changes |
| --- | --- |
| Playable flow | Explicit setup with objective, contestant count, fair rival levels and rhythm choices. Dedicated contextual help and visible pause button. Pause offers Resume/Setup. Match results name the champion, show tie-aware ranks for every contestant, and expose direct Replay seed/Setup actions. Existing countdown, seven-hit rounds, regulation and overtime remain. |
| Player control | Gamepad Start pauses/resumes on edges and starts a default setup; polling also runs while simulation is gated. Explicit replay neutralizes gamepad actions until release. Keyboard input leaves native fields alone, preserves arrow/W/Shift actions when an action button has focus, and supports native keyboard/assistive button activation without doubling pointer actions. Help clears held input and returns to explicit Resume. Captured duck pointers and public local/remote hooks remain. |
| In-play presentation | Next-rod filling meter and following-action preview complement the existing NEXT/NOW distinction. The 460 ms NOW threshold and all collision constants remain. Clean clears/streak milestones and missed-action feedback add outcome legibility. Narrow tower slit windows, pennants and braziers add atmosphere away from the running surface. Rivals receive helmets/plumes; colored ground rings reinforce identity. Named running/air/duck/landing poses follow simulation posture; character shadows stay on the deck when jumping. |
| Settings/access | Safe validated persistence for contestants, rival difficulty, rhythm, graphics, haptics, mute, volume, reduced motion and best clears/streak. Contestant/rhythm edits stage until explicit restart. Existing camera-code persistence remains separate. Reduced motion suppresses banner sway, decorative body/head wobble, hit flash/shake, landing squash, particles and rings while preserving functional movement. Settings retain native targets and gain labels/focus styles; setup/help/results use named dialogs. No sound graph is created before an enabling gesture; completed sound nodes disconnect and zero volume schedules no voices. |
| Gameplay/replay | Mixed crown runs plus jump-only and duck-only practice rhythms retain the same physics, bot path and seven-hit elimination. An explicit seed governs hazard pattern/cooldown and bot-choice RNG independently of cosmetic/noise randomness. Same seed/rules/ownership/input trace yields repeatable gameplay choices. Match stats retain clears, low/high hits, best streak and survival time across rounds; survival advances only during active fixed simulation. Standings use shared ranks for equal crowns. |
| Engineering | 18 new executable cases, existing Twisted regressions retained, module syntax/smoke checks, immutable-upload integrity checks and source-bound JSON evidence. Actual bundled Three.js constructs the procedural world/characters in a Node case, checking finite geometry and grounded shadows; this is not a shader/pixel test. Removed fighter geometry/material resources are disposed on contestant rebuild. |

No `TUNING` or `AI` numeric constant, helix layout, selected **CAM-3R-23-U**, camera follow/FOV rules, setback/recovery bound, public existing method name or dependency version changed. Additive `RoyalTwisted.getSession()` exposes current seed/rhythm/ranks/statistics even when debug HUD is disabled. Runtime remains a standalone locally bundled Three.js module page.

## Files changed

- `games/royal-twisted/source/index.html`
- `games/royal-twisted/{README.md,CHANGELOG.md,manifest.json}`
- `games/royal-twisted/tests/{README.md,source-smoke.mjs,browser-quality.mjs}`
- `games/royal-twisted/tests/evidence/{sumo-benchmark.json,sumo-benchmark-tests.txt,sumo-benchmark-new-tests.txt}`
- `tests/royal-twisted-sumo-benchmark.test.mjs`
- This report.

Manifest provenance now accurately describes the active local Three.js bundle and preserved import, removing its stale CDN description. Original/archive hashes are independently checked. Existing historical screenshot/browser reports are retained and explicitly excluded as v0.6.0 evidence.

## Verification

The initial 12 benchmark tests all failed against the baseline (missing behavior/functions and input/staging assertions), then passed after implementation. Expanded coverage totals 18 new cases. Exact final commands/results:

- `node --test tests/royal-twisted-sumo-benchmark.test.mjs tests/royal-twisted-quality.test.mjs tests/royal-twisted-camera.test.mjs` — **93 passed, 0 failed** (18 new, 72 existing quality, 3 camera).
- `node games/royal-twisted/tests/source-smoke.mjs` — passed; active v0.6.0/API markers and immutable original/archive SHA-256 checks.
- Extract the inline module to `/tmp/twisted-current-module.mjs`, then `node --check /tmp/twisted-current-module.mjs` — passed.
- `node --check games/royal-twisted/tests/browser-quality.mjs` — passed; fixture updated to Start from setup and desktop 1365×900, but browser execution was not run.
- `git diff --check -- games/royal-twisted tests/royal-twisted-sumo-benchmark.test.mjs` — passed.

Full repository/catalog/build/publication gates belong to the parent. The supplied runtime limit was respected: no repeated Chromium startup attempt, permission bypass or fabricated browser pass. The evidence JSON binds these automated checks to the final source bytes; it is quality evidence, not verified multiplayer evidence.

## Remaining limits and regressions to watch

- Browser WebGL/pixel inspection, shader compilation, the requested 390×844 / 844×390 / 1365×900 visual matrix, physical gamepad/touch devices and audio-by-ear remain pending. Local Chromium startup is blocked by the known socket restriction; cloud WebGL2 is unavailable. Node construction validates Three.js API use, not rendered appearance or performance.
- At narrow widths, the round card is hidden and round number moves into the timer to leave four 44 px top buttons usable. Parent browser review should check crowd readability, the taller next-rod cue, portrait header, landscape feedback and modal scrolling. Decorative additions are deliberately narrow, but occlusion must be judged in the actual renderer, especially at maximum P1 setback and ten contestants.
- Existing hard-bot matches can be long; no arbitrary AI/speed tuning was made. Practice remains a survival crown session with bots, not an endless invulnerable drill.
- Seeded replay is not an event log, replay viewer or transport guarantee. Different settings, controllers or input timing can change later gameplay choices. Rival difficulty applies immediately only to future sampled plans; contestant/rhythm changes are staged for restart.
- Preferences fall back silently if storage is denied. Best records are local to the device/browser, not authenticated achievements.
- Online room transport, seat authentication, rate limiting and multiplayer verification remain absent/in-progress. Renderer dependency and original licenses are retained unchanged.
