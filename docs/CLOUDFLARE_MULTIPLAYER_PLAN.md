# Cloudflare and phone multiplayer: next implementation

This is an implementation handoff, not a deployed service. See [IMPORT_REVIEW.md](IMPORT_REVIEW.md) for current evidence. The seven party games remain on ChatGPT Sites.

## Intended first release

One host opens the arcade on a shared screen, selects a game, and creates a room. Phones scan a QR code or enter its code and receive a controller for that game. Server-assigned human seats replace bots up to ten total contestants. Guests need no GitHub or Cloudflare account.

Use GitHub for canonical source, a Cloudflare Worker with static assets for the host/controller pages and API, one Durable Object per room for authenticated connections and seat/lobby state, and D1 for the metadata catalog. Do not write high-frequency movement into D1. Optional later result/history storage is separate from the live input path.

The first party-room adapter can preserve one designated host browser's existing simulation, as described in GAME_SDK.md. Cloudflare authenticates seats and validates messages; that alone does not make host-generated scores or physics server-authoritative. Host disconnect must pause/end the room, not silently create independent phone simulations. Before open public matchmaking or trusted leaderboards, extract a renderer-independent simulation into the server runtime and validate its CPU budget, deterministic results, and recovery. Do not describe the initial relay as cheating-resistant server simulation.

## 1. Consolidate reviewed imports

- Merge the reviewed combined import candidate after its CI passes. It contains the five source packages and regenerates one catalog/seed, avoiding conflicting generated files from the individual import PRs.
- Keep Royal Sumo awaiting import; no complete source is present.
- Preserve each standalone page as the known-working baseline. Record future adapter modifications separately in its changelog.

## 2. Serve the actual game packages

- Add an asset-packaging script that stages the catalog plus each imported game's entry, local modules and assets into an ignored build directory. Preserve relative paths, including both Three.js files and their notices. Validate manifest paths and prevent traversal/symlink escapes.
- Point both Wrangler asset bindings at that build output. Add real catalog Play/Host links only when those routes exist. Currently `public/` contains only catalog UI; a successful deploy of today's configuration does not serve the imported demos.
- Test all entry URLs and dependent modules through the actual Worker, including unknown-game 404, desktop/phone layout, and no external dependency requirement.

## 3. Implement one real room and Ballistix adapter

- Add Worker routes for creating a room, joining it and connecting WebSockets. Add a SQLite-backed `ArcadeRoom` Durable Object class, namespace binding and migration declaration to local/production configurations.
- The room owns its game ID, capacity, host credential, opaque seat credentials, seat-to-connection mapping, lobby/start lifecycle and reconnect policy. Room codes locate rooms; they are not seat credentials. Expire abandoned rooms and bound room creation/join attempts.
- Validate protocol version, payload size/action schema, seat membership, phase, rate and strictly increasing sequence before forwarding input. Clients must not select another player's trusted seat or claim authoritative scores/winners.
- Build `/host/...` and `/join/...` pages with QR/code entry, player names, available seats, connection status, accessible phone controls and an explicit start action. Allocate one human plus nine bots where supported; joining phones replace bots, without requiring ten humans.
- Wrap `RoyalBallistix.setPlayerInput` and `releasePlayer`. Clear held Magnet/Run/movement on pointer cancel, page hiding, disconnect and heartbeat timeout. Reconnect uses the same seat credential and a new validated session sequence epoch; no duplicate seat allocation.
- Send room/host snapshots and results with a versioned protocol. The designated host accepts only messages from its authenticated room connection. Preserve the existing fixed-step physics and tuning. Host output remains trusted-host output until server simulation is implemented.
- Lobby/idle connections may use Cloudflare WebSocket hibernation; do not assume a continuously running game simulation can hibernate without reconstructing state.

## 4. Add the remaining game adapters

| Game | Required work beyond shared room transport |
| --- | --- |
| Royal Roller Ruckus | Reject all stale/replayed sequences, including packets older than its current sequence window; neutralize on disconnect; add actual racer/race/result snapshots. Existing `getState` returns input state. |
| Royal Twisted | Claim/release remote slots; clear held duck; enforce input ordering/timeouts; expose complete per-contestant state rather than its slot-zero debug details. |
| Royal Scratch Match | Map server-assigned seats to `humanPlayers`; reject invalid seat/lane instead of relying on clamping; calibrate audio/round clocks and bounded latency handling before judging remote rhythmic taps. |
| Space Bash | Add per-seat movement/Grab/Kick/Jump input and bot takeover/release. Existing API has setup/coarse-state hooks only and local controls target seat zero. |

## 5. Acceptance checks before deployment

- Automated room tests: wrong-seat token, duplicate/out-of-order messages, invalid actions, flood limits, eleventh join, simultaneous joins, expiry, reconnect and cross-room isolation.
- Browser test: one host plus nine independent controller sessions; bots replaced correctly, controls released on disconnect, reconnect restores the same seat, replayed input rejected, consistent host results.
- Verify two isolated rooms and a host disconnect. Run an extended match/CPU test on the chosen simulation authority. Then physically test iPhone Safari and Android Chrome over Wi-Fi and mobile data; desktop viewport emulation does not cover touch latency, audio autoplay, phone power management or real networks.
- Run canonical tests, typecheck, catalog freshness, build, and actual Worker/browser tests. Bind verification records to the tested source only after actual multiplayer checks pass.

## 6. Cloudflare setup and release

1. Sign into the intended account locally using `node scripts/run-wrangler.mjs login`. Never paste API tokens into chat or Git.
2. Verify the intended account and current Workers/Durable Objects availability and limits. Create the production D1 database; put its real UUID in `wrangler.jsonc`.
3. Include the tested Durable Object binding/migration and actual packaged game assets. Configure host/controller public HTTPS URLs and allowed origins.
4. Run the guarded ID preflight, remote D1 migrations/seed and reviewed production deployment as described in DEPLOYMENT.md. Start on a Workers URL; a custom domain is optional.
5. Verify the live catalog, every included game dependency, room creation, QR/code join, two physical phones, bot replacement, reconnect and health. Keep the previous Worker release available for rollback.

Immediate next development milestone: **Ballistix running through the actual Worker with one shared host and two authenticated phone controllers replacing bots.** After that works locally and on the staging URL, expand to ten seats and the other adapters.

Primary references: [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/), [WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [WebSocket hibernation example](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/).
