# Space Bash quality review evidence

Review base: `785a15000abe11970c7b92c5f3cab197061fcedf` (fetched `origin/main`, 2026-10-12).
Branch: `quality/space-bash`. Entry: `games/space-bash/source/index.html`.
Implementation was approved by the coordinating conversation after the source audit.
No publishing, merge, deployment, shared-test edit, metadata generation, or archive edit is included.

## Behavior changes and evidence

| Area | Baseline evidence | Revised behavior / check |
| --- | --- | --- |
| Unsupported crates | Normal crate alive at y=.22 after 10 simulated seconds over a hole | Crates fall through missing tiles, expire below -3.8, and are removed from the active list |
| TNT fuse | Re-grab changed .2 remaining seconds to 3 | Arming can shorten an existing fuse, never extend it; grab, kick and chain tests |
| Carrying | Reset abandoned old object links | Release helper clears both ends on drop, throw, death, explosion, retirement and reset; contention tested at 2/10 seats |
| CPU TNT | Danger branch included the CPU's own held TNT before throw logic | Urgent carried TNT is thrown; other danger movement checks supported routes |
| Fast impacts | End-position-only checks skipped a target crossed in one step | Swept height-aware intersections choose earliest target; one impact per launch; TNT cannot repeat damage after stagger |
| Vertical contact | Low crate / ground kick hit a high jumper | Height separates contacts; exact-overlap kicks use facing; fighter overlap separation remains finite |
| Input | E key-repeat immediately threw a grabbed crate; paused movement and action pointer IDs survived | Repeat is ignored; inactive actions rejected; pause/blur/restart clear keys, movement ownership and action pointer sets |
| Feedback | No landing cue; constant-speed fuse ring; small local label | State-timed landing/action cues, explicit fuse seconds/ring, blast footprint, target bracket/throw direction and high-contrast YOU label |
| Framing | Short-screen sizing treated the diamond as a square | Fit actual projected deck footprint; compact landscape controls; geometric bounds checked at 390×844, 844×390, 360×640, 1280×800 |
| Smoke test | Active source required byte equality with archive, already broken by earlier merged fixes | SHA-256 pins the immutable archive; active source keeps standalone/API checks and rejects network runtime calls |

Eleven initial behavioral tests were run against the unchanged source and failed before implementation. Additional landing-support, interrupted-action-pointer and suspended-audio-context regressions were also observed failing before correction. Archive SHA-256:
`e6fc6342764b743bc125c0519b2f61d9384411b69b563799e26a10ac834b46d8`.

Preserved: 2–10 total contestants, one local human plus CPUs, first-to-three wins, timeout health ranking and first-seat equal-health tiebreak, no-survivor no-crown outcome, settings returning to explicit pause, current keyboard/touch controls, public APIs and CAM code format. External runtime assets and networking remain absent. Crate and particle drawing use Canvas 2D; sound uses the existing synthesized Web Audio approach. No reference assets or new third-party assets were imported; original rights/notices are unchanged.

## Verification

- `node games/space-bash/tests/source-smoke.mjs` — passed.
- `node --test tests/space-bash-quality.test.mjs` — 40 passed (31 behavior checks, 9 stress/render-path checks).
- `npm test` — 100 passed, including unchanged shared lifecycle/settings/camera contracts.
- `git diff --check` — passed.
- Build/typecheck — not run; no foundation/build/TypeScript files changed.

The test harness runs the real inline script, real simulation and real event handlers in a Node VM. It substitutes browser DOM, Canvas calls, clocks and audio boundaries. Test exports are injected into the test VM only; the shipped API has no debug or remote-input additions. The render-path check catches JavaScript errors but does not produce browser pixels. Pointer events in this harness are synthetic, not browser or physical-phone verification.

Natural-match stress uses seeded randomness, fixed 1/120-second steps, an idle human seat, real CPU decisions and real hazards. Each reaches exactly three crowns, then remains unchanged after 30 more simulated seconds. Ten explicit rematches at each of 2/4/10 contestants reset state; an additional ten seeded 10-contestant runs exercise movement, grab, kick and jump over 200 simulated seconds.

Representative performance sample (Node v24.19.0, Linux x86_64, AMD EPYC 9V74, five visible CPUs; no rendering/audio workload):

| Contestants | Rounds to match | Simulated seconds | VM wall milliseconds | Peak crates | Peak particles |
| --- | --- | --- | --- | --- | --- |
| 2 | 3 | 61.41 | 149 | 7 | 180 |
| 4 | 5 | 124.13 | 462 | 7 | 139 |
| 10 | 8 | 190.08 | 1416 | 12 | 335 |

These are simulation execution measurements, not frame-rate, GPU or device-performance claims. Results use one seed per natural-match player count; they do not prove all possible matches.

## Independent review

Read-only reviewer reported no major simulation regression and found stale action pointer-ID sets after an interrupted gesture. Fixed with explicit set cleanup and a red/green regression. Added the requested nearest-swept-target check independent of seat order. Final review closure is recorded in the task handoff.

## Blocked / not verified

Royal Sumo reference `libfile_699ce89727b08191bc207e0244a85a24` was resolved through the current Library materialization workflow into this executor's destination. The supported transfer helper failed twice (initial plus one bounded retry) with the exact message `library file transfer failed: download failed`. No readable ZIP was produced; no reference pixels were inspected, no visual comparison made, and no reference content imported.

Chromium attempts and exact errors:

1. CLI headless screenshot: `Failed to create headless user data directory container.`
2. Explicit consumer-local profile: no screenshot; logged `Fontconfig error: No writable cache directories` and `Message 2 rejected by interface blink.mojom.Widget`; process stopped.
3. Installed Playwright default executable: `Executable doesn't exist at /home/agent/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`.
4. Playwright using installed `/usr/bin/chromium`: `page.goto: net::ERR_BLOCKED_BY_ADMINISTRATOR at file:///workspace/CALLBACK-ARCADE/games/space-bash/source/index.html`.

No further navigation route was attempted after the administrator block. Therefore rendered portrait/landscape appearance, genuine multi-touch/browser interactions, offline browser play, audio by ear, physical phones, real GPU performance and subjective brawler feel remain unverified. The source/no-network checks and simulation tests are supporting evidence, not replacements for those checks.

Coordinator owns version/manifest finalization, packaging and integration. Active version remains `1.13.1-standalone`; consider a version bump after rendered review. No per-seat network input service was added.
