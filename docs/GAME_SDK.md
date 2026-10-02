# Game SDK and trust boundary

Each game owns its source, assets, tests and integration notes under games/<id>. Complete standalone pages remain the default; original pages are archived before adding adapter hooks. Shared infrastructure owns room identity, lifecycle and controller transport.

## Implemented party-room contract

- POST /api/rooms with gameId returns code, gameId and hostToken for an imported game.
- POST /api/rooms/<code>/join with name and optional saved token returns seatToken, seat, sequence and room. A room has local host seat 0 plus phone seats 1–9. Unclaimed and disconnected phone seats use bots; credentials reserve their seat until the one-hour room expires.
- GET /api/rooms/<code>/socket upgrades a WebSocket. The first frame authenticates role and token. No URL carries credentials. Browser session storage supports refresh within the same tab; a closed/lost browser session cannot recover by choosing the same name.
- Later frames use v:1. Controller input includes increasing sequence and a bounded payload with moveX/moveY (-1…1), primaryAction/secondaryAction/tertiaryAction/run booleans and optional lane (0…3). Explicit cancel frames safely release held actions without firing charged attacks.
- Host start/pause/resume/restart control waiting/running/paused state. Host snapshots are presentation data; clients never independently simulate/reconcile a match.
- Five-second heartbeat, fifteen-second connection timeout and two-second held-input timeout are validated server-side. Per-seat input rate is bounded at 30/sec. Authenticated current connections alone receive broadcasts. Hibernation rehydrates attachments and neutralizes inputs on wake.
- A lost host pauses. Reloading/reconnecting a host discards its old simulation, disables Resume and requires New round. Phone seats and accepted sequences survive restart.

See src/room-state.ts for DOM-free state/validation, src/room.ts for Durable Object/HTTP/WS lifecycle, public/transport.js for browser delivery, public/game-adapters.js for six game mappings, and each game's integration/room-adapter.md. Names and room codes are display data; never trust client-chosen roles/seats, scores, timestamps or winners.

## Authority and storage

This casual party version preserves the designated host browser's existing simulation. Cloudflare validates identity, membership, phase, input shape, size, rate and sequence. Host physics and scoring are not server-authoritative or cheating-resistant. Trusted leaderboards/public matchmaking require a renderer-independent server simulation and replay/recovery work.

Manifests and source files are canonical. Generated JSON, Markdown and D1 seed rows are derived metadata. D1 does not store game blobs or high-frequency input. The catalog API remains read-only; real room mutation routes are separate. Metadata players.min/max describes total contestants including bots, not a required human count.

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
