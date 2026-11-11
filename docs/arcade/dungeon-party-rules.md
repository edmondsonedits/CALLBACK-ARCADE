# Dungeon Party rules

Dungeon Party is a cooperative King Prompter Arcade game for three to eight players. The party begins with 10 shared health and faces the Goblin Patrol, Rune Gate, and Dragon Vault in order. Each phone locks one private move per encounter; the host and other phones see only the submission count until reveal.

Each encounter has a progress target equal to half the party size rounded up. Strike, Decode, and Spell contribute progress; Guard, Brace, and Ward reduce incoming damage; Patch up, Rally, and Restore heal the party. The Dragon Vault spell contributes two progress. A successful encounter scores 1,000 points and reduces its threat by one before damage is applied. An unsuccessful encounter scores 100 points per progress and exposes the party to 4 extra damage, so repeated failed encounters can defeat the party. Shared health cannot exceed 10.

When the encounter deadline expires, every missing move becomes that encounter's defensive action. A timeout is recorded only when at least one move was missing; a delayed host reveal after all moves are locked does not count as a timeout. The server resolves all moves in player-seat order, records the full outcome, and exposes choices only after reveal. Three cleared encounters produce an escape; surviving the final encounter without clearing all three is a survival. The final result includes health, score, and encounter history. Play Again starts another run in the same room.

The match is deterministic from its submitted choices; it needs no external game server, assets, or model calls. D1 room state owns the encounter, deadline, choices, health, score, and result. Pausing stores remaining deadline time, and resuming restores it.
