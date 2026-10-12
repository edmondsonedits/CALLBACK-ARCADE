# Royal Ballistix tests

These checks cover the imported standalone source. They do **not** establish online multiplayer readiness.

## Source smoke test

Run from the repository root:

```bash
node --test games/royal-ballistix/tests/source-smoke.test.mjs
```

The smoke test checks that:

- the imported HTML contains syntactically parseable inline JavaScript,
- the build identifies itself as v0.13.0-sumo-benchmark,
- it remains self-contained with no external scripts/styles/fetches,
- contestant capacity is 2–10,
- the 120 Hz fixed timestep remains present,
- the public integration/state hooks required for future controller work remain present.

## Manual gameplay verification

Open `games/royal-ballistix/source/index.html` in a desktop browser and a phone browser when available.

Verify:

1. Paused setup starts without console errors or audio. Choose Start Siege to begin the countdown.
2. A/D, arrows and touch drag move in the expected left/right direction.
3. Full movement and reversal stop at the player's sector limits.
4. Magnet captures, follows movement and releases balls.
5. Magnet overheat releases/fizzles without trapping balls.
6. Pulse and Perfect Pulse return balls and respect cooldowns.
7. Stick distance controls movement/run speed without a touch Run button; Shift and API run remain supported.
8. Wall, paddle and ball/ball collisions remain stable.
9. Goals subtract exactly one life per scored ball.
10. Eliminated sectors become walls.
11. Round ends when one contestant remains.
12. Match flow reaches the selected 1/3/5 crowns correctly; ordered standings, rematch and main-menu routes work.
13. Pause → Settings → Back to Pause works.
14. Settings accepts every player count from 2 through 10 without restarting the active match; Apply & Restart applies rules explicitly.
15. Arena Size accepts 80–135% for the next start or Apply & Restart; the public API still adjusts immediately.
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

The repository CI runs its foundation checks on push/PR. The new root `tests/royal-ballistix-quality.test.mjs` wrapper includes the behavioral suite in `npm test`.

## Quality regression checks

```bash
node --test games/royal-ballistix/tests/source-smoke.test.mjs tests/royal-ballistix-mobile-ui.test.mjs tests/royal-ballistix-quality.test.mjs tests/royal-ballistix-sumo-benchmark.test.mjs
```

The harness executes the complete inline script with a deterministic random source, DOM/canvas stubs and controlled timers. Only its test copy exposes private state. It verifies contact geometry, maximum-speed collisions, one-life scoring, Magnet capacity/overheat/cancellation, Pulse timing and cooldown boundaries, simultaneous controls, pause/restart, stale result callbacks, CAM independence and full seeded matches at 2/4/10 seats. The full-match ceiling is four **simulated** hours because ten seats can distribute wins over many rounds; no timing/balance value was changed to shorten those matches.

Browser checks require an already-installed Python Playwright package and Chromium at `/usr/bin/chromium` (test tools only):

```bash
python3 -m http.server 8766 --bind 127.0.0.1
# In another shell:
python3 games/royal-ballistix/tests/browser-quality.py --output /tmp/ballistix-browser
python3 games/royal-ballistix/tests/capture-feedback.py --output /tmp/ballistix-feedback
```

Browser checks cover 390×844 / 844×390, 2/4/10 seats, 80/135% arena scale, multi-touch cancellation, pause and CAM round-trip. Feedback captures are intentionally injected deterministic scenarios, not human gameplay evidence. Review `evidence/quality-review.md` for passed, failed, blocked and not-run checks.

## Sumo benchmark checks

The additional root `tests/royal-ballistix-sumo-benchmark.test.mjs` executes the real standalone with controlled browser substitutes. It covers initial menu gating, staged rules and saved preferences, standard gamepad deadzone/actions/pause/disconnect/reconnect, timed drill damage/crowns/metrics, real shot/release vectors, landing projection, cosmetic RNG independence, configurable match end, stale menu/results and bounded audio resources/failure cleanup.

Manual follow-up: verify title/help/settings scrolling and controls at 390×844, 844×390 and 1365×900, high contrast gate identity, reduced motion, held-key/pad resume protection, drill lane practice, audio-by-ear, and physical touch/gamepad devices. Old evidence folders are historical v0.12.1 captures and do not attest this version. The fresh source-bound check record is `evidence/sumo-benchmark-checks.json`. Local Chromium startup is known blocked by `socket() failed: Operation not permitted`; do not bypass the environment restrictions.
