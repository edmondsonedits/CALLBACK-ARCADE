<!-- User revision 2026-11-03: fish launches as its own game; no Sorcery encore or prepare-fish workshop item. -->
# Sorcery Workshop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement the user's selected Quick/Long Sorcery, independent fish, meaningful waiting activities, persistent personal creations, richer reveals and Edmondson Hall nominations.

**Architecture:** New rules-versioned round plans remain server authoritative. Small independent workshop and creation services own optional state; uniquely keyed score events feed the existing deterministic score projection. Profile-authenticated private storage and consented immutable copies support cross-room artwork without expanding snapshot disclosure.

**Tech Stack:** Existing TypeScript/React/Vinext, Zod, Cloudflare D1/R2, Drizzle, Canvas/WebGL, Node tests and Playwright. No new infrastructure or paid AI requirement.

**Spec:** `docs/superpowers/specs/2026-11-03-sorcery-workshop.md` (read in full before execution).

## Global constraints

- Preserve the existing long game's prompt content, human-drawing fidelity, curse selection and main score formulas. No post-round quality questions.
- Two rewarded prompt ballots per match, 25 points each, 50 total, unmultiplied; minimum ten seconds per issued ballot.
- One shared ten-second optional-editor closing window per main drawing round; never ten seconds per player or repeated on reconnect.
- Five active scenery pieces per present owner, oldest smallest; original creation age is immutable across edits.
- Existing publication consent never expands implicitly. Private collection ownership is capability-based, verified server-side.
- Fish archives/scenery cannot vote, score, collide, become shark targets or count as new fish.
- Existing v1/v2/v3 records remain readable. New settings apply to newly created matches only.
- Phone audio stays silent. All narration/motion derives from authoritative room time and event provenance.
- No paid providers, production data mutation or real-player fixtures in tests. H access is limited to H:\ChatGPT descendants.

## Review focus

1. Last main receipt racing a side-editor lease, timer, upload and pause: exactly one bounded closing event (Task 3).
2. Multiple tabs, seat reuse and repeated action IDs: no duplicate rewards or cross-owner revisions (Tasks 2 and 4).
3. A slow or disconnected artist: no missing chance for capped rewards, no indefinitely stalled main phase (Tasks 3 and 4).
4. Room expiry, withdrawal or a delayed copy retry: no lost permanent media or resurrected deleted art (Tasks 2, 5 and 7).
5. Rejoin at shark arrival or half-revealed art: no historical contestants, early identity disclosure or replayed effect queue (Tasks 5 and 6).

## File map

Existing main rules: `lib/arcade/sketch-relay.ts`, `server/arcade/sketch_showdown.ts`, `server/arcade/sketch_relay.ts`, `server/engine.ts`, `lib/contracts.ts`, `server/types.ts`, `server/snapshots.ts`, `server/database.ts`.

Existing profile/collection patterns: `server/profiles/service.ts`, `server/profiles/schema.ts`, `server/sketch-showcase.ts`, `server/sketch-showcase-schema.ts`, `db/profile-schema.ts`, `db/schema.ts`, `app/api/profile/route.ts` and `app/api/rooms/[code]/showcase/route.ts`.

Existing surfaces: `app/host/[code]/page.tsx`, `app/play/[code]/page.tsx`, `app/components/RoomSetupForm.tsx`, `app/components/sketch-relay/SketchShowdownController.tsx`, `SketchShowdownStage.tsx`, `SketchShowdown.module.css`, `app/components/fish/FishEditor.tsx`, `FishTank.tsx`, `FishFinalePanel.tsx`.

New focused units: `lib/sorcery-settings.ts`, `lib/sorcery-workshop.ts`, `server/sorcery/workshop.ts`, `server/sorcery/prompt-preferences.ts`, `server/player-creations/{schema,service}.ts`, `db/player-creations-schema.ts`, `server/sorcery/hall.ts`; components under `app/components/sorcery-workshop/`. Avoid placing this entire feature in already-large host/play pages.

Migration filenames must be assigned after inspecting the latest migration journal during implementation. Add to the next migration and journal consistently; do not assume a number here or overwrite concurrent work.

### Task 1: Rules-versioned modes and standalone fish launch

**Files:** New `lib/sorcery-settings.ts`; modify main rule files listed above and host/solo setup surfaces; new `tests/sorcery-settings.test.ts`; extend Showdown engine/browser cases.

**Interfaces:** `SorcerySettingsSchema` validates `{length:'quick'|'long'}`. `sorceryRoundPlan(settings)` produces named `{kind:'normal'|'curse'|'final',multiplier:1|2|3,drawingMs,tourMs,revealMs}` records. Store settings and plan in a new Showdown rules version; legacy parsing/behaviour stays unchanged.

- [ ] Write failing tests for both modes, independent fish, replay/new match, extended timers and old v2/v3 records. Pin Quick to normal/curse rounds and Long to current normal/curse/final progression.
- [ ] Run focused tests, confirm intended failures, then implement validated settings across room creation, lobby updates, main creation, snapshot and UI. Public contracts describe the chosen plan; do not infer final round from `round === totalRounds`.
- [ ] Run focused Node tests and typecheck. Add host/phone browser checks for both lengths and standalone fish lifecycle and selection persistence.
- [ ] Review and commit the independently usable modes/standalone fish change. Keep fish current configuration and four-minute default.

### Task 2: Owner identity, editable collections and durable copies

**Files:** New `server/player-creations/{schema,service}.ts`, `db/player-creations-schema.ts`, `lib/player-creations.ts`, `app/api/profile/creations/route.ts`, `app/api/profile/creations/[id]/route.ts`; modify database bootstrap/migration registration, room cleanup, existing profile service and authenticated join associations. Tests `tests/player-creations.test.ts`, `tests/player-creations-routes.test.ts`.

**Interfaces:** `resolveCreationOwner(request,roomParticipant)` returns an internal verified owner or session-only scope; never accepts an owner hash in JSON. `saveCreationDraft(owner,id,expectedRevision,source)` and `commitCreation(owner,id,expectedRevision,blob)` return revisioned receipts. `creationManifest(room,allowedOwners)` returns room-authorised handles, not private IDs/cookies. Explicit hide/delete/withdraw operations produce tombstones.

- [ ] Test cross-room impostors, same nickname, duplicated profile seats, expired cookies, stale revisions, excessive sources, invalid PNG/alpha, room deletion and delayed copy retry after deletion. Confirm failures before service work.
- [ ] Implement Drizzle + runtime DDL + migration + indexes together. Store immutable revisions outside expiring room paths. Reuse decoded-image limits and verified-copy patterns; no arbitrary remote URLs or SVG uploads.
- [ ] Implement owner-only routes, server-side room association, default-private preferences, 20-piece scenery library limit and five-item active manifest. Publish selection/placement separately from draft updates; refuse quota overflow without deleting old art.
- [ ] Verify local/network draft conflict recovery, explicit delete/hide and correct collection ownership across new rooms. Review and commit.

### Task 3: Workshop lifecycle, drafts and one shared finish window

**Files:** New `lib/sorcery-workshop.ts`, `server/sorcery/workshop.ts`, `app/api/rooms/[code]/workshop/route.ts`, `app/components/sorcery-workshop/{WorkshopMenu,WorkshopEditor}.tsx`; modify main snapshot/engine hooks, drawing receipt handling and narrator cues. Tests `tests/sorcery-workshop.test.ts`, `tests/sorcery-workshop.browser.spec.ts`.

**Interfaces:** `workshopAvailability(mainState,participant)` returns allowed activity kinds. `recordEditorLease(state,actor,kind,now)` is revision guarded. `closeWorkshopAtMainBoundary(state,now)` persists one cohort/deadline/event ID; `tickWorkshop(state,now)` closes/pauses deterministically. Private `WorkshopSnapshot` contains own draft references and shared close clock only.

- [ ] Reproduce the current all-ready advancement behaviour in a failing integration test; assert new ten-second hold only with an already-active authenticated editor, never repeated or multiplied by player count.
- [ ] Implement lease expiry, pause shifting, all-editor-finished release, deadline timeout, submit/cancel/reset/remove, and parallel image processing. Do not add early fish preparation. Fish launches independently with its own authenticated normal lifecycle.
- [ ] Build practice/scenery entry cards and persistent return-to-menu UX using existing tools. Autosave on phase switch, background and deadline; R2 outage must not stall the gallery. Required ballots interrupt optional UI.
- [ ] Test main receipt versus side save/pause/reconnect races and scripted narrator deduplication. Confirm local unacknowledged work survives interruption. Review and commit.

### Task 4: Prompt preferences, small rewards and learning

**Files:** New `server/sorcery/prompt-preferences.ts`, `db/sorcery-workshop-schema.ts`, `app/components/sorcery-workshop/PromptPreferences.tsx`; extend workshop actions, `showdownScoreEvents`, score projection, intermission and migration/bootstrap. Tests `tests/sorcery-prompt-preferences.test.ts`, `tests/sorcery-workshop-scoring.test.ts`.

**Interfaces:** `issuePromptBallot(actor,match,now)` returns opaque ID/options/notBefore/expiry. `acceptPromptPreference(actor,ballotId,chosenId,now)` atomically persists feedback and at most one reward-slot event. `workshopScoreEvents(match)` feeds the existing projection; `catalogueWeights(contentMode,algorithmVersion)` returns bounded weights frozen on match creation.

- [ ] Test ten-second gate, nonexistent/wrong options, phase and owner tampering, repeated/reordered concurrent requests, two tabs, reset/replay, per-match 50 cap, no multipliers/bot points, scoreboard rebuild, and all-abstain/skip behaviour.
- [ ] Implement atomic ballot + quota + score-event transaction, stable issued triads, no client scores/timestamps and visible cap/cooldown. A genuine selection gets 25 independent of majority popularity. Skip has no reward.
- [ ] Implement shared post-score intermission/catch-up at most 30 seconds, with eligibility for slow/timed-out active participants. Final winner is declared after settlement, and any catch-up adjustment is visibly labelled.
- [ ] Add exposure-aware bounded aggregates, one counted profile/prompt/day, profile/day limits and room weight cap. Keep global weights uniform until 20-profile/five-room threshold. Add separately scoped host-private learning after three matches/three distinct profiles with a tighter 1.5:1 cap so small recurring groups benefit without training the global catalogue. Keep user-written election unchanged and no deletion/rewording of prompt content.
- [ ] Verify stale profile/learning records cannot award points or train current match retrospectively. Add cross-round and final-winner integration tests. Review and commit.

### Task 5: Stacked scenery and historical fish

**Files:** New `app/components/sorcery-workshop/SceneryPlacement.tsx`, `lib/fish-collection.ts`, `server/player-creations/room-manifest.ts`; modify fish snapshots, authenticated media, completion archival hooks, `FishTank.tsx` and render/effect layers. Tests `tests/fish-collection.test.ts`, `tests/fish-collection.browser.spec.ts`.

**Interfaces:** `activeScenery(owner)` orders by immutable creation age and computes five scales. `freezeHistoricalFishPool(roster,permissions,seed)` returns a bounded owner-balanced schedule. `historicalFishScene(snapshot,elapsed)` emits at most one noncompetitive visitor; render sources are disjoint from current entry IDs.

- [ ] Test edit-does-not-rejuvenate, sixth item shelving, placement clamping, owner-only revisions, 50-object room, revoke/remove/expired-asset and creation ID spoofing.
- [ ] Implement minitank placement, five age scales and separate noninteractive scenery layer with safe zones. Preview/commit revision guards keep older published pieces during failed edits.
- [ ] Implement verified fish archival and normal independent-game entry submission; test new finale identity, duplicate submit and independent replay/lobby return. Only current participating owners supply historical candidates.
- [ ] Implement 5–7-second visitors, seeded owner rotation and 20–35-second spacing only in allowed phases. Test exact shark transition, pause/seek/rejoin, missing image, reduced motion and immediate roster revocation. Browser screenshots must verify scenery does not cover voting labels or shark action.
- [ ] Measure frame time and decoded image memory with ten players/fifty scenery pieces; lower raster budgets if needed without changing storage. Review and commit.

### Task 6: Original-over-enchanted reveal choreography

**Files:** New `app/components/sketch-relay/SorceryReveal.tsx`; modify stage/CSS and existing authoritative presentation helpers; tests `tests/sorcery-reveal.browser.spec.ts`, existing snapshot privacy tests.

**Interfaces:** `revealPresentation(elapsedMs,{reducedMotion,fallback})` maps server time to overlay/side-by-side state. Consume only already-authorised original/name fields and existing reveal event keys.

- [ ] Test zero/50%/100%/side-by-side beats, late join, paused midpoint, replay, missing original/transformed asset, and no pre-reveal identity/original disclosure.
- [ ] Implement the spec's 4.7-second visual sequence with contain-fit images, name reveal at authorised timing, stable remainder and immediate reduced-motion comparison. Do not extend the existing phase implicitly or restart on rerenders.
- [ ] Capture phone/16:9 TV screenshots and sample animation frames in Canvas/WebGL-supported browsers. Verify mute/narrator priority. Review and commit.

### Task 7: Unscored Hall nomination and publication

**Files:** New `server/sorcery/hall.ts`, `app/components/sketch-relay/HallNomination.tsx`, `db/sorcery-hall-schema.ts`; extend post-round flow and reuse consented public-copy/media mechanisms without redefining old winners. Tests `tests/sorcery-hall.test.ts`, `tests/sorcery-hall.browser.spec.ts`.

**Interfaces:** `nominateRoundArt(actor,round,entryId|abstain)` accepts one eligible choice; `finalizeHallNomination(round)` freezes positive ties; `publishConsentedHallAward(award)` verifies immutable paired copies and consent. Award type is distinct from laughter-score winner.

- [ ] Test post-score timing, self/foreign-round/duplicate votes, tie/all-abstain, bots, unchanged score and curse chooser, owner consent off/on/withdraw and copy failure/retry.
- [ ] Implement the award within the shared 30-second intermission, with explicit abstention and private award state. Public Hall entries become ready only after verified copies and existing permission rules.
- [ ] Verify room expiry preserves consented permanent media; tombstones beat delayed retries. Confirm final-score settlement and next-round transitions across Quick/Long. Review and commit.

### Task 8: Reactions, pocket pairs and complete release

**Files:** New `app/components/sorcery-workshop/{PocketPairs,WorkshopReactions}.tsx`, local minigame helper; extend narrator cue catalogue and workshop event renderer. Tests `tests/sorcery-workshop-extras.test.ts`, full journey browser spec and reusable fixtures.

- [ ] Test one active TV effect, two reactions/player/round, 20-second player and narrator spacing, five-second visual spacing, no growing queue, protected phases and host-only audio.
- [ ] Implement authored fixed reactions, cosmetic practice and six-card personal-only memory game with save/resume and automatic suspension. No competitive minigame result endpoint.
- [ ] Run full host/phone journeys for Quick/Long × independent fish, 3 and 10 players, profile return, slow drawer catch-up, offline recovery, R2 failure, reset/removal, Gentle Motion and shark sequences. Inspect screenshots and motion frames; do not rely only on DOM assertions.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, relevant/full required browser release checks, Sites build helper and `node --test tests/rendered-html.test.mjs`. Record exact failures/skips and source SHA. No build while local QA serves the same checkout.
- [ ] Conduct unfamiliar and regular-group human playtests: do players rush to farm points, miss required votes, understand saving/age scaling, enjoy returning art and willingly replay? Adjust proposed quotas/size/timers using observed evidence, not schema-only success.
- [ ] Save versioned release notes and STATUS, preserve rollback, then use the current Sites skill's source-save/package/deploy workflow only within the user's authorised release scope. Report exact version/commit and limitations. This plan itself does not deploy a feature.

## Independent review incorporated

A read-only Sol architecture review confirmed the need for explicit all-ready grace, server-bound profile ownership, durable media outside room cleanup, independent fish lifecycle, unique reward events and separate consented Hall awards. The stricter two-ballot/50-point recommendation is intentional; implementation must not quietly increase it to the reviewer's alternative three-ballot cap.

## Definition of done

All selected user ideas work together without changing the protected main rules, creating unlimited points/waits/storage, losing drafts or leaking identities. Published features have evidence-backed tests and truthful save/privacy affordances. Unimplemented plan checkboxes stay unchecked; no current production change is implied by these documents.

## Execution mapping

The preparation design is implemented in the existing engine modules rather than introducing parallel settings/engine abstractions. Current evidence and release status live in .logs/2026-11-03-sorcery-workshop-execution.md. The original detailed checklists above describe intended verification scenarios, including manual acceptance; they are not blanket claims that every scenario was run.

1. Modes: server/arcade/sketch_showdown.ts, existing strict room/session contracts, setup/lobby UI. Independent fish: fish-tank catalog ID, RoomState.fishGame, fish-service.ts and dedicated host/phone wrappers; old active encores remain readable.
2. Storage: server/player-creations/{schema,service,runtime,room-manifest}.ts and profile/room creation routes, migrations 0016/0017 with matching Drizzle/runtime DDL. Owner-only revisions, draft recovery, tombstones, durable copies and bounded manifests.
3. Lifecycle: server/sorcery/workshop.ts plus the room workshop API; SceneryWorkshop.tsx and WorkshopMenu.tsx reuse the canvas in a full-screen editor without a separate tools page.
4. Preferences: atomic D1 ballot acceptance alongside room CAS, unique SKETCH_WORKSHOP score events, server/sorcery/prompt-learning.ts and frozen future-match weights. Persisted ballots retain display text across catalogue changes.
5. Returning creations: minitank placement, immutable age scaling, useReturningArt.ts Canvas layer, current-match exclusion, owner opt-in and host room visibility, verified upload-receipt archival retries before cleanup.
6. Reveal: lib/sorcery-reveal.ts and SorceryReveal.tsx map authoritative elapsed time to the requested overlay/hold/split sequence and reduced-motion comparison.
7. Hall: existing verified-copy showcase service now has a distinct nominee selection and explicit Hall consent, without redefining older score winners. The 30-second break follows points and never changes them.
8. Extras: PocketPairsModel/PocketPairs local-only save/resume, bounded authoritative reactions and host-only narrator cues.

Human group playtests and physical-device acceptance remain manual validation, not automated completion criteria that can honestly be marked passed in this session.
