# Arcade source reuse research

Checked 2026-10-12. Source inspection only; no code was installed or executed. Exa searches returned 67 result slots, including duplicates. LICENSE files and source trees were read directly through the GitHub connector; Kenney asset-page license fields were verified through web retrieval.

## Shortlist

| Candidate | Best match and reusable code | Verified license | Actual constraints |
|---|---|---|---|
| Hartwich Open Party Lab game modules | Arena Survivor: full rules, progression, enemy AI, renderers and controllers. MinionsTD: placement, sending, economy, tower targeting, config and renderer. Magic Duell: spell catalog, gesture recognition, mana/shields/projectiles, 3D host and procedural audio. | Apache-2.0 for code; LICENSE read in all three repositories. | Not standalone. Peer game-core 0.1.0, Phaser 3.90; Magic Duell also Three 0.184. Requires the existing host/server/controller contract or an adapter. README explicitly licenses code and separates assets. Generated Arena art has provenance but no explicit CC0 declaration. |
| ricardo-foundry/canvas-vampire-survivors | Complete independent survivor game, or reuse weapons.js, data.js, spatial-hash.js, pool.js, input.js, effects.js, audio.js and wave systems. | MIT, copyright 2024 Survivor Game. | Vanilla ES2022 modules, Canvas 2D/WebAudio/localStorage, no runtime dependencies or backend. Single-player; no room/network multiplayer or companion bots. Audio synthesized in code; source tree has no game image/audio assets. |
| EndymionSoroban/sharpTurn | Complete four-player light-trails game; Player.js/GameEngine.js rules and local bots, AiWorker.js sensor obstacle avoidance, SpatialGrid.js and Renderer.js. | MIT, copyright 2025 Piotr Nalewajko. | Plain scripts, Canvas 2D, optional Worker per bot, procedural WebAudio. Local keyboard controls; phone/room input adapter needed. Case error: index.html requests Main.js but tree contains main.js. Fix before integrating. HTTP serving needed for worker mode; no raster/audio asset files in repo. Worker debug logging is enabled upstream. |
| lrq3000/javascript-racer | Complete pseudo3D out-of-time arcade racer and fastest-lap mode; racer.js/common.js traffic avoidance via updateCarOffset, road projection and progression. | MIT code. thanks.txt: GDJ background CC0; Aries Beats tracks CC-BY 3.0; TeknoAXE track CC-BY 4.0; Openclipart sprites and author-created sprites separately credited. | Static Canvas 2D, no framework. Single-player/traffic; this is not top-down drifting. Keep separate asset attribution or reuse code with cleared replacements. v5.game.html mp3 fallback misspells lsracer_soundtrack.mp3; actual filejsracer_soundtrack.mp3. |
| MortimerGoro/AirHockeyWebGL AI kernel | src/AI.js 3.4 KB: puck choice, own-half and goal defense, difficulty-scaled paddle movement; src/physics.js has table walls, goal sensors, contact handling. | MIT, copyright 2014 MortimerGoro; AI file has its own MIT header. | AI depends on THREE.Vector3 and simulation getPuckVelocity; port vector operations to current engine. Whole game bundles 2014 Three/Box2D/OBJMTLLoader. Included audio is credited to Freesound krb21 but its separate asset license was not verified; do not treat audio as cleared. |
| SauerNinja/StickTD | Complete tower-defense campaign, class evolution, equipment, procedural wave/environment/tower rendering and synthesized audio. | MIT, copyright 2026 Sauer__Ninja. | Current version is index.html plus four js scripts, approximately 1.5 MB JS total, not the stale single-file description. No framework or backend; local mouse/touch and save/export. Procedural game visuals and audio; title/favicon/preview PNGs are separate. Different solo campaign from competitive MinionsTD. |
| Kenney CC0 sprite packs | Racing Pack 420 files for top-down vehicles/tracks; Top-Down Tanks 85 files for combat vehicles; Particle Pack 80 images at 512 × 512 for hits/smoke/glows. | Each original Kenney page explicitly shows Creative Commons CC0, linked to CC0 1.0. | Assets only, not gameplay. Crop/atlas and preload selected assets. All three have direct free downloads; optional paid All-in-1 bundle is unnecessary. |

## Pinned code sources

- Arena Survivor 94550794ee1de6e53d62d1977909df7ae3da5de7, 2026-09-14: https://github.com/Hartwich/arena-survivor/tree/94550794ee1de6e53d62d1977909df7ae3da5de7
- MinionsTD 2d2c6e259fff76b407a65c5d532fff8187cbdfb0, 2026-09-01: https://github.com/Hartwich/minions-td/tree/2d2c6e259fff76b407a65c5d532fff8187cbdfb0
- Magic Duell bd6f204a67813ca5b17f6d7df1f81922b80dbedb, 2026-09-01: https://github.com/Hartwich/magic-duell/tree/bd6f204a67813ca5b17f6d7df1f81922b80dbedb
- Canvas Survivor e616704889e57efc9c1f49098786a95c364008d3, 2026-04-25: https://github.com/ricardo-foundry/canvas-vampire-survivors/tree/e616704889e57efc9c1f49098786a95c364008d3
- Sharp Turn 22e177d6d43a49c4d920cf3745a90173fe0aa26a, 2025-05-29: https://github.com/EndymionSoroban/sharpTurn/tree/22e177d6d43a49c4d920cf3745a90173fe0aa26a
- Javascript Racer 7a3d4035ea64186bb08f25f2980b7d77ab86ccbd, 2020-11-17: https://github.com/lrq3000/javascript-racer/tree/7a3d4035ea64186bb08f25f2980b7d77ab86ccbd
- Air Hockey 9ad9bf421c2787a0b4a4cca2e7c12772f099ff68, 2014-04-24: https://github.com/MortimerGoro/AirHockeyWebGL/tree/9ad9bf421c2787a0b4a4cca2e7c12772f099ff68
- StickTD a9d747505abc459110175e555a2fc06c66e04f52, 2026-10-11: https://github.com/SauerNinja/StickTD/tree/a9d747505abc459110175e555a2fc06c66e04f52

## Asset and notice sources

- https://kenney.nl/assets/racing-pack (web ref turn3view3)
- https://kenney.nl/assets/top-down-tanks (web ref turn3view5)
- https://kenney.nl/assets/particle-pack (web ref turn3view4)
- https://github.com/Hartwich/Open-Party-Lab/blob/main/NOTICE.md: source availability does not establish separate asset clearance.
- https://github.com/Hartwich/arena-survivor/blob/main/docs/generated-assets.md: generated art provenance and procedural music.
- https://github.com/lrq3000/javascript-racer/blob/master/thanks.txt: separate art/audio attribution.
- https://github.com/MortimerGoro/AirHockeyWebGL/blob/master/README.md: separate Freesound audio credit.

## Usable web citation refs

- turn5search0: Arena Survivor README/platform/license/code-vs-assets caveat.
- turn5search1: Canvas Survivor README/features/dependencies/MIT claim.
- turn6search0, turn6search1: MinionsTD README/platform/license/code-vs-assets caveat.
- turn7view0: original Sharp Turn demo, controls/difficulty/powerups.
- turn7view2: original racer demo, out-of-time objective/turbo/touch control.
- turn3view3, turn3view4, turn3view5: Kenney pack counts/license fields.

GitHub LICENSE/raw source direct-open is disabled in the generic web tool, so exact LICENSE/source inspections above used the GitHub connector and Exa fetch; URLs are supplied. Do not cite failed generic-web refs for those license contents. Parent should open/search the cited refs itself before final web citations.

## Exclusions and ordering

- For existing room games, inspect current Hartwich code before replacing a whole game. Existing API modules are likely easier to adapt than introducing another networking platform.
- For a separate local Light Trails game, Sharp Turn is the strongest independent candidate in this shortlist, after fixing the case typo and replacing input wiring.
- For Survivor, Canvas Survivor is the cleanest independent static option; preserve the existing co-op contract if using it as a component donor.
- Ooxygen7/TowerRush was excluded: README calls it MIT but also forbids commercial use. foramoment/survivors was excluded: current LICENSE/README say all rights reserved, copying/rehosting forbidden. Public GitHub code does not by itself grant reuse rights.
- uww-acm/tronament is MIT, but its bundled demo AI calls itself weak, and sounds/font/background lack specific provenance in the source tree. Sharp Turn is the better trails/bot donor.

For MIT code, retain copyright and license. For Apache code, retain LICENSE/attribution and mark modified files, plus applicable NOTICE content. Keep art/audio permissions separate.

## Imported at the ten-game checkpoint

- Game-icons.net: crown, snowflake, grenade and wave SVGs by Lorc, game-icons/icons commit 82d948812bfe3f269ef8f731dcdb07b08160edc4. Primary license.txt confirms CC BY 3.0; original files and notices are preserved, with visible Art credits in starting menus. Exact Git blobs verified.
- Fredoka Latin variable typeface from the existing @fontsource-variable/fredoka package, SIL Open Font License 1.1; original license retained.
- SharpTurn: all thirteen files from the pinned commit were imported under Tailblazer/vendor/sharp-turn. Every file matched its original Git blob after byte-preserving import. The game has not yet been made the live Tailblazer replacement.
