# SDD ledger — plan: docs/superpowers/plans/2026-10-12-arcade-worlds.md

Base: 22d366040d197481107817af4476216088623407
Worktree: /workspace/scratch/89700bddec30/arcade-worlds

Preflight: tasks1–6 have disjoint game/test ownership; task7 consumes each manifest/source/report and exclusively owns generated catalogs. All tasks preserve standalone/APIs/archives and obey the same demo/settings/rules contracts. No task-interface conflict found. Each per-game brief adds game-specific acceptance before dispatch.

Execution decision: user's explicit request authorizes continued reversible design/implementation and established publication; no procedural approval loop. Sequential implementation/review, not six concurrent workers. 9/10 is an aspirational quality target; evidence gates determine completion claims.

Task1: in progress; implementer /root/worlds_ballistix, base 053f84e, brief task-1-brief.md. Assets downloaded from official Kenney CC0 packs; Alea MIT source inspected. Parent adding CI browser capture with read-only GitHub Actions and artifact download to address local browser limitations. Tasks2–7: pending. Do not redispatch completed tasks after compaction.

Task1 implementation: aa19bc7. Focused 86/86 and full regression 402/402 reported in worker evidence. Parent catalog check, typecheck and Pages build pass. Independent review and CI rendered QA pending. Parent integration commits update only catalogs/STATUS/browser tooling.

Task1 browser first run: remote review branch quality/arcade-worlds-review commit 2c7c0b8 (tree equals local22bdb34); verify CI38228732561 pass; browser CI38228732596 pass99 checks/0 errors in Chromium156 across desktop/portrait/landscape. First artifact upload skipped hidden output folder; original implementer fixed workflow in0a4ad8d to include dedicated directory and fail on missing artifacts. Full JSON preserved in task-1-browser-first-run.json; screenshots await rerun. Review agent /root/review_ballistix_worlds reviewing053f84e..12adb6e.

Task1 review: needs work, findings in task-1-review.md: Tour roster API scores, demo-held release/audio/shake on Start, native name editing; workflow artifact issue already fixed. Original implementer /root/worlds_ballistix handling fix round1; reviewer /root/review_ballistix_worlds idle. Parent browser harness adds true name typing and10-seat maps.
Remote mapping: main remains22d3660. Review branch updated bfc5d8fb8c0e699ec2a061ffdf23a8b1777f38a7, tree dd6b9f7185fd697e68bf70a8a4b0d16caeaa3c96 equals local5c742aa. Rerun browser38229330979 in progress; verify38229330973 pass. Next upload diff must use local5c742aa (unless updated mapping is recorded).

Task1 fix round1/5: original four findings addressed; independent scoped re-review clean (task-1-fix-1-review.md), source fixf2fc5a2; focused89/89 incl19worlds pass. Parent inspected8 retained screenshots from browser run38229330979 across desktop/portrait/landscape; selected courts/themes, menu world separation and scrolling settings legible, no new blocker. Screenshot source55f7... precedes behavior fixes; final exact-source10-seat/name run pending.
Remote mapping updated: review9694241e9bc5387ccd427c02042e7e015b14daa0 tree0c789473080cf48e395fe7eab1635fa9477e3d5d equals local47fc9c6. Artifact11738052011 extracted to /workspace/scratch/89700bddec30/ballistix-browser-2. Next upload diff base47fc9c6.

Task1 visual fix round2: final source run38229704991/artifact11738112524 passed114 browser checks/0errors and verify38229704905 pass, but inspected10-seat portrait screenshots revealed #arenaCue overlaps roster row3 and long Tour cue text clips right edge. Original implementer fixing scoped responsive placement/text; parent adds DOM bounds/scrollWidth assertions. Files at /workspace/scratch/89700bddec30/ballistix-browser-3; source2b33e11...; not accepted/publishedmain yet.

Task1 visual fix2 implementation dc15b48: focused91/91 incltwo responsive layout regressions; sourcebfb1502a133a0200adc2c4df9478c5dcdca1592d2f72ca3664aca663a6b2161d. Scoped re-review in progress. Review branch now0f4a5bd64604360d8ab40a62376acf9d9cb3ad5b tree5eb67ac42f2e41c8b904fb3b030db7a07fe96389 equals local0db0045. Final browser rerun pending; next upload diffbase0db0045. Main still22d3660. No nextgame implementation yet.

Task1 accepted: final exact-source browser run38230796941, artifact11738846053:129 checks passed, zero page/request errors across desktop1440x900, portrait390x844 and landscape844x390. Parent viewed final portrait Clockwork and Tour, landscape Gale and desktop Moonwell: cue clears all10 roster seats and court, Tour text fits, touch actions remain clear. Selected screenshots and complete report retained in games/royal-ballistix/tests/evidence/worlds-browser/. Independent scoped review clean in task-1-fix-2-review.md. Physical devices/controllers and audio-by-ear remain unverified; no numerical quality certification. Source hash bfb1502a133a0200adc2c4df9478c5dcdca1592d2f72ca3664aca663a6b2161d. Task1 complete; Task2 may begin.

Task1 publication: main fast-forwarded from22d3660 to8474d8f254eabba22492643983b23f263b1223b7 (same tree e596632563c5480ce36a9d9c8d5aa519954d32c1 as local37b38f7). Pages run38231692755 and verify38231692744 success. Published live title and Start inspected in interactive cloud browser. Remote review branch also8474d8f; next upload diffbase37b38f7. Task2 implementer /root/worlds_scratch at briefbase673d123; independent review not started.

Published Ballistix HTML readback SHA256 matches accepted bfb1502a133a0200adc2c4df9478c5dcdca1592d2f72ca3664aca663a6b2161d (118159 bytes).

Parent Task2 browser scenario prepared: real title/watch, native name typing, all4 stages,10 seats, actual keyboard/touch echo input, paused clock and clean Tour start across3 layouts. Implementation is still owned by /root/worlds_scratch; no acceptance yet. Additional official CC0 castle-kit/nature-kit/space-kit assets downloaded and licenses inspected in /workspace/scratch/89700bddec30/asset-intake, archive URLs/hashes in downloads-3d.json; not yet included in games.

Task2 implementation e77fc91, sourceec7457200e5d22f2881517fadefef5078a72294633b7b309af0ac4a949a375bb;65 focused tests/smoke pass. Independent reviewer /root/review_scratch_worlds reviews673d123..e77fc91 using /workspace/scratch/89700bddec30/task-2-review-package.diff. Parent catalog integration and first real browser run next.

Task2 integration: root suite425/425 passed after adapting4 legacy extracted-function harness presentation boundaries in1ae0bbf (timer assertions unchanged; included in independent review). Typecheck/catalog check/Pages build pass. Remote review ad5f66e0aa776669210551f548e662324321d4fa tree86cbfbf344771fa3f3fddf3f18b9c6b3f8466fb0 equals local1ae0bbf. Browser/verify CI pending; main remains8474d8f (accepted Ballistix). Next upload diffbase1ae0bbf.

Task2 review needs work on one P2 spec gap: Watch view hides the sole Start action. Source/code-quality otherwise pass (task-2-review.md). Original implementer /root/worlds_scratch doing fix round1; parent real UI scenario adds Watch→Start/reset/visibility checks. Initial browser run38233551270 still running against pre-fix source; verify38233551856.

Task2 fix1 implementation49cce6d: visible Watch Start/Return bar, shared fresh-start action and focus handling.19worlds checks and smoke/archive pass; sourcee058abc8e81dcf36ccf40baa2520371df07c17a8622cd027adf6ea279bd68f72. Scoped reviewer /root/review_scratch_worlds using /workspace/scratch/89700bddec30/task-2-fix-1.diff. First browser run still pending, do not cancel it before inspecting sourceec745… screenshots.

Task2 fix1 independently clean (task-2-fix-1-review.md). Initial browser38233551270/artifact11740455543 passed252 checks(123Scratch+129Ballistix),0 errors; verify38233551856 success, sourceec745…. Parent inspected8 screenshots; found short-landscape hit rating behind HUD, rehearsal title/subtitle overlaps HUD/actions, and portrait title-demo status clipping. Original implementer /root/worlds_scratch handling visual fixround2; parent adds DOM bounds assertions and preserves3 problem screenshots+report in games/royal-scratch-match/tests/worlds-browser-first/. No nextgame implementation yet.

Task2 visual fix2 cde0215: all3 screenshot causes addressed,22worlds checks plus smoke/archive pass. Source4866174e89a07e444091ab2a550b74cc25f6ef211277aea44f45ad5fe5cb7d18. Scoped re-review and fresh exact-source browser run next.

Task2 fix2 scoped review clean (task-2-fix-2-review.md), no new breakage. Remote review252774eeced6568b9ee6f1cacd12288bfd5d2c7f tree d03a862c0d02f606bd11bc38425bd99f1dfa66d1 equals local8ad880f. Main still8474d8f. Fresh exact-source browser and verify pending; next upload diffbase8ad880f.
Task2 minor (deferred): decorative stage-name canvas caption intersects stage apron at bottom of desktop Tide demo (first-run screenshot); selected stage is fully available in menu/status, gameplay unaffected. Final whole-branch review should triage/remove or reposition redundant caption.

Task2 exact-source verify CI38234927703/job114763143170 succeeded:429 root tests,144 Sumo source tests and7 phone-room tests pass; typecheck/catalog/build pass. Runtime4866174e…. Browser38234927701 still pending.

Task 2: complete (commits673d123..cde0215, source review clean; one deferred decorative-caption minor). Final browser38234927701/artifact11740323393:147 Scratch checks +129 Ballistix checks pass,0 errors, exact source4866174e…. Parent viewed final landscape hit/rehearsal, portrait demo and Watch screenshots: all three reported overlaps/clipping resolved and Watch Start visible. Final report/screenshots in games/royal-scratch-match/tests/worlds-browser-final/. No physical-device/audio-by-ear/FPS/numerical rating certification. Publication next, then Task3 Roller Ruckus.

Task2 publication: main and review moved to0880b4ea8cbbac68f9295036a34340b23f1499da, tree482fab2bbb2113cc72bb389cb9b5ea05bb07798b equals locala8bd324. Fresh main lease was8474d8f; no concurrent change lost. Pages/live readback pending. Next upload diffbasea8bd324.
Ruling: retain existing tested Three.js racing/survival physics instead of migrating to a new Rapier runtime — the user requests reuse of working systems and this expansion preserves original feel/API/ordered-gate behavior; a wrong choice would require later physics integration work, not lost user data.
Task3 brief written for sequential Roller Ruckus implementation.

Task2 publication verified: Pages38235691901, main verify38235691945 and browser38235691883 succeeded. Live Scratch HTML SHA2564866174e89a07e444091ab2a550b74cc25f6ef211277aea44f45ad5fe5cb7d18 matches accepted source (118554 bytes).
Task3 implementer /root/worlds_roller dispatched at BASE1c262d7; only Roller source/tests/report owned. Parent owns browser QA and shared integration.

Task3 baseline browser probe: remote review0fa355cad1febab8720e9494e3f1c5a66c8fe0e3, tree0dc2e7ed527dea3924ca4f5b482e6904a5ee79f0 equals local661a389. Runs ordinary Chromium with no graphics bypass flags against current production Roller. This is capability/baseline evidence, not acceptance of the expansion. Main remains0880b4e; next upload diffbase661a389. Official Three r180 GLTFLoader/BufferGeometryUtils/LICENSE fetched to asset-intake/three-r180 with hashes; implementer handles actual vendoring.

Task3 baseline CI38236602606/artifact11741751242 ran on unchanged Roller source3195b89a…: Canvas276 checks remain pass; live WebGL2 contexts succeeded for portrait/landscape, no runtime errors. Roller desktop initial visibility and portrait native click exceeded10sec; landscape still showed countdown3 after3.6wallsec. Parent inspected portrait failure and landscape race PNGs: no blocked button, correct rendered geometry. Desktop capture also timed out. These are baseline software-rendering/timing limits, not expansion acceptance. Current scenario waits on actual phase, allows bounded slower WebGL UI waits, records default balanced title then selects real Performance preference for sustained course flow. Source worker asked to improve useful Performance mode and fix FPS diagnostic using unclamped wall time. No graphics-security bypass flags used.
