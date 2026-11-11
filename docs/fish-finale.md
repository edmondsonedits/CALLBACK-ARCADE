# The Last Fish Swimming and winners showcase

Implemented from the supplied revision2 specification on baseline Sitesv99, retaining the main three-round lifecycle and old saved match versions. New match rounds remain1–3; optional bonus data lives at `sketchRelay.finale` only after supported completedv3 games. The separate pure server state machine owns timers, submissions, immutable ballots, ties, ranking and staged disclosure. No main scores or results are rewritten and no image jobs are queued for fish.

## Playing

Complete a normal Sketch & Sorcery match. The host can choose Play fish bonus or Finish game. Choose peaceful/shark and drawing duration. Phones colour a protected fish and attach editable parts; sending locks it. The bonus uses the existing room/session, with a separate authenticated fish endpoint. Every fish returns for the final aquarium, with the original match gallery and vote summary. Pause, upload grace extension, two-fish peaceful choice and skip after result lock are host-only.

The main menu includes a winners showcase. Players may opt into public featuring from the completed match's phone view. Top-positive-laughter drawings from each eligible completed round, including ties, qualify only if their real original/transformed relationship is proven. The main champion's artist-guess points cannot select a drawing winner. Existing unidentified archives are not guessed into historical pairs. See sketch-showcase.md for persistence, eligibility, withdrawal and retention.

## Critical integration

- server/arcade/fish_finale.ts and lib/arcade/fish-finale.ts: bounded state and pure lifecycle.
- server/fish-service.ts and /api/rooms/[code]/fish: authenticated context/idempotency.
- /fish/upload + server/fish-png.ts: bounded RGBA PNG, CRC/critical chunk and decoded alpha checks; immutable R2 receipt via guarded room CAS. The normal white480px/450KB upload is unchanged.
- server/room-sync.ts: independent bonus tick, readiness checks against actual stored assets. Missing assets are excluded before ballots, with accepted source records retained.
- SketchRelayController/Stage wrappers: bonus routing, respecting the existing shared main drawing path.
- FishEditor/lib/fish-art.ts: canonical1024×768 alpha pipeline, mask/parts, bounded drafts, IndexedDB immutable retry and gesture state.
- FishTank/lib/fish-motion.ts: actual transparent textures on small WebGL meshes, sheared-strip Canvas fallback, authored shark paths, separate mouth layers, winner chase, names/revival.
- FishFinalePanel: host/phone controls, independent timers, private asset URLs, full match art strip.

## Original art and technical references

The original aquarium backdrop is an image-generated plate (`public/art/fish/enchanted-aquarium-v1.webp`); shark, practice fish, bubbles, lighting and motion remain original procedural/vector runtime layers. No downloaded art/music or third-party game source is bundled. Existing approved host soundtrack remains managed by the existing audio owner, with original synthesized finale accents. Fish and showcase make no runtime AI calls.

Primary documentation consulted31October2026:
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
- https://developers.cloudflare.com/r2/reference/consistency/

## Verification scope

The 31 October takeover obtained current v101 source and exercised independent authenticated seats against local disposable D1/R2, including real PNG upload, peaceful and shark flows, fixed main results, staged privacy, browser rendering and the durable winners path. See [the takeover acceptance report](fish-finale-acceptance-2026-10-31.md) for final commands, measured evidence and remaining hardware/hosted boundaries. The earlier managed-preview bot/Canvas checks remain historical evidence, not a substitute for these human-seat flows. Publication still requires explicit authorization.

## Single-drawing runtime volume

Each authenticated submitted PNG remains the sole color texture. The browser samples its alpha once and builds two UV-identical curved faces around the existing body anchor. Rotating the faces presents the original drawing or its mirrored reverse; no front-facing image, AI interpretation or second upload is required. Narrow transparent appendages stay mostly flat. Thickness approximates a toy-like body; it does not reconstruct unseen anatomy.

The three tank canvases cap their backing resolution at 1280x720; DOM controls retain full resolution. The cached mesh uses 442 vertices and 768 triangles per fish, one texture and two buffers. Sixteen depth bands retain the ten-fish room limit and back-to-front ordering without clearing the depth buffer for each fish. Tail deformation, changing depth/scale and faster deterministic swimming run locally. Room pause, reduced motion, replay and shared shark mouth positions remain authoritative or deterministic as before. Mesh creation errors and graphics context loss retain the original PNG through the Canvas fallback.

The six-seat runtime browser regression uses normal completed-game setup, six one-sided PNG uploads, phone ballots, five authoritative shark eliminations and full revival. Sample colour variants are drawing inputs for that disposable test room; they are not extra views or historical winners.
