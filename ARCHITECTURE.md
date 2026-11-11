# CALLBACK Architecture

## Shared Callback session

A D1 session owns one host credential, up to ten persistent player memberships, its public join code, and an active game instance. Session host/phone pages provision HttpOnly child-room cookies on the server and render the existing game views in same-origin frames. Game engines continue to own all phases, deadlines, scoring, disclosure and controller input. Returning to selection retires the child instance, retains roster/code/profile identity, and rejects retired-instance writes at the database boundary. Public codes are reserved atomically across native, online and legacy room namespaces.

Character profiles use an independent random HttpOnly cookie and hashed identifier in D1, schema-validated bounded history and optimistic profile versions. The default and established baseline remain protected. Local storage is draft/legacy preference compatibility, not a successful hosted Save. Active browser visits renew the profile cookie; only never-saved abandoned profiles are eligible for bounded cleanup.

## Runtime map

The React/Vinext application is compiled to a Cloudflare Worker-compatible ChatGPT Sites deployment. Pages in `app/host` and `app/play` render role-specific snapshots. Route handlers authenticate room cookies, validate strict request schemas, invoke deterministic game logic, and persist mutations to D1. R2 stores generated images behind an authenticated media route.

`useRoomSync` uses signed, short-lived party-Worker tickets for native Arcade and active party packs when configured, with versioned HTTP polling during disconnection or unavailable realtime service. The sync route returns `204` when unchanged, and the client rejects snapshots older than the newest version already accepted. Deadlines and actions still cross the server engine and version-guarded D1 mutation boundary; a socket does not acquire gameplay authority.

The `/display/:code` route is a read-only secondary host screen. It exchanges the room code for a short-lived display cookie, records a hashed display heartbeat in `display_sessions`, and polls the same role-filtered host snapshot through `useRoomSync`. The main host reads only active heartbeat counts for its small secondary-screen indicator. Display clients can render phases, timers, answers, images, reveals, and results, but receive no host action surface and cannot mutate the room. The display client also requests the browser Screen Wake Lock API when available and re-requests it after visibility changes.

Room JSON is the recoverable live snapshot. Normalized tables provide constraints, history, score events, jobs, lore nodes/edges, and analytics. Never treat the browser snapshot as authority.

Persisted room JSON carries an explicit `serializationVersion` and crosses a Zod validation boundary on every read and write. Legacy unversioned snapshots migrate to version 1 before validation. Avatar payloads separately carry `schemaVersion: 2`, allowing device preferences and persisted player records to migrate without weakening the network schema.

## Solo playtest path

`/api/rooms` can prepare a solo room with one authenticated human seat and two to five participants marked `bot`. The response sets separate HTTP-only host and seat cookies, so `/play/{code}` can issue player actions and authorized host actions from the same browser without merging the roles. Solo rooms lock joining and automatically assign the birthday human as VIP when applicable.

Bots are advanced inside `server/engine.ts` through `server/bots.ts`. Their answers, votes, predictions, author guesses, and wagers enter the same validated authoritative round structures and D1 effects as human actions. They cannot transition phases, award points, call paid APIs, or bypass scoring rules. Solo image/lore work resolves to deterministic concept-card fallbacks by default. Only an explicit King Prompter `soloLiveImages` room setting allows the engine to queue normal Cloudflare image/R2 jobs for all human and bot prompts.

## Developer playtest path

`/developer` creates a solo room explicitly marked `developerMode`. It keeps the same distinct host and player cookies, deterministic bots, authoritative engine, optimistic persistence, and quota-free default as normal solo play. The authenticated host action `SET_DEVELOPER_ROUND` is rejected unless both `developerMode` and `soloMode` are true. It may tune only that room's current prompt, display instruction, existing choice labels, creative score cap override, or active phase deadline.

After creation, `/developer/{code}` provides the testing workbench. It embeds the real same-origin `/host/{code}?tester=1` and `/play/{code}?tester=1` routes and sends normal authenticated host actions for test controls; it does not maintain a parallel phase model. The Worker permits same-origin framing only for those explicit tester URLs and continues to deny framing everywhere else. Bowl rooms use the same workbench but remain multiplayer-only: the launcher creates the host room, joins one human tester seat, and requires three additional human connections before start.

The human solo player's role snapshot receives a small developer context containing the current prompt ID, label, existing public choices, score cap, and timer. Bot seats and ordinary rooms receive no developer context. Browser drafts and playtest notes live in device-local storage and are not production content. The exported versioned change package is evidence for a later reviewed source edit; it cannot write application files or modify other rooms.

## Trust boundaries

- Host and player sessions use room-scoped HTTP-only secure cookies; D1 stores hashes, not raw tokens.
- Every action validates same-origin, body size/schema, room, role, phase, deadline, ownership, and rate limit.
- `server/snapshots.ts` is the disclosure boundary. Hidden authorship and assignments must not cross it before reveal.
- Mutations use optimistic version checks. Retried actions use unique action IDs; score effects use unique event keys.
- Player text is untrusted. React escaping is necessary but server validation and moderation still apply.
- OpenAI output is untrusted and must pass schemas, safety checks, graph membership checks, and callback quality gates.

## Persistence responsibilities

- D1: live room snapshot, players, rounds, answers, votes, score ledger, durable pairwise feedback, memory graph, callbacks, jobs, metrics, cleanup. `feedback_votes` deliberately stores only an idempotency key, pair ID, choice ID, and timestamp so aggregate preferences survive expired-room cleanup without retaining player text or session credentials.
- R2 `MEDIA`: generated image bytes. Object keys are room/job scoped and never exposed without room authorization.
- Browser storage: device-only preferences at most; never authoritative game state.
- Developer browser storage: device-only change-package drafts; never live game authority or permanent content.
- Hosted secrets: OpenAI key, rate-limit HMAC secret, and model configuration.

## Host audio boundary

`useHostAudio` consumes the read-only host snapshot and countdown. It may select music mood, play presentation cues, and speak curated directions, but it cannot request actions or alter phases, timers, submissions, scores, or winners. The module is imported only by the host route, so music, effects, and narration remain on the TV/browser running the host display rather than player phones.

Each game length maps to one normalized local soundtrack asset in `lib/game/soundtrack.ts`. The selected track loops through the persistent Web Audio music bus; effects remain synthesized, narration still ducks the music bus, and the former procedural soundtrack remains the asset-failure fallback. Browser speech synthesis supplies the narrator and exposes installed English voices. Host preferences remain device-local. The host's Start or audio button provides the user gesture browsers require before audible playback; unsupported or blocked audio degrades to the existing visual game flow.

The home route has a separate two-element menu playlist in `TVIntroMenu`. After the existing intro-to-menu handoff, it fades the menu-loop video's audio into the uploaded soundtrack, crossfades near each track ending, wraps through the complete list, and fades out before a game-selection navigation. This playback is presentational, device-local, and never enters room state.

## Current constraints and evolution

Native party/Arcade, online Arcade and persistent lobby sockets now use their implemented Durable Object coordinators, while main room state and score effects remain authoritative in D1. HTTP fallback remains available. AI jobs are still request-bound client-kicked leases. The older transport description in `ARCHITECTURE_DECISION.md` records the earlier decision stage; further infrastructure changes require measured concurrency or recovery evidence.

## Review fixes — 2026-11-02

- Session-owned children accept new seats through the parent lobby only. Direct child join requests return the parent join destination; authenticated parent credential provisioning and standalone-room joining remain supported. Admission checks are repeated at the main/online insertion boundary.
- The host's End Game control uses HTTP so coordinator retirement can drain socket actions without an acknowledgement cycle. Retirement errors do not undo an already committed game end. Legacy socket-relayed end actions remain accepted without synchronously draining their own coordinator. Arcade results/replay rules and the single-party admission cap are unchanged.
- Frame-Up ballots expose opaque public choice/turn identifiers, resolved only on the server. Restoration keeps private submissions/authorship out of pre-reveal role payloads.
- `match_rounds` scopes round identity by room and match. Legacy `rounds` stays intact for compatibility; the one-time migration recovers available current-match IDs from round JSON, excludes stale future indexes and leaves published archives untouched. Archives filter normalized answers/votes/media to the current match. Historical data already discarded or published incorrectly is not automatically rewritten.

## Bowl of Fools authority and media boundary

Bowl phases, teams, submissions, scroll queue, active secret, drawing, one-word clue, timers, scores, undo, and sudden death live in strict serialized room state. Snapshots permanently omit scroll authors; only the authoritative clue giver receives active scroll text. Remote Live media is an optional device layer: direct WebRTC uses free STUN and short-lived authenticated D1 offer/answer/ICE rows. No media bytes are stored or relayed, no TURN dependency is required, and failure falls back to an outside call without changing gameplay. See `BOWL_OF_FOOLS.md`.
