# Royal Ballistix tests

These checks cover the imported standalone source. They do **not** establish online multiplayer readiness.

## Source smoke test

Run from the repository root:

```bash
node --test games/royal-ballistix/tests/source-smoke.test.mjs
```

The smoke test checks that:

- the imported HTML contains syntactically parseable inline JavaScript,
- the build identifies itself as v0.12,
- it remains self-contained with no external scripts/styles/fetches,
- contestant capacity is 2–10,
- the 120 Hz fixed timestep remains present,
- the public integration/state hooks required for future controller work remain present.

## Manual gameplay verification

Open `games/royal-ballistix/source/index.html` in a desktop browser and a phone browser when available.

Verify:

1. Idle/countdown starts without console errors.
2. A/D, arrows and touch drag move in the expected left/right direction.
3. Full movement and reversal stop at the player's sector limits.
4. Magnet captures, follows movement and releases balls.
5. Magnet overheat releases/fizzles without trapping balls.
6. Pulse and Perfect Pulse return balls and respect cooldowns.
7. Run can be held simultaneously with movement.
8. Wall, paddle and ball/ball collisions remain stable.
9. Goals subtract exactly one life per scored ball.
10. Eliminated sectors become walls.
11. Round ends when one contestant remains.
12. Match flow reaches first-to-three correctly.
13. Pause → Settings → Back to Pause works.
14. Settings accepts every player count from 2 through 10.
15. Arena Size accepts 80–135% and redraws without a fatal error.
16. 10-player mode creates ten contestant slots with AI filling non-external seats.
17. Resize/orientation change keeps the arena usable.
18. Pause/restart do not leave Magnet/Run stuck.
19. Multiple balls do not produce NaN or infinite velocity in `GameDebug.getState()`.
20. Low/high refresh-rate play does not change fixed simulation timing.

## External-input verification

In the browser console, use a non-local seat (example seat 1):

```js
RoyalBallistix.setPlayerInput(1, {
  moveX: 1,
  primaryAction: false,
  secondaryAction: false,
  run: true,
  sequence: 1,
  timestamp: Date.now()
});
RoyalBallistix.getState();
RoyalBallistix.releasePlayer(1);
```

Confirm that seat 1 reports `external: true` while controlled and returns to bot behavior after release.

This verifies only the local hook. It does not validate network authentication, sequencing or reconnect logic.

## Repository checks

After manifest/catalog changes:

```bash
npm test
npm run typecheck
npm run catalog:generate
npm run catalog:check
npm run build
```

The repository CI runs its foundation checks on push/PR. The game-specific source smoke test above is intentionally documented separately until the repository adopts a shared imported-game test runner.
