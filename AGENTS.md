# King Prompter Project Rules

## Fast orientation

King Prompter is a Vinext/React party game deployed as a Cloudflare-compatible ChatGPT Site. `CALLBACK` remains an internal architecture and Legacy Standard term, not a competing public identity. The server and D1 are authoritative. Start with `STATUS.md`, then read the smallest relevant guide: `GAME_DESIGN.md`, `ARCHITECTURE.md`, `ROUND_SYSTEM.md`, `AI_PIPELINE.md`, or `TESTING.md`. For visual work, also read `VISUAL_SYSTEM.md`, `SCREEN_FAMILIES.md`, and `ASSET_MANIFEST.json`; these presentation rules never override engine, security, snapshot, accessibility, or testing contracts.

Key locations:

- `app/`: pages, phone/host UI, route handlers, and user-facing copy.
- `app/components/useRoomSync.ts`: versioned polling and reconnect behavior.
- `server/engine.ts`: deterministic phases, actions, timers, scoring effects, and transitions.
- `server/bots.ts`: free deterministic solo opponents; bot turns must use the normal authoritative round structures and must never enqueue paid work.
- `server/database.ts`: D1 access, optimistic concurrency, idempotency, and persistence effects.
- `server/snapshots.ts`: role-specific information disclosure boundary.
- `server/ai.ts` and `.prompts/`: AI adapters, strict outputs, fallbacks, and prompt contracts.
- `lib/content/library.ts`: editable prompt/content pools and Catch constraints.
- `lib/game/config.ts`: round plans, timers, and score caps.
- `db/`, `drizzle/`: relational schema and migrations.
- `.openai/hosting.json`: Sites-owned D1/R2 binding declarations.
- `tests/`: unit, API integration, production rendering, and multiplayer browser tests.

Commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:browser`, and `npm run build`. Run the smallest relevant set while iterating and the full release set before deployment.

## Safe small changes

- Copy or labels: edit the relevant `app/` component and run typecheck plus the affected browser/render test.
- Prompt pools or Catch constraints: edit `lib/content/library.ts`; preserve unique IDs, content-mode metadata, mechanical validators, and existing exports; run unit tests and typecheck.
- Timer defaults or round plans: edit `lib/game/config.ts`; treat this as gameplay behavior and run unit plus browser tests.
- Solo setup/UI: edit `app/components/RoomSetupForm.tsx` and the solo sections of `app/play/[code]/page.tsx`; preserve separate host/player cookies and keep every bot action server-authoritative.
- AI wording/schema: edit `.prompts/` and the matching typed implementation together. Never loosen runtime validation merely to accept model output.
- CSS: preserve mobile-first phone layouts, 16:9 no-scroll host gameplay, focus visibility, reduced motion, safe areas, contrast, and labels.

Do not let a UI request move authority into React state. Clients may render snapshots and request actions; they may not decide phases, deadlines, eligibility, winners, or points.

## Deployment and secrets

GitHub is the intended canonical source. The current production target remains ChatGPT Sites until `ARCHITECTURE_DECISION.md` is superseded. Deploy reviewed versions deliberately and preserve the last working Site as rollback. `.env.example` documents keys; real values belong only in ignored local environment files or hosted secret management. Never print, commit, embed, or return them.

## Common mistakes

- Returning hidden answer authorship in a pre-reveal snapshot.
- Updating room JSON without a version guard or creating score changes without unique score-event keys.
- Trusting role/player/room IDs, timestamps, answer ownership, or AI output from the client.
- Making gameplay depend on an OpenAI or R2 success path.
- Treating solo bots as client state, paid AI, or a reason to relax normal multiplayer authentication and player-count rules.
- Adding unvalidated content that makes a callback generic, forced, disconnected, or closed-ended.
- Editing generated build output (`dist`, `.next`, `.vinext`) instead of source.
- Changing schema in only one of Drizzle schema, migration, or runtime bootstrap DDL.

- The server and D1 database are authoritative for phase, deadline, eligibility, authorship, votes, scores, jobs, and winners.
- Never place credentials in client code, logs, prompts, D1, committed files, URLs, or responses.
- Treat every client request and every AI result as untrusted; validate role, room, phase, ownership, limits, and schema server-side.
- Never send hidden authorship or assignment information before its reveal phase.
- All scoring changes must be reproducible from uniquely keyed score events.
- Only winning and tied-winning creative answers may enter active Room Lore; preserve Anchor → Voice → World → Consequence relationships as graph edges rather than a flat list.
- AI may interpret, connect, and illustrate established memories, but it must never determine scores, winners, phases, identities, or eligibility.
- Callback quality is a release property: reject disconnected, generic, closed-ended, or forced combinations even when their schemas are valid.
- Keep gameplay usable when OpenAI, image generation, R2, or a client connection fails.
- Phone controllers are mobile-first; host gameplay is 16:9 and must not require scrolling.
- Preserve visible focus, labels, contrast, reduced motion, mute, safe areas, and extended timers.
- Run the relevant automated and browser tests before marking a milestone complete. Do not weaken tests to make them pass.
- Keep prompts in `.prompts/`, concise milestone notes in `.logs/`, and current progress in `STATUS.md`.
