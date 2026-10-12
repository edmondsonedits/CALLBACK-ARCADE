# Task 4 — fix round 2 scoped review

Reviewed 2026-10-12 against `task-4-brief.md`, the fix round 2 section of `task-4-report.md`, and `/workspace/scratch/89700bddec30/twisted-fix2-review.diff`. Active source SHA-256 independently confirmed: `53a29791785efd06899422f8c3b6ecbd09761b6cfc7367d944848c60283a5a81`.

**Scoped spec verdict: PASS for the reviewed source changes.** The four requested corrections are implemented without changing the helix, camera contract, or simulation rules. Parent-owned rendered acceptance remains open.

**Scoped task-quality verdict: PASS for source/CPU review.** No actionable new breakage was identified in the supplied fix diff. This verdict does not establish mobile pixels, palette readability, or measured GPU performance.

## Findings and evidence

No new findings.

| Requested correction | Review result |
| --- | --- |
| Compact portrait title leaves bot action visible | Portrait setup has a 270px cap, two selects in one row, and three actions in one row. Duplicate demo controls and the setup-time tower status are hidden. Watch exposes the existing Start/Return demo bar after setup closes. Hiding the title help action retains the top-bar help button. Actual bot/title overlap remains a screenshot check. |
| Foreground turret occlusion during setback | Existing turrets move from radius 10 to 14 and down 3.4; procedural surrounds and loaded model placements move to radius 24. Camera and track formulas are unchanged. The supplied CPU ray regression covers four towers, 2/4/10 seats, three viewports, and sampled full-setback positions. It intentionally excludes loaded GLBs; actual rendered turret/model clearance remains parent-owned. |
| Distinct readable Frost/Storm palettes | Selection now updates retained sky uniforms, fog, deck, hemisphere and sun colors. Frost uses a brighter cyan environment and reduced fog density; Storm uses a darker blue environment. Added fill/deck emission targets dark silhouettes. Sky output uses the bundled Three tone-mapping and color-space chunks. Distinct source palettes are verified; readable rendered contrast awaits screenshots. |
| Lower static rendering cost preserves transforms | Static meshes batch by geometry parameters, material identity and shadow flags, using each original local matrix. Shadow map size drops from 1536 to 1024. Independent actual-Three CPU construction compared every pre/post-batch matrix and material/shadow signature: 346 track meshes become 5 children; 58 tower meshes become 14 children. All 404 transforms match within 1e-5, and every animated flag remains an independent child. This establishes reduced static submissions, not hardware frame time. |

The new copied render diagnostics and camera projection fields provide useful parent browser evidence without changing input or simulation authority. Material changes apply to retained instanced materials; tower selection does not reconstruct the static helix or add environment lights. Review of the batch/disposal and selection paths found no new resource-growth path introduced by these changes.

Read the reported 130 passing focused checks, smoke/syntax/integrity checks and source-bound evidence; did not repeat the suite. Independent execution was limited to the all-mesh batching comparison above and the source hash check.

## Scope and limitations

This review covers fix2 and breakage caused by fix2 only. The earlier deferred contestant-count snapshot finding is outside this scope. Parent owns ordinary Chromium screenshots and actual loaded-asset, mobile-layout, palette and rendering-cost acceptance. CPU construction and CSS inspection cannot certify those outcomes.

No production code changes, commits, subagents, push or publication were performed. This report is the only repository artifact added by this review.
