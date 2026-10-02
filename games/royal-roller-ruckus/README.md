# Royal Roller Ruckus

Royal Roller Ruckus is a 2–10 contestant rolling-cage physics party racer built for CALLBACK Arcade. This package imports the complete v1.4.0 **Vertical Crownway** build and preserves its local solo/bot gameplay.

## Gameplay

Race for 3 or 5 laps while managing momentum, traction and physical collisions. Falling is not always a reset: an airborne cage can land on a lower section of the elevated course and continue. Crownline lanes provide a risky directional boost; rough-stone lanes scrub speed. Unclaimed seats remain bot controlled.

The current build supports 2–10 active racers, including one local human with up to nine bots.

## Controls

- **Keyboard:** WASD or arrow keys.
- **Touch:** on-screen analog thumbstick with pointer capture/scroll prevention.
- **Gamepad:** left analog stick for the local player.
- **Future CALLBACK phones:** `window.CallbackInput.push(playerId, packet)` can replace bot seats with external input. This is an input seam only; there is no room-code/authenticated phone transport yet.

`primaryAction` and `secondaryAction` are present in the packet shape but reserved; current racing is movement-driven.

## Run locally

Serve the repository over HTTP, then open:

`games/royal-roller-ruckus/source/index.html`

For example:

```bash
python -m http.server 8000
```

The runnable entry uses the vendored `source/vendor/three.module.js`. `source/original-v1.4.0.html` preserves the exact chat build, whose only external runtime dependency was Three.js 0.180.0.

## Tuning locations

Most values are centralized near the top of `source/index.html`:

- `TUNING.movement`: acceleration, braking, grip, drag and steering.
- `TUNING.collision`: restitution and ten-player pileup release.
- `TUNING.camera`: player-focused chase camera and fall framing.
- `TUNING.animation`: procedural rider response.
- `TUNING.feedback`: collision/edge feedback.
- `TUNING.audio`: procedural rolling, rattle, wind and crowd mix.
- `TUNING.input`: deadzones, network timeout, sequence window and bot handoff.
- `TUNING.rounds`: lap/finish presentation.
- `TUNING.course`: Crownline and rough-zone interaction.
- `TUNING.air`: gravity, airborne steering, landing retention and respawn limits.

Course shape lives in `buildCurve()`. Track width/sample count/cage radius use `TRACK_WIDTH`, `TRACK_SAMPLES` and `CAGE_R`.

## Status

- Source import: **imported**.
- Lifecycle: **experimental**.
- Bots: present; unused seats are AI.
- Human-capable seats: 0–9 through the existing input hook.
- Phone room codes/authenticated seat assignment: **not implemented**.
- Authoritative online transport/snapshot protocol: **not implemented**.
- Multiplayer: **in-progress**, not verified.

See `integration/README.md` for the exact hook inventory and remaining work.

## Known limitations

- Only seat 0 has built-in local keyboard/touch/gamepad input; other humans need an external adapter.
- The current hook accepts a numeric `playerId`; production CALLBACK must map authenticated server-issued seat credentials to seats instead.
- There is no replay/event stream or full public simulation snapshot API yet.
- WebAudio requires a browser user gesture.
- Human playtesting across representative phones is still required before production-readiness claims.

## Modifying the game

Keep `source/original-v1.4.0.html` unchanged as the imported reference. Make runtime edits in `source/index.html`, update `CHANGELOG.md`, and rerun the package smoke test plus repository checks. Do not mark multiplayer `verified` without the hash-bound JSON evidence required by `docs/GAME_SDK.md`.
