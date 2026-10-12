# Task 1 — scoped fix-round 1 review

Reviewed `12adb6e..f2fc5a2` using `task-1-fix-1-review.diff`, the appended implementation report, changed production code and regression cases. Scope is the four original findings and new breakage introduced by this fix diff.

| Original finding | Verdict | Evidence |
| --- | --- | --- |
| 1. Tour standings corrupted by immediate roster API | **ADDRESSED** | `games/royal-ballistix/source/index.html:331` resets Tour index, completed count and a correctly sized zero-filled points array, and returns to the existing route's first arena before resetting the round. The targeted case covers a progressed Tour, growth to 10 and shrink to 2, with finite timeout standings. |
| 2. Exhibition-held feedback/shake leaked into fresh Start | **ADDRESSED** | `games/royal-ballistix/source/index.html:466` detaches and discards old demo-held balls and clears magnet state before changing the demo flag/unlocking audio; it resets shake. The targeted case gives every demo paddle a held ball and confirms no oscillator creation during Start, zero shake, empty new balls/holds and clean statistics. |
| 3. Native name editing rewritten per keystroke | **ADDRESSED** | `games/royal-ballistix/source/index.html:315` no longer writes into the focused name field. The blur handler at line 490 normalizes the visible value. The targeted case covers empty text, separating spaces, middle edits and an unrelated settings save without rewriting the focused buffer. The browser harness adds actual sequential typing and checks the name survives Start. |
| 4. Hidden screenshot directory excluded from CI artifacts | **ADDRESSED** | `.github/workflows/browser-worlds.yml:35–36` explicitly includes hidden files and errors on absent output. Parent reports successful rerun `38229330979` with retained artifact `11738052011`, confirming the original retention failure is resolved. |

**New breakage in the reviewed fix diff: none found.** The corrections are scoped to their causes; the changed browser flow and evidence/report updates introduce no additional actionable finding in this review.

Reviewer verification: ran only `node --test --test-name-pattern='review:' tests/royal-ballistix-worlds.test.mjs`: **3 passed, 0 failed**. Verified the current HTML SHA-256 is `2b33e11ec4662e5fa2452aba9207531faa8e6bba5bef717780e6f4a95a296015`, matching refreshed manifest/provenance/evidence. The implementer's 89/89 focused result was inspected as recorded evidence, not rerun. No unchanged broad suites were run.

**Scoped verdict: pass; all four original findings are addressed.** Parent-owned inspection of retained images and the fixed-source 10-seat/typed-name browser rerun remain separate acceptance work. No rendered-pixel, audio-by-ear or physical-device claim is made here. No fixes or commits were made by this reviewer.
