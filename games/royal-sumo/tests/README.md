# Royal Sumo tests

## Automated source smoke check

Run from the repository root:

`node games/royal-sumo/tests/source-smoke.mjs`

The check verifies the imported version, local vendored Three.js dependency, 10-player capacity, remote-input/state API presence, touch-scroll protections, original-source preservation and Three.js revision/license markers.

This is a source/integration sanity check. It is **not** evidence that online multiplayer works and is not listed as verified multiplayer evidence.

## Practical browser verification

Serve the repository over HTTP and test `games/royal-sumo/source/index.html`.

Verify:

1. Default match starts with one local player and bots.
2. Joystick movement, reversal and release/coasting feel unchanged.
3. Hold/release Bash and tap Dash work with cooldown/readiness feedback.
4. Body collisions, pushing, stability loss, knockout/recovery and falling work.
5. Camera follow, edge framing and multi-fighter framing remain readable.
6. Arena warning, shrinking, final-circle behavior and player-count scaling work.
7. Fighter-count settings support every value from 2 through 10.
8. A 10-fighter match produces distinct fighters, bots and a valid last-fighter-standing round result.
9. Restart clears match crowns/state correctly.
10. Mobile pointer cancellation and page-scroll locking remain intact.
11. `?scenario=tenplayers`, `?scenario=crowdpressure`, `?scenario=arena4` and `?scenario=arena10` load without console errors.
12. `window.RoyalSumo.getState()` returns structured state.

## Repository checks

After manifest changes, regenerate/check the catalog and run the root test/type/build checks required by the repository. Catalog checks are not human gameplay verification.
