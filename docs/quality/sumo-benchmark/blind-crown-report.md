# Blind Crown — Sumo benchmark upgrade

Status: implemented as Nightfall v1.6.0. Focused verification: 31 Node tests pass. No engine rule or bot retuning. No claims of subjective parity, new browser pixel validation, hosted multiplayer or physical-device validation.

## Source-grounded comparison

Read `blind-crown-brief.md`, binding benchmark spec, repository editing/SDK guidance, game README/source/tests, and Sumo's `app/ui.js`, `controls.js`, `style.css`, `audio.js`, `core/settings.js`, `session.js`, `sim.js`, `quality.js`.

Sumo's setup carries named visual player identity and arena/rule choices into play; settings validate bounded data and separate match options from access/audio. Its input polls gamepads and resets state around lifecycle changes; its session supports deterministic replay separate from rendering. Its presentation pairs identity, action, impact and result feedback with useful match flow.

Blind Crown already had three original diorama environments, matching armored portraits, opt-in bounded synthesized cues, reveal/recoil/impact effects, reduced motion, persistent match/camera preferences and four retained cameras. Its engine already filters rival coordinates/aim during simultaneous private planning, supports seeded bot matches, prevents late movement and resolves mutual hits. The existing local quality pass already added adjusted-placement messages, private own markers, Classic endpoint scaling, Precision's no-guide constraint and extensive camera/privacy/rules regressions. Those strengths are retained.

Observed gaps: results listed only three contestants; players could not examine a completed arrow lane or learn why their shot hit cover; own arrows were difficult to follow in a crowded volley; no gamepad, volume preference or high contrast; setup identity lacked a live portrait/name pairing; the secondary rail always consumed arena width and the desktop frame budget allowed controls below the viewport. These specific gaps shaped this revision.

## Changes by benchmark category

1. **Playable flow:** setup portrait/name preview and arena/contestant/planning-time/rules summary. Full standings show every contestant's hits/points, champions first, living contestants before eliminated, deterministic seat ordering for equal scores. Winner copy explains existing last-survivor/round-limit/total-wipe rules. Explicit end-match/setup route in Settings; restart/rematch preserved. Help explains tactical review and gamepad controls. Contenders/Chronicle are an optional disclosure. Removed rule-engine/server implementation wording from live privacy banner.
2. **Player control:** standard gamepad left stick/D-pad movement, right stick/shoulders aim, A lock/unlock, X/Y mode, Start pause; dead zone, rising-edge actions, disconnect neutralization and release-to-rearm after lifecycle resets. Keyboard P/Escape pause. Lock action remains available when a plan is sealed, while movement/aim remain frozen. Enlarged banner-color targets; existing independent touch movement/aim remains intact.
3. **In-play presentation/feedback:** highlighted own-arrow trajectory and landing with contrast underlay in overhead/isometric, inside existing world transforms. Timed own hit/cover/boundary and incoming-hit text in all cameras only after the arrow's actual finish time; no early result during planning/reveal. Existing artwork/particles/camera modules preserved. Reduced motion adds no decorative animation. Desktop stage budgets account for volley and aftermath controls; secondary panels are hidden by default. Completed-round review action appears after results; review/end-match actions otherwise live in Settings.
4. **Settings/access:** validated persisted master volume and high contrast; strict boolean reduced-motion loading rejects malformed stored flags. Volume zero creates no audio resources; sound remains off until explicitly enabled in the current page session. Access/camera changes apply immediately; existing match options remain next-tournament-only. Storage failures continue to be caught.
5. **Gameplay/replay learning:** a local paused tactical review keeps detached snapshots of completed results/final only (maximum 24 rounds), never lobby/planning/reveal/volley snapshots. Pick any completed round, scrub 0–1.7 seconds, see numbered archers/arrow heads, actual cover/boundary geometry and hit explanations. Only contestants who fired in that round appear on the diagram; previously eliminated archers do not become phantom actors. Review uses current engine shot geometry without altering the match, RNG or Precision help rules. Review history clears on restart/rematch/setup; unavailable during room play.
6. **Engineering:** embedded pure CrownTactics/CrownPad helpers plus small coordinator handlers within the runnable standalone; no dependencies or external assets. New behavioral tests use the actual pure modules, engine and real coordinator/input in a minimal DOM/canvas harness. Existing six protected module hashes and untouched v1.4 archive still pass. Version, manifest, changelog, current source attestation and standalone byte/hash assertions updated.

## Files changed

- `games/blind-crown/source/index.html`
- `games/blind-crown/README.md`
- `games/blind-crown/CHANGELOG.md`
- `games/blind-crown/manifest.json`
- `games/blind-crown/tests/standalone.test.mjs`
- `games/blind-crown/tests/presentation/test_static_http.py` (version expectation only; not run)
- `games/blind-crown/tests/sumo-benchmark-verification.json` (new current-source evidence)
- `tests/blind-crown-sumo-benchmark.test.mjs` (new scoped regressions)
- This report.

No shared/catalog/Royal Sumo/original-archive files modified. No commits/pushes. Historical quality/Nightfall evidence remains bound to its recorded hashes and is explicitly identified as historical in README.

## Verification

`node --test games/blind-crown/tests/standalone.test.mjs tests/blind-crown-quality.test.mjs tests/blind-crown-sumo-benchmark.test.mjs`

Result: **31 passed, 0 failed**, including inline classic-script compilation, exact standalone hash/bytes, original engine/archive preservation, all map/camera geometry/privacy and existing seeded 2/4/10-contestant simulation regressions. New tests cover rejection of incomplete snapshots, detached mutual-hit outcome reports, bounded/cleared history, all-map Classic/Precision review, full standings, malformed preference validation, pad neutral/edge/disconnect gating, real coordinator pause/review/scrub/rematch/setup lifecycle, keyboard lock/unlock, and gamepad lock/unlock/pause/resume-held-stick neutralization.

Initial new feature tests failed because the tactical/gamepad modules were absent. The real input/coordinator regression then caught that an edit-only gate prevented unlocking a sealed plan; separating lock permission from movement/aim permission fixed it. Review selector options are verified numeric so malformed option construction cannot silently prevent round selection.

Current standalone: 188322 bytes, SHA-256 `9de02410af76047081cdfff3fe19a0e70641c75a31ae9ded5f7eef0831b0f681`.
Original v1.4: SHA-256 `496131ad8031a58b8b2ec78cc1aace73f57ab1ca0646271b383bf48bb108c462`.

## Remaining limitations and regression watchpoints

No new Chromium launch attempt: the task brief documents local startup `socket() failed: Operation not permitted`, and cloud WebGL2 is unavailable. Updated CSS/review pixels need parent browser checks at 1365×900, 390×844 and 844×390; the VM harness proves behavior, not layout or perceived game feel. Existing browser matrix is historical evidence, not evidence for this source hash. Experimental 3D, audio by ear, real gamepad devices, Safari/physical phones and separately hosted multiplayer remain unverified.

Watch narrow final overlay and scrollable full standings; dialog stacking when opening review from Settings; review close keeping Settings paused; remaining page viewport fit during final/aftermath; contrast of numbered review lanes with many crossing arrows; and pad mapping on physical controllers. Own-arrow graphic highlight applies to overhead/isometric; first/third retain protected camera rendering with universal timed outcome text. Review is a completed-round analysis tool, not an editable replay or seeded restart mode. Parent owns generated catalog/source serving/build/publication gates.
