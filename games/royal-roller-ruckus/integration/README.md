# CALLBACK integration boundary

## Runtime ownership

The host page in `source/index.html` owns the full authoritative local simulation using a fixed `1/120` second step. It owns racer physics, AI, collisions, laps/results, camera, audio and recovery. Phones should eventually send validated input only.

## Player slots and bots

- Capacity: **2–10**.
- Default active racers: **4**.
- Seat 0: local keyboard/touch/gamepad human.
- Seats 1–9: AI by default.
- Accepted remote input can take over a seat without recreating racer state.
- If remote input becomes stale/disconnected, AI retakes that racer after the configured grace period.

This supports one human plus nine bots, with future phones replacing bot seats.

## Existing hook

The page exposes `window.CallbackInput`:

- `version: 2`
- `maxPlayers: 10`
- `push(playerId, packet)`
- `disconnect(playerId)`
- `setPlayerCount(count)`
- `getPlayerCount()`
- `getState(playerId = 0)`
- `getControllers()`
- `getLobby()`

Current packet fields:

```json
{
  "sequence": 1,
  "moveX": 0.0,
  "moveY": -1.0,
  "primaryAction": false,
  "secondaryAction": false,
  "name": "Player"
}
```

Movement is clamped to [-1, 1], names are bounded, sequences are checked, and stale live input is neutralized by timeout. Current gameplay uses movement only; action fields are reserved.

## State access

`getState()` returns a normalized input slot. `getControllers()` reports controller/source/connection state for active racers. `getLobby()` reports all ten seat records.

There is **no full public simulation snapshot API** yet; authoritative position, velocity, lap and finish-result state remain internal.

## Missing work before verified phone multiplayer

1. Room creation and room-code joining.
2. Server-issued opaque room/seat credentials; phones must not choose trusted player IDs.
3. Authenticated versioned transport with per-seat monotonic sequence and bounded payloads.
4. Authoritative validation of membership, seat ownership, phase, rate/size, sequence and allowed actions before applying input.
5. Credential-bound reconnect.
6. Host snapshot publication as needed.
7. Deterministic replayable validated event stream.
8. Explicit authoritative result/score export.
9. Bot substitution aligned with the same trusted seat/action boundary.
10. Hash-bound automated verification records required by `docs/GAME_SDK.md`.

## Readiness

Source import and multiplayer readiness are separate. The manifest therefore marks source **imported** and multiplayer **in-progress**, not verified.
