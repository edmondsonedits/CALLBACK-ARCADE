# Royal Roller Ruckus tests

## Automated smoke test

From the repository root:

```bash
node games/royal-roller-ruckus/tests/smoke.mjs
```

It checks the imported version, local Three.js dependency, 10-player capacity, fixed timestep, CALLBACK hooks, Vertical Crownway constants, preservation of the original chat source and JavaScript syntax.

## Practical verification

1. Start races with 2, 4 and 10 racers.
2. Confirm the camera stays focused on player 0 with 10 racers.
3. Verify keyboard, touch and gamepad movement.
4. Complete a race with one human and nine bots.
5. Test low/high-speed collisions and dense pack recovery.
6. Test Crownline and rough-stone feedback.
7. Verify uphill/downhill momentum changes.
8. Fall from an elevated section onto a valid lower section and confirm recovery.
9. Fall where no course is reachable and confirm checkpoint respawn.
10. In the console call `CallbackInput.setPlayerCount(10)`, feed ordered packets to seats 1–9, disconnect one and confirm AI handoff.
11. Confirm stale/out-of-order sequences are rejected.
12. Resize/rotate a phone viewport and confirm the thumbstick does not scroll the page.

These are verification instructions, not a claim that human playtesting has been completed.
