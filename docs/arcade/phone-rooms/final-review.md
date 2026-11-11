# Final integration review — phone rooms

Reviewed original phone-feature branch `272adcd559b195755586554997f8c62808d1b7eb..f051261` (implementation through `62b9178`, provenance `6d004a0`). Read the plan, ledger, task reports and scoped reviews, the core review package, relevant adapter changes against archived imports, and the shipping host/controller/backend and launch paths. The original review was followed by the scoped lifecycle and remote-v65 merge review recorded below.

**Current spec compliance: APPROVED. Current quality verdict: APPROVED.** The lifecycle fix and concurrent-v65 merge are approved within the scoped follow-up below. Both initial P2 findings are resolved; no important or critical finding remains. The initial findings are retained as historical evidence, not open blockers.

## Important findings

### 1. P2 — ending a room retains its phone ownership in the next room

Location: `public/arcade-games/phone/host.js:98–101`, with the same incomplete teardown at `:85–89` after terminal authentication/expiry errors. The adapter contract intentionally retains roster metadata across `stop()` so a later phone start can reconstruct its owners; for example, Sumo retains `phoneSeats` in `public/arcade-games/royal-sumo/index.html:6042–6062`.

`Room.close()` stops the adapter and clears only `Room.seats`; it never calls `adapter.release()` for the room's owners. The new room starts with an empty host-side map but shares the same adapter. Consequently players absent from the second room remain human-controlled ghosts, violating the requirement that empty seats become bots. The new host cannot sweep them because it never acquired those seats in its own map.

Confirmed using the production `Room` class and actual Sumo adapter/simulation through the existing harness:

1. First room receives connected seats 0 (`Old Zero`) and 9 (`Old Nine`) and starts.
2. Await its successful `close()`.
3. Construct the next room on the same adapter, receive only seat 0 (`New Zero`), and start.
4. Observed: new `Room.seats` is `[0]`, but simulation owners 0/9 are both `remote`; fighter 9 is still `Old Nine`; `phoneState(9)` remains non-null.

Smallest correction: finalize room ownership explicitly on successful close and terminal 401/404, releasing its adapter seats before clearing its map and stopping. Keep ordinary same-room pause/restart ownership intact. A centralized disposal helper is appropriate, with closed-state guards so an old callback cannot release a newer room's seats. An alternative new-room ownership reset must clear all ten adapter slots before assigning the new roster. Add a regression joining the actual `Room` and at least one real adapter across two rooms, plus coverage for terminal-error disposal.

### 2. P2 — an old room's delayed poll failure can stop a newly started room

Location: `public/arcade-games/phone/host.js:83–89`.

The successful response path checks `!this.closed`, but the catch path unconditionally mutates error state and calls `adapter.stop()` for 401/404. A host poll can still be pending when End room completes. If the user creates another room before that old poll rejects, the rejected request stops the shared adapter now running the new room.

Confirmed with the production `Room` and a recording adapter:

1. Begin old room `poll()` and defer its result.
2. Successfully close the old room.
3. Construct and start the new room on the same adapter.
4. Reject the old poll with status 404.
5. Observed calls are `['stop', 'start', 'stop']`; the new room remains `closed:false, started:true` while the adapter is stopped.

Smallest correction: ignore poll failures after that room has closed before changing adapter/UI state, matching the existing successful-response guard. Coordinate this with disposal above so late callbacks cannot release new ownership. Add deferred 404/401 regressions asserting that a closed room cannot stop or otherwise mutate its replacement.

## Integration assessment outside these findings

- Seven canonical game IDs align between catalog, script injection, backend schema, host creation, phone control mapping and adapter APIs. The catalog retains Royal Sumo 1.3.0, adds Blind Crown, exposes direct full-game links, and preserves bundled-game entries and the practice link.
- The D1 mailbox owns membership and authenticated per-seat routing; the TV owns the standalone simulation. No reviewed path submits those scores into existing party scoring. Credential hashes, room-generation guards, cookie scope, bounded JSON and own-seat snapshot selection agree with the approved backend review.
- Host `status`, `privateStates` and acknowledgements match the backend contracts. Ordered events are applied before acknowledgement; the recent conservative response-age fix prevents old packet revival. Adapter actions and ten-seat start/restart behavior have approved actual-engine tests. Private Blind payloads remain own-plan/public-geometry only, and the shared host transmits those as individually filtered states.
- The original phone-only migration is consistent with the approved migration review and avoids request-time DDL. Because remote v65 now has an already-applied migration 0006, the parent's proposed 0007 reconciliation is a new release delta and is not certified by this original-branch review.
- The live smoke script checks assets, capacity, accepted packet delivery, private routing, reconnect and close rather than accepting HTTP input acknowledgements alone. Actual deployment and live HTTP results remain parent-owned gates.

## Evidence and limits

Ran only the two deterministic counterexamples above. The first executes the actual Sumo simulation plus the shipping host class; the second isolates the asynchronous room lifecycle with a recording adapter. Both probes completed successfully and demonstrated the reported defective states. No production implementation or test files were changed by this review.

Accepted recorded release evidence without repeating it: 690 tests passed, 7 existing skips, no failures; lint/typecheck/official production build and six Worker SSR checks passed on the release baseline. The subsequent UI-only correction has 26 focused passes and seven independent affected checks. These results do not cover the two new counterexamples or the concurrent v65 merge.

Intentional limitations are not additional blockers: the TV is trusted, polling latency varies, packets can expire after 500 ms, and displayed request round-trip delay is not end-to-end input latency. Managed Sites browser control is unavailable; no browser/preview workaround was attempted. This review does not certify mobile rendering, multitouch, QR scanning, physical-phone feel, competitive rhythm precision or an AAA/9-of-10 quality rating.

Resolve both findings and review the targeted fixes and final merge delta before publication. No finding above is parked as an unresolved accepted limitation.


## Final scoped re-review — lifecycle `afd54f0`, merge `ad94a88`, follow-up `8af86ff`

**Lifecycle verdict: APPROVED. Merge-boundary verdict: APPROVED. Final spec and quality verdict: APPROVED.** This supersedes the initial changes-required recommendation above. Both P2 findings are resolved, and there are no parked or unresolved findings from this review. Parent-owned final build/provenance/deployment and live HTTP gates remain release work, not evidence of browser/device validation.

### Lifecycle corrections

`Room.dispose()` marks the old room closed before clearing/releasing every owned adapter seat, empties its own roster/map, and stops the adapter once. Successful close and terminal 401/404 use that same disposal path. Same-room restart ownership remains intact. Closed `receive()`, `sweep()` and poll-error paths are inert; a delayed old-room rejection cannot stop or release a newly created room. Inspection found no additional lifecycle defect introduced by these targeted changes.

Independent verification ran only the new affected checks:

`node --import tsx --test --test-name-pattern='actual Sumo adapter keeps|terminal401/404 disposal|closed room ignores delayed401/404' tests/phone-ui.test.ts`

Result: **3 passed, 0 failed, 0 skipped**, exit 0. These execute the actual Sumo adapter across two rooms, terminal 401 and 404 disposal, and deferred old-room 401/404 failures after replacement start. They also assert same-room restart ownership and repeated-disposal inertness. The parent separately reports 29/29 UI checks passing.

### Concurrent v65 integration boundaries

Read `merge-report.md`, the selected merge diff, current catalog/launch/build changes, and the follow-up tests/harness paths. This review preserves the already-live v65 online service as a boundary; it does not reopen its internal simulation/security design or re-review imported worlds/vendors.

- `OnlineGameView`, `OnlineSetup` and the online catalog use the dedicated v65 `lib/arcade/online/full-games.ts`. Its six legacy map sets point to sibling `online-v65.html` files. The featured catalog still points to the latest seven phone-ready `index.html` files. Both join flows are linked, and the existing online routes and bundled-game launches remain available.
- `build-imported-online.mjs` reads/writes the preserved matching v65 views. Its extraction no longer risks reading or overwriting the newer phone-world entries. The Sumo server build remains based on its existing 1.3.0 source boundary. Restored older harnesses and online Sumo/integration tests now read the corresponding preserved views; newer phone-world harnesses remain separate.
- Independent byte comparisons confirmed all six preserved `online-v65.html` files exactly equal their corresponding entries at remote `9a18b641611f7bc32cbce3cab9fc014b87e4b7f6`. All seven featured phone `index.html` files exactly equal the approved `f051261` entries.
- Independent byte comparisons confirmed applied migration SQL 0000–0006 and the remote 0006 snapshot are unchanged. Existing journal entries exactly equal remote v65; only `0007_arcade_phone` is appended. Snapshot 0007 links to snapshot 0006, preserves every old table definition, and adds only the three `arcade_phone_*` tables. Reviewed 0007 DDL retains the approved checks, keys, indexes and cascading foreign keys. The backend tests now apply the full 0000–0007 chain and retain legacy-schema/data assertions.

Accepted parent-reported merged verification without duplicating broad suites: initial merged run had 763 passes, seven existing skips and five moved-view/migration-reference failures; all five were addressed by the focused follow-up (24 online integration/imported/Sumo passes). Phone backend/catalog checks pass 27/27; typecheck and lint pass. Inspection of the test changes confirms corrected source/migration references rather than weakened behavioral assertions. The parent owns the final schema-generation no-change result and production build/deployment evidence.

No implementation edits, subagents, full-suite repeat, browser installation, preview workaround or publication occurred in this review. The intentional trust/latency constraints and unavailable physical-phone/browser QA stated above still apply.
