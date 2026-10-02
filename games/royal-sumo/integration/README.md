# Royal Sumo integration boundary

This records the **current v0.21 source hooks** and the gap between them and the future authenticated CALLBACK room/controller contract in `docs/GAME_SDK.md`.

## Current authoritative simulation

The browser page running `source/index.html` owns movement, collisions, Bash/Dash, stability, knockouts, bots, arena shrinking, scoring and rendering.

Phones must eventually send input to this host. They must not run independent simulations and reconcile results afterward.

## Contestant slots

- Maximum: **10** slots, IDs 0–9.
- Minimum configured fight: 2.
- Slot 0 is the standalone local player and owns the on-screen controls.
- Slots 1–9 default to AI unless marked human.
- `configuredFighterCount` chooses active slots.
- `humanSlots` records locally claimed human slots.
- Unclaimed active slots are filled by the existing AI.

Current display names are local source data, not authenticated identities.

## Current public hooks

The game exposes `window.RoyalSumo`.

### State

- `RoyalSumo.getState()` — deep-copied structured runtime/debug state.
- `RoyalSumo.multiplayer.getSlots()` — slot ID, name, ownership, alive state and crowns.
- `RoyalSumo.multiplayer.maxPlayers` — 10.

### Match/setup

- `RoyalSumo.multiplayer.setFighterCount(count)`
- `RoyalSumo.multiplayer.setHumanSlot(id, enabled)`
- `RoyalSumo.multiplayer.setPlayerName(id, name)`
- `RoyalSumo.restart()`
- `RoyalSumo.resume()`
- `RoyalSumo.scenario(name)`

### Remote input

`RoyalSumo.multiplayer.submitInput(id, command)`

Current command fields:

- `moveX`: number, clamped -1..1.
- `moveY`: number, clamped -1..1 and mapped to world Z by the current hook.
- `bashPressed`: boolean one-shot request.
- `bashCharge`: number, clamped 0.12..1 when Bash is queued.
- `dashPressed`: boolean one-shot request.
- `sequence`: numeric value stored on the slot input object.

The hook drives the standalone movement/Bash/Dash functions, but it is only a local imperative API. It is **not a secure network contract**.

## Bot control

Bots call `updateAI()` directly. Human-marked non-local slots use `updateRemoteHuman()`; switching a slot back returns it to AI.

This preserves one-human/nine-bot play, but does **not** yet satisfy the SDK goal that future bot substitution use the same validated authoritative action path as connected players.

## Existing integration seams

- 10 bounded contestant slots.
- AI fills unused seats.
- Slot ownership can switch from bot to remote-human handling.
- Movement/action input is abstracted away from the visual joystick for slots 1–9.
- The simulation stays on one authoritative game page.
- Structured state and slot snapshots are exposed.
- A per-slot `sequence` field exists as a future seam.

## Missing before multiplayer can be verified

1. Room-code create/join flow.
2. Authenticated transport.
3. Server-issued opaque room and seat credentials.
4. Protocol version on every input.
5. Host validation that credentials own the target seat.
6. Strict action/payload schema and size bounds.
7. Input rate limiting.
8. Monotonic sequence enforcement; v0.21 stores `sequence` but does not reject duplicate/out-of-order input.
9. Phase/deadline validation before actions are applied.
10. Disconnect handling that neutralizes stale input.
11. Credential-bound reconnect and seat restoration.
12. Bot substitution through the same validated action path.
13. Deterministic/replayable validated input event recording.
14. Authoritative snapshot publication to phones.
15. Tests proving unauthorized, stale, duplicate and out-of-order inputs cannot affect the game.

## Recommended adapter

Keep Royal Sumo's simulation authoritative. Add a thin CALLBACK host adapter that validates SDK actions before translating them into `setHumanSlot` and `submitInput`.

Authentication, room membership, seat ownership, sequence rejection, rate limits and replay recording should happen outside the raw game hook before it is called.

When a phone claims a seat, mark that slot human. When it disconnects or times out, neutralize its input and return the slot to a bot according to room policy.

Do not mark `multiplayer.status` as `verified` until the required JSON verification record exists and hashes the current source files as defined in `docs/GAME_SDK.md`.
