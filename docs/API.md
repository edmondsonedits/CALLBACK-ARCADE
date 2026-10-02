# Catalog and controller API

- `GET /api/games`: checked-in game catalog plus D1 connection and revision status.
- `GET /api/games/<safe-id>`: one game metadata record or 404.
- `GET /api/health`: Worker status, D1 connectivity, and catalog synchronization status.

All routes are read-only. There are intentionally no room, join, input, score, winner, or game simulation endpoints. Future JSON controller messages and trust boundaries are documented in `GAME_SDK.md`.
