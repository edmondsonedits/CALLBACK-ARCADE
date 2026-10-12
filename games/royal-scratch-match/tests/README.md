# Royal Scratch Match tests

Run `node --test tests/royal-scratch-match-quality.test.mjs` for the runtime harness. See `QUALITY.md` for measured evidence and remaining browser/device gaps.

These checks are split between source-level automation and browser/manual verification. They demonstrate the imported file and expected v0.5 hooks; they do not claim online multiplayer readiness.

## Automated source smoke check

From the repository root:

    node games/royal-scratch-match/tests/smoke.mjs

The smoke check verifies the immutable original archive hash and checks the edited runtime and architectural markers: 2–10 slots, input/config/state APIs, local keyboard/touch wiring, bot resolution, forward note travel, and no external HTTP(S) runtime asset dependencies.

It can also extract the inline JavaScript for Node syntax checking:

    node games/royal-scratch-match/tests/smoke.mjs --write-script
    node --check games/royal-scratch-match/tests/.scratch-match-inline.js
    rm games/royal-scratch-match/tests/.scratch-match-inline.js

## Practical browser verification

Use a modern desktop browser and at least one phone browser.

### Core standalone

1. Open source/index.html.
2. Confirm the menu loads without console errors.
3. Select 2 players; start; complete at least two DJ call/response phrases.
4. Verify notes travel from the DJ/top of the highway toward the player-facing hit rings, not away from the screen.
5. Verify A/B/X/Y hits near the line score; incorrect/missed notes reduce lives.
6. Verify D/F/J/K and arrow-key mappings.
7. Verify touch buttons do not scroll the page and remain usable across portrait resize/orientation changes.
8. Verify restart, mute, rematch, and results.

### Ten-slot standalone

1. Set the menu to 10 players, or open source/index.html?players=10.
2. Confirm ten HUD cards render without covering the timing hit line.
3. Start with the default human set.
4. Confirm slot 0 accepts local controls and nine non-human slots resolve as bots.
5. Let several phrases resolve and confirm independent lives/scores/eliminations for all slots.
6. Finish/rematch and confirm the next round resets all ten players.

### Hook verification

Before starting in DevTools:

    ScratchMatchAPI.configure({ playerCount: 10, humanPlayers: [0, 1] });
    ScratchMatchAPI.start();

During the response phase:

    ScratchMatchAPI.press(1, 0);
    ScratchMatchAPI.getState();

Confirm slot 1 is treated as human and state exposes both human slots. This proves local addressing only, not network authentication or latency handling.

### One human + nine bots

    ScratchMatchAPI.start({ playerCount: 10, humanPlayers: [0] });

Confirm exactly ten slots exist and only slot 0 requires human input.

## Repository checks

After import/metadata changes run:

    npm test
    npm run typecheck
    npm run catalog:generate
    npm run catalog:check
    npm run build

No production deploy is part of intake.

## v0.6 Crown & Cadence review

Run `node --test tests/royal-scratch-match-quality.test.mjs tests/royal-scratch-match-sumo-benchmark.test.mjs` and `node games/royal-scratch-match/tests/smoke.mjs` from the repository root.

Browser/device follow-up: verify 4 and 10 seats at 1365×900, 390×844 and 844×390; the compact DJ beside the highway; readable chord links and timing meter above controls; 44px pause/sound/fullscreen/CAM targets; settings scrolling, keyboard focus and advanced latency slider; no note drift during overlapping CAM/pause/background intervals. Confirm a held gamepad face button needs release after connection/resume and Start pauses only once per press. Listen for four 96 BPM count-in beats, gold call and cyan echo audio separation, mute/volume behavior and no sound on automatic scenarios until enabled. Check rehearsal phrase retry/advance/finish and fresh-set versus same-set replay. This manual follow-up has not been claimed as completed by the subtask.
