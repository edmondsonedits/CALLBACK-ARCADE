# Royal Sumo verification

From the repository root:

```sh
npm ci
npm ci --prefix games/royal-sumo/server
node games/royal-sumo/source/project/test/run.mjs
node games/royal-sumo/tests/source-smoke.mjs
node --test games/royal-sumo/tests/online*.test.mjs
npm run catalog:check
npm test
npm run typecheck
npm run pages:build
npm run deploy:production --prefix games/royal-sumo/server -- --dry-run
```

The imported project includes 144 deterministic tests covering simulation hashes, seat ownership, remote input, seeds, Cup ranking and quality scaling. Its original Python browser scripts remain under `source/project/test/e2e/`.

`browser-smoke.mjs` launches the real Node room server and Chromium in one process, then opens a host and phone browser pages. It tests joystick movement, simultaneous touch/Bash, charged release, Dash, paused-input clearing, connection loss, credential reconnect, explicit Leave, changing match sizes, camera codes, pause/settings/resume and all six arenas.

Provide Node Playwright via `PLAYWRIGHT_MODULE` (an installed package's absolute path) and optionally `CHROMIUM_PATH` for a chosen Chromium executable. `SUMO_EVIDENCE_DIR` selects the output directory; default is `tests/evidence/`.

```sh
node games/royal-sumo/tests/browser-smoke.mjs
```

Hardware gamepad discovery is disabled in this headless test because the sandbox has no udev access; gameplay, renderer, touch events and WebSocket transport are real. Other fighters are held still only during combat-input assertions to prevent random AI collisions from invalidating those assertions. Physical phones/gamepads, audio by ear, WAN reliability and public deployment remain unverified. See `IMPORT_VERIFICATION.md` and checked-in `evidence/`.
