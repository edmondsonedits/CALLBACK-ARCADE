# CALLBACK Arcade foundation

## Authorized scope

The user selected `edmondsonedits/CALLBACK-ARCADE` and explicitly requested a structural framework, skeleton, organized database, individually editable games, discoverability from ordinary ChatGPT chats, and Cloudflare online setup. The seven named party games remain on Sites. This foundation preserves existing demo gameplay and bots; importing demos and connecting actual phone players are separate milestones.

## Repository contract

- Every game lives in `games/<stable-id>/`, with `manifest.json`, `README.md`, `CHANGELOG.md`, `source/`, `assets/`, `tests/`, and `integration/` intake guidance.
- Machine-readable `catalog/games.json` and human-readable `GAME_INDEX.md` are generated from validated manifests. Game IDs are stable lowercase hyphenated names. Manifests include title, aliases, tags, description, player limits, version, source paths, source provenance, lifecycle and multiplayer readiness.
- Seed Royal Ballistix, Royal Sumo and Royal Scratch Match entries with known source references, clearly marked `awaiting-import`. Do not fabricate downloaded attachments, runtime verification, licensing or online readiness. Add an unregistered copyable template and an intake CLI for new games.
- Root README, AGENTS.md, editing guide and ChatGPT prompt explain exactly how to identify a game and edit its source, tuning, assets, controller mapping or documentation. A normal chat needs repository access or an uploaded source file; metadata cannot grant access or imply it can commit automatically.

## Runtime and database

- Cloudflare Workers serves static catalog assets and read-only `/api/games`, `/api/games/<id>` and `/api/health` routes. D1 stores catalog and source-version metadata, not game HTML or credentials. Repository files are canonical; generated seed SQL mirrors validated manifests into D1.
- A catalog service is a usable foundation, not a multiplayer simulation server. Do not expose fake join/input routes. Document the next transport contract: authenticated host/phone seats, at most ten seats subject to game-specific capacity, input sequence checks, bot substitution, stale-input neutralization, reconnect and replay.
- Preserve per-game input adapters and existing demo hooks. Document the trusted simulation boundary explicitly before integrating a demo; do not independently run unsynchronized simulations on each phone or move authority into arbitrary client claims.
- Deployment configuration and commands include local D1 migrations, seed, dev, build, verification, production database creation, actual ID configuration and explicit manual deployment. No placeholder database IDs may be deployed successfully by accident. Secrets stay in ignored local files or Cloudflare secret management.
- Runtime database failure may fall back to the checked-in catalog with an honest health status. It must not claim a database is connected when it is unavailable.

## Interface

- A static responsive catalog supports text search across title/id/aliases/tags, status labels, and a clear per-game details/source link. Unimported games have no misleading Play button. Do not redesign imported gameplay or load paid providers.
- Cloudflare hosting owns the arcade catalog URL; GitHub owns source/history. Keep links to the party Site. No production deployment or party Site changes in this setup task.

## Verification and acceptance

- Manifest schema/intake validation catches duplicate IDs, unsafe paths, missing game docs/source location, invalid counts and fake ready flags. Generation is deterministic and checkable without changing source.
- SQL migrations and seeds apply twice safely; catalog/database metadata agree. Worker routing, unavailable DB fallback and unknown-game response are tested.
- Typecheck, unit tests, catalog freshness check and build pass. Browser smoke covers responsive search, metadata and non-playable placeholder states. CI repeats checks and build; deployment remains manual with documented credentials and real database ID prerequisites.
- The remote repository receives the reviewed scaffold, clear current status and documentation. External publish is authorized only for repository setup; Cloudflare provisioning/deployment and importing unverified demo artifacts remain pending.
