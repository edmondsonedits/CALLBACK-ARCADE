# King Prompter

King Prompter is an account-free party game for one shared host screen and 2–10 active seats. It also has a one-phone solo playtest mode with one human and two to five free built-in bot opponents. King Prompter is the public umbrella identity; `CALLBACK` remains an internal architecture term and the name of a Legacy Standard mechanic. The Legacy Standard pack turns winning answers into a connected Anchor → Voice → World → Consequence story, then brings that shared universe back in personalized prompts and generated artwork.

## Project Bible

Start with **[The King Prompter Bible](./KING_PROMPTER_BIBLE.md)** for the readable product, game, visual, accessibility, castle-room, media, and production reference. Specialist implementation documents are linked from the Bible.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, then choose either a multiplayer room or **Play solo with local bots** in room settings. Solo mode puts the host controls and human seat on the same phone and never queues paid AI work by default. Without configured text, image, moderation, or storage providers, deterministic lore and concept-card fallbacks keep every match playable.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:browser
npm run build
```

Set `CALLBACK_TEST_BASE_URL` to run the API and Playwright suites against another deployment. Browser fixtures send a development-only acceleration header; production builds explicitly ignore it.

## Runtime

- Vinext/React with a Cloudflare Worker-compatible Sites output.
- D1 binding `DB` is the authoritative room, session, round, action, job, and score-ledger store.
- R2 binding `MEDIA` stores generated image bytes. `ASSETS` remains reserved for the Worker static-asset fetcher.
- Cloudflare text/image providers are supported for the active hosted paths; optional OpenAI defaults are `gpt-5.6-terra`, `gpt-image-2`, and `omni-moderation-latest`. Every provider result is untrusted and every unavailable path has a deterministic fallback.
- Anonymous sessions use room-scoped secure cookies; only SHA-256 token hashes are stored.
- Audience mode and mid-game joining are intentionally deferred beyond v1; refresh/reconnect restores an existing seat.

## Routes

- `/` — branded start/join landing page.
- `/host/{code}` — landscape shared display and host-control drawer.
- `/play/{code}` — portrait phone controller and QR destination.
- `/host/new` — customizable multiplayer/solo setup.
- `/birthday/new` — customizable 30th-birthday multiplayer/solo setup.
- `/display` and `/display/{code}` — read-only secondary host-display entry and mirror.
- `/avatar-studio` — device-local avatar creation.
- `/how-to-play` — current pack and controller instructions.
- `/developer` — isolated solo developer playtest setup.
- `/api/health` — non-sensitive runtime readiness.

See [PLAN.md](./PLAN.md), [STATUS.md](./STATUS.md), and [TESTING.md](./TESTING.md) for the implementation contract, current release state, and verification record.
