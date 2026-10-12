# CALLBACK Arcade Worlds Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. One game at a time, with task review and fixes before the next game. No worker delegates further.

**Goal:** Add live bot title demos, meaningful customization and learnable arena variety to all six non-Sumo games.
**Architecture:** Keep existing standalone Canvas/Three.js runtimes; isolate map rules, demo lifecycle and persisted preferences in focused helpers within each game package. Reuse licensed assets and existing tested session/input patterns.
**Tech Stack:** Existing HTML/CSS/JS/Canvas/Three.js, Node behavioral tests, browser QA.
**Spec:** docs/superpowers/specs/2026-10-12-arcade-worlds-design.md

## Global Constraints

All Binding requirements in the spec apply. No Sumo/original/archive changes. One game implementation at a time. Preserve engine, current APIs and 2–10 contestant capacity. Parent owns root catalogs/STATUS/shared tests, asset intake and publication. Worker owns only assigned game and unique root tests, and may commit only those paths. No worker push/publish/delegation. Do not label subjective 9/10 or hardware/browser checks as verified without evidence.

## Review Focus

- Demo must not consume user session state, records, input or sound permission; clean start/menu transitions.
- Every arena changes simulation and has fair telegraphed counterplay, including bot behavior and ten seats.
- Saved rule changes stage; malformed/denied storage and fresh defaults remain playable.
- Canvas/WebGL art matches actual collision/hazard timing; bounded resources and no new render/sound failures.
- Native fields/button keyboard focus, held-pad neutral guards, touch cancellation and existing camera/API behavior survive.

## Task sequence

Each game task: read its brief/spec/current source and source-bound prior report; write failing behavioral tests for new risky rules/lifecycle; implement coherent content; run focused checks; document pass/needs-work/unverified rubric; commit own paths and report exact commands/hashes. Parent supplies licensed assets and handles browser inspection, independent review and fixes before marking complete.

- [x] Task 1: Royal Ballistix — games/royal-ballistix/** and tests/royal-ballistix-worlds.test.mjs. Live court demo; four courts and siege/tour; customization and presentation. Brief docs/quality/worlds-2026-10-12/task-1-brief.md.
- [x] Task 2: Royal Scratch Match — games/royal-scratch-match/** and tests/royal-scratch-match-worlds.test.mjs. Live music demo; four musically coherent stages and tour; customization/presentation. Brief task-2-brief.md.
- [x] Task 3: Royal Roller Ruckus — games/royal-roller-ruckus/** and tests/royal-roller-ruckus-worlds.test.mjs. Live racing demo; four course environments with actual surface/hazard differences; series, style and tuning. Brief task-3-brief.md.
- [x] Task 4: Royal Twisted — games/royal-twisted/** and tests/royal-twisted-worlds.test.mjs. Live survival demo; four hazard themes with existing-verb counterplay; tour/customization. Brief task-4-brief.md.
- [x] Task 5: Space Bash — games/space-bash/** and tests/space-bash-worlds.test.mjs. Live crew demo; four functional decks; series/custom rules/style. Brief task-5-brief.md.
- [x] Task 6: Blind Crown — games/blind-crown/** and tests/blind-crown-worlds.test.mjs. Live all-bot volley demo; four tactical maps, accurate completed review; tour/style/rule customization. Brief task-6-brief.md.
- [x] Task 7: Parent integration — refresh metadata/catalog/STATUS, independent whole-branch review, complete repository/build/source-preservation checks, publish and verify live hashes/available rendered scenes.
