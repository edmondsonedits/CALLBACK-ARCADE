# Changelog

## 0.5.0 — imported
- Imported the user-supplied `royal_twisted_spiral_keep_v0.5_original_camera_knockback.html` as the active build.
- Preserved the original upload filename beside `source/index.html`.
- Retained the supplied v0.4 ten-player build under `source/archive/`.
- Recorded existing 2–10 player and remote-input hooks without claiming network multiplayer verification.
## Unreleased — quality review
- Preserve CAM-3R-23-U, P1-only camera focus/shake, immutable imports, controls, remote APIs and seven-hit victory rules.
- Reject near-ground airborne jump retriggers; track independent duck sources, short landing/release buffers and controller handoff cleanup. Pause/focus handling clears stale input and leaves settings keyboard controls usable.
- Enforce existing hazard-transition minima at predicted arrival, accounting for acceleration and bounded recovery. Bots sample one imperfect plan per rod and use the same gated jump/duck path, timed to the collision edge.
- Distinguish NEXT from NOW cues, add directional hazard fins and recovery status, isolate P1 impact audio, and reduce impact effects without changing physics. Compact landscape HUD prevents rods being covered by the lives panel.
- Advance rounds using pause-aware simulation time; resolve all contestants on a shared rod before awarding the survivor or existing all-out draw.
- Report CDN/WebGL failures visibly. Add executable behavior and browser fixtures; replace the stale active-equals-original smoke assumption with immutable upload hashes.

## Local dependency follow-up (unreleased)

- Bundle exact Three.js 0.180.0 module/core from the npm registry with verified SHA-512 integrity, MIT license and per-file SHA-256 provenance; no version upgrade.
- Replace the external CDN import with a relative module path retained by the existing Pages copy layout; show recovery instructions for missing local files.
- Remove the browser test certificate bypass and require sandboxed Chromium. Add uninstrumented standalone/Pages probes with external traffic blocked. The current container's sandbox configuration blocks browser acceptance; it is not reported as a pass.

## Escape compatibility correction (unreleased)

- Restore baseline Escape pause/resume toggling outside settings. Escape inside settings closes to pause; closing settings never resumes implicitly. Ignore held-key repeats and retain the Resume button. Behavioral and browser fixtures cover both flows.
