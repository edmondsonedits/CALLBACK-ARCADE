# Royal Twisted — Spiral Keep

Royal Twisted is a 2–10 contestant reaction/survival game around the Spiral Keep. The active build is v0.6.0, based on the preserved v0.5.0 import.

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

Persistent preferences include contestant count, rival difficulty, rhythm, graphics, haptics, mute, volume and reduced motion; personal best clears/streak are retained when storage is available. Contestant and rhythm edits during a run are staged until **Restart Match**. Rival skill changes apply immediately to subsequent sampled bot plans. Camera code persistence remains separate and unchanged.

The tower now has illuminated slit windows, banners and braziers. Rival helmets and colored ground rings distinguish contestants. Grounded running, airborne, duck and landing poses respond to actual posture; shadows stay on the deck. Reduced motion removes decorative banner sway, impact flash, camera shake, body/head wobble, landing squash and particle/ring effects. Run/jump/duck motion remains functional feedback.

Focused evidence: [sumo-benchmark.json](tests/evidence/sumo-benchmark.json). The new behavior suite and existing Twisted regression suites are run in Node, including a construction check using the bundled real Three.js API. The renderer, mobile pixels, real gamepad hardware, audio by ear and subjective feel remain pending browser/device validation. Historical screenshots and the earlier quality report are not evidence for v0.6.0. Original/archive bytes and all physics/camera constants remain unchanged.
