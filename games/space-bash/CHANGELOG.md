# Changelog

## 1.14.0 — Sumo benchmark upgrade
- Added a flight briefing, explicit launch/setup/help routes, pause button/Escape/Start controls, and held match results with all-seat, tie-aware crown standings and rematch.
- Added validated persistent crew/difficulty/deck, volume/mute, reduced-motion, contrast and touch-hand preferences. Match choices apply only on explicit launch/restart; changing settings preserves the current match.
- Added Flight school (safe cargo, passive moving bots, one crown) and Volatile cargo (explosive supply from the start), preserving the default 90-second first-to-three rules and health tiebreak.
- Added standard gamepad movement/aim/grab/kick/jump and keyboard IJKL aim; held pad actions must release across menus, and disconnect clears pad movement.
- Added a simulation-derived throw landing arc, unsafe-gap/fuse-first warnings, cargo drop footprints, and contextual cooldown/fuse control labels.
- Reworked astronauts with numbered pressure suits, visors, backpacks and stateful articulated limbs; added deck hull depth, service panels, bolts and safety hatching. Enlarged desktop deck and separated landscape controls around the playfield.
- Made CPU grabs respect reaction pacing. Separated cosmetic RNG from gameplay and bounded cosmetic particles/audio voices; audio starts only after a user gesture.
- Added 18 benchmark regressions; existing 40 behavior/stress/render-path checks pass. Rendered browser/physical-device validation remains a coordinator check.

## Quality review — included in 1.14.0
- Made unsupported crates fall and retire, centralized carrying cleanup, preserved armed TNT fuse time, and added swept height-aware single-impact collision resolution.
- Added grab target/direction cues, distinct kick/throw/landing feedback, fuse countdowns and blast footprints, local-player contrast and short-landscape framing.
- Cleared stale keyboard/touch ownership across pause, blur and restart; ignored action key repeats and resumed suspended audio on a user gesture.
- Kept crate-oriented CPU decisions while preventing self-carried TNT stalls and unsafe movement into missing tiles.
- Added deterministic behavior/stress checks and immutable archive hash protection. Existing win/tiebreak/pause contracts are unchanged.
- Rendered browser verification remains blocked; see `tests/QUALITY.md` for evidence and limitations.

## Standalone reliability fixes
- Timeout victories now apply the same first-to-three match completion as elimination victories; the existing health tiebreak is unchanged.
- Keyboard Grab, Kick and Jump now respect pause and round phases, matching touch controls.
- Added root runtime regression tests for timeout outcomes and keyboard action gating.

## 1.13.1 — imported
- Imported the user-supplied standalone Orbital Breakout build.
- Preserved the original upload filename beside `source/index.html`.
- Recorded the existing 2–10 player configuration and self-contained runtime.
- Multiplayer remains not integrated.
