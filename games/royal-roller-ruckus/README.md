# Royal Roller Ruckus — Crownway Circuit

Royal Roller Ruckus is a 2–10 racer physics game built around momentum, collisions and a narrow vertical circuit. The active standalone build is **v1.5.0 — Crownway Coach**.

Choose Squire / Knight / Champion bots, 2–10 racers, and one-lap practice, a three-lap race or five-lap endurance before starting. Cross the seven checkpoints and finish gate in order. Gold deck chevrons point forward; the lit gate is your next checkpoint. Momentum carries through bends and collisions. Gold crownlines reward clean apexes; dark stone scrubs speed.

The optional corner coach explains direction, missed gates, exposed edges and recovery. Lap timing only advances at a legally crossed finish gate. Results show each recorded finish time, lap splits, recovery count and personal bests scoped to difficulty, racers and laps. Rivals still on track are explicitly marked; the game retains its existing completion policy of ending once participating humans finish.

## Controls

- Touch: camera-relative analog roll / steer; optional right-side stick.
- Keyboard: WASD / arrows; opposite input brakes before reversing.
- P / Escape: pause. Held input is cleared on pause, settings, blur and hidden tabs.
- R or the recovery button: return to the last earned checkpoint after a real fall.
- Gamepad: left stick steers, Start toggles pause, B recovers after a fall. Actions trigger on press edges; after pause, menus or recovery, release the stick through neutral before steering resumes.
- `window.CallbackInput`: existing `push()`, `disconnect()`, `setPlayerCount()`, state, lobby and controller hooks, up to ten seats.
- `window.CallbackCamera`: existing rotate / zoom / tilt controls and reusable CAM codes, under Advanced settings.

Race-rule changes apply on explicit restart / Race Again. Volume, mute, graphics, haptics, reduced motion, handedness and coaching apply immediately and persist when storage is available. Reduced motion defaults to the browser preference and suppresses shake, flashes, speed zoom, particles and decorative animation. Audio remains locked until a user gesture.

## Source

- Active entry: `source/index.html`.
- Preserved upload: `source/original/royal_roller_ruckus_v1.4_vertical_crownway.html` (unchanged).
- Bundled renderer: `source/vendor/three.module.js`, `three.core.js` and `LICENSE-three.txt`, copied byte-for-byte from the repository's existing Three.js r180 distribution. Serve over HTTP(S); WebGL2 remains required. No runtime CDN fetch or new renderer version.
- Current verification and source hashes: `integration/sumo-benchmark/verification.json`.

## Verification

Run `node --test tests/royal-roller-ruckus-quality.test.mjs tests/royal-roller-ruckus-sumo-benchmark.test.mjs` and `node games/royal-roller-ruckus/tests/source-smoke.mjs` from the repository root. See `tests/README.md` for actual-course, camera and browser checks. CPU-side Three.js checks do not establish device rendering, audio, touch or gamepad validation.

## Multiplayer and tuning

Remote hooks exist; authenticated CALLBACK room transport remains unfinished and multiplayer is not verified. Movement, collisions, camera, bots and round parameters remain in the inline `TUNING` object. The Crownway simulation, vertical crossover, ordered gate authority and camera controls were preserved.
