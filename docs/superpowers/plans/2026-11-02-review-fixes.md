# CALLBACK Review Fixes Implementation Plan

> Use the approved review as the specification. Execute with regression tests before behavior changes; one independent review of the combined changes before completion.

**Goal:** Fix F1–F5 and add the privacy matrix, disposable realtime QA launcher, and current architecture/testing guidance recommended in the review.

**Architecture:** Keep server/D1 authority, existing game rules, standalone-room behavior, profile ownership and paid-work guards. Add match-scoped round persistence with a compatible migration; project opaque Frame-Up ballots and phase-filtered Restoration snapshots; reject direct admission to session-owned children in favor of the parent join path.

**Baseline:** Clean task checkout at 21620b94 (saved Site v120 source). Original C: workspace is older and remains untouched. No deployment or production-data repair is included.

**Spec:** C:/Users/Danny's Ultimate PC/Documents/ChatGPT/Jackbox Game Creation/.logs/review-2026-11-02/REVIEW.md

## Tasks

- [x] F1/F2: Add failing all-role/phase privacy tests. Introduce opaque ballot IDs mapped only by the server; replace truth-bearing UI keys; filter Restoration content and authorship by phase. Verify the full game and privacy suites.
- [x] F3: Add a failing real SQLite migration/replay test. Scope persisted rounds by match; migrate legacy rounds without destroying prior archives, preserve current recoverable state, and filter archive answers/votes/media by the current match. Update runtime DDL, Drizzle schema and SQL migration together.
- [x] F4: Add failing main/online session-child join tests. Reject direct joins to session-owned children with an actionable parent join destination; keep standalone joining and parent credential provisioning intact. Check admission atomically as well as before insertion.
- [x] F5: Update obsolete availability/audience/profile-button tests to assert current behavior and meaningful rejection/geometry checks.
- [x] QA improvement: Add an isolated app + party Worker launcher using disposable storage and local-only random credentials, with paid-provider credentials removed. Add readiness checks and teardown, then run authenticated session/reset/rejoin, representative game, phone and photo tests.
- [x] Documentation/performance: Update architecture/testing notes, record local phone-to-host latency with environment limits, and update STATUS.md. No speculative infrastructure changes or physical-device claims.
- [x] Verify typecheck, focused/full unit suite, lint, build, production render, configured browser flows and source diff. Obtain independent security/migration review; address material findings and rerun affected checks.

## Review focus

- Old and already-running rooms must survive schema/bootstrap migration and retain score/action idempotency.
- Public ballot identifiers must be stable across reconnect and reveal without exposing answer provenance or image IDs.
- Deliberate parent rejoin remains allowed after a kick; a direct child join cannot create a hidden child-only seat.
- Replays with shorter/different round plans and media must not mix earlier match data.
- QA must never inherit paid keys or point callbacks at production; teardown must terminate only processes started by the launcher.
