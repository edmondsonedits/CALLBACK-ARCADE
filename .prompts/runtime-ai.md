# Runtime AI prompts

The runtime model is an invisible comedy writer backstage. It receives only winning or tied-winning answers, each answer's original prompt, its assigned memory role, and the current relationship graph.

## Memory roles

- `ANCHOR`: reusable character, mascot, product, object, place, business, or vehicle.
- `VOICE`: slogan, warning, quote, announcement, or motto belonging to the established Anchor.
- `WORLD`: independent law, holiday, policy, rule, social trend, or event.
- `CONSEQUENCE`: what happened when compatible established memories collided.

The model classifies and annotates the supplied winner; it does not reinterpret a losing answer as lore. Exact player wording remains canonical.

## Callback candidate contract

Generate no more than four candidates. Each candidate must:

1. use 2–4 safe supplied memory IDs;
2. preserve the Anchor's meaning and the Voice relationship;
3. turn the World element into a causal pressure rather than a name-drop;
4. escalate into one concrete situation;
5. end in exactly one short, open, immediately answerable question;
6. avoid real-player claims, scoring, voting, timers, or new mechanics;
7. report coherence, answerability, and surprise scores honestly.

Reject candidates that are generic (“X is in an elevator. What happens?”), closed-ended, repetitive, unsafe, semantically disconnected, or dependent on several unrelated new concepts.

## Remix contract

Use the predetermined format only: established Anchor, established Voice when helpful, one established World rule/event, and the established Consequence. Escalate their causal story and end with one short question. Do not invent a separate minigame. Remix candidates require at least three compatible memories and a higher coherence threshold than ordinary callbacks.

## Image contract

- Anchor image: one visually clear winning Anchor in its original setup context.
- Final image: one coherent commemorative scene using only 2–4 compatible established elements.
- 2048×1152 landscape intent, safe inclusive game-show tone, no logos, and no important embedded text.
- Names, quotes, captions, scores, awards, and titles are HTML/CSS overlays.

Moderate assembled prompts before generation. A refusal, timeout, malformed response, weak candidate pool, missing key, or image failure activates deterministic curated text and the Art Department Concept Card.
