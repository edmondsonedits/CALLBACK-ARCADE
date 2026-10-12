# Space Bash — Four Decks

Space Bash v1.15.0 retains the Canvas2D/2.5D brawler, fixed 1/120-second simulation and 2–10 contestants. One local astronaut battles CPU crew with independent aim, cargo throws, kicks and jumps. The preserved v1.13.1 upload is unchanged.

The compact title panel sits over genuine all-CPU combat. Watch collapses it with reachable Start and Return actions. Demo simulation, RNG, records, input, audio and haptics are isolated; Start creates a fresh seeded match. Reduced motion holds the preview still. Settings/help freeze gameplay and neutralize held controls; closing settings requires Resume.

| Deck | Decision and counterplay |
| --- | --- |
| Orbital Breakout | Classic destruction and throw timing; jump gaps and release TNT before its fuse expires |
| Cryo Deck | Visible low-traction sectors; countersteer and brake on the continuous bright grip cross |
| Reactor Core | Rotating blast strips warn for two seconds; leave the exact marked strip or jump above 0.8m; one hit per event |
| Gravity Garden | Announced four-second low-gravity cycles; steer landings and account for longer airborne cargo travel |

All decks begin with 64 connected panels and legal spawn room for ten seats. CPUs use the same surface, gravity, collision and jump rules, route around warned lanes, and anticipate ice braking. No teleport or invulnerability is added.

Crown matches default to the original 90-second / first-three format, with 30/60/90 seconds and one/three/five crowns available. Highest surviving health wins timeout; equal health retains the original first-seat tiebreak. No survivors means no crown. Twelve consecutive no-crown rounds end honestly without awarding a winner.

Four-deck Series plays one actual timed round per deck in fixed Orbital/Cryo/Reactor/Garden order. Every seat earns `crew size − placement + 1` points; living health ties share placement, and later elimination ranks above earlier elimination. Results show that deck and aggregate standings, fight statistics, scoped bests, mastery completion counts, Next, Rematch and Replay. Completion requires four recorded rounds. Replay captures seed, seat count, difficulty and rules, ignoring later staged edits.

Flight school practices every selected map with safe cargo and passive moving targets; Volatile Cargo preserves the early explosive mix. Play/Rules, Player Style, Controls and Audio/Access groups include map/session/seed, crew/difficulty/goal/duration/hazard/cargo, name/suit/patch, aim guide/coaching/swapped hands, volume/mute/haptics/reduced motion/contrast. Rules apply at explicit Start/restart; style/access apply live. Native names retain empty edits and spaces until blur. Invalid or denied storage stays playable.

| Device | Controls |
| --- | --- |
| Touch | Movement stick, Grab / Throw, Kick, Jump; swapped hand option |
| Keyboard | WASD / arrows move, E grab/throw, F kick, Space jump, IJKL aim, Escape pause |
| Standard gamepad | Left stick / D-pad move, right stick aim, X grab/throw, B kick, A jump, Start pause |

The throw guide and real cargo share one physics integrator, including future gravity boundaries. The marker predicts first deck-height crossing, not an unobstructed hit: rivals may intercept and later blasts can change the terrain. GAP warns of unsupported landing; FUSE FIRST warns that TNT expires sooner. Nitro remains ungrabbable, TNT cannot gain fuse time by re-grabbing, and swept impacts remain height-aware.

Local Kenney CC0 crystal/planter/impact sprites are used by the renderer; procedural cues survive failed loads. MIT Alea is embedded for deterministic gameplay, separate from demo and cosmetic noise. No CDN/runtime script or network connection is required. Particles cap at 500, visible imported impact overlays at 80, audio voices at 12 and record scopes at 128. Audio starts only after a gesture; demos stay silent after sounded play. Existing CAM controls and `window.SpaceBash` remain; additive `getState()` snapshots expose deck/session/hazard/fighter/cargo/statistics and demo state without a test accessor.

- Source and exact hashes: `integration/provenance.json`
- Asset licenses/source/archive/per-file hashes: `assets/worlds/provenance.json`
- Focused automated evidence and limits: `tests/WORLDS.md`
- Full handoff: `../../docs/quality/worlds-2026-10-12/task-5-report.md`

Rendered Chromium review belongs to the coordinator. VM rendering checks JavaScript paths, not pixels. Physical touch/controller feel, audio by ear and device performance remain unverified; no subjective 9/10 claim is made. Online multiplayer remains not integrated.
