# Assets and provenance

## Bundled game assets

Royal Sumo v0.21 does **not** depend on external image, model, font, music or sound-effect asset files.

The game-specific presentation is produced at runtime by its source code:

- Three.js primitive/procedural geometry for the arena, castle environment and fighters.
- Canvas-generated stone texture and text labels.
- Procedural particles and impact rings.
- Web Audio oscillator/noise effects.
- CSS and system-font UI.

These systems were developed as part of the Royal Sumo/Crownfall Arena work in this CALLBACK project and are retained in the imported source.

## Third-party code dependency

Three.js **r180 / 0.180.0** is vendored in `source/vendor/`:

- `three.module.js`
- `three.core.js`
- `LICENSE-three.txt`

Upstream: https://github.com/mrdoob/three.js/tree/r180

License: MIT. The upstream copyright/license notice is preserved in the vendored build files and copied in `source/vendor/LICENSE-three.txt`.

## Rights / intake note

No third-party branded game art, characters, music, textures or copied proprietary source were added during this intake. Reference games informed design discussion only; the imported game's presentation uses its own procedural implementation.
