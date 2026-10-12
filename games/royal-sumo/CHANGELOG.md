# Changelog

## 1.3.0 — imported 2026-10-12

- Imported the user-supplied v1.3.0 standalone HTML, full editable source and tests.
- Preserved the exact upload and archived the previous v0.21 CALLBACK build with its dependencies.
- Added six arenas, Quick Match/Crown Cup, one or two local players, persistent names/looks/seating, deterministic seeds and automatic quality scaling from the supplied release.
- Retained the repository camera panel and saved camera codes through a separate rendering adapter. Native v1.3 pause/settings behavior remains intact.
- Refreshed catalog, controls, provenance and integration notes. Added a dedicated authenticated room server, TV-only mode, phone movement/Bash/Dash, credential reconnect and automatic bot takeover. Public relay deployment is pending.
- Fixed adapter discrepancies around repeated input, reconnect counters, pause/round ownership, held controls, room shutdown persistence and changes in match size.
- Verification results: see `tests/IMPORT_VERIFICATION.md`.

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
