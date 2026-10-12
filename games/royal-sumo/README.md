# Royal Sumo — Crownfall

The active game is **Royal Sumo: Crownfall v1.3.0**, explicitly designated by the user in `royal_sumo_crownfall_v1.3.0.zip`. `source/index.html` is the supplied standalone HTML, unchanged byte-for-byte. Older v0.21/v0.19 files are historical only.

Play: https://edmondsonedits.github.io/CALLBACK-ARCADE/games/royal-sumo/

## Gameplay and controls

Knock rivals out of the arena with charged Bash and Dash. Play quick matches or Crown Cup across multiple arenas. There are **2–10 contestant slots**, filled by bots when unclaimed, with one or two local human players. The game supports touch, keyboards and gamepads.

- Phone: drag on the left to move; hold BASH and release to strike; tap DASH.
- Player 1: WASD, Space/J for Bash, Shift/K/L for Dash.
- Player 2: arrows, Enter for Bash, Right Shift/period/Numpad0 for Dash.
- Gamepad: stick, A/X for Bash, B/Y/RB/RT for Dash.
- Escape/P pauses. Setup includes names, fighter looks and match options.

## Run and edit

Open `source/index.html` directly or serve it over HTTP. This is one offline file with no runtime downloads or external dependencies. It uses a custom WebGL2 renderer, not the previous Three.js runtime.

Editable modules, the original build tools, and the supplied tests are under `source/project/`. With Node 20 or newer:

```sh
cd games/royal-sumo/source/project
node build.js --check
node test/run.mjs
node build.js
```

The build writes `dist/index.html`, a versioned HTML file and `build-info.json`. For a future intentional update, copy the newly built HTML to `../index.html`, update version/provenance/changelog and regenerate the repository catalog. Do not overwrite the preserved v1.3.0 original.

Useful editing locations in `source/project/src/`:

- `core/tune.js`, `core/sim.js`, `core/ai.js`: movement, combat, simulation and bots.
- `core/maps.js`, `gfx/gfx_maps*.js`: arena rules and presentation.
- `core/slots.js`, `core/control.js`, `core/remote.js`: seating and input ownership.
- `app/controls.js`, `app/ui.js`, `app/style.css`: inputs, menus and HUD.
- `gfx/engine.js`, `gfx/gfx_core.js`, `gfx/gfx_fighter.js`: rendering and camera.
- `core/versions.js`: separate build, simulation, protocol and save versions.

Changing simulation behavior requires updating the simulation version and reviewing/updating golden results; see the supplied `source/project/RESUME.md` for source architecture context. Its previous-environment paths and prior verification claims are historical.

## Integration and limitations

`window.RoyalSumo` exposes state, seeded scenarios, restarts, player ownership and remote input. See `integration/README.md`. These are in-process hooks: online rooms and phone networking are **not integrated or verified**. The import preserves the supplied game and its native UI; the old CALLBACK camera-code overlay is not grafted onto it.

See `assets/README.md` for provenance and `tests/README.md` for reproducible checks and verification scope. Physical-phone feel/haptics, audio by ear and physical gamepads require hardware checks.
