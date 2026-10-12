# Royal Twisted quality review — 2026-10-12

Review branch: `quality/royal-twisted`. Base (local checkout and remote main verified before edits): `785a15000abe11970c7b92c5f3cab197061fcedf`. Local review only; no push, PR, merge or deploy. The commit containing this report is the review head; its exact ID is supplied in the handoff.

Playable entry: `games/royal-twisted/source/index.html` (serve over HTTP with access to jsDelivr). Runtime source hash and browser conditions are recorded in [browser evidence](evidence/browser-quality.json).

## Before / after evidence

| Behavior | Baseline reproduction | Reviewed behavior |
| --- | --- | --- |
| Jump takeoff | A second request at height .01 reset velocity from 4.9 to 5.15 | Remains 4.9; only a short landing buffer is accepted |
| Overlapping duck | Releasing Shift released a still-held S | Every keyboard/pointer/gamepad/remote source releases independently |
| Controller takeover | Remote input could inherit a bot's duck indefinitely | Handoff clears the outgoing posture and buffer |
| Focus / pause | No blur cleanup; remote actions ignored phase guards | All held inputs clear; actions require a live, unpaused fight |
| Settings keyboard | Arrow Down was consumed while paused | Native settings/camera keyboard controls remain available |
| Round timer | A wall-clock callback advanced a paused round | 2.4 seconds of unpaused simulation advances it |
| Shared final hit | Both finalists eliminated but the later seat received a crown | The existing all-out draw receives no crown |
| Hazard spacing | Synthetic minimum low/low spawn gaps compressed to ~.692 s at early speed with recovery | Existing .90/.90/.58/.48 s transition minima are enforced at predicted arrival, plus one fixed tick |
| Hard AI early jump | A non-mistake plan hit the leading edge before reaching safe height | Collision-edge timing and normal gated actions clear the fixture |
| Mobile cue / landscape HUD | Initial new cue overlapped the portrait host; existing landscape lives panel covered the approaching rod | Cue separated from host; compact landscape controls leave the rod clear |
| Dependency failure | Aborted Three.js request left “Winding…” | Explicit Three.js unavailable message; delayed-load and WebGL error states also exist |
| Preservation test | Already failed on main because edited source differed from original | Original and archive SHA-256 hashes enforced independently of active edits |

The initial behavioral run had 10 failures out of 20. Arrival/AI fixtures exposed 13 additional failures; handoff and shared-final-hit regressions were reproduced before their fixes. Browser pixel inspection exposed the layout issues; a hazard/HUD intersection assertion reproduced landscape occlusion before changing CSS.

## Timing, rules and bots

No `TUNING` or `AI` numeric constants changed. Jump's analytical flight time remains .7803 s; height exceeds .40 between approximately .0875 and .6928 s (fixed-step behavior is tested). Collision remains one decision at the first sample inside ±.014 track units. Each rod's checked set prevents duplicate scores/hits. Seven hits eliminate; setback stays within [.028, .115], recovery rate .012 with .30 s delay. The maximum setback recovers in under eight seconds if no new hit occurs.

Arrival prediction integrates the existing acceleration to its cap, using the farthest setback and fastest recovery as a conservative spacing bound. Spawn deferral preserves the established transition minima, including between separately chosen patterns. Early/middle/capped fixtures cover all four transitions; legal actions also sweep 23 speed samples at three setback positions. This does not promise recovery immunity or guaranteed survival after an error.

Bots retain all reaction/mistake/duck-hold constants and choose one jittered plan per rod. They receive no special velocity, collision exemption or frame-perfect correction. Sampled hard matches can be long: with seed 55, the baseline ten-seat match took 1342.13 simulated seconds over six rounds; the corrected candidate took 976.74 seconds over four rounds. Four-seat baseline hard took 730.72 seconds versus 839.05 (four rounds). Those individual samples include different random-consumption sequences and are not a statistical balance study. No extra difficulty or round-length tuning was adopted. Human playtesting remains necessary.

## Scope and provenance

Changed source, tests and notes are restricted to this game plus `tests/royal-twisted-quality.test.mjs`. No catalog, manifest, package/dependency lockfile, shared test, original or archive edits. Keep the existing version marker until the coordinator decides release metadata. Proposed metadata wording only: mention buffered multi-source input, arrival-spacing safeguards, readable action cues and explicit CDN/WebGL errors; retain network-dependent / experimental / multiplayer-in-progress status.

New fins are procedural Three.js geometry; cues are HTML/CSS; sound uses the existing synthesized audio. No new external assets, reference code or licenses were imported. Existing notices and assets are retained.

## Reference blocker

Royal Sumo v1.3 reference comparison is **blocked**. The consuming executor used the current Library skill's resolved-reference route: `prepare_materialize` for `libfile_699ce89727b08191bc207e0244a85a24`, then the current bundled `library_file_transfer.py materialize` helper into `/workspace/royal-twisted-reference/reference.zip`. It returned exactly `library file transfer failed: download failed`. One supported retry into `/workspace/royal-twisted-reference/retry/reference.zip` returned the same error. No readable ZIP bytes were obtained, no additional retry or alternate transfer was used, and no Sumo pixels or visual comparison are claimed.

## Limitations / review decisions

- Browser matrix uses Chromium software WebGL, virtual viewports and emulated touch. It is not physical-phone, real-controller or real-GPU validation. Audio was not judged by ear.
- Camera projections and inspected pixels show approaching hazards at default/max setback; the selected camera is preserved. Foreground decorative towers can partially obscure P1's lower body at maximum setback. No alternate camera was substituted.
- Software render samples measure CPU call/submission time, with large variance and no claim of a playable frame rate. Browser requestAnimationFrame is controlled by the harness for deterministic fixtures. Automated simulation completion is not a wall-clock human playthrough.
- These are local controller hooks, not authenticated network multiplayer. Current public API names and mappings are retained.
- Independent review and human feel/balance checks remain outstanding. Release metadata, integration packaging and any publishing remain coordinator decisions.

## Environment verification

A separate launch with normal HTTPS certificate validation failed to load `https://cdn.jsdelivr.net/npm/three@0.180.0/+esm` with **`net::ERR_CERT_AUTHORITY_INVALID`**. `window.RoyalTwisted` was absent and the visible page said **Three.js unavailable** with network/reload guidance. This is a recorded dependency failure, not a playable pass. The successful graphical matrix explicitly ignored certificate errors only in its disposable test browser context. Production HTML does not disable certificate validation or substitute a dependency.

Early browser-fixture failures were also corrected: RAF-based readiness polling cannot run when the harness owns requestAnimationFrame, and synthetic pointerdown cannot establish a real pointer capture. Final fixtures use interval polling, wait for the loading overlay to disappear and establish pointer capture with a real browser mouse press before cancellation. Page errors are asserted after interaction as well as at startup.

## Focused code review

A separate read-only reviewer found that pause cleanup cancelled an already-selected AI duck while `aiHazard` prevented another response. The reproduction lost a life only after pause/resume. This is fixed by saving the remaining duration of the existing AI hold, neutralizing posture during pause, and restoring that same hold before the next collision on explicit Resume. It does not reroll the sampled plan or reissue an airborne jump; reset and controller handoff discard saved holds. A failing-then-green regression covers this. A real `animate()` fixture now covers paused accumulator clearing, a single results transition, rematch and resumed simulation; the browser fixture still controls RAF for deterministic screenshots.

Suspended audio contexts are resumed on subsequent interaction, and the compact status names the round/match winner even when the host message is hidden. Automated audio-context behavior is checked; audible quality remains unverified.

## Final check results

| Status | Command / check | Result |
| --- | --- | --- |
| Passed | `node games/royal-twisted/tests/source-smoke.mjs` | Version/API markers and both immutable upload hashes |
| Passed | `npm test` | 130 tests, including 70 Twisted quality cases; zero failures |
| Passed | `node --test tests/royal-twisted-camera.test.mjs tests/settings-pause-flow.test.mjs tests/standalone-game-lifecycle.test.mjs tests/royal-ballistix-mobile-ui.test.mjs` | 28 shared/camera/lifecycle/mobile regressions |
| Passed with stated environment conditions | `PLAYWRIGHT_MODULE=/tmp/twisted-browser/node_modules/playwright/index.mjs TWISTED_IGNORE_HTTPS=1 node games/royal-twisted/tests/browser-quality.mjs` | 10 checks: two failure-state checks and four viewport interaction/framing checks plus four diagnostic render samples; no page errors in playable cases |
| Passed | `git diff --check` | No whitespace errors |
| Blocked | Normal Chromium CDN load | `net::ERR_CERT_AUTHORITY_INVALID`; explicit error UI, not a playable pass |
| Blocked | Royal Sumo Library reference | Two supported transfer failures; no reference comparison |
| Not run | Physical phone, hardware gamepad, real GPU, audio-by-ear, statistical/human balance study | Requires suitable devices/human review |
| Not run / outside scope | Worker deployment/build, release metadata, network multiplayer | Standalone browser entry and repository tests checked; no publishing |

Full [repository test output](evidence/repository-tests.txt), [shared regression output](evidence/shared-regressions.txt) and [browser evidence](evidence/browser-quality.json) are retained. Reviewed screenshots: [portrait maximum setback](evidence/portrait-setback.png) and [landscape maximum setback](evidence/landscape-setback.png).

Ten software-render submissions per viewport, balanced graphics, DPR 1, Chromium 154.0.8037.57 / SwiftShader in the cloud container. These samples include driver backpressure, are highly variable, and are **not FPS or hardware performance certification**:

| Viewport | Mean CPU submission ms | Maximum ms | Draw calls |
| --- | ---: | ---: | ---: |
| desktop | 139.03 | 1093.6 | 421 |
| portrait | 43.31 | 316 | 448 |
| small | 12.64 | 20.8 | 360 |
| landscape | 69.12 | 408.9 | 489 |

## Changed paths

- `games/royal-twisted/source/index.html`
- `games/royal-twisted/README.md`
- `games/royal-twisted/CHANGELOG.md`
- `games/royal-twisted/tests/source-smoke.mjs`
- `games/royal-twisted/tests/README.md`
- `games/royal-twisted/tests/runtime-harness.mjs`
- `games/royal-twisted/tests/browser-quality.mjs`
- `games/royal-twisted/tests/QUALITY_REVIEW.md`
- `games/royal-twisted/tests/evidence/{browser-quality.json,repository-tests.txt,shared-regressions.txt,portrait-setback.png,landscape-setback.png}`
- `tests/royal-twisted-quality.test.mjs`
