# Royal Ballistix integration boundary

## Current status

- **Source import:** imported and self-contained.
- **Standalone local play:** source supports one local human with AI filling other active seats.
- **Contestant capacity:** 2–10.
- **Phone/room-code multiplayer:** **not integrated**.
- **Verified multiplayer evidence:** none.

The imported host simulation must remain authoritative when network controllers are added.

## Existing runtime hooks

The source exposes `window.RoyalBallistix`:

### `maxPlayers`

Value: `10`.

### `setPlayerCount(n)`

Sets total contestant slots from 2 through 10, resets match wins and rebuilds the arena.

### `setArenaSize(percent)`

Adjusts arena display/gameplay scale. The UI currently clamps the setting to 80–135%.

### `setPlayerInput(id, state)`

Marks a seat as externally controlled and supplies its current controller state.

Current state shape:

```js
{
  moveX,          // number, clamped -1..1
  primaryAction,  // boolean: Magnet hold
  secondaryAction,// boolean: Pulse edge-trigger
  run,            // boolean
  sequence,       // accepted/stored but not validated
  timestamp       // accepted/stored but not validated
}
```

Seat IDs are zero-based. The current local player is seat 0 unless that seat is externally overridden. Other non-external seats run the existing AI.

### `releasePlayer(id)`

Removes external control from a seat. The seat can return to its normal local/AI behavior. Any held Magnet state is released.

### `getState()`

Returns structured game state including phase, round, player count, arena scale/pixels, wins, FPS, physics substeps, ball state, player state and tuning.

`window.GameDebug.getState()` exposes the same state snapshot.

## Bot behavior

Every active seat other than the local seat uses the game's AI unless `setPlayerInput` has marked that seat externally controlled. Bot personalities include different risk, hold timing and targeting tendencies. The current source therefore already supports the desired **one human + up to nine bots** standalone configuration.

## What is missing for CALLBACK phone multiplayer

The current JavaScript API is an integration seam, not a secure multiplayer contract. A production adapter still needs:

1. Room creation and room-code join flow.
2. Server-issued opaque seat credentials; phones must not choose trusted seat IDs.
3. Authenticated, versioned JSON input transport.
4. Host-side validation of membership, seat ownership, action schema/size/rate and current phase.
5. Monotonically increasing per-seat sequence enforcement; reject duplicate/out-of-order inputs.
6. Stale-input neutralization on disconnect.
7. Credential-bound reconnect and seat restoration.
8. Bot replacement/reinstatement through the same validated host action path.
9. Authoritative snapshots from the host simulation to phones/TV as needed.
10. Deterministic replay/event logging for diagnosis.

The existing `sequence` and `timestamp` fields are not security or ordering controls yet; they are simply carried in the input object.

## Recommended adapter direction

Keep `source/index.html` authoritative for simulation. Add a thin host adapter that translates validated CALLBACK controller messages into `RoyalBallistix.setPlayerInput(seat, state)` calls and invokes `releasePlayer(seat)` after validated disconnect/timeout handling.

Do not run independent phone simulations and reconcile them later.

## Readiness rule

Do not change `multiplayer.status` to `verified` until the repository's GAME_SDK contract is implemented and a valid hash-bound JSON verification record exists under `integration/` or `tests/`.
