# Royal Rumours — Production Rules and Implementation Contract

## The physical party game it comes from

The familiar in-person game is often called picture telephone, Eat Poop You Cat, or Telestrations. Every player begins with a written phrase. They pass it to the next player, who draws the phrase. The drawing is passed again without the original phrase; the next player writes what they think the drawing depicts. Players keep alternating **words → drawing → words → drawing**. At the end, the full chain is unfolded. The fun is not accurate drawing or winning—it is seeing where an innocent phrase changed into something completely different.

Royal Rumours keeps that comedy engine and uses AI for drawing. Its party-paced chain is **secret rumour → AI painting → another player's blind interpretation → AI painting → reveal**.

## Product promise

- Public title: **Royal Rumours**.
- Story: the Royal Rumour Press illustrates every whisper circulating through the castle. Its AI is fast, literal, and an unreliable witness.
- No squires appear in this mode.
- Players: 3–10. Three is a hard minimum so every player receives somebody else's painting and still has one independent chain available to vote for.
- Target length: 15–20 minutes, including tutorial and generation waits.
- Main fun: recognize the original idea, then watch the blind interpretation and second painting mutate it.
- Tone: all ages by default, with player-authored comedy. Normal platform image moderation still applies.

## Complete game flow

### 1. Lobby and tutorial

The host chooses Royal Rumours and starts with 3–10 active players. The 28-second tutorial is on by default and may be skipped by the host. It explains:

1. Write one ridiculous, visual royal rumour.
2. AI turns every rumour into a painting.
3. Each player receives somebody else's anonymous painting and guesses what happened.
4. AI paints each guess.
5. The room sees every complete chain and crowns the funniest transformation.

The scoring explanation is visible: interpreter +500 per vote; original starter +250 per vote.

### 2. Start the whisper — `ANSWERING`

- Every active player simultaneously writes one visual rumour.
- Limit: 18 words and 180 characters.
- Prompt: “Start one ridiculous royal rumour.”
- Writing guide: subject + strange action + one vivid detail.
- Example: “The Queen secretly races geese after midnight.”
- Rumours, authors, and live text are private during submission.
- When everyone submits, or the 60-second timer expires, enter `ANSWER_LOCK`.

### 3. First AI paintings — `ANSWER_LOCK` → `IMAGE_REVEAL`

- Queue exactly one `KING_PROMPT_IMAGE` job for every submitted rumour.
- Preserve the player's text as the visual brief. Do not add story facts that change the premise.
- Build a deterministic derangement: each eligible player is assigned exactly one other player's source answer; nobody receives their own.
- The TV and phones show a Royal Rumour Press intermission.
- Do not reveal any painting until all first-pass jobs are terminal: `READY` or `FALLBACK`.
- While jobs are `QUEUED` or `GENERATING`, remain in `IMAGE_REVEAL` and poll again.
- Image generation uses the shared retry chain. Only after every configured model fails may a neutral concept card stand in for that picture.

### 4. Blind interpretation — `RUMOUR_GUESSING`

Each player phone receives only the assigned first AI painting or fallback concept card and a generic instruction to describe what they think happened. It must not receive the source text, source author, assignment map, other guesses, or future reveal order. The host sees only submission progress.

- Interpretation limit: 18 words and 180 characters.
- A player may submit once.
- The interpretation is stored against the source answer and attributed to the interpreter in authoritative state.
- When all eligible players submit, or the 45-second timer expires, continue with completed chains. Missing interpretations never block the room.

### 5. Second AI paintings — `RUMOUR_IMAGE_REVEAL`

- Queue exactly one `KING_PROMPT_IMAGE` job for every completed interpretation.
- Use the interpretation text—not the original rumour—as the visual brief.
- Do not reveal chains until every second-pass image is `READY` or `FALLBACK`.
- If there are no completed interpretations, finish safely with no winning chain.

### 6. Theatrical chain reveal — `RUMOUR_REVEAL`

Build one shuffled, deterministic reveal order from completed source-answer IDs. Reveal one chain at a time for eight seconds:

1. Original whisper and starter name.
2. First AI painting.
3. Blind interpretation and interpreter name.
4. Second AI painting.

All phones mirror the current chain. Before this phase, none of these relationships may be public.

### 7. Final ballot — `RUMOUR_VOTING`

- Show every complete chain as “original became interpretation.”
- Each player votes for one funniest transformation.
- A player cannot vote for a chain they started or interpreted.
- Audience participation is not part of the official mode.
- Ballot time: 30 seconds. Lock early when every eligible player has voted.

### 8. Scoring and Crown — `VOTE_LOCK` → `FINAL_RESULTS`

For each official vote, award +500 to the interpreter and +250 to the original rumour writer. The highest total player score wins the Crown. All tied players remain co-champions. The chain or chains with the most votes receive **Funniest Mutation**; tied chains all win. If no valid votes exist, no chain is falsely crowned.

Final awards are **Rumour Mill** for interpretation performance and **Loose Lips** for original-rumour performance. The result screen shows champions, crowned mutation(s), scores, awards, and Play Again.

## Authoritative data model

The compatibility round kind is `ROYAL_RUMOURS`. Its authoritative server fields are:

- `answers`: original rumours with player IDs.
- `royalRumourAssignments[playerId] = sourceAnswerId`.
- `royalRumourGuesses[sourceAnswerId] = { id, playerId, sourceAnswerId, text, submittedAt }`.
- `royalRumourRevealOrder`: completed source-answer IDs.
- `royalRumourRevealIndex`: current sequential reveal.
- `kingImages[originalAnswerId]`: first painting.
- `kingImages[guessId]`: second painting.
- `votes`: one source-answer ID per eligible voter.
- `results = { kind, chainVotes, winningSourceAnswerIds, pointsPerVote }`.

All fields serialize with defaults so old rooms continue to load. The server engine—not the browser—owns assignments, eligibility, scoring, timeouts, retries, and phase transitions.

## Snapshot privacy contract

Before `RUMOUR_REVEAL`, host/display snapshots expose no original answers or chain objects. During `RUMOUR_GUESSING`, a player's `taskData` exposes only their assigned source ID and its public image descriptor; it exposes no source text or author. Other players' assignments and guesses are absent.

During sequential reveal, snapshots expose only the current chain. During voting, vote lock, and final results, they expose all complete chains. Vote eligibility is calculated server-side and sent as source-answer IDs to each player.

## Bot, solo, and replay contract

- Bots submit deterministic visual rumours and deterministic interpretations, obey the derangement, and cannot self-vote.
- Bot votes favor eligible human-involved chains in solo testing so the complete scoring path is exercised.
- Solo live images are optional. When disabled, both image passes use deterministic quota-free concept cards.
- Slow or failed image jobs never reveal partial galleries. All configured models are tried before fallback.
- Missing interpretations create fewer complete chains; they never deadlock the match.
- Play Again resets assignments, guesses, reveal order, image references, votes, scores, awards, and action idempotency.
- The archive may preserve final public chains and generated images, but never session tokens, hidden pre-reveal snapshots, raw moderation data, or credentials.

## Release acceptance tests

1. A two-player room cannot start; 3–10 players can.
2. Every first-pass assignment is a one-to-one derangement.
3. Host JSON during guessing contains none of the original rumour strings.
4. A guessing phone contains an image but not its source text or author.
5. Both generation stages remain blocked while any relevant image is queued or generating.
6. Reveal advances one complete chain at a time and then shows all chains for voting.
7. Contributor self-votes are rejected by the server.
8. Each vote pays exactly 500 to the interpreter and 250 to the starter.
9. Tied players and tied transformations remain tied.
10. Serialization round-trips every Royal Rumours field and replay starts cleanly.
