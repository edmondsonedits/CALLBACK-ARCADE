# Imported game review — 2026-10-02

Reviewed five open imports together in `codex/review-game-imports`. At review time main still contains the foundation, and PRs #1–#5 contain the individual imports. This candidate consolidates their source packages and regenerates one catalog, avoiding conflicting generated catalogs. It is not a production release.

## Repairs

- Roller Ruckus and Twisted both imported a missing `three.core.js`. Added matching official Three.js r180 core files beside their modules, retained MIT notices and added dependency regression checks.
- Scratch Match's exact original source hash failed on Windows due to Git LF/CRLF conversion. Added source-HTML byte-preservation attributes and restored unchanged bytes; its original SHA-256 passes.
- Twisted's state hook returned `{}` unless debug mode was on. Snapshot updates now run with the panel disabled; a functional regression checks current state and subsequent time updates.
- Canonical `npm test` now runs the existing Space Bash, Scratch Match and Twisted smoke checks, alongside Ballistix and Roller Ruckus.

Original game physics, cameras and tuning are retained. Twisted's diagnostic snapshot update is the only intentional runnable source behavior change.

## Evidence and limits

21 automated tests, typecheck, catalog freshness and Cloudflare catalog dry-run build pass. All five runnable entries loaded from complete local packages in Chromium at 1366×768 and 390×844. Each rendered a canvas, accepted ten-contestant setup, reported no page JavaScript error or missing game resource, and produced no document overflow. Phone-size screenshots were inspected. A focused Sol review found no substantive regression in the repairs.

3D rendering used software WebGL. This does not measure physical-phone performance, complete-match scoring, audio/network latency, cross-browser compatibility or production behavior. No Cloudflare production resource was created and no multiplayer verification status was promoted.

Additional active-play checks passed: Roller Ruckus reached its race phase and Twisted reached fight; Scratch Match reached response with ten contestants and two configured human slots; Space Bash reached fight and accepted a pointer jump action. Ballistix, Roller Ruckus and Twisted accepted their existing per-seat claim/input/release hooks. These were local API/controller-seam checks, not connections from real remote phones.

## Multiplayer gaps

| Game | Current seam | Work needed |
| --- | --- | --- |
| Ballistix v0.12 | Per-seat input, external-control flag, bot release, detailed state. | Seat authentication, strict ordering, held-input timeout, transport and phone UI. Recommended first. |
| Roller Ruckus v1.4 | Per-seat input, disconnect, lobby/controller snapshots. | Reject sufficiently old sequences still accepted by its current ordering condition; add racer/result snapshots. Input state is not race state. |
| Scratch Match v0.5 | Human-slot setup, per-seat lane presses, round state. | Validate seat/lane instead of clamping; synchronize clocks and calibrate latency before judging remote taps. |
| Twisted v0.5 | Remote claim/release, jump/duck, repaired state. | Ordered/time-limited inputs, held-duck cleanup, full per-contestant snapshots. |
| Space Bash v1.13.1 | Player count and coarse state. | Add per-seat inputs and bot replacement. Current controls target seat zero; other fighters are AI. |
| Royal Sumo | Awaiting import. | Complete source required before review. |

Today's Worker packages only the catalog in `public/`, not the game folders. Deployment alone will not expose games or phone controllers. See [CLOUDFLARE_MULTIPLAYER_PLAN.md](CLOUDFLARE_MULTIPLAYER_PLAN.md).
