# Blind Crown — Refined Edition v1.4.0

This entry preserves the complete supplied standalone HTML without changing its gameplay, simulation, controls or bot behaviour.

## Play

The arcade Pages build publishes `source/index.html` at `/CALLBACK-ARCADE/games/blind-crown/`. Open the arcade homepage and choose Blind Crown. The HTML can also be opened directly for offline solo/bot play.

Players privately select positions and aim during planning. Plans freeze at the deadline, reveal together, and arrows resolve simultaneously. Classic Blind Volley is the default. Precision rules are optional. Contestant capacity is 2–10, including bots; this Pages entry supports one local human with bot-filled seats, not ten networked phones.

## Controls and options

Use the on-screen instructions and controls: touch movement stick with independent aiming, keyboard movement, precise aim adjustments and Lock. Camera options include overhead, isometric, third person and first person. First/third-person default to the tested Canvas 2.5D renderer. Settings include arena, bot count/difficulty, planning time, camera quality and reduced motion.

## Source organization

`source/index.html` is the authoritative complete standalone import. It embeds the deterministic engine, perspective adapter, optional Three.js bridge, Canvas renderer, room client, input controller and application coordinator. `assets/README.md` records embedded asset provenance. `tests/standalone.test.mjs` checks exact source identity, script syntax, private state, simultaneous collisions and ten contestant slots.

Run from the repository root:

```sh
node --test games/blind-crown/tests/standalone.test.mjs
npm run catalog:generate
npm run catalog:check
npm test
npm run typecheck
npm run pages:build
```

After a deliberate game update, bump the manifest version and update the expected source hash in the import test. Regenerate catalog outputs rather than editing them by hand.

## Known limitations and integration boundary

- True polygonal WebGL rendering and physical-device mobile performance are not verified by this import.
- The optional Three.js bridge still uses CDN modules; the default Canvas game is self-contained.
- The separate v1.4 full source package contains a Node multiplayer server, but that server is not hosted or copied into this static entry. GitHub Pages and the CALLBACK catalog do not provide its room transport. No multiplayer-ready claim is made.
- Later Task 2–4 weapon, map/editor and party packages were not merged into this v1.4 source.
- Browser emulation and engine tests do not establish human playtest quality or production readiness.

Keep hidden plans out of TV/spectator payloads in any future transport integration and follow `docs/GAME_SDK.md`.
