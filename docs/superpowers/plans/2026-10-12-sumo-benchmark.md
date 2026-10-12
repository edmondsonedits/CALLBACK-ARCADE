# CALLBACK Arcade Sumo Benchmark Implementation Plan

> **For agentic workers:** Use focused independent game tasks and parent integration; read each task brief and the design constraints. No worker delegates further.

**Goal:** Upgrade all six non-Sumo games using Crownfall v1.3.0's concrete strengths.
**Architecture:** Retain each self-contained game and renderer; develop independently in nonoverlapping game folders. Parent updates generated discovery, runs shared gates, reviews and publishes.
**Tech Stack:** Existing HTML/CSS/JavaScript, Canvas/Three.js, Node tests, existing browser tooling.
**Spec:** `docs/superpowers/specs/2026-10-12-sumo-benchmark-design.md`

## Global Constraints

All constraints in the spec apply verbatim. Root generated catalogs/STATUS/cross-game tests are parent-owned. Sumo and original archives remain byte-identical. Each task uses its own `tests/<game-id>-sumo-benchmark.test.mjs` if root registration is needed. Workers never commit, push or publish shared files; parent records coherent commits after review.

## Review Focus

- Long holds, cancellation, blur and menu transitions must neutralize input without phantom actions.
- New pre-match/menu states must not mutate active match rules or advance simulation invisibly.
- Reloads with corrupt or denied storage must retain playable defaults.
- Crowded 10-player rounds and ties must produce valid standings, not arbitrary winners.
- Additional visual/audio effects must be bounded and respect reduced-motion/mute preferences.

## Tasks

- [x] 1. Ballistix: audit Sumo and own code; implement game-specific spec; behavioral tests and report.
- [x] 2. Scratch Match: audit Sumo and own code; implement game-specific spec; behavioral tests and report.
- [x] 3. Roller Ruckus: audit Sumo and own code; implement game-specific spec; behavioral tests and report.
- [x] 4. Twisted: audit Sumo and own code; implement game-specific spec; behavioral tests and report.
- [x] 5. Space Bash: audit Sumo and own code; implement game-specific spec; behavioral tests and report.
- [x] 6. Blind Crown: audit Sumo and own code; implement game-specific spec; behavioral tests and report.
- [x] 7. Review per-game diffs and reports, address regressions, update source hashes and generated catalog/STATUS; run full gates.
- [ ] 8. Publish only verified contents, monitor CI/Pages and compare live source hashes; report concrete remaining playtest limits.

For each implementation task: identify real gaps in source; record chosen changes; add a failing behavioral regression for risky logic; implement the smallest cohesive solution; run focused tests; report outcomes and limitations. Avoid tests that merely search for new labels.
