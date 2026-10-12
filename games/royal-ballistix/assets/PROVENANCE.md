# Asset provenance and usage rights

## Current build — v0.14.0

Standalone `source/index.html` SHA-256: `bfb1502a133a0200adc2c4df9478c5dcdca1592d2f72ca3664aca663a6b2161d`.

Game code derives from `edmondsonedits/CALLBACK@ed09d25b690b36b397516e4d77437e3dd21247c8` under Apache-2.0; complete upstream text remains in `source/UPSTREAM-LICENSE.txt`. New court architecture, material drawings and simulation are original changes. System fonts are used without redistribution.

Six unmodified Kenney source files are shipped under CC0-1.0. The full upstream license text for each pack is in `source/assets/{particles,impacts,scifi}-LICENSE.txt`. Exact archive URLs/SHA-256 and per-file SHA-256 are in `source/assets/provenance.json`.

Sources: https://kenney.nl/assets/particle-pack · https://kenney.nl/assets/impact-sounds · https://kenney.nl/assets/sci-fi-sounds

| File | Pack | SHA-256 |
| --- | --- | --- |
| `spark_01.png` | particles | `5902da3a324cad0a4b5a88ce1e3c9cc18fee50922c358ce93d8c9f1ad7708f0a` |
| `star_01.png` | particles | `3ba3999c944a0767677449412d306c1f230daa1743b31f929533cf77a22ecf5d` |
| `twirl_01.png` | particles | `ba3f4996a5a91ea3cba6817a9b4770a385a82ef0b9350cbda5c0f140d182af7e` |
| `impactMetal_light_000.ogg` | impacts | `33b5e6e37c6e9d54e07bf5a89b12c76e879f40c1ea83cdd82714df1d6f9fec6d` |
| `impactBell_heavy_000.ogg` | impacts | `94b8bb5f2d43ab65e4bcc32b28562416e9bc2c51d9fd4be1e333660ee52f977f` |
| `forceField_000.ogg` | scifi | `c2916f2a062c8ddd1aca2826d134fe90847037db31342726ffb0f9097afe339c` |

Actual uses: spark/star PNGs replace procedural particles when loaded; twirl PNG marks the live Moonwell. Metal impact OGG accompanies paddle contacts, forcefield OGG accompanies capture, and bell OGG accompanies crown results. Each sound has at most three reusable media voices, and synthesized voices have a separate cap of 16. No audio object is allocated before an enabling gesture. Missing/failed optional assets fall back to the existing procedural effects and tones. Local files ship with Pages; there is no runtime CDN dependency.

No Alea/third-party code library was added. Exhibition randomness uses an independent local LCG, never overrides global Math.random and cannot consume the real match RNG stream.

Earlier v0.13.0 evidence records the historical no-bundled-assets build and remains historical. Current scope: `tests/evidence/worlds-checks.json`.
