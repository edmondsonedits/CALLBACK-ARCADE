# Task 4 report — authenticated Arcade real-time service

## Implemented

- Added 30-second HMAC-SHA-256 tickets bound to room, game, role, and player, with constant-time signature comparison and nonce validation.
- Added the authenticated `POST /api/rooms/{code}/arcade-ticket` route. It requires an existing King Prompter host/player cookie and an active D1 Arcade match, returns `no-store`, and never accepts room/game/player claims from the request body.
- Added a King Prompter-owned Wrangler Worker and per-room SQLite Durable Object. The ticket is the first WebSocket frame; URLs and logs contain no ticket. The DO binds its path room to the ticket, consumes its nonce once, validates role, input shape, normalized bounds, strictly increasing sequence numbers, and a 45 ms per-player input interval. Lifecycle frames from clients are rejected.
- Added signed Worker control handling for start/pause/resume/rematch. Site control must be HMAC-signed with a fresh timestamp and nonce and carry a monotonically increasing D1 room version. A Site caller must send it only after committing and verifying the D1 host action.
- Added signed event callback verification over the exact raw body plus timestamp and nonce. The Site resolves room code through D1, then uses the existing idempotent `recordArcadeEvents` persistence path.
- Added the generic game module interface/registry. It is intentionally empty until Task 5 registers the audited Air Hockey implementation.

## Local setup

- Run `npm run arcade:dev` to start the isolated Worker with Wrangler local Durable Objects.
- Configure the Site runtime variables `ARCADE_WORKER_URL`, `ARCADE_TICKET_SECRET`, and `ARCADE_CALLBACK_SECRET` locally. The Worker needs `ARCADE_TICKET_SECRET`, `ARCADE_CONTROL_SECRET`, and `ARCADE_CALLBACK_SECRET` via `wrangler secret put`; `SITE_CALLBACK_URL` is a non-secret local variable in `wrangler.toml`.
- Generate distinct high-entropy values for each secret and use the same matching ticket/callback keys on the Site and Worker. Never commit values. Do not point production traffic at the local Worker.
- Site-to-Worker control forwarding is exposed as `/control/{roomCode}` in this task; the existing host-action route is not modified here. Its caller must forward only after successful D1 persistence. Host UI wiring is a later task.

## Verification

- `node --import tsx --test tests/arcade-auth.test.ts` — 5/5 passed, covering host/player bindings, expiry, malformed/wrong-room/wrong-game/wrong-role tickets, signature rejection, one-time nonce consumption, exact-body callback signatures, forged callback rejection, and idempotent duplicate delivery to the persistence contract.
- `npm run typecheck -- --incremental false` — passed.
- Local Wrangler 4.124.0 Worker + Durable Object — two valid ticketed WebSocket connections each received the compact initial snapshot; the second connection verified reconnect with a fresh ticket. Wrangler required compatibility date `2026-08-22`, the newest supported by the bundled workerd binary. Disposable test secrets were passed as local CLI vars only.
- `git diff --check` — passed for Task 4 changes. Existing unrelated dirty files emitted only line-ending conversion warnings.
- No deployment, publication, production secrets, or live Site-to-Worker callback were exercised.

## Security review follow-up

- DO runtime snapshots now persist the active match/game, tick, paused/phase state, room version, assigned controllers, and simulation state to DO storage; a new DO instance restores that state before handling reconnects or controls.
- Player tickets now include the active `matchId`. The Site selects the first two eligible active human seats in stable seat order and refuses controller tickets for other players. Signed start/rematch/update-seats controls carry exactly two distinct assigned IDs. The DO checks ticket match and seat binding, closes removed controllers on signed seat updates, and closes all old player sockets on rematch. Sequence and per-seat rate guards also survive reconnects.
- Unauthenticated WebSockets are capped at 16 per room and closed after five seconds without a valid first-frame ticket.
- Callback entries are durable before sending, schedule an alarm before the first attempt, and retry indefinitely with delay capped at 30 seconds. The entry is deleted only after a successful 2xx acknowledgement.
- Follow-up `node --import tsx --test tests/arcade-auth.test.ts` — 9/9 passed, including actual `ArcadeRoom` method tests with shared durable storage across instance recreation, replayed nonce rejection, persisted game-state restoration, unassigned and revoked-seat rejection, rematch socket closure, admission/deadline enforcement, and 12 failures/success callback-outbox retries across instance recreation.
- Follow-up `npm run typecheck -- --incremental false` — passed.
- Local Wrangler eviction/reconnect — passed using a disposable persisted namespace: after an initial authenticated handshake, Wrangler stopped and restarted against the same local DO store; replaying the consumed ticket was rejected and a fresh ticket reconnected. Only throwaway local test credentials were used; source contains no secret values. Local state/cache files were removed after the check.
- Atomic-control/outbox follow-up `node --import tsx --test tests/arcade-auth.test.ts` — 12/12 passed. Added a failed runtime-write transaction followed by recreation/retry, stale signed game/match controls, and a deliberately unresolved callback fetch while a later input completes. The fake storage verifies runtime, room version, and control nonce roll back together; input writes event outbox before returning, while `alarm()` owns network delivery.
- Atomic-control/outbox follow-up `npm run typecheck -- --incremental false` — passed. `git diff --check` — passed; only existing line-ending conversion warnings were reported.
- Local Wrangler follow-up booted with a disposable persistence directory and `/health` returned `{ "ok": true, "service": "king-prompter-arcade", "protocol": 1 }`; the process and generated state were stopped/removed. A live control-to-game restart test was not available because the Worker registry remains intentionally empty pending Task 5 game registration.
- No production deployment or live Site host-action forwarding was exercised. The Site caller must still send signed start/pause/resume/finish/rematch/update-seats controls only after validating and committing the corresponding D1 state.

## Task 6 spectator extension contract

- Extend ticket claims/validation with a `spectator` role and issue tickets only from the authenticated room route for a current, active, non-controller participant. Bind every ticket to room code, game ID, match ID, participant ID, expiry, and one-time nonce as for controllers.
- Add spectator authorization in the DO separately from `controllerIds`: a valid spectator gets the compact public snapshot and broadcasts, but input validation continues to accept only an authenticated `player` ticket for a currently assigned controller. Do not expose hidden authorship or per-player private state in that public snapshot.
- On signed match change/rematch, close spectator sockets with controller sockets so reconnect requires a fresh ticket. If participant eligibility changes, Task 6 should send a post-D1-commit signed seat/eligibility control or revoke the affected socket explicitly; never trust client-supplied role or participant IDs.
- Keep lifecycle control site-signed and post-commit. This follow-up atomically writes runtime, room version, and control nonce before the Worker acknowledges; an injected storage failure returns 503 and allows a clean retry. Callback events are written to the durable outbox before input returns; only alarm delivery performs callback fetches.
- Same-version control retries now compare the canonical action identity persisted atomically with the runtime/version/nonce. An exact retry returns an idempotent acknowledgement, a conflicting payload at that version returns 409, and an older control returns an explicit superseded acknowledgement. Follow-up auth suite passed 17/17 and typecheck passed.

## Limits

- No Worker/site secrets are configured in the repository.
- Worker simulation and periodic authoritative game ticks are intentionally supplied in Task 5; this task establishes the transport, binding, and control boundary only.
- The existing host action route does not yet forward its successfully committed actions to `/control/{roomCode}`. The Worker control endpoint is ready for the Site-side post-commit integration in Task 6; end-to-end lifecycle forwarding was therefore not claimed as verified here.
- Local Wrangler handshake evidence will be reported separately and will not imply real-device network performance.
