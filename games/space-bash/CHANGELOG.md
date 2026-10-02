# Changelog

## 2026-10-02 — vault v2 room adapter

- Shared authenticated room and game-specific phone controller replace bot seats without retuning physics/cameras/scoring.
- Added pause/cancel and remote-seat hooks as required; retained the pre-room packaged page under source/original/.
- Real local Worker join/start/pause/resume/same-seat refresh browser checks passed. Multiplayer remains in-progress until production physical-phone testing.

## 1.13.1 — CALLBACK Arcade import

- Imported the latest complete working standalone Space Bash build from this ChatGPT project without rewriting its gameplay source.
- Preserved 2–10 contestant selection, one-human-plus-bots solo play, destructible 8×8 floor, crate/TNT/Nitro mechanics, movement, jumping, kicking, throwing, progressive explosive pacing, Canvas graphics, procedural audio/haptics, keyboard controls, and simultaneous mobile multi-touch.
- Recorded source provenance and asset status.
- Added package documentation, practical smoke tests, and multiplayer integration notes.
- Marked source as imported, lifecycle as experimental, and multiplayer as not-integrated.
- No Cloudflare deployment or ChatGPT Sites changes were made.
