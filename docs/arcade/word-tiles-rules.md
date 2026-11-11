# Word Tiles

Word Tiles is an original King Prompter D1 game for two to eight players. It is inspired by the broad idea of shared letter-tile word building. It does not use Open Party Lab rooms, runtime, code, word lists, artwork, or other assets.

## Match loop

- A match has five rounds. Every player gets the same seven-letter rack during each round.
- Each phone may privately lock one three-to-seven-letter word or pass. The server checks the first-party embedded lexicon and verifies that the rack contains every submitted letter with the correct multiplicity.
- Choices stay private while a rack is open. A player can see whether their own choice locked; hosts, spectators, and other players see only the rack, scores, and submission count.
- The host reveals once every player submits or the 45-second deadline expires. Missing players receive a zero-point timeout pass. D1 recovery resolves expired rounds if the host disconnects.
- After the reveal, the host advances to the next rack. The fifth reveal produces the final score and tied winners. Play Again resets the match in the same King Prompter room.

## Scoring

Letters use a small familiar point schedule: A/E/I/L/N/O/R/S/T/U are worth one; D/G two; B/C/M/P three; F/H/V/W/Y four; K five; J/X eight; and Q/Z ten. A seven-letter word receives a three-point rack bonus. The highest tile score in a round gets three additional points; tied leaders each get one. A pass or timeout scores zero and cannot win a zero-score round.

## Server and privacy contract

The D1 room state owns the racks, lexicon validation, locked choices, deadlines, scores, and reveal transitions. Match serialization validates its bounded shape. Host and spectator snapshots never expose locked words before reveal; a player snapshot may expose only that player's own locked word. No random seed or hidden solution is included in snapshots.

## Provenance and current release gate

The upstream [Open Party Lab Word Tiles package](https://github.com/Hartwich/word-tiles) is coupled to its own game-core and Phaser contracts, and its words, fonts, visuals, and other data were not individually cleared for reuse. King Prompter contains a new bounded lexicon, scoring rules, engine, controller, and host presentation. No upstream runtime, source code, assets, or word-list content was copied. The native room, privacy, timeout, replay, and UI path is integrated; a focused multi-phone Playwright flow is included for the parent release check.
