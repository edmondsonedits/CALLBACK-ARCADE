# Current status

The combined import review candidate includes standalone source for Royal Ballistix v0.12, Royal Roller Ruckus v1.4.0, Royal Scratch Match v0.5, Royal Twisted v0.5 and Space Bash v1.13.1. Royal Sumo is still awaiting source import.

The foundation includes validated manifests, searchable catalog, deterministic JSON/Markdown/D1 seed generation, intake tooling, read-only Worker API, D1 migration, guarded deployment configuration and CI.

Verified 2026-10-02: 21 automated tests, typecheck, catalog freshness and catalog dry-run build pass. All five complete local game packages boot at desktop and phone viewport sizes with ten contestant slots and no missing resources or JavaScript errors. Missing Three.js dependencies, Windows source-byte conversion and Twisted's debug-gated snapshot were corrected. See docs/IMPORT_REVIEW.md for evidence and limitations.

No authenticated room transport or phone controller pages exist yet. The current Worker includes catalog assets only; game packages need a build/serving step. No production Cloudflare database, Durable Object or Worker has been provisioned or deployed. No imported game is verified for online multiplayer.

Next milestone: serve Ballistix through the actual Worker and implement a real room with two authenticated phone controllers replacing bots, then expand to ten seats and the other games. Follow docs/CLOUDFLARE_MULTIPLAYER_PLAN.md. Keep the seven party games on ChatGPT Sites.
