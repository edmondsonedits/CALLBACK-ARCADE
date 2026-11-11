# CALLBACK Architecture Decision

Implementation note — 2026-11-02: this document preserves the original decision and migration criteria. Native party/Arcade, online Arcade and persistent lobby realtime coordinators have since been implemented, with HTTP fallback and D1 gameplay authority retained. See `ARCHITECTURE.md` for the current transport map; the polling-only descriptions below are historical.

Status: Accepted for the current release stage  
Date: 2026-08-21  
Decision: Keep GitHub as the canonical source and ChatGPT Sites as the production runtime. Do not migrate live room coordination yet. Prepare a reversible Cloudflare Durable Objects path only when measured load or reliability evidence justifies it.

## Executive decision

CALLBACK already runs on Cloudflare-compatible infrastructure through ChatGPT Sites: Vinext/React compiles to a Worker, D1 stores authoritative state and relational records, R2 stores generated media, and OpenAI calls execute server-side. The current production shape is therefore much closer to “GitHub + Cloudflare” than the original migration proposal assumes. The meaningful missing primitive is a per-room realtime coordinator, not a new frontend host, database, object store, or API layer.

For 2–10 active seats and early small-scale use, the current D1 compare-and-swap design is reasonable and well tested. Moving now to Durable Objects, WebSockets, Workflows, and independent Cloudflare deployment would replace a working system while adding two migration boundaries (runtime ownership and room-state ownership). It would improve realtime efficiency and job durability, but those are not yet demonstrated release blockers.

The safest next move is:

1. Push the existing Git history to a private GitHub repository and protect `main`.
2. Keep the current Sites deployment intact and deploy reviewed versions deliberately.
3. Add cloud CI for lint, typecheck, unit/integration tests, and build.
4. Verify one private real-AI match before public release.
5. Measure sync request volume, D1 conflicts, transition latency, job failures, and room recovery.
6. Reconsider one Durable Object per room if measurements cross the triggers below.

No production code or data should be migrated as part of this decision.

## 1. Architecture today

- UI: React 19 App Router pages built with Vinext/Vite for a Cloudflare Worker-compatible runtime.
- Hosting: ChatGPT Sites, declared by `.openai/hosting.json`; the existing Sites project owns the deployed Worker-compatible application and provisioned bindings.
- Live synchronization: authenticated HTTP polling every roughly 0.9 seconds for the host and 1.2 seconds for phones. Version-aware sync returns `204` when unchanged.
- Authority: D1 is authoritative. Each room has a versioned JSON state document plus normalized tables for players, rounds, answers, votes, lore nodes/edges, callbacks, jobs, score events, and idempotency records.
- Concurrency: room writes use optimistic compare-and-swap (`UPDATE ... WHERE id = ? AND version = ?`), unique database constraints, uniquely keyed score events, action IDs, and bounded retry loops.
- Timers: absolute server deadlines are persisted. Any sync request can deterministically advance an expired phase, with a unique transition action ID.
- Identity: room-scoped secure, HTTP-only cookies; only token hashes are stored. Host and seat authorization are checked server-side.
- AI: OpenAI Responses, Images, and Moderation are called only on the server. Strict schemas and deterministic fallback providers prevent AI failure from blocking play.
- Background work: D1-backed jobs use leases and idempotent status transitions, but execution is kicked by authenticated clients and remains inside an HTTP request.
- Media: generated image bytes go to the `MEDIA` R2 binding and are retrieved through an authenticated room-scoped API route.
- Memory: winning or tied-winning creative answers become typed Anchor, Voice, World, or Consequence nodes; persisted edges preserve semantic relationships.
- Testing: unit/game, API integration, rendered production Worker, Playwright multiplayer matrices, responsive host/phone, reconnect, replay, and callback-quality tests exist.

## 2. Actual weaknesses

1. **Polling cost and latency.** A ten-player room makes approximately 9–12 sync requests per second even when little changes. Updates arrive within about a second, not immediately.
2. **One hot D1 room row.** Almost every mutation serializes the complete room JSON and competes on one version. Compare-and-swap prevents silent corruption but can increase retries and tail latency during simultaneous submissions.
3. **Client-kicked background work.** AI jobs are leased safely, but progress depends on clients continuing to call `/jobs/run`. A long OpenAI/image call is tied to a request lifetime rather than a durable execution primitive.
4. **Runtime coupling.** `.openai/hosting.json`, `@openai/sites-vite-plugin`, Sites-managed bindings, secrets, versions, and deployment flow prevent a plain repository copy from being independently deployable without new Cloudflare configuration.
5. **No cloud CI/CD in the repository.** The project has good commands but no checked-in GitHub Actions workflow or independent preview/production deployment pipeline.
6. **Production verification gap.** The current structured-memory revision is locally validated but the status file says it has not had a private real-AI match because `OPENAI_API_KEY` is not configured.
7. **Schema duplication.** DDL exists in `server/database.ts`, Drizzle schema, and migrations. Those can drift.

## 3. Theoretical weaknesses that do not matter yet

- Sub-second WebSocket broadcast is pleasant but not required for a turn-based party game when polling is stable and the countdown uses server time.
- Global multi-region room placement is unnecessary until there are geographically distributed active rooms with measured latency problems.
- A separate workflow engine is excessive for one or two bounded jobs per round while deterministic fallbacks already protect play.
- Splitting live state, history, analytics, and lore into independently scaled services would add failure modes without helping a small launch.
- D1's per-database scale ceilings and vendor concentration are not current constraints. The code already isolates business rules well enough to support later migration.

## 4. Options compared

| Option | Multiplayer authority | Benefits | Main drawbacks | Decision |
|---|---|---|---|---|
| Sites only, local source | Current D1 CAS/polling | Already works; lowest operational burden | Source and changes remain tied to one machine/session | Reject |
| GitHub + Sites | Current D1 CAS/polling | Durable source, smallest change, preserves D1/R2/runtime and deployment fallback | Polling and request-bound jobs remain; Sites deployment is not ordinary GitHub CI/CD | **Choose now** |
| GitHub + Cloudflare Workers/DO/D1/R2 | One DO per room | Best fit for authoritative room serialization, WebSockets, reconnect broadcasts, alarms, and future scale | Largest migration; duplicate environment; DO/state/data cutover and new operations | Prepare, postpone |
| GitHub + Supabase | Postgres transactions plus Realtime channels and server functions | Excellent SQL/tooling; familiar backups; managed Realtime | Realtime broadcasts database changes but does not itself provide a single room actor; authority still needs careful transactional/server design | No clear advantage |
| GitHub + Convex | Transactional TypeScript mutations and reactive subscriptions | Very productive realtime model and simple application code | Major rewrite, proprietary data/runtime model, weaker fit with existing D1/R2 code | No |
| GitHub + Firebase | RTDB/Firestore transactions, listeners, Functions | Mature managed realtime and mobile tooling | Data-model rewrite, rules complexity, usage-sensitive reads, awkward relational lore/history | No |
| GitHub + Vercel + realtime backend | Vercel functions plus Redis/realtime provider | Strong previews and Git workflow | Adds another vendor and coordinator; durable state is not automatically co-located across function instances | No |
| Railway/Render/Fly + Node/Socket.IO | One long-running server, typically Postgres/Redis | Easiest mental model for WebSockets; portable Node ecosystem | Always-on service, scaling/Redis/session routing, patching and more operations | Viable fallback, not better now |

Supabase, Convex, and Firebase are all capable of this game. None provides enough incremental benefit to justify rewriting a functioning, Cloudflare-compatible application. A traditional Socket.IO service is attractive if the team later prefers operational portability over edge/serverless primitives.

## 5. Is GitHub + Cloudflare best?

It is the best likely **growth architecture**, but not the best immediate migration. If live coordination needs to change, use one deterministic Durable Object per room. Let it own active phase, deadline, membership, submissions, votes, transitions, reconnect metadata, and WebSocket fan-out. Use its embedded SQLite storage for the recoverable match snapshot/event stream, D1 for durable cross-room history/analytics/lore, and R2 for images. Use Workflows only for AI jobs whose retry/resume behavior has proven necessary.

Cloudflare documents Durable Objects as stateful coordination units with WebSockets, embedded SQLite, alarms, globally unique naming, and hibernation. The paid Workers plan currently has a $5 monthly minimum; usage then depends on requests, compute, and storage. Workflows add steps, retained state, retries, and their own limits/costs. See the official [Durable Objects overview](https://developers.cloudflare.com/durable-objects/), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), and [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/).

## 6. Is GitHub + Sites sufficient now?

Yes, provided GitHub becomes durable canonical source and the existing Sites release remains a deliberate deployment target. Sites already supplies the current Worker-compatible runtime plus D1/R2 bindings and secrets management. Official Sites documentation describes it as a public-beta surface for interactive sites/lightweight apps, with versioning and deployments, but warns that some databases, background services, frameworks, and hosting patterns may not be supported. That supports keeping it for the proven workload while avoiding assumptions about future DO/Workflow availability. See [Creating and managing ChatGPT Sites](https://help.openai.com/en/articles/20001339-creating-and-managing-chatgpt-sites).

## 7. Migration cost and likely effects

An independent Cloudflare deployment without changing room coordination is roughly several focused engineering days plus release verification. A correct DO/WebSocket/state migration is more realistically 2–4 focused engineering weeks for one experienced developer, including dual-run tooling, data mapping, reconnect semantics, CI/CD, observability, load tests, and side-by-side browser tests. These are planning ranges, not commitments.

Likely improvements:

- immediate state broadcast and substantially fewer idle sync requests;
- naturally serialized room commands and simpler concurrency reasoning;
- alarms for deadlines when clients are quiet;
- better durable job execution if Workflows is added;
- conventional GitHub-to-cloud previews and production promotion.

Possible regressions:

- new WebSocket reconnect and state-rehydration bugs;
- split-brain risk during cutover;
- lost or duplicated score/job events if dual writes are wrong;
- more complex local emulation, bindings, migrations, monitoring, and rollback;
- temporary loss of Sites-managed conveniences and current deployment history;
- higher baseline operational burden and at least a $5/month paid Workers minimum when paid capacity is needed.

## 8. Growth triggers

Re-open the Cloudflare DO decision when any two of these are true, or any one causes visible game failure:

- sustained room sync traffic or D1 cost is materially larger than gameplay traffic;
- p95 visible update latency exceeds 1.5 seconds in normal conditions;
- compare-and-swap retries exceed 1% of mutating actions;
- simultaneous submissions produce repeated 409/5xx responses;
- AI jobs regularly remain queued after clients disconnect or request limits interrupt them;
- more than roughly 100 concurrent active rooms are expected;
- a public release needs independent GitHub previews and reproducible one-click rollback;
- Sites lacks a required runtime binding, observable limit, or reliability control.

## 9. ChatGPT, GitHub, and Codex usage

The standard GitHub app in ChatGPT is currently read-only: it can search and analyze repository code but cannot push files or pull requests. Official OpenAI documentation says direct generation, editing, and pushing is available through Codex. Therefore normal ChatGPT can reliably explain the code, draft small patches or content, review proposed diffs, and prepare precise instructions from a phone, but it cannot by itself complete the GitHub change using the standard connector. See [Connecting GitHub to ChatGPT](https://help.openai.com/en/articles/11145903).

A custom GitHub Enterprise app can be configured with narrowly scoped write actions, but that is a separate admin/security project and is disproportionate for this repository today.

Use short Codex tasks for safe, bounded edits after the repository is documented: copy, prompt pools, timer defaults, labels, CSS, and mechanically validated round content. Continue using a full Codex workflow for multiplayer behavior, auth/security, schemas/migrations, score logic, AI pipelines, infrastructure, deployments, and debugging. The documentation added with this decision minimizes rediscovery in either case.

## 10. Repository structure recommendation

Keep the current single-application repository. Avoid a monorepo until there are genuinely separate deployables. The safe edit surfaces are:

- `.prompts/` for AI prompt contracts and quality examples;
- `lib/content/` for content pools;
- `lib/game/config.ts` for round plans, timers, and score caps;
- `app/` for host/phone UI and copy;
- `server/` for authority, authentication, persistence, snapshots, security, and AI adapters;
- `db/` and `drizzle/` for schema and migrations;
- `tests/` for release evidence.

Future cleanup should move content arrays into small typed files under `game-config/` or `content/` only when a real edit requires it. A large organizational refactor now would create churn without changing capability.

## 11. Safe migration path if triggers are met

1. Preserve the existing Sites URL, database, objects, secrets, and release version.
2. Add CI and an independent Cloudflare staging environment with new resource names.
3. Run the existing Worker/D1 implementation unchanged in staging first.
4. Introduce a room coordinator interface behind the existing API contract.
5. Implement a DO adapter and WebSocket transport while retaining HTTP sync fallback.
6. Mirror non-authoritative telemetry only; never dual-author scores or winners.
7. Import sanitized test fixtures, not production data, for initial staging.
8. Run load, reconnect, deadline, cross-room, AI-failure, and complete-game matrices side by side.
9. Take explicit D1/R2 backups and document rollback before any production data move.
10. Promote deliberately; keep the Sites version available until several verified live matches complete.

## Final recommendation

Adopt **private GitHub + ChatGPT Sites now**. Do not rebuild CALLBACK. Add cloud CI and repository documentation next, then conduct the missing real-AI release test. Treat **Workers + one Durable Object per room + D1 + R2**, with Workflows only where measured job failures justify it, as the planned scale architecture.
