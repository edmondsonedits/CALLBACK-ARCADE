# Royal Roller Ruckus — Sumo benchmark upgrade

## Source-grounded audit

Reviewed the approved benchmark spec, repository editing/SDK instructions, Roller source/guides/tests and Sumo's `app/ui.js`, `controls.js`, `style.css`, `audio.js`, `core/settings.js`, `session.js`, `sim.js` and `quality.js`.

Sumo's deliberate setup/pause/help/results flow, validated persistent preferences, replay/session structure, bounded procedural audio and rich action feedback expose several concrete Roller gaps. Roller previously started its countdown automatically; lap/difficulty settings changed active rules; results consisted of the local place and a paragraph; preferences were not saved; gamepad buttons did not pause/recover. Its jsDelivr-only import also differed from Sumo's bundled renderer.

Roller's existing strengths were preserved: acceleration and countersteer braking, momentum-transfer collisions, height-separated crossover contact, ordered forward gate sweeps, physical missed-gate bot recrossing, pack release, airborne landing/recovery, crownline/rough-surface choices, articulated flail/impact animation, tiered procedural effects and chase-camera/CAM code APIs. These did not warrant a new engine or arbitrary movement retuning.

## Changes by category

| Category | Changes and resulting behavior |
| --- | --- |
| Playable flow | New deliberate setup with racer/rule summary, personal best and expandable help; explicit Start Race. Pause/results return to setup. Settings freeze and neutralize play, and closing them preserves manual resume or restores the results/setup screen. Rules are staged until explicit restart/rematch. Results list every racer with recorded times or an honest unfinished status. |
| Player control | Preserve camera-relative analog steering and existing touch/WASD/arrows. Add R recovery, Escape pause, edge-triggered gamepad Start pause and B recovery, neutral-to-rearm axes after pause/resume/reset/recovery, capture-loss cleanup, storage/gamepad errors guarded and repeat-safe keys. Focus returns to the gameplay region on start/rematch/resume; focused buttons reserve native Space/Enter without swallowing driving keys. |
| In-play presentation | Batched gold forward chevrons across the elevated course; animated gate pennants; modeled helmet, plume and grin; corner bracing and arms-up finish celebration. A compact optional coach identifies wrong way, missed gates, bends, exposed edges, crownlines/rough stone and airborne recovery. Contextual momentum/braking text lives in the existing control panel. Existing camera physics/framing and particle pools remain. |
| Settings/access | Validated persistent difficulty, 2–10 seats, 1/3/5 laps, graphics, master volume, mute, haptics, reduced motion, stick hand and coaching. Reduced motion defaults to the browser preference and suppresses flash, shake, speed zoom, particles and decorative animation. Useful target sizes, visible focus and form labels. Camera/debug controls sit under Advanced. Sound remains locked until a gesture; short voices capped at 24, disconnected on completion; paused crowd silenced. |
| Gameplay/learning depth | One-lap practice uses the same circuit, opponents and checkpoint authority. Legal finish crossings produce lap splits; personal race/lap bests are scoped to difficulty/count/laps and only updated by legally completed player races. Recovery keeps validated progress and cannot award a split. Existing bot difficulty/rush-zone physics remain. Finish timestamps continue through the reveal window for bots crossing then. |
| Engineering/reliability | Version 1.5.0, updated manifest/README/changelog/test guide and current hash evidence. Bundle byte-identical existing Three.js r180 modules and MIT license from Sumo; no CDN boot dependency or version change. Dispose racer geometry/materials/textures on rematch. Add 19 benchmark tests including CPU-side real Three geometry/pose/resource checks. Preserve original archive and all public `CallbackInput`/`CallbackCamera` APIs. |

## Changed files

- `games/royal-roller-ruckus/source/index.html`
- `games/royal-roller-ruckus/source/vendor/three.module.js`
- `games/royal-roller-ruckus/source/vendor/three.core.js`
- `games/royal-roller-ruckus/source/vendor/LICENSE-three.txt`
- `games/royal-roller-ruckus/manifest.json`
- `games/royal-roller-ruckus/README.md`
- `games/royal-roller-ruckus/CHANGELOG.md`
- `games/royal-roller-ruckus/tests/README.md`
- `games/royal-roller-ruckus/tests/source-smoke.mjs`
- `games/royal-roller-ruckus/tests/browser.mjs` (local vendor/dependency-failure fixture)
- `games/royal-roller-ruckus/integration/sumo-benchmark/README.md`
- `games/royal-roller-ruckus/integration/sumo-benchmark/verification.json`
- `tests/royal-roller-ruckus-sumo-benchmark.test.mjs`
- This report.

No Sumo/shared/catalog/other-game files were changed. Original archive SHA-256 remains `643eea4257d0ab94ba9aee6ca2706b83b43ae10e1d9a05de7d2fd83289c2b515`. Every vendored file equals the reference distribution byte-for-byte. Current source hashes live in `integration/sumo-benchmark/verification.json`; earlier integration folders are historical snapshots.

## Verification

All commands ran from the repository root; only game-focused checks were run. The coordinator owns whole-repo tests, generated catalogs and deployment.

| Command | Result |
| --- | --- |
| `node --test tests/royal-roller-ruckus-sumo-benchmark.test.mjs tests/royal-roller-ruckus-quality.test.mjs` | 41 passed, 0 failed: 19 new benchmark tests and 22 existing regressions. New behavior was first reproduced in failing tests, including reviewer-discovered focus loss and held-pad rearming. |
| `node games/royal-roller-ruckus/tests/source-smoke.mjs` | Passed, including version/public hooks/archive SHA. |
| `THREE_MODULE=$PWD/games/royal-roller-ruckus/source/vendor/three.module.js node games/royal-roller-ruckus/tests/real-course.mjs` | 2/4/10 seats finished three ordered legal laps, all finite: 117.17 / 118.28 / 123.58 simulated seconds, no respawns in normal races. Coincident-pack physical recovery and crossover landing without gate credit passed. |
| `THREE_MODULE=$PWD/games/royal-roller-ruckus/source/vendor/three.module.js node games/royal-roller-ruckus/tests/camera.mjs` | Full spline sweep/CAM save-load passed: worst player-bottom 527.72px < 532px, maximum per-frame turn 0.04825 radians < 0.10. |
| `THREE_MODULE=$PWD/games/royal-roller-ruckus/source/vendor/three.module.js node --test games/royal-roller-ruckus/tests/navigation.test.mjs` | 28 passed, 0 failed: 27 seeded three-lap races across 2/4/10 seats and all three difficulties, plus effective difficulty ordering. |
| `node --check /tmp/roller-ruckus-inline.mjs` | Passed after extracting the shipping inline module with `html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]`. |
| `node --check games/royal-roller-ruckus/source/vendor/three.module.js` and `node --check games/royal-roller-ruckus/source/vendor/three.core.js` | Passed. |
| `node --check games/royal-roller-ruckus/tests/browser.mjs` | Passed. |
| `git diff --check -- games/royal-roller-ruckus tests/royal-roller-ruckus-sumo-benchmark.test.mjs docs/quality/sumo-benchmark/royal-roller-ruckus-report.md` | Passed. |

## Remaining limitations and regression watch list

- No new browser screenshots, GPU performance record or hardware touch/audio/controller playtest is claimed. Known environment limits: local Chromium startup fails `socket() failed: Operation not permitted`; cloud browser WebGL2 unavailable. The updated browser harness is ready for an environment that supports WebGL2. CPU geometry/pose checks cannot establish subjective visual parity.
- Still requires WebGL2. Bundling removes the CDN-only failure; it does not remove the GPU requirement.
- Production simulation still uses the existing `Math.random`; no Sumo-style seeded replay or multi-course cup was added. The useful replay/learning upgrade is one-lap practice, lap splits and comparable personal bests.
- The preserved completion policy ends once participating humans finish; results explicitly label bots that have not finished. There is no invented finishing order or room readiness claim. Authenticated online transport remains unintegrated and multiplayer remains in-progress.
- Watch mobile 390×844 and 844×390 for coach/control overlap, ten-racer standings, results/settings scrolling and handed controls. Landscape rules compact the existing control panel; desktop chase-camera tests remain unchanged.
- Watch wrong-way/missed-gate advice around the finish hairpin/crossover: it is advisory only and never grants progress. Forward gate sweep remains the authority.
- Watch button keyboard focus after Start/Resume/Rematch, held gamepad Start/B and axes returning through neutral after transitions, touch lost capture, blur/manual resume, and staged settings during a running race. The behavioral suite pins these boundaries.
- Watch renderer cost of the added pennants/rider detail on phones. Chevrons are batched and all effects/resources remain bounded, but no performance improvement is claimed.
