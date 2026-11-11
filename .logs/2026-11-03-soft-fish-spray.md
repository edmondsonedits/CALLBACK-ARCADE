# Soft fish spray

Uses a broad radial airbrush cloud with fine low-opacity grain, distance interpolation and bounded 100ms hold deposition. Diameter defaults to 144 (previously 36), adjustable through 160. Pause, release, blur, cancellation and submission stop deposition. Optional mist-v1 operations preserve legacy saved spray rendering.

Research: https://docs.krita.org/en/reference_manual/brushes/brush_engines/spray_brush_engine.html (diameter, spacing, density and radial distribution); https://help.kleki.com/brushes/ (size, opacity and scatter). Applied original rendering rather than copying either implementation.

Verified real three-player editor hold/release/pause, undo/redo and reload; portrait/landscape tools-below-canvas layout; legacy and new raster fade/continuity/cache replay. Four focused browser tests pass. Screenshots inspected. Initial radial test sampled the inner quarter-radius as the edge; corrected it to sample 55–65 of the 80-unit radius. Unit suite: 1232 pass, 11 intentional skips. Typecheck and production build pass. No paid services used. Physical touch hardware and unrelated broad legacy Arcade scenarios were not retested. Disposable room cleanup logged a version conflict; QA server was subsequently stopped.

Rollback: Site v125, source 25d4a85f56aa27be000c3ec657c68dc751eb82b1.
