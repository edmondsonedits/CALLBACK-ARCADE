# Nightfall quality baseline — tests/documentation only

Recorded 2026-10-12 on approved base `785a15000abe11970c7b92c5f3cab197061fcedf` in isolated branch `quality/blind-crown`. The companion [bounded plan](QUALITY_PLAN.md) is awaiting exact product-edit approval. This stage changes no product source, original, active hash assertion, assets, metadata or shared contracts.

Playable entry: `games/blind-crown/source/index.html`.

| Bytes | SHA-256 |
| --- | --- |
| Active standalone, 171542 bytes | `06a0238b9827cd6f4395ec33cd0b2c8c7ce758bc15135a946ed7c737e53ef0e4` |
| Untouched v1.4 original | `496131ad8031a58b8b2ec78cc1aace73f57ab1ca0646271b383bf48bb108c462` |

## Fresh tests on approved branch

**Passed:** `node --test games/blind-crown/tests/standalone.test.mjs tests/blind-crown-quality.test.mjs` — 20 passed, 0 failed (6 existing import checks and 14 new behavioral tests).

New coverage: own-seat/public-TV/eliminated-viewer privacy; lock/unlock and deadline; reveal immutability; cover impact endpoints at all 60 wall faces; placement clearance and swept collision; retained perspective cover/boundary geometry across rounds 1/4/8/13; mutual and three-way wipe; committed shots surviving a hit; one-time scoring; last survivor, round limit and equal-points seat-order tiebreak; clean rematch. Seeded lifecycle loops complete 54 matches: 2/4/10 contestants × three arenas × two rulesets × three seeds, with one stationary human and remaining bots. These are deterministic engine checks, not bot skill or game-feel evaluation.

**Passed:** `python3 games/blind-crown/tests/presentation/test_quality.py` — 36 arena/camera/viewport combinations plus actual fine adjustment, drag aim, lock/unlock, pause/help/settings, restart, and Chromium-emulated simultaneous touch movement/aim and cancellation. No page exceptions; default backend remains Canvas. Width/height combinations are 1440×960, 390×844 and 844×390. This checks filtered player state, not full pixel-differential privacy across all views.

**Passed negative controls:** Temporary copies outside the checkout were changed separately to expose planning coordinates, reveal early when every human locked, and skip a committed shooter already listed as a victim. `node --test <temporary-copy>/tests/quality.test.mjs` failed for all three. Authoritative game source was never mutated. These prove test sensitivity; they are not product defects found on baseline.

## Earlier read-only checks on the identical source bytes

**Passed:** `python3 games/blind-crown/tests/presentation/test_visuals.py` — filtered visible actors including public spectator, shared cover footprints, snapshot immutability, static cache, one-shot effects, bounded particles, camera-switch expiry and reduced motion.

**Passed:** `python3 games/blind-crown/tests/presentation/test_hud.py` — arena choices, synchronized UI, portrait icons, final-only standings, reduced motion and reachable controls at all three sizes.

**Passed:** Existing `test_final.py` executed through Python `exec(compile(...))`, with only its screenshot destination redirected outside the repository. Actual seeded controls reached reveal/volley/final, opt-in audio caused no exceptions, and rematch hid standings. No audio-by-ear claim.

**Passed:** External read-only script `/workspace/blind-crown-audit/baseline.py`; matrix data `/workspace/blind-crown-audit/baseline.json`. Actual screenshots were opened and inspected for desktop overhead, portrait overhead and first-person, landscape third-person, and seeded final. They show small own-archer/aim labels in portrait and disabled “Unlock to edit” wording at final. No rendered comparison with Royal Sumo v1.3 was possible.

## Conditions and limits

Headless Chromium 154.0.8037.57 on Debian 13 cloud executor; exact standalone loaded with `set_content`, default Canvas renderer. The earlier matrix used ten contestants and 100ms settling per view. Cumulative render-diagnostic means across samples ranged 1.97–4.11ms; maximum observed render was 35ms. These are short cumulative samples, not an isolated performance benchmark, real-GPU test or physical-phone FPS guarantee.

**Blocked:** Royal Sumo v1.3 Library ZIP materialization. The exact supplied Library file resolved; its current transfer helper and one fresh consumer-local retry both failed with “download failed”. No readable reference bytes or v1.3 pixels; older repository Sumo was not substituted. No further workaround was attempted.

**Not run:** physical-phone/Safari/gamepad testing, audio listening, experimental Three.js/WebGL, hosted multiplayer, HTTP-served Pages test, full repository/build/deployment gates, independent review of a product implementation. Product implementation has not begun. Earlier Nightfall reports remain historical evidence, not newly repeated networking verification.

## Provenance and reconciliation

No assets were added, uploaded or replaced; no licensing claim changed. Existing Nightfall provenance describes procedural Canvas/SVG art and synthesized audio, plus the retained project-generated GLB and its recorded CC0 notice. This is an inventory of existing notices, not an independent new rights attestation. Experimental GLB appearance remains unverified.

The coordinator selected Nightfall only for this isolated branch. The separate courtyard import/native-asset gate remains intact, and the coordinator must reconcile histories before any publication. This tests-only stage is local and unmerged. Shared metadata, catalog/version finalization and cross-game regressions remain coordinator-owned.
