# Space Bash assets

`source/assets/worlds/` contains the three rendered Kenney Particle Pack CC0 sprites: `star_04.png` (Cryo crystals), `smoke_04.png` (Garden planter atmosphere), `spark_01.png` (combat impacts). These ship beside the standalone entry through the Pages source-directory build. `KENNEY-LICENSE.txt` preserves the complete license; `provenance.json` records primary URL, archive and exact file SHA-256. Runtime uses `./assets/worlds/` and retains procedural rendering on failed loads.

`assets/worlds/alea.js` is the single exact MIT upstream reference source. Its copyright/license header and generator implementation are embedded in the standalone script. Reference provenance records upstream URL/commit/hash. Separate instances isolate real session and title demo RNG; cosmetic noise uses the existing independent generator. No global Math.random replacement or runtime CDN is used. No unused 3D kit or audio pack was included.
