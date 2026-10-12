# Blind Crown — Nightfall v1.5.0

Play: https://edmondsonedits.github.io/CALLBACK-ARCADE/games/blind-crown/

Secret-position archery: place, aim, lock, then reveal and fire simultaneously. Classic Blind Volley remains the default. The static build runs one human against bots in 2–10 contestant slots. Room-code phone multiplayer is **not hosted by this GitHub Pages build**.

Nightfall adds original armored knights, textured diorama arenas, torchlight and atmospheric detail, matching portraits, a steel/brass HUD, visual arena selection, timed impact/recoil feedback, synthesized opt-in audio and ranked final standings. It preserves the original three maps and four cameras. First/third-person remain Canvas 2.5D; optional polygonal Three.js remains experimental and unverified.

## Controls

Place then tap a legal spot; Aim then point; Lock shot commits before the timer expires. WASD/arrows move, Q/E turns, ±1° adjusts, Space locks. First/third-person use drag-to-aim and a private placement map. Touch stick and aiming are independent. Keep your planning screen private. Local settings/pause stop the local clock; online clocks would continue.

The local quality branch explains when placement is adjusted away from cover or the boundary, strengthens your private position and Classic aim markers at smaller display sizes, and uses phase-specific lock/result labels. Precision still has no traced aim guide. These changes are unmerged; the Play link above is the published build, not this local revision. Online clocks require a separately hosted room server; none is included or hosted by this standalone HTML.

## Edit and verify

The complete runnable build is `source/index.html`; the untouched v1.4 original is `source/original/blind-crown-v1.4.html`. Search embedded module markers for engine, CrownArt, CrownArena, CrownPerspective and app coordinator. The deterministic engine remains unchanged from v1.4. Nightfall's perspective module, networking, optional Three.js bridge, model and artwork remain byte-identical to the approved Nightfall base; input adds only an optional private placement-feedback callback. Modular development source and the private LAN server are in the separately delivered full v1.5 package, not this static import.

Run `node --test games/blind-crown/tests/standalone.test.mjs` from the repository root. Browser tests in `tests/presentation/` require Python Playwright and Chromium (`CHROME_BIN` can override the executable). See `tests/NIGHTFALL_REPORT.md` and source-bound local evidence. CI static-browser results are separate from local checks.

Quality checks: `node --test games/blind-crown/tests/standalone.test.mjs tests/blind-crown-quality.test.mjs` and `python3 games/blind-crown/tests/presentation/test_quality.py`. The browser matrix includes both rulesets, three arenas, four Canvas cameras and three viewport sizes; touch is emulated. Optional `BLIND_CROWN_SCREENSHOTS=/absolute/output/directory` saves local inspection screenshots. Current source evidence is `tests/quality-verification.json`; earlier Nightfall reports describe their recorded hashes, not this revision.

After manifest changes run `npm run catalog:generate`, `npm run catalog:check`, `npm test`, `npm run typecheck` and `npm run pages:build`. Do not manually edit generated catalogs or claim multiplayer readiness from a static import.

## Limits

No physical-phone or Safari QA, no full polygonal-3D runtime validation, and no new weapons/map-editor/party-runtime merge. Reduced motion suppresses animation/particles; sound is opt-in. New art is original Canvas/SVG with no downloaded texture/model/font/audio packs. See assets/README.md.
