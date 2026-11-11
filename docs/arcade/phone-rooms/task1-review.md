# Task 1 backend review

Reviewed the Task 1 brief, implementation report, supplied diff, production mailbox SQL, contracts, schema/migration/runtime DDL, route handler, shared HTTP helpers, and focused tests. Scope is backend contracts only; the phone/TV frontend is not implemented yet.

**Spec compliance: request changes. Code quality: request changes.** One important ownership issue remains. No critical findings. The remaining reviewed contracts are consistent with the brief.

## Important finding

### Reused room codes allow already-authenticated requests to act on a different room

Locations: `server/arcade-phone/service.ts:90–108`, `:106–112`, `:136–153`; code reuse becomes possible through cleanup at `:78–85`.

Authentication checks a room/seat before awaiting the request body. Later SQL identifies the target only by its four-character code, or code plus seat. Closing a room and creating another with the same code between those steps lets the old authenticated request update the new room. Host requests can overwrite status/private states, acknowledge/delete its pending inputs, and read its roster/input queue. A delayed close request can close it and delete its seats. An old phone input request can act as a new owner of the same seat because its insertion/sequence update does not check the seat token hash.

This violates credential ownership and close invalidation: the old credentials have no authority over the replacement room. Closed records are explicitly removed during creation, so code reuse is a supported production path rather than an impossible database state.

**Evidence:** a separate real-SQLite interleaving used production `createPhoneService`, paused an old authenticated host request at body reading, closed its room, installed a replacement room under the same code with a different host hash, and resumed the old request. It returned HTTP 200 and changed the replacement room's status to the old host's value while the replacement credential hash remained intact. This targeted probe did not rerun the existing suite. The replacement insert simulates the production cleanup/code-reuse path deterministically.

**Required fix:** bind every mutation and protected read to the authenticated room generation and credential, within the transaction. Use an immutable room identity/generation (also reflected in seat/input ownership), or equivalent hash-based predicates throughout. Phone mutations must also require the authenticated seat hash. Guard acknowledgement deletes, pause/stale deletes, and close cleanup as well as the initial room update; checking `results[0]` only after an unguarded batch still permits side effects. Add deterministic regressions for delayed host/close/input requests across close and code reuse. An old request must fail without changing or exposing the replacement room.

## Contracts that passed inspection

- Ten unique seats are allocated by one `INSERT SELECT`; the seat primary key and 0–9 check enforce uniqueness/capacity, and an eleventh join is refused. Existing credentials restore the same seat/name without releasing disconnected ownership.
- Per-seat sequence comparison, pending insertion, and sequence/liveness update share a transaction. The 64-event cap refuses overflow without advancing `lastSeq`; separate press/release packets retain sequence order.
- Host acknowledgement removes only `seq <= ack` inside the same transaction as the pending read. Unacknowledged events replay, and arrivals after that transaction remain pending. Frontend deduplication remains required.
- Authenticated phone snapshots select only their own private state. Host responses omit the private-state map. Normal snapshots expose no hashes or tokens; separate Secure/HttpOnly/SameSite=Strict cookies use the room API path.
- Input expiry and roster flags implement the 500 ms / 3 s thresholds; phone snapshots force pause after 8 s without host heartbeat. Paused/inactive host updates purge commands. Actual held-control neutralization/bots belong to the subsequent frontend task.
- Canonical games, bounded strict schemas, six-hour expiry, isolated 96 KiB host reader / 8 KiB per-seat states, other-route shared 12 KB limit, same-origin POST checks, and unknown method/route rejection are present.
- Mailbox tables are isolated in Drizzle schema, migration, and runtime DDL. No party-room authority, table, or score behavior was changed by the reviewed diff.

## Verification limits

The implementation report records 14 passing real-SQLite tests, scoped lint, and typecheck; those checks were not rerun. Review added only the ownership interleaving described above. No browser, physical-phone, deployed D1, or frontend-quality claims are made. Re-review the ownership fix before considering Task 1 complete.

## Ownership fix re-review — `61797f2`

**Finding verdict: ADDRESSED.** No new important or critical breakage found in the fix. The initial request-changes verdict above is historical; this fix resolves its sole important finding.

Reviewed `/tmp/callback-task1-fix1.diff`, the changed service, seven added regressions, and the appended implementation evidence. Re-review is limited to this ownership fix; no broad review or test repetition was performed.

The live room's random host hash is now a generation discriminator. Host updates, acknowledgements, pause/stale deletes, and roster/input reads all require that same hash in SQL (`server/arcade-phone/service.ts:111–117`). Every close statement is generation guarded, and deletion precedes hash invalidation inside one transaction (`:100–105`), so a failed guard cannot delete replacement data. Phone lookup and reconnect/poll/input operations check the room generation; authenticated phone writes additionally check the seat token hash (`:126–145`, `:153–163`). Join allocation and its follow-up reads cannot cross into a reused code's replacement generation (`:134–139`). Internal seat hashes remain excluded from the explicit response fields.

The added regressions cover delayed host acknowledgement, host pause, close, input, poll, and join across code reuse, plus seat-token replacement within the same generation. They check failed responses, absence of replacement data, and unchanged replacement tables, including a stale input that would reveal unguarded cleanup. The report records seven failures before the fix, 21/21 passing afterward, and passing scoped lint/typecheck. These targeted checks adequately address the reported race; deployed D1/frontend verification remains outside this re-review.

## Sites migration integration review — `1d80247`

**Spec compliance: approved. Code quality: approved.** No new important or critical findings in this fix range.

Reviewed the migration-fix brief, referenced Sites storage requirements, supplied diff, generated phone snapshot, journal change, and appended test evidence. The service change only removes its bootstrap import, WeakMap, `ensure()` function, and request-time call. Its public API and previously reviewed ownership predicates remain unchanged; the isolated phone service contains no schema DDL.

Migration `0006_arcade_phone.sql` contains only the three phone tables and their three indexes. Its primary keys, cascading room/seat/input foreign keys, closed/seat checks, defaults, and unique room/seat-token index match the phone schema and generated snapshot. The journal appends exactly one matching `0006_arcade_phone` entry. The commit changes no applied 0000–0005 SQL or snapshots and preserves all previous journal entries. Extra history/Arcade creation statements were correctly excluded because their SQL already exists in the prior migration files. Snapshot 0006 retains the generated full current schema and links to the latest available prior snapshot, 0004; it does not rewrite the absent 0005 snapshot.

Test fixtures now apply the real migration before constructing the service and reject CREATE/ALTER/DROP during requests. The added migration coverage checks clean/upgrade chains, retained legacy data and schemas, journal/snapshot/index/FK/check alignment, uniqueness, invalid values, and cascading deletion. The report records 22 passing backend tests, passing scoped lint/typecheck, and `db:generate` reporting no schema changes. Those reported checks were not rerun. Hosted migration application and live validation remain release responsibilities.

## Production D1 join fix review — `f0217ff`

**Spec compliance: approved. Code quality: approved.** No new important or critical findings in this small fix.

The ten-row `VALUES` CTE replaces only the compound UNION candidate list. Allocation remains one atomic `INSERT SELECT`, selects the lowest available seat from exactly 0–9, and retains the live room generation/expiry guard, existing bound parameters, primary-key uniqueness, full-room response, and protected result lookup. No API, migration, authentication, or reconnect contract changed.

The focused adapter regression rejects the specific ten-term UNION form that failed on deployed D1, while production SQL still executes against real SQLite. The report records the observed live error, a red run for the old form, 22/22 passing checks with the replacement (including concurrent ten-seat allocation and eleventh refusal), and passing scoped lint. No reported tests were rerun. This clears the scoped source review for publication; repeat deployed join verification remains necessary to establish live compatibility.
