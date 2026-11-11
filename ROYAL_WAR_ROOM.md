# Royal War Room — Authoritative Game Contract

This is the complete rebuild specification for the `royal-war-room` mode.

## Product promise

Royal War Room is a 15–20-minute, 3–10-player social ranking game for one shared TV and one phone per player. Four or more players are recommended. It uses no image generation and has no per-match AI cost.

The castle alternates between two stories: **Attack**, planning how to take over a neighboring castle, and **Defend**, planning how to survive another castle's invasion. Match one in a room is Attack. Every successful `PLAY_AGAIN` increments `matchNumber` and reverses the role: odd matches Attack, even matches Defend. This is a hard rule, not a random content choice.

## Core loop

Each match has three campaign chapters. Every chapter presents exactly six short, curated, all-ages orders appropriate to the current story. Every player privately ranks all six from first to last. The server combines all rankings into one secret room order. Two rival councils then alternate turns trying to reconstruct that order on the shared war board.

The councils are **Lion** and **Raven**. The server assigns active players as evenly as possible using a deterministic shuffle seeded by room and match. Membership remains fixed for the match.

1. **Opening Orders:** place ranks 1, 2, and 3; maximum 10 turns.
2. **The Main Campaign:** place all six ranks; maximum 18 turns.
3. **Battle for the Crown:** place all six, presented outside-in as 1, 6, 2, 5, 3, 4; maximum 18 turns.

Every chapter follows `ROUND_INTRO → WAR_RANKING → WAR_COUNCIL → WAR_TURN_REVEAL` (repeat) `→ WAR_ROUND_REVEAL`. Chapter three continues to `FINAL_RESULTS → POST_GAME`.

## Secret consensus calculation

Every ranking is a permutation containing each current choice ID exactly once. At the end of `WAR_RANKING`, missing human rankings and bot rankings are filled with deterministic permutations so a disconnected player cannot block the match.

For each choice, sum its zero-based position across all player rankings. Sort ascending by that sum. Resolve equal sums with the project's stable seeded hash using room, round, and choice IDs. Store the result as `warTrueOrder` on authoritative round state.

Before `WAR_ROUND_REVEAL`, role snapshots expose `trueOrder: null` and never another player's ranking. At chapter reveal and final results, the true order may be public.

## Council turns

Lion begins chapters one and three; Raven begins chapter two. Councils alternate after every resolved turn. The active commander is derived from the active council's seat-ordered members using `floor(warTurnNumber / 2) % teamSize`, passing command after both councils have acted.

Only the current commander may submit a placement or use that council's Spyglass. Other members are discussion partners.

A placement contains one unplaced choice and one open target rank. The server verifies both. A correct placement locks and scores; a wrong placement adds an **Earlier** or **Later** clue; a timeout records a skipped move. All three go through `WAR_TURN_REVEAL`. Then increment the turn, finish when all targets or the cap is reached, or swap councils.

## Spyglass

Each council has exactly one Spyglass for the entire three-chapter match. It does not consume the turn. The commander selects one unplaced order; the server reports whether its true rank is in the top half (1–3) or bottom half (4–6). Reject repeat use, non-commanders, placed choices, and invalid IDs. Reset both Spyglasses only for a new match.

## Scoring and winners

| Chapter | Team banners | Points per council member |
|---|---:|---:|
| Opening Orders | 1 | 250 |
| Main Campaign | 2 | 400 |
| Battle for the Crown | 3 | 600 |

Every correct placement rewards every active member of that council. The council with most banners wins; equal banners preserve both. Individual champions are every player tied at the highest point total.

Attack results say **Castle conquered**. Defend results say **Castle held**. The replay button says **Defend the castle next** after Attack and **Plan the next invasion** after Defend.

## Presentation contract

The opening tutorial is on by default and host-skippable. It explains ranking, secret consensus, councils, rotating commanders, clues, Spyglass, shared rewards, and replay alternation.

The 16:9 host screen shows campaign/chapter, prompt, team totals and rosters, active commander, Spyglass state, a six-position board, unplaced orders, recent clues, turn feedback, and the true order only at reveal. Chapter-one non-target ranks appear classified.

Phone ranking uses accessible Up/Down controls and a final seal action. Commanders select an order and open position, may spend the Spyglass, and issue a command. Non-commanders are told to discuss. Reconnects reproduce the same authoritative task and never reshuffle locally.

## Content and replayability

Content lives in `lib/content/royal-war-room.ts`. A scenario has `id`, campaign, chapter, prompt, instruction, and exactly six distinct choices. There are two variants per campaign and chapter. Selection is deterministic from room ID and match number, so reconnects agree while replay rotates content.

New content must fit on the TV board, be subjectively rankable, encourage funny disagreement, fit Attack or Defend, and remain all-ages. This mode has councils, generals, scouts, maps, and castle orders—not Squires.

## State and automation

Room fields: `warCampaign`, `warTeams`, `warTeamScores`, `warScoutUsed`.

Round fields: `warRankings`, `warTrueOrder`, `warTargetRanks`, `warPlacements`, `warClues`, `warTurnTeam`, `warTurnNumber`, `warMaxTurns`, `warLastMove`.

All require serialization defaults. Player actions are schema-validated. Bots submit deterministic rankings; when a bot commands, the engine places a correct remaining target so one-human solo play cannot deadlock.

## Regression gates

Tests must prove the three-player minimum; six-ID permutation validation; hidden order before reveal; commander-only authority; one-use non-turn-consuming Spyglass; correct/wrong clues; all target patterns; team-wide scoring; turn-cap completion; serialization; bot progress; tied winners; and Attack-to-Defend replay reversal.
