# Asset provenance and usage rights

Royal Ballistix v0.12 requires **no standalone third-party asset files**.

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
