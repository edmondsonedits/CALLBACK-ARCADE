# Task 4 — Royal Twisted Four Towers

Status: DONE_WITH_CONCERNS (browser/hardware acceptance belongs to parent). Worktree `/workspace/scratch/89700bddec30/arcade-worlds`; assigned base `b931c947cf1a600795e48b76d3d40f0090cc243d`. Only Twisted, its named world test and this report changed. No subagents, push or deploy. Parent has concurrent shared integration changes; none were staged by this task.

## Implementation

- Active version0.7.0. Compact title with actual all-bot fixed-step simulation, bounded12-second warmup, private RNG, silent Watch/Return/Start and selected tower/skill. Demo protects input/controller ownership and audio/haptics/PB writes; fresh Start resets statistics, clock, hazards and posture. Reduced motion pauses preview.
- Spiral Keep's classic helix/TUNING/AI constants,120Hz collision authority, seven-hit elimination, CAM-3R-23-U, jump buffer, independent duck sources and round/overtime remain. Additive public state is current independently of debug and copies nested fields.
- Ember Forge: high vent → low heat → low heat, with0.95/1.15-second candidate gaps and original conservative arrival enforcement. Vent rings and heat fins plus timed cue teach duck/release/two jumps; no parallel surprise-damage system.
- Frost Spire: grounded duck stops automatic setback recovery and replenishes grip at0.85/s; ordinary running drains0.11/s. Grip scales recovery0.003–0.012 track units/s. This creates a controllable brake/refill/release rhythm; no lateral steering or faster-than-original recovery. Bots recharge only with a safe rod window.
- Stormwatch:1.5-second warned gust on a ten-second cycle applies bounded0.012 setback only to unbraced contestants. Grounded duck counters; no direct damage. Defers while ANY living seat has an unresolved rod within1.1s; warning persists. Natural2/10-seat simulations verify gusts actually occur. Double-high→low patterns teach hold/release timing.
- Practice has20/35/50-second maximum stages, ending early on local elimination. Tour visits all four towers with explicit Next and honest actual-clear aggregate scoring, finite completion and captured-rule/seed Replay. Crown length1/3/5 regulation rounds retains tie overtime. Personal best clears scoped to tower/mode/length/rhythm/difficulty/modifier/count.
- More than12 useful controls grouped Play/Rules, Player Style, Controls, Audio/Access. Rules stage; name/color/headwear/coaching/contrast/graphics/sound/volume/haptics/motion apply immediately. Native name preserves internal spaces/empty while typing and normalizes on blur. Denied/corrupt storage safe. All ten gamepad seats require neutral release through restart; touch cancellation/keyboard focus regressions retained.
- Reused actual CC0 Kenney castle GLBs (tower top, large rock, flag) and full external colormap closure. Small native Y-up props, explicitly scaled and outside collision surface. Inspected mesh/material/bounds metadata recorded. Pending promise cache, generation guard, bounded8 procedural+4 loaded scenery children, disposal on switch, expired hazard disposal. Local matching r180 GLTFLoader/BufferGeometryUtils with import-only modifications; full CC0/MIT notices, archive/upstream/local/per-file hashes.
- Performance disables shadows, caps DPR1, hides scenery group, removes backdrop filters/grain. FPS uses unclamped wall time. No CDN, security bypass or new engine.

## Tests and evidence

Initial12 world tests failed against baseline before implementation (`worlds-initial-red.txt`). A later nested-readonly snapshot test failed before deep-copy fix, and all-seat held-pad test failed before neutralization fix. No production test accessor was added. VM stubs only DOM/visual/audio surfaces; actual simulation remains. Real bundled Three CPU construction covers geometry and stale-generation scene bounds; it is not a shader/pixel test.

Commands on final source:

- `node --test tests/royal-twisted-worlds.test.mjs tests/royal-twisted-sumo-benchmark.test.mjs tests/royal-twisted-quality.test.mjs tests/royal-twisted-camera.test.mjs` —123 passed,0 failed (30 new+93 prior).
- `npm test` —479 passed,0 failed. Full output stored in game evidence. Parent shared integration may add more cases later.
- `node games/royal-twisted/tests/source-smoke.mjs` —pass, including original/archive integrity.
- Extract inline module then `node --check /tmp/twisted-check.mjs` —pass.
- `git diff --check -- games/royal-twisted tests/royal-twisted-worlds.test.mjs` —pass.
- `git diff --numstat -- games/royal-twisted/source/original games/royal-twisted/source/archive` —empty.

Source SHA-256: `ec9125ec7813812c4129202fdb4aaa90ffb65d5ca542670fdb2866a76a72fe75`.
Original SHA-256: `68170440ea2584201fccd8cc8e6c251ae598b223af1cd9ab6aa99cac1d988ae2`.
Archive SHA-256: `50d44a32a0be10fade5ddabe00493113ee1194b69f2411b1d7d21222538a4dbe`.

`games/royal-twisted/tests/evidence/worlds.json` binds tests/rubric/limits to these hashes. `source/assets/provenance.json` and `vendor/three/addons-provenance.json` carry dependency hashes/notices. Historical benchmark/browser files are retained as historical evidence.

## Browser handoff / concerns

Parent owns actual ordinary Chromium screenshots and shared catalogs/tests. No local browser was launched; known local sandbox restriction was not bypassed. Browser pixels, native mobile scrolling, actual GPU load, sound by ear, physical touch/gamepads and subjective9/10 feel remain unverified here. These are acceptance limits, not claimed passes. Node behavior/fairness/replay/provenance dimensions pass; scene/UI/audible polish require parent rendered review.

Selectors: title `#setupModal`, `#towerSelect`, `#modeSelect`, `#watchBtn`, `#startBtn`; Watch `#returnTitleBtn`, `#demoStartBtn`; settings `#settingsTower`, `#settingsMode`, `#playerCount`, `#goalSelect`, `#hazardModifier`, `#playerName`, `#playerColor`, `#helmetStyle`, `#coaching`, `#contrast`; existing pause/settings/restart/resume IDs preserved; results `#nextTowerBtn`, `#rematchBtn`, `#menuBtn`.

Public snapshots: `getState().paused/demo/demoPhase/demoElapsed/tower/mode/towerCue/players/controllers/time/player.jump/player.duck/player.frostGrip/fighters/choreography`; `getSession().demo/demoPhase/demoElapsed/tower/mode/rules/tour/stageDuration/stageRemaining/standings`. Tour stage completion uses actual phase `matchover`, then explicit Next. Demo exposes `phase=setup` plus actual `demoPhase` and elapsed simulation.

Implementation commit: `81b108a` — Expand Royal Twisted with four survival towers and live bot title. This report-only follow-up records that immutable implementation hash.
