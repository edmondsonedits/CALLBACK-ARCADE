# CALLBACK Arcade

Six standalone arcade games with searchable source folders, solo bots and a shared-screen phone-room platform. GitHub holds canonical source; a Cloudflare Worker serves game assets, and Durable Objects handle authenticated rooms. D1 mirrors descriptive catalog metadata.

## Play and host

On a configured deployment, choose Play solo or Host phones. Keep the host tab open on a shared screen. Friends scan its QR code or enter the six-character code at /join.html, choose a name and replace bot seats. One host plus up to nine phones plays together. Start/pause/resume/new-round controls belong to the host. Phone refresh keeps the seat in that browser tab; host reload requires a new round.

Local browser verification: run npm run dev -- --ip 127.0.0.1 --port 4194, install Chromium with npx playwright install chromium, then run npm run test:browser in another terminal. Localhost links work only on this computer; public phone play requires the production HTTPS deployment. Stop the local preview before rebuilding assets on Windows.

## Find a game

Once deployed, open the catalog site or read [GAME_INDEX.md](GAME_INDEX.md). Search by game title, stable ID, alias, tag, or status. Each entry links to its game guide, manifest, and known source reference. An `awaiting-import` entry is metadata only and has no playable source bundled here.

## Import and edit

1. Run `npm run intake -- my-game --title "My Game"` for a safe starter folder.
2. Put the supplied complete HTML file in `games/my-game/source/`; retain its inline scripts, styles, simulation rules, and controls. Add the real relative path to `manifest.json` and describe provenance and rights.
3. Edit source or tuning values in that game's folder, then update `CHANGELOG.md`. Extraction is optional.
4. Add real source and multiplayer integration evidence files before changing readiness fields.
5. Run `npm run catalog:generate` and `npm test`, `npm run typecheck`, and `npm run catalog:check`.

See [GAME_SDK.md](docs/GAME_SDK.md), [editing guide](docs/EDITING.md), [ChatGPT prompt](docs/CHATGPT_EDITING_PROMPT.md), and each game's own guide. ChatGPT needs this repository connected or the source uploaded into that chat. It cannot read another chat's attachment or commit changes solely because a catalog entry exists.

## Local catalog and database

Use Node.js 22.13 or newer and npm. Run `npm ci`, then `npm run db:migrate`, `npm run catalog:generate`, `npm run db:seed`, and `npm run dev`. Wrangler keeps the local D1 database and logs under ignored local tooling directories. `/api/games`, `/api/games/<id>`, and `/api/health` are read-only. The Worker serves its bundled checked-in catalog when D1 is missing, unavailable, or stale and reports database/catalog synchronization honestly.

## Production hosting

GitHub is the source of truth; a Cloudflare Worker serves the catalog, complete game assets and room API. D1 mirrors metadata. No production database has been provisioned in this foundation. To host it, create a production D1 database and configure its actual ID in `wrangler.jsonc`; then run `npm run deploy:production`, which checks that ID before Wrangler deploys. That explicit command is the only production deploy path. Store credentials in Cloudflare or ignored local secrets, never in Git. See [deployment guide](docs/DEPLOYMENT.md).

## Status

See [STATUS.md](STATUS.md) for what is implemented and what remains pending.
