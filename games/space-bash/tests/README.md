# Space Bash tests

The imported source is a standalone browser game. Repository-level checks validate the manifest/source path; the game-specific smoke test here validates source-preservation invariants.

## Automated static smoke check

From the repository root run:

node games/space-bash/tests/source-smoke.mjs

It checks the imported version marker, self-contained source, no external script/module dependency, 2–10 player selection, fixed 120 Hz simulation, pointer-capture multi-touch, keyboard controls, public SpaceBash API, bot AI, destructible tiles, and TNT/Nitro mechanics.

## Practical browser verification

1. Open games/space-bash/source/index.html directly in a modern browser.
2. Confirm the arena renders without a network connection.
3. At default 4 players, move while simultaneously pressing Jump, Kick, and Grab/Throw.
4. Confirm slots 2–4 move and attack as bots.
5. Change Players to 10 and restart; confirm ten contestants spawn and the round continues after Player 1 is eliminated.
6. Pick up/throw a normal or TNT crate.
7. Kick a crate and a nearby opponent.
8. Trigger TNT/Nitro and confirm a floor tile is destroyed.
9. Fall onto a destroyed tile and confirm elimination.
10. Confirm round wins are recorded and the match ends at three wins.
11. On mobile, background and return to the browser; confirm no stuck movement.

## Existing development smoke evidence

Before intake, this exact v1.13.1 standalone HTML was launched in Chromium at a 412×915 phone-sized viewport in this chat environment. It rendered the arena and produced no JavaScript runtime errors during that smoke run. This is development smoke evidence only, not production or multiplayer verification.

## Repository checks

Run:
- npm test
- npm run typecheck
- npm run catalog:generate
- npm run catalog:check
- npm run build

CI repeats the repository verification workflow on the pull request.
