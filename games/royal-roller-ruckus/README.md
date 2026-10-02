# Royal Roller Ruckus — Crownway Circuit

Royal Roller Ruckus is a 2–10 racer physics game built around momentum, collisions and a narrow vertical circuit. The active imported build is v1.4.0.

## Gameplay
Roll and steer the cage through checkpoints for three laps. Speed carries through turns, collisions transfer momentum, and fallen racers can recover at checkpoints.

## Controls
- Touch: analog roll/steer control
- Keyboard: WASD or Arrow keys
- P: pause
- Respawn button: recover at the last checkpoint
- Remote hooks: `window.CallbackInput.push()`, `disconnect()`, `setPlayerCount()`, lobby/controller state
- Racers: 2–10

## Source
- Active: `source/index.html`
- Preserved upload: `source/original/royal_roller_ruckus_v1.4_vertical_crownway.html`

The build loads Three.js 0.180.0 from jsDelivr.

## Multiplayer
Remote input/lobby hooks exist in the standalone source, but authenticated CALLBACK room transport and server-authoritative validation remain unfinished.

## Tuning
Movement, collisions, camera, AI and round parameters are in the inline `TUNING` object.