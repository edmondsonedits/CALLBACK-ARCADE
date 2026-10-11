# Blind Crown — Nightfall v1.5 verification and change report

## Delivered scope

An implemented stylized presentation upgrade to the published v1.4 game, not a finished AAA production or verified true-3D release. New original art, richer environments, matching knight/portrait/weapon treatment, compact responsive HUD, ranked ending and phase-correct feedback. The standalone is 171,542 bytes (about 7.2% larger than v1.4), with no default external requests.

Base standalone SHA-256: `496131ad8031a58b8b2ec78cc1aace73f57ab1ca0646271b383bf48bb108c462`.

Nightfall standalone SHA-256: `06a0238b9827cd6f4395ec33cd0b2c8c7ce758bc15135a946ed7c737e53ef0e4`.

## Changed runtime files

- `public/art.js`: new original Canvas/SVG art library, three palettes, cached masonry, layered dioramas, knight/crossbow drawing and matching portraits.
- `public/arena-renderer.js`: cached environment compositing, explicit planning/TV actor filtering, one-shot impact events, bounded particles and reduced-motion behavior. Particle aging continues correctly when switching camera modes; no stale burst returns later.
- `public/perspectives.js`: shared world-aligned masonry and improved Canvas first/third-person presentation. Camera, ray and world-geometry functions before the drawing section are unchanged.
- `public/style.css`, `public/index.html`: steel/brass theme, original crown, title/final states, responsive HUD and panels, three real arena previews.
- `public/game.js`: portrait/preview/final-state wiring, reduced-motion class, optional synthesized phase/audio cues, visual version and renderer pause flag. Existing game actions remain in place.
- `server.js`: only public version strings, now 1.5.0.
- `package.json`, `build_offline.py`: version/name and reproducible output filename.

`engine.js`, `public/input.js`, `public/network.js`, `public/three-view.js` and the inherited GLB are byte-identical to v1.4. No Task 2–4 rules, weapons or additional map layouts were invented or merged. Classic remains the default; default 2D planning, 2–10 contestant slots, bots, simultaneous reveal/volley and server-owned outcomes are preserved.

## Fresh verification

All **18 recorded checks** passed against the final source hashes, completed at `2026-10-11T01:35:50.590701+00:00`. Machine evidence: `tests/evidence/verification.json`; individual logs are adjacent.

| Gate | Observed result |
| --- | --- |
| Original engine/refinement/perspective suites | Passed. |
| Seeded engine stress | 300 ten-seat matches, 1,796 volleys, 2,880 placement/swept-movement cases, three arenas, two existing rulesets. |
| Actual networking | Ten player sockets plus TV; private planning, token/sequence validation, atomic lock, reconnect credential rotation, stable rematch IDs, disconnect during frozen shots and host transfer passed. |
| Shipped room client | Actual Node WebSocket create/join/start/atomic lock/reconnect passed against the server. |
| HTTP assets | Python byte-equality checks passed for HTML, engine, game, network, art, renderer, CSS and GLB; correct 1.5.0 health/protocol2. |
| Browser regression | 1440×960 desktop, 390×844 portrait and 844×390 landscape passed; no page exceptions/default external requests. Primary controls reachable and no horizontal overflow. |
| Interaction | Two-finger move/aim, cancellation, keyboard repeat/blur, twelve arena/view combinations, Precision rules, real timed ten-archer reveal and volley passed. |
| New renderer acceptance | Input snapshot unchanged; only own planning actor; zero hidden TV actors; exact cover footprints across three themes; static scene cached; impacts emitted once; particles bounded and expire across view switches. |
| Accessibility/HUD | Reduced motion freezes decoration/removes particles; three canonical arena buttons; six SVG portraits; no planning standings; responsive controls passed. |
| Real UI ending | A seeded legal shot was placed, aimed and locked using actual controls. The match reached reveal, volley and final with correct winner/standings; rematch cleared final UI. Opt-in audio caused no runtime exceptions. |
| Build | All runtime JS parsed; repeated standalone builds byte-identical; no distributed font files; synthetic vendoring tests passed but do not establish Three.js execution. |

New art/HUD tests failed on the old build before implementation. A negative-control run of the old particle-aging order failed the camera-switch regression, then passed after the fix. Final singular/plural result copy was also reproduced and corrected.

## Visual inspection

Actual screenshots were inspected for title, desktop planning, mobile portrait, first-person Canvas and match result. Additional screenshots show the real ten-archer reveal and Orchard. These are game renders, not promotional image-generation mockups.

## Asset provenance

All new artwork is project-authored Canvas/SVG geometry, textures are generated from that code, and sounds use Web Audio oscillators. No downloaded medieval mesh pack, proprietary game artwork, external font or music track was added. See `assets/README.md` for original artwork provenance. Full modular sources and the LAN server are delivered separately in the v1.5 ZIP; repository source is the complete standalone HTML.

## Limitations

- True polygonal Three.js rendering, actual pointer lock and GLB appearance remain unverified; the inherited option is off by default and explicit failure fallback is tested. Canvas first/third-person is 2.5D, not true 3D.
- No physical Android/iPhone or Safari test. Emulator render-time measurements are not a real-device FPS guarantee.
- Managed local Chromium refuses localhost navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`; local browser checks use the exact standalone through `set_content`. Actual HTTP and WebSocket tests run separately. Any later connected CI browser check must be recorded separately, not retroactively attributed to these tests.
- These local results alone do not prove GitHub deployment or hosted phone multiplayer. Publication evidence, when obtained, belongs in the separate deployment note.
