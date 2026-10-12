# Royal Sumo v1.3.0 integration boundary

The active standalone browser page owns simulation, scoring, rendering and bots. `window.RoyalSumo` is an in-process API; it is not an online transport.

## Current API

- `version`, `versions`, `protocol`: build 1.3.0, simulation 1.2.1, protocol 2, save 1.
- `getState()`, `scenario(options)`, `restart(options)`, `resume()`, `setSeed(value)`.
- `multiplayer.maxPlayers`: 10.
- `multiplayer.getSlots()`, `setFighterCount(count)`.
- `multiplayer.setHumanSlot(id, enabledOrOwner, options)`, `setOwner(id, owner, options)`.
- `multiplayer.setPlayerName(id, name)`, `setLook(id, style)`, `setBotSkill(id, skill)`.
- `multiplayer.submitInput(id, command)`, `setRemoteTimeout(milliseconds)`.

Seats have `bot`, `local` or `remote` ownership. Local devices are `p1`/`p2`; unclaimed seats use bots. Ownership changes clear stale remote input. Remote ownership is session-only; names and looks can persist.

## Remote command format

Movement is `moveX`/`moveY` (or `mx`/`mz`), clamped to -1..1. `bashDown`/`bash` holds or releases a charge; `bashPressed` requests a one-shot strike with `bashCharge`/`bashPower`. `dashPressed`/`dash` requests a one-shot dash. `sequence` is optional. Silence defaults to neutral input after 5 seconds. Only remote-owned seats in a real match accept external control.

The provided implementation rejects older sequence values under its wrap-aware rule, but accepts equal sequence values. This is not strict duplicate rejection or authenticated seat ownership.

## Still required for online CALLBACK play

Follow `docs/GAME_SDK.md`: authenticated rooms and server-issued seat credentials; bounded, versioned input messages; strict sequence/duplicate checks, membership and phase validation, rate limits; credential-bound reconnect; validated bot substitution; replayable input records and authoritative snapshots. Phones should send inputs to this game host, not run competing authoritative simulations.

Multiplayer remains `in-progress`, without verified evidence. The supplied unit tests exercise local API behavior, not online phone sessions.
