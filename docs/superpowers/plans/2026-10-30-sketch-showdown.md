# Sketch & Sorcery shared-prompt implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this authorized implementation; request one whole-change review after verification.

**Goal:** Replace new relay matches with two shared-prompt drawing contests, ranked laughter voting, artist guesses, avatar performances and a scripted host.

**Architecture:** Retain the existing authenticated D1 room, immutable sketch uploads, guarded reference-image jobs and legacy match reader. Add versioned showdown state inside SketchRelayMatch, server-controlled transitions/actions, filtered snapshots and dedicated host/phone components.

**Tech Stack:** Existing React/Vinext, Zod, Cloudflare D1/R2, CSS motion and browser speech synthesis.

**Spec:** The user's approved two-prompt flow and 2026-10-30 implementation request in this conversation.

## Global Constraints
- Server owns deadlines, ballots, identities, scores, reveals and avatar control eligibility.
- Two prompts; four-minute drawing timer (four times the existing 60 seconds); accessibility timers remain extended.
- User-confirmed scoring: rank up to three eligible drawings, worth 100/75/50 to their artists; each correct guess about a voted drawing gives its voter 50.
- Anonymous entries use opaque IDs, shuffled letters and no author, upload or assignment metadata before reveal. Original source access remains private unless used as the whole-gallery fallback.
- Existing provider/allowance guards, immutable uploads, no-paid-bot policy, pause/reconnect, mute and reduced motion remain intact.
- Prompt ballots use 3/2/1, no self-ranking, original prompts win tied votes; examples fill shortages.
- Existing relay matches remain playable; new matches use showdown rules.

## Review Focus
- Duplicate/stale ballots and image callbacks cannot change locked outcomes or duplicate scores.
- A player cannot vote for themselves, guess another player's ballot, perform as another artist, or fetch unrevealed source images.
- Missing drawings, AI failures, tied scores, three-player rooms and bot-only gaps must finish.
- Pause/reconnect preserves exact assignment, selections and countdown; narration does not replay old jokes on polling.
- Host fits 16:9; phone fits 320px with keyboard/touch controls; reduced motion and muted narration remain usable.

### Task 1: Authoritative contest and regression tests
- [x] Add tests for prompt selection, two shared prompts, exact scoring, hidden authorship/assets, bot independence, authorization, replay and completion.
- [x] Watch the focused suite fail, then implement showdown contracts/state/actions and integrate the legacy adapter and room engine.
- [x] Run focused logic, serialization, image and room tests.

### Task 2: Host, phone and narration
- [x] Implement anonymous showcase/gallery, ranked mobile ballots, private voted-entry artist guesses, original/AI comparison and avatar-only performance controls.
- [x] Implement scripted phase/time/last-submitter/reveal narration with names, caption parity, pause/mute and repeat suppression.
- [x] Add host motion and mobile styling using existing navy, parchment, cyan, gold and avatar assets.
- [x] Verify narration, renderer, accessible controls and complete browser lifecycle including reload/pause and avatar authorization.

### Task 3: Review and release
- [x] Update guide/catalog/rules, STATUS and milestone evidence.
- [x] Run typecheck, lint, unit suite, build and release browser checks; record existing unrelated failures separately.
- [ ] Obtain a whole-change review, repair material findings, preserve remote advancement, package exact source and publish through Sites.

## Execution ledger
- Current live source v93, commit 9adb664a496d293e35b86ea77463f9629cf113e0, opened in an isolated checkout. Original dirty workspace untouched.
- User explicitly requested implementation after design discussion; continuing without another design approval gate.
- AI versions first was explicitly confirmed. Original drawings and artist identity are reserved for the reveal.

- Verification update: authoritative room lifecycle, privacy, exact scores, replay and 3/10-player empty/bot cases pass; 1,031 full-suite unit passes / 9 existing skips. Independent Sol server review found no critical/important findings.
- Browser evidence caught and reproduced a stale countdown before effect synchronization (regression red/green). Native-socket failure now defers usability/error reporting to authoritative HTTP polling.
- Load-testing exposed an unbounded native PNG encoder callback. New drawing-export helper has red/green timeout, null result, synchronous throw and late-callback checks; the controller preserves drafts and returns from Sending on timeout.
- Browser finalization and broad release run are active. Production build and nine production-render checks passed before the final helper addition; rebuild required.

- Final source verification: 1,036 unit passes / 9 existing skips; 3/3 targeted browser scenarios; 9/9 production-render checks; TypeScript/lint/build/diff all green. Broad app browser run 75 passed / 34 failed; the new scenario animation selector was subsequently corrected and passes, while outside-scope failures remain.
- Security: private gallery seed regression reproduced the public-order leak before the fix and now passes; seed survives serialization and is absent from snapshots. Independent Sol follow-up confirms the fix for new matches.
- Browser diagnostics: a later upload-test hang came from eager successful BrowserResponse.text() capture, not demonstrated artwork loss. Corrected the test to verify HTTP status plus authoritative room state. The bounded PNG guard is retained as a tested recovery path.
- Current production v93 remains rollback. Packaging/deployment is the only remaining task.

- Core update published as v94, source ea3771a777b0cef3d90eeb51b32f5f2c8c3d4689. Live free-bot acceptance verified the new flow; its cleanup script used generic END_GAME, which Arcade intentionally rejects. Final follow-up hides that unsupported Sketch host control and maps expected stale/invalid/rate-limited actions to 409/422/429. Six rejection tests reproduced HTTP500 before the fix and now pass. Supported finish/replay is the final live acceptance path.

- Host-control follow-up verified: 1,042 unit passes / 9 existing skips; 5 targeted browser passes; 9 production-render passes; TypeScript/lint/build/diff green. Current deployment and supported live finish/replay acceptance are recorded in sibling publication-receipt.json. No additional gameplay work remains.
