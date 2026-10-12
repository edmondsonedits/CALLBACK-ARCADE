# Task 2 — independent Watch-action fix review

Date: 2026-10-12. Scope: implementation `49cce6d`, supplied `task-2-fix-1.diff`, appended implementation report and parent browser Watch-to-Start assertions. This is a scoped re-review of the P2 finding in `task-2-review.md`, not a repeat of the full game review.

**Original finding: ADDRESSED. Spec verdict for this fix: PASS. Code-quality verdict for this fix: PASS.** No new actionable breakage was found in the fix diff. The original review's source/runtime acceptance now has no open concrete findings; overall screenshot acceptance remains parent-owned and pending.

Evidence:

- `source/index.html:168` places both Return and Start in `#watchBar`, outside the collapsed title menu. The fixed bar has viewport-width constraints, safe-area offsets and minimum 44px button targets (`:125`). Actual rendered bounds still require the pending browser run.
- `watchDemo` (`:570`) exposes the bar and moves focus to Start. Return restores title Start focus; `closeSettings` restores Watch Start focus when applicable. `startDemo` and `startRound` hide the whole bar, preventing stale Watch actions during a real performance.
- Both Start buttons use the same `startFromGesture` handler (`:1384`): explicit audio unlock, the existing fresh-session path, then focus on Pause. No separate simulation, RNG, scoring, asset-loading or rule code was introduced by this fix.
- The added regression invokes the actual Watch Start DOM handler after demo bots have scored. It verifies countdown, zero real inputs/resolutions/scores, fresh lives, audio unlock, hidden Watch controls and focus handoff. The implementer reports the targeted regression failed before implementation, then all 19 worlds tests and smoke/archive checks passed. These are VM-boundary checks, not rendered visibility or hardware evidence.
- Parent browser additions click the actual Watch Start control, check Start/Return viewport bounds, assert clean real state and hidden Watch controls, and return through the ordinary pause/menu flow. Those assertions are appropriate for the finding; their runtime result and screenshots were not available to this reviewer.
- Independently matched runtime SHA-256 `e058abc8e81dcf36ccf40baa2520371df07c17a8622cd027adf6ea279bd68f72` and worlds-test SHA-256 `d62ffd09043738cb5aff063848ce37eab607b97338a9cb71ed813719f6f372da` to the updated evidence. Prior full-suite evidence is explicitly retained under its previous source hash rather than represented as a fresh run on this fix.

No unchanged test suite was rerun; no concrete suspected new failure required a targeted reproduction. No source edits or commits were made. This review does not certify uninspected pixels, audible mixing, physical controls, measured frame rate or a numerical quality rating.
