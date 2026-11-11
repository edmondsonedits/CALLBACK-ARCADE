# Shared Party Latency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user selects that method, to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make the full CALLBACK Arcade/practice/room library respond smoothly through one persistent party server while retaining its players across games.

**Architecture:** Keep ChatGPT Sites for the frontend and existing durable services. Start with one Cloudflare SQLite-backed Durable Object per party over WSS on a verified Workers Free account, preserving original game engines and moving continuous gameplay out of HTTP/D1 polling. Qualify Sumo and free-tier capacity with real devices before migrating the library; measured failures may select a verified no-cost regional Node backend, WebRTC fast transport, or user-owned LAN authority without changing game adapters.

**Tech Stack:** Existing Node >=22.13.0, TypeScript, React/Vinext, Zod, D1 and existing renderers; Cloudflare Worker/Durable Objects/WebSockets; existing node:test/tsx and Playwright tooling. Add no third-party networking framework before the pilot demonstrates a need.

**Spec:** ../specs/2026-10-13-shared-party-latency-design.md

## Global Constraints

- One party, up to ten persistent human seats, one public code, one active authoritative game.
- Preserve private-state filtering, uniquely keyed score events, phase/player-count rules, human-only games, accessibility, characters, music and mirror displays.
- Preserve Sumo 120 Hz physics; preserve each other adapter's original cadence independently of the 60 Hz orchestrator.
- No D1 or external-service I/O in physics ticks; no browser authority over outcomes.
- Protocol version 1; ticket expiry 30 seconds; match epochs and per-seat sequences; input payload <=1 KiB; per-seat sustained 60 messages/second with 120-message one-second burst bound.
- Continuous input sampling 30 Hz; immediate discrete actions; neutral controls after 200 ms; reconnect reservation 60 seconds; host-display-loss pause after two seconds; asset ready timeout 30 seconds.
- Active simulation checkpoint every one second and at pause/stage/end; durable outbox before confirmed results.
- Initial Sumo display snapshots 60 Hz; other fast displays 30 Hz; Sumo dynamic snapshot p95 <=4 KiB.
- Proposed gates: local median <=50 ms/p95 <=100 ms; regional remote p95 <=120 ms; supported display 60 FPS without recurring >50 ms stalls.
- User budget is free tier only: no new hosting charges, paid upgrades, payment-required trials or metered-overage exposure. Verify Workers Free before provisioning; do not alter/downgrade unrelated paid accounts.
- Pilot starts with one active party and short scheduled sessions; forecast account-wide quotas and reserve 20 percent before allowing new active matches. Qualification includes free ten-phone play time and concurrent-party capacity.
- No generated images, unrelated game redesign, destructive migrations or deployment from dirty/divergent source.

## Review Focus

- A phone resumes after switching apps and a new match has begun: keep its seat, discard old controls, restore the correct private state (Tasks 2, 3, 7).
- TCP congestion delivers an old dash after a newer match: no stale action, duplicated effect or growing backlog (Tasks 2, 5, 7).
- Simultaneous Sumo collisions or renderer correction cross an elimination: no false authoritative survivor, repeated sound or impossible interpolation (Tasks 5, 7).
- A crash happens between result persistence and D1 delivery: one eventual result, no double score and no invented recovered winner (Tasks 2, 4, 7).
- A remote timing claim or mirror connection requests secret state: reject forged times/roles and preserve assignments/authorship/private boards (Tasks 3, 6, 7).

## Execution boundary and source map

These are planning artifacts saved in the user's workspace. Product execution must open the then-current deployed Site source into a fresh isolated checkout and transfer these two docs there. As of planning, latest saved version is 73 at 8c2bb051be3f6e535df430403a71fcf09ad0fe7b; actual live version must be checked at execution. Leave .sites-qa-live-2026-10-12 and its concurrent music/mirror edits untouched.

Existing identity/lobby: server/sessions/{service,runtime,schema}.ts; lib/session-contracts.ts; app/components/SessionLobby.tsx. Existing online engines: lib/arcade/online/{types,engines,sumo,sumo-codec}.ts and original .mjs cores. Native engine/disclosure: server/{engine,database,snapshots}.ts and game modules. Catalogs: lib/arcade/{catalog,full-games}.ts, practice/catalog.ts and online/catalog.ts. Current featured controllers: public/arcade-games/phone/{host,controller}.js. Existing older DO infrastructure: arcade-worker/src/{index,ArcadeRoom}.ts, a reference to review rather than deploy wholesale. Preserve version-73 mirror/music behavior when reconciling the new source.

New files below are proposed responsibility boundaries. Keep game physics shared and host-independent; keep ticket/persistence code separate from it. Every task ends with a focused review and a commit containing only that task's owned files. Use one focused implementation worker when useful and one Sol Medium architecture/security review at the pilot boundary; do not spawn parallel workers merely to fill slots.

### Task 1: Establish the baseline and safe execution environment

**Files:** Create scripts/party-latency-probe.mjs, tests/party-latency-probe.test.ts, docs/arcade/latency/baseline.md; modify package.json only for named probe commands. Read current hosting manifest, STATUS.md, ARCHITECTURE_DECISION.md, TESTING.md and applicable presentation guides.

**Interfaces:** Produce a baseline receipt with source/version, route used, device/network condition, sample count, p50/p95, clock uncertainty and trace path. The probe correlates seat/input sequence to receive/applied/display events; it must not print credentials or private game content.

- [ ] Refresh Site/version/deployment state and open exact live source using the Sites source workflow in an isolated checkout. Check Git status; preserve concurrent edits. Record rollback source/version and compare changes since inspected version 72. Verify Cloudflare Free account/allowances before any hosted provisioning; local development can proceed before login.
- [ ] Add failing test probe_redacts_credentials_and_reports_uncertain_clocks: synthetic trace containing token/private text yields neither in output; 200 known-duration samples yield the correct percentiles; insufficient clock evidence yields an explicit uncertainty field.
- [ ] Run node --import tsx --test tests/party-latency-probe.test.ts; confirm the new test fails before implementing the probe.
- [ ] Implement JSONL trace ingestion and the receipt writer in scripts/party-latency-probe.mjs. Record request cadence, applied-input sequence, displayed snapshot sequence, payload size, tick delay and render stalls independently.
- [ ] Run the focused test, reproduce both existing Sumo routes with controlled browser seats, re-run the headless physics probe and collect a 2-4-phone user baseline when available. Distinguish observed, synthetic and physical evidence in baseline.md.
- [ ] Commit the owned probe/docs changes. Do not publish or claim latency fixed.

### Task 2: Build the hosting-independent party runtime

**Files:** Create lib/party/{contracts,adapter,runtime,clock,queues}.ts; party-worker/{wrangler.toml,src/index.ts,src/PartyRoom.ts,src/storage.ts}; tests/party-runtime.test.ts and tests/party-protocol.test.ts. Add only required Worker test configuration/tooling already supported by the checkout.

**Interfaces:** Define PartyPhase = SELECTING | PREPARING | COUNTDOWN | PLAYING | RESULTS. Define PartyMessage envelopes with v:1, partyId, matchEpoch, seq, and typed body. Define PartyGameAdapter<S> with id:string, tickHz:30|60|120, create(context):S, applyInput(state,seatId,input):void, advanceTick(state,context):void, project(state,viewer):unknown, checkpoint(state):unknown, restore(checkpoint):S, result(state):PartyResult|null. Context includes server tick/time and seeded randomness, never DOM or database access. Define PartyRuntime.receive(seatId,message), advance(nowMs), project(viewer), checkpoint() and restore(value).

- [ ] Add failing tests ignores_retired_epoch, applies_edge_once, coalesces_movement, limits_input_size_and_rate, advances_without_host_requests, preserves_adapter_cadence, neutralizes_stale_controls, and retains_seat_for_60_seconds. Assert the spec's exact numeric bounds using an injected fake clock.
- [ ] Run node --import tsx --test tests/party-runtime.test.ts tests/party-protocol.test.ts; verify new missing-runtime failures.
- [ ] Implement envelopes, fixed-step accumulators, bounded queues and deterministic lifecycle in lib/party. A 250 ms scheduler gap must trigger a reported pause/recovery policy rather than a huge catch-up teleport or silent lost time.
- [ ] Implement PartyRoom as the WSS/storage host for PartyRuntime. Stop simulation timers in selection/paused/empty rooms; hibernate where applicable; recover durable metadata/outbox and explicitly pause an interrupted round. Expose /health and /parties/:id WebSocket upgrade routes.
- [ ] Add restart_before_result_delivery_is_idempotent and uncheckpointed_progress_never_creates_winner; test DO lifecycle in the local Workers runtime, then test hosted tick timing once provisioning is authorized. Local timing alone cannot qualify Cloudflare.
- [ ] Run focused tests/typecheck and commit the runtime/Worker boundary.

### Task 3: Integrate existing session identities and stable clients

**Files:** Create server/party/{tickets,broker}.ts; app/api/sessions/[code]/realtime/route.ts; app/components/party/{party-client,usePartyConnection}.ts and app/components/party/{PartyHost,PartyPhone,PartyGameView}.tsx. Modify server/sessions/{service,runtime,schema}.ts, lib/session-contracts.ts and app/components/SessionLobby.tsx. Create tests/party-tickets.test.ts, tests/party-session.test.ts and tests/party-session.browser.spec.ts.

**Interfaces:** issuePartyTicket(request:Request,sessionCode:string):Promise<Response> authenticates current Site cookies and returns socket URL plus short-lived ticket. verifyPartyTicket(ticket:string,now:number):Promise<PartyIdentity> verifies signature/expiry and yields partyId/seatId/role. Worker consumes nonce once. PartyClient connects once, authenticates, reconnects/resumes and dispatches typed envelopes; game frames consume role-projected state without opening their own sockets.

- [ ] Add failing tests ticket_role_is_server_issued, rejects_replayed_or_expired_ticket, rejects_wrong_origin, mirror_is_read_only, frame_cannot_impersonate_controller, and resume_after_epoch_change_clears_controls.
- [ ] Run node --import tsx --test tests/party-tickets.test.ts tests/party-session.test.ts; verify the new failures.
- [ ] Implement ticket issuance/verification, signed room provisioning, single controller lease per seat and revocation. Keep tickets in session memory; no credentials in URLs, local storage, frame messages or logs.
- [ ] Implement parent-owned PartyClient with bounded reconnect/backoff and private projections. Move the shared-lobby game-switch signal to pushed state; preserve original HTTP recovery for old rooms and compatible main-game paths during rollout.
- [ ] Add browser test two_phones_switch_games_without_rejoining, host_refresh_retains_roster, and mirror_never_ticks_or_mutates. Confirm current music remains continuous and mirror displays remain read-only through switching.
- [ ] Run focused tests, relevant session/music/mirror browser checks and typecheck. Commit only the session/transport integration.

### Task 4: Finish durable recovery, configuration and rollback controls

**Files:** Create server/party/events.ts and app/api/party/events/route.ts; modify db/schema.ts, server/database.ts runtime DDL and new Drizzle migration/meta where necessary; modify party-worker/src/storage.ts, ARCHITECTURE_DECISION.md, ARCHITECTURE.md, .env.example and STATUS.md. Create tests/party-events.test.ts and tests/party-recovery.test.ts.

**Interfaces:** PartyResult includes eventKey, partyId, matchEpoch, gameId, winners and validated effects. deliverPartyEvent(event):Promise<Receipt> sends signed actor events to the Site. applyPartyEvent(event):Promise<Receipt> persists one effect ledger entry per eventKey using the existing durable score contracts. New-room backend is selected once from server configuration, with existing rooms retaining their selected backend.

- [ ] Add failing score_outbox_retries_once, rejects_retired_match_result, duplicate_callback_is_idempotent, crash_requires_explicit_round_recovery, and rollback_does_not_reassign_active_room.
- [ ] Run node --import tsx --test tests/party-events.test.ts tests/party-recovery.test.ts; confirm new gateway/recovery failures.
- [ ] Implement durable outbox/receipts and actor restart policy; use strict schemas/signatures, bounded retries and no external I/O in physics ticks. Complete the signed gateway before pilot qualification or native-adapter integration.
- [ ] Add additive schemas/migrations with matching runtime bootstrap and Drizzle declarations; test upgrade from existing data and preservation of historical score keys. Do not delete old rooms/tables for cutover.
- [ ] Add server-only rollout selection, one-active-party pilot limit, idle timer shutdown, account-wide quota visibility and secret-key documentation. Add free_capacity_gate_reserves_20_percent and exhausted_quota_does_not_upgrade_or_reduce_physics tests. Stop new matches near quota and explain capacity; never weaken gameplay targets to hide quota failures. Keep actual secret values in hosting secret managers. Record the scoped authority decision and rollback procedure.
- [ ] Run gateway/migration/recovery tests, typecheck and git diff --check; commit only these files.

### Task 5: Port and qualify original Royal Sumo

**Files:** Create lib/party/games/{sumo,sumo-snapshot}.ts and tests/party-sumo.test.ts; modify lib/arcade/online/sumo.ts and sumo-codec.ts only where sharing the exact original core is necessary; modify the existing Sumo renderer bridge and app/components/party/PartyGameView.tsx. Create tests/party-sumo.browser.spec.ts and docs/arcade/latency/sumo-pilot.md.

**Interfaces:** SUMO_PARTY_ADAPTER implements PartyGameAdapter with tickHz:120 using the original sumo-core.mjs Sim. Sumo dynamic snapshots carry tick/time, fighter poses/velocities/action flags, dynamic hazards and deduplicated events; static arena/options are sent once per stage. Server state retains all original authoritative fields for checkpoints.

- [ ] Add failing golden tests original_core_matches_recorded_inputs across all six arenas, same_input_does_not_depend_on_render_fps, collision_elimination_remains_authoritative, dash_retry_has_one_effect, and dynamic_snapshot_p95_under_4096_bytes. Preserve map/cup/quick-match behavior.
- [ ] Run node --import tsx --test tests/party-sumo.test.ts; confirm new adapter/serializer failures.
- [ ] Implement the original core adapter and compact serializer. Keep live Sim in server memory; eliminate full Sim pack/unpack from each ordinary physics step. Checkpoint serialization stays explicit.
- [ ] Implement render interpolation/bounded prediction with discontinuity resets and event deduplication. Test no_interpolation_through_elimination and correction_does_not_repeat_sound. Controller-only phones receive controls/status; remote players can open a local game view.
- [ ] Use a verified Workers Free account to deploy an authenticated pilot Worker and configure runtime secrets through supported secret management. Keep production new-room routing disabled; invite the user into one active, short pilot party. Record region/placement, actual server-loop timing and observed Free quota consumption. If account plan or no-charge enforcement is uncertain, continue local tests and do not provision a billable service.
- [ ] Collect >=200 inputs per condition at available 2/5/10-seat stages. Compare baseline, new cloud WSS and physical video/trace evidence. Do not proceed to Task 6 until the pilot qualifies or a measured fallback qualifies using Decision Task 5A.
- [ ] Run focused engine/browser checks, review authentication/authority/recovery with one Sol Medium reviewer, resolve findings and commit the qualified pilot evidence. Publication remains a later task.

### Decision Task 5A: Execute only the fallback justified by pilot evidence

**Files:** Conditionally create party-node/{src/index.ts,src/room-host.ts,Dockerfile} and tests/party-backend-parity.test.ts; optionally lib/party/transports/{webrtc-client,webrtc-server}.ts and tests/party-webrtc.test.ts; optionally party-lan/{src/index.ts,README.md} and tests/party-lan.browser.spec.ts. Update docs/arcade/latency/sumo-pilot.md with the selected branch.

**Interfaces:** Every runner hosts the unchanged PartyRuntime/PartyGameAdapter contracts from Task 2. Transports deliver the same validated envelopes to the same authoritative room. A LAN runner is a local server, not authority inside the TV renderer.

- [ ] Attribute the miss using trace stages: server CPU/scheduling, placement/RTT, TCP queueing, rendering, or device input. Repair a specific defect before buying or deploying another service.
- [ ] For CPU/placement misses, write backend_parity_same_inputs_same_result; run it failing against the missing Node runner; implement a pinned-region long-lived runner and compare the identical Sumo workload only on a verified no-cost service with adequate awake-server/connection behavior. Otherwise compare locally and move to the LAN branch. Paid provisioning and paid trials are out of scope.
- [ ] For measured TCP queueing, write lost_movement_is_replaceable_but_action_effect_is_once and switching_preserves_authority; implement an optional server-connected WebRTC fast lane with reconnect/UDP fallback tests. Keep WSS control/outcomes. Do not add WebRTC if it fails to improve measured p95.
- [ ] For irreducible same-room cloud RTT, write lan_join_switch_and_reload_preserve_seat; implement a local server serving the controller/display bundle and local join QR. Test router isolation/firewall/browser behavior with the user before selecting this mode.
- [ ] Run each invoked branch's parity/browser checks; record the measured backend/transport selection, verified no-charge conditions, quotas and unsupported conditions. Commit the selected branch and return to Task 5's qualification gate. Uninvoked branches stay absent.

### Task 6: Register every game and migrate by family

**Files:** Create lib/party/games/{registry,online,native,blind-crown,timing}.ts; tests/party-catalog.test.ts, tests/party-timing.test.ts and tests/party-privacy.test.ts. Modify current Arcade/practice/online catalogs and launch links; modify native engine/snapshot adapter seams and renderer/controller bridges only as required. Create docs/arcade/latency/game-matrix.md and tests/party-game-families.browser.spec.ts.

**Interfaces:** getPartyGameAdapter(id:string):PartyGameAdapter|null; listPartyGames():readonly PartyGameDescriptor[]. Descriptor binds the existing catalog ID to adapter, controls, minimum humans, bot policy, private projection and timing policy. Adapt existing OnlineEngine cores without replacing their rules; native adapters delegate to existing deterministic engine and persistence/disclosure boundaries. Blind Crown receives a dedicated server adapter with separate public/private boards.

- [ ] Add failing every_catalog_entry_has_one_authoritative_adapter and old_featured_links_join_shared_party tests. Populate the matrix from checked-in catalogs, deduplicate variant names, explicitly include Blind Crown and all six additional prototypes.
- [ ] Run node --import tsx --test tests/party-catalog.test.ts; confirm unmapped IDs fail.
- [ ] Migrate continuous-physics games first: Ballistix/Air Hockey/racing/crate/tank/trail families. Reuse existing headless cores and legal input contracts; add canonical-input/outcome parity tests per family, with every game ID represented.
- [ ] Migrate rhythm/timed-hazard games: Scratch Match, Mystery Beat, Rhythm, Twisted and relevant hazards. Add scheduled_cues_ignore_packet_arrival_jitter, rejects_future_or_unbounded_backdated_claim, and identical_inputs_equal_scores_with_calibrated_offsets. Test local/remote calibration and scoring windows separately.
- [ ] Migrate native/event-based room games and Blind Crown. Add no_hidden_board_or_authorship_in_public_snapshot, only_current_role_can_act, human_only_minimum_still_enforced and duplicate_submission_does_not_score_twice. Keep original D1 CAS/score-event semantics and existing AI/media fallbacks.
- [ ] Update multiplayer entry points to use the one party launcher; retain standalone offline practice explicitly. Old active rooms continue their old backend until completion; a launch link cannot secretly select the obsolete mailbox.
- [ ] Run each family's focused unit/browser scenarios and commit its independently working increment. Complete all matrix rows: join, input/action, result, reconnect, switch and private/timing checks before moving to final release qualification.

### Task 7: Qualify the whole party under real network conditions

**Files:** Create scripts/party-network-lab.mjs; tests/party-network.test.ts and tests/party-acceptance.browser.spec.ts; update game-matrix.md; create docs/arcade/latency/acceptance.md and .logs/party-latency/receipt.md.

**Interfaces:** The lab emits the same latency receipt format from Task 1 and introduces known RTT/jitter/loss/queueing without trusting browser-only throttling for WebRTC. Acceptance receipt binds source, backend build, devices/regions, samples and matrix IDs to evidence.

- [ ] Add failing fault_lab_bounds_delay_and_drops_deterministically and trace_does_not_claim_physical_latency_without_evidence. Run the new tests red, implement the lab, then rerun green.
- [ ] Run automated 2/5/10-seat scenarios at RTT 0/50/100/150/250 ms, jitter 0/20/50 ms and loss 0/1/3 percent. Verify safe stale-input/queue handling, no slow-client global stall, outcomes, reconnect and correct per-role snapshots.
- [ ] Run real-device Sumo and representative family sessions with the user; repeat game switching several times. Capture Android/iOS/browser models, TV/display rendering, Wi-Fi load, a wired-host A/B if available and regional remote conditions. Explicitly record any unavailable device/count evidence.
- [ ] Verify all five Review Focus cases with named tests and evidence. Close every catalog matrix row; test early results, tied results, bot rules, private planners, rhythm calibration and recovery independently.
- [ ] Record real quota usage per ten-phone session and supported daily play/concurrent-party capacity within Free allowances. Fail public qualification if expected sessions cannot fit; use the no-cost/LAN branch or document a clear availability limit, never a paid upgrade.
- [ ] Fail qualification on missing thresholds/evidence or privacy/score regressions. Attribute and fix only the failed stage; rerun affected checks. Do not weaken tests or claim ten physical phones from ten browser contexts.
- [ ] Commit final acceptance receipts with no credentials/private answers. Record any supported-region/device restrictions clearly.

### Task 8: Stage, publish and verify the exact release

**Files:** Update STATUS.md and .logs/party-latency/release-receipt.md; preserve existing hosting identity/audience and compatible music/mirror changes. No generated build files edited by hand.

**Interfaces:** Release receipt records Site project, exact pushed commit, source/archive hash, Worker build/deployment, backend configuration, migrations, prior rollback version and fresh live verification.

- [ ] Re-read current Site/version/source state and reconcile any newer concurrent changes in the isolated checkout. Run focused regression checks for reconciled changes before packaging.
- [ ] Run the repository full release commands: npm run lint, npm run typecheck, npm test, npm run test:browser with the required local services, npm run build, production rendered-Worker checks documented in TESTING.md, and git diff --check. Confirm actual outputs; skip classifications stay explicit.
- [ ] Deploy the qualified room service, configure real secrets using CLI/native secret management, test signed Site-to-room/event paths, and enable only invited/new pilot rooms first. Keep old active rooms stable.
- [ ] Use the Sites skill source/package workflow to push/package/save/deploy the exact reviewed frontend source while retaining its audience. Deployment is part of the eventual authorized fix; do not publish during this planning-only task.
- [ ] Verify fresh live phone input -> server -> display, results, reconnect and cross-game switching with source/backend versions recorded. If a gate fails, stop new-room routing and restore the previous verified Site/configuration without deleting rooms.
- [ ] Finish with the working URL, supported conditions, measured p50/p95, completed game matrix and remaining physical-device limitations. Claim completion only when the requested catalog and release gates pass.

## What the user needs to do, and when

1. Completed 2026-10-13: Cloudflare browser sign-in and Wrangler OAuth authorization; account verified as Workers Free ($0, Current plan). Reuse this login. Codex rechecks the plan before provisioning; the user need not sign in again unless the credential expires or is revoked. Leave unrelated accounts/projects unchanged. No passwords/tokens in chat.
2. Budget answered: free tier only. No additional budget decision or upgrade is required. Codex verifies no-charge plan enforcement, quotas and practical play capacity before release; a free quota failure triggers a no-cost alternative or capacity explanation, never paid provisioning.
3. For pilot acceptance: provide TV + initially 2-4 phones, then available 5/10-player sessions and one regional remote tester. Supply device/browser models and approximate remote location. Codex will prepare a diagnostic join link and short repeatable instructions.
4. Optional during diagnosis: test the TV/host on Ethernet if already available and record short high-frame-rate footage of finger input and TV response if practical. Do not buy equipment or change router settings preemptively.
5. Only if the cloud/local or free-capacity gate fails: approve installation/use of a local host helper, or supply access to a qualifying no-cost regional service. No paid alternative is planned.

Codex owns implementation, adapters, security, automated/fault testing, packaging, migration/rollback work and evidence reports. The user is not expected to code, configure sockets, manually migrate game files or manage every game switch.

## Plan self-review

- Spec coverage: source isolation, all catalog families, authentication, timing/fairness, persistence, mirror/music preservation, measurement, costs, rollout and fallback branches have named tasks.
- Dependency check: durable recovery and the signed event gateway are Task 4, before the Sumo pilot in Task 5 and native/catalog integration in Task 6.
- Types: one PartyGameAdapter/PartyRuntime/PartyMessage/PartyResult contract is shared by every runner and family; host frameworks do not define alternative outcomes.
- Evidence: local/synthetic/physical/cloud measurements are labeled separately; no existing join test substitutes for a physical latency gate.
- Scope: uninvoked fallback branches produce no code. All invoked hosting branches obey free tier only; no broad frontend/provider/AI redesign or paid resources are required.
- Execution recommendation: implement sequentially in this chat with a focused worker for bounded tasks and one architecture/security review at the Sumo gate. Review this written design/plan before product execution.
