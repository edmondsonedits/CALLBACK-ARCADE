# Royal Sumo / Crownfall Arena

Royal Sumo is a physics-party sumo game for **2–10 contestant slots**. The arena shrinks over time, fighters lose stability when hit, and the last fighter standing earns a crown. The first fighter to three crowns wins the match.

## Imported build

- Game version: **0.21.0**
- Entry point: `source/index.html`
- Exact chat-generated source: `source/original/royal_sumo_crownfall_v0.21_player_scaled_arena.html`
- Rendering dependency: vendored **Three.js r180 / 0.180.0**, MIT licensed
- Source status: imported
- Multiplayer status: in progress, **not verified**
- Contestant capacity: 2–10
- Current standalone mode: one local human; remaining unclaimed slots are bots

The packaged entry preserves the v0.21 gameplay code. The only runtime-source change made during intake is replacing the pinned jsDelivr Three.js import with the vendored local copy.

## Gameplay

Move around the circular arena, pressure opponents toward the rim, use Bash to commit to directional knockback, and use Dash for burst movement. Hits reduce stability. A fighter at zero stability enters the staged impact/limp/brace/rise knockout sequence and can still slide or be pushed out. The courtyard progressively contracts; larger matches receive a larger opening arena and later shrink timing.

The game includes target-distributing bot AI, crowd separation for large matches, player-count-scaled arena pacing, impact tiers, procedural dummy animation, dynamic camera framing, synthesized audio/VFX, touch-safe mobile controls, and deterministic debug scenarios.

## Local controls

- **Move:** virtual thumbstick.
- **Bash:** press and hold BASH to charge; release to lunge and strike.
- **Dash:** tap DASH.
- **Pause/settings:** top-right settings/pause control.
- There is no keyboard gameplay control in the imported build.

Pointer capture, `touch-action:none`, overscroll prevention and touch cancellation handling are retained.

## Run locally

Serve the repository over HTTP and open:

`games/royal-sumo/source/index.html`

The packaged entry has no runtime CDN dependency. Three.js is loaded from `source/vendor/`.

## Tuning locations

The main gameplay tuning blocks are inside the module script in `source/index.html`:

- `MOVEMENT` — speed, response, grip and turning.
- `BASH` — charge/lunge timing, force, hit window and recovery.
- `CONTACT` — body collision response, friction and pushing.
- `KNOCKDOWN` — impact, limp, brace and rise phases.
- `AI_TUNING` / `AI_LEVELS` — targeting, edge behavior, attack discipline and crowd distribution.
- `SHRINK` / `CROWD_ARENA` — arena contraction and player-count scaling.
- `IMPACT_FEEDBACK` — hit-stop, shake, particles, audio and haptics.
- `DUMMY` — procedural gait, limb lag and instability motion.
- `CAMERA` — follow distance, look-ahead, group framing and FOV.
- `HUD_TUNING` — stability/readiness thresholds.

## Debug/state hooks

The build exposes `window.RoyalSumo` and deterministic scenario hooks used during development. Use `window.RoyalSumo.getState()` for structured runtime state.

Important scenarios include `tenplayers`, `crowdpressure`, `arena4` and `arena10` in addition to movement, Bash, collision, knockout, AI, impact, animation, camera and HUD cases.

## Multiplayer direction

The source already has 10 slots, bot filling, state access and imperative remote input hooks. It does **not** yet implement room codes, authenticated phone transport, server-issued seat credentials, protocol/schema enforcement, sequence rejection, reconnect, rate limiting, authoritative event recording or a production host/controller adapter.

See `integration/README.md` for the exact hooks and the work still required by `docs/GAME_SDK.md`.

## Assets and licensing

See `assets/README.md`. Game-specific geometry, textures, labels, particles and audio are generated procedurally in source; no external art/audio asset pack is bundled. Three.js is vendored as code under its MIT license in `source/vendor/LICENSE-three.txt`.

## Tests

Run:

`node games/royal-sumo/tests/source-smoke.mjs`

Then run the repository checks required by the CALLBACK Arcade intake workflow.

## Known issues / unverified areas

- Online phone multiplayer is not implemented or verified.
- Only slot 0 has the standalone on-screen controller; slots 1–9 currently require bots or calls through the remote-input API.
- The current `sequence` value is stored but not enforced for duplicate/out-of-order rejection.
- Bots do not yet flow through the future validated network action path required by the SDK.
- Ten-player stress scenarios exist, but there is no recorded hardware benchmark or human playtest evidence in this repository.
- Web Audio and vibration behavior varies by browser/device.
