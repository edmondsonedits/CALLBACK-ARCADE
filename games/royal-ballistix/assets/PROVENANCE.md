# Asset provenance and usage rights

Royal Ballistix v0.13.0 requires **no standalone third-party asset files**.

## Visuals

Arena, contestants, gates, balls, trails, particles, cannon warnings and UI presentation are drawn procedurally by the imported HTML/Canvas source.

The CSS names `Inter` first in its font stack but does not download or redistribute a font file; browsers fall back to installed system UI fonts when Inter is unavailable.

## Audio

Prototype audio is synthesized at runtime with the browser Web Audio API. No music, sound-effect or voice files are bundled.

## Dependencies

There are no external JavaScript, CSS, image, model, font or audio dependencies and the game makes no network fetches.

## Source rights

The imported source comes from `edmondsonedits/CALLBACK` commit `ed09d25b690b36b397516e4d77437e3dd21247c8`. That upstream repository contains an Apache License 2.0 file. A copy is included at `../source/UPSTREAM-LICENSE.txt`.

This provenance note covers the imported code/procedural content only. No separate third-party asset license is asserted because no separate third-party assets are bundled.

## Current modification evidence

The v0.13.0 Sumo benchmark revision adds original procedural shore/palm/turret/pennant/costume visuals and synthesized feedback in the existing standalone. No Sumo code/assets or new external dependencies were imported. Current `source/index.html` SHA-256: `3af1cc8ea161a66931c73f28e8a1e6b6550fefc37735cdcd25c3510ca99468b5`. Focused automated checks are recorded in `../tests/evidence/sumo-benchmark-checks.json`; older quality evidence is historical.
