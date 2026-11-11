# King Prompter Round System

Round plans, durations, and score caps live in `lib/game/config.ts`. Content pools and Catch constraints live in `lib/content/library.ts`. Contracts are defined in `lib/contracts.ts`; deterministic transitions and actions live in `server/engine.ts`.

The server owns `phase`, `phaseStartedAt`, `deadlineAt`, pause state, current round, submissions, votes, results, and scores. Clients display server time and deadlines but cannot advance or score a round. Any sync can notice an expired deadline; a version-guarded transition ensures only one request commits it.

Creative-round lifecycle is broadly intro → answering → lock → voting → reveal/results. Social and finale rounds use typed phase variants. Exact phase behavior should be read from `server/engine.ts`, not duplicated in UI code.

When changing round content:

- preserve stable unique IDs and typed exports;
- keep family/party mode metadata correct;
- ensure prompts are open-ended and answerable quickly on a phone;
- keep World memories independent enough to combine with the established Anchor/Voice;
- make Catch constraints mechanically verifiable;
- update tests when the intended contract changes.

When changing timing or scoring, treat it as server logic. Verify deadline boundary behavior, ties, duplicate actions, replay, the Standard plan, and the 3/6/10-player matrices. Never compute authoritative totals in a client.

Birthday mode adds `BIRTHDAY_BETS` plus birthday-specific prompt selection around existing creative, author-guessing, Catch, social-prediction, and finale mechanics. `birthdayPersonId`, choices, correct predictions, and score events remain server-authoritative. Never expose `personalChoices[birthdayPersonId]` before `REVEAL`.

Bots do not define a second round engine. `server/bots.ts` fills their turns in the existing authoritative round, then the normal early-lock, transition, validation, scoring, lore, and snapshot code runs unchanged. Bot creative answers must satisfy the active Catch validator, bots cannot vote for themselves, prediction arrays must total 100%, and repeated syncs must be idempotent. A regular room may start with two active seats and the host may add or remove bot seats in the lobby; bots count toward the ten-seat cap and the two-seat minimum.

Default solo image behavior remains deterministic and quota-free. `soloLiveImages` is valid only for a Pictures/King Prompter, Royal Rumours, The Royal Frame-Up, or Comic solo room and must be explicitly enabled. The engine—not `server/bots.ts`—then queues normal image jobs for human and bot entries. Visual-mode bot ballots deterministically put non-bot entries first so a one-human test exercises winner advancement.

Developer mode also does not define a second engine. Its host-authenticated room override may replace the current round's presentation copy, preserve existing choice IDs while relabeling choices, set a room-only creative score cap, or reset the current deadline. It must remain isolated to `developerMode && soloMode`, and changing an instruction label must never silently loosen its mechanical validator.

King Prompter uses two `PROMPT_AND_CIRCUMSTANCE` canvas rounds followed by one `KING_PROMPTER_FINAL` Royal Restoration round. Each canvas follows answering → image work/fallback → single-favorite image ballot → reveal/results; there is no prompt-ranking stage. Canvas One generation overlaps Canvas Two writing, and Canvas Two generation overlaps Canvas One voting. Prompt text is capped below 20 whitespace-delimited words on the server. Early Canvas One finishers may vote among exactly three curated requests for Canvas Two. Phone ballots include every candidate and mark the player's own image `voteEligible: false`; the authoritative action handler still rejects self-votes. Every received favorite vote creates a uniquely keyed score event worth 100 points on Canvas One, 150 on Canvas Two, or 300 in Royal Restoration. All tied canvas and restoration winners remain explicit. The final collage keeps the central King unchanged while every player contributes one generated square cropped beneath a deterministic torn-paper slot.

The Royal Frame-Up uses one compatibility `KING_REQUEST_MYSTERY` round with a repeated per-case cycle: report writing → answer lock → confirmation-gated evidence generation → `MYSTERY_DECOYS` → `MYSTERY_VOTING` → `MYSTERY_REVEAL`. The original witness is ineligible for both case actions; each investigator is ineligible for their own cover story. Correct reads pay 500, fooled votes pay the cover-story writer 500, or 750 when that writer spends their one hidden Royal Seal, and the witness earns 250 per correct read capped at 750. Public snapshots expose only the current evidence image and anonymous report text; truth, author mappings, votes, Seal use, and results remain hidden until reveal.

Royal Rumours uses one `ROYAL_RUMOURS` round: simultaneous secret rumours → first confirmed AI paintings → deterministic blind pass → `RUMOUR_GUESSING` → second confirmed AI paintings → sequential `RUMOUR_REVEAL` → `RUMOUR_VOTING`. Each vote pays 500 to the interpreter and 250 to the starter. Contributor self-votes are forbidden. See `ROYAL_RUMOURS.md` for the privacy and automation contract.

Royal War Room uses three `ROYAL_WAR_ROOM` rounds and `WAR_RANKING`, `WAR_COUNCIL`, `WAR_TURN_REVEAL`, and `WAR_ROUND_REVEAL`. The room-wide order stays server-only until chapter reveal. Lion and Raven alternate commander-authorized placements, share scoring within each council, and each have one match-wide Spyglass. Match parity strictly alternates Attack and Defend. See `ROYAL_WAR_ROOM.md` for the complete contract.

Let's Make a Comic uses three `COMIC_FRAME` rounds. Each follows answering → answer lock/image queue → image wait/fallback → ranked image ballot → reveal/results. Earlier winning frames remain part of authoritative room state and appear as context for later frames. Setup uses 300/200/100 rank points, Escalation uses 500/300/150, and Punchline uses 1,000/600/300. Top ties remain in round results; a stable deterministic choice among tied leaders fills the one available panel space.

`SUBMIT_FEEDBACK_VOTE` is accepted only after that player has submitted the current answer or ballot. The server enforces a 10-second cooldown, one choice per curated pair, and a uniquely keyed 25-point score event. The six-pair deck limits the bonus to 150 points. Room state keeps immediate choices; the normalized `feedback_votes` table keeps idempotent aggregate learning after room cleanup. New rooms inherit those counts, and deterministic tie-breaking selects a preferred option without letting feedback decide phases, eligibility, ballot winners, or final winners.
# Bowl of Fools state path

`LOBBY → FOOL_TEAM_SETUP → INTRO → ROUND_INTRO → FOOL_WRITING → FOOL_TURN → FOOL_ROUND_REVEAL → FOOL_TURN → FINAL_RESULTS`, with `FOOL_SUDDEN_DEATH` used only after a tied third round. The creator owns both the host cookie and a normal player seat; all game actions still use the player seat while the compact host console uses the separate host authority. See `BOWL_OF_FOOLS.md` for transitions and invariants.
