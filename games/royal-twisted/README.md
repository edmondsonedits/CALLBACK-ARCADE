# Royal Twisted — Four Towers

Royal Twisted is a 2–10 contestant reaction/survival game around the Spiral Keep. The active build is v0.7.0, based on the preserved v0.5.0 import.

## Gameplay
Contestants automatically advance around the tower while hazards approach. Jump low cyan rods, duck high coral rods, and survive the round; the seventh hit eliminates a contestant. Unassigned slots are AI-controlled.

## Controls
- Touch: **JUMP** and **DUCK**
- Keyboard: Space / Up / W = Jump; Shift / Down / S = Duck
- Remote hooks: `window.RoyalTwisted.registerRemotePlayer()`, `input()`, `jump()`, `duck()`
- Contestants: 2–10

## Source
- Active: `source/index.html`
- Preserved upload: `source/original/royal_twisted_spiral_keep_v0.5_original_camera_knockback.html`
- Older reference: `source/archive/royal_twisted_spiral_keep_v0.4_ten_players.html`

The active review build bundles the unchanged Three.js 0.180.0 release under `source/vendor/three/`, with its MIT license and integrity provenance. Serve the complete `source/` folder over HTTP; no external CDN request is needed. Direct `file://` module loading is not supported. Original/archive builds retain their original dependencies.

## Multiplayer
The source exposes local/gamepad/CALLBACK remote control hooks, but the repository does not yet provide authenticated room-code transport, authoritative seat credentials, reconnect, rate limiting, or verified production multiplayer.

## Tuning
Gameplay constants live in the inline JavaScript `TUNING` object in `source/index.html`.
## Quality review changes (unreleased)

The active HTML retains automatic running, seven-hit elimination, all existing controller mappings and the selected **CAM-3R-23-U** view (rotate −45°, zoom 0.75, tilt −5°). Original/archive uploads are immutable and hash-checked.

- **NEXT · JUMP/DUCK** previews the next action. **JUMP/DUCK NOW** starts within 460 ms of the collision window. Upright triangular fins identify low rods; downward fins identify high rods alongside their action labels. Cues follow Player 1 through setback recovery.
- Jump is an edge action. Holding a keyboard/gamepad jump does not repeat. A new jump edge may buffer for 130 ms while airborne or ducking; it launches once when grounded and all duck sources release. Repeated edges cannot reset airborne velocity.
- Duck holds from keyboard keys, captured pointers, gamepad and remote input are independent. Release every held source to stand. Duck pressed in the air takes effect on landing. Grounded held duck wins over a buffered jump; expired buffers do nothing. If jump arrives before duck, the jump is already airborne and duck applies on landing; if duck arrives first, jump waits in the short buffer.
- Blur, hiding the page, pause/settings and controller handoffs clear held input and buffered jumps. After resuming, release and press gamepad controls again. Escape toggles pause/resume when settings are closed. Escape or Close inside settings closes them to pause; a subsequent Escape or **Resume** explicitly resumes. Keyboard arrows remain available to settings/camera controls while paused. Remote gameplay actions also respect pause/countdown/results. Bots restore an already-selected duck hold on Resume without rerolling their decision.
- The first collision-window sample resolves each rod once per contestant, using the existing safe-height/duck rules. Arrival spacing now preserves the existing transition floors through acceleration and recovery. Physics, speed limits, setback bounds and difficulty constants are unchanged.
- Round advancement uses simulation time and stops while paused. If a single rod eliminates both finalists, the existing all-out draw applies; no eliminated contestant receives a crown. Rematch remains available through Settings → Restart Match → Close → Resume.
- Performance graphics and reduced-motion preferences suppress impact flash/camera shake; collision timing is unchanged. Short landscape screens use more compact controls to keep approaching rods above the HUD.

See [quality evidence](tests/QUALITY_REVIEW.md) for checks and limitations. Missing bundled graphics files and unavailable WebGL show explicit errors. This is a locally served module bundle, not a service-worker offline cache; hosted multiplayer was not added.


## Sumo benchmark upgrade — v0.6.0

Start from an explicit setup screen. Select 2–10 contestants, rival difficulty and a mixed crown run or jump/duck practice rhythm. Open concise help during play, pause with the visible pause button, Escape or gamepad Start, and return to Setup from pause. The established first-to-two / three-round standings and tie overtime remain; seven hits eliminate.

The next-rod meter fills toward the existing collision-edge cue; JUMP NOW still begins inside the established 460 ms response window. A smaller line previews the following rod. Clean clears build a streak, while hits identify the missed action. Results show every contestant's crowns, total clears and best streak, plus your survival time and low/high hit breakdown. **Replay seed** starts directly from results. The same seed, rules, ownership and action trace reproduce gameplay choices; cosmetic random draws do not alter hazard/bot RNG. This is seeded local simulation, not an event-recording or network-replay system.

Persistent preferences include contestant count, rival difficulty, rhythm, graphics, haptics, mute, volume and reduced motion; personal best clears/streak are retained when storage is available. Contestant and rhythm edits during a run are staged until **Restart Match**. Rival skill changes now stage until Start/Restart in v0.7.0. Camera code persistence remains separate and unchanged.

The tower now has illuminated slit windows, banners and braziers. Rival helmets and colored ground rings distinguish contestants. Grounded running, airborne, duck and landing poses respond to actual posture; shadows stay on the deck. Reduced motion removes decorative banner sway, impact flash, camera shake, body/head wobble, landing squash and particle/ring effects. Run/jump/duck motion remains functional feedback.

Focused evidence: [sumo-benchmark.json](tests/evidence/sumo-benchmark.json). The new behavior suite and existing Twisted regression suites are run in Node, including a construction check using the bundled real Three.js API. The renderer, mobile pixels, real gamepad hardware, audio by ear and subjective feel remain pending browser/device validation. Historical screenshots and the earlier quality report are not evidence for v0.6.0. Original/archive bytes and all physics/camera constants remain unchanged.


## Four Towers — v0.7.0

The title runs genuine all-bot simulation with a private RNG and a bounded twelve-second warmup. Watch collapses the panel; Return and Start remain visible. Demo has no local/remote input, sound, haptics or record writes. Start resets statistics, hazards, clock, input and controllers. Reduced motion may pause the preview.

| Tower | Skill and effect |
|---|---|
| Spiral Keep | Original helix, jump/duck cadence and collision physics. |
| Ember Forge | Repeating high vent → low heat burst → low heat burst. Vent rings and heat fins distinguish the geometry. Duck, release, then time two separate jumps. Existing arrival-floor enforcement bounds every pair. |
| Frost Spire | Grounded duck brakes setback recovery and replenishes grip at 0.85/s. Automatic running drains 0.11/s; recovery ranges from 0.003 to 0.012 track units/s with grip. Refill during safe gaps/high rods, release before jumping. No lateral steering. |
| Stormwatch | A 1.5-second warning precedes a bounded 0.012 setback gust every ten seconds. Grounded duck braces it. Gust waits if any living seat has a pending rod less than 1.1s away; warning remains visible while deferred. Double-duck → jump patterns teach hold/release timing. Gusts never directly deal damage. |

**Practice** lasts at most 20/35/50 simulation seconds, ending early on local elimination. **Tour** visits all four towers in order with the same finite per-stage limit and explicit Next. Its aggregate is the sum of actual cleared rods, with hits, recovery/bracing and survival reported; it does not invent a crown ranking. Replay repeats captured seed/rules and clears the aggregate. **Crown** preserves seven-hit elimination and tie overtime, with 1/3/5 regulation-round length. Standard is the original three-round format.

Customize stages map, mode, seed, contestants, rival skill, rhythm, length and gentle/standard pattern spacing until Start/Restart. Name, color, crown/plume/bare head, graphics, haptics, volume/mute, motion, contrast and action-only/full coaching update immediately. Names preserve spaces and empty input during editing, normalizing only on blur. Personal best clears are scoped to tower, mode, length, rhythm, difficulty, modifier and contestant count. Storage denial/corruption never blocks a run.

The CC0 props in `source/assets/` are Kenney Castle Kit 2.0 tower tops, rock formations and flags; the GLBs retain their full `Textures/colormap.png` dependency. Exact archive/asset hashes, mesh/material counts and source bounds are in `source/assets/provenance.json`; the complete CC0 notice is adjacent. Units/pivots are native Y-up low-poly models, rendered at explicit 1.8x or 2x scale outside the playable helix with no collision proxies. They are small uncompressed meshes; compression would add a decoder without practical benefit. Procedural scenery remains if asynchronous loading fails. Three r180 loader/geometry utility imports are changed only to relative local paths; full MIT and upstream/local hashes are in `source/vendor/three/addons-provenance.json`.

`RoyalTwisted.getState()` is current without debug enabled and returns copied fighter postures, elapsed time, paused/demo state, tower cue, controllers and choreography. `getSession()` adds captured rules, demo elapsed/phase and finite Tour stage/aggregate state. Existing controller and CallbackCamera methods remain; remote hooks are local integration hooks, not authenticated online transport.

Verification for this version: [worlds.json](tests/evidence/worlds.json). Prior screenshots/evidence are historical. The 9/10 goal is a target, not a certified rating; physical gamepad/touch hardware, audio by ear and real-device GPU feel remain unverified.
