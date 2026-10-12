# Final integration review

Reviewed branch `5d1f3c7`, integration package, progress/acceptance record, shared build/browser/catalog paths and the specifically deferred issues. This is an integration review; accepted game audits and suites were not repeated.

**Verdict: CONDITIONAL PASS.** No additional gameplay blocker found. Complete the concrete closing gates below before publication/completion claims.

## Closing gates

- **Generated catalog freshness — must fix.** At reviewed HEAD, Blind Crown's manifest records `7e761538…`, but `catalog/games.json` and `db/seed.sql` retain `81ecc8b…`; independently compared manifests/catalog entries. Regenerate all three generated outputs after the final source/manifest change, then check them. Other five upgraded manifest/catalog entries agree.
- **Blind Crown browser closure — must finish.** Parent reports desktop/landscape passing, portrait failing and actual title/results clipping under correction. Review that narrow CSS change and obtain the affected exact-source viewport evidence. Do not declare all-profile acceptance before it passes.
- **Portrait replay assertion — harness correction required, parent has corrected it.** Captured stage Replay retains earned Tour records/standings and overwrites the stage record only after its next natural final. The former `records.length===0` assertion contradicted that implementation. Check private planning, ten captured seats, zero round history and unchanged earned Tour records/standings instead; keep seed-privacy checks. This requires no replay gameplay change.
- **Build/evidence freshness — must refresh final artifacts.** The scratch Pages output currently matches all five earlier upgraded HTML sources but contains an older Blind Crown copy. A fresh build is required after the final correction; CI already builds from its checked-out commit. Update FINAL_REVIEW's old Space source hash to accepted built-site `571fd02f…` and add final Blind evidence once accepted. Parent reports Space built-Pages **102 checks / 0 errors** on that corrected asset-path source.

## Deferred issues accepted as P3

| Item | Triage and practical limit |
|---|---|
| Scratch decorative apron caption | Acceptable presentation debt: some decorative stage-name pixels are occluded; functional court identity/coaching remain available. |
| Roller portrait checkpoint denominator wrap | Acceptable readable wrapping; checkpoint ordering/active gate remain correct. |
| Roller Crownway and Twisted Spiral Keep static subtitles | Acceptable branding inconsistency; separate active course/tower status names the selected world correctly. |
| Twisted empty crown-table headings in practice/Tour results | Acceptable presentation debt: the actual drill summary explains clears/hits and explicitly disclaims crown ranking. |
| Twisted F2 `getSession().rules.players` after `setPlayerCount(10)` | Real diagnostic inconsistency, acceptable P3. `matchRules` is captured before final control normalization; actual ten fighters and `capturedRun.players` are correct, and gameplay/replay never consume `matchRules.players`. Consumers should use actual roster/player count until corrected. No new source/browser cycle required for this minor. |

## Integration evidence

- Base-to-HEAD inspection found no Royal Sumo changes and no changed original/archive paths. The preserved Blind original hash was independently confirmed during its task review.
- Pages copies each imported game's complete `source/` tree. Space's corrected local assets now sit within that published tree; Blind's used impact sprite is embedded. Added loader/model/texture closure was already covered by accepted scoped reviews/browser evidence.
- The five earlier accepted game HTML hashes remain unchanged except the explicitly reviewed Space packaging correction. Earlier source/dependency-matched browser evidence may be reused as recorded; final changed Space/Blind checks exercise built Pages entries.
- Shared legacy test changes supply missing harness context/stubs; supplied diff does not remove their behavior assertions. Browser matrix retains manual all-game selection and records errors/screenshots. No hosted multiplayer or physical-device/audio/performance certification is implied.

No suites rerun, per-game re-audits, code edits, subagents or publication actions. Final CSS review and gate status should be appended by the parent after the outstanding correction.

## Final bounded overlay fix — `1d6f235`

**Scoped source/test review: PASS; no new issue found.** Independently confirmed source SHA-256 `546839ce6ffcab10f041fa1ba4ff45b6f05bbc76f1ce3f49793e97f0cf1e042b`.

The scrollable backdrop now aligns its content at the top, prevents the welcome panel from shrinking, and reserves 72px above lobby content for the live-demo bar. Phase changes and Return reset scroll to the heading; final/results content keeps its full scrollable height. The new coordinator regression covers Return, natural final, captured Replay and repeated final, including retained earned Tour history and cleared round history. Reported three targeted checks pass; no suite repeated here.

Parent portrait browser assertion now checks actual planning, captured ten seats, hidden active seed, zero local round history, and unchanged earned records/standings. It fixes the earlier incorrect zero-Tour-record expectation without weakening the privacy/lifecycle checks. Source acceptance is clean; the integration verdict remains conditional on the refreshed generated/build artifacts and exact-source three-profile pixel evidence.
