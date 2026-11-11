# Asset provenance — actual delivered contents

## Tactical Worlds v1.7 reuse

Kenney Particle Pack 1.1 `PNG (Transparent)/spark_06.png` is used as the overhead/isometric arrow-impact decal at actual finish time. The exact original file and pack license are in `kenney/`; source URL, archive SHA-256 and per-file hashes are in `worlds-provenance.json`. The sprite is embedded as a data URL in the standalone, avoiding runtime network/filesystem loading. If Image creation/loading fails, the original procedural impact ring still renders. One cached image, ten possible arrows, maximum 160 particles; cosmetic effects never consume match RNG. Reduced motion suppresses the decal and particles.

The following Nightfall v1.5 sections describe the retained base artwork, model and optional bridge, not a claim that v1.7 adds no reused assets.

## Nightfall v1.5 artwork and sound

`embedded art.js` contains newly authored Canvas geometry for procedural stone materials, raised arena plinths, cover, towers, flags, torchlight, foliage/ice, medieval insignia, armored knight sprites and crossbows. The matching SVG helmet portraits and masthead crown are original project artwork. `embedded arena-renderer.js` composites this art against existing match snapshots; no proprietary game screenshot or asset was copied. `embedded perspectives.js` uses the same materials in the existing Canvas raycast views.

Audio cues are newly layered Web Audio oscillator envelopes in `embedded game.js`, opt-in only. They are not recordings or downloaded sound/music assets. No additional third-party dependency was introduced. This is procedural stylized artwork, not scanned photorealistic materials or imported medieval meshes.

## Retained original asset

`embedded assets/models/knight.glb` is the original project-generated low-poly knight from Task 1 v1.2/v1.3. Its source archive dedicates it to CC0 1.0. Its generation source remains in the full modular package. Its binary glTF header/structure is checked; this release makes no claim of having visually verified it in WebGL. It is **not** a Kenney or Quaternius asset.

This release uses system fonts and Unicode interface symbols. It contains no distributed font files, Font Awesome icon pack or Kenney UI texture files. Those unused presentation dependencies were removed rather than carrying misleading inherited attribution claims.

## Optional Three.js

The inherited optional bridge imports official-version-pinned `three@0.180.0`, GLTFLoader and PointerLockControls. Three.js is MIT licensed, copyright © 2010–2025 three.js authors. Official pinned notice: https://raw.githubusercontent.com/mrdoob/three.js/r180/LICENSE

Actual Three.js engine modules are **not bundled** in this release. The CDN import map is dormant until experimental 3D is explicitly enabled. The vendoring utility and conditional module embedding are retained; when distributing a vendored build, include its actual MIT notice and provenance file. Synthetic module fixtures used in tests are not shipped as game-engine assets.

Kenney Castle/Retro Fantasy and Quaternius Medieval Village were investigated in the earlier task. No new packs were downloaded or integrated here, and no license or model use is implied merely by mentioning them.

Project-specific code is not assigned an invented third-party license; package metadata is private/UNLICENSED. Third-party notices apply only to the material they actually cover.
