# Vault v2 party platform design

## Intent and execution ruling

User requests applying Astra Knowledge Vault v2.0 to improve code systems, UI, online connectivity and phone games. Continue the previously reviewed Cloudflare/phone multiplayer plan, preserve the six better standalone demos and the seven Sites party games. This is architectural work within the authorized improvement scope; implement and verify the concrete next milestone rather than asking the user to repeat authorization. Production deployment/account provisioning remains a separate release step.

## Evidence and approach

Vault ASTRA-2026-0127/0128 supplies transport separation and shared game orchestration. Current Moku targets P2P LAN by default, advertises eight controllers, and does not provide default gameplay relay fallback; directly replacing the ten-seat, anyone-online design would lose requirements. Use original code inspired by these boundaries, keep npm/TypeScript/Workers, and ship Cloudflare WebSocket room transport first. WebRTC fast-lane experimentation remains optional behind the same intent interface; do not add a brittle dependency/framework migration.

## Components

- Safe asset staging serves all six imported entries and local dependencies through the actual Worker. Catalog has real standalone Play links and shared-screen Host links.
- One SQLite-backed `ArcadeRoom` Durable Object owns room code/game ID, lifecycle, capacity, opaque host/seat credentials, reconnect identity, strictly increasing input sequences, payload/rate limits, connection state and expiry. D1 remains catalog-only.
- Browser host remains the sole existing game simulation. Phones are controllers, not independent simulations. Host-origin state is trusted-party output, not cheating-resistant server scoring; public competitive leaderboards require a later renderer-independent simulation.
- Shared host/controller pages consume one transport protocol and per-game adapters. Controller input is bounded movement plus game actions. Room lifecycle and input traffic are separate message types.
- Accessible phone controls support multitouch, pointer cancellation, held-input release, backgrounding, reconnect feedback and latency display; no canvas-only forms. Browser-session credentials stay out of URLs and public snapshots.

## Stable protocol for implementation

POST `/api/rooms` with `{gameId}` -> `{code,hostToken,gameId}`; POST `/api/rooms/<code>/join` with `{name,token?}` -> `{code,seat,seatToken,gameId}`. Credentials must never be in URL query strings. GET `/api/rooms/<code>/socket` upgrades; first message `{type:'auth',role:'host'|'controller',token}`. Subsequent messages have `v:1`.

Server: `{type:'welcome',seat?,room}` and `{type:'room',room}`; public room `{code,gameId,phase:'waiting'|'running'|'paused'|'ended',hostConnected,slots:[{seat,name,connected,bot}]}`. Slots 1–9 replace bots; seat zero is host/local player, ten total contestants. Claim/release notifications to host `{type:'seat',seat,connected,name}`; validated input to host `{type:'input',seat,sequence,payload}`. Phones send `{v:1,type:'input',sequence,payload}` where payload `{moveX,moveY,primaryAction,secondaryAction,tertiaryAction,run,lane?}` has finite axes within [-1,1], boolean actions and optional integer lane0–3. Host commands `{v:1,type:'start'|'pause'|'resume'|'restart'}`. Ping/pong for heartbeat/RTT. Host `{v:1,type:'snapshot',data}` is bounded, clearly designated-host state. Do not accept controller scores/phase/seat claims.

Create/join/configure are real routes, not placeholders. Room expiry is bounded; reconnect preserves server-assigned seat/token and rejects replaced/stale sockets. Socket auth failure and host disconnect neutralize input, pause gameplay and show actionable status. On controller disconnect/background timeout, release held state and hand slot back to bot; reconnect reclaims it. Persist minimal lifecycle/seat identity needed for restart, not high-frequency movement into D1. Treat cold host-runtime recovery as paused/restart, not silently resumed canonical physics.

## Boundaries and acceptance

No paid AI/image calls, credential printing, source overwrite, physics/camera retuning or framework migration. Only necessary source input hooks may change, with archived original bytes and targeted regressions. Game adapters declare unsupported capability honestly; no ready status before verified tests. All six standalone pages must remain playable.

Acceptance: manifest-safe staged assets; all six game module dependencies resolve through Worker; invalid token/seat/sequence/phase/action/flood cases rejected; ten slots including host, eleventh denied; reconnect same identity without duplicate ownership; host plus two browser controllers performs actual input/bot replacement; two isolated rooms; controller release neutralizes; 390px layout/focus/no overflow; no live-deploy claim from local tests. Physical Safari/Chrome devices and real mobile networks remain release checks.

Implementation detail: controller cancel frames carry v/type/sequence and relay a neutral:true marker, ensuring backgrounding/pointer cancellation is distinct from deliberate charged-action release. Cold host recovery requires New round. Hibernation preserves real heartbeat timestamps and neutralizes held inputs on message/alarm/status/close wake.
