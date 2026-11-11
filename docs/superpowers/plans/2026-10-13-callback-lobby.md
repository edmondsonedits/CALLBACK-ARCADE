# Callback Lobby Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Publish the approved Callback title, role choice, persistent game session and hosted character save/undo flow.

**Architecture:** Add a D1 session above existing rooms; retain each game's authoritative engine and role checks. Session routes provision server-derived child credentials and embed the existing game UI. Anonymous character profiles live separately from sessions.

**Tech Stack:** React/Vinext, TypeScript, Cloudflare Worker, D1, Zod, existing QR generator and a browser QR decoder.

**Spec:** ../specs/2026-10-13-callback-entry-and-persistent-lobby-design.md

## Global Constraints

- CALLBACK title, existing intro, exact host/player labels; no new title animation.
- Maximum ten human session seats; retain game-specific start requirements.
- Hosted anonymous profile with 80 retained undo states, independent baseline/default.
- One stable session code and membership across built-in game changes; credentials never stored raw in D1.
- Preserve server authority, privacy, scoring, existing direct routes, media failure paths and accessible layouts.
- Preserve public Site audience and version 71 rollback.

## Review Focus

- Concurrent launches and joins: version-guarded writes allocate one instance/seat.
- Delayed old-game input: old child is closed and mutation predicates reject it.
- Returning browser: saved profile/history resolves by HttpOnly token, without nickname identity.
- Unsupported/denied camera: manual entry works and camera streams stop.
- Different game service: the session remains stable and phones are provisioned without another join.

### Task 1: Hosted characters and scanner

Files: new lib/profile contracts, server/profile service, app/api/profile route, db/profile-schema; AvatarEditor, phone code entry and scanner; focused profile/history and scanner tests.

Interface: CharacterProfileEditor({nickname,onSaved?}) renders current hosted avatar and edits; PROFILE_DDL provides bootstrap statements; profile cookie is independent of session membership.

- [x] Write failing history/profile tests: save/reload/undo retains prior config, reset is undoable, wrong cookie cannot access a profile, stale version cannot overwrite.
- [x] Implement authenticated hosted persistence, draft-aware editor, Save feedback and restore controls.
- [x] Add camera scanning with same-origin QR validation and decoder fallback; test denial/cancel/foreign URL.
- [x] Run focused tests and typecheck; integrate schema/migration with session task.

### Task 2: Persistent session service and game adapters

Files: lib/session contracts, server/sessions/{schema,service,runtime}, session API routes, db/schema, migration; existing game mutation entrypoints for retired-instance guards.

Interface: SessionService(db, adapter).create/join/snapshot/host; GameAdapter.launch/attach/retire resolve existing authoritative rooms and set derived child cookies. SessionView carries version, roster, role, selection and active frame URL.

- [x] Write SQLite-backed failing tests for create-before-game, ten-seat join/overflow, role separation, idempotent join, race/switch and retained IDs.
- [x] Implement D1 session/version/membership and globally reserved codes; 24-hour refreshed session lifetime.
- [x] Implement server-side main/online adapters with unique instance IDs, hashed derived child credentials, cancellation and mutation guards.
- [x] Run focused service, adapter and existing game regressions.

### Task 3: Title, roles and persistent host/phone UI

Files: TVIntroMenu, new session host/phone components and routes, shared session CSS, worker frame/camera policy, play code resolver.

Interface: session host and phone routes poll SessionView; active same-origin frame uses existing game components, while parent supplies New Game and stable lobby identity.

- [x] Add browser tests for entry/role choice and two phones following main -> online -> main without rejoin.
- [x] Implement cinematic title and role cards; session host QR/roster/categories/game picker and phone waiting/customization.
- [x] Integrate scanner/code resolver, child framing policy and confirmed in-progress return to New Game.
- [x] Verify desktop/phone layouts, reload, capacity and expired/foreign links.

### Task 4: Review, release and live handoff

Files: STATUS, ARCHITECTURE, VISUAL_SYSTEM, SCREEN_FAMILIES, TESTING, .logs/callback-lobby receipt.

- [x] Run lint, typecheck, full unit/integration, browser and production rendering/build checks; review all changes with one focused reviewer.
- [ ] Fix observed failures, update truthful docs, package using Sites source helper and publish to the existing public Site.
- [ ] Verify live entry, hosted profile and persistent host/two-phone game changes; open the live result.

## Execution ledger

Ruling: The user's “I approve. Make live.” authorizes the approved scope, execution and publication; proceed without another plan approval prompt.
Ruling: Reuse the clean, separate current Site checkout synced by the source helper; do not use the divergent parent repository.
Ruling: Use one bounded implementation worker for independent character/scanner work, and root for session adapters/UI; no per-task review swarm.
Ruling: Reuse existing game UI inside same-origin session frames rather than duplicate the game pages; credentials are provisioned on the server and retired child instances cannot mutate.
