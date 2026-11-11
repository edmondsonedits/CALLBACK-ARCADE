# Let's Make a Comic

Let's Make a Comic is a standalone three-round visual game inside King Prompter. The room collaboratively builds one comic strip: setup, escalation, and punchline.

## Player flow

1. **Frame One · Setup:** a seeded comic theme supplies the cast or situation. Each player writes a visual panel prompt under 20 words. The phone recipe asks for Character → Problem → Place.
2. The opening phone task is a short, noun-first character brief: create the star and describe what they look like. Every submitted prompt becomes an image or a deterministic concept-card fallback. Players anonymously rank up to three eligible images. The winning image fills panel one.
3. **Frame Two · Escalation:** the first winning panel remains visible. Players keep the cast and make the situation worse using Same cast → Escalate → Complicate. The winning image fills panel two.
4. **Frame Three · Punchline:** both winning panels remain visible. The headline is simply “Show the punchline.” The game supplies no joke ending; players write one clear visual twist. Its ballot is worth the most and fills panel three.
5. The final screen presents the completed strip, player standings, and the overall points winner.

## Authoritative rules

- The server chooses one of 20 curated themes deterministically and owns the phase, timer, answers, ballots, points, ties, selected frames, and final winner.
- Comic prompts use the same strict below-20-word rule as King Prompter.
- There is no separate prompt ballot. Image generation begins after answer lock, then the image ballot decides the panel.
- Players cannot vote for their own panel. A ballot ranks up to three eligible images.
- Rank points are `300/200/100` for setup, `500/300/150` for escalation, and `1000/600/300` for the punchline.
- All top-tied image IDs remain recorded as winners. Because a comic needs exactly one image per space, the server chooses one of the tied leaders with a stable room/round seed. Submission speed is never used.
- Authorship stays hidden through voting and appears only at reveal.

## Image behavior

`COMIC_PANEL_IMAGE` jobs use the existing Cloudflare image provider, R2 storage, authenticated media route, leases, retries, and 90-second fallback deadline. The prompt includes the shared theme, text descriptions of the earlier winning panels, and the current candidate. This gives the provider continuity cues, but it is text-guided continuity rather than reference-image conditioning.

Comic jobs request square, clean-line single-panel art with no captions, speech balloons, logos, or important embedded text. The game does not call the separate moderation provider for this creative prompt path; basic request validation and the image provider's unavoidable model-side safety behavior remain.

Solo mode defaults to free deterministic concept cards. Enabling **Generate live solo images** explicitly sends the human and every bot panel through the configured hosted image allocation. Deterministic bot ballots rank the human panel first, allowing one-phone testing of a human-created winning strip without moving winner authority into the client.

## Failure behavior

Image or storage failure never blocks the match. Every candidate retains a voteable concept card, and the winning fallback can occupy a comic panel. Existing rooms hydrate missing comic fields safely, and Play Again clears the theme, frames, candidates, scores, and results before the next strip.
