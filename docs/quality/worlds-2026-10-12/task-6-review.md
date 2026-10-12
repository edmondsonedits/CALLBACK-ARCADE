# Task 6 independent review — Blind Crown

Reviewed implementation `2ac8cb1`, task brief/report, supplied diff, and relevant source/provenance. Active SHA-256 independently confirmed: `81ecc8b18e4e65ce17513d19746d4513023530dec0ee3e9eac614f8256d8c515`.

**Spec compliance verdict: REQUEST_CHANGES.**

**Implementation quality verdict: REQUEST_CHANGES.**

## Required correction

**P1 — Completed Tour seeds expose future private bot plans.** `source/index.html:1468` derives each stage seed as `(base + index * 104729) >>> 0`; `:1469–1471` includes completed stage seeds in public summaries. `:1854` returns those records throughout later private planning, and also exposes the captured seed at every stage final. Thus the first final reveals the base seed for a fresh Tour; the next stage's seed and deterministic initial bot plans can be reconstructed from the public engine. The final-only captured guard does not protect later stages. Keep seeds private until the entire Tour finishes, filtering both captured diagnostics and every public record (or use independent private stage entropy). Retain internal captured replay. Add a targeted fresh-Tour test checking the first final and subsequent planning, including nested summary records; verify that the seed field is not populated with generated Tour seeds.

**P2 — Staged rival count breaks captured replay and strands Tour advancement.** `source/index.html:1987` validates `settings().bots` before resolving `request.spec`; `:2255` advances `tour.index` before attempting Start. After a natural stage-one final, setting the native rival slider to zero causes Replay to remain at final. Next then changes the Tour to stage two while the displayed match remains the completed Citadel stage. Restoring one rival does not recover Next, because stage two has no completed record. This violates captured replay/staged rules and the finite Tour lifecycle.

Reproduced with the existing real-coordinator VM harness, without running the suite: `final / stage1 / completed1 / bots1 → staged bots0 → Replay: final/stage1 → Next: final/stage2/Citadel/completed1 → restore bots1 + Next: still final/stage2/Citadel`. Resolve and validate the captured stage specification for continuation, and advance only when its match successfully starts. Add one targeted coordinator regression covering replay and Next after staging zero rivals.

## Reviewed strengths and limits

- Material collision, bounded segmented banks, announced between-round shutters, and shared Canvas arrow/review path helpers are coherent. Completed geometry and shots are detached and deeply frozen; history is bounded to 24.
- Private player snapshots omit rival coordinates/aim; bot targeting uses predictions/last-seen positions. Precision suppresses the predictive overhead/isometric guide. Direct captured diagnostics suppress active stage seeds, but the Tour derivation leak above defeats that guard.
- Demo uses its own Match, RNG and renderer, hides planning actors, and bypasses real history/records and sound events. Finite four-stage rules, scoped bests, and stored stage seeds otherwise match the brief.
- Original v1.4 hash independently confirmed unchanged: `496131ad8031a58b8b2ec78cc1aace73f57ab1ca0646271b383bf48bb108c462`. Kenney local sprite, CC0 license and upstream/per-file provenance are present; runtime bitmap has a procedural fallback. Optional Three remains explicitly unverified.
- Reported 37 worker checks and parent legacy/integration evidence were not rerun. This review used one targeted reproduction. Browser/mobile readability, physical controls, audio by ear and subjective presentation remain parent-owned evidence; no numerical certification.

No code changes, suite reruns, subagents or publication actions performed.
