# Vault v2 party platform implementation plan

**Goal:** Serve all imported games and add a real, transport-independent room/phone controller foundation using the vault's strongest relevant patterns.

**Architecture:** Cloudflare Worker assets/API + one room Durable Object; designated host simulation; shared browser transport and per-game adapters. No source/framework wholesale import.

**Spec:** ../specs/2026-10-02-vault-v2-party-platform.md

## Ownership

- Focused Luna worker: `src/room*.ts`, `src/worker.ts`, `src/routes.ts`, Wrangler configs, server tests and runtime type declarations.
- Root: safe game asset packager/package scripts, catalog and host/controller browser UI/transport/adapters, necessary game input hooks, documentation and browser verification.
- Sol reviewer: read-only final architecture/security/regression review. All collaborators preserve each other's files.

## Tasks

- [x] Worker: failing room/auth/input/reconnect tests; implement real room state and Durable Object; wire Worker routes/configuration, typecheck.
- [x] Root: failing asset traversal/dependency tests; stage catalog/game assets preserving relative paths; update build/dev/deploy scripts and real catalog Play links.
- [x] Root: accessible shared host/join/controller screens, transport reconnect/heartbeats, six game adapters and only needed input hooks with preserved originals.
- [x] Root: source provenance notes mapping vault findings to actual code; current STATUS/SDK/deployment guidance; no unverified live claims.
- [x] Final: relevant unit/types/build checks; actual Worker two-controller/input/reconnect/isolation browser tests and six standalone game checks; Sol review/fix; publish reviewed update, inspect CI.

Ruling: existing written Cloudflare plan plus user's explicit vault improvement request authorizes ordinary reversible implementation decisions. Keep production release separate; prioritize working online architecture and all-game access over speculative engine replacement or visual retuning.

Final local evidence is recorded in docs/ROOM_VERIFICATION.md. Production provisioning remains pending and is not part of these completed implementation tasks.
