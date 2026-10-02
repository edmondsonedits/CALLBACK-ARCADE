# Space Bash — Orbital Breakfloor

Imported version: **1.13.1 standalone**

Space Bash is a self-contained physics-survival arena game for **2–10 contestants**. The current standalone build supports one local human player and fills every other active slot with bots. Players move around an 8×8 destructible orbital deck, grab and throw crates, kick rivals and crates, jump small gaps, trigger TNT/Nitro chain reactions, and try to be the last contestant alive.

## Current status

- Source import: **imported**
- Lifecycle: **experimental**
- Local play: **working standalone build**
- Bot-filled player count: **2–10 total contestants**
- Phone room-code multiplayer: **not integrated**
- External runtime dependencies: **none**
- External asset files: **none**

Source-import status is intentionally separate from multiplayer readiness. The existing window.SpaceBash API supports setup/state inspection but does not provide per-seat remote input.

## Gameplay

Each round lasts up to 90 seconds. Explosions permanently destroy floor tiles, creating holes that eliminate grounded players. TNT and Nitro become more common as the round progresses. A round normally ends when one contestant remains; if time expires, the surviving contestant with the highest health wins. The first contestant to reach three round wins wins the match.

The imported source includes an 8×8 destructible deck, normal/TNT/Nitro crates, crate grab/throw, kicking, jumping, progressive explosive pressure, bot opponents, 2–10 contestant selection, simultaneous mobile multi-touch, keyboard controls, procedural sound/haptics, Canvas 2D rendering, and a fixed 120 Hz simulation loop.

## Controls

### Mobile / touch
- Left thumbstick: move
- Grab: pick up a nearby normal/TNT crate; press again to throw
- Kick: kick a crate or nearby contestant
- Jump: jump over small gaps
- Pointer Events allow the thumbstick and action buttons to be used simultaneously.

### Keyboard
- WASD or Arrow keys: move
- E: grab / throw
- F: kick
- Space: jump

## Setup

No build step or external dependency is required. Open games/space-bash/source/index.html in a modern browser. The file has no CDN, module import, external image, or external audio dependency.

## Player count and bots

Use Settings to select 2–10 total contestants. Slot 1 is the local human. Slots 2–10 are currently bot-controlled by the in-file ai(f, dt) routine.

The control property exists on fighter objects, but the current simulation does not branch on it; step() calls ai() for every fighter with id > 0. Remote seats therefore cannot replace bots safely yet without a source change. See integration/README.md.

## Tuning locations

Primary tuning values are near the top of source/index.html:
- ROUND_TIME, FIXED, MAX_STEPS
- COLORS, NAMES
- TUNE.move.accel, max, drag, airAccel, airDrag
- TUNE.jump
- TUNE.kickForce
- TUNE.throwSpeed
- TUNE.crateKick
- TUNE.gravity

Additional gameplay tuning is currently inline in crateType(), spawnCrate(), explode(), kick(), ai(), and step().

## Runtime hooks currently present

The standalone source exposes:
- window.SpaceBash.version
- window.SpaceBash.setPlayers(n)
- window.SpaceBash.getState()

setPlayers(n) accepts 2–10 and restarts the match. getState() returns version, player count, round, remaining time, phase, number alive, per-slot wins, and remaining floor-tile count.

There is no per-player input injection hook, room/join transport, authenticated seat mapping, or authoritative network event stream yet.

## Known issues / limitations

- Only Player 1 is human-controlled in the standalone build.
- Slots 2–10 are bots; phones cannot replace them yet.
- Bot decisions use Math.random(), so matches are not deterministic/replayable.
- getState() is a coarse snapshot and does not expose full fighter/crate state for network snapshot replication.
- Local input is wired directly to DOM Pointer Events / keyboard state rather than a reusable per-seat input abstraction.
- Audio may require a browser interaction before it starts.
- Rendering is intentionally Canvas 2D for local-file/mobile reliability.

## Modifying the game

1. Edit source/index.html.
2. Preserve 2–10 player selection, local solo/bot behavior, fixed timestep, and multi-touch unless intentionally changing them.
3. Run node games/space-bash/tests/source-smoke.mjs.
4. Perform the manual checks in tests/README.md.
5. Update CHANGELOG.md.
6. If the manifest changes, run npm run catalog:generate and npm run catalog:check.
7. Do not mark multiplayer verified until docs/GAME_SDK.md is implemented and valid JSON evidence hashes the current source.

## Source integrity

Imported source SHA-256: e6fc6342764b743bc125c0519b2f61d9384411b69b563799e26a10ac834b46d8
