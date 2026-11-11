# Sketch & Sorcery backend

Implemented native Arcade game `sketch-relay` with authoritative room state, fixed 3–10 player rings, three rounds, private assignment snapshots, timed recovery, pause/resume, replay, and the final gallery of every chain. Catalog registration automatically exposes the game in the shared Session Lobby.

Default stage timers are 60s drawing, 35s transformation, 20s caption, 40s redraw, 35s transformation, 12s per revealed chain, and 5s round scores. Extended timers multiply only the drawing, caption, and redraw clocks by 1.5. A ten-player extended match has 18m45s of stage deadlines, excluding pauses, host replays, and polling overhead.

Each accepted drawing, caption, and redraw awards 100 points. A player can award one 25-point applause per round to another artist's already revealed leg. Scores derive from accepted contributions and applause and persist through uniquely keyed score events under the existing room CAS. Bots submit deterministic practice contributions and never enqueue image jobs.

The upload reducer accepts only authenticated current assignments, a selected prompt for original drawings, square PNG metadata up to 512 pixels and 450,000 bytes, and one source per leg. It emits the READY source effect, transformation job, and participation score in one mutation. Transformation payloads identify the actual source asset and contain no original prompt or caption. Expired transformation stages freeze the actual source sketch as their fallback; late results cannot replace it.

Host/public snapshots omit prompts, assignments, source receipts, and artwork before reveal. Captioners receive only their assigned finished image; redrawers receive only the assigned caption. Media visibility follows current assignment/reveal/gallery state. Image completions during pause and immediately after an expired drawing deadline remain serializable. The shared room deadline resumes from the saved remaining time.

Host `ADVANCE_SKETCH_RELAY` is bound to match, round, and subphase. `next` advances an eligible stage; `replay` during reveal restarts the same chain's 12-second timeline. The existing `PLAY_AGAIN` resets the match within the same room. Native session retirement continues to guard all writes through the existing D1 session condition.

Snapshots now expose an optional `sketchImageJobs` list of opaque queued job IDs scoped to the current round of an active match, and include these jobs in `imageJobsPending`, so host and player dispatch can start the image pipeline without revealing private job payloads.

Validation: 12 focused backend tests cover private snapshots and assets; immutable upload acceptance; assignment and payload rejection; actual-source timeout fallback and stale output; paused/late generation; all three scored rounds; applause idempotency; complete gallery and replay; free bots; corrupted serialization; maximum extended duration; reveal replay; and scoped pending-job discovery. Seven neighboring Draw & Guess/Word Tiles room tests also pass. Catalog/online integration expectations now include the new native game (24 retained titles total); the focused backend/catalog/online batch passes 36 tests. Full TypeScript and focused ESLint checks passed before final report updates.
