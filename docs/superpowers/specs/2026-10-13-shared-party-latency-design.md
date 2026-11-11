# Shared party latency design

Date: 2026-10-13 (America/Toronto)
Status: Proposed design for the requested implementation plan; no product changes or deployment performed. User hosting constraint confirmed: free tier only.

## Outcome and priorities

One party has one public join code, one server authority, up to ten persistent human seats, and a host who can choose successive games without making the phones rejoin. Preserve characters, native player-count rules, private information, authoritative outcomes, accessibility, music and mirror displays. Prioritize input responsiveness. Support regional remote players when measured performance qualifies; offer a true LAN-server option if cloud round trips prevent acceptable same-room play. Do not promise zero network latency.

Scope includes all Arcade, additional practice/prototype, and party-room games, including Blind Crown. Existing main party games must continue to work through the shared lobby. Do not redesign their rules, assets or scoring, generate images, or migrate unrelated AI/media services.

## Source and evidence

The investigation inspected Sites version 72, source a1c825868351819257833caf70944d88b7a08306. Planning confirmed successful public deployment of version 73, source 8c2bb051be3f6e535df430403a71fcf09ad0fe7b. Execution must refresh the actual deployed version and open its source afresh. The existing .sites-qa-live-2026-10-12 checkout contains concurrent music/mirror changes; preserve it and do not use it as the deployment source.

Two Sumo paths currently exist: featured standalone TV simulation with an HTTP/D1 input mailbox, and shared-session online simulation with HTTP/D1 inputs and host-driven ticking. Both have scheduled network waits. The latter sends movement nominally every 100 ms, schedules host tick requests about every 120 ms, polls phones after 300 ms, and renders snapshots without network interpolation. These are code findings, not measurements of the user's session.

A local Node probe, excluding networking/D1/Cloudflare/DOM/phones, ran 4,800 existing Sumo adapter steps with ten scripted players and sixteen seeds: mean 0.859 ms, p95 1.8 ms, maximum 13.686 ms; public JSON payloads reached 19,060 bytes. Re-run against the execution source. This supports reusing the original headless simulation, not a claim of production performance.

## Selected architecture and decision branches

Keep the frontend on the existing ChatGPT Site. Pilot a separate Cloudflare Worker on a verified Workers Free account with one SQLite-backed Durable Object per party, using persistent WSS connections. Site authentication issues short-lived socket tickets; the actor owns active gameplay. Shared game modules remain independent of hosting so a verified no-cost regional Node runner or a user-owned LAN helper can run the same authority and protocol. No paid hosting, subscription upgrade, paid trial requiring billing, or resource with metered overage is authorized.

First prove this with Sumo before porting the library. A backend switch must follow a measured cause:

1. If actor scheduling/CPU or placement prevents the pilot targets, compare a regional Node runner with the identical game adapter, protocol and test workload only when its provider is verified to require no payment and to meet persistent-connection/awake-server needs. If no suitable genuinely free regional host exists, keep Node comparison local and evaluate the user-owned LAN helper; do not provision paid hosting or claim a sleeping free service meets the latency target. Choose the measured winner before library migration.
2. If obsolete TCP delivery is the demonstrated problem under packet loss, trial unordered, partially reliable WebRTC data channels connected to the authoritative Node server; keep reliable session/actions and outcomes. Keep this transport only if it improves p95 responsiveness while passing the same action-delivery, fairness and reconnect checks.
3. If same-room cloud RTT dominates the remaining delay, run the same room authority in a local host helper. Serve local controller/display pages over LAN WebSockets using a direct local join URL/QR. Do not depend on a public HTTPS page opening arbitrary insecure LAN sockets. Check firewall, guest-network isolation and joining usability.
4. If a remote connection cannot qualify for a fast game, explain that limit and offer a spectator seat or a suitable event-based game. Never silently revert an action game to HTTP polling. A same-room label on the existing cloud connection is not a latency fix.

No second database provider, general matchmaking service, universal peer-to-peer mesh, TV-authoritative competitive mode, full-library rollback engine or WebTransport migration is part of the initial implementation. Reconsider a transport only at its decision gate.

## Room lifecycle and protocol

The party actor owns membership, host/mirror roles, current match epoch, ready acknowledgements, pause state and active adapter. Lifecycle: SELECTING -> PREPARING -> COUNTDOWN -> PLAYING -> RESULTS -> SELECTING. Returning to selection keeps the room and sockets. Each match increments matchEpoch. Every input/action includes protocol version, matchEpoch and per-seat sequence; old epochs and repeated actions are rejected or acknowledged idempotently.

Before launch, preload the selected game's assets and publish a future server start time. Ready timeout is 30 seconds: retain slow seats as spectators for that match and enforce the game's original minimum/bot rules; if those cannot be satisfied, return to selection with an explanation. Do not introduce bots into human-only games.

Initial socket tickets expire after 30 seconds, are single use, and bind the immutable party identity, server-issued seat identity and role. Send a ticket as the first socket message, not in a URL. The Site uses its existing HttpOnly session cookies to issue tickets; neither cookies nor shared signing secrets are exposed to game scripts. Socket origin, schemas, sizes and permissions are checked. Match change, reconnect and revocation reset stale control state. Remote renderer and controller instances share a seat identity, but only the selected controller may submit that seat's inputs.

The stable parent party client owns transport even when a game is displayed in a frame. Frames exchange only validated, origin/source-checked rendering/control messages. They must not start a second transport or a second authoritative simulation.

## Simulation, bandwidth and rendering

Fast-game orchestration initially runs at 60 Hz, with adapters preserving their original fixed physics cadence. Sumo retains 120 Hz physics substeps. A 30 Hz game still advances at 30 Hz; increasing orchestration rate must not speed its rules. Inputs apply at the next legal adapter step, with each edge action consumed once.

Continuous controls are sampled/coalesced at 30 Hz; buttons send immediately. Start with a 60-message/second per-seat sustained limit and a bounded burst of 120 messages over one second. Gameplay action rates still use the stricter per-game limits. Initial input message limit is 1 KiB. Keep only the latest unsent movement; retain acknowledged/retried discrete actions without repeating their effect.

Send dynamic state at 60 Hz to Sumo TV/remote game displays initially and at 30 Hz to other fast displays, then adjust only from measured evidence. Controller-only phones receive their private controller state/status and outcomes, not redundant full world snapshots. Send static arena/configuration once per load and after a real change. Target Sumo dynamic snapshot p95 <=4 KiB; bounded initial/rejoin snapshots may be larger. Separate visuals/audio from simulation and deduplicate presentation events by match/event key.

Render at requestAnimationFrame using timestamped snapshots and velocities. Bound interpolation/extrapolation; do not interpolate through eliminations, teleports, map changes or result transitions. Remote players receive locally rendered game views, never a required video stream of the TV. Predict immediate control feedback and safe movement where tested; collisions, elimination and scores remain provisional until authoritative confirmation. Shared-TV prediction cannot know a phone input before it reaches that display; do not claim that prediction removes the phone-to-cloud-to-TV path.

## Fairness and distinct game policies

Movement/collision games use identical fixed-step rules and validated controls. Do not rewind the entire Sumo world for arbitrary late inputs. Timing/shot compensation is opt-in per adapter, bounded and tested; no arbitrary phone timestamps decide a winner.

Rhythm/timed-hazard games schedule cues ahead using clock synchronization and local audio. Record calibration separately from gameplay, bound timing claims against observed receipt/clock estimates, use the same scoring windows, and verify adversarial late/future timestamps. Provisional maximum compensation window is 100 ms; tighten or disable it if the pilot cannot demonstrate consistent scoring. It is not a general rewind policy for every game.

Drawing, voting, guessing, cards and private-planning games use reliable validated events and role-filtered snapshots. Preserve the disclosure boundary in server/snapshots.ts and equivalent game-specific projections. No secret planning board, hidden author or assignment enters a public display snapshot. Drawing deltas and action events need their own size/rate bounds; they are not movement packets.

A slow client must not block the server tick. Neutralize stale continuous controls after 200 ms initially; retain the human seat for a 60-second reconnect window. Do not silently substitute a bot after a brief loss. If the controlling host display disappears, the server intentionally pauses the action match after a two-second grace period. Distinguish that policy from an accidental dependency on host HTTP requests. Per-game forfeit/timeout rules remain explicit.

## Persistence and recovery

DO memory owns active fast simulation; embedded SQLite stores room metadata, checkpoints and a durable result/event outbox. D1 keeps the existing cross-room history and uniquely keyed score/result records. This requires a scoped update to ARCHITECTURE_DECISION.md; do not treat the old per-frame D1 contract as compatible without recording the changed ownership.

Checkpoint active simulation asynchronously once per second and at pause, stage boundaries and match end. No D1 read/write or external AI/media call occurs in a physics tick. Persist a result/outbox entry before confirming the result; a signed Site endpoint applies each durable effect exactly once. Outbox retries are bounded/backed off and recover after restart. A checkpoint without sufficient accepted-input evidence cannot fabricate a recovered winner: pause and restart the unfinished round without adding a score. Never replay a committed score event.

Existing native party-room adapters may continue committing event/phase mutations through the existing D1 persistence functions; the party actor is their exclusive request coordinator. Keep exactly one writer, use existing CAS/action/score keys, and push confirmed role-specific state. Do not create a second competing phase engine. AI jobs and media retain existing Site services and deterministic failure paths.

## Measurement and release criteria

Record input sequence -> server receive -> applied tick -> snapshot -> displayed frame, RTT/jitter, tick scheduling delay, payload bytes, reconnects and queue depth. Include clock-offset uncertainty; internal timestamps are estimates of event-to-render latency, not proof of physical finger-to-photon delay. Confirm with high-frame-rate video where available. Store no secrets, private answers or raw controller credentials in traces.

Proposed initial gates on named supported devices/networks: same-room input-to-visible median <=50 ms and p95 <=100 ms; regional remote p95 <=120 ms; stable 60 FPS on supported displays without recurring >50 ms stalls. Measure at least 200 inputs per condition at 2, 5 and 10 seats, with idle and loaded Wi-Fi. Add simulated RTT 0/50/100/150/250 ms, jitter 0/20/50 ms and loss 0/1/3 percent. Evaluate degraded cases for safe behavior rather than expecting every adverse case to meet the fast-game latency target. Browser-only network throttling is insufficient for later WebRTC trials.

Require real physical-phone Sumo acceptance before claiming latency fixed or migrating the whole library to the chosen backend. Require every catalog ID to have an adapter, join/input/reconnect/result/switch evidence and applicable private-state/timing tests. High-cost or human-only paths use deterministic provider fixtures where paid AI is unrelated to this work. Do not turn a Sumo pass into a whole-library completion claim.

## Free-tier capacity gate

Before hosted testing, verify the selected Cloudflare account actually uses Workers Free. Do not downgrade or alter an existing paid account or its other projects. Measure account-wide usage, not just this project's local counters. Start with one active pilot party, up to ten phones and short scheduled test sessions. Include Worker requests/CPU, DO messages/duration, checkpoint writes, storage, reconnects and alarms in the forecast; a throughput-capable actor does not imply unlimited free hosting.

Current documented DO Free allowances are 100,000 requests/day, 13,000 GB-s/day, 100,000 SQLite rows written/day, 5 million rows read/day and 5 GB storage. Documentation applies a 20:1 incoming WebSocket ratio for compute request billing; verify actual Free quota enforcement/account usage after the pilot rather than treating raw analytics message counts as billed requests. Quota exhaustion causes operation failures rather than a paid upgrade, with daily quotas resetting at 00:00 UTC.

Admission should reserve 20 percent of available daily quota, stop new active matches as that reserve is reached and show a clear capacity/retry message. Stop idle simulation timers, hibernate lobbies, coalesce changed controls and avoid redundant world updates to controller-only phones. Do not lower the physics cadence or weaken latency/scoring tests merely to fit quota. Confirm checkpoint rows/cost from actual SQLite operations before permitting long sessions. If quota visibility is unavailable or uncertain, retain short manually bounded pilot sessions and report the uncertainty; local counters are not a guaranteed account-wide guard.

Before public rollout, document measured ten-phone play time and concurrent-party capacity within the free allowances. If capacity is inadequate, qualify the user-owned LAN-server path or limit hosted availability clearly. No paid provider is an automatic fallback. Account plan choice and free-provider enforcement provide the no-charge boundary; software quotas additionally protect availability.

## Rollout, user dependencies and costs

Create new-schema migrations additively, including runtime DDL, Drizzle schema and migration metadata where necessary. New rooms select exactly one backend at creation and never silently change it midmatch. Existing rooms complete on their existing backend. Keep a runtime rollout switch for new rooms; stage with invited testers, then publish the exact reviewed source/archive. Rollback stops new-room routing and restores the previous verified Site version; it does not delete live room data or interrupt another chat's changes.

Authentication completed 2026-10-13: the user signed in and authorized Wrangler; whoami confirmed OAuth account/Worker permissions, and the dashboard showed Workers Free ($0, Current plan). Reuse this authorized login and verify the account plan again before provisioning; do not request the user to sign in again unless the credential expires or is revoked. See .logs/party-latency/cloudflare-setup.md. Do not request passwords or API secrets in chat. The user selected free tier only; hosting budget is zero. Use SQLite-backed DOs within verified Free allowances. Never enable Workers Paid, deploy into a paid account with overage exposure, provision paid regional hosting, or ask again about upgrading merely because a quota is reached. If Free capacity/performance is insufficient, report that evidence and use a qualifying no-cost alternative or user-owned LAN server.

The user supplies a short physical-device pilot: initially 2-4 phones and the TV; later aim for ten simultaneous seats and at least one regional remote tester. Record device/browser models, approximate remote location, and whether the host uses Wi-Fi or Ethernet. Wired host connection is a useful A/B test, not a substitute for the software repair. No router purchases or manual port forwarding are required for the primary cloud pilot. LAN-helper installation is a separate conditional user action only if that gate is reached.

## Research references

- Riot netcode: https://www.riotgames.com/en/news/peeking-valorants-netcode
- Psyonix physics/networking: https://www.youtube.com/watch?v=ueEmiDM94IE
- HaxBall input handling: https://blog.haxball.com/2023/05/01/input-lag-improvments.html
- AirConsole connection handling: https://developers.airconsole.com/handling-unstable-connections
- Colyseus rooms/reconnect: https://docs.colyseus.io/room and https://docs.colyseus.io/room/reconnection
- LAN reference: https://docs.happyfuntimes.net/docs/introduction.html
- Cloudflare placement/lifecycle/limits: https://developers.cloudflare.com/durable-objects/reference/data-location/ and https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/ and https://developers.cloudflare.com/durable-objects/platform/limits/
- Current pricing, checked 2026-10-13: https://developers.cloudflare.com/durable-objects/platform/pricing/ and https://developers.cloudflare.com/workers/platform/pricing/
- WebRTC implementation reference: https://github.com/geckosio/geckos.io/
