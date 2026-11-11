# Fish performance and editor acceptance — 2026-11-01

## Delivered behavior

- Fish retain the original alpha PNG on both curved faces. The renderer no longer discards elapsed time on slow frames, caches seeded traits/attribute locations, uses bounded 512×384 animation textures, lowers Canvas strip work, skips unchanged paused frames, and adjusts pixel cost only when measured render cost warrants it. Graphics restoration invalidates the still frame; returning from a hidden tab seeks the current presentation time. Original download PNGs remain 1024×768.
- Swimming has continuous acceleration/coasting, wider vertical travel, stronger depth/scale variation, and speed-dependent tail strokes. The shark drops into the water, makes cosmetic decoy passes, blends between shots, and catches only the server-named victim. Each bite scatters 36 small pieces sampled from the painted bounds, with drag, falling motion, rotation and dissipation. No generated front view, video dependency, new paid job or scoring change.
- Accepted own art drops into a phone aquarium while the remaining artists draw. Temporary test hosts can display committed anonymous art immediately; ordinary bonus hosts, unrelated player-only sessions and spectators retain staged disclosure. Authorship/ranking/voting authority stays on the server. Solo tests show the cinema on the controller after voting, without requiring another display.
- Spray is the default fish tool, with size and opacity. Free drawing extends art into the transparent exterior; existing attachable parts remain. Other drawing games expose spray in Other. A bounded scratch raster appends new spray samples instead of re-rasterizing the active stroke every frame. Intro help dismisses on canvas interaction. Compact navigation/header/tools leave more space for the canvas and aquarium.

## Verification

- Full serial unit/API suite: 1,193 passed, nine existing skips, zero failures (1,202 discovered). TypeScript passed with incremental writes disabled. Lint has zero errors and four inherited native-image warnings. Production build and all nine production-render checks passed.
- Chromium exercises the real temporary-room launch/editor/upload, same-phone aquarium before voting, ballots, shark fragments, revival, cleanup, desktop launch, portrait host controls, and 390×844 / 320×568 editor layouts. A separate three-player peaceful run checks original painted Canvas fallback, WebGL loss/restoration, reduced motion, artist selection and preserved main results.
- The real free-spray test passes in Chromium and WebKit: draw outside the silhouette, undo, redo, submit, decode the authenticated PNG, find nonzero alpha in the painted exterior and zero alpha at the untouched corner.
- Six authenticated human seats submit six original PNGs, vote, complete five eliminations and revive all six with unchanged main scores and no new jobs. Final frozen-source run and recording are retained under `.logs/fish-acceptance/runtime-six/`; phone screenshots are under `.logs/fish-acceptance/editor/` and `shortcut/`.

## Performance evidence and limits

A separate local Chromium stress harness uses six synthetic practice fish, a 390×844 viewport, DPR 3 and 4× CPU throttling. It verifies the renderer path and samples 299 RAF intervals. The original Canvas path measured 83.4 ms median / 116.7 ms p95. The final, larger aquarium measured 16.7 ms median / 50 ms p95 in Canvas (two intervals over 50 ms) and 16.7 ms median / 16.8 ms p95 in WebGL (none over 50 ms). This is a synthetic local comparison, not a physical Android frame-rate guarantee. Full-match recordings and synthetic benchmarks are distinct evidence.

Physical Android/iPhone touch, GPU, audio and WAN latency remain unverified. Extremely dense committed drawings can still take longer to rebuild. Canvas fallback remains a flatter rendering than the WebGL curved volume. The temporary host preview does not change secondary-display/spectator disclosure. Original artwork and authoritative game progress survive either rendering path.

## Review and references

Independent review identified and resolved discarded frame time, wasteful fallback work, permanent downscaling on healthy 30 Hz displays, stale hidden-tab motion, abrupt fallback side flips, frozen graphics recovery and upward fragment acceleration. A final read-only review found no release blocker. An obsolete pre-reveal test expectation was replaced with explicit test-host versus player-only/ordinary-bonus media assertions; a browser test was corrected to request the player role when checking private self fields.

References consulted: [Drawquarium's developer-published Steam page](https://store.steampowered.com/app/4045480/Drawquarium/) for presentation inspiration; [web.dev Canvas performance](https://web.dev/articles/canvas-performance) for pre-rendering and bounded layer work; [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) for timestamp-based motion and hidden-tab behavior. Assets and choreography remain original.
