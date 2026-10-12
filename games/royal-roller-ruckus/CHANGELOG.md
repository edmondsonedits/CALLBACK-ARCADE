# Changelog

## 1.4.0 — imported
- Imported the user-supplied vertical Crownway build.
- Preserved the original upload filename beside `source/index.html`.
- Recorded 2–10 racer, bot and `window.CallbackInput` hooks.
- Multiplayer remains in progress rather than verified.
## Unreleased — quality review branch

- Validate ordered forward checkpoint crossings and align the finish gate with
  the existing finish stripe; preserve the vertical circuit and three laps.
- Separate collisions by height and recover coincident packs; retain momentum
  transfer and checkpoint recovery without duplicate progress.
- Improve countersteer braking, correct bot steering damping and tune bend/gate
  paths without teleports or hidden credit.
- Stabilize chase-camera framing and local impact feedback; add active gate/edge
  cues and readable validated standings while retaining CAM controls/codes.
- Neutralize held input on interruption/disconnect and show dependency failures
  honestly. Preserve manual resume and local CALLBACK hooks.
- Add behavioral, actual-course and browser checks. Evidence and limitations:
  `integration/quality/README.md`. Release metadata remains coordinator-owned.
