# Task 6 — Blind Crown Tactical Worlds

Status: **DONE_WITH_CONCERNS**, implementation commit `2ac8cb1`, review-fix commit `ac02879`, final overlay commit `1d6f235`. Current source frozen at handoff; parent owns browser inspection, root legacy fixtures, catalog/build and publication gates. No push, subagents, original archive or Royal Sumo changes.

## Delivered slice

- Original Citadel stone/corner configuration; recognizable Orchard and Frost dioramas now have real arrow-permeable movement-blocking hedges and once-reflective ice. Fourth Clockwork Court alternates announced shutters between rounds. A selectable absorbing-cover rule restores the Classic material behavior. Shape stripes, OPEN/CLOSED/BANK/ARROWS PASS labels, perspective bands and concise coaching identify materials without relying on color.
- The embedded engine captures per-round geometry before planning. Guides, four retained Canvas cameras, animation, own-arrow highlights and immutable review use shared two-segment paths, a 1,400-unit total bound and actual finish time. Ice's second collision absorbs; corner ties choose x-face, target ties choose seat. No geometry changes after lock. Swept movement and placement remain legal at 2/10 seats through every permitted shrinking round.
- Geometry-aware bots evaluate public predicted/last-seen targets and actual material paths, including simple banks; a regression proves changes to rival current secret coordinates/aim cannot change their plan. Original simultaneous fire/mutual hits, lock deadline and Classic/Precision privacy remain. Historical pure helper defaults retain absorbing cover; Matches pass captured materials explicitly.
- Title runs a separate real all-bot Match/RNG and renderer, warms up at most 41 engine ticks to its first reveal, then naturally loops matches. Planning hides its actors; reveal/volley shows them. Watch collapses the compact title with Start/Return available. Demo never enters real history/records/input/audio, including after sounded real play.
- Practice selects any arena. Tour visits four arenas in order with four rounds maximum per stage, keeping selected planning time. Only natural final states enter stage/aggregate standings; Next ends after stage four. Replay uses captured rules/seed; later menu changes remain staged. Bests are map/material/mode/difficulty/capacity/time/length scoped. Existing survivor/points/seat ties are honestly explained.
- Completed history is a detached deep-frozen 24-round bound containing exact bounds/materials/segments; settings/map changes cannot rewrite it. New match/stage/setup clears local round history. Practice seed diagnostics appear only at natural final; Tour captured seeds stay private until the entire Tour completes and public Tour records always omit seeds. Generated seeds never enter the native seed field/prefs; active private plans and fresh seeds never enter the read-only public session diagnostics.
- Grouped Play/Rules, Player Style, Controls, Audio/Access include practice/Tour, map, materials, seed, 2–10 capacity, time, difficulty, Classic/Precision, length, name, ten colors, visible crown/star/stripe crests, coaching, retained camera/FOV/detail, volume/opt-in mute, reduced motion and contrast. Rules stage until Start/restart; identity/access apply immediately. Native fields accept empty/spaced edits and normalize on blur. Corrupt/denied storage works. Existing keyboard/touch/gamepad menu resets remain.
- A real Kenney CC0 spark sprite renders at Canvas arrow impacts, embedded in the standalone with a procedural fallback, original local bytes and license/source/archive/per-file hashes. One cached image, 160 particles, eight audio voices; cosmetic RNG stays separate. The Canvas build needs no runtime CDN. Retained optional Three is experimental/unverified.
- Updated README, changelog, manifest 1.7.0, standalone hash/bytes, current module hashes and game-local historical HTTP version expectation. Active byte guards were replaced only where this expansion changed modules; archived Classic geometry/movement/shot equivalence adds substantive compatibility evidence. All prior behavioral assertions remain.

## Verification and exact commands

1. Before implementation: `node --test tests/blind-crown-worlds.test.mjs` — **8 checks, 2 pass, 6 fail**, exposing missing fourth map/material paths, completed geometry and Tour. First geometry implementation: same command — **8 pass, 0 fail**.
2. Added native coordinator lifecycle tests: same command — **12 checks, 9 pass, 3 fail**, catching a coordinator ternary syntax error; repaired syntax, same command — **12 pass, 0 fail**.
3. First full worker gate: `node --test games/blind-crown/tests/standalone.test.mjs games/blind-crown/tests/quality.test.mjs tests/blind-crown-worlds.test.mjs` — **35 pass, 0 fail**.
4. Required fresh-seed privacy guard plus two targeted privacy regressions: same full command — **37 checks, 36 pass, 1 fail** because the second attestation generation retained previous active byte literals. Updated exact byte/hash constants; no behavioral assertion removed.
5. Final worker gate, exact same full command — **37 pass, 0 fail**, 0 skipped/cancelled/todo. Covers 6 standalone, 17 preserved/extended Classic quality and 14 new worlds checks. Parent separately reported **10 root Sumo benchmark checks pass** before final read-only seed guard. Parent owns the one final integration gate; worker did not run the broad root suite.
6. `git diff --check -- games/blind-crown tests/blind-crown-worlds.test.mjs` — passed. `sha256sum games/blind-crown/source/index.html games/blind-crown/source/original/blind-crown-v1.4.html` — hashes below.
7. `git add games/blind-crown tests/blind-crown-worlds.test.mjs` and `git commit -m "Expand Blind Crown with four tactical worlds and private Tour flow"` — implementation `2ac8cb1`; accompanying task report commit follows separately. No push/deploy.

Worker tests use real pure modules and the real coordinator/input in a minimal DOM/Canvas harness. They prove mechanics/lifecycle/privacy, not browser layout or subjective feel. No production test accessor was added. Native UI IDs and read-only `BlindCrownDebug.getState()/getSession()` contract were supplied to parent before QA. `getState` remains the filtered real session; `getSession` contains only phase/counters, completed Tour records and completed captured seed/rules.

## Exact source evidence

Current standalone: **268886 bytes**, SHA-256 `546839ce6ffcab10f041fa1ba4ff45b6f05bbc76f1ce3f49793e97f0cf1e042b`.

Original archive SHA-256 `496131ad8031a58b8b2ec78cc1aace73f57ab1ca0646271b383bf48bb108c462`.

| Embedded module | SHA-256 |
|---|---|
| deterministic, authoritative match rules | `631e75a1b1916e0e94d683a107e6b89edeb51b43a3d44575ad01a36b68fb7ebf` |
| Blind Crown perspective adapter | `f1b781fd30f10804e85b5f5b4a12471205c49b07bd35c174801369e7feedabba` |
| Room client, protocol 2 | `85f6f3ef9f20b171db26746f0d22372724cd62bb9dc5cb1e1e76a8383fe30302` |
| BLIND CROWN Task 1: optional Three.js | `e9f4f455a5a158c5ec624f8735317fb9169f22675490ca704936bb357e7012cf` |
| window.BLIND_CROWN_KNIGHT_GLB= | `c00281a771e2a4de2f1c8bdce50645d67d13c58e0e3ac5ae0e089c28a2570158` |
| Original Nightfall artwork. | `6d7d5efa08e87ecfc4a53e8bb3c1f66d7ed269c6c52aa49dbe7ed48f256b237c` |
| Nightfall Canvas compositor. | `5a4a58bc903f82f08184f85e87704c88f1b5661fc26ba7561f7a0bb9f8924ce5` |
| Tactical learning and neutral gamepad | `34e6a82157aaf2d0454ae7ba4d530f8172e966079cd41074a3a051101fd4cfe0` |
| root.CrownInput = | `21132251dacdb9ae7693f244c7bdb25caa2b49deb7e4bf59161525e670ba062e` |
| Application coordinator. | `653d3c2f8f3cfcf2ce51abe997751f73640892ad55d1e798f7c85dea6bc8111b` |

Kenney upstream archive SHA-256 `b631d4b07f7002549fdcf155f01141ad482f79f3440e4e301eed49ce5f1d8958`; source/archive URLs and exact pack license are recorded in `games/blind-crown/assets/worlds-provenance.json` / `assets/kenney/License.txt`.

- `spark_06.png`: `fe6d473393d3b9350c7a654b7cb5fbd343766b5b5b11d3e4aba476832d4a6d3f`.
- `License.txt`: `f9e70b81d8cc07c4e07c9f2eff1d94fd371a06070b18cb67c651c41158ec2975`.

## Honest rubric and concerns

| Dimension | Evidence / status |
|---|---|
| Core control / fairness | Pass in focused engine/input compatibility: private lock/deadline, simultaneous mutual hits, legal placement and deterministic ties. Physical device feel unverified. |
| Variety / counterplay | Pass in material/path/forecast tests for four maps, absorbing-cover compatibility and geometry-aware bots. Native readability awaits parent. |
| Live title / complete flow | Pass in real coordinator VM: demo progression, Watch/Return/fresh Start, isolation, natural Tour/replay. Parent owns visual inspection. |
| Customization / storage | Pass in real native-field coordinator paths including empty/spaced edits, staged rules, immediate styles, corruption/denial and pause. |
| World / character / FX | Existing armored art retained; real new material cues and licensed sprite used. Pixels/subjective cohesion need parent review. |
| Audio / mute discipline | Pass in graph-count/voice-bound and post-sounded-demo isolation tests. Audio quality by ear unverified. |
| Mobile / access | 44px targets and scrolling dialogs/title/results, contrast/motion retained. 390×844 / 844×390 layout is parent-owned browser evidence, not a worker pass. |
| Replay / results | Pass: natural finite Tour, completed statistics, captured exact rules/seed, immutable history and scoped bests. |
| Reliability / performance | Pass focused deterministic bounded helpers and 2/10-seat/all-round cases. Render performance and physical hardware not certified. |
| Source / licensing / regression | Pass exact current/archive/module/sprite/license hashes and 39 worker checks after review fixes; parent owns remaining root integration. |

No numerical 9/10 certification, hosted multiplayer claim, Safari/physical phone/gamepad certification, new Three runtime claim or unseen pixel assessment. The new title/results/mobile CSS, crowded ten-seat lanes, material labels in all views and impact readability are the useful parent browser watchpoints. Existing archived reports remain historical source-bound evidence. Source is frozen after implementation and this report; any concrete parent failure needs an explicit narrow follow-up.

## Independent-review fix round 1

The review in `task-6-review.md` identified two concrete defects in the initial candidate. Commit `ac02879` corrects both; the initial candidate's 37-check run above is historical. That review-fix candidate passed **39 checks** at SHA-256 `7e76153833db7702620d807a4aca5919e741fd21369540ca79b27a411b704415`. The source/module hashes above now attest the final overlay candidate described below.

- **P1:** a completed Tour record seed exposed the deterministic base seed for future stages. `Tour.summary()` now strips seed fields from every public record, and `getSession().captured` stays null throughout a Tour until all four stages naturally finish. Internal stage seeds/captured replay remain unchanged. Practice final may reveal its completed seed. Checked all public paths: filtered match state and review snapshots contain no seed, bests store only scores, preference storage preserves only the user-entered field, and generated Tour seeds never populate that field. The targeted fresh-Tour UI test checks initial planning, first final, subsequent planning and nested records; the all-four-stage UI test verifies captured availability only at whole-Tour final and still proves identical captured replay.
- **P2:** replay validation previously consulted staged rival settings, and Next advanced before Start. Start now resolves/normalizes the captured specification for continuation, constructs and begins a candidate match, then commits the match, captured rules and Tour index together. Next peeks the future stage without advancing first. A staged zero-rival slider cannot block captured Replay/Next; a deliberately invalid fresh Start leaves the running stage, Tour and open menu intact. The real UI regression covers replay final → private planning → next-stage private planning and staged invalid fresh Start without production accessors.

Exact fix-round commands:

```sh
node --test --test-name-pattern='fresh Tour diagnostics|captured Replay' tests/blind-crown-worlds.test.mjs
```

Before implementation: **2 checks, 0 pass, 2 fail**, reproducing the public seed and zero-rival replay defects.

```sh
node --test --test-name-pattern='fresh Tour diagnostics|captured Replay|native Tour naturally' tests/blind-crown-worlds.test.mjs
```

After correction: **3 checks, 3 pass, 0 fail**.

```sh
node --test games/blind-crown/tests/standalone.test.mjs games/blind-crown/tests/quality.test.mjs tests/blind-crown-worlds.test.mjs
```

Final corrected worker gate: **39 checks, 39 pass, 0 fail**, zero skipped/cancelled/todo; 6 standalone, 17 preserved/extended Classic quality and 16 worlds/lifecycle checks. `git diff --check -- games/blind-crown tests/blind-crown-worlds.test.mjs` also passed. No broad root suite, browser upload, push, subagents or unrelated source changes. README/changelog/manifest/current attestation reflect the corrected source. Parent retains native browser, root integration and publication ownership. Implementation/source frozen at `ac02879`; this report update is a separate documentation commit.

## Final native-browser wave: overlay correction and Replay semantics

Parent Chromium screenshots from CI run `38263413371` / portrait job `114859431789`, inspected locally at `final-browser-first/blind-crown-portrait-title.png` and `final-browser-first/blind-crown-desktop-tour-stage-result.png`, showed two concrete layout defects: the live-demo status banner covered portrait title copy, and an oversized flex-centered title/results card placed its heading above the clipped viewport. Commit `1d6f235` uses top alignment and a non-shrinking scrollable welcome card, reserves 72px above the lobby card for the demo status banner, and resets overlay scroll on phase transitions/Return. Results keep the full scroll region. No material/rule/bot/Tour seed behavior changed. Current native screenshot acceptance still belongs to the parent's rebuilt three-profile CI; the worker did not claim unseen new pixels.

The initial portrait Replay failure was a harness expectation mismatch: **replaying a completed stage retains its prior naturally earned Tour record/aggregate standings until the new attempt naturally completes**, when that same stage record is replaced. This is intentional completed-attempt history, not a claim that the new private round is complete. Match phase resets to planning, local round history clears, captured diagnostics remain null for the incomplete Tour, captured capacity ignores staged zero rivals, and prior earned records remain unchanged. The parent corrected that native harness assertion. A new meaningful real-UI regression makes these semantics explicit and checks heading scroll resets through Watch/Return, stage final, replay planning and replay final. No production Replay mutation was needed.

Current scoped commands/results:

```sh
node --test --test-name-pattern='replay preserves earned Tour history' tests/blind-crown-worlds.test.mjs
```

**1 pass, 0 fail**, real UI replay/scroll lifecycle.

```sh
node --test --test-name-pattern='HTML matches|Embedded classic scripts compile|replay preserves earned Tour history' games/blind-crown/tests/standalone.test.mjs tests/blind-crown-worlds.test.mjs
```

**3 pass, 0 fail**, 0 skipped/cancelled/todo: exact current standalone bytes/hash, compilation of every embedded classic script, and real Replay/overlay lifecycle. The full current source has 40 focused checks available; the previous 39-check worker gate and parent 523-check root gate apply to their prior candidate, and were not redundantly rerun for the bounded layout change. `git diff --check -- games/blind-crown/source/index.html games/blind-crown/tests tests/blind-crown-worlds.test.mjs` passed.

Source frozen at `1d6f235`; accompanying report commit follows separately. Source is **268886 bytes**, SHA-256 `546839ce6ffcab10f041fa1ba4ff45b6f05bbc76f1ce3f49793e97f0cf1e042b`. Current coordinator module SHA-256 `653d3c2f8f3cfcf2ce51abe997751f73640892ad55d1e798f7c85dea6bc8111b`; all other module/archive/asset hashes above remain unchanged. Standalone/current-test attestation is updated. Parent owns manifest provenance hash synchronization, catalog/build, root/native browser gates and publication; this wave honored the narrowed source/tests/report-only scope. No push, deployment, subagents, other game or archive changes.
