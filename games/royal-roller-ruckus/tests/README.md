# Source checks

`source-smoke.mjs` validates version, ten-player capacity, local controls, respawn support and `window.CallbackInput` hooks. It is not multiplayer verification.
## Quality regressions

From the repository root:

```sh
node games/royal-roller-ruckus/tests/source-smoke.mjs
node --test tests/royal-roller-ruckus-quality.test.mjs
npm test
```

The wrapper runs shipping inline functions in a small DOM/rendering test harness;
checkpoint fixtures are synthetic, and no product test API is shipped. The smoke
check pins the archived upload's SHA-256 instead of incorrectly requiring later
camera/pause/quality changes to equal that archive.

For actual course geometry and browser QA, install **Three.js 0.180.0** and
Playwright into a temporary directory outside this repository. This is a test
fixture, not vendoring or an offline build. Set paths to those installed modules:

```sh
THREE_MODULE=/absolute/path/three/build/three.module.js node games/royal-roller-ruckus/tests/real-course.mjs
THREE_MODULE=/absolute/path/three/build/three.module.js node games/royal-roller-ruckus/tests/camera.mjs
PLAYWRIGHT_MODULE=/absolute/path/playwright/index.mjs THREE_BUILD_DIR=/absolute/path/three/build BROWSER_BIN=/usr/bin/chromium node games/royal-roller-ruckus/tests/browser.mjs checks
PLAYWRIGHT_MODULE=/absolute/path/playwright/index.mjs THREE_BUILD_DIR=/absolute/path/three/build BROWSER_BIN=/usr/bin/chromium node games/royal-roller-ruckus/tests/browser.mjs perf
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
