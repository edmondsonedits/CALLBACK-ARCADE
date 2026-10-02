# Repository instructions

- Read `STATUS.md` and `docs/GAME_SDK.md` before editing the foundation.
- `games/<id>/manifest.json` is the source of truth. `catalog/games.json`, `GAME_INDEX.md`, and `db/seed.sql` are generated; run `npm run catalog:generate` and `npm run catalog:check` after metadata changes.
- Preserve complete standalone HTML source when a game is imported. Keep game-specific source, assets, tests, and integration notes in that game's folder.
- Readiness requires imported files plus evidence stored in that same game directory. Never infer a playable or multiplayer-ready status from title, external link, claimed player count, or schema validity.
- The catalog routes remain read-only. Real room routes live in src/room.ts and enforce opaque credentials, phase, bounded input, sequence and rate. Do not add placeholder simulation/score endpoints or claim host-owned physics is server-authoritative.
- Production deploys must go through `npm run deploy:production`; production D1 must use its real configured ID. Never commit secrets.
- Follow `docs/GAME_SDK.md` for trust boundaries and implemented host/controller input contracts.
