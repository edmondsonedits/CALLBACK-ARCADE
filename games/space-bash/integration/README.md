# Space Bash integration boundary

## Current source behavior

The imported v1.13.1 standalone source supports **2–10 total contestant slots**.

- Slot 1 (fighter.id === 0) is the local human.
- Slots 2–10 (fighter.id > 0) are bot-controlled.
- step() directly drives slot 1 from local joystick/keyboard state and directly calls ai(f, dt) for every slot with id > 0.
- Fighter objects include a control field (local for slot 1, cpu for the others), but the simulation does not currently branch on that field.
- The simulation runs in the host page at a fixed 1/120 second step.

## Existing public hooks

The source exposes:
- window.SpaceBash.version
- window.SpaceBash.setPlayers(n)
- window.SpaceBash.getState()

setPlayers(n) clamps to 2–10 total contestants and restarts the match.

getState() returns version, playerCount, round, timeLeft, phase, alive, wins, and tiles. This is useful for host UI/debugging but is not sufficient for network reconciliation or replay.

## Bot control

Bots use the same gameplay helpers as the local player (drive, grabThrow, kick, jump), but ai(f, dt) invokes those helpers internally. There is not yet one shared validated input-command path for humans and bots.

## Multiplayer status

**Not integrated.**

The source is imported and locally playable, but there is no evidence supporting an online or multiplayer-ready claim. Missing pieces include:
- room-code lobby
- authenticated transport
- server-issued seat token
- per-seat monotonic sequence handling
- bounded JSON input schema
- stale/duplicate/out-of-order rejection
- remote input injection API
- reconnect path
- authoritative network snapshot publication
- replayable validated event stream

## Required architecture before phones replace bots

Follow docs/GAME_SDK.md.

1. Introduce a game-owned per-seat input structure with moveX, moveY, primary action, secondary action, jump, sequence, and timestamp.
2. Give each fighter a seat/control mode: local, remote, or bot.
3. Make local touch/keyboard write commands into that input layer rather than invoking gameplay functions directly.
4. Convert bot AI output into the same command format rather than calling gameplay actions directly.
5. Expose narrow host adapters such as setSeatMode(slot, mode) and submitInput(slot, command).
6. Validate slot bounds (1–10), command type, numeric ranges, phase, sequence, and action rate before applying commands.
7. When a phone joins CALLBACK, the authoritative host assigns the authenticated seat and flips that slot from bot to remote.
8. On disconnect/stale input, neutralize movement and optionally return the seat to bot control.
9. Keep scoring, eliminations, crates, timers, winners, and random/event generation authoritative on the host.
10. Publish bounded snapshots and record accepted inputs/events for diagnosis.

Phone clients must never choose a trusted player ID or claim score, phase, winner, or simulation state.

Do not set multiplayer.status to verified until automated checks and a JSON evidence record under integration/ or tests/ satisfy docs/GAME_SDK.md and hash every manifest source path.
