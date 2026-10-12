# Space Bash — Orbital Breakout

Space Bash v1.14.0 is a self-contained Canvas 2D brawler for 2–10 contestants: one local fighter and CPU crew. Grab and aim cargo, kick rivals, jump gaps, and stay on the destructible orbital deck.

The flight briefing opens before play. Customize the crew, difficulty and deck rules, then Launch match. Match choices apply on explicit launch/restart. Pause with the top button, Escape or gamepad Start; closing settings returns to an explicit resume. Completed sessions show every contestant's crown standing with rematch and setup routes.

| Session | Rules |
| --- | --- |
| Orbital Breakout | Default 90-second rounds, first to three crowns, progressively explosive supply |
| Flight school | Safe blue cargo, passive moving CPU targets, one crown; practice aiming and kicks on an intact deck |
| Volatile cargo | First to three crowns, TNT and Nitro supply from the first drop |

The last survivor earns a crown. Timeouts use health; an equal-health tie retains the original first-seat tiebreak. Nobody surviving awards no crown. TNT fuses cannot be extended by re-grabbing. Nitro cannot be grabbed and detonates on contact or kick.

| Device | Controls |
| --- | --- |
| Touch | Stick move/face; Grab / Throw, Kick, Jump; optional swapped hands |
| Keyboard | WASD / arrows move, E grab/throw, F kick, Space jump, IJKL independent aim, Escape pause |
| Standard gamepad | Left stick / D-pad move, right stick aim, X grab/throw, B kick, A jump, Start pause |

The throw arc predicts the first deck-height crossing, not an unobstructed hit: rivals can intercept. GAP warns of unsupported landing; FUSE FIRST warns that carried TNT expires sooner. Drop footprints, blast radii, fuse countdowns and action cooldowns provide context during play.

Crew/rules/difficulty, mute/volume, reduced motion, deck contrast and hand layout persist safely when storage is available. Reduced motion removes cosmetic debris, wobble and screen flashes without altering gameplay RNG. Audio waits for a user gesture. Camera rotation, zoom, tilt and CAM save codes are unchanged.

- Active source: `source/index.html`
- Preserved v1.13.1 upload: `source/original/space_bash_orbital_breakout_v1.13.1_standalone.html`
- Source hashes and automated scope: `integration/provenance.json`
- Benchmark comparison and limitations: `../../docs/quality/sumo-benchmark/space-bash-report.md`

No external runtime assets, scripts, WebGL or network connection are required. `window.SpaceBash` retains version, player-count and state helpers; it has no authenticated per-seat input transport. Multiplayer remains not integrated. Existing tuning remains in the inline `TUNE` object.
