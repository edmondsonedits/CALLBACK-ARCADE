# Four-deck acceptance — v1.15.0

Active SHA-256: `571fd02f0050c3a4947d53644f769a77f05866d9a864162361a3e0603e64f7d0`. Archive: `e6fc6342764b743bc125c0519b2f61d9384411b69b563799e26a10ac834b46d8`.

`node --test tests/space-bash-worlds.test.mjs tests/space-bash-sumo-benchmark.test.mjs tests/space-bash-quality.test.mjs` — 75 passed, 0 failed (17 worlds + 58 retained). Standalone smoke/archive and scoped whitespace checks passed. Full 75-check gate ran against source `cee8904e5e172c752b6dd2888282c0fb837b79b9510e0414d16329d03437cfab`. Final source changes only the menu summary to remove a misleading hardcoded three-crown prefix; three affected settings/volatile/Series tests and standalone smoke passed on the final hash. Parent owns the final combined gate. Initial 12 desired-world checks were red before implementation. Concrete fixes then covered demo warmup/menu side effects, public setPlayers/rematch snapshots, cross-realm test comparisons, and gravity landing isolation from CPU attacks. Existing harness seeds now seed MIT Alea through the real settings boundary, preserving diverse stress seeds without a production test accessor.

Coverage: actual Cryo surface/grip forces, Reactor warning/safe/jump/one-hit behavior and disabled hazard modifier, bounded Garden cycles/shared predictor at a future boundary/real landings, all four natural 2/10-seat timed crown matches, natural ten-CPU demos across legal rounds, fresh demo-to-match RNG, demo audio/haptic/record/input isolation after sounded play, native empty/spaced names, staged rules/live style/denied-corrupt storage, finite tie-aware four-stage Series/scoring and captured replay, pause freezing, fallback render paths/resource caps. Prior swept cargo, reciprocal ownership, non-extending TNT, Nitro, aim/pad/touch and classic stress checks remain.

| Dimension | Assessment at source handoff |
| --- | --- |
| Core control / fairness | pass: retained physics regressions and natural completion |
| Map variety / counterplay | pass: functional force/hazard/cycle tests; pixels pending |
| Title demo / flow | pass: isolated real bots and complete route tests |
| Customization / persistence | pass: grouped functioning settings, validation/native edits |
| World / character / FX coherence | unverified: licensed rendered assets; browser pixel review pending |
| Audio / mute | pass for gating/bounds/demo silence; by-ear quality unverified |
| Accessible / mobile UI | unverified: scrolling 44px controls implemented; parent browser inspection pending |
| Replay / results | pass: played-stage history, ties, all-seat stats/scoped records |
| Reliability / performance | pass for bounded VM simulations/fallback; device timing unverified |
| Source / license / regressions | pass: exact licenses/hashes and archive preserved |

No subjective 9/10, physical touch/pad, audio-by-ear or hardware-performance claim. Parent owns Chromium, screenshots, independent review, catalog/shared gates. Historical `QUALITY.md` documents earlier versions; this file supersedes its version-specific no-asset/blocked-browser statements for this handoff.

## Independent review correction — round 1

Public setPlayers now initializes a fresh finite Series through the existing session initializer, capturing active difficulty/seed/rules instead of staged values. Two added tests were red before the fix: 2→10 score sizing and completed-Series restart. Eight covering tests passed afterward, including finite scores, four-stage completion/no fifth stage and identical replay. Landscape message/cue are bounded to separate 200px side areas above the controls and outside the central deck, preserving playfield geometry. Parent owns actual Chromium warning/active bounds and pixel recheck.

`node --test --test-name-pattern='public setPlayers|Series counts|real Series timeout|editing contestant|match results list|short landscape|portrait and landscape' tests/space-bash-worlds.test.mjs tests/space-bash-sumo-benchmark.test.mjs tests/space-bash-quality.test.mjs` — **8 passed, 0 failed**. Standalone smoke/archive and scoped diff checks passed. No broad suite rerun.

## Publication closure

Runtime images now resolve from `./assets/worlds/`, with the three PNGs, CC0 license and runtime provenance moved under `source/assets/worlds/`. Physics/rendering logic is otherwise unchanged. `node games/space-bash/tests/packaging.mjs` builds into a temporary directory and verifies the published HTML resolves all three PNGs inside its game root with exact hashes; the license/provenance are shipped. Exact Alea reference remains a single copy under `assets/worlds/`. No full simulation/browser rerun.
