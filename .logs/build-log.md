# Build log

## 2026-08-18

- Verified current Sites, Responses API, Structured Outputs, GPT Image, and moderation guidance.
- Selected the Sites capability path with D1 and R2.
- Initialized the official Vinext starter and began dependency installation.
- Delivered the branded entry/lobby preview and inspected the generated social card.
- Completed the host + three-phone answer/vote/reveal/reconnect vertical slice.
- Completed all round modes, score ledger, audience and late-join rules, host controls, replay, AI/image fallbacks, and Monster Factory Encore.
- Fixed compare-and-swap contention, shared-IP throttling, zero-percent reconnect state, rare room-code collision retry, R2 artifact cleanup, and Vite trace-watcher churn.
- Passed unit, D1 integration, responsive UI, Quick/Standard/Extended/Encore browser matrices, visual inspection, and clean production build.
- Verified bundled fonts/social image/health in production mode and reduced the production dependency audit to zero vulnerabilities.
- Upgraded the matched React 19.2.8, Vinext beta 6, Vite 8.2, RSC, and Cloudflare release toolchain; rebuilt without warnings and repeated all seven browser matches successfully.
- Repeated the multiplayer vertical slice against the bundled Cloudflare Worker with real local D1 and R2 bindings; reconnect, scoring, static assets, health, and cross-room isolation passed.
- Removed all unused starter auth, example-note, and generic public asset remnants before release packaging.
- Created the owner-only Sites project and configured the production environment plus a generated secret rate-limit HMAC key without committing secret values.
- Pushed the exact validated source, packaged Worker/static assets/D1 migrations, saved version 1, and deployed the owner-only production candidate successfully.
- Verified the private access gate from an unauthenticated client; public release remains held for the configured-key real-AI production match.
- Remaining external check: private Sites candidate with a configured OpenAI key, followed by public access verification.

## Structured-memory revision

- Replaced the flat lore loop with winner-only `ANCHOR → VOICE → WORLD → CONSEQUENCE` memory nodes and persisted semantic edges.
- Rebuilt Standard as The Seed, Read the Room, Make It Real, The Catch, Crowd Control, Callback, and The Remix; Quick and Extended preserve the same arc.
- Moved Anchor image generation to the end of The Seed, revealed it before Make It Real writing, and limited the final commemorative image to 2–4 compatible memories.
- Added strict callback/Remix candidate fields and quality gates for semantic connection, coherence, answerability, surprise, safety, repetition, and closed-endedness.
- Added deterministic coherent fallbacks, a callback quality corpus, winning-memory clue, callback rewind, Tonight's Lore graph gallery, and meaningless locked-in fidget counter.
- Deferred audience mode and mid-game joining from v1 while preserving existing-seat reconnect.
- Found and fixed Crowd Control's variable-distribution scoring bug during the multiplayer gauntlet.
- Passed 13 unit checks, 2 production-Worker rendering checks, the D1 vertical slice, all 7 browser matches, the responsive matrix, in-app preview inspection, and the production build. Final private revision deployment remains next.
