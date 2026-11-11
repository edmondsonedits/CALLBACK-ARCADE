# Callback source export

Preserved from Callback / King Prompter Sites version **133**, source commit `8b15b694506e844875ca4ecbf5e207b38726d676`, on 2026-11-11.

The previous GitHub repository state is intended to be retained on branch `archive/pre-sites-export-2026-11-11`. Check that branch in GitHub for the pre-export code. This source export preserves tracked application source, games (including archived/original versions), bundled assets, source artwork/media projects, documentation, tests, prompts and migrations.

## Privacy and completeness

The public snapshot omits four user-uploaded reference photos in `.codex-remote-attachments/` and PNG screenshots in `.logs/`. These are privacy omissions, not application dependencies. A separate private full-source ZIP is the preservation copy for those omitted files; do not publish it without reviewing their contents. No credentials, live environment secrets, browser sessions or runtime stores are intentionally included. `.env.example` documents settings without supplying secret values.

**Source preservation is not live-data migration or independent deployment.** Live D1 database contents (rooms, profiles/history and other runtime records), R2 uploads/generated media, account/session state, deployment settings and secrets must be exported or configured separately. Do not assume they are backed up by this repository or the source ZIP. Existing APIs, deployments and subscriptions do not transfer with source.

## Setup and migration

See `README.md`, `ARCHITECTURE.md`, `TESTING.md`, `AI_PIPELINE.md`, `.env.example`, `package.json`, `vite.config.ts`, `db/`, `drizzle/`, `arcade-worker/` and `party-worker/`.

Requires Node >=22.13.0. Typical checks are `npm ci`, `npm run typecheck`, `npm test`, `npm run build` and browser smoke tests. Historical test logs are not proof of this export's current test results.

This is a React/Vinext application with a Cloudflare-compatible Worker and D1 `DB` / R2 `MEDIA` bindings, not a static GitHub Pages site. The Sites Vite plugin and `.openai/hosting.json` record the original hosting integration; independent hosting requires adaptation and new deployment bindings. Realtime arcade/party Workers and optional AI credentials need separate configuration. No-key fallbacks exist; paid AI availability is not guaranteed.

Some original/archive game HTML and current Blind Crown files reference CDN resources, so completely offline operation is not guaranteed. Keep licenses and media provenance intact. Several catalog entries are explicitly marked placeholders, and archived-game source remains preserved even when hidden from the current menu.

## Standalone build portability fix
The final GitHub-ready export changes only scripts/build-arcade.mjs to read the 35 already-preserved archived original source copies instead of requiring an unavailable historical Git commit. These copies match the historical blobs byte-for-byte. See VALIDATION.md for the passing build/typecheck/test results. The original unmodified Site source is retained separately in Callback-Sites-v133-full-source.zip.
