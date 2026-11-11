# CALLBACK single-drawing fish runtime — 31 October 2026

## Scope

This implements the user correction in the actual renderer. Each submitted PNG is the only color texture. The browser builds two matching UV surfaces from its alpha pixels and existing body anchors, gives the central body shallow thickness and leaves narrow appendages flat. A continuous rotation shows either original side, mirrored reverse or the intervening volume. No front-view artwork, AI interpretation, generated animation or second player upload is required. This approximates thickness; it cannot reconstruct unseen anatomy from one drawing.

The drawing remains stored as its original PNG. Cached GPU buffers are disposable presentation data. Geometry is bounded to 442 vertices and 768 triangles per fish; sixteen depth bands avoid repeated framebuffer clears while retaining the ten-fish room cap and sorted transparency. The tank caps its three canvas backing surfaces at 1280x720 while DOM labels/controls retain normal display resolution. Reduced motion is side-on and still, room pause freezes time, and original-PNG Canvas fallback survives mesh build errors and context loss.

Swimming traverses more of the tank in a short watch, with seeded speed/personality, tail flex, depth/scale changes and a continuous victim turn into the shared shark mouth. Main scores, room deadlines, eligibility, authorship, ballot ordering and winning fish remain server-authoritative and unchanged.

## Evidence

- Full serial unit/API suite: 1,183 tests, 1,174 passed, nine existing skips, zero failures. Subsequent geometry budget changes passed all 12 focused geometry/motion tests.
- Six authenticated phone seats completed the normal main game, submitted six single PNGs, cast normal ranked ballots, observed five ordered eliminations and revived all six fish with unchanged main results and no new image jobs. A trace-off run passed in 4.3 minutes.
- The test drawing inputs are three original concept-art PNGs plus three hue variants rendered to PNG before normal upload. They are disposable QA drawings, not extra views, historical winners or runtime generated art. Source provenance is retained beside the originals.
- The initial heavy trace/video export failed in test cleanup after all game assertions, and a capture with the larger mesh under concurrent checks sampled 83.4 ms median / 200 ms p95 frame intervals. Smaller geometry/depth bands improved a trace-off 1080p capture to 66.7 / 83.4 ms. These are retained failed-quality/performance attempts, not claims of polished playback.
- Final bounded-resolution six-seat Chromium run: **passed (4.3 minutes)** at 1280x720. The active voting swim sample contains 179 frame intervals: median 33.3 ms, p95 33.5 ms, maximum 50.1 ms. This is a short local sample during recording, not physical hardware certification or a controlled comparison of algorithms.
- Normal phone-editor PNG, saved-upload retry, staged privacy and reload through the peaceful finale: **WebKit passed (2.9 minutes)**.
- Visible mode/time/start/ballot controls, gentle motion, painted Canvas fallback after deliberate context loss, restored WebGL art, keyboard artist card/focus and unchanged main results: **Chromium passed (2.8 minutes)**.
- The 114.72-second 1280x720 normal-game recording played to completion in a browser without a decode error. It is a silent screen capture of the working game, not generated animation. All stages use the real endpoints; the first frame is at fish release after normal submissions.
- Final TypeScript and focused lint passed with zero errors. The production build passed, as did all nine production-render checks. The staged whitespace check passed.

Local artifacts: `.logs/fish-acceptance/runtime-six/` (normal game recording, phase screenshots and measured frame intervals), `.logs/fish-final-runtime-*.log` (individual checks). No shipping QA shortcut or state-injection endpoint was introduced. The recorded scene begins at release after all normal submissions have been accepted.

Physical phone/TV GPU and audio, WAN/realtime Worker and hosted-provider/R2 acceptance are not established by these local checks. No publication is included in this checkpoint.

## Source and review

Work continues from local backdrop checkpoint d77dd65 on branch codex/fish-runtime-volume, preserving source v103 and the narrator work. Independent review found and resolved the per-art texture-failure fallback defect and confirmed the bounded depth-band ordering. A new regression reproduced the victim-side flip before the continuous-angle fix. No generated front-facing art is copied into the runtime or the source fixtures.
