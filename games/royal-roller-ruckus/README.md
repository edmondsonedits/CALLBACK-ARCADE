# Royal Roller Ruckus — Four-course Worlds

The standalone **v1.6.0** is a 2–10 racer momentum cage race using the preserved Three r180 engine and ordered forward checkpoint simulation. A silent all-bot race runs behind the compact title panel. Watch collapses the panel; Start and Return remain visible. Start always creates a fresh seeded race.

| Course | Skill and physical counterplay |
| --- | --- |
| Crownway | Original vertical crossover and geometry. Carry momentum; brake before corners. Gold edge strips boost and rough strips scrub speed. |
| Frostglass | Broad glacier loop with blue low-grip ice. Brake on amber approach strips before steering onto ice. |
| Foundry | Original technical route between furnaces. Vents warn amber for two seconds before two seconds of steam; the opposite lane stays safe. |
| Skygarden | Raised garden sweepers and distinct sightlines. Two-second directional wind warnings precede bounded gusts. Choose a central sheltered line or risk gold edge boosts. |

Choose a single race, one-lap practice on any course, or a four-course Series (one lap each). Series points go only to racers that actually finish; unfinished racers receive zero and no invented timestamp. Results show actual times, lap splits, recovery count, current-race places and aggregate Series standings. Same-seed replay restores the same session rules. Personal race/lap bests are scoped to course, difficulty, actual seats, lap count and hazard intensity; title bots never write records.

## Controls and preferences

- WASD/arrows, touch stick or gamepad left stick steer relative to the camera; opposite input brakes.
- P/Escape or gamepad Start pauses. R/gamepad B recovers after a real fall. Recovery never awards progress.
- Held inputs clear on menu/blur/recovery transitions. Native fields retain keyboard editing; gamepad axes must return through neutral after transitions.
- Rules: course, session, hazard intensity, replay seed, difficulty, 2–10 seats and race length. Changes stage until Start/restart. Replay restores the completed session's rules.
- Player: a name supporting spaces, team color, silver/gold/dark cage trim and plume/crown/plain helmet. These apply immediately to the local racer; names normalize on blur.
- Controls: handed stick and corner coaching. Audio/access: volume, mute, haptics, graphics, reduced motion and contrast. Reduced motion defaults to the device preference and gives the title a static overview camera while bots continue racing.
- Performance graphics lowers pixel density, disables shadows/spectator point lights and removes backdrop blur/grain. This is a user choice, not a guaranteed FPS claim.

## APIs and source

Existing `window.CallbackInput` and `window.CallbackCamera`/CAM-code APIs remain. Demo input packets are rejected; grounded and airborne title racers always use bots. `window.CallbackRace.getState()` is a read-only session summary containing phase, selected/active course, demo clock/loop count, race clock, rules, seed, Series, asset status and actual racer progress/finish timestamps. No production test mutation accessor is shipped.

Serve `source/index.html` over HTTP(S); WebGL2 is required. The original `source/original/royal_roller_ruckus_v1.4_vertical_crownway.html` is unchanged. Existing renderer modules are unchanged. Local Kenney CC0 scenery and the official matching MIT GLTFLoader have full provenance under `source/assets/` and `source/vendor/loader-provenance.json`; loading failure leaves racing available.

Current verification, source hashes and limitations: `integration/worlds/`. Earlier integration directories are historical evidence. Authenticated CALLBACK room transport is still unfinished; multiplayer remains in progress, not verified.
