# Sorcery workshop execution ledger

Base: 4303bd05492295449ca5ad47e51fe308b6e6802e / Site v129.
User approved implementation of all planned features with two corrections: fish is an independent catalog game, never a new Sorcery encore; remove early fish preparation entirely.

Execution: preserve source in the verified Sites checkout. One focused Luna worker owns standalone fish lifecycle; root owns Sorcery modes and subsequent workshop work. No production publication until integrated validation. Existing docs were untracked planning work and are retained.

- [x] Independent fish lifecycle/catalog and Quick/Long Sorcery
- [x] Owner-bound persistent creation storage and drafts
- [x] Submitted-player workshop and one shared ten-second closing window
- [x] Prompt preferences, bounded rewards and learning
- [x] Stacked scenery and historical fish
- [x] Reveal animation
- [x] Hall nomination/publication
- [x] Pocket pairs/reactions
- [x] Integrated release validation

Publication is performed through Sites after the production build/render gates; the deployment receipt in outputs/ and Sites version history are authoritative for its final result.

Ruling: implement in the existing Sites-owned checkout to preserve source-helper provenance and current local setup; preserve concurrent edits. All work stays within H:\ChatGPT.

## Integrated evidence

- Full Node suite: 1,256 passed, 11 environment-dependent skips, zero failures (1,267 total). Live isolated API suites separately passed 7/7.
- Lint: zero errors; eight existing/private-media image optimization warnings. Typecheck passed.
- Quick three-phone workshop journey passed including saved scenery, owner isolation, timed 25-point reward, shared finish window, separate Hall consent, two rounds and replay. Host-only hide/show returning art passed; a phone cannot override it.
- Long four-phone three-round journey passed after explicitly exercising the new Hall intermission. Other seven Sorcery/showcase browser checks passed; six narrow-phone layout/reconnect/character checks passed.
- Fifteen focused scoring/Hall/storage safety checks passed; fifty scenery objects/ten owners, immutable aging, current-fish exclusion and tiny fine-spray save/delete were verified.
- Read-only Sol review found the future catalogue-ID snapshot hazard: fixed by freezing issued ballot text and a legacy-safe fallback, with regression coverage. No further high-severity scoring, pause or Hall consent issue in that focused review.
- Browser fixtures were updated where they assumed new Sorcery matches still offer fish encores. New independent fish replay uses an explicit closed-game results surface.
- A legacy UI rendering assertion was corrected to compare React-escaped prompt text, retaining both private-assignment absence and authorised reveal checks for apostrophes/ampersands.

## Practical limits

No paid AI/image work ran. Provider failure/fallback paths were exercised in the disposable QA environment. Real group enjoyment, physical devices, real Wi-Fi and fifty-object visual density with a live group remain human acceptance work; automated correctness is not evidence for those claims.

## Final release checks

- Fish focused browser run: 5/5 passed (12 minutes using real server clocks): peaceful controls, WebGL loss/restoration, four- and ten-human shark stories, pause/reload, original art/revival, idle aquarium stability, persistent-session independent replay, returning fish, and host-selected longer time.
- Home-to-persistent-lobby Long journey passed all three rounds; narrator and session-kick/reset checks passed.
- Full browser release attempt: 16 passed, 3 failed, 157 not run after the configured three-failure stop. The exact same three failures were reproduced against untouched Site v129 source in an isolated provider-disabled baseline: Arcade bot switch count, excluded Sumo seat launch, and featured-phone room creation. These are not newly introduced by this patch. The full 176-test suite is therefore not claimed green.
- Baseline fixture copy initially followed a Windows dependency junction during relocation; packages were restored, the junction detached, and lint/typecheck/full units rerun successfully before the final fish run. No source was lost.
- Final edge checks prevent long fish history hiding editable scenery, reject practice/bot Hall nominations and arbitrary fish creation through the scenery API, and show settled Hall honours on the TV without changing points.
- v129 remains saved as rollback source. Drain new v4/standalone-fish rooms before reverting to an older engine that cannot parse those new records.

- Final Node rollup after edge fixes: 1,259 passed / 11 skipped / 0 failed (1,270 total). Full lint/typecheck passed; eight private-image optimization warnings remain. Final Hall TV checks include honour/replay-button bounds above the footer, not only document overflow.
