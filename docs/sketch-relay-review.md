# Sketch & Sorcery independent review

Independent review of the current working integration. All material findings below have been addressed and rechecked in source. Root owns final browser verification and release checks.

## Phone/controller review

Reviewed `DrawingStudio.tsx`, `DrawingStudio.module.css`, `lib/drawing-studio.ts`, `SketchRelayController.tsx`, `SketchRelayController.module.css`, and `PracticeDoodle.tsx` against current working files.

### Resolved during review

- **P1 — All sketch uploads rejected by action-ID validation.** The original `SketchRelayController.tsx:69` produced a deterministic `sketch-` prefix plus a 64-character SHA-256 digest; the first reviewed upload route accepted only UUIDs at line 22. Drawing → Done → Send sketch therefore returned `INVALID_SKETCH_UPLOAD` (422) before PNG handling. Reported to root and pipeline owner. The route now accepts 1–100 ASCII alphanumeric/underscore/hyphen identifiers, including both the original hash format and the final portable UUID format. Rechecked current source.
- **P1 — HTTP preview upload required unavailable Web Crypto digest.** Root's browser check found that `crypto.subtle` was unavailable on the HTTP preview origin. The final controller uses the existing portable `randomUuid()` helper and persists its assignment-specific upload ID in local storage, with an in-memory fallback. It no longer needs client SHA-256. The server still binds and verifies bytes, player, match, round, chain, leg, and prompt choice when accepting an idempotent retry. Rechecked current source.

### Additional resolved phone finding

- **P2 — Keyboard controls could edit a locked canvas.** The dock buttons were enabled and keyboard-focusable while `locked` was true (`DrawingStudio.tsx:317–322`). While paused, Tab to More and press Enter opened a top-layer dialog above the overlay; Clear canvas at line 340 called `commit` without checking `locked`. Reported to root. Current source disables dock/show-controls while locked and guards Clear; rechecked.

### Other phone checks

- Canvas initialization is independent of polling snapshot array/callback identities. The assignment key changes with room, match, round, phase, and chain; initial assignment prompts are captured once per mounted assignment.
- Controlled drawing restores only assigned prompts. It hides custom prompts, prompt refresh, and the new-page route. Redraw captions are fixed and support 140 characters through drawing history and reload.
- Upload retries reuse a persisted assignment-specific UUID. The server verifies the same bytes and binding for a committed receipt; an uncommitted retry can safely continue after transient storage or room-CAS failure.
- Failed submission closes the modal before displaying the alert. Pause closes modal, commits any active stroke, and gates submission. Drawing remains mounted.
- Automatic submission uses the latest server time offset, respects pause, commits the active stroke, and attempts at most once after ink exists per assignment mount.
- Practice art is deterministic SVG and makes no media request.

### Verification

- `node --import tsx --test tests/drawing-studio.test.ts`: **11/11 passed**, including 140-character redraw caption history/reload.
- This pass is source review plus focused unit verification. Root owns browser interaction and full release checks.

## Broader integration review

Reviewed the pure engine/schema, engine/serialization/snapshot composition, upload route, media route, image runner, conditional database effects, stage/voice/reveal implementation, and room job dispatch.

### Resolved dispatch finding

- **P1 — Queued sketch generation could remain idle.** The original snapshot omitted sketch work, and dispatch only ran through a host's serialized eight-second background kick; HTTP 204 polls returned before dispatch. This could leave queued work idle after a fast job, and could not dispatch ten simultaneous drawings within a 35-second phase. Final `server/snapshots.ts:70–76` exposes deduplicated opaque queued job IDs only for the current active match and round. Final `useRoomSync.ts:27–38` dispatches up to ten jobs concurrently for the host, with per-job in-flight and five-second retry guards; phones also help dispatch. Its HTTP 204 branch at line 49 dispatches from the latest accepted snapshot. Rechecked current source and reviewed the actual-hook VM regressions for ten concurrent jobs and unchanged-poll retries.

### Resolved broader findings

- **P2 — Reveal animation and server clocks disagreed.** Server used 12 seconds while stage assumed 18, so the first transformation began mostly revealed. Current stage imports the server duration/timers and uses a one-second lead-in plus four-second fade per six-second leg. Rechecked current source.
- **P2 — Reveal Replay always rejected.** Stage offered `transition: replay` during revealing; engine originally accepted it only for a complete match. Current engine resets the current reveal deadline without changing chain, round, scores, or match. Rechecked source; backend owner reports the replay regression passed.

### Other integration checks

- Source upload and submission metadata are committed together; immutable source object keys incorporate the content digest and duplicate requests compare assignment/content receipts.
- Image jobs verify room ID, match, round, chain, leg, source, and current lease before and after generation. Retries after a spent attempt fall back instead of making another paid request. Completion requires the current lease in the room CAS and job update.
- Image generation receives uploaded PNG bytes and a fixed visual transformation instruction, without hidden prompt or caption text.
- Private media is room-authenticated and gated by current assignment or reveal eligibility; sketch responses disable caching. Stale match/round jobs cannot publish into the new game.
- Scores derive from server submissions/applause, use unique event keys, prevent self-applause and duplicate cheers, and finalize through the existing Arcade transaction guard.
- All phase waits have server deadlines; unfinished transformations freeze to original sketches and do not block the relay. Practice bots use coded art and do not enqueue image jobs.

No broad test suites were rerun during this review because owners and root were already executing them against the shared checkout. Root reports the final full unit suite at 990 passed / 9 skipped and full lint clean; the dispatch suite has 12 passing tests. This report distinguishes those owner-run results from the 11 drawing tests independently executed earlier.
