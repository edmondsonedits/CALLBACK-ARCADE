# Task 1 — scoped visual fix-round 2 review

Reviewed `f2fc5a2..dc15b48` and the appended implementation report. Scope is the two portrait cue failures identified by the parent's exact-source screenshots, plus new breakage introduced by this fix diff.

| Finding | Verdict | Source evidence |
| --- | --- | --- |
| Arena cue covers the third roster row at ten seats | **ADDRESSED** | `games/royal-ballistix/source/index.html:400` measures the rendered roster bottom and uses `rosterBottom + 10` as the minimum cue top. The portrait placement also clears the court; wide placement uses its left margin. `hud` invokes this after updating the roster at line 345, so changed seat/name wrapping is accounted for. Demo mode clears these inline positions to restore its title anchor. |
| Long Tour countdown cue clips beyond the right screen edge | **ADDRESSED** | `games/royal-ballistix/source/index.html:142` replaces nowrap with normal wrapping plus `overflow-wrap:anywhere`, a viewport-bounded maximum width and centered text. Existing global border-box sizing includes padding/borders within that width. Line 400 bounds the active width; line 401 shortens countdown wording while retaining court identity, skill and Tour court/time labels. |

**New breakage in the reviewed fix diff: none found.** The production changes concern cue text/layout, without modifying physics, controls or session behavior. The browser harness adds real DOM overlap/scroll-width/horizontal-bound checks for all four active maps and Tour countdown; these appropriately supplement the geometry stubs rather than treating them as rendered proof.

Reviewer verification: ran only `node --test --test-name-pattern='visual review:' tests/royal-ballistix-worlds.test.mjs`: **2 passed, 0 failed**. The cases cover a three-row roster, portrait court clearance, bounded width, retained Tour labels, wide margin placement and restored demo anchor. Confirmed HTML SHA-256 `bfb1502a133a0200adc2c4df9478c5dcdca1592d2f72ca3664aca663a6b2161d` matches the appended report. Inspected the reported 91/91 focused evidence without rerunning unchanged broad suites.

**Scoped source-review verdict: pass.** Both reported causes are addressed. Parent-owned exact-source CI DOM checks and fresh screenshot inspection are still required for rendered acceptance; this review does not certify unobserved pixels. No fixes or commits were made by this reviewer.
