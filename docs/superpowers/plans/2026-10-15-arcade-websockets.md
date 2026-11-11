# Arcade persistent WebSockets implementation plan

Goal: publish persistent game connections for all 23 active Arcade games after the user's successful Sumo latency test.

Architecture: keep the proven Sumo pilot transport for normal Sumo launches. Run the other six continuous-action OnlineEngine adapters in a SQLite Durable Object, with server-owned inputs, ticks, rosters, checkpoints and durable results. The sixteen native Arcade games use authenticated WebSocket commands and individually projected snapshots; existing D1 transactions, engine rules and scoring remain authoritative. Connections are game-scoped and reconnect when the iframe changes; parent party identity persists. No archived game is restored.

Authorization: user explicitly requested implementation and live publication. Preserve Workers Free, no paid plan changes, ten seats and bounded sessions. Do not integrate the separate redesign or PR 7.

- [x] Native transport: shared server action functions, short-lived role/generation-bound tickets, authenticated callback, one deadline-sync loop per room, individual snapshots, useRoomSync socket path. Test all native engines, private information, stale games, mirror rejection and reconnect.
- [x] Online transport: generic durable simulation around existing engines; validated input sequences and host actions; neutral stale inputs; checkpoint recovery; durable idempotent D1 results; lobby joins/bot changes; host/phone WebSocket client. Test all six engines, sparse rosters, malicious inputs, recovery and results.
- [x] Sumo/default integration: select successful real-time backend from ordinary Sumo launch, preserve arenas/Cup and identity, remove duplicate slow menu entry, retain existing room compatibility.
- [x] Integration: all 23 catalog entries covered, full unit/type/lint/build/render, representative and catalog-wide browser transport checks, independent security/correctness review.
- [ ] Release: deploy Worker then matching Site from synchronized source, retain v83/previous Worker rollback, fresh hosted checks, record exact coverage and remaining physical-device limits.

Review focus: cross-role leaks, retired generation writes, expired/replayed tickets, disconnected controls held down, recovery/outbox failures, CPU/free limits, background host/phone behavior. Native D1 commands may retain database latency, but eliminate browser polling delays. No claim that transport alone guarantees equal latency for every game.

Review follow-up: fixed role-specific native tickets for shared browser cookies and derived per-child mirror display credentials. The Online Site broker validates mirror membership without requiring the Worker-only SITE_ORIGIN binding. Full unit suite passed 944 tests with eight skips; final focused ticket/lifecycle checks and native three-phone browser replay passed.

Final local catalog check: all 23 games passed host, phone and mirror WebSocket transport with no steady gameplay polling (3.6 minutes). Six online gameplay/pause/reconnect workflows passed, Sumo two-phone touch/reconnect passed, and native Buzzwort private input/results/replay with shared host cookies passed.
