# Game SDK and trust boundary

This repository currently hosts a catalog, not games or multiplayer simulation. Imported games may remain whole standalone HTML pages; preserving their existing simulation and input hooks is the default. Each game owns its source, assets, tests, and integration contract.

## Future online input contract

A production adapter must use JSON over an authenticated transport. The server issues opaque room and seat credentials; clients never choose a trusted player ID or claim phase, deadline, score, winner, or simulation result. Host and phone seats are bounded by the game's declared capacity (at most ten here). Every input includes a protocol version, server-issued seat token, monotonically increasing per-seat sequence, action type, and bounded payload. Validate room membership, seat ownership, input schema/size/rate, current phase, sequence, and allowed action on the authoritative host before applying it. Duplicate and out-of-order inputs are rejected. On disconnect, neutralize stale input and support credential-bound reconnect. Bot substitution must use the same validated action path. Record a deterministic replayable event stream for diagnosis.

This document describes a future contract only. There are no room, join, input, or score endpoints in this foundation. Do not run independent phone simulations and reconcile them afterward; the chosen game host remains authoritative and publishes validated snapshots.

## Metadata versus runtime

`players.min` and `players.max` describe total contestant slots, including bots where the imported game supports them. They are not a minimum human requirement. The three initial demo records are intended to preserve one human with bot-filled remaining slots, then replace those bots as authenticated phones join. Verify each imported game's bot behavior and record its human/bot limits before implementing its lobby adapter.

Repository manifests and source files are canonical. Generated JSON, Markdown, and D1 seed rows are derived metadata. D1 has no game-source blob and no runtime editing/admin endpoint. Worker API routes are read-only and return checked-in catalog data when D1 is unavailable or does not match its content revision.

## Verified multiplayer evidence

`source.status: "imported"` must name a real game entry file under `source/` ending in `.html`, `.htm`, `.js`, `.mjs`, or `.ts`; README and metadata files do not count as game source. `multiplayer.status: "verified"` must reference JSON verification records under `integration/` or `tests/`. Each record uses this format:

```json
{
  "schemaVersion": 1,
  "kind": "arcade-multiplayer-verification",
  "result": "passed",
  "scope": "automated-checks",
  "checks": [{ "name": "input validation", "result": "passed" }],
  "sourceHashes": [
    { "path": "source/game.html", "sha256": "<64 lowercase SHA-256 hex characters>" }
  ]
}
```

List every manifest `source.paths` entry exactly once with its SHA-256 digest. The catalog generator checks that the record is valid JSON, every listed check passed, the hash list matches the manifest, and each current source file still has that digest. Recompute the record after any source change. A passing record is an automated-check attestation bound to those files; it does not prove human playtesting, production operation, licensing, or the truth of an unreviewed check claim.
