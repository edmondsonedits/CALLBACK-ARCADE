# Embedded assets and provenance

The imported `source/index.html` contains its required default graphics and audio. No separate asset download is needed for Canvas play.

- Courtyard, walls, towers, flags, torchlight, knights, weapons and effects are project-generated Canvas artwork inherited from Blind Crown v1.4. Audio is synthesized with Web Audio.
- The embedded knight GLB is the project-generated model from Task 1 v1.2/v1.3. Its source package dedicates that original model to CC0 1.0; it is not a Kenney or Quaternius model. GLB structure was tested, but visual WebGL appearance remains unverified.
- Fonts are system fonts and interface symbols are Unicode. No font files are redistributed.
- Experimental Three.js 0.180.0, GLTFLoader and PointerLockControls are loaded from the pinned CDN only when explicitly enabled. Three.js is MIT-licensed. The engine modules are not bundled here. Pinned license: https://raw.githubusercontent.com/mrdoob/three.js/r180/LICENSE . Include the actual notice if vendoring those modules in a future version.
- No Kenney, Quaternius or proprietary game artwork was newly imported for this release.

The user explicitly requested this repository import. The project-specific code has no invented blanket third-party license; the supplied full package is private/UNLICENSED. The CC0 and MIT statements above cover only the identified material.
