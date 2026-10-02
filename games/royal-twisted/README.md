# Royal Twisted — Spiral Keep

Royal Twisted is a reaction/survival party minigame for 2–10 total contestant slots. The imported v0.5 build preserves the chat-developed gameplay, physics, visuals, controls, AI rivals, fixed-step simulation, hit knockback, adaptive camera and solo-with-bots behavior.

## Gameplay

Contestants run up a giant spiral keep while rods sweep down the course. Low cyan rods must be jumped; high coral rods must be ducked. A cleared rod scores. A missed rod costs one of seven strikes and knocks that contestant backward down the spiral, temporarily increasing reaction distance before they recover toward the pack. Rounds continue until one contestant remains; the match uses best-of-three regulation with sudden death on a tied match state.

Core loop: read the incoming rod → choose jump or duck → time the action → clear or take a hit → recover → react again as the course accelerates.

## Players and bots

- Supported contestant count: 2–10.
- Default standalone count: 4.
- Slot 0 is the local human by default.
- Unassigned slots are AI-controlled.
- At 10 contestants, the standalone build supports one local human plus nine bots.
- Additional browser gamepads can control extra slots.
- Existing remote-control hooks can claim bot slots, but no room-code/network transport exists yet. See `integration/README.md`.

## Controls

Local slot 0:
- Jump: `Space`, `ArrowUp`, `W`, or on-screen **JUMP**.
- Duck: hold `Shift`, `ArrowDown`, `S`, or on-screen **DUCK**.
- Pause: `Escape` or pause UI.

Gamepads use button 0 / D-pad Up for jump and button 1 / D-pad Down for duck. Browser gamepad indices map to contestant indices where available; remote-claimed slots are not overwritten by gamepad polling.

Touch input uses pointer events with page scrolling disabled.

## Running locally

```bash
cd games/royal-twisted
python -m http.server 8000
```

Open `http://localhost:8000/source/index.html`.

## Source and dependencies

- Entry point: `source/index.html`.
- Three.js: `assets/vendor/three.module.js`, upstream r180 / npm 0.180.0, MIT licensed.
- Three.js license: `assets/vendor/three-LICENSE.txt`.
- Provenance: `assets/PROVENANCE.md`.

The chat build used a pinned jsDelivr Three.js import. This package vendors the same r180 module and changes only that import path, so gameplay logic remains unchanged and runtime no longer depends on the CDN.

## Tuning locations

Gameplay tuning is centralized near the top of `source/index.html` under `TUNING`: rounds, fixed-step simulation, speed, jump, camera, hit knockback/recovery, hazard timing and pacing. AI reaction/error/duck timing is in the `AI` table immediately below it.

## Runtime/debug API

The build exposes `window.RoyalTwisted` and `window.GameDebug`. Integration hooks are documented in `integration/README.md`.

## Known limitations

- Phone room-code multiplayer is not implemented.
- Current remote hooks trust caller-supplied slot IDs/actions and are not a secure network boundary.
- `getState()` is a debug snapshot, not complete authoritative per-contestant state.
- Slot 0 remains coupled to local host input; bot replacement is cleanest for slots 1–9.
- Procedural audio is prototype-quality.
- Human browser playtesting of this repository copy is still required.

## Modifying the game

Preserve the fixed timestep, centralized tuning and bot fallback. Keep future room/auth networking outside collision/AI simulation and route validated phone commands through an adapter. After source changes run `node tests/smoke.mjs` and repository checks, update `CHANGELOG.md`, and do not mark multiplayer verified without SDK-required JSON evidence and source hashes.
