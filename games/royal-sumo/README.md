# Royal Sumo: Crownfall

Imported release **1.3.0**, simulation **1.2.1**, game protocol **2**, save schema **1**. CALLBACK phone-room protocol **1**.

[Play Royal Sumo](https://edmondsonedits.github.io/CALLBACK-ARCADE/games/royal-sumo/)

A physics arena brawler for 2–10 contestant slots with bot-filled seats, one or two local players, six arenas, Quick Match and Crown Cup. Move, charge and release Bash, use Dash, and knock rivals off the arena. Names, looks and local seating persist across rounds and reloads. Remote ownership is session-only.

## Source and build

- `source/index.html`: active self-contained WebGL2 game, with the existing CALLBACK camera panel and phone-room adapter.
- `source/original/royal_sumo_crownfall_v1.3.0.html`: exact standalone HTML supplied in the user's ZIP.
- `source/project/`: complete supplied ES-module project, zero-dependency builder and tests.
- `source/callback-camera.js`: repository-specific rotate/zoom/tilt and camera-code adapter; presentation only.
- `source/online/`: host lobby, responsive phone controller and relay configuration.
- `server/`: authenticated WebSocket rooms, shared Node/Cloudflare room core and deployment package.
- `source/build-callback.mjs`: rebuilds the imported project and appends the camera and room adapters.
- `source/archive/royal_sumo_crownfall_v0.21_callback.html`: previous active build, with its Three.js dependency at `source/archive/vendor/`.

Run `node games/royal-sumo/source/build-callback.mjs` from the repository root after edits. The imported modules are unchanged. The active entry differs from the supplied HTML only by a pause-flow metadata attribute and the appended camera and room adapters. No runtime downloads or external assets are needed. A browser with WebGL2 is required.

## Controls

| Device | Move | Bash | Dash | Pause |
| --- | --- | --- | --- | --- |
| Touch | Drag left side | Hold/release BASH | DASH | Pause button |
| Keyboard P1 | WASD | Space / J | Left Shift / K / L | Esc / P |
| Keyboard P2 | Arrows | Enter | Right Shift / period / Numpad0 | Esc / P |
| Gamepad | Left stick | A / X | B / Y / RB / RT | Start |

Choose one or two local players in setup. Settings includes native Follow/Fixed camera and zoom options; the preserved Camera panel adds rotation, tilt and reusable `CAM-…` codes. Closing settings returns to the paused menu until Resume is selected.

## Tuning and APIs

- `source/project/src/core/tune.js`, `sim.js`, `ai.js`, `maps.js`: physics, AI, rules and arenas.
- `src/core/settings.js`, `slots.js`, `session.js`: settings, player ownership and match/Cup progression.
- `src/gfx/`: procedural geometry, rendering and effects.
- `src/app/`: menus, controls, audio and runtime loop.
- `src/core/versions.js`: separate build/simulation/protocol/save versions.

`window.RoyalSumo` exposes `getState()`, `scenario(options)`, `restart(options)`, `setSeed(seed)` and `multiplayer.*`. `restart()` replays the same seed. See `integration/README.md` before using remote input. Older string-based debug scenario names from v0.21 are superseded by options objects.

## Phone players

The phone-room implementation is tested locally. **The public relay is not deployed yet; GitHub Pages currently supports local play only.** See [server/README.md](server/README.md) for the complete deployment command and configuration.

On a server-backed game link, select **Phone players → Create room**, share the join link, then **Play / Resume**. Each phone replaces a bot and gets a movement pad, hold/release Bash and Dash. Up to nine phones can join one local host; **TV only** lets all ten players use phones. Everyone watches the host screen; phones are controllers, not separate game views. The host must remain open.

Disconnects return the fighter to AI; reconnect within two minutes reclaims the same seat. Rooms last up to six hours. If the host starts a smaller match, phones whose seats are outside that match wait with an explicit message until more fighters are added. New phones can only claim seats within the current match. Local seat reservations remain fixed until the room ends.

## Verification and limits

See `tests/IMPORT_VERIFICATION.md` and `tests/README.md`. Phone rooms, authentication, strict input validation, reconnect and bot takeover are implemented and tested. Public deployment and cross-device internet play are pending, so multiplayer status stays **in-progress**. Real-phone haptics, physical gamepads, audio quality by ear and hardware performance are not established by headless tests.

See `assets/README.md` for provenance.
