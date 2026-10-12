# Space Bash assets

`worlds/` contains three actually rendered Kenney Particle Pack CC0 sprites: `star_04.png` (Cryo crystals), `smoke_04.png` (Garden planter atmosphere), `spark_01.png` (combat impacts). `KENNEY-LICENSE.txt` preserves the complete license. Asset loading is optional; procedural rendering remains playable on failure.

`alea.js` is the exact MIT upstream source; its license header and generator implementation are embedded in the standalone inline script. Separate instances isolate real session and title demo RNG; cosmetic noise uses the existing independent generator. No global Math.random replacement or runtime CDN is used.

`worlds/provenance.json` records primary source URL, upstream commit, archive SHA-256 and each copied file SHA-256. No unused 3D kit or audio pack was included.
