# CALLBACK Arcade — worlds, mastery and live title screens

Danny's instruction: treat all six non-Sumo games as 5/10 and work on each sequentially toward a 9/10 target. Each needs a title menu showing actual gameplay, extensive useful customization, and maps with different hazards/themes that change play and teach distinct skills. Research and reuse free assets/code. Preserve Royal Sumo.

## Decision and scope

Keep the existing Canvas/Three.js engines and proven input/physics. A wholesale engine rewrite would spend the work rebuilding functioning mechanics; a menu-only skin would miss the request. Expand each game into a richer arcade package with data-defined arenas and genuine simulation effects, readable anticipation, bot competence, replayable sessions and coherent audiovisual identity. Work on exactly one game at a time: implement, inspect, review/fix, then advance. No six-game parallel implementation.

The user has already directed execution and iteration; proceed autonomously with reversible implementation and the previously established repository publication workflow. The 9/10 number is a target, not a claim the agent can certify. Keep evidence-based acceptance and record unresolved hardware/subjective limits honestly.

## Binding requirements for every game

- Royal Sumo and original/archive files remain unchanged by this task. Preserve subsequent concurrent upstream work.
- Keep the runnable standalone entry, current renderer, existing public controller/camera APIs, 2–10 capacity and local/bot play.
- Title screen: real bots play the current game in a clearly labeled demo behind a readable, compact title panel. Show current arena and one-line mechanic. No audible autoplay, local-control leakage, progression/personal-best writes or consumed real-session state. Demo restarts cleanly; Start creates a fresh user match. Reduced motion may calm/pause decorative preview without breaking Start. A Watch action may collapse the menu; main action stays accessible.
- At least four selectable arenas/stages per game, including the existing classic configuration. Every arena has an identifiable visual theme, concise skill description, actual gameplay effect, predictable warning/counterplay, fair bounds and working bots. A recolor alone is not a map. Practice can select any arena; include a short multi-arena cup/tour or explicit next-map replay flow where appropriate.
- Customization: grouped menus for Play/Rules, Player Style, Controls, Audio/Access. Preserve prior settings and expose at least 12 meaningful functioning controls total. Include player name and color/style, map selection, difficulty, goal/length, one game-specific rule modifier, volume/mute, reduced motion, contrast/readability and control/assist options that actually affect runtime. Validate stored values; rules stage until explicit start/restart; cosmetic/access settings may apply immediately. Avoid fake controls.
- Presentation: strengthen distinctive environments, characters, anticipation/action/impact/recovery feedback, result celebrations, sound hierarchy and concise coaching. Free third-party assets must actually be used in rendering/audio and have recorded source, license and hashes. Use existing Sumo/other-arcade solutions where they fit, without copying their limitations or changing their files.
- Runtime: loading failures never prevent playing; local assets, no runtime CDN dependency. Bound particles/voices/geometry and avoid per-frame DOM rebuilding. Never allocate audio before enabling gesture. Demo must remain silent even after returning from a sounded match. Pause/help/settings reset held input and stop real simulation.
- Quality checks: meaningful tests of each new map effect/counterplay, map reset/replay, bot survival/progress, demo-to-match and menu lifecycle, preference corruption/storage failure and input focus. Inspect representative rendered scenes; desktop and mobile where available. Tests cannot prove a subjective rating, actual hardware feel or uninspected pixels.

## One-game acceptance rubric

Review each dimension as pass / needs work / unverified, not fabricated numerical scores: (1) core-loop control and fairness; (2) map variety and learnable counterplay; (3) real title demo and complete flow; (4) useful customization/persistence; (5) world/character/FX coherence; (6) audio clarity and mute discipline; (7) accessible/mobile UI; (8) replay motivation and results; (9) reliability/performance; (10) source/license and regression evidence. Fix concrete failures before next game. State unavailable browser/hardware checks without treating them as passes.

## Initial map directions (refine with actual source, preserve skill identity)

1. Ballistix: Beach Siege (catch/release and angled counters); Gale Harbour (announced directional gusts); Moonwell (bounded central vortex); Clockwork Keep (telegraphed rotating deflectors). Rich shore/court identity, map-specific coaching, custom siege/tour and defense drill.
2. Scratch Match: Royal Hall (standard phrases); Tide Pavilion (swing rhythm); Clockwork Foundry (offbeat/chord patterns); Mirror Ballroom (clearly announced mirrored response lanes). Each must remain musically consistent and precisely judge what was demonstrated. Stage tour and rehearsal, instrument/visual style and timing options.
3. Roller Ruckus: Crownway (momentum/corners); Frostglass (ice/braking zones); Foundry (telegraphed steam gates); Skygarden (crosswinds/boost route choices). Course-specific surface/hazard identity, bots adapt, no altered gate ordering or invalid lap shortcuts. Race series and practice records scoped to rules/map.
4. Twisted: Spiral Keep (jump/duck); Ember Forge (warned heat bursts); Frost Spire (recovery/braking rhythm); Stormwatch (gust/double-pattern timing). Hazards must be survivable with existing verbs, no surprise damage or decorative-only variants. Map-aware cues, session/tour and drill.
5. Space Bash: Orbital Breakout (destruction and throw timing); Cryo Deck (slippery traction); Reactor Core (telegraphed blast lanes); Gravity Garden (bounded low-gravity cycles/landing timing). Maps alter deck/physics/hazard patterns fairly; clear safe paths and adapted CPU decisions. Match series and training.
6. Blind Crown: retain the three diorama maps, deepen each with map-specific tactical geometry/rules (reflective/absorbing cover, timing/line prediction) and add a fourth distinct map. Preserve simultaneous private planning and Classic/Precision privacy; completed review must show the exact geometry/rules used. No input reaction during reveal. Map tour and personal style options.

## Reuse policy

Choose small, well-fitting CC0 assets and permissive code with primary-source license evidence. Start with Kenney particle/impact/UI/environment resources and established seedrandom/Alea code only where deterministic map/session selection needs it; reuse proven internal Sumo session/ranking/input patterns where compatible. Keep licenses and exact upstream files locally. Do not copy proprietary Crash/Fuzion assets or assume public GitHub code is licensed. Do not add a dependency merely to satisfy a reuse checkbox.
