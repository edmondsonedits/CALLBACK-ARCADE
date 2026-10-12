# Royal Sumo v1.3.0 integration boundary

The game page owns physics, AI, hazards, scoring and rendering. The supplied release provides local controls and remote-input hooks. The separate CALLBACK adapter adds authenticated phone rooms with a dedicated WebSocket relay; the catalog Worker remains read-only. Public relay deployment is pending.

## Public API

`RoyalSumo.version` is `1.3.0`; `RoyalSumo.versions` reports build `1.3.0`, sim `1.2.1`, protocol `2`, save `1`.

- `getState()` returns simulation state, build/protocol, slots and Cup progress.
- `scenario({fighters:10, map:'keep', seed:21})` starts a match.
- `restart()` replays the same match seed; `restart({seed})` overrides it.
- `multiplayer.maxPlayers` is 10; active matches contain 2–10 contestants.
- `multiplayer.getSlots()` returns the persistent seat table.
- `multiplayer.setOwner(id, 'local'|'remote'|'bot', options)` changes the driver; `setHumanSlot(id, true|false|owner)` preserves the older boolean shorthand.
- `multiplayer.setPlayerName(id,name)`, `setLook(id,style)`, `setBotSkill(id,skill)` customize seats.
- `multiplayer.setFighterCount(count)` restarts with 2–10 fighters.
- `multiplayer.submitInput(id,command)` only accepts inputs for remote-owned seats in a real match.
- `multiplayer.setRemoteTimeout(ms)` changes the default 5000 ms inactivity timeout.

## Input fields

Movement: `moveX`/`moveY` (aliases `mx`/`mz`), normalized and clamped. Bash: `bashDown` (`bash`) for hold/release, or `bashPressed` plus `bashCharge` (`bashPower`) for one strike. Dash: `dashPressed` (`dash`). Optional `sequence` drops older counters; equal counters are still accepted. The timeout neutralizes stale movement and held Bash. Changing owners clears the remote input buffer.

## Network boundary

The standalone API above is trusted host code. Phones use the dedicated `server/` relay and cannot select a seat, modify rules or submit scores. The server authenticates host/seat credentials, derives the fighter ID, validates protocol/schema/size/rate/phase and rejects duplicate or old sequences. Controller reconnect starts at the server-issued `nextSeq`. Credentials are sent in the first WebSocket message, not URL query parameters; durable storage holds hashes.

The host browser owns the full v1.3.0 simulation, scoring and AI. Phones display controller/connection state and watch the shared host screen. The server publishes status and seat rosters; it does not reconcile phone simulations or accept claimed winners. Unclaimed/disconnected fighters use the supplied simulation AI. A two-second heartbeat timeout marks a phone disconnected. Disconnected seats remain reserved for two minutes; End room invalidates the room, including after durable reload.

The relay keeps a bounded in-memory diagnostic event ring of validated input/connection events. This is not a complete deterministic replay or durable match archive. Full replay export and live spectator snapshots are future work. Public deployment, WAN latency and physical-device verification remain outstanding; keep multiplayer **in-progress**.

See [ONLINE_DESIGN.md](ONLINE_DESIGN.md), [../server/README.md](../server/README.md), and [../tests/IMPORT_VERIFICATION.md](../tests/IMPORT_VERIFICATION.md).
