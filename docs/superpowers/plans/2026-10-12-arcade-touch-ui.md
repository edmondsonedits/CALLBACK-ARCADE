# Arcade Touch UI Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation and one bounded final review.

**Goal:** Consistent, independent two-thumb input and touch-friendly UI across all Arcade games.
**Architecture:** Shared DOM policy/stylesheet and per-pointer ownership fix the existing controller paths. Native game simulations and server authority stay unchanged.
**Tech Stack:** React, TypeScript, vanilla browser JS, existing esbuild and Node tests.
**Spec:** docs/superpowers/specs/2026-10-12-arcade-touch-ui.md

## Global Constraints
- Preserve editable text, settings scrolling, existing game rules, room cookies and native archives.
- No new dependencies or paid assets. 48px control targets; support safe areas and reduced motion.
- Sites manages source push/build/publication. Browser QA must be skipped without control-browser.

## Review Focus
- Two fingers on movement or one held action do not steal/release the other's input.
- Pointercancel/lost capture cannot leave movement, charge or drawing active.
- Modal/text input keyboard actions never reach gameplay.
- Small portrait/landscape controllers fit without horizontal clipping.
- Every game entry loads the shared standards; editable inputs remain selectable.

### Task 1: Shared touch standards
Files: lib/arcade/touch-ui.ts, app/components/ArcadeTouchTools.tsx, public/arcade-games/shared/arcade-touch.css, scripts/build-arcade.mjs, app/layout.tsx, local/online/native controller roots.
- [x] Write and run failing policy/coverage tests.
- [x] Add scoped callout/selection/drag prevention, pointer-aware pressed feedback and persisted size toggle.
- [x] Integrate each canonical game surface and generated/imported entry, preserving original archives; pass tests.

### Task 2: Independent pointer handling
Files: lib/arcade/pointer-controls.ts, ArcadePracticeControls.tsx, online/OnlinePhone.tsx, arena-runtime.js, six active imported pages, relevant aiming/drawing controllers.
- [x] Reproduce actual controller ownership/cancellation failures with shipping-handler tests.
- [x] Fix ownership and source-aware holds, release/reset lifecycle and editable keyboard guards.
- [x] Verify movement plus actions, two pointers on one hold, rhythm chords and drawing ownership.

### Task 3: Release
- [x] Bounded independent review; address important findings with regressions.
- [ ] Update STATUS/evidence; run typecheck/lint/unit/build/Worker render checks.
- [ ] Package/push through official Sites workflow, verify archive, deploy and report limits.
