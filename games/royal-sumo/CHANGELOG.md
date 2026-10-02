# Changelog

## Import review correction — 2026-10-02

- Update the existing public state snapshot with debug display disabled; render the debug panel only when enabled. Original source remains preserved under `source/original/` and physics/tuning are unchanged.
- Added state-hook and module-dependency regression checks to canonical CI.

## 0.21.0 — imported

- Imported the latest complete Royal Sumo / Crownfall Arena v0.21.0 build from the project conversation.
- Preserved the exact generated standalone HTML under `source/original/`.
- Added `source/index.html` as the packaged entry point; gameplay code is unchanged and only the Three.js import was redirected from the pinned CDN URL to a vendored local dependency.
- Vendored Three.js r180 / 0.180.0 and its MIT license.
- Recorded 2–10 contestant capacity, one-local-human plus bot-filled slot behavior, and current remote input/state hooks.
- Added source smoke checks and practical verification notes.
- Documented asset provenance, tuning locations, known issues and remaining CALLBACK multiplayer integration work.
- Marked source as imported and lifecycle as experimental.
- Marked multiplayer as in-progress only; no verified/online claim is made.
