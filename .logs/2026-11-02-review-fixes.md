# Review fixes — local verification

Base: Site v120 source `21620b94a9b35385ff530b0caaaa7c7e49ed6ce5` in `H:/ChatGPT/CALLBACK-face-photo-2026-11-01`. Original older C: working tree preserved. No commit, publication, paid calls or production-data mutation.

Implemented F1–F5 plus the recommended privacy matrix, isolated configured QA, current documentation and local timing measurement. Frame-Up aliases remain stable for old rooms; progress and final projections avoid internal identifiers. Restoration waits for every image before exposing the collage. `0015_match_scoped_rounds.sql` retains legacy rows and recovers available current-match identities without changing published archives. Main/online child admission is parent-controlled and checked at the mutation boundary.

Additional observed QA fixes: connectivity epochs prevent stale responses from overwriting offline/recovered state; postgame avoids retired socket reconnects; HTTP End Game completes coordinator retirement, while legacy socket actions cannot synchronously wait on their own drain. Fixture teardown respects the real single-party admission cap. Full-game tests retain authoritative winner, scoring, tie and reveal assertions.

Final verification:

- `npm test`: 1,236 discovered, 1,225 passed, 11 skipped, zero failed. Seven opt-in HTTP checks were then executed with the local app and real party Worker: all seven pass. Four default skips cover retired flows.
- Selected browser scenarios: 29 unique scenarios pass across focused runs. Includes eight complete matches; six-pack host/four-phone/mirror socket transitions; removal/reset; phone/photo flows; controlled offline response races; serial HTTP polling; and real lease cleanup. This is not a run of every browser file.
- Build, typecheck, ten production-render checks and `git diff --check` pass. Lint: zero errors/eight existing image warnings. Independent read-only review covered privacy, migration, admission, QA isolation and recovery changes; follow-ups were addressed.
- Synthetic loopback phone action → host snapshot: samples 944/474/500/518/505ms, median505ms. Headless host animation callback cadence:120 samples, median16.7ms/p95 16.8ms. These do not measure GPU work, physical phones, TVs, Wi-Fi, internet latency or capacity, and do not establish a before/after speedup.

Commands: `npm run qa:local -- --api`, `npm run qa:local -- --browser <files/filters>`, `npm run qa:local -- --benchmark`. The launcher strips paid credentials, disables paid images, uses disposable storage, validates loopback addresses and stops only its own processes. Failed startup scratch was removed; tracked screenshots overwritten by tests were preserved with review evidence and restored to baseline.

Detailed command logs/reproductions/screenshots: `C:/Users/Danny's Ultimate PC/Documents/ChatGPT/Jackbox Game Creation/.logs/review-2026-11-02/`.

Release limits: source changes and migration remain local; published archives are not automatically repaired. Already-open old Frame-Up clients should refresh after a future rollout. The optional npm advisory lookup remains unperformed because automatic approval review rejected sending package metadata to npm; no workaround was attempted. Physical-device, human enjoyment and live provider checks remain unverified.
