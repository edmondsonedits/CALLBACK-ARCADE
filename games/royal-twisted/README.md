# Royal Twisted — Spiral Keep

Royal Twisted is a 2–10 contestant reaction/survival game around the Spiral Keep. The active imported build is v0.5.0.

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
- Blur, hiding the page, pause/settings and controller handoffs clear held input and buffered jumps. After resuming, release and press gamepad controls again. Escape pauses or closes settings to pause; only **Resume** resumes. Keyboard arrows remain available to settings/camera controls while paused. Remote gameplay actions also respect pause/countdown/results. Bots restore an already-selected duck hold on Resume without rerolling their decision.
- The first collision-window sample resolves each rod once per contestant, using the existing safe-height/duck rules. Arrival spacing now preserves the existing transition floors through acceleration and recovery. Physics, speed limits, setback bounds and difficulty constants are unchanged.
- Round advancement uses simulation time and stops while paused. If a single rod eliminates both finalists, the existing all-out draw applies; no eliminated contestant receives a crown. Rematch remains available through Settings → Restart Match → Close → Resume.
- Performance graphics and reduced-motion preferences suppress impact flash/camera shake; collision timing is unchanged. Short landscape screens use more compact controls to keep approaching rods above the HUD.

See [quality evidence](tests/QUALITY_REVIEW.md) for checks and limitations. Missing bundled graphics files and unavailable WebGL show explicit errors. This is a locally served module bundle, not a service-worker offline cache; hosted multiplayer was not added.
