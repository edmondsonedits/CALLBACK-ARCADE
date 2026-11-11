# Arcade Practice Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Publish a solo Practice Lab with a direct, no-room practice route for each of the 20 Crash Bash / Fuzion Frenzy-inspired prototypes.

**Architecture:** Implement additively on the current Sites v52 source, using the dirty local prototype as a read-only donor for pure simulations, tuning values, and renderer behavior. A whitelisted browser runner will step the simulations at 30 Hz, restart attempts locally, and never create room state; the existing multiplayer Worker protocol remains a separate follow-up.

**Tech Stack:** React 19, TypeScript, Vinext/Sites, Canvas 2D, Zod, Node test runner, Playwright. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-09-30-arcade-practice-lab-design.md`

## Global Constraints

- Work in the managed v52 branch `codex/arcade-v52-solo-port`; preserve the dirty prototype checkout as the donor and recovery copy.
- Keep existing King Prompter catalog IDs, room authentication, D1 state, and Worker multiplayer lifecycle unchanged.
- Practice runs one human simulation locally, adds no bots or opponent AI, and writes no room, score, result, archive, or Room Lore data.
- Use a fixed 30 Hz simulation and 60 Hz-capable local rendering; reset held input on blur, hidden tab, pointer cancellation, reset, and exit.
- On death or a normal trial endpoint, automatically restart with brief feedback; never show a competitive win/loss/results screen.
- Provide keyboard controls on desktop, accessible touch controls on mobile, and persistent Reset and Exit actions.
- Keep each game's mechanics/configuration identifiable and its practice state ephemeral.

## Review Focus

- Unknown or malformed game IDs must return 404 and must never become dynamic import paths. Pin in Tasks 1 and 7.
- A simulation that reports terminal state or stops stepping must restart instead of freezing. Pin in Tasks 2–5.
- Held axes/actions must not stick after tab hiding, focus loss, or pointer cancellation. Pin in Tasks 5 and 6.
- Reset must clear all game-specific arena state, trails, hazards, timers, and targets without changing tuning configuration. Pin in Tasks 2–5.
- Practice must not create or mutate a Callback room, match, score event, or Worker session. Pin in Task 7.

---

## File and Module Map

Implementation target is the v52 worktree, not the current dirty prototype checkout.

- `lib/arcade/practice/types.ts`: practice-only IDs, controls, game definitions, snapshots, and reset policy types.
- `lib/arcade/practice/catalog.ts`: exactly 20 whitelisted practice manifests and lazy game loaders; does not extend the multiplayer `ArcadeGameIdSchema`.
- `lib/arcade/practice/runner.ts`: fixed-step ephemeral session, input sequencing, pause/visibility behavior, reset, and dispose.
- `lib/arcade/practice/games/`: pure game modules and tuning configuration ported from the donor `arcade-worker/src/games/` and `arcade-worker/src/physics/destructible-floor.ts`.
- `app/arcade/practice/page.tsx`: Practice Lab catalog.
- `app/arcade/practice/[gameId]/page.tsx`: validated direct practice route.
- `app/components/ArcadePracticeLab.tsx`: client lifecycle, keyboard input, runner hookup, Reset/Exit actions.
- `app/components/ArcadePracticeScene.tsx`: Canvas rendering of one game snapshot.
- `app/components/ArcadePracticeControls.tsx`: reusable accessible touch controls by controller type.
- `app/components/arcade-practice.css`: responsive Practice-only styles; `app/globals.css` imports it.
- `app/arcade/page.tsx`: add a clear link to the Practice Lab without changing the existing 19-game multiplayer catalog.
- `tests/arcade-practice-ui.test.ts`: control mapping, cleanup, accessible actions, and focus behavior.
- `tests/arcade-practice-catalog.test.ts`, `tests/arcade-practice-combat.test.ts`, `tests/arcade-practice-movement.test.ts`, `tests/arcade-practice-specialized.test.ts`, `tests/arcade-practice-runner.test.ts`, `tests/arcade-practice-ui.test.ts`, and `tests/arcade-practice.browser.spec.ts`: registry, simulation, lifecycle, UI, and browser coverage.

## Tasks

### Task 1: Define the practice-only catalog and safe game identity

**Files:**
- Create: `lib/arcade/practice/types.ts`
- Create: `lib/arcade/practice/catalog.ts`
- Create: `tests/arcade-practice-catalog.test.ts`

**Interfaces:**
- `PracticeGameId` is the literal union of: `sumo`, `space-bash`, `twisted-system`, `snow-bash`, `drain-bash`, `jungle-bash`, `roller-ruckus`, `tie-breaker`, `manic-panic`, `rubble-alliance`, `scratch-match`, `sky-balls`, `dragon-drop`, `volt-vault`, `mystery-beat`, `tailblazer`, `jungle-fox`, `metal-fox`, `paint-panic`, and `rhythm`.
- `PRACTICE_GAMES` is a readonly list of `{ id, title, instructions, controls, tuningVersion, load }`; `load()` resolves only a statically whitelisted module.
- `getPracticeGame(id: string)` returns a manifest or `null`; route code uses this function before rendering a game.

- [x] Write tests for exactly 20 unique valid IDs, complete titles/instructions/control maps, non-empty tuning versions, and unknown-ID rejection.
- [x] Run `node --import tsx --test tests/arcade-practice-catalog.test.ts`; confirm it fails before implementation.
- [x] Add the practice type and registry with explicit per-game metadata and static lazy imports. Do not derive imports from URL strings.
- [x] Run the catalog test and `npm run typecheck`; both pass.
- [x] Commit only the practice types, registry, and catalog test.

### Task 2: Port crate combat and shared destructible-floor simulation

**Files:**
- Create under `lib/arcade/practice/games/`:
  - Shared: `types.ts`, `destructible-floor.ts`.
  - Crate combat: `jungle-bash.ts`, `jungle-bash-simulation.ts`, `jungle-bash-config.ts`, `space-bash.ts`, `space-bash-config.ts`, `snow-bash.ts`, `snow-bash-config.ts`, `drain-bash.ts`, `drain-bash-config.ts`, `tie-breaker.ts`, `manic-panic.ts`, `manic-panic-config.ts`.
- Create: `tests/arcade-practice-combat.test.ts`
- Read only from donor: `arcade-worker/src/games/` and `arcade-worker/src/physics/destructible-floor.ts` in the dirty prototype checkout.

**Interfaces:**
- `PracticeGameModule<State>` exposes `id`, `createState(playerIds, seed)`, `step(state, inputs)`, `snapshot(state)`, and `isTerminal(state)`.
- The six modules support one practice player. `isTerminal` identifies death/elimination and normal bout completion; it does not decide a competitive winner.
- The ports contain no `DurableObject`, `WebSocket`, ticket, `fetch`, D1, `window`, or DOM dependencies.

- [ ] Add failing deterministic create/step tests for Jungle Bash, Space Bash, Snow Bash, Drain Bash, Tie-Breaker, and Manic Panic; cover one-player setup and each game's terminal/reset signal.
- [ ] Run `node --import tsx --test tests/arcade-practice-combat.test.ts`; confirm expected failures before porting.
- [ ] Port `types.ts`, destructible-floor logic, and the six combat modules/configs from the donor. Keep gameplay pure and preserve original config values.
- [ ] Add tests for health loss, crate interaction, floor damage/reset, and explicit terminal detection without adding AI opponents.
- [ ] Run the combat test and `npm run typecheck`; both pass and no imported module references Worker-only code.
- [ ] Commit the shared type, combat/floor simulation, and tests.

### Task 3: Port momentum and hazard simulations

**Files:**
- Create under `lib/arcade/practice/games/`: `sumo.ts`, `sumo-config.ts`, `roller-ruckus.ts`, `roller-ruckus-config.ts`, `sky-balls.ts`, `sky-balls-config.ts`, `twisted-system.ts`, `twisted-system-config.ts`, `rubble-alliance.ts`, `rubble-alliance-config.ts`, `tailblazer.ts`, `tailblazer-config.ts`, `volt-vault.ts`, and `volt-vault-config.ts`.
- Create: `tests/arcade-practice-movement.test.ts`

**Interfaces:**
- Each module implements `PracticeGameModule<State>` from Task 2 and supports one player without synthetic seats.
- Momentum, hazard, trail, and floor outcomes are exposed as explicit terminal/reset signals; no multiplayer placement or victory is returned to the practice runner.

- [ ] Add deterministic one-player create/step and terminal/reset tests for the seven listed modules.
- [ ] Run `node --import tsx --test tests/arcade-practice-movement.test.ts`; confirm expected failures before porting.
- [ ] Port the seven modules/configs, reusing Task 2's shared floor code for Rubble Alliance.
- [ ] Verify Sumo/Roller momentum, Sky Balls solo walls, Twisted System cue progression, Rubble floor reset, Tailblazer collision reset, and Volt Vault hazard reset.
- [ ] Run movement tests, combat tests, and `npm run typecheck`; all pass with no Worker-only imports.
- [ ] Commit these seven modules/configs and focused tests.

### Task 4: Port rhythm, target, and tank simulations

**Files:**
- Create under `lib/arcade/practice/games/`: `scratch-match.ts`, `scratch-match-config.ts`, `mystery-beat.ts`, `mystery-beat-config.ts`, `rhythm.ts`, `rhythm-config.ts`, `rhythm-engine.ts`, `dragon-drop.ts`, `dragon-drop-config.ts`, `jungle-fox.ts`, `jungle-fox-config.ts`, `metal-fox.ts`, `metal-fox-config.ts`, `tank-engine.ts`, `tank-engine-config.ts`, `paint-panic.ts`, and `paint-panic-config.ts`.
- Create: `tests/arcade-practice-specialized.test.ts`

**Interfaces:**
- All seven modules implement `PracticeGameModule<State>` and one-player terminal/reset signaling.
- Mystery Beat preserves its solo compose → preview → perform flow; target/tank practice may use static training props but no AI.

- [ ] Add deterministic create/step and terminal/reset tests for the seven listed titles and shared rhythm/tank engines.
- [ ] Run `node --import tsx --test tests/arcade-practice-specialized.test.ts`; confirm expected failures before porting.
- [ ] Port these modules/configs from the donor and preserve tuning values.
- [ ] Verify Scratch Match and Rhythm loop complete charts, Mystery Beat keeps all three phases, Dragon Drop retains its moving target, Paint Panic accepts spray input, and both tanks can move/fire and reset safely.
- [ ] Run specialized, combat, movement tests, and `npm run typecheck`; all pass with no Worker-only imports.
- [ ] Commit these seven modules/configs and tests.

### Task 5: Implement and verify the fixed-step practice runner

**Files:**
- Create: `lib/arcade/practice/runner.ts`
- Create: `tests/arcade-practice-runner.test.ts`

**Interfaces:**
- `createPracticeSession(game, { playerId, seed, now })` creates in-memory game state and a monotonically sequenced input buffer.
- `advancePracticeSession(session, elapsedMs)` runs fixed `1000 / 30` ms steps, with at most three catch-up steps per animation frame, and returns the latest snapshot plus reset status.
- `resetPracticeSession(session, seed?)` restarts the same game without replacing its configuration; `disposePracticeSession(session)` clears pending callbacks and held inputs.

- [ ] Test fixed-step accumulation, input sequence increments for continuous movement, deterministic seeds, pause on hidden tab, bounded catch-up after a stall, and cleanup after disposal.
- [ ] Test immediate terminal detection, brief reset state, fresh one-player state, no winner/result emission, and resumed stepping after reset.
- [ ] Run `node --import tsx --test tests/arcade-practice-runner.test.ts`; confirm expected failures before implementation.
- [ ] Implement the runner with injectable clock/frame scheduling for deterministic tests; cap catch-up at three ticks and drop excess backlog rather than simulating a long freeze.
- [ ] Run runner plus all three simulation test files and `npm run typecheck`; all pass.
- [ ] Commit the runner and tests.

### Task 6: Build responsive scene, desktop/touch controls, Reset, and Exit

**Files:**
- Create: `app/components/ArcadePracticeLab.tsx`
- Create: `app/components/ArcadePracticeScene.tsx`
- Create: `app/components/ArcadePracticeControls.tsx`
- Create: `app/components/arcade-practice.css`
- Create: `tests/arcade-practice-ui.test.ts`
- Modify: `app/globals.css`
- Read only from donor: `app/components/ArcadeRoom.tsx` in the dirty prototype checkout for game-specific canvas drawing/control mappings.

**Interfaces:**
- `ArcadePracticeLab` receives a validated `PracticeGameManifest`; it dynamically loads one game, owns the runner lifecycle, and exits to `/arcade/practice`.
- `ArcadePracticeScene` receives `{ gameId, snapshot, width, height }` and renders the current state without controlling simulation.
- `ArcadePracticeControls` receives `{ controllerType, onInput, disabled }`; desktop keyboard and mobile pointer controls produce the same normalized `ArcadeInput`.

- [ ] Add tests in `tests/arcade-practice-ui.test.ts` for keyboard mapping, touch pointer down/up/cancel, held-input clear on blur/visibility change, Reset, Exit, labels, and focus visibility.
- [ ] Implement the shared scene using the donor's 20-game renderer behavior; isolate render code from simulation and transport.
- [ ] Implement mobile-first buttons/joystick, keyboard controls, accessible names, reduced-motion behavior, mute/opt-in sound behavior, safe-area spacing, and no-scroll arena layout.
- [ ] Display compact, initially hidden diagnostics with the repeatable seed and active tuning version so physics feedback can identify the exact setup.
- [ ] Add brief “Resetting practice” feedback after terminal events; keep Reset and Exit visible throughout countdown and play.
- [ ] Run `node --import tsx --test tests/arcade-practice-ui.test.ts`, lint on changed files, and `npm run typecheck`; all pass.
- [ ] Commit the UI, rendering, style, and focused tests.

### Task 7: Add Practice Lab catalog and all 20 direct URLs

**Files:**
- Create: `app/arcade/practice/page.tsx`
- Create: `app/arcade/practice/[gameId]/page.tsx`
- Create: `tests/arcade-practice.browser.spec.ts`
- Modify: `app/arcade/page.tsx`
- Modify: `tests/arcade-catalog.test.ts` only if required to prove existing multiplayer catalog remains unchanged.

- [ ] Add a practice catalog test that renders every registered title exactly once with a direct route and practice-only copy.
- [ ] Run the focused catalog tests and verify current 19 multiplayer catalog entries/IDs remain unchanged.
- [ ] Add `/arcade/practice` and a v52 Arcade page link; validate `[gameId]` against `getPracticeGame` and call `notFound()` for unknown IDs.
- [ ] Add one Playwright loop over all 20 direct routes: each reaches active arena, receives a representative mapped input, and shows persistent Reset and Exit.
- [ ] Add browser checks for Reset/Exit, unknown ID, 390×844 touch layout, 1366×768 desktop layout, no horizontal/vertical overflow, and no calls to room, D1-backed, or Worker APIs.
- [ ] Run `npm run test:browser -- --grep "Arcade Practice"`, focused unit tests, and `npm run typecheck`; all pass.
- [ ] Commit routes, catalog entry, and browser tests.

### Task 8: Release verification and Sites publication

**Files:**
- Modify: `STATUS.md`
- Modify: `docs/arcade/ARCHITECTURE.md` or add `docs/arcade/practice-lab.md` with the final local-solo boundary and link inventory.

- [ ] Run the complete release gate: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:browser`, `npm run build`, and `git diff --check`.
- [ ] Review the built bundle and browser network log to verify only the selected game's module loads and Practice performs no room/Worker writes.
- [ ] Publish the reviewed Site feature using the existing Sites path; retain the existing live version for rollback.
- [ ] Open the production Practice catalog and every one of its 20 direct game URLs; verify input, auto-reset, Reset, Exit, and mobile layout against the served build.
- [ ] Update `STATUS.md` with the exact published Site version, links, verification performed, and the explicit multiplayer/latency limitations.
- [ ] Commit status and documentation evidence. Do not label Worker-backed multiplayer complete in this task.

## Execution Method

Use native implementation for the tightly coupled runner/UI/route interfaces. To honor the user's request for efficient agent use, delegate at most one bounded, non-overlapping simulation family batch after the module contract is stable; the main implementer owns integration and verifies every imported module. Use one fresh read-only reviewer after Task 7 to check all 20 titles, route safety, reset cleanup, and no room-data writes. Avoid one-agent-per-game delegation.

## Completion Boundary

This plan delivers public, solo Practice Lab routes for all 20 movement prototypes. It does not deliver or verify their realtime multiplayer protocol. That work remains a separate Worker integration/release plan after the Practice Lab is available for physics feedback.

