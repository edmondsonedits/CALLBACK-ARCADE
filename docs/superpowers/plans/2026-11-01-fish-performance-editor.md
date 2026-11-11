# Fish performance and editor implementation plan

Goal: smooth single-PNG fish animation, immediate accepted-art feedback, a compact spray-first editor, and varied shark choreography.
Architecture: preserve server-authoritative phases/ranking and existing alpha PNG media. Use seekable analytic animation, cached rendering data, bounded textures and adaptive backing resolution. No generated fish views or prerecorded fish animation.

- [x] Measure the existing six-fish phone renderer and fix discarded animation time, repeated setup and unnecessary paused frames; verify fallback and recovery.
- [x] Extend seeded swimming with acceleration/coasting, vertical travel and depth. Add cosmetic shark feints without changing victim selection; original-image particles scatter and settle.
- [x] Show accepted own art immediately on the phone; allow provisional anonymous art on the temporary test host only, preserving main-game staged disclosure.
- [x] Make spray the fish default and compact the editor, with adjustable opacity/size and explicit body extension. Expose spray in ordinary drawing tools.
- [x] Test phone layouts, real upload/reveal/vote/shark/revival, server media privacy, pause/reduced-motion, build and release checks. Review and fix findings before publication.

Evidence: independent review found the 50ms frame clamp, 40-strip fallback, per-frame trait generation, unnecessary paused full-screen drawing, intentional grace/readiness waits, and upward particle acceleration. Baseline and revised samples are local emulation, not physical Android performance.
