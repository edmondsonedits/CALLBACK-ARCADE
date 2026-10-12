# Blind Crown — Nightfall Tactical Worlds v1.7.0

Secret-position archery for one human and bots, 2–10 seats. Place, aim and lock privately; all archers reveal and fire together. Canvas remains the standalone default with overhead, isometric, first-person and third-person cameras. Private-room hosting is not included; experimental Three.js remains unverified.

## Four tactical worlds

| Arena | Material / counterplay |
|---|---|
| Royal Citadel | Original absorbing stone and corner lanes. Predict which lane will stay open. |
| Moonlit Orchard | Striped hedges block movement; arrows pass through. A hedge conceals a route, not an arrow. |
| Frost Keep | Labeled ice facets reflect once; the next facet absorbs. Predict a bank instead of aiming through ice. |
| Clockwork Court | Vertical/horizontal shutters alternate at the next round. Dashed OPEN outlines and CLOSED labels announce the current forecast before anyone locks. |

Cover rules can restore absorbing Classic cover on any map. Classic Blind Volley retains its private guide; Precision has no path guide. The same solver supplies Classic guides, four-camera arrow animation, impacts and immutable completed-round review. Every shot has at most two segments and 1,400 world units. Exact corner reflections use x-face priority; equal target distances use seat order. Geometry changes only between rounds.

## Play, practice and Tour

The title runs real all-bot matches in a separate silent Match/RNG/render context; its first reveal uses a bounded eight-second warmup. Watch collapses the menu; Start always creates a new real match. Demo planning hides every archer until reveal and never writes real history, scores or bests. Returning from sounded play keeps the demo silent.

Practice selects any arena and round limit. The finite Tour visits Citadel → Orchard → Frost → Clockwork, with **four rounds maximum per stage** and the chosen planning duration. Advance appears only after a natural final result. Stage replay restores captured rules and seed; later menu edits do not alter that replay or the remaining Tour. Aggregate standings rank crowns, then points, then seats, and display actual completed-stage hits/points. No completion is fabricated. Standalone results retain last-survivor, living-points/total-wipe and existing seat-order tie rules. Personal bests are scoped to map, rules, materials, difficulty, capacity, duration and length.

Review pauses local play and keeps at most 24 detached, frozen completed rounds, including geometry, materials, bounds and each bank segment. Current secret plans never enter review. Tour summary records never expose seeds; captured Tour diagnostics remain private until the entire Tour completes. Generated seeds never populate the seed field. Captured Replay/Next ignore staged rule edits, including a staged zero-rival count; Next advances transactionally only when its match starts. Review labels and own-shot outcome messages wait for the actual arrow finish time. Rematch/new stage/setup clears that match's review history.

## Controls and customization

WASD/arrows or independent touch movement; Q/E, ±1°, pointer aiming; Space locks/unlocks before the deadline. First/third-person retain drag-to-aim and a private placement map. Standard gamepad: left stick/D-pad move, right stick/shoulders aim, A lock, X/Y Place/Aim, Start pause. P/Escape pauses. Menus reset held keyboard, touch and pad state; release pad controls to re-arm. Settings/help/review pause local simulation.

Grouped Play/Rules, Player Style, Controls and Audio/Access offer session, seed, map, materials, capacity, time, difficulty, ruleset, rounds, name, ten banner colors, three visible crests, camera/FOV/detail, coaching, volume, opt-in sound, reduced motion and high contrast. Rules stage until Start/restart; style and access apply immediately. Native name/seed fields allow empty and spaced edits, normalize on blur, and tolerate corrupt/denied storage. Sound is gesture-enabled and bounded to eight voices; particles are capped at 160. Reduced motion disables decorative animation and impacts without stopping actual simulation.

## Source and verification

The only current implementation is `source/index.html`. `source/original/blind-crown-v1.4.html` remains immutable at SHA-256 `496131ad8031a58b8b2ec78cc1aace73f57ab1ca0646271b383bf48bb108c462`. Engine, perspective, artwork and coordinator helpers now implement explicit tactical materials; this intentionally supersedes historical active-module byte guards. Archived Classic shot/placement/movement compatibility and all previous Classic behavior/privacy checks remain substantive assertions. Room client, experimental Three bridge and embedded knight GLB remain byte-identical.

Current bytes/module hashes: `tests/worlds-verification.json`. Historical Nightfall/quality/Sumo evidence applies only to the source hashes it records. Focused command:

```sh
node --test games/blind-crown/tests/standalone.test.mjs games/blind-crown/tests/quality.test.mjs tests/blind-crown-worlds.test.mjs
```

Native Chromium/layout evidence belongs to the parent integration report. Node/VM checks cannot certify pixels, perceived quality, physical gamepads, Safari, audio by ear or experimental Three. No numerical rating is claimed.

The reused Kenney CC0 impact sprite is actually drawn at arrow impacts, embedded so downloaded HTML works offline, and retains a procedural fallback. See `assets/worlds-provenance.json` for license, original pack URL/archive hash and per-file hashes. Original armored artwork remains. No new runtime dependencies/CDN requests are required for Canvas.
