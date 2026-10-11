# Changelog

## Standalone reliability fixes
- Timeout victories now apply the same first-to-three match completion as elimination victories; the existing health tiebreak is unchanged.
- Keyboard Grab, Kick and Jump now respect pause and round phases, matching touch controls.
- Added root runtime regression tests for timeout outcomes and keyboard action gating.

## 1.13.1 — imported
- Imported the user-supplied standalone Orbital Breakout build.
- Preserved the original upload filename beside `source/index.html`.
- Recorded the existing 2–10 player configuration and self-contained runtime.
- Multiplayer remains not integrated.
