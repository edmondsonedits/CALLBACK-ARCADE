# Task 5: Space Bash

Read this first — it is your requirements.

User request: examine true Royal Sumo v1.3.0 and upgrade every other game to comparable quality. Own **space-bash** only. Read `docs/superpowers/specs/2026-10-12-sumo-benchmark-design.md` for binding intent/constraints, then read root AGENTS.md, docs/EDITING.md, docs/GAME_SDK.md and your game's guide/source/tests.

Reference Sumo modules: `games/royal-sumo/source/project/src/app/ui.js`, `controls.js`, `style.css`, `audio.js`, and core `settings.js`, `session.js`, `sim.js`, `quality.js`. Read relevant portions yourself; assess real differences before choosing improvements.

## Owned paths
- `games/space-bash/**` (original/archive files must stay untouched).
- Create/modify only `tests/space-bash-sumo-benchmark.test.mjs` outside that folder.
- Report: `docs/quality/sumo-benchmark/space-bash-report.md`.
No generated catalog files, STATUS, shared tests or other game changes. No commits/pushes, no subagents.

## Required work
Grab/throw/kick skill clarity, aim and hazard readability, orbital-deck and fighter presentation, match flow/results, fair bot pacing, practice/rule variation, gamepad and persistent settings.

Implement a substantial cohesive upgrade covering the spec's six categories. Aim for at least one meaningful player-facing change in flow, control, in-play art/feedback, settings/access and gameplay/replay depth where the audit identifies a real gap; do not make pointless duplicate features. Preserve existing working mechanics and avoid an engine rewrite. At least one substantive in-play improvement is required; a CSS-only menu pass is insufficient. Existing quality work may already satisfy individual requirements; document it and deepen actual gaps.

Use small named functions inside the existing standalone where reasonable. Meaningful new behavior gets behavioral tests, not only source regex assertions. Keep existing tests passing. Version bump the game appropriately and update README, CHANGELOG, manifest and provenance hashes/evidence. Run only your focused tests; parent handles whole-repo gates.

Known runtime limit: local Chromium process startup fails `socket() failed: Operation not permitted`; cloud browser WebGL2 unavailable. Don't spend repeated attempts bypassing restrictions. Existing deterministic VM/Node tests and syntax checks are available. Parent will perform available browser checks.

## Report contract
Write source-grounded comparison findings, exact changes by category, files changed, test commands/results, remaining known limitations and specific regressions to watch for. Return only status, short change/test summary, report path and concerns. Prioritize quality and actual implementations; no placeholders, fake completion or claims of subjective parity.
