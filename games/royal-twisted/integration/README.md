# Royal Twisted integration contract

## Status

**Source import:** imported.
**Phone / room-code multiplayer:** not integrated.

The standalone game has useful control hooks, but they are not the authenticated transport contract in `docs/GAME_SDK.md`.

## Slots and bots

- Valid indices are `0..playerCount-1`; `setPlayerCount` clamps to 2–10 and restarts.
- Slot 0 is local by default.
- Slots 1–9 default to `ai`, so 10 contestants supports one human plus nine bots.
- Browser gamepads can replace matching AI slots.
- Remote-claimed slots are protected from gamepad takeover.

## Existing hooks

```js
RoyalTwisted.version
RoyalTwisted.getState()
RoyalTwisted.restart()
RoyalTwisted.getPlayerCount()
RoyalTwisted.setPlayerCount(count)
RoyalTwisted.registerRemotePlayer(slotId, displayName)
RoyalTwisted.releaseRemotePlayer(slotId)
RoyalTwisted.input(slotId, command, value)
RoyalTwisted.jump(slotId)
RoyalTwisted.duck(on, slotId)
```

Example:

```js
RoyalTwisted.setPlayerCount(10);
RoyalTwisted.registerRemotePlayer(3, "Danny");
RoyalTwisted.input(3, "jump", true);
RoyalTwisted.input(3, "duck", true);
RoyalTwisted.input(3, "duck", false);
RoyalTwisted.releaseRemotePlayer(3);
```

Jump is an impulse/request. Duck is held state and requires release.

## Bot control

`aiUpdate()` runs only when `fighter.controller === "ai"`. Remote/gamepad ownership stops AI decisions for that slot. Releasing a non-local remote slot restores `ai` and clears held duck state.

## State access

`RoyalTwisted.getState()` currently exposes version, phase, round, time, speed, FPS, detailed slot-0 state, nearest slot-0 hazard, alive/total counts, controller type for each contestant and choreography debug timing. It is **not** a full authoritative per-contestant multiplayer snapshot.

## Remaining multiplayer work

1. Server-created rooms and opaque seat credentials.
2. Authenticated JSON controller → authoritative host transport.
3. Protocol version and monotonic per-seat sequence numbers.
4. Schema/size/rate/membership/seat/phase/action validation before `RoyalTwisted.input`.
5. Duplicate/out-of-order rejection.
6. Disconnect neutralization and deliberate bot substitution/reconnect.
7. Credential-bound reconnect.
8. Full host snapshots for TV/lobby/controller state.
9. Replayable validated input/event logging.
10. Automated integration checks plus hash-bound SDK evidence before changing multiplayer status.

Keep room/auth logic outside `fixedUpdate`, collisions and AI. Do not run independent phone simulations. Slot 0 is coupled to local keyboard/touch; initial phone integration should replace bot slots 1–9.
