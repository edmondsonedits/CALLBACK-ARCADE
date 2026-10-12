# Royal Sumo phone-room server

Public deployment is pending Cloudflare authentication. GitHub Pages serves the offline game and controller files, but cannot host WebSocket rooms.

## Local verification

With Node 22.13 or newer, from this directory:

```sh
npm ci
npm test
npm start
```

Open `http://127.0.0.1:8787` to host, select **Phone players**, create a room, and open the displayed controller link in another browser. The Node adapter uses the same room core as the Cloudflare Worker. Its rooms are in memory and disappear on server restart. It is a development server; use the HTTPS Worker for public play.

## Publish the HTTPS game and relay

Authenticate Wrangler in the deployment environment (`npx wrangler login`, or a securely configured `CLOUDFLARE_API_TOKEN` and account ID). Do not put credentials in source or browser configuration.

```sh
npm run deploy:production -- --dry-run
npm run deploy:production
```

The deployment script rebuilds the game, runs room/transport/Worker tests, then deploys the static game and a Durable Object room service together. The returned HTTPS Worker URL is the host game link. It serves `/online/controller.html?room=CODE` for phones, so no separate signaling service or D1 database is required. The host stays open and runs the match; phones control their assigned fighters while watching that screen.

To also create rooms from GitHub Pages, set `ALLOWED_ORIGINS` in the Worker configuration to `https://edmondsonedits.github.io`, and set `source/online/config.json` to `{"relay":"https://YOUR-WORKER-URL"}`. Redeploy the Worker and publish the updated configuration to Pages. The Worker has explicit origin checks and JSON preflight support; never put a credential in that file.

## Required checks after deployment

- Open the HTTPS host link and verify `/api/health` reports protocol 1.
- Join from two physical phones; verify distinct fighter seats, simultaneous movement/Bash/Dash, and both screen orientations.
- Lock/disconnect a phone, confirm bot takeover, then reconnect within two minutes to reclaim its seat.
- Pause with controls held, resume, start another round/match, and end the room. Confirm controls clear and the room cannot reopen with old credentials.
- Verify over separate internet connections; local tests do not establish WAN latency or reliability.

Rooms expire after six hours. Opaque credentials are stored in session storage and sent in WebSocket authentication messages; the Worker persists hashes, names and seat membership only for the room lifetime. The Node server is intended for testing, not persistent hosting. The bounded input event ring is diagnostic data, not a full match replay or ranked authority.
