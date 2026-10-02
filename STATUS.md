# Current status

The repository contains a validated metadata catalog, source-intake template, deterministic JSON/Markdown/D1 seed generation, a responsive static catalog, read-only Worker API, D1 metadata migration, local Wrangler setup, deployment ID guard, documentation, and CI checks.

**Royal Ballistix — Beach Siege v0.12.0 is imported** under `games/royal-ballistix/` as complete standalone HTML with source provenance, Apache-2.0 upstream license copy, game-specific tests, and integration notes. It is playable as a standalone local human-plus-bots game for 2–10 contestants. Its phone/controller API is documented, but authenticated room-code multiplayer is **not integrated or verified**.

Royal Sumo and Royal Scratch Match source HTML files are still not included. No production phone-player transport or authoritative network runtime has been implemented. No production D1 database or Worker has been provisioned or deployed.

Next: review and merge the Royal Ballistix source import; separately import remaining user-supplied games; implement and test actual host/controller integration per game; create production D1; deploy only after review and environment setup.

Verified 2026-10-02 on the pre-import foundation: 12 automated tests, TypeScript checks, generated catalog freshness, Cloudflare dry-run build, repeated local D1 migrations/seeding, and browser search/layout checks at 1366x768 and 390x844 passed. Those historical checks cover the catalog foundation. The Royal Ballistix import must be validated by the current branch/PR CI before merge.
