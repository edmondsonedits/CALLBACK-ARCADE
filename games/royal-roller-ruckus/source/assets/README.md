# Local scenery and effects

Actual runtime assets from Kenney's CC0 Castle Kit, Nature Kit and Particle Pack. Complete upstream license notices are alongside the files. `provenance.json` records exact upstream file names, archive URLs and SHA-256 values, per-file hashes, model triangle/material counts and POSITION bounds.

- Crownway: `castle-tower.glb` around the circuit and `court-banner.glb` at four gates.
- Frostglass: `glacier-rock.glb` instances with owned ice-tinted material clones.
- Foundry: `castle-tower.glb` industrial stone stacks, procedural tanks/pipes, and `steam.png` on warning/active vent sprites.
- Skygarden: `garden-oak.glb` around the broad garden route and floating planters.

Models ship byte-identically: uncompressed GLB 2.0 with no required extensions. The loader normalizes each model using its bounding box to a maximum extent of 4–5 world units, grounds its minimum Y, and rejects scenery placements within 4.4 units of any track centerline. Scenery is visual only: course samples remain the sole collision and checkpoint authority. The two Castle Kit GLBs reference `Textures/colormap.png`; its byte-identical upstream PNG is shipped at that relative path with a provenance/hash entry and the same full Castle Kit CC0 notice. Nature models contain no external image dependency. No model uses a remote runtime URI or decoder.

The steam texture shares one cached pending promise across course generations, so stale callbacks cannot replace a newer texture. A failed texture request remains cached as unavailable until reload; racing uses the procedural plume and never waits or repeatedly retries.

There are at most four cached immutable GLB templates and 22 visible model instances, plus three steam sprites. Cloned geometry, cached model textures and default materials remain shared with templates; only per-course tint materials are owned/disposed. Stale asynchronous callbacks cannot attach to a replaced course. Failure leaves the procedural environment and all racing available. Course-owned meshes, labels, materials and unique textures are disposed on replacement; cached source assets remain bounded for the lifetime of the app.

GLTFLoader and BufferGeometryUtils are the matching official Three r180 examples, MIT licensed under `../vendor/LICENSE-three.txt`. `../vendor/loader-provenance.json` records upstream URLs/hashes and shipped hashes. Only the two local import paths were changed; no decoder is included.
