# CALLBACK Arcade Foundation Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement each task with focused verification and review.

**Goal:** Make CALLBACK-ARCADE ready for individually searchable/editable game intake and Cloudflare catalog deployment.

**Architecture:** Repository manifests are canonical, generated JSON/Markdown indexes provide discovery, and D1 mirrors catalog/version metadata. A Worker serves the static catalog and read-only metadata API. Actual demo import and multiplayer transport are explicitly pending.

**Tech stack:** TypeScript, Cloudflare Workers/Wrangler, D1 SQLite, minimal static HTML/CSS/JavaScript, Node tests.

**Spec:** ../specs/2026-10-02-arcade-foundation-design.md

## Global constraints

- Preserve the seven party games on Sites and the dirty original checkout.
- No game rewrites, paid calls, fake multiplayer routes, production provisioning or deployment.
- No secret values in tracked files. No made-up readiness or source claims.
- Stable game folders and deterministic generated catalog. Real IDs required before Cloudflare deploy.

## Review focus

- Invalid game IDs or source paths must not escape the repository.
- New games must not advertise readiness without actual source and explicit integration evidence.
- Repeated generation/migrations/seeding must be deterministic and idempotent.
- Search and source links must remain useful at phone size and with punctuation in search terms.
- Database failure and incorrect production configuration must be visible and safe.

## Task 1: Foundation and catalog intake

- [x] Add package scripts, ignore rules, pinned minimal tooling and TypeScript config.
- [x] Define manifests and game-folder template. Add Royal Ballistix/Sumo/Scratch Match metadata, docs and provenance, awaiting import.
- [x] Write failing validation/generation/intake tests, then implement deterministic registry, index and seed generation.
- [x] Build the responsive searchable catalog with accurate status/source links and no placeholder Play action.
- [x] Add editing/intake/ChatGPT guides, AGENTS.md, root README and STATUS.md.

## Task 2: Cloudflare and organized database

- [x] Write routing/fallback/migration tests, then implement Worker read-only catalog API and D1 metadata schema.
- [x] Add local migration/seed/dev/build commands, deployment configuration and preflight validation for real IDs.
- [x] Document future host/controller/bot replacement contract and per-game integration boundaries without claiming multiplayer implemented.
- [x] Add CI checks and manual deployment instructions.

## Task 3: Review and delivery

- [x] Run tests, typecheck, generated freshness, build and whitespace checks.
- [x] Smoke-test catalog search/phone layout and local Worker catalog API with/without D1.
- [x] Fresh Sol review; fix concrete findings and rerun affected checks.
- [ ] Commit and publish the reviewed repository setup to the supplied repository; verify remote paths and final source SHA.

## Execution ruling

User authorization selects the repository and explicitly requests setup; ordinary reversible scaffold decisions proceed within that scope. One focused Luna implementer handles the scaffold; a Sol reviewer checks the new architecture. Root handles review, publication and user-facing delivery. No party Site or production Cloudflare release is included.
