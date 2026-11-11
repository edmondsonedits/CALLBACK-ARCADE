# Task 3 implementation report

Added Arcade as a distinct King Prompter room mode. Room creation requires a catalog ID with `playable` status; all catalog entries are currently `in-development`, so the Arcade setup remains unavailable until a game passes its readiness gate. Ordinary room defaults and existing setup behavior remain supported.

Arcade rooms persist the selected game and current match through versioned room serialization. Their round plan is empty, and their lifecycle uses `LOBBY`, `ARCADE_ACTIVE`, and `ARCADE_RESULTS`. Host start is handled by the existing authenticated host-action route, requires two active players, and writes an `arcade_matches` record in the same D1 compare-and-swap batch. Arcade goal/result events use their own `arcade_score_events` table and event keys; they never enter creative score events or Room Lore. Final result callbacks transition the room and match to results in D1. Role snapshots hide result payloads until `ARCADE_RESULTS`.

Drizzle schema, migration `0005_arcade.sql`, and runtime bootstrap DDL define the same two Arcade tables and indexes. Legacy serialized creative rooms default their Arcade fields to null. The catalog status annotation preserves all 19 games and their current `in-development` values while allowing readiness checks to typecheck; the neutral soundtrack mapping preserves all existing mappings. The working tree also contains separate user-owned Party Guide changes needed for its exhaustive `GameLength` map; those changes are excluded from this Task 3 commit.

The follow-up race fix makes final-result handling compare-and-swap the room first, then gates event inserts and match completion on that exact results version. Conflicting event-key replays are checked against the complete stored event, including result type and payload; an exact saved result remains safe to retry. The runtime bootstrap now declares the same unique match-number index as Drizzle and migration `0005_arcade.sql`.

A further concurrency review found that goal-only inserts were gated by match existence alone. They now also require the room's observed version and `ARCADE_ACTIVE` phase plus an `ACTIVE` match. If the request loses that race, persistence is confirmed and the callback returns `ROOM_CHANGED` rather than success. A regression uses in-memory SQLite to complete the match between the goal callback's read and guarded insert, and verifies the late goal is absent.

## Verification

- Test-first check: `node --import tsx --test tests/arcade-room.test.ts` initially failed because `server/arcade/room` was not implemented. A separate pause/resume regression failed with `CANNOT_PAUSE` before its Arcade timer-free handling was added.
- `node --import tsx --test tests/arcade-room.test.ts tests/game.test.ts`: pass, 49 passed and 4 intentional skips.
- After the race fix, `node --import tsx --test tests/arcade-room.test.ts tests/game.test.ts`: pass, 52 passed and 4 intentional skips. The Arcade file alone passes 10 tests, including stale-version CAS, conflicting result-key, and exact callback-retry cases.
- After the stale-goal guard, `node --import tsx --test tests/arcade-room.test.ts tests/game.test.ts`: pass, 53 passed and 4 intentional skips. The Arcade file passes 11 tests, including the SQLite-backed late-goal race regression.
- `npm run typecheck -- --incremental false`: pass after the stale-goal fix.
- `git diff --check`: pass after the stale-goal fix; Git emitted line-ending conversion warnings for existing CRLF/LF working-copy files.
- `node --import tsx --test tests/api.integration.test.ts`: command exited successfully, but all 3 tests were skipped because `CALLBACK_TEST_BASE_URL` was unset. Host-cookie and playable-catalog API checks therefore need the configured local D1 integration environment for runtime verification.
- `npm run typecheck -- --incremental false`: pass. Plain `npm run typecheck` reported `EPERM` only while writing `tsconfig.tsbuildinfo` in the managed worktree; disabling incremental output avoids the sandbox write.
- `git diff --check`: pass; Git emitted line-ending conversion warnings for existing CRLF/LF working-copy files.

## Commit

Original implementation commit SHA: `24570db` (`Add authoritative Arcade room lifecycle`). Race-fix commit SHA: `fe808f2` (`Make Arcade result persistence race-safe`). Stale-goal fix commit SHA: `7b5963d` (`Guard stale Arcade goal events`). This SHA update is recorded in a separate documentation-only commit because a commit cannot contain its own final SHA.
