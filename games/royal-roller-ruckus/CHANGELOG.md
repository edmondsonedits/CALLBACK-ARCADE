# Changelog

## 2026-10-02 — vault v2 room adapter

- Shared authenticated room and game-specific phone controller replace bot seats without retuning physics/cameras/scoring.
- Added pause/cancel and remote-seat hooks as required; retained the pre-room packaged page under source/original/.
- Real local Worker join/start/pause/resume/same-seat refresh browser checks passed. Multiplayer remains in-progress until production physical-phone testing.

## Import review correction — 2026-10-02

- Included the required Three.js r180 `three.core.js` dependency beside `three.module.js`; the previously incomplete module package prevented startup.
- Added a regression check for local module dependencies. Original game source and gameplay tuning are unchanged.

## 1.4.0 — CALLBACK Arcade import

- Imported the complete **Royal Roller Ruckus v1.4.0 — Vertical Crownway** build from the development chat.
- Preserved the exact chat HTML at `source/original-v1.4.0.html`.
- Added `source/index.html` as the runnable entry; gameplay code is unchanged except the Three.js import resolves to the vendored local dependency.
- Preserved 2–10 racers, one-human-plus-bots play, racecraft AI, fixed 120 Hz simulation, momentum/collision physics, player-focused camera, procedural rider animation/audio, Crownline/rough terrain, elevation and recoverable airborne landings.
- Added source provenance/rights notes, tests and integration documentation.
- Classified source as `imported`, lifecycle as `experimental`, and multiplayer as `in-progress`; no online/verified claim is made.
