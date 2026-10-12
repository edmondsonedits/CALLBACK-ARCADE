# Blind Crown — Nightfall v1.6.0

Play: https://edmondsonedits.github.io/CALLBACK-ARCADE/games/blind-crown/

Secret-position archery: place, aim, lock, then reveal and fire simultaneously. Classic Blind Volley remains the default. The static build runs one human against bots in 2–10 contestant slots. Room-code phone multiplayer is **not hosted by this GitHub Pages build**.

Nightfall adds original armored knights, textured diorama arenas, torchlight and atmospheric detail, matching portraits, a steel/brass HUD, visual arena selection, timed impact/recoil feedback, synthesized opt-in audio and ranked final standings. It preserves the original three maps and four cameras. First/third-person remain Canvas 2.5D; optional polygonal Three.js remains experimental and unverified.

## Controls

Place then tap a legal spot; Aim then point; Lock shot commits before the timer expires. WASD/arrows move, Q/E turns, ±1° adjusts, Space locks. First/third-person use drag-to-aim and a private placement map. Touch stick and aiming are independent. Keep your planning screen private. Local settings/pause stop the local clock; online clocks would continue.

The v1.6 upgrade adds completed-round tactical review: pause local play, choose a round and scrub numbered arrow paths to learn which lane hit a rival, met cover or reached the boundary. Review is available after a volley and from Settings. Current secret plans never enter review history. Own-shot feedback appears at the actual impact time; overhead/isometric highlight your arrow. Full final standings explain the win condition. Contenders/Chronicle are optional to keep the arena clear.

Your setup includes a matching archer portrait, arena/rules/planning-time summary, saved high contrast and volume preferences. Sound remains opt-in for each page session. Standard gamepads use left stick/D-pad to move, right stick/shoulders to aim, A to lock/unlock, X/Y for Place/Aim and Start to pause. Release controls after a menu to re-arm the pad; P/Escape also pauses. Settings has an explicit end-match route to setup and restart action; match-rule changes apply only to the next tournament. No hosted room server is included.

## Edit and verify

The complete runnable build is `source/index.html`; the untouched v1.4 original is `source/original/blind-crown-v1.4.html`. Search embedded module markers for engine, CrownArt, CrownArena, CrownPerspective and app coordinator. The deterministic engine remains unchanged from v1.4. Nightfall's perspective module, networking, optional Three.js bridge, model and artwork remain byte-identical to the approved Nightfall base; input retains private placement feedback and adds neutral-gated standard gamepad controls. Modular development source and the private LAN server are in the separately delivered full v1.5 package, not this static import.

Run `node --test games/blind-crown/tests/standalone.test.mjs` from the repository root. Browser tests in `tests/presentation/` require Python Playwright and Chromium (`CHROME_BIN` can override the executable). See `tests/NIGHTFALL_REPORT.md` and source-bound local evidence. CI static-browser results are separate from local checks.

Quality checks: `node --test games/blind-crown/tests/standalone.test.mjs tests/blind-crown-quality.test.mjs tests/blind-crown-sumo-benchmark.test.mjs` and `python3 games/blind-crown/tests/presentation/test_quality.py`. The browser matrix includes both rulesets, three arenas, four Canvas cameras and three viewport sizes; touch is emulated. Optional `BLIND_CROWN_SCREENSHOTS=/absolute/output/directory` saves local inspection screenshots. Current source evidence is `tests/sumo-benchmark-verification.json`; earlier `quality-verification.json` and Nightfall reports apply only to their recorded hashes. This revision has Node/VM behavioral verification; its updated responsive browser matrix has not been rerun in the restricted local runtime.

After manifest changes run `npm run catalog:generate`, `npm run catalog:check`, `npm test`, `npm run typecheck` and `npm run pages:build`. Do not manually edit generated catalogs or claim multiplayer readiness from a static import.

## Limits

No physical-phone or Safari QA, no full polygonal-3D runtime validation, and no new weapons/map-editor/party-runtime merge. Reduced motion suppresses animation/particles; sound is opt-in. New art is original Canvas/SVG with no downloaded texture/model/font/audio packs. See assets/README.md.
