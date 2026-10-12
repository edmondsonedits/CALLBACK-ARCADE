# Changelog

## 1.3.0 — user-designated Crownfall import (2026-10-12 UTC)

- Replaced the incorrect active v0.21 game with the exact HTML from the user-supplied `royal_sumo_crownfall_v1.3.0.zip`.
- Preserved the complete editable project, build tools and supplied tests; retained historical versions.
- Kept the uploaded gameplay, rendering, UI, controls and bots unchanged. No legacy camera overlay was injected.
- Updated catalog metadata, controls, provenance, source guides and integration limitations.
- Replaced obsolete v0.21 import assertions with exact SHA-256, byte-equality and reproducible-build checks; included the supplied unit suite in repository verification.
- See `tests/README.md` for verification and hardware limitations. Online phone rooms remain unimplemented.

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
