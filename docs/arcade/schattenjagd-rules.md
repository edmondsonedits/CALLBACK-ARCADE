# Schattenjagd

## How to play

Schattenjagd is a four-case clue-sharing and suspect-selection game for 2–8 players in one King Prompter room. Each case shows the host and phones the same three-suspect board. Every player privately receives one of two clues on their phone. Share clues with the room, compare each clue to the suspects' trace and route, and lock a suspect before the 40-second case clock ends.

Votes remain private until the case reveal. A correct suspect earns 100 points. If at least half of the room identifies the suspect, every player also earns a 50-point teamwork bonus for that case. A player who does not vote before the deadline abstains and earns no points. Four cases determine the final score; ties are shared. The host may reveal early after every active player locks a vote. The host can pause and resume the case clock and start another match in the same room after the result.

## Case design

Each original case has three suspects described by a trace and a route. Two separate clue cards each identify a property; together they narrow the board to exactly one suspect. Case records are static first-party data in `server/arcade/schattenjagd.ts`; reveal results retain the chosen suspects and score arithmetic so persisted state can be revalidated.

## Privacy and authority

The D1-backed server validates room, participant, match, case number, suspect ID, phase and deadline. It records each vote once, resolves missing votes as abstentions and computes points and winners. During investigation, each player receives only their own clue and own locked choice; host, display and audience snapshots receive neither clue nor votes. The reveal publishes both clues, the target and votes. No hidden case data is supplied to the host UI before reveal.

## Provenance

This is an original King Prompter implementation and original case set. No Open Party Lab source code, assets, prompts, rules text or artwork were copied or bundled. The upstream project snapshot inspected for this title did not include a root license; the implementation therefore uses no upstream material.
