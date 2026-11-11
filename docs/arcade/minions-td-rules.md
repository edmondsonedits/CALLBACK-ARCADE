# Minions TD rules and provenance

Minions TD is an original King Prompter 1v1 lane-defense game. Two phone commanders choose one private order per wave. Their minions, towers, resources, deadlines, combat, results, and replay all live in the existing D1 room; the host reveals each simultaneous round.

## Match rules

- Both commanders start with a 12-health core, a level-1 tower, and 4 gold. The match has at most six 30-second waves. Each new wave adds 2 gold, up to 10.
- Each commander chooses one order: deploy a minion, upgrade their tower, brace their core, or hold position. Costs are validated against the current gold by the server. Tower level is capped at 3.
- **Swiftling** costs 2 gold and has 3 health, speed 2, and 1 core damage. **Bulwark** costs 3 gold and has 5 health, speed 1, and 2 core damage. **Siege Beast** costs 5 gold and has 7 health, speed 1, and 3 core damage.
- An upgraded tower costs 3 gold and increases its one shot per wave by one damage. Brace costs 2 gold and absorbs up to 2 core damage this wave. Hold is free and grants 1 gold when orders resolve.
- Both orders apply together. Each minion advances along a five-cell lane; a minion that reaches the opposing core deals its printed damage and leaves the lane. The defending tower then hits the nearest surviving minion once, dealing damage equal to tower level. Stable unit IDs break target-position ties.
- A missing order becomes Hold after the 30-second deadline plus the room's two-second recovery window. The timeout is recorded in the reveal. The host may reveal sooner when both players have locked their orders.
- A core reaching zero ends the match; simultaneous destruction is a draw. Otherwise, after wave six, higher core health wins. Equal cores are broken by gold + tower level + health of all surviving minions. Exact equality is a draw.
- Host, opponent, and spectator snapshots receive only the submission count during selection. Each seated player receives only their own locked order until reveal. Same-room Play Again clears the match state and preserves the room.

## Provenance

The [Open Party Lab Minions TD repository](https://github.com/Hartwich/minions-td) was reviewed as a reference for the broad tower-defense and in-game economy idea. The repository's Apache-2.0 `LICENSE` was verified in the project source audit. This implementation copies no upstream source code, assets, prompts, word lists, rules text, names, runtime, or dependencies; all names, balance values, deterministic rules, UI, and code here are King Prompter originals. Since no Apache-licensed material is incorporated, this is not a derivative-code adaptation and no upstream license or NOTICE text is required in the app. The repository is credited here for the high-level inspiration only; its separately uncleared assets and content are not used.
