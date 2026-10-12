# Arcade worlds — integration record

All six upgrades implemented and accepted through scoped source reviews, behavioral tests and rendered browser checks. The user’s9/10 is a target, not a certified score. Preserved original engines, local/bot controls and Royal Sumo.

| Game | Version | Accepted browser checks | Accepted source SHA-256 |
|---|---|---:|---|
| Royal Ballistix — Beach Siege | 0.14.0 | 129 | `bfb1502a133a0200adc2c4df9478c5dcdca1592d2f72ca3664aca663a6b2161d` |
| Royal Scratch Match | 0.7.0 | 147 | `4866174e89a07e444091ab2a550b74cc25f6ef211277aea44f45ad5fe5cb7d18` |
| Royal Roller Ruckus — Crownway Circuit | 1.6.0 | 171 | `2b6b59de0bcadbfcb0907d2eeb60a4389178e3fec5c0ce91c907d2e91d1f9217` |
| Royal Twisted — Four Towers | 0.7.0 | 142 | `53a29791785efd06899422f8c3b6ecbd09761b6cfc7367d944848c60283a5a81` |
| Space Bash — Four Decks | 1.15.0 | 102 | `571fd02f0050c3a4947d53644f769a77f05866d9a864162361a3e0603e64f7d0` |
| Blind Crown — Tactical Worlds | 1.7.0 | 76 | `546839ce6ffcab10f041fa1ba4ff45b6f05bbc76f1ce3f49793e97f0cf1e042b` |

Each accepted browser report covers desktop1440×900, portrait390×844 and landscape844×390. New maps have real simulation behavior and focused tests; screenshots inspected are listed in progress.md. Some mid-hazard pixels were not separately inspected. No physical-device performance, gamepad hardware, audio-by-ear or subjective AAA certification. Existing phone/network hooks do not establish hosted multiplayer.

## Decisions and costs

- Retained proven custom engines/physics instead of Rapier migration. This preserves feel/APIs; the cost if wrong is later physics integration work.
- Automatic browser QA follows the active game, with manual game/all selection. A cross-game issue could wait until final integration; standalone simulations are separate.
- Once a game’s source is accepted and two rendered profiles pass, the next game may start while its unchanged third check finishes. Only one game implementation runs; a failure pauses the next for correction.
- Under the reduced-usage instruction, final acceptance reuses unchanged source/dependency browser evidence and reruns changed games; duplicate main-branch browser runs are removed. A cross-game packaging issue could escape until catalog/build/live checks or manual play. Broad final code review remains.

Exact subscription percentage is neither visible nor enforceable. Reduced usage is implemented through scoped checks, source-hash evidence reuse and concise sequential tasks.

## Delivered scope

Every upgraded game has real isolated bot play behind its starting menu, functional game/player/accessibility settings, four mechanically distinct worlds, and practice or multi-map progression with real results/replay. Licensed Kenney assets and MIT Alea code are reused with local provenance. Royal Sumo and preserved originals/archives are unchanged from baseline22d3660.

## Final integration triage

Independent review accepts these small presentation debts: Scratch Match decorative Tide caption intersects the apron; Roller portrait checkpoint denominator wraps; Roller and Twisted retain original brand subtitles alongside correct active map labels; Twisted Tour shows empty crown-table headings above the correct drill summary. Twisted's additive diagnostic getSession.rules.players can report4 after public setPlayerCount(10), while actual fighters and captured replay player count are10; gameplay does not consume that diagnostic field. These are retained as explicit limitations, not represented as fixes.

Repository CI38263413377 passed523tests and typecheck; stale generated catalog identified for regeneration after final source changes. Space's final102browser checks serve the actual flattened Pages build and verify asset loading on all three profiles. Blind's initial portrait failure was an incorrect test expectation: Replay captured stage preserves prior earned Tour standings until the replay completes; it resets active-round review and retains privacy. Native Next with staged zero bots passed.

## Map skills

| Game | Four worlds and their skills |
|---|---|
| Ballistix | Beach fundamentals; Gale wind compensation; Moonwell vortex trajectories; Clockwork deflector timing |
| Scratch Match | Royal rhythm; Tide swing timing; Foundry offbeat chords; Mirror announced lane changes |
| Roller Ruckus | Crownway racing line; Frostglass ice control; Foundry steam timing; Skygarden gust/boost routing |
| Twisted | Spiral survival; Ember warned heat cadence; Frost grounded grip recovery; Storm duck/brace timing |
| Space Bash | Orbital cargo combat; Cryo traction and grip lanes; Reactor height-aware hazard timing; Garden changing gravity |
| Blind Crown | Citadel absorbing cover; Orchard arrows through hedges; Glacier bank shots; Clockwork alternating shutters |

Final local Pages rebuild is byte-identical to all six reviewed standalone entry files. Catalog regeneration/check and Pages build pass. Last Blind CSS review is clean; replay semantics have focused real-handler coverage.

## Accepted final evidence

- CI38264792542:524 repository tests pass, typecheck/catalog/build pass, Royal Sumo source integrity and phone-room checks pass.
- CI38264792720: Blind Crown76 checks pass, zero runtime/request errors, all3viewports on exact546839ce… source. Parent inspected8 final frames: portraittitle/replay/Glacierplanning, landscapetitle/Clockworkplanning, desktopOrcharddemo/results/completedreview. Title/demo separation and results heading clipping resolved; native Start/Watch/Next/Replay and private-plan filtering passed.
- Accepted browser checks total767:129+147+171+142+102+76. These combine source-bound game reports, not one repeated full-arcade run.
- Final reviewer conditions for catalog/build/source-bound pixels closed. Minor limitations above remain explicit. Publication/live readback recorded in progress.md.
