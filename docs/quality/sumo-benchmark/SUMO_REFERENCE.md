# Why Crownfall v1.3.0 is the reference

This analysis is based on the actual supplied Sumo source, its deterministic tests, and inspection of the existing arcade sources/live Canvas pages. It does not equate more code with better play or claim unobserved hardware performance.

## What makes the reference more complete

| Area | What Sumo actually implements | Why it matters to players | What to transfer |
| --- | --- | --- | --- |
| First impression | Animated arena demo, distinctive title, one Play action, a separate setup screen and optional help | The player understands what to do before the match starts | Deliberate entry and short setup; genre-specific artwork |
| Control feel | Action mapping, analog deadzone/exponent, floating/fixed stick, charge/release Bash, dash edge handling | Actions are readable and respond to deliberate input | Consistent physical-input mapping and cancellation handling |
| Device support | Touch, keyboard, gamepads and two local players | Players can use devices they already have | Appropriate input methods per game; retain human/bot defaults |
| Feedback | Charge rings, dash cooldown, hit-tier freeze/shake, dust, knockback, staged recovery, sound/haptics | Cause and effect are visible; powerful actions feel different from weak ones | Anticipation, action, impact and recovery cues tied to real state |
| Characters | Ten palettes/accessories, a name/look picker, procedural articulated poses and expressions | Contestants have recognizable identities and move expressively | Distinct silhouettes, motion and clear local-player identity |
| Environments | Six visually and mechanically different arenas, procedural materials, outlines and atmospheric effects | The world supplies both personality and meaningful decisions | Stronger setting/detail plus mechanics-specific hazard cues |
| Match design | Quick match/Crown Cup, configurable targets/length/hazards/difficulty, tie-aware rankings | Sessions have a beginning, progression, ending and reason to replay | Useful match/practice choices and complete results/rematch flow |
| Bots | Personality, skill, reaction delay, target choice and map-aware avoidance | Bots interact with each arena's rules instead of merely pursuing the player | Fair, legible bot decisions grounded in each genre |
| Settings | Data-driven rules/controls/audio/graphics/access sections; validation and guarded storage | Preferences survive reload without making the game fragile | Persistent useful options, safe defaults, deferred rule application |
| Readability/access | Reduced motion/flashes, text scale, high contrast and shape markers | Information stays usable when color, motion or small text is a problem | Reduce decorative motion; retain essential timing/danger information |
| Performance | Instanced mesh batches, capped effects, graphics tiers and probe/verify resolution scaling | Presentation has explicit limits rather than growing without control | Bound effects/audio and use appropriate existing quality settings |
| State ownership | Simulation, match session, seats/input and rendering separated into responsibilities | Restart and seat changes can be understood and checked | Clear lifecycle boundaries; no UI-based scoring or duplicated authority |
| Reproducibility | Seed parsing/derivation, same-seed restart, golden simulations, separate build/sim/protocol/save versions | Bugs can be reproduced and intentional changes identified | Deterministic checks for changed behavior where useful |
| Delivery | Offline standalone HTML rebuilt exactly from 25 modules | The game can run without a runtime CDN or missing assets | Preserve complete game packages and eliminate avoidable remote boot dependencies |

## Source map

- `core/tune.js`: movement/combat/recovery/arena values, skills, player limits and action defaults.
- `core/options.js`, `core/settings.js`: normalized match options, preferences, presets, persistence and accessibility.
- `core/sim.js`: fixed-step fighters, action/collision/hazard consequences, scoring and authoritative state/events.
- `core/ai.js`, `core/maps.js`: bot behavior and six arena rules, safe-floor tests, warnings and interactions.
- `core/slots.js`, `core/remote.js`, `core/control.js`: player identity/ownership, sanitized remote input and application routing.
- `core/seed.js`, `core/session.js`, `core/cup.js`: match seeds, restarts, Cup progression and rankings.
- `core/quality.js`, `core/versions.js`, `core/util.js`: adaptive resolution, compatibility versions and shared math.
- `gfx/engine.js`: matrix/mesh/batch primitives.
- `gfx/gfx_core.js`: toon/material shaders, atlases, camera, drawing and graphics lifecycle.
- `gfx/gfx_fighter.js`: styles/accessories, articulated animation, expressions, squash and recovery poses.
- `gfx/gfx_maps.js`, `gfx/gfx_maps2.js`: procedural scenes and changing arena visuals.
- `gfx/gfx_fx.js`: bounded particles, rings, decals and contact shadows.
- `app/audio.js`: bounded procedural sound/music, buses, gesture unlock, intensity and event mapping.
- `app/controls.js`: touch/keyboard/gamepad actions and visible readiness/charge feedback.
- `app/ui.js`, `app/style.css`, `app/shell.css`: title/setup/HUD/help/settings/results, responsive layout and accessibility styling.
- `app/main.js`: boot, render/simulation loop, event-to-feedback coordination, scene lifecycle and public API.

All paths above are relative to `games/royal-sumo/source/project/src/`.

## Baseline comparison

| Game | Existing strengths to preserve | Main gaps relative to the reference |
| --- | --- | --- |
| Ballistix | Radial movement, catch/release/Pulse skill, fixed-step contacts, local identity and round wins | Immediate start; sparse sand court and basic contestants; limited session/preferences/controller depth |
| Scratch Match | Timing windows, seeded phrases, chords, escalating rhythm, music scheduling | No full pause/recovery loop; flat stage/performers; limited calibration, practice and persistent access preferences |
| Roller Ruckus | Momentum, banking/track interactions, course checkpoints, animated cage drivers, directional collision audio | No deliberate pre-race flow; limited result/session depth and preferences; runtime CDN boot dependency |
| Twisted | Jump/duck hazard reactions, tower track, gamepad/local input, original camera and knockback | Limited session/result depth, persistent preferences and character/environment expression |
| Space Bash | Swept impacts, fuse-safe carrying, readable blast footprints, local identity, destructible floor | Immediate start; simple silhouettes/deck; oversized persistent controls; limited replay/preferences and bot action pacing |
| Blind Crown | Strong original knight/castle art, multiple maps/cameras, private simultaneous tactics, accessible opt-in audio | Crowded scrolling layout, incomplete post-shot learning and full standings, limited controller/preferences depth |

The live Canvas baseline was inspected at desktop size through the cloud browser. It cannot create WebGL2 contexts, so Sumo/Roller/Twisted visual quality cannot be newly certified there. The local browser runner also fails before startup due to an environment socket restriction. Code and deterministic evidence remain distinct from browser/hardware evidence.

## What should not be copied blindly

Sumo is not an online multiplayer implementation. Its raw remote hook lacks authenticated rooms and strict duplicate-packet rejection. Its custom WebGL2 renderer is not a sensible replacement for a working rhythm-game Canvas renderer. Six arenas and a Cup are valuable in Sumo, but another game's best equivalent may be a practice drill, replay, targeted rules variation or fuller race results. More settings, particle effects and larger files are not quality by themselves.

The upgrade strategy keeps each game's verbs and renderer, fills actual product gaps, strengthens its world and action feedback, and checks behavior at the boundaries that most often break: menus, held input, restarts, storage and results.
