# Changelog

## 1.6.0 — Four-course Worlds

- Add an isolated, silent all-bot title race, Watch/Start/Return flow and fresh seeded starts.
- Add Frostglass ice/braking strips, Foundry warned steam/safe lanes and Skygarden directional gusts/edge boosts; Frostglass and Skygarden use distinct safe spline routes. Preserve the Crownway route, collision/height separation and forward-gate authority.
- Add one-lap practice on each course and a four-course, one-lap-per-race Series with honest finisher points, standings, next race and same-seed replay. Scope records to course, difficulty, seats, laps and hazard intensity.
- Add grouped course/session/hazard/seed, name/color/cage/helmet, contrast and prior access/control/audio preferences. Stage rules; apply player/access choices immediately.
- Use bounded local Kenney CC0 GLB scenery and steam particles through the official MIT Three r180 GLTFLoader. Cache shared assets and dispose course resources, with procedural fallbacks.
- Compact title and touch layouts, scrolling settings/results actions, less intrusive desktop controls and meaningful Performance mode (lower resolution, no spectator point lights/shadows/backdrop blur). FPS diagnostics use wall time without altering fixed-step simulation.
- Add 16 worlds behavioral tests, 24 full-course bot runs, four camera sweeps and source/license evidence. Browser/hardware review is separately recorded.

## 1.5.0 — Crownway Coach (Sumo benchmark upgrade)

- Add deliberate setup, concise expandable race help, pause/results setup routes and staged race rules. Preserve the existing manual resume flow.
- Add one-lap practice alongside three/five-lap races, validated lap splits, rules-scoped personal bests and every-racer results with unfinished rivals explicitly labeled.
- Add compact wrong-way, missed-gate, bend, edge and airborne advice plus contextual momentum/braking feedback without changing movement/collision tuning.
- Model forward deck chevrons, waving checkpoint pennants, helmet/plume/grin detail, corner bracing and finish celebration; dispose rematch geometries/materials/textures.
- Persist validated sound/volume, reduced motion, handedness, coaching, haptics, graphics and race choices. Reduce motion defaults to the device preference; audio requires a gesture and short sound voices are capped/cleaned up.
- Add neutral-to-rearm gamepad axes after menu transitions and repeat-safe Start/B gamepad actions, R/Escape keyboard actions, form focus guards and lost pointer capture neutralization.
- Bundle the existing Three.js r180 distribution and MIT license locally; preserve the original upload and existing public input/camera APIs.
- Add focused behavioral and real Three.js pose/resource checks, update browser dependency-failure fixtures and record current source hashes in `integration/sumo-benchmark/verification.json`. Browser/device limitations remain explicit.

## 1.4.0 — imported
- Imported the user-supplied vertical Crownway build.
- Preserved the original upload filename beside `source/index.html`.
- Recorded 2–10 racer, bot and `window.CallbackInput` hooks.
- Multiplayer remains in progress rather than verified.
## Unreleased — quality review branch

- Validate ordered forward checkpoint crossings and align the finish gate with
  the existing finish stripe; preserve the vertical circuit and three laps.
- Separate collisions by height and recover coincident packs; retain momentum
  transfer and checkpoint recovery without duplicate progress.
- Improve countersteer braking, correct bot steering damping and tune bend/gate
  paths without teleports or hidden credit.
- Stabilize chase-camera framing and local impact feedback; add active gate/edge
  cues and readable validated standings while retaining CAM controls/codes.
- Neutralize held input on interruption/disconnect and show dependency failures
  honestly. Preserve manual resume and local CALLBACK hooks.
- Add behavioral, actual-course and browser checks. Evidence and limitations:
  `integration/quality/README.md`. Release metadata remains coordinator-owned.

## Review follow-up — optional bot balance

- Restore the pre-polish `.31` corner-speed penalty; the matched-seed ablation
  demonstrated that the additional `.50` slowdown was unnecessary for completion
  and enlarged lap-time tails. Navigation corrections are a separate commit.

## Review follow-up — bot navigation

- Recover a missed nearby gate by steering back to its approach and through it
  using existing acceleration, grip and avoidance. Gate validation stays unchanged.
- Clear recovery targets on checkpoint advance, Respawn and Race Again.
- Pin complete races and effective difficulty ordering at 2, 4 and 10 seats
  across matched and fresh seeds; retain raw overshoot and pre-fix failure evidence.
