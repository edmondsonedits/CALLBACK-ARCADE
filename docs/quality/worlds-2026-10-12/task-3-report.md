# Task 3 — Roller Ruckus worlds and mastery

Status: DONE_WITH_CONCERNS at implementation handoff. All requested code and CPU evidence is implemented; independent review and real-browser visual/flow QA are coordinator-owned and pending. No numerical quality score or hardware claim.

## Scope and commits

- Base supplied by coordinator: `1c262d7`; concurrent parent metadata/test commits were preserved.
- Implementation: `50f6661` — four racing worlds, isolated live title, Series/practice, customization, assets and tests.
- Follow-up: results classification and evidence finalization, committed with this report; exact commit is in the final handoff.
- Owned paths only: `games/royal-roller-ruckus/**`, `tests/royal-roller-ruckus-worlds.test.mjs`, this report. No helpers/subagents, other games, shared metadata, push or deploy.

The brief, AGENTS.md, binding worlds spec and prior Roller report were read. Existing Three r180 engine, classic Crownway control points/tuning, momentum/contact/height separation, forward gate sweep authority, physical bot recross/recovery and both public controller/camera APIs remain. Original archive and Three renderer modules are unchanged.

## Delivered behavior

- Compact edge title panel over actual legal all-bot races. Every course completes and loops. Watch has visible Start/Return. Demo uses separate seeded RNG/clock, rejects network packets, never samples local airborne steering, writes no bests and suppresses audio/haptics even after a sounded match. Start creates fresh racers, rules and seed. Reduced motion uses a static overview camera while the simulation continues.
- Crownway remains classic. Frostglass has a distinct broad loop, actual reduced drive/grip/braking on blue ice and amber braking strips. Foundry adds deterministic two-second warning/two-second steam periods with an unaffected opposite lane and adapted bots. Skygarden has a second distinct raised layout, two-second directional wind warnings, bounded alternating gusts and meaningful edge-boost risk. Bot steering anticipates ice, chooses safe steam lanes and compensates for wind. Existing cap/checkpoint/crossover authority remains.
- Single races, one-lap practice on each map and a four-course one-lap-per-race Series. Current-race and aggregate standings, next/replay actions, scoped race/lap bests, lap splits and recoveries. Only real finishers receive finish timestamps, finish places and points. Unfinished rows show “Unfinished” and an em dash for finish place. API seat changes discard Series scoring; countdown seat changes refresh record scope.
- Rules/Player/Controls/Audio & Access groups expose 20+ working settings. Course/session/hazard/seed/difficulty/seats/laps stage until Start/restart; same-seed replay restores the completed session's rules. Name accepts spaces/empty edits and normalizes on blur. Color/cage trim/helmet, contrast, graphics and existing access/audio choices work immediately. Native focus and transitions preserve input discipline.
- Actual Kenney Castle/Nature GLBs and Particle Pack steam sprites, local official matching GLTFLoader/BufferGeometryUtils, full license/provenance. Up to four immutable cached templates, 22 clones and three steam sprites; stale loads cannot attach to discarded course groups. Procedural fallback remains playable. Course/racer-owned resources dispose; shared geometry/textures remain cached.
- Improved compact desktop/touch shell and scrollable sticky settings/result actions. Performance mode lowers DPR to0.8, disables shadows/spectator point lights and removes backdrop blur/grain. Other modes use at most six spectator point lights. FPS diagnostics now measure unclamped wall time; simulation keeps its fixed-step cap.

## Tests and commands

The first four new tests were executed before implementation and all failed with missing course/world/isolated-demo/Series contracts; then implemented to green. Tests run shipping functions, not a separate substitute simulation.

| Command | Result |
| --- | --- |
| `node --test tests/royal-roller-ruckus-worlds.test.mjs tests/royal-roller-ruckus-quality.test.mjs tests/royal-roller-ruckus-sumo-benchmark.test.mjs` | 57 passed, 0 failed; 16 worlds checks +41 preserved. Parent updated only stale version/result-label expectations in its owned benchmark file. |
| `node games/royal-roller-ruckus/tests/worlds-navigation.mjs` | 24 complete three-lap races:4 courses ×2/10 seats ×3 seeds, maximum hazard intensity. Every seat finite/finished with unique places; zero non-forward credits. |
| `THREE_MODULE=$PWD/games/royal-roller-ruckus/source/vendor/three.module.js node --test games/royal-roller-ruckus/tests/navigation.test.mjs` | 28 passed, 0 failed; legacy three-difficulty navigation and difficulty ordering. |
| `THREE_MODULE=$PWD/games/royal-roller-ruckus/source/vendor/three.module.js node games/royal-roller-ruckus/tests/real-course.mjs` |2/4/10 seats finish three legal laps; coincident-pack release and landing without gate credit pass. |
| `node games/royal-roller-ruckus/tests/worlds-camera.mjs` | All4 full spline sweeps pass; worst player bottom527.72px<532; worst turn0.04825rad<0.1. |
| `THREE_MODULE=$PWD/games/royal-roller-ruckus/source/vendor/three.module.js node games/royal-roller-ruckus/tests/camera.mjs` | Classic camera framing and CAM save/load pass. |
| `node games/royal-roller-ruckus/tests/source-smoke.mjs` | Passed; version/APIs/manual flow/original archive. |
| `node --check /tmp/roller-ruckus-inline.mjs` | Passed after extracting the shipping inline module. |
| `node --check games/royal-roller-ruckus/source/vendor/GLTFLoader.js` and `…/BufferGeometryUtils.js` | Passed. |
| `git diff --check -- games/royal-roller-ruckus tests/royal-roller-ruckus-worlds.test.mjs` | Passed. |

Full navigation and camera JSON, focused stdout and file hashes are in `games/royal-roller-ruckus/integration/worlds/`. Foundry ten-seat seed456 produced six real falls/physical recoveries at maximum hazards; all racers still finished legally. Other listed worlds navigation runs had no falls. This is intentionally reported rather than disguising hazards as rails.

## Hashes and reuse

- Current `source/index.html` after browser fix round2: `2b6b59de0bcadbfcb0907d2eeb60a4389178e3fec5c0ce91c907d2e91d1f9217`.
- Original archive: `643eea4257d0ab94ba9aee6ca2706b83b43ae10e1d9a05de7d2fd83289c2b515` (unchanged).
- Every source/vendor/asset file hash: `integration/worlds/verification.json`.
- Kenney source and archive URL/hash, per-file hash, triangle/material/bounds inspection: `source/assets/provenance.json`; complete upstream CC0 notices alongside assets.
- Official Three r180 loader/utilities: `source/vendor/loader-provenance.json`, existing full MIT notice. Import-path-only modifications; no decoders or runtime CDN. Tiny GLBs remain byte-identical to their source.

## Public UI/debug handoff

Existing Start/settings/pause selectors remain. New selectors: `#watchBtn`, `#watchStartBtn`, `#watchReturnBtn`, `#courseSetting`, `#sessionMode`, `#hazardSetting`, `#raceSeed`, `#playerName`, `#playerColor`, `#cageTrim`, `#helmetStyle`, `#contrastToggle`, `#muteToggle`, `#nextCourseBtn`, `#seriesSummary`.

`window.CallbackRace.getState()` is read-only: phase/isDemo/watching/paused, selectedCourse/activeCourse, mode/seed, raceTime, demo{time,loops,allBots}, rules{laps,seats,difficulty,hazards}, series, assets and racer position/progress/actual nullable finish times. Existing `CallbackInput.getState()` still means controller state. No production test mutation accessor. During title `phase` stays setup and `raceTime` is preserved from the real session; `demo.time` advances independently and Start resets the real clock.

## Acceptance and limits

Detailed ten-dimension pass/unverified rubric is in `integration/worlds/README.md`. Behavioral core fairness, physical course rules, demo isolation, preference validation, replay/results and provenance pass CPU checks. World/FX visual coherence, audible mix, responsive rendered UI and GPU/device performance remain unverified pending parent review; no subjective9/10 is asserted. Existing browser environment is software-rendered and may be slow: ordinary Chromium UI waits should track actual phase, not pretend a fixed wall delay equals simulation time. The parent owns exact-source screenshots and independent review, and will send concrete fixes if needed. Authenticated multiplayer transport remains in progress.

## Fix round 1 — independent review P2s

Reviewed the complete `task-3-review.md`. Both findings reproduced before changes: the new world-arrow test failed its initial local-direction assertion; the concurrent Foundry test observed two texture requests instead of one.

1. **Skygarden direction: addressed.** Each world arrow retains its track index and sets its cone-tip quaternion from local up to the corresponding track normal multiplied by the announced wind side. Creation and subsequent warning/active updates share the same helper. Real Three tests check all six curved segments on both alternating cycles, and compare cone tips with the velocity change from the actual shipping course-force function. Every dot product exceeds0.999. The HUD and gust force remain unchanged.
2. **Steam ownership race: addressed.** The loader now publishes one cached pending promise before awaiting it; all generations receive the same authoritative texture. Generation checks still precede sprite attachment. A rejected texture request stays cached as unavailable until reload, preventing retry storms while preserving procedural plumes/racing. Deferred-loader tests issue overlapping first Foundry visits, resolve pending work newest-first, check stale-group invalidation, then repeat course disposal/re-entry and assert the active map/cache identity and a single request. A failure test verifies one failure count/no repeated request and continuing simulation.

Validation: `node --test tests/royal-roller-ruckus-worlds.test.mjs tests/royal-roller-ruckus-quality.test.mjs tests/royal-roller-ruckus-sumo-benchmark.test.mjs` → **60 passed,0 failed** (19 worlds +41 preserved). The two primary regressions first ran **0 passed,2 failed**, then **2 passed,0 failed** after the fix. Inline syntax, source-smoke/archive and scoped diff checks also pass. Full navigation/camera evidence remains valid for unchanged physics/routes; it was not unnecessarily repeated for these rendering/resource changes. Source/provenance hashes were refreshed in `integration/worlds/verification.json`. The fix commit is supplied in the handoff; parent browser/re-review gates remain pending.

## Browser fix round 2 — missing Castle Kit texture

Real Chromium run38238458261 exposed two404s per profile from the Castle Kit GLBs' external `Textures/colormap.png` URI. The texture had been omitted from the otherwise local model intake. Added the byte-identical source PNG at the exact required relative path (512×512,7,529bytes, SHA-256`66fd49be148f32e88f6c8cace67120250d1943a7856601158ad0ff24651db0b0`). Its provenance inherits the recorded official Castle Kit archive/source URL/hash and complete CC0 license, and manifest paths now include the dependency. Corrected the asset README's erroneous statement that the models had no external URI.

Added a recursive shipped-model resource closure test over every GLB/glTF image and buffer URI. It first failed specifically on the missing PNG, then passed after the repair; it also checks local containment, per-file provenance/hash and manifest registration for all reached resources. Full focused command now reports**61 passed,0 failed** (20 worlds+41 prior). After the coordinator inspected9 PNGs, also corrected the compact title's lost word space (`ROYAL ROLLER RUCKUS`), moved the short-landscape coach below the speed HUD, and explicitly restored pointer input on the visible recovery button. In recovery state the secondary title/meter hide so the44px button fits within the100px control panel; redundant short-landscape background branding also hides during title/demo. I inspected the supplied landscape race screenshot and confirmed the cue/speed overlap before the scoped CSS fix. No race physics changed. Inline syntax, source-smoke/archive and scoped diff checks pass. Latest source SHA is`2b6b59de0bcadbfcb0907d2eeb60a4389178e3fec5c0ce91c907d2e91d1f9217`; the full source-tree hash manifest is updated. Parent fresh-browser bounds and real-fall/tap-recovery checks remain pending.
