# Researched drawing prompt catalogue Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for this bounded content update.

**Goal:** Replace the sixteen repetitive examples with 100 short, varied, source-documented drawing ideas.

**Architecture:** Keep catalogue data in lib/content, map only safe example fields into the existing server snapshot, and use the existing private shuffle seed when examples fill an election. Player-written prompts and their tie priority remain unchanged.

**Tech Stack:** Existing TypeScript/React, deterministic engine and Sites.

**Spec:** User requests researched favorites from multiple sources and a 100-prompt replacement. No trustworthy individual-prompt top-100 ranking was found; distinguish published examples and adapted drawing-game suggestions from verified popularity rankings. Shorten adaptations to at most 45 characters, retain a source per entry, and preserve the full list in a research document.

## Tasks
- [x] Research official examples, independent reviews, first-person community reports and published drawing-game suggestions; record evidence limits.
- [x] Reproduce the sixteen-item pool and fixed-first-five fallback; implement the 100-item catalogue and seeded sampling.
- [x] Verify borrowing a late-list prompt on a narrow phone and its non-original classification, plus normal election/scoring regressions.
- [x] Run content/engine tests, typecheck, lint and build; obtain bounded content and regression review. Exact publication and live acceptance are recorded in the sibling release receipt.

## Execution evidence
- Two regressions reproduced the sixteen-item pool and fixed first-five election fallback before the change; both now pass.
- Catalogue has100 unique stable IDs and texts, at most37 characters; sources distinguish21 published phrases and79 adaptations without invented popularity scores.
- Phone browser check selected item100 at320px, verified scrolling and non-original classification, and retained original-player prompt priority.
- Full unit suite:1046 passed / nine existing skips with serial file execution. An unrelated wall-clock-sensitive Light Trails test failed in the parallel run and passed unchanged in isolation and in the full serial run.
- Six focused browser scenarios, TypeScript, lint, build and nine production-render checks pass. The old animation-delay test was repaired after trace evidence showed a second poll leaking around its gate; production motion code is unchanged.
- A concurrent Site version97 appeared during release preparation. Its approved-audio source97df1f92fc1bee9181c2def5e78a7f2c6e322e50 was merged as an ancestor, preserving both STATUS records. Final combined verification:1,056 unit passes / nine existing skips; eight focused game/catalogue/audio browser passes; TypeScript/lint/build/diff and nine production-render passes. The sibling receipt records exact native publication and live catalogue acceptance.
