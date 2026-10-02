# Current status

The repository contains a validated metadata catalog, source-intake template, three game records, deterministic JSON/Markdown/D1 seed generation, a responsive static catalog, read-only Worker API, D1 metadata migration, local Wrangler setup, deployment ID guard, documentation, and CI checks.

Royal Scratch Match v0.5 is now imported under games/royal-scratch-match/source/index.html and is a standalone playable browser source with 2–10 contestant slots, one local human by default, bot-filled remaining slots, and JavaScript hooks for additional human inputs. Royal Ballistix and Royal Sumo still await source import. No authenticated phone-player transport, room-code service, or authoritative online input pipeline has been implemented. No production D1 database or Worker has been provisioned or deployed.

Next: human-playtest the imported Scratch Match build, implement and verify its trusted host/controller boundary before changing multiplayer readiness, import the remaining user-supplied game sources, then complete production infrastructure only after review.

Foundation verification recorded 2026-10-02: automated tests, TypeScript checks, generated catalog freshness, Cloudflare dry-run build, repeated local D1 migrations/seeding, and browser catalog layout checks passed. Those foundation checks do not establish Royal Scratch Match phone multiplayer readiness.
