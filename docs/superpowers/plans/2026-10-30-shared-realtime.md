# Shared lobby and party-game real-time implementation

Goal: Keep one parent lobby connection across game switches; remove client polling delay from all native party packs, including Royal Rumours and Bowl of Fools. Preserve server/D1 authority, authentication, private projections, bot rules, archives, and same-player membership.

Architecture: Reuse Cloudflare Durable Objects and existing signed WebSocket transport. Parent socket sends invalidation notifications; clients fetch authoritative views and child cookies only on change or recovery. Native game socket supports party packs and immediately broadcasts committed actions, loading and advancing a room once for all role projections. Bounded relay requests and reconnect handle stalled connections. Existing real-time Arcade simulations remain intact. D1 write and image-provider time remain real latency limits; this is not an engine-authority migration.

Constraints: Free plan only; preserve existing admission limits; no paid services or image generation. Build from Sites v89 e7a8ef5 in isolated H:/ChatGPT/CALLBACK-low-latency-2026-10-30. Preserve other checkout's uncommitted changes. Deployment only after required checks and independent review.

- [x] Parent lobby: signed role-bound notification socket, commit invalidations, low-frequency heartbeat/recovery, cookie-safe game transitions; tests for unauthorized joins, reconnect and cross-game lifetime.
- [x] Party gameplay: extend validated tickets to active native party packs, match binding, all role projections; tests for Royal Rumours/Bowl and private snapshots.
- [x] Relay: one authenticated room load/advance per batch, bounded requests, immediate action sync and pending-sync handling; tests for slow requests and role revocation.
- [x] Integration: native/party/session tests, full unit/typecheck/lint/build; browser shared lobby and party gameplay transitions; independent security review.
- [ ] Release: deploy compatible Worker then exact Site source, hosted verification and measured response report; retain rollback and disclose physical-device limits.
