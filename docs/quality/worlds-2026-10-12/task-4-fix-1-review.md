# Task 4 — fix round 1 scoped re-review

Reviewed 2026-10-12. Scope: F1 from `task-4-review.md` and regressions introduced by its correction in `2728cc3..ed9203c`. Implementation commit: `a5ea904`. Independently confirmed active source SHA-256: `f022aaec0d931e7871bcea9a984601ac6b02d369e4cf4ce756930924d62e51db`.

**Scoped spec verdict: PASS.** F1 is addressed: replay captures gameplay rules and seed while retaining the player's current cosmetics and access preferences.

**Scoped task-quality verdict: PASS.** The small correction targets the cause, has a meaningful actual-handler regression with real Three material/scene nodes, and introduces no identified breakage in the reviewed fix diff. No new findings.

## Evidence

- Read the supplied fix review package, existing brief, appended worker report, production diff, regression, and saved red/green evidence.
- The production change at `games/royal-twisted/source/index.html:561–564` replaces the full preference spread with explicit capture of tower, mode, goal, modifier, difficulty, contestants, rhythm and seed. Immediate style/access fields and personal records no longer enter the replay override. The existing `restartMatch()` therefore applies the current player style, and repeated replay cannot recapture obsolete cosmetics.
- Independently reran the original actual-handler F1 sequence on this source: name `Original` → start → change name to `Current` and headwear to `plain` → actual Rematch click. The replay's public standings retain `Current`, and preferences retain `plain`. Changed the name again to `Latest` and replayed a second time; the session retains `Latest`. Confirmed `capturedRun` contains only the eight intended gameplay/seed fields. All assertions passed.
- The new regression additionally checks the actual Three material color and headwear/crown visibility, current volume/reduced motion/contrast/coaching, and captured Ember/practice/short/gentle/hard/seed417 despite staged alternate rules. Saved red evidence shows the original name mismatch; saved green evidence passes.
- Read the worker's 124 focused / 480 root passing evidence and integrity/syntax checks. Those identical broad suites were not rerun for this scoped review. The source hash matches the updated evidence.

## Scope and limitations

F2 (P3, the existing contestant-count rules snapshot discrepancy) remains explicitly deferred to final branch review per the parent instruction; this verdict neither resolves nor reopens it. Parent-owned catalog/browser integration in the supplied range is not attributed to the worker.

The parent browser run was still exercising the previous source at handoff. This scoped source/handler review does not certify current-source rendered pixels, native mobile scrolling, GPU performance, physical touch/gamepads, audio by ear or subjective feel. Browser/hardware acceptance remains parent-owned.

No production code changes, commits, delegation or publication were performed. This report is the only artifact added by this re-review.
