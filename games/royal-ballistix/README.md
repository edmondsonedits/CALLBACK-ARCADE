# royal-ballistix

This intake record stores metadata and provenance only. The standalone source, license evidence, runtime behavior, and phone multiplayer status are described explicitly below and in manifest.json.

## Editing

Keep a supplied standalone HTML document intact under source/. Tune its existing constants and controls in place. Extract shared assets or logic only when useful and record the change in CHANGELOG.md.

## Current evidence

The source manifest is the canonical status record. An external source link is provenance only; it does not mean this repository contains or executes that file.

The known v0.9 source is **Royal Ballistix — Beach Siege**, a radial ball-deflection arena for 2–10 contestants. Its original `RoyalBallistix` API includes `setPlayerCount`, `setPlayerInput` and `releasePlayer` hooks for replacing AI controls. Those hooks are an integration starting point; they do not provide phone networking on their own. Preserve magnets, Pulse, gate damage, bots and the fixed-step simulation when importing the source.
