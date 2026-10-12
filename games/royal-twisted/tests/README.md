# Royal Twisted checks

From the repository root:

```sh
node games/royal-twisted/tests/source-smoke.mjs
node --test tests/royal-twisted-quality.test.mjs
node --test tests/royal-twisted-camera.test.mjs tests/settings-pause-flow.test.mjs tests/standalone-game-lifecycle.test.mjs tests/royal-ballistix-mobile-ui.test.mjs
npm test
```

The smoke check verifies imported markers, public hooks, contestant support and SHA-256 hashes of both immutable uploads. It deliberately does not require the edited active entry to equal the original.

The quality wrapper executes the real inline simulation/input/lifecycle functions in a Node VM. `runtime-harness.mjs` stubs DOM, scene construction, effects and audio; it does not replace collision rules, physics, AI, choreography, camera control calculations or round decisions. Seeded random numbers make fixtures reproducible. Tests cover overlapping input sources, buffers, pause/focus/controller transitions, safe-height and collision boundaries, all transition types, an early-to-capped-speed sweep, setback recovery, shared final hits, camera invariants and unassisted 2/4/10-seat matches at all three difficulties. The 2400-second simulation ceiling detects stalled matches; it is not a new gameplay timeout.

Optional browser matrix (Playwright/Chromium are test tools, not new game dependencies):

```sh
npm install --prefix /tmp/twisted-browser --cache /tmp/twisted-npm-cache playwright
PAGES_OUTPUT_DIR=/tmp/twisted-pages npm run pages:build
TWISTED_PAGES_DIR=/tmp/twisted-pages PLAYWRIGHT_MODULE=/tmp/twisted-browser/node_modules/playwright/index.mjs \
  node games/royal-twisted/tests/browser-quality.mjs
```

`CHROMIUM_PATH` overrides `/usr/bin/chromium`. `TWISTED_EVIDENCE_DIR` overrides `/tmp/royal-twisted-browser`; `TWISTED_PROFILE` selects desktop, portrait, small or landscape. Browser sandboxing and default HTTPS validation are required. There is no certificate-bypass option. This container currently cannot launch sandboxed Chromium; the current matrix is recorded as blocked.

The matrix first opens uninstrumented standalone and actual Pages-build entries with external traffic blocked. Behavioral fixtures then serve the active HTML with test-only access to module-local state and controls animation scheduling. It uses actual Three.js/WebGL, keyboard/mouse input, emulated touch, cancellation, pause/Resume, full-setback fixtures, camera projections and checks that hazards are not hidden behind the controls/lives HUD. It deliberately aborts each local dependency request and denies WebGL in separate cases, requiring visible error states. JSON results bind to the tested source hash; generated screenshots support visual inspection, not claims about game feel. Render CPU submission timings are diagnostic only. Prior screenshots are historical and do not establish current normal-browser acceptance.

These checks do not verify production multiplayer, physical phones/gamepads, audible mix quality or real GPU performance.
