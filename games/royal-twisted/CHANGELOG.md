# Changelog

## 2026-10-02 — vault v2 room adapter

- Shared authenticated room and game-specific phone controller replace bot seats without retuning physics/cameras/scoring.
- Added pause/cancel and remote-seat hooks as required; retained the pre-room packaged page under source/original/.
- Real local Worker join/start/pause/resume/same-seat refresh browser checks passed. Multiplayer remains in-progress until production physical-phone testing.

## Import review corrections — 2026-10-02

- Included the required Three.js r180 `three.core.js` dependency beside `three.module.js`.
- Made the existing state snapshot update when the debug panel is disabled. Physics, camera and gameplay tuning are unchanged.
- Added canonical dependency and state-hook regression checks.

## 0.5.0 — imported

- Imported the latest complete chat build: `royal_twisted_spiral_keep_v0.5_original_camera_knockback.html`.
- Preserved v0.5 jumping/ducking, seven-strike elimination, scoring, accelerating choreography, hit knockback/recovery, three-quarter pack camera, fixed-step simulation, adaptive 2–10 contestant layout, bots, touch/keyboard controls, gamepads, procedural visuals/audio and debug hooks.
- Packaged the game as `source/index.html`.
- Vendored Three.js r180 under `assets/vendor/` and changed the single module import from jsDelivr to the local copy. No gameplay tuning values or simulation rules were changed by intake.
- Added documentation, provenance, smoke tests and integration notes.
- Source status is `imported`; multiplayer remains `not-integrated`.
