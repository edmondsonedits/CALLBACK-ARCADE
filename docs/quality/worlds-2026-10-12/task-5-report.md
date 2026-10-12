# Task 5 — Space Bash: Four Decks

Status: **DONE_WITH_CONCERNS** at source handoff. Implementation commit: `e68a8a2` (`feat(space-bash): add four skill decks and complete sessions`). Report commit: `0e9b5ff`; a following scoped correction removes a misleading historical three-crown prefix from the menu rule summary and updates final hashes/control count. Base specified by brief: `966829d`. No push/deploy, generated catalog/shared file edit, original/archive edit, other game edit or subagent.

## Changes

- Retained Canvas2D/2.5D, 1/120 fixed step, movement/independent aim/grab/throw/kick/jump, CAM/public APIs, 2–10 seats, classic 90-second/first-three physics and crown/tiebreak rules. Existing swept height-aware impacts, reciprocal ownership, non-extending TNT, ungrabbable Nitro and reaction/safe CPU routing regressions pass.
- Genuine all-CPU title brawl uses bounded four-second real-simulation warmup and legal round loops. Compact title, selected deck/skill, Watch, accessible Start/Return, fresh seeded Start and help/pause/results/rematch/replay routes. Demo world/RNG/records/audio/haptics/input are isolated, including after sounded play. Reduced motion holds the preview still. Warmup and rounds do not modify real countdown/results/message DOM or consume real RNG.
- Orbital preserves classic destruction/throw timing. Cryo has visibly marked low-traction sectors and connected grip cross with actual acceleration/drag changes. Reactor alternates axis/strip positions across events, provides two-second warning and safe phases, renders the same continuous strip used for collision, checks jump height and permits one hit per fighter/event. Garden announces bounded four-second .38-gravity cycles; fighter/cargo landings and future-cycle prediction share those rules. All maps start connected with 64 panels and ten legal spawn positions. CPUs route around warned lanes and anticipate slippery approaches using shared physics.
- Crown sessions expose 30/60/90 seconds and one/three/five targets. Standard default remains unchanged. No survivors awards no crown; twelve consecutive empty rounds end honestly with no winner. Four-deck Series records exactly one real timed/elimination round per deck, with all-seat tied-placement points, stage and aggregate standings, Next, completed history and captured-seed/rules Replay. Flight school and Volatile Cargo work on every selected deck.
- Results report throws, jumps and damage taken, map/rule/session/crew/difficulty-scoped bests and completion-count mastery. Series score is `crew size − placement + 1`: surviving health ties share place/points; later eliminations outrank earlier ones. Completion requires four recorded rounds, with no fabricated progression. Crown timeout retains first-seat equal-health tiebreak.
- Grouped Play/Rules, Player Style, Controls and Audio/Access expose 21 meaningful controls including header mute: map, mode, seed, seats, difficulty, crown target, duration, hazard toggle, cargo mix, rule variant, name, color, patch, aim guide, coaching, haptics, touch-hand swap, volume, reduced motion, contrast. Rules stage until Start/restart; style/access apply live. Native text keeps empty edits/spaces until blur normalization. Corrupt/denied storage remains playable; scoped records are validated/capped at 128.
- MIT Alea is embedded with its complete copyright/license header and exact upstream source copied locally. Real/demo RNG instances are separate from cosmetic noise; global Math.random is never overridden. Kenney CC0 Particle Pack crystal/planter/impact sprites are actually rendered with procedural fallback. No unused 3D/audio packs or CDN. Particles cap at 500, imported impact overlays at 80 and Web Audio voices at 12.
- Real cargo and landing guide call one integrator, including future Garden cycle boundaries. Guide predicts first deck-height crossing; manual explains interception/terrain-change limits, GAP and TNT FUSE FIRST.
- Updated v1.15.0 title/manifest/readme/changelog, integration/source/asset provenance, game evidence, harness and smoke version check. Harness seeds the real Alea settings boundary to preserve diverse stress seeds; test-only exports are injected into the VM and are absent from production.

## Verification and exact bytes

Initial 12 desired-world tests failed against the previous source before implementation. Final gate:

| Command | Result |
| --- | --- |
| `node --test tests/space-bash-worlds.test.mjs tests/space-bash-sumo-benchmark.test.mjs tests/space-bash-quality.test.mjs` | **75 passed, 0 failed**: 17 worlds + preserved 58 benchmark/quality/stress/render paths |
| `node games/space-bash/tests/source-smoke.mjs` | passed: standalone/runtime/API and original archive contract |
| Node `vm.Script` compilation of inline script | passed |
| `git diff --check -- games/space-bash tests/space-bash-worlds.test.mjs` | passed |

The 75-check gate ran on implementation source `cee8904e5e172c752b6dd2888282c0fb837b79b9510e0414d16329d03437cfab`. Final source differs only in rule-summary wording; `node --test --test-name-pattern='volatile deck|editing contestant|Series counts' tests/space-bash-worlds.test.mjs tests/space-bash-sumo-benchmark.test.mjs` passed **3/3**, and standalone smoke/scoped whitespace passed again on the final hash. Parent owns final combined verification.

Natural 2/10-seat short crown sessions terminate on all four maps. Natural ten-seat demos remain finite across 130 simulated seconds per map. A real four-stage Series reaches four actual records then stays complete; captured Replay ignores staged seat/seed changes. Prior classic natural matches still finish at three crowns for 2/4/10 seats; repeated rematch/ownership/input stress remains green. VM render checks do not prove pixels or subjective feel.

| File | SHA-256 |
| --- | --- |
| `games/space-bash/source/index.html` | `4766c246ed4220652dce34d162d7d35d1d46c0106a4ea8b86541f740ea5e46be` |
| Preserved v1.13.1 upload | `e6fc6342764b743bc125c0519b2f61d9384411b69b563799e26a10ac834b46d8` |
| Exact upstream Alea | `9f821c9ede583e1c1f1d3263d6d016d13d562768de6c477d8262f7e8028a09cb` |
| Kenney Particle Pack archive | `b631d4b07f7002549fdcf155f01141ad482f79f3440e4e301eed49ce5f1d8958` |

`games/space-bash/assets/worlds/provenance.json` includes primary download URL, upstream Alea commit `4460ad325a0a15273a211e509f03ae0beb99511a`, source/archive and every copied-file SHA. Complete CC0 license and MIT source/header are included. `games/space-bash/integration/provenance.json` binds active/archive hashes to commands.

## Acceptance and remaining limits

| Dimension | Assessment at source handoff |
| --- | --- |
| Core controls/fairness | pass: retained mechanics/input/stress and new map checks |
| Map variety/counterplay | pass for functional timing/physics; pixels pending |
| Live title/complete flow | pass for real simulation/isolation/routes |
| Useful customization/persistence | pass for functional settings/native editing/validation |
| World/character/FX coherence | unverified pending parent Chromium screenshots |
| Audio/mute | pass for gating/bounds/demo silence; by-ear quality unverified |
| Accessible/mobile UI | unverified pending parent 390×844 / 844×390 review; scroll and 44px targets implemented |
| Replay/results | pass for all-seat ties/real stage history/replay/statistics/scoped records |
| Reliability/performance | pass for finite/bounded VM state and fallback; hardware timings unverified |
| Source/license/regressions | pass for exact provenance/archive and 75 checks |

Parent owns committed-candidate Chromium CI, screenshots/mobile target reachability, catalog/shared integration and independent review. Physical controllers/multi-touch, audio by ear and device performance are unverified. No subjective 9/10 claim or online multiplayer readiness claim; multiplayer stays not-integrated. Historical `tests/QUALITY.md` describes prior versions; current evidence is `tests/WORLDS.md`.

## Stable browser contract

Preserved `#setup/#startMatch/#setupSettings/#modal/#restart/#close/#results/#resultMenu/#rematch`; additive `#watchDemo/#returnTitle/#demoStart/#replay/#nextStage`. Preferences `#map` values orbital/cryo/reactor/garden; `#mode` classic/series; `#rule` standard/practice/volatile; `#goal` 1/3/5; `#roundLength` 30/60/90. Series uses one timed round per deck. Public phases setup/countdown/fight/over/match. Stage results use match; Next opens countdown. Restart applies staged settings and returns to explicit pause; Start/Replay resume a fresh countdown.

Read-only `SpaceBash.getState()` adds demo/demoElapsed/demoFighters/demoMap/demoTimeLeft/demoHazard, actual map/mode/seed/rules/Series history+scores+completion, paused, hazard cue and fighter/cargo/stats snapshots. During title actual `phase` remains setup; selected preview is `demoMap`, while staged actual `map` stays unchanged until Start. No production test accessor.

## Independent review — fix round 1

Review `task-5-review.md` identified P1 stale Series history/score capacity after public seat restart and P2 landscape message/cue overlap. Both addressed in the scoped correction accompanying this section.

- P1: `setPlayers()` uses the existing full session initializer with **active** seed, difficulty, mode, duration, target, hazard/cargo and rule values; staged preferences cannot leak into restart or Replay. Fresh Series starts on Orbital with zero history/stage, correctly sized finite zero scores and complete=false. Added regression tests failed before correction for 2→10 seat growth and completed-Series restart. They now cover all-seat finite scores, exact four-stage completion, Next staying inert afterward (no fifth stage), and identical captured Replay state.
- P2: at short landscape, #msg occupies the left side and #hazardCue the right side, each bounded to 90–200px, with wrapping text and separate horizontal bounds. Both sit below the HUD, outside the central ten-seat deck and above the side controls. No board geometry or control positions changed. The supplied Reactor screenshot was inspected; parent owns Chromium warning/active bounds and pixel recheck.

Covering command: `node --test --test-name-pattern='public setPlayers|Series counts|real Series timeout|editing contestant|match results list|short landscape|portrait and landscape' tests/space-bash-worlds.test.mjs tests/space-bash-sumo-benchmark.test.mjs tests/space-bash-quality.test.mjs` — **8 passed, 0 failed**. `node games/space-bash/tests/source-smoke.mjs` and `git diff --check -- games/space-bash tests/space-bash-worlds.test.mjs` passed. No broad gate repeated; the previous 75 passes remain historical evidence. Final source SHA-256: `bf80245b24c932ae78b233a146ef71657d693f774b0a73e0de5609479667405f`; original remains `e6fc6342764b743bc125c0519b2f61d9384411b69b563799e26a10ac834b46d8`. Source frozen after this correction pending parent verification. Physical device/audio/performance limits remain.
