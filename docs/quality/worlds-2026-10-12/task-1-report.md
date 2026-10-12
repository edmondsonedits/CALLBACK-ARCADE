# Task 1 — Ballistix worlds and mastery

Implementation commit: `aa19bc7` (`feat(ballistix): add four physical courts, live exhibition and mastery tour`). Build `0.14.0-worlds`. Final standalone SHA-256: `55f7a7d2a19374b238015f8b6338979202a2eb30ee2a8c7f3ec86329f7fc15ef`. Parent-owned catalog refresh and subsequent browser review are separate work.

## Delivered behavior

- Compact edge title panel over actual all-bot play in the selected court. Watch collapses the panel; Return and Start remain available. Desktop positions the exhibition beside the panel; narrow layouts put the court above the panel. Watch/resize remap existing ball and defender positions in normalized court coordinates. No static preview.
- Exhibition owns reset state and its own LCG stream; it never advances real-match randomness, writes preferences, awards crowns/tour points/stats, or accepts local/external combat. Three-life bot rounds loop after victory, with a 50-second showcase cap at crowded seats. Start creates fresh seats/balls/stats/timers/input, applies staged rules and focuses the canvas. Menu/settings/help transitions neutralize input; settings/help freeze preview simulation.
- Beach Siege retains the classic simulation. Gale Harbour has 8-second directional cycles: 2-second warning, 3-second ramped gust, 3-second lull. Moonwell has a marked central field, 2-second warning, 5 seconds of bounded radial/tangential force, then rest; the outer bank is outside the field. Clockwork Keep has two central capsule deflectors, 2-second anticipation and 6 seconds of slow rotation; drawn ghost arms show future positions and solid arms share the exact collision segments. Forces only affect free balls, are scaled to arena size and bounded by the ball speed cap. No hazard directly removes lives.
- Bots forecast future force/rotor effects for interception. They compensate release aim for force and wait for open clockwork lanes, with overheat/capacity safety overrides. Classic bot physics remain unchanged. Public seat count, camera and CAM interfaces remain; externally controlled seats are cleared on a fresh Start and demo combat input is rejected.
- Four-court Tour begins at the chosen court, visits all four and caps each at 75 seconds or last gate standing. Placement scores aggregate once per court. Tied surviving life totals share the same points; there is no arbitrary first-seat timeout advantage. Next Court/Replay Tour and result coaching complete the flow. Siege preserves 1/3/5 crowns; 60-second Defense Drill works on every court and keeps non-damaging rules.
- Sixteen functioning settings: court, contestant count, arena size, difficulty, Siege crowns, ball pace, hazard strength, defender name, house color, crest, movement response, landing guide, volume, mute, reduced motion and contrast. Four native disclosures keep setup compact. Rules stage until Start/Apply & Restart; style, access and controls apply immediately. Values are validated; denied/corrupt storage is safe. Hazard strength is disabled on hazard-free Beach Siege. Existing 2–10 seat controls and camera settings remain.
- World drawing now includes raised court edges; beach islets/coastal vegetation; a planked harbour with moorings, cargo, squalls and windsock; a tiled Moonwell observatory with runic standing stones, stars and visible field; and a brass clock dial with rim gears, mechanism and physical arms. Armored defenders retain numbered gate identity and local color/crest. Existing shot trails, cannon/landing cues, counter quality text and timed impact feedback remain.

## Asset reuse and bounded loading

Six unmodified Kenney CC0 files are shipped under `games/royal-ballistix/source/assets/`:

- Particle Pack: `spark_01.png`, `star_01.png` for impact particles; `twirl_01.png` for Moonwell.
- Impact Sounds: `impactMetal_light_000.ogg` for paddle contact and `impactBell_heavy_000.ogg` for a crown.
- Sci-fi Sounds: `forceField_000.ogg` for capture.

Full upstream licenses are copied per pack. `source/assets/provenance.json` records primary asset URLs, exact downloaded archive URLs and SHA-256, plus exact per-file SHA-256. `assets/PROVENANCE.md` also lists every file hash and actual use. No unused library or asset was added; no Alea dependency was needed. Existing Apache-2.0 upstream source license remains.

Optional assets cannot block play: image failures leave the procedural effect, media failures are caught and existing tones remain. No media/audio object is allocated before an enabling gesture. Each sample has at most three reusable media voices; synth voices retain a cap of 16 and disposal. Menu/mute stops existing sample and synth voices. The demo suppresses all new audio even after a sounded match. Particles/rings retain caps; rotor geometry is bounded. No runtime CDN.

## Verification

The first nine worlds behavior tests were written and run before implementation: 0 passed / 9 failed for the expected missing behavior. The expanded suite now has 16 worlds tests. The owned harness still executes the complete production inline script; its private accessor and minimal browser substitutions exist only in the test copy.

Final focused command:

```sh
node --test tests/royal-ballistix-import.test.mjs tests/royal-ballistix-mobile-ui.test.mjs tests/royal-ballistix-quality.test.mjs tests/royal-ballistix-sumo-benchmark.test.mjs tests/royal-ballistix-worlds.test.mjs
```

**86 passed, 0 failed.** Exact output is stored in `games/royal-ballistix/tests/evidence/worlds-focused-tests.txt`.

Final repository regression command:

```sh
npm test
```

**402 passed, 0 failed**, after the final implementation and metadata update. This is the 386-test starting baseline plus 16 worlds tests. No unrelated test adaptations were required. The owned smoke test's expected version was updated to the real new runtime version; source parsing/one-inline-script checks remain.

Coverage includes warning/active/calm differences, safe outer Moonwell route, bounded acceleration, distinct actual trajectories, shared rotor reflection geometry, held-ball immunity, bot wind interception/open-lane waits, finite 2/10-seat all-bot exhibition progression and loop, timed Tour/ties/award-once/replay, staged rules, sensitivity effect, preference corruption/storage denial, Start focus, Watch resize, settings freeze, reduced-motion Start, asset failures, silence after sounded gameplay, and independent demo RNG/no storage or score leakage. Previous maximum-speed collision, catch/magnet/pulse/counter, input lifecycle/native controls, all-bot classic progression, camera and 120 Hz checks also pass.

Self-review checked owned diff, source/manifest/provenance hash consistency, actual use of each asset, caps and input/audio/menu boundaries. Findings fixed during implementation included demo gamepad-release interference, lingering audio voices, stale coordinates on Watch resize, map-relative bot interception and separate demo randomness. Source rules and new assets remain self-contained. Original/archive files, Sumo, unrelated games, root metadata and shared tests were not edited by this task.

## Quality rubric

| Dimension | Assessment | Evidence or remaining review |
| --- | --- | --- |
| Core-loop control and fairness | Pass (automated scope) | Existing swept/substep/input/counter suite retained; new forces capped and held balls excluded |
| Map variety and learnable counterplay | Pass (behavior); visual legibility unverified | Four physical simulations, visible warning data, outer-bank/lull/open-lane routes, bot prediction tests |
| Real title demo and complete flow | Pass (behavior); rendered layout unverified | All-bot progression, loop, silent/no-write isolation, Watch/return, fresh focused Start |
| Useful customization/persistence | Pass | Sixteen controls, grouped disclosure UI, staged rules, live style/access, bounded storage |
| World/character/FX coherence | Unverified visually | Distinct procedural architecture/materials and asset use implemented; parent must judge rendered pixels |
| Audio clarity and mute discipline | Pass (lifecycle); mix unverified | Gesture/caps/stop/silent-demo/failure tests; no audio-by-ear claim |
| Accessible/mobile UI | Unverified on hardware/rendering | Native form focus and reduced-motion tests pass; desktop/narrow CSS implemented, no device inspection claimed |
| Replay motivation/results | Pass (functional) | Classic Siege, every-court Drill, timed Tour aggregate standings/ties/coaching/replay |
| Reliability/performance | Pass (automated scope); device budget unverified | 402 repository tests, bounded objects/effects/voices; real-browser frame budget still needs review |
| Source/license/regression evidence | Pass | Actual CC0 assets with primary provenance and hashes, retained Apache license, exact-source evidence |

## Remaining limits and parent handoff

- This worker did not render or inspect browser screenshots. Parent owns desktop/narrow/landscape browser QA and subjective polish review; no rating or pixel-quality claim is made. Check title panel/court occupancy, setup disclosure scrolling, ten-seat cue/roster overlaps, mechanic contrast, and gate/defender legibility.
- Physical phone multitouch, real gamepad mappings/reconnect behavior, frame budget and sound balance remain hardware checks. Node stubs do not certify these.
- The demonstration's 50-second cap is intentional showcase flow, not proof that every ten-seat classic match naturally ends in that time. Classic Siege retains its original potentially lengthy first-to-three format; Tour guarantees a short four-court session.
- Tour is a fresh replay flow with aggregate session standings, not a seeded replay recorder or persistent leaderboard. External controllers remain trusted local hooks without authentication/transport, so multiplayer stays **not-integrated**.
- Parent should regenerate shared catalogs after the manifest change (parent commit `22bdb34` already performs that), then inspect the CI/publication evidence before proceeding to the next game. Stable selectors and public fields are documented in the game's integration README. No push/deploy was performed by this worker.

## CI artifact retention follow-up

Parent reports that the actual browser checks passed, but `actions/upload-artifact@v4` excluded the hidden `.browser-worlds/` output directory under its default settings, so screenshots were not retained. The separately authorized workflow fix explicitly sets `include-hidden-files: true` for that dedicated directory and `if-no-files-found: error` to prevent silent missing-evidence success. The upload path remains restricted to `.browser-worlds/`. Configuration diff/whitespace checks pass; the parent owns the actual CI rerun and image review. No game source changed in this follow-up.
