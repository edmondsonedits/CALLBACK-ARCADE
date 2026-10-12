# Changelog

## Quality review — version pending coordinator finalization
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
