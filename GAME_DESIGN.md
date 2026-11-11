# King Prompter Game Design

King Prompter is an account-free Jackbox-style game for one shared 16:9 host display and 2–10 player seats. Royal War Room, Royal Rumours, and The Royal Frame-Up require at least three active seats. King Prompter is the public umbrella identity; CALLBACK remains an internal and Legacy Standard term. In Legacy Standard, comedy created by the room becomes reusable memory and returns in later prompts.

Bowl of Fools is the deliberate exception to the two-seat and shared-TV defaults: it requires 4–10 humans, disallows solo/bots, and also supports a no-TV Remote Live environment. Its permanently anonymous shared-scroll collection returns through describe, draw/charades, and one-word rounds. See `BOWL_OF_FOOLS.md`.

For testing or private play, Solo Playtest Mode supports one human on one phone plus two to five built-in bot opponents. The same phone holds separate host and player sessions, shows the entire game, and exposes compact start/pause/add-time/skip/replay controls. Bots are deterministic local characters—not generative AI. They normally use varied deterministic votes; King Prompter solo tests deliberately rank the human entry first so the human image reliably reaches the final. Normal multiplayer starts with any two active seats, human or host-added bot, and keeps the landscape host display separate.

Developer Mode builds on that solo path. A developer can play the real game, open a studio over any phone screen, try room-scoped prompt/pacing/scoring edits, and capture observations. These edits are deliberately temporary. A versioned **Copy for Chat** package carries the exact playtest context and desired permanent changes back to the source-maintenance workflow.

The Standard arc is:

1. **The Seed:** players invent a reusable Anchor.
2. **Read the Room:** a social prediction round hides Anchor image-processing latency.
3. **Make It Real:** reveal the winning Anchor image; players create its Voice.
4. **The Catch:** players create an independent World memory under a mechanical comedy constraint.
5. **Crowd Control:** a social round hides callback preparation latency.
6. **Callback:** Anchor, Voice, and World collide in a coherent new setup; the winning answer becomes a Consequence.
7. **The Remix:** compatible established memories are combined into a fixed finale structure.
8. **Tonight's Lore:** results and the room's memory graph are displayed.

Only winning and tied-winning creative answers enter active Room Lore. The graph has typed nodes (`ANCHOR`, `VOICE`, `WORLD`, `CONSEQUENCE`) and explicit edges. A good callback preserves the original ideas, connects them causally, escalates them, and ends in a short open question players can answer. It must not be a generic reference, a forced mash-up, a closed question, or a premise that supplies its own punchline.

AI is backstage creative assistance. Cloudflare Llama 3.1 8B Fast can classify and connect winning memories, then propose sharper Callback and Remix setups that lean toward the room's remembered comedy preferences. It may also summarize, rank creative candidates, or illustrate established memories. Every generated candidate passes strict schema, coherence, answerability, surprise, and memory-link gates before use. AI never determines player eligibility, authorship, scores, votes, winners, phase timing, or round transitions.

Every match must remain finishable when AI, image generation, R2, or a client connection fails. Deterministic fallback text and concept cards are product behavior, not temporary mocks.

Replay variety is authoritative state, not client randomness. A room keeps a bounded history of prompt IDs across **Play Again**, increments its match number, and uses both values to rotate prompt decks, Birthday questions, Catch constraints, Comic themes, feedback cards, and solo-bot compositions. This prevents an immediate replay from reconstructing the previous game while keeping reconnects deterministic.

Comedy prompts use a consistent scaffold: establish a specific character or social role, place it in a concrete everyday setting, introduce a status reversal or escalating problem, and leave the punchline open for the player. Prompts should lead toward a vivid comic target without writing the answer for the room.

## The Big 30 party pack

The birthday route creates a seven-round, six-mini-game pack around a host-supplied first name. The host designates one joined player as the Birthday VIP. Birthday Bets keeps the VIP's real choice server-side until reveal while every other player predicts it. The pack also includes The Biopic, Who Wrote It?, Thirty Words or Less, Most Likely To, and Future Message. Birthday mode is deterministic and does not require OpenAI or generated images.

In a birthday solo room, the one human is automatically the Birthday VIP. Bot answers, predictions, votes, and author guesses are generated from built-in safe pools so the complete pack remains playable without another device or any paid service.

## King Prompter

This is the primary three-round image-prompt game: Canvas One, Canvas Two, and Royal Restoration. The King gives the whole room one short all-ages commission. Every player has fewer than 20 words to describe a funny painting for their supposedly human Royal Squire. Early Canvas One finishers may optionally vote among exactly three curated requests for Canvas Two. When all prompts resolve, a three-second countdown starts Canvas Two while Canvas One images keep generating. After Canvas Two writing, the room votes once for a favourite Canvas One image and then once for Canvas Two; prompts remain beside images and self-votes are rejected. Each received vote pays 100 points in Canvas One and 150 in Canvas Two, with all tied winners preserved.

Royal Restoration finishes the match with one old portrait whose central King remains immutable. Each active player receives a deterministic torn slot from a reviewed 3–10-player layout and writes one final under-20-word addition. The image model generates ordinary independent squares; the renderer normalizes and crops each square beneath its assigned irregular torn mask, then layers every patch around the unchanged base portrait. The complete deliberately mismatched collage remains the main gallery piece. Players choose the funniest restored section, never their own, for 300 points per Royal Seal. Tied restoration winners and tied overall champions remain co-winners. Concept-card fallbacks keep every contribution voteable when generation fails.

## The Royal Frame-Up

This standalone 15–20-minute visual bluffing pack begins with one private under-18-word castle incident report per player. Enchanted evidence paintings generate simultaneously and the Evidence Vault stays closed until each is confirmed or has exhausted the fallback chain. The game features every painting once. Its original witness sits out while all other players write one believable cover story, then identify the true report from an anonymous shuffled ballot that excludes each player's own story.

Correct investigators earn 500 points. A cover-story writer earns 500 for every fooled voter, or 750 when using their one secret Royal Seal for the match. The original witness earns 250 per player who finds the true report, capped at 750 for that case. Reports, authors, votes, and Seal use remain absent from public snapshots until reveal. See `THE_ROYAL_FRAME_UP.md` for the complete implementation contract.

## Royal Rumours

Royal Rumours is a short AI picture-telephone mode. Every player writes a secret royal rumour, AI illustrates it, and another player interprets only the anonymous image. AI illustrates that interpretation, then the TV reveals the full words → picture → words → picture chain. One final eligible ballot crowns the funniest mutation. The complete production contract is in `ROYAL_RUMOURS.md`.

## Royal War Room

Royal War Room is a no-image social-ranking campaign. Every player secretly ranks six offensive or defensive castle orders. The server combines those rankings into a hidden room plan; rival Lion and Raven councils alternate commanders and rebuild it using exact placements, Earlier/Later clues, and one Spyglass per council. Three chapters escalate from the top three positions to a complete plan. Correct placements reward every council member. Match one attacks, and every Play Again reverses the story to Defend, then back again. See `ROYAL_WAR_ROOM.md` for the full contract.

## Let's Make a Comic

This standalone visual pack builds one three-panel comic across Setup, Escalation, and Punchline rounds. A curated random theme helps establish the premise. The phone headline stays deliberately brief and noun-first: create the star, give them a new problem, then show the punchline. Earlier winning panels remain visible as the story context instead of being repeated in oversized instructions. Every under-20-word submission becomes an image or concept card, and anonymous ranked image voting selects each panel. There is no separate prompt vote. Ballot values rise by round, with the punchline worth the most. Ties remain explicit, while stable deterministic selection chooses the single tied leader that can occupy each physical comic space. See `LETS_MAKE_A_COMIC.md` for the full contract.
# Bowl of Fools

Bowl of Fools adds a voice-first team memory game with no image-generation dependency. Its design and implementation contract are specified in `BOWL_OF_FOOLS.md`.
