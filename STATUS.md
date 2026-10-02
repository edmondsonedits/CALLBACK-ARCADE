# Current status

The repository contains a validated metadata catalog, source-intake template, deterministic JSON/Markdown/D1 seed generation, a responsive static catalog, read-only Worker API, D1 metadata migration, local Wrangler setup, deployment ID guard, documentation, and CI checks.

All three current arcade game packages now include runnable source:

- **Royal Ballistix — Beach Siege v0.12.0**: complete standalone HTML for 2–10 contestants, with one local human plus bot-filled seats. Phone/network multiplayer remains **not integrated**.
- **Royal Scratch Match v0.5.0**: complete standalone HTML for 2–10 contestant slots, with local touch/keyboard play, bot-filled seats, and JavaScript input hooks for additional humans. Room-code phone multiplayer remains **not integrated**.
- **Royal Sumo v0.21.0**: complete standalone source for 2–10 fighters, including the preserved original HTML and vendored Three.js r180 runtime. Remote input hooks exist, while authenticated phone-room transport remains **in progress**.

No production phone-player transport or authoritative network runtime has been completed, and no production D1 database or Worker deployment is implied by these source imports.

Next: verify and integrate the CALLBACK host/controller transport per game, then complete multiplayer evidence before marking any game verified.
