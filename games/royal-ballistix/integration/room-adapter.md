# Royal Ballistix — Beach Siege: room adapter

Implemented through public/game-adapters.js and the shared Worker/Durable Object room protocol. Open /host.html?game=royal-ballistix; join through the QR code or /join.html. Host/local contestant is seat 0; phones claim seats 1–9 and replace bots. Standalone source/index.html remains playable with bots.

The source/original/standalone-before-room.html archive preserves the pre-room packaged page. Modifications add only controller assignment, pause/cancel and state/input seams; see CHANGELOG.md. Fixed-step physics, camera and tuning stay in the original game.

Verified locally with actual Worker desktop host + 390px mobile browser: join, start, pause, resume, same-seat refresh, ten-contestant setup and no page errors. Automated coverage lives in tests/browser/rooms.mjs and shared room/adapter tests. See docs/ROOM_VERIFICATION.md for evidence and limits.

This is an in-progress party-play adapter. Host simulation/results are trusted; no server physics, public deployment, physical-phone internet acceptance or competitive anti-cheat is claimed.
