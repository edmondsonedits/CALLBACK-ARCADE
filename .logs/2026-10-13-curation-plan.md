# Game curation and optional bots

**Goal:** Archive the sixteen explicitly marked Arcade games, give hosts red/green On/Off controls and free deterministic bots in every remaining game, and provide a per-game investment review with researched hosted alternatives.

**Design:** Empty seats show a two-state Bot switch; a phone hides that switch and uses its own identity. Enabled vacant seats play; disabled seats are absent from simulation, collision, winner and score calculations. Preferences persist between rounds and phone departures. Bot-free, mixed and all-bot rounds are supported within each game's minimum participants. On 2026-10-13 the user answered the scope question with "Build bots for every remaining game", expanding the implementation to Bowl and all sixteen native engines. Bots use normal authoritative actions and only information available to their own role; no paid model jobs.

**Constraints:** Existing Sites audience/source line and prior pack archives remain intact. Archive source/licensing and persisted-match compatibility are retained. D1/authenticated host actions own lobby eligibility and settings. Existing server simulations retain authority; standalone TV games keep their established simulation architecture with D1-owned roster configuration. AI does not decide scores, phases, identities or winners. No images or paid AI jobs are generated during QA.

- [x] Archive central IDs/aliases, selectors, creation/start/replay and direct-entry availability; keep active persisted render/input paths.
- [x] Online bot preferences, frozen sparse round roster, version-guarded joins/removals, score reset on occupant changes, and shared-session late-join integration; focused unit red/green evidence collected.
- [x] Standalone phone-room additive migration, host-only roster freeze, sparse adapter mappings and five game phone/browser flows.
- [x] Existing main bot games: logical lobbySlot 1..10 separate from immutable historical D1 seat; fresh phone identity, legacy hydration, audience compatibility, saved preference restoration and old score/lore attribution.
- [x] Bowl and sixteen native games: deterministic gameplay-specific bots, role privacy, normal validation/scoring and regression coverage.
- [x] Recommendations for all thirty remaining game concepts and official hosted alternatives in docs/2026-10-13-game-curation-review.md.
- [x] Source-stable related browsers, unit/type/lint/build/render gates and first exact-source publication (v79).
- [ ] Final static archive fix: exact-source republication and deployed checks, recorded in the release receipt.

Main seat review found cross-role D1 seat collisions, unsupported audience phase restrictions, repeated solo-bot replacement and legacy seats above ten. Sol review recommended logical lobby slots instead of deleting/reusing historical identity rows. Logical slots and fresh identities are verified. Sites v77 was merged to preserve avatar, music and mirror changes; phone bots are additive migration 0011. One online browser run was invalidated by a temporary development error overlay during concurrent source editing; release evidence requires a stable rerun.

Fresh v79 hosted QA passed twelve scenarios and exposed Sites serving archived static files before the Worker. A build-time gate now writes seventeen index notices (sixteen games and one alias) while preserving raw restoration source. Guarded legacy online renderers require an authenticated matching PLAYING room in a host/player/mirror iframe. Sol reviewed mirror authorization parity and top-level denial; focused checks pass.

Preserved the concurrent v80 phone and puppet update. The merged full unit suite passes 882 checks with eight skips; all thirteen affected phone/avatar/mirror browser cases pass after isolating a test timer and explicitly waiting for parent/child mirror readiness. Production mirror logic is unchanged: the failing trace contained valid authenticated snapshots and delayed local Vite loading.
