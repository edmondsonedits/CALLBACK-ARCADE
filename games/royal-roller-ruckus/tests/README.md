# Source checks

`source-smoke.mjs` validates version, ten-player capacity, local controls, respawn support and `window.CallbackInput` hooks. It is not multiplayer verification.
## Quality regressions

From the repository root:

```sh
node games/royal-roller-ruckus/tests/source-smoke.mjs
node --test tests/royal-roller-ruckus-quality.test.mjs tests/royal-roller-ruckus-sumo-benchmark.test.mjs
npm test
```

The wrapper runs shipping inline functions in a small DOM/rendering test harness;
checkpoint fixtures are synthetic, and no product test API is shipped. The smoke
check pins the archived upload's SHA-256 instead of incorrectly requiring later
camera/pause/quality changes to equal that archive.

For actual course geometry, use the bundled **Three.js r180** module. Browser QA still needs Playwright installed outside this repository. Set the paths as follows:

```sh
THREE_MODULE=$PWD/games/royal-roller-ruckus/source/vendor/three.module.js node games/royal-roller-ruckus/tests/real-course.mjs
THREE_MODULE=$PWD/games/royal-roller-ruckus/source/vendor/three.module.js node games/royal-roller-ruckus/tests/camera.mjs
PLAYWRIGHT_MODULE=/absolute/path/playwright/index.mjs THREE_BUILD_DIR=$PWD/games/royal-roller-ruckus/source/vendor BROWSER_BIN=/usr/bin/chromium node games/royal-roller-ruckus/tests/browser.mjs checks
PLAYWRIGHT_MODULE=/absolute/path/playwright/index.mjs THREE_BUILD_DIR=$PWD/games/royal-roller-ruckus/source/vendor BROWSER_BIN=/usr/bin/chromium node games/royal-roller-ruckus/tests/browser.mjs perf
```

`real-course.mjs` drives all seats with the real bot controller through the actual
Three.js spline and fixed-step physics. It does not write positions/progress
during the race. Separate explicit stress/landing setups do place initial racers.
This is automated simulation evidence, not human game-feel evidence.

`browser.mjs` injects test access into an HTTP-served copy. It checks real DOM
controls, dependency failure and desktop/portrait camera framing; it does not
claim physical touch, gamepad or audio testing. `perf` records 60 seconds of a
seeded ten-racer scene at a fixed camera, with render completion included. Set
`ROLLER_ENTRY` to an exported baseline HTML and `EVIDENCE_DIR` to separate output
directories. Run baseline/candidate sequentially on the same browser/renderer.

The Sumo benchmark suite also verifies settings validation/storage failure, setup gating, staged rules, legal lap timing/PB scoping, guidance states, result times, gamepad edges, touch capture loss, locked/bounded audio and finite modeled poses with rematch resource disposal. Current results: `integration/sumo-benchmark/verification.json`. Earlier integration folders remain historical snapshots; their source hashes do not describe v1.5.0.
