# Task 3 browser fix round 2 — independent scoped review

Reviewed `f306c49..6b6c9a7` and `task-3-fix-2.diff`, limited to the reported Castle Kit dependency, compact-title spacing, landscape coach overlap, recovery-button input/fit and associated regression risk. Verified source SHA-256: `2b6b59de0bcadbfcb0907d2eeb60a4389178e3fec5c0ce91c907d2e91d1f9217`.

**Scoped source/spec verdict: pass. Scoped code-quality verdict: pass.** All reported causes are addressed in source. No unaddressed source finding or new breakage found. Final rendered-layout and real-fall/tap acceptance remains pending the coordinator's fresh browser run.

| Reported issue | Result | Evidence |
| --- | --- | --- |
| Castle GLBs request missing `Textures/colormap.png` | Addressed | PNG now exists at the exact relative path used by both Castle GLBs; manifest and provenance include it. Independently compared its SHA-256 with the intake's original GLB texture: both `66fd49be148f32e88f6c8cace67120250d1943a7856601158ad0ff24651db0b0`. Existing full Castle Kit CC0 notice covers the copied file. |
| Compact title reads `ROYALROLLER` | Addressed | Literal whitespace after the `<br>` preserves word separation when responsive CSS hides the break, while the desktop line break remains intact. |
| Landscape coaching overlaps speed HUD | Addressed in CSS; pixels pending | Final short-height rule moves coaching from fixed `70px` to `safeT + 108px`, below the race row at `safeT + 53px`. It retains the right inset and safe-area alignment. Parent owns actual bounds/pixel confirmation. |
| Landscape recovery inherits disabled pointer events and overfills panel | Addressed in CSS; tap/fit pending | `.info-panel .respawn-btn` explicitly restores `pointer-events:auto`; the existing click handler and 44px minimum target remain. Only while recovery is visible, the secondary title/meter hide to free panel height. Ordinary driving state and larger-height layouts retain their prior presentation. |
| Redundant branding interferes with short-landscape demo | Addressed | Only `.demo-mode .brand` inside the short-height media rule is hidden; the title panel and Watch actions remain. Removing demo mode restores race branding. |

Independently ran the full focused command: `node --test tests/royal-roller-ruckus-worlds.test.mjs tests/royal-roller-ruckus-quality.test.mjs tests/royal-roller-ruckus-sumo-benchmark.test.mjs` → **61 passed, 0 failed**. Scoped diff whitespace check passed.

The added resource-closure test reads actual shipped GLB/glTF image and buffer URIs, follows local dependencies recursively, and checks containment, existence, per-file hashes and manifest inclusion. It reaches the formerly missing texture through the real GLB URI; it therefore protects the observed failure rather than merely asserting the new filename appears in source. Updated asset documentation correctly acknowledges the external local image.

No simulation or JavaScript runtime changes are present in this round. Source inspection supports the CSS corrections, but CPU tests cannot establish final hit-testing, text bounds or rendered model appearance. The coordinator's fresh three-profile/all-course screenshots and native falling/tap-recovery checks remain the acceptance evidence for those behaviors. No code edits, commits, delegation or deployment were performed.
