# The Royal Frame-Up

Implementation contract · production mode · updated 2026-08-30

## Pitch and fiction

The pigeon dropped the King's sealed incident reports. Each player secretly files one ridiculous account of something that happened inside the castle, and an enchanted evidence frame reconstructs it as a painting. For every case, the witness sits out while everyone else invents a cover story and tries to frame the room. Investigators vote for the true report. Once per match, a player can secretly stamp a cover story with the **Royal Seal** to make a successful frame worth more.

The mode contains no squires. The pigeon is a comic presenter only: it explains, reacts, and narrates key moments, but never changes rules, timing, scores, images, or outcomes.

## Product contract

- Public name: **The Royal Frame-Up**.
- Compatibility selector ID: `king-mystery`.
- Authoritative round kind: `KING_REQUEST_MYSTERY`.
- Seats: 3–10 active players; start is rejected below three.
- Target match length: 15–20 minutes.
- Format: shared 16:9 TV plus one private phone controller per player.
- Core fun: creative writing, visual interpretation, bluffing, social deduction, and attributed reveals.
- Tutorial: on by default; host may skip it.
- Content: one all-ages request pool in the current release.

## Tutorial script and rules

The pigeon establishes that royal case files have gone missing and asks everyone to help reconstruct them:

1. **File a report.** Write one short, ridiculous incident that happened in the castle.
2. **Inspect the evidence.** The enchanted frame turns each secret report into a painting. Images are never shown unfinished.
3. **Create cover stories.** When a painting is opened, its original witness sits out. Everyone else writes a plausible false report.
4. **Find the truth.** Investigators choose which anonymous report produced the painting. A player never sees or votes for their own cover story.
5. **Use the Royal Seal.** Each player may secretly seal one cover story per match. The seal is hidden until the reveal and increases that story's reward from 500 to 750 points per fooled investigator.

The tutorial shows the score summary: +500 for finding the true report, +500 per investigator fooled by an ordinary cover story, +750 per investigator fooled by a sealed cover story, and +250 clarity per correct investigator to the original witness, capped at +750 for that case.

## Authoritative flow

### 1. Incident reports

Phase: `ANSWERING`, 75 seconds by default.

Every active player receives: **“What ridiculous incident happened somewhere inside the royal castle?”** The report must be non-empty, at most 180 graphemes, and at most 18 whitespace-delimited words. Good reports contain a clear subject, a funny action, and one vivid detail.

Report text is private. The TV may show submission progress but never the text. When all active players submit, the server shortens the lock to two seconds.

### 2. Evidence Vault

Phases: `ANSWER_LOCK`, then `IMAGE_REVEAL` as a confirmation intermission.

The server queues one `KING_MYSTERY_IMAGE` job per report in parallel. Each uses the selected model and the configured distinct-model fallback chain. The room remains in the Evidence Vault until every entry is either storage-confirmed `READY` or has exhausted all models and become a neutral fallback card. Time passing alone may never make a pending image revealable.

Generated public metadata uses neutral names such as `Evidence Painting 2` and must not copy the private report. The server creates one deterministic shuffled case order that survives reconnects. Cases open one at a time.

### 3. Cover Story Desk

Phase: `MYSTERY_DECOYS`, 35 seconds by default.

The TV shows the current evidence painting without its report or witness. The original witness receives a clear sit-out state. Every other active player may file exactly one false incident report, subject to the same 18-word and 180-grapheme limits.

The server rejects an original-witness submission, a second submission for that case, duplicate text matching the truth or another cover story case-insensitively, and late or malformed input.

An eligible player may set `useRoyalSeal: true` while submitting. The server accepts this only when `kingMysterySealUsedByPlayer[playerId]` is empty, records the decoy ID there, and otherwise returns `ROYAL_SEAL_ALREADY_USED`. Seal use is irrevocable after submission. It does not change text, order, or voting eligibility. If all eligible players submit, the phase shortens to 1.5 seconds; missing submissions on timeout are simply omitted.

### 4. Royal Inquest

Phase: `MYSTERY_VOTING`, 22 seconds by default.

The server deterministically mixes the true report with all submitted cover stories. The TV shows anonymous report cards. Every player except the original witness receives one ballot. A player's own cover story is omitted from their phone and a direct vote for it is rejected server-side.

Each eligible player locks exactly one choice. Votes cannot be changed. Royal Seal metadata, authorship, correctness, and vote destinations remain hidden. When all eligible players vote, the phase shortens to 1.5 seconds. A timeout abstention earns nothing and fools nobody.

### 5. Case reveal and score

Phase: `MYSTERY_REVEAL`, 8 seconds by default.

TV and phones reveal the true report and original witness, every cover story and writer, vote destinations, correct investigators, fooled players, and which cover stories carried a Royal Seal.

| Event | Recipient | Points |
| --- | --- | ---: |
| Chose the true report | investigator | 500 |
| Chose an ordinary cover story | its writer | 500 per fooled investigator |
| Chose a Royal-Sealed cover story | its writer | 750 per fooled investigator |
| Another player found the truth | original witness | 250 each, capped at 750 per case |

All scoring is server-authoritative, additive, and idempotent. Royal Seal points use the existing `mystery_bluff` event family with a `sealed` detail. Seals never multiply detective or clarity points.

### 6. Repeat and finale

Every report becomes the featured case exactly once. After each reveal, the next case begins at the Cover Story Desk. After the last reveal, the server enters `FINAL_RESULTS`, preserves tied champions, and awards:

- **Royal Detective:** most correct-investigation points.
- **Master Framer:** most cover-story points, including Royal Seal bonuses.
- **Star Witness:** most clarity points.

Play Again increments the match number, retains player seats and bounded history, resets every Royal Seal, generates fresh bot writing, and creates a new deterministic case order.

## Hidden-information and reconnect contract

Before `MYSTERY_REVEAL`, no host, display, audience, or non-author player snapshot may expose the true report, its author, cover-story authors, Seal use, votes, correctness, or score outcome. During voting, public options contain only `{id, text}`. The original witness receives no actionable ballot. The full `RoundState` remains server-only.

Refreshing must restore the same case, option order, submitted status, Royal Seal availability, timer, and reveal result. A locked action stays locked. Serialization defaults new Seal fields to empty/false so rooms created by older builds remain readable.

## Image generation and failure behavior

Player words remain the highest-priority generation instruction. An image becomes playable only after recognized JPEG, PNG, or WebP bytes are stored and confirmed. A selected model receives its retry allowance, then advances through the remaining distinct models. The room displays a retry notice. Only after all models fail does the server create a neutral, voteable evidence card. A fallback must never reveal the report early.

Provider failure cannot deadlock or leak the match. Quota-free solo mode may use deterministic neutral evidence cards; `soloLiveImages` enables the live generation path.

## Bots and accessibility

Solo uses one human plus at least two deterministic bots and the same phases and validation. Bots file reports, cover stories, and votes in authoritative structures, never vote for themselves, and use their Royal Seal on their first eligible cover story. Bot choices are deterministic for replayable tests.

Extended timers multiply interactive writing and voting phases by 1.5. Hosts may pause, resume, add 15 seconds, or skip. TV layouts must fit 1366×768 without page scrolling; phone actions must fit 375px widths with safe-area padding. Reduced motion removes nonessential animation, and every state uses text or shape in addition to color.

## Release acceptance checklist

- Three-player and ten-player matches reach final results in the intended time.
- Every report queues one image and becomes the featured case exactly once.
- No pending image, hidden report, author mapping, vote, or Seal leaks before reveal.
- Witness sit-out, no-self-voting, word limits, duplicate rejection, and timeouts are server-enforced.
- A player can use exactly one Royal Seal per match; it pays 750 per fooled investigator and resets on Play Again.
- Unsealed bluff, detective, and clarity scores match the table and remain idempotent.
- Reconnect restores exact write, vote, reveal, and Seal-availability states.
- Exhausted image fallbacks, bots, pause, skip, tied winners, and Play Again all finish safely.
- Host and phone copy consistently uses case files, evidence frames, witnesses, investigators, cover stories, and Royal Seals—never squires.
