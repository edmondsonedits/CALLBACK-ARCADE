# King Prompter

King Prompter is a 2–10-seat browser party game for one shared host screen and portrait phone controllers, with a one-phone solo path for one human plus two to five deterministic bots. King Prompter is the public umbrella identity. The internally named CALLBACK memory system powers Legacy Standard, where the room progressively turns winning ideas into a connected absurd universe and uses that history as a comedy machine.

## Authoritative experience

- `/` starts or joins a room and establishes the “party game with a suspiciously good memory” identity.
- `/host/{code}` is the TV/laptop presentation and secondary host-control surface.
- `/play/{code}` is the private phone controller with reconnect, safe-area, keyboard, and locked-in states.
- Accounts, elimination, XP, cosmetics, audience mode, and mid-game joining are outside v1. Reconnects to an existing seat remain supported.
- Free-for-All is the shipped scoring mode. Team mode remains a planned configuration and must not compromise the individual score ledger.
- After an eligible submission or ballot locks, the phone points the player to the big screen and may offer one of six mode-specific feedback cards. Each completed card awards 25 points after the server-enforced cooldown, for a 150-point per-match ceiling.

## Standard arc

1. **The Seed** creates an Anchor: a character, mascot, product, object, place, business, or vehicle.
2. **Read the Room** changes the mental activity and hides Anchor-image generation latency.
3. **Make It Real** reveals the winning Anchor image, then creates its Voice: a slogan, warning, quote, or motto.
4. **The Catch** uses a mechanically validated writing restriction to create the World: a law, policy, holiday, rule, trend, or event.
5. **Crowd Control** creates social laughter and prediction points while callback candidates are prepared.
6. **Callback** combines only coherent established memories and turns its winning answer into the Consequence.
7. **The Remix** uses a fixed finale schema to escalate Anchor + optional Voice + World + Consequence and end in one short answerable question.
8. **Tonight's Lore** reveals champions, awards, the relationship graph, and a final commemorative image.

Legacy Quick and Legacy Extended are retired and rejected at room creation. Legacy Standard is the only selectable legacy plan. Monster Factory remains an optional post-game Encore with separate Monster MVP scoring.

## Memory contract

- Only winning and tied-winning creative answers become active Room Lore. Losing answers remain only for reveal and score history.
- Nodes are explicitly typed `ANCHOR | VOICE | WORLD | CONSEQUENCE` and preserve the original prompt, exact answer, source author, moderation state, and quality metadata.
- Relationships are persisted, not inferred from list position: `SAYS`, `COLLIDES_WITH`, `CAUSES`, and `ESCALATES_TO`.
- A deterministic primary memory is selected among co-winners without using submission speed as a tiebreaker.
- Social rounds never create Room Lore.
- Winning-memory reveals give the subtle clue: “Hmm… I'll remember that.”
- Replay clears scores, prompt history, lore nodes, edges, candidates, jobs, and images while retaining room sessions.

## AI contract

- `LoreAI`, `ImageAI`, and `ModerationAI` expose real OpenAI and deterministic fallback providers.
- The text adapter receives winning answers in original-prompt context plus the current graph. It classifies memories and proposes up to four callback candidates.
- Candidate gates reject unsafe, closed-ended, repetitive, low-coherence, low-answerability, low-surprise, or semantically disconnected prompts. The Remix threshold is stricter.
- The model preserves established ideas, uses only 2–4 compatible memories, and ends with one short open question. It never controls identity, eligibility, timers, votes, points, winners, or transitions.
- Round 1 queues the Anchor image immediately after scoring. Round 2 hides its latency. Round 3 reveals it before writing begins.
- The Remix queues one final image from 2–4 compatible graph elements. Titles, captions, scores, awards, and other important text stay in HTML/CSS.
- Missing credentials, timeout, refusal, moderation, malformed output, poor candidates, or image failure select deterministic curated prompts and Art Department concept cards. Matches always finish.

## Architecture

- Vinext/React emits a Cloudflare Worker-compatible ChatGPT Sites application.
- D1 is authoritative for rooms, sessions, phases, deadlines, assignments, submissions, votes, memory nodes/edges, jobs, and immutable score events.
- R2 stores generated image bytes; D1 stores room ownership and lifecycle metadata.
- Role-filtered versioned polling restores each session while hiding authorship until reveal.
- All mutations are same-origin, schema-validated, phase-bound, idempotent, rate-limited, and committed with compare-and-swap D1 batches.
- Server-created jobs, prompt hashes, leases, retries, and media ownership prevent clients from inventing paid work or crossing rooms.

## Release gates

1. Unit tests cover memory admission, graph relations, scoring, ties, fallbacks, schemas, leases, reconnect, and transitions.
2. API integration covers cookies, idempotency, deadlines, role filtering, cross-room isolation, D1/R2 work, and stable errors.
3. Browser matches cover the maintained public packs and representative 3/6/10-player flows; unit coverage separately enforces the normal two-seat minimum and ten-seat cap.
4. A dedicated comedy gauntlet evaluates whether callbacks preserve meaning, use compatible memories, escalate causally, and remain easy to answer—not just whether a schema parsed.
5. Phone and host viewports, focused keyboard height, reduced motion, visible focus, console output, and response privacy pass.
6. The production Worker, migrations, bundled assets, and debug gating pass locally before a private Site revision is deployed.
7. Public access remains blocked until a private real-AI match verifies moderation, lore quality, both image paths, R2 retrieval, reconnect, results, and replay.

## Definition of Done

The product is complete only when every supported mode finishes without deadlocks; reconnect and idempotency hold; hidden data stays private; only winners enter the graph; callbacks are consistently coherent and funny enough to operate; AI/image failures fall back instantly; the supported player-count and visual matrices pass; the real-AI private production match passes; and the public URL is verified without sign-in.
