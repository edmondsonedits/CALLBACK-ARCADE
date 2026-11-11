# Task 2 report — seven game adapters

Status: DONE_WITH_CONCERNS (runtime checks pass; browser QA unavailable under managed Sites instructions).

Scope: the seven imported `public/arcade-games/<id>/index.html` closures, runtime harnesses/tests, and this report. No backend, shared host/phone UI, registry, or publishing changes. Royal Sumo remains true 1.3.0. Existing maps, rules, settings and offline mechanics remain in their original engines.

## Uniform contract

Every game exposes `window.CallbackPhoneGame` with `start`, `pause`, `resume`, `assign`, `release`, `clear`, `input`, `status`, `phoneState`, and `stop`. Seats are 0–9. `start()` creates ten contenders using selected game rules/maps; assigned seats use phones and other seats use bots. Native restart/next round/Tour paths preserve ownership and names. Native contestant-count changes cannot reduce a phone session below ten contenders.

`assign(seat,name)` accepts assignment before start and preserves ongoing inputs/scores/plans on routine roster polling. `release`, including seat 0, clears ownership/input and returns the contender to a bot. Phone mode overrides seat 0's keyboard/gamepad/touch and AI paths. Input sequences are per seat, strictly increasing; duplicates/older packets return false. `clear(seat)` never consumes or invents a sequence and never changes ownership. Pause/stop neutralize held controls; stop returns to the native offline menu. Existing game loops drive gameplay: no adapter intervals were added. `status()` is `{phase,paused,active}` using actual engine phase/menu state. The shared host adds its own `text` when posting status to the strict backend schema.

## Exact action mapping

| Game | Axes | Buttons / plan | Engine behavior |
| --- | --- | --- | --- |
| Royal Sumo | x→moveX, y→moveY / world z | mask 1 Bash, mask 2 Dash | Bash holds charge and strikes on release. A press+release between frames becomes one explicit bash strike. Dash fires only on a rising edge. Stale clear cancels charge/buffers without striking. |
| Royal Ballistix | x slides the paddle and aims held cargo; y unused | mask 1 Magnet, mask 2 Pulse | Magnet starts/ends through `startMag`/`releaseMag`; Pulse uses the actual `pulse` action once per rising edge. Short pulses survive delivery between simulation frames. |
| Royal Scratch Match | unused | masks 1,2,4,8→lanes A,B,X,Y / indices 0,1,2,3 | Each rising bit calls `tryPlayerHit(seat,lane)` once. Held bits do not repeatedly score later notes. No live `configure` call during roster polling. |
| Royal Roller Ruckus | x right→+world X; y down→+world Z in phone mode | mask 1 Recover; other bits unused | Recover calls actual `respawn` only after a real fall. There is no jump/boost/drift action invented for this engine. |
| Royal Twisted | unused | mask 1 Jump, mask 2 Duck | Jump rising edge uses `requestJump` / its existing buffer. Duck uses a held `phone` posture source; release/clear removes it. |
| Space Bash | x→world X, y→world Z; stick also sets facing | mask 1 Grab/Throw, mask 2 Kick, mask 4 Jump | Rising edges invoke actual `grabThrow`, `kick`, `jump`; normal grounded checks, cooldowns, physics and cargo rules apply. |
| Blind Crown | axes/buttons unused | `plan:{x,y,a,locked}` | x/y normalized [0,1] scale to 1000×640. Angle is radians [-π,π]. Unlocked plans place/aim through engine `position`; `locked` goes through engine `lock`. Engine projects placement onto legal geometry. Clear preserves committed plan values. |

All ordinary action masks are independent (e.g. buttons=3 means both first and second controls).

## Exact phone-state payloads

These are own-seat control/status fields, with no network tokens or internal engine handles:

| Game | Payload fields |
| --- | --- |
| Sumo | `seat,name,phase,paused,alive,stability,charging,charge,dashCooldown` |
| Ballistix | `seat,name,human,phase,alive,life,magnet,pulseCooldown` |
| Scratch | `seat,name,phase,paused,alive,lives,score,combo,phrase,bpm,stage` |
| Roller | `seat,name,phase,paused,falling,finished,lap,laps,checkpoint,radar` |
| Twisted | `seat,name,phase,paused,alive,lives,jump,duck,clears,tower,next` where `next` is null or `{type,eta}` for that fighter's approaching rod |
| Space | `seat,name,phase,paused,alive,hp,carrying,cargo,fuse,grounded,jumpCooldown,kickCooldown,map,hazard` |
| Blind | `seat,name,phase,paused,clock,round,alive,points,plan,board` |

Roller `radar` is `{bounds:{minX,maxX,minZ,maxZ},track:[[x,z],...],own:[x,z]|null,racers:[{seat,x,z,finished},...]}`. The track contains at most 64 samples and coordinates are rounded to two decimals. X increases right and Z increases down in both the radar and phone controls. Phone mode changes only the TV camera to a stable top-down overview fitted to course/racer bounds, track padding, camera FOV and aspect ratio. Offline chase camera remains intact; stop restores its up vector.

Blind `plan` is `{x,y,a,locked}` with normalized coordinates. `board` is `{width:1000,height:640,arena,ruleset,materialRule,geometry,margin}`. It is a detached JSON snapshot containing only this phone's plan and public board geometry, without any `players`, opponent plans, shots, hidden players, or seeds. The TV receives `game.state(null,true)`; during planning its players have no x/y/a and its shots are empty. Blind diagnostics use the filtered TV state during phone mode; active/current online session diagnostics cannot expose captured seeds. Plan privacy remains enforced by the existing Match engine.

All ten states for every game pass the **actual** `server/arcade-phone/contracts.ts` `hostSchema`, including finite JSON, max depth 6, array/object bounds 128, each private state ≤8192 bytes, and serialized host bodies ≤96 KiB. Tests are in the root TypeScript unit-test glob.

## Native controls / dormant legacy room UI

No shared UI is injected here. Task 3 can mount its launcher around the adapter.

- Sumo: dormant `.so-launch` is hidden when the adapter exists. Retained legacy room controls: `#so-tv`, `#so-create`, `#so-close`, `#so-info`, `#so-copy`, `#so-start`, `#so-end`. Native pause is `.hud-pause`; touch Bash/Dash are `.ct-bash` / `.ct-dash`.
- Ballistix: native `#move`, `#magnet`, `#pulse`; menu `#menuOv`, pause `#pauseOv`, settings `#settingsOv`, result `#resultOv`. No legacy room UI.
- Scratch: `.beat-btn[data-lane="0".."3"]`; native `#startBtn`, `#pauseBtn`, `#resumeBtn`, `#pauseMenuBtn`, `#replayBtn`. No legacy room UI.
- Roller: native `#joyWrap`, `#respawnBtn`, `#startRaceBtn`, `#resumeBtn`, `#pauseMenuBtn`, `#restartBtn`; overlays `#setupOverlay`, `#pauseOverlay`, `#finishOverlay`. No legacy room UI.
- Twisted: native `#jumpBtn`, `#duckBtn`, `#startBtn`, `#pauseBtn`, `#resumeBtn`, `#pauseMenuBtn`, `#restartBtn`, `#rematchBtn`. No legacy room UI.
- Space: native `#joyWrap`, `#grab`, `#kick`, `#jump`, `#startMatch`, `#resumeGame`, `#menu`, `#restart`, `#rematch`. No legacy room UI.
- Blind: retained standalone room entry `#onlineTab` and `#onlineSettings` are hidden. Dormant controls `#createBtn`, `#joinBtn`, `#leaveBtn`, `#roomCode`, `#copyBtn`, `#tvBtn`, `#roomTools` remain in source. Native `#placeBtn`, `#aimBtn`, `#lockBtn`, `#startBtn`, `#overlayStart`, `#pauseBtn` remain; shared TV planning disables local editing via TV ownership.

## Verification per game

| Game | Runtime checks |
| --- | --- |
| Sumo | 0/9 movement+Dash, short Bash, charge clear without strike/seq reset, unused bot, idempotent assign, pause, restart ownership/names, release0 bot, selected new map/rules/Cup, ten-seat restart, schema |
| Ballistix | 0/9 movement+short Pulse, Magnet start/clear, idempotent assign, clear preserves sequence, reset owners, release0 AI ignoring local input, seat0 name survives settings, ten-seat restart, schema |
| Scratch | All four lanes on 0/9, actual scores, held-bit second-note non-repeat, local0 blocked, assign preserves score/notes, clear/pause, replay ownership/names, release0 bot, ten-seat restart, schema |
| Roller | 0/9 steering, real-fall Recover, roster/restart names, clear/pause, release0 AI/local suppression, fitted camera, ≤64 sample radar/≤8KiB state, ten-seat restart, schema |
| Twisted | 0/9 short Jump and held Duck, local0 blocked, assign preserves Duck, clear/pause, restart ownership/names including0, unused AI, release0 AI, pre-start seat9 safe, ten-seat restart, schema |
| Space | 0/9 movement+short Jump/stats, actual Grab→Throw/stats and Kick cooldown, assign/clear/pause, restart names/remotes, unused CPU, release0 CPU/local action blocked, ten-seat restart, schema |
| Blind | 0/9 place/aim/lock, no TV planning coordinates/shots, own-only phone board/plan/no seed, assign preserves plan, clear preserves sequence, pause freezes clock, release0 bot, restart names/ownership, ten-seat restart, schema |

TDD: each initially missing adapter was observed failing its focused test before implementation. Count-change, selected-map/Cup, seat0-name, and pre-start state regressions were observed failing before fixes.

Commands/results:
- `node --import tsx --test tests/arcade-worlds.test.ts tests/phone-adapters.test.ts`: **150/150 passed** (136 imported world regressions plus initial 14 adapter checks; run once).
- Final `node --import tsx --test tests/phone-adapters.test.ts tests/phone-state-contract.test.ts`: **27/27 passed** (20 adapter runtime checks plus 7 actual-schema tests; includes later targeted fixes).
- `npm run typecheck`: passed after explicitly typing the dynamic VM adapter boundary in the new TypeScript schema test.
- Scoped ESLint for added tests/harnesses and `git diff --check`: passed.

Concern: browser/rendering QA was unavailable and no browser installation/server workaround was attempted. Tests execute shipping gameplay/coordinator closures with only DOM/rendering, audio, and scheduling boundaries substituted. Parent owns shared UI integration and release verification. No deployment performed.

## Task 2 review fixes — round 1

Addressed all three important groups in `task2-review.md` with six focused regression tests, each observed failing against the reported path before its production fix:

- Sumo `stop()` restores native seat 0 to local control and other slots to bots; `input()` now rejects packets outside phone mode. Phone roster metadata remains available for a later ten-seat phone start.
- Roller `stop()` disconnects every underlying network seat before returning to the offline setup. Native two-racer restarts now honor their selected count and seat 0 samples keyboard/gamepad input. A later phone start reconstructs the retained roster/names.
- Ballistix shared native input neutralization now clears phone axes, Magnet and edge bits too. Settings/help → native resume cannot revive held movement or Magnet without a fresh packet; the next sequence is still accepted. This also covers native pause, menu, blur and visibility neutralization paths without changing sequence tracking.
- Roller native name/cosmetic handlers and Space native volume/cosmetic/direct name handlers keep assigned seat 0's name authoritative during phone mode. Offline preferences remain editable and take effect for local play after stop.

Verification: `node --import tsx --test tests/phone-adapters.test.ts tests/phone-state-contract.test.ts` passed **33/33** (26 runtime checks plus 7 actual-host-schema checks). Scoped ESLint on the changed test and `git diff --check` passed. No TypeScript files changed; no full world-suite rerun or deployment was needed for this targeted fix round. Browser QA remains unavailable.
