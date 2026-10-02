# Royal Twisted verification

## Automated static smoke check

```bash
cd games/royal-twisted
node tests/smoke.mjs
```

This verifies package integrity and intake invariants. It is not a browser/playability attestation and does not mark multiplayer verified.

## Practical browser verification

1. Boot with vendored Three.js; loading overlay clears.
2. Verify local keyboard/touch jump and duck.
3. Clear cyan low rods with jump and coral high rods with duck.
4. Miss a rod; one strike is lost and the contestant is knocked backward before recovery.
5. Confirm elimination on the seventh miss.
6. Check 2-player layout/camera.
7. Check 10-player mode: one local human plus nine active bots.
8. Claim slot 1 with `registerRemotePlayer`; controller state becomes `remote`.
9. Send jump and held/released duck through `RoyalTwisted.input`; AI does not fight that slot.
10. Release slot 1; controller returns to `ai`.
11. Verify gamepads where available.
12. Exercise pause/restart/desktop resize/portrait orientation.
13. `GameDebug.validateChoreography()` returns `ok === true`.
14. `GameDebug.forceHit(0,"low")` decreases lives and returns positive setback.
15. Observe representative phone performance; target 60 FPS and usable degradation around 30 FPS.

Record browser/device failures before promoting lifecycle or multiplayer readiness.
