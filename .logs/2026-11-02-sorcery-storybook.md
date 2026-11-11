# Sorcery storybook journey

Source baseline: published Site v121, commit `926b83cb925a2ccb976b83384c56ee7fd9c40167`, inspected in `H:/ChatGPT/CALLBACK-face-photo-2026-11-01`. Original C checkout preserved. Sites source helper confirms the same remote source. User requested home-to-game walkthrough, whole-game polish, medieval type/motion/humour and Edmondson family Easter eggs, using agents.

## Changes

- Local licensed Cinzel headings, heraldic entry cards and richer stage treatment. Body and numeric text keep existing fonts. No external runtime font fetch.
- Full-screen lobby field guide and House Edmondson lore. Family jokes are fictional, affectionate and do not invent relatives or private facts. A second seal discovery sits in the pocket spellbook; the TV carries an ink-approval stamp.
- Phase-aware progress covers preparation, drawing/enchantment, tour, vote, guesses, reveal and results. Three-round prompt graphic corrected from II to III. Motion remains decorative, bounded, reduced-motion aware and paused with the room.
- Four-chapter spellbook retains drafts, explains exact 100/75/50 ballot and 50-point guess rules with version-aware two-/three-round copy. Timer warning is explicit.
- One-entry-at-a-time completed gallery with original/enchanted toggle, all/my filters and original downloads. Uses only already-disclosed entries; no client result inference.
- Replay errors now surfaced, Start remains visible after moving fish practice to a full-screen menu, assigned drawing help no longer advertises unavailable prompt selection or saving, and fish voting/reveal captions are reachable.

## Evidence

- `npm run typecheck` passed. `npm run lint` passed with zero errors and eight inherited image-element warnings.
- `npm test`: 1,237 tests, 1,226 passed, 11 skipped, zero failures. The skips are not counted as passing configured integrations.
- `npm run build` and `node --test tests/rendered-html.test.mjs` passed; all ten production-render checks passed.
- Optional fish browser checks passed: original three-round scores remain stable when the bonus is skipped; three authenticated artists lock transparent fish and cast partial peaceful ballots without changing main scores. Test cleanup returned 409; the disposable harness was subsequently torn down, not reported as successful End Game cleanup.

- Final focused UI/game verification: 14 unique passing cases across two Edmondson menu checks, four full-screen navigation checks, five existing Sketch Showdown checks, the new home-to-host three-round journey, and the two fish cases above. The twelve-case UI batch finished 11 passed/one PNG-timeout failure while a concurrent build triggered preview navigation; the unchanged PNG recovery test passed in a fresh isolated rerun after the build finished. Do not describe that initial batch as fully passing.
- Journey evidence uses four authenticated phones: real canvas drawing/upload on all four, full phone voting/guessing/emotes on the representative player, authenticated companion actions, all three rounds, original-art fallback, hidden child code, spellbook/practice menus, exhibition all/my filters and version toggle, download access, and an injected replay failure retaining scores. Captures wait for image decoding. Portrait 320x568 and landscape 667x375 gallery controls must both fit and remain non-overlapping; keyboard/reduced-motion menu coverage also passes.

- Broader release attempt: `npm run qa:local -- --browser --max-failures=5` ran the 164-case suite until the threshold: 16 passed, five failed, 143 not run, plus a runner-reported non-test error at termination. Failures remain in older Arcade tests: expected eight bot switches versus ten, a shared-lobby launch returning 409, and three legacy phone lobbies with an empty room code in this harness (which does not configure the separate legacy Arcade Worker). These are separate from the 14 passing focused cases and were not changed or weakened to obtain a green result. The complete browser suite is not green.

Browser artifacts are synthetic, local and ignored; they must not be included in the source archive. All browser runs use the disposable app/party Worker, no real providers or production room data. A Luna worker owned menus/journey checks, and an independent Sol reviewer checked disclosure, authority, replay and motion boundaries. Runtime failure injection additionally exposed the host wrapper swallowing action rejections; Sketch callbacks now propagate these to their existing retry handlers. Screenshot review corrected a wrapped drawing hint and overlapping short-landscape exhibition controls.

Known limits: real AI transformation output, physical phones/TVs, poor Wi-Fi and group enjoyment are not established by this local pass. The focused Sorcery release is verified for the exercised flows; this is not an unrestricted platform-wide readiness claim. Keep Site v121 as rollback. The post-seal publication receipt and live hashes are stored in ignored `.logs/sorcery-journey/` and Sites version history, preserving the exact tested source and existing public audience.
