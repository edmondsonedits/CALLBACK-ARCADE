# royal-sumo

This intake record stores metadata and provenance only. The standalone source, license evidence, runtime behavior, and phone multiplayer status are described explicitly below and in manifest.json.

## Editing

Keep a supplied standalone HTML document intact under source/. Tune its existing constants and controls in place. Extract shared assets or logic only when useful and record the change in CHANGELOG.md.

## Current evidence

The source manifest is the canonical status record. An external source link is provenance only; it does not mean this repository contains or executes that file.

The latest build described in **Royal Sumo Upgrade Loop** is `royal_sumo_crownfall_v0.19_10players.html`. The chat reports 2–10 fighters, individual crowns, bot-filled unused seats, Bash/Dash input hooks and a deterministic ten-player scenario. Obtain and verify that exact HTML before importing; preserve its movement, contact physics, recovery, camera and bots.
