# Blind Crown Nightfall bounded quality plan

> **For agentic workers:** Use superpowers:executing-plans for approved implementation. The coordinator approved this exact product brief and allowlist after tests/docs head `893e07e99262e6ca5861390fb221dc34709d4447`.

**Goal:** Make private planning and phase feedback easier to read without changing secret-plan archery or tournament rules.

**Architecture:** Retain the standalone HTML and its existing embedded engine, input, art, renderer and app boundaries. Add only local presentation feedback; renderers continue to receive filtered snapshots. No extraction, service, new dependency or asset import.

**Tech Stack:** Embedded JavaScript, Canvas 2D/2.5D, Node test/VM, Python Playwright/Chromium.

**Spec:** Coordinator's Blind Crown assignment and 2026-10-12 base approval; exact bounded product specification below. Earlier external audit: `/workspace/blind-crown-audit/HANDOFF.txt`.

## Authorization and base

- Approved base: `785a15000abe11970c7b92c5f3cab197061fcedf`, published Nightfall.
- Isolated branch: `quality/blind-crown`; worktree: `/workspace/blind-crown-quality`.
- Tests/documentation and this exact product brief are approved. The coordinator requires independent review and portable transfer before completion; publication remains unauthorized.
- Courtyard import and native-asset decision remain separate. No upload, replacement, competing import, push, PR, merge or deployment.

## Exact file allowlist proposed

Already authorized and created in the tests/documentation stage:

1. `games/blind-crown/tests/quality.test.mjs` — engine/perspective behavioral regressions.
2. `tests/blind-crown-quality.test.mjs` — unique root wrapper importing only that suite.
3. `games/blind-crown/tests/presentation/test_quality.py` — real Canvas UI/privacy/input/lifecycle regression matrix.
4. `games/blind-crown/tests/QUALITY_PLAN.md` — this bounded design and approval boundary.
5. `games/blind-crown/tests/QUALITY_BASELINE.md` — executed checks, provenance and limitations.

Additional paths requiring approval with the product brief:

6. `games/blind-crown/source/index.html` — embedded HTML/CSS, CrownInput feedback, CrownArena own-player/aim drawing, private tactical map and app coordination only. Engine, networking, CrownPerspective camera/projection/control transforms and experimental Three.js bridge remain byte-identical.
7. `games/blind-crown/tests/standalone.test.mjs` — active-build size/hash and accurate test label only after intentional source changes pass verification; untouched-original and engine-equality assertions retained.
8. `games/blind-crown/README.md` — precise changed behavior and commands.
9. `games/blind-crown/CHANGELOG.md` — local, unmerged change record.
10. `games/blind-crown/tests/quality-verification.json` — new evidence with final source hash, executed checks and scope; never relabel historical Nightfall evidence as new verification.

No other files are included. Existing presentation scripts can run unchanged (redirect the existing final screenshot outside the checkout). Original/archive files, assets/notices, manifest/version, shared contracts, catalog/generated files and STATUS remain outside this change. The coordinator owns metadata/integration and cross-game regression gates.

## Exact proposed product behavior

### 1. Explain adjusted placements privately

When a Place tap/drag or private-map tap requests an illegal position, keep the established `closestPosition` result and explain **“Adjusted to a legal position — leave room around cover and the boundary.”** A subsequent legal placement replaces it with **“Position set. Aim, then lock your shot.”** Use a compact private status line with polite live-region semantics; update on state change rather than every pointermove. Clear stale placement feedback on mode/phase change, restart and settings-driven new match. Never serialize it into match/network/public spectator data. No rival-dependent aim or placement indicator.

Preserve both existing clearance models: placement uses the engine's player clearance; visible shot cover uses `shotWalls`. Do not change snapping, collision, movement speed, input capture or touch ownership. The input module may report placement validity through an optional presentation callback; existing consumers remain compatible.

### 2. Improve local planning readability without changing cameras

In overhead/isometric Classic planning, make the existing own-position ring and traced aim endpoint distinguishable at the actual displayed Canvas scale, with contrasting outlines and a text-bearing local status line. Clamp symbol/stroke scaling to avoid oversized desktop graphics. Only the own filtered player can supply these cues. In first/third-person, strengthen the existing private-map own-position/heading marker and expose the same status outside the Canvas; retain its placement transform, drag-to-aim and existing crosshair.

Precision retains its no-guide behavior: never add a traced endpoint or trajectory there. No opponent markers during planning, no sprite redesign, no camera defaults/FOV/projection changes, no experimental 3D promotion. Preserve +/-1 degree controls, Q/E, keyboard movement, Place/Aim buttons and simultaneous touch movement/aim.

### 3. Make lock and result feedback phase-correct

Use the existing editable-planning **“Lock shot”** and committed **“Unlock to edit”** actions. For disabled controls, use **“Plan frozen”** during reveal, **“Volley in progress”** during volley, **“Round complete”** during aftermath, **“Tournament complete”** at final and **“Begin a tournament”** in lobby. Eliminated/public spectators retain disabled controls and receive **“Spectating”** during planning. Do not change deadline or phase durations, availability rules or lock semantics.

Aftermath detail should follow existing rules: **“Last survivor claims the crown”** for one survivor; **“Total wipe — points decide”** for no survivors; **“Round limit — points decide”** when multiple survive at the limit; otherwise **“Survivors advance.”** Equal-points seat-order tiebreak remains unchanged and documented. These are descriptive labels, not new winner calculation or awards.

### 4. Preserve proven effects and lifecycle

Do not retime volley/impact, modify cover rendering, change pause/help implementation or rewrite results logic: current baseline tests pass. Add regression coverage for one-shot effects, no stale arrows after restart/camera switch, pause/help/settings returning to prior pause, and results awarded once.

In standalone help/settings, qualify online timer copy as hypothetical for a separately hosted server. Say local dialogs pause the local clock and this standalone supports one human plus bots; do not imply the checked-in standalone includes/hosts a Node room server. Preserve existing public APIs, preferences and any selected-base save/load support. No new room service.

## Global constraints

- Preserve 2–10 total contestants, one human plus bots, all three arenas and all four retained cameras.
- Preserve engine rules, shrinking bounds, simultaneous committed shots and seat-order tiebreaks.
- Preserve complete standalone HTML and untouched v1.4 original.
- No external art packs, new assets, rights assertions or upload.
- Source hash updates must follow verified intentional source changes; existing import assertions are not removed to permit edits.
- Treat current results as local branch evidence, never as deployment or hosted multiplayer proof.

## Review focus

1. Hidden/eliminated/TV viewers: status/marker additions must never expose rival coordinates, bearing or shots.
2. Scaled mobile Canvas: marker changes must preserve world-to-screen input mapping and avoid covering aim information.
3. Precision rules: accessibility/readability work must not introduce a trajectory guide.
4. Rapid mode/phase/restart transitions: transient feedback must not persist into a new plan or imply final results are editable.
5. Touch cancellation and dialogs: feedback callbacks must not couple the independent movement and aiming pointers or leave held movement active.

## Ordered implementation and checks

- [x] Audit the approved base; verify six import checks and unchanged source/original hashes.
- [x] Add and run non-conflicting engine/privacy/collision/volley/tiebreak/seeded lifecycle tests.
- [x] Run the new browser matrix and independent controls/pause/restart checks; record exact outcome in QUALITY_BASELINE.
- [x] Obtain coordinator approval of this exact file allowlist and product behavior.
- [x] Add failing browser assertions for illegal/legal placement feedback, phase labels, precision no-guide and feedback clearing. Confirm failures on unchanged Nightfall.
- [x] Implement items 1–3 in their specified embedded presentation/app regions only; update local-help copy from item 4. No unrelated repairs.
- [x] Run Node suites and all applicable Canvas presentation suites. Compare actual pixels at 390×844, 844×390 and 1440×960; test both rulesets and every retained camera/arena.
- [x] Verify original and embedded engine/camera/network/3D invariants; then update active size/hash, new evidence and owned docs.
- [x] Obtain independent review of the product commit; no findings.
- [ ] Supply portable local commits and evidence to coordinator for reconciliation. Do not publish.

Commands: `node --test games/blind-crown/tests/standalone.test.mjs tests/blind-crown-quality.test.mjs`; `python3 games/blind-crown/tests/presentation/test_quality.py`; existing `test_visuals.py`, `test_hud.py`, `test_final.py` with screenshot redirected outside checkout. HTTP-served Pages and shared cross-game gates belong to the coordinator. Missing dependencies are blocked, never passed.

## Execution ledger

- Tests/docs stage: `785a150..893e07e`; 20 Node checks and 36 browser combinations passed on unchanged source.
- Product RED: new browser checks failed on missing private status, misleading lobby label and undersized mobile endpoint before source edits.
- Product GREEN: placement clearing, labels/aftermath, readable endpoint and Precision exclusion pass. Pixel comparison finds no changes when rival planning coordinates/aim/shots vary, for all four cameras and own/public viewers.
- Regression RED→GREEN: added test caught the private status hiding disconnected-room instructions. Status now yields to the original connection-loss instruction; no networking byte changes.
- Final verification before review: 21 focused Node tests, 75 repository tests, 72 browser matrix cases, existing visuals/HUD/seeded-final checks passed. Restart from actual reveal/volley/results clears shots/effects and restores private planning.
- No rule/design deviations. Hash assertion intentionally failed after source changes, then was updated to the validated active bytes; untouched-original/engine assertions remain.

- Independent review: `785a150..cce1135`, no Critical/Important/Minor findings. Reviewer independently reran 21 focused Node checks and the 72-case browser suite, verified protected byte hashes and allowlist. Author visual/performance evidence was reviewed for accurate scope, not independently repeated. No rulings or deferred minors.
