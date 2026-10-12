# Royal Sumo v1.3.0 verification

## Import verification (2026-10-12 UTC)

- The active `source/index.html` exactly matches the HTML in the user-designated ZIP and its preserved copy under `source/original/`.
- SHA-256: `86bcf200c457a9b3da5cb222bcd5e22a46cc95d229b98edf53354eb503589c7e`.
- The supplied 25-module source rebuilds to that exact HTML without dependencies.
- All **144 supplied deterministic unit tests passed**. These cover simulation golden results, ownership, local/remote input, seeds, Cup scoring, quality and other source behavior.
- All **280 root repository tests passed**, including the import/build check and the supplied unit suite. Typecheck, catalog consistency, Pages build and Worker dry-run build passed.
- The built Pages `/games/royal-sumo/index.html` is byte-identical to the supplied game.

The root legacy camera-overlay and pause-marker tests apply to the previous builds of other games. Royal Sumo now keeps its own supplied camera/UI intact; its supplied behavioral tests are used instead of requiring old injected DOM markers.

## Reproduce

From the repository root:

```sh
node games/royal-sumo/tests/source-smoke.mjs
node games/royal-sumo/source/project/test/run.mjs
npm test
npm run typecheck
npm run catalog:check
npm run pages:build
npm run build
```

Browser scripts remain under `source/project/test/e2e/` unchanged. They need Python Playwright and Chromium. Set `RS_HTML` to the absolute path of `source/index.html` (otherwise build the project first). Example from `source/project/`:

```sh
RS_HTML=/absolute/path/to/games/royal-sumo/source/index.html python3 test/e2e/desk.py
RS_HTML=/absolute/path/to/games/royal-sumo/source/index.html python3 test/e2e/touch.py
```

## Browser/hardware scope

The local Chromium attempt was blocked before game startup by the review environment (`socket() failed: Operation not permitted`). The supplied desktop/touch scripts therefore have **not passed in this environment**; the original package's historical claims are not new evidence.

Physical-phone touch feel/haptics, sound by ear and physical gamepads remain unverified. None of these checks establish online phone multiplayer; the game still has only in-process remote hooks.
