# Task 6 report — host/phone integration (partial; awaiting authorization)

## Completed in this worktree

- Added standalone responsive Arcade host, phone controller, and spectator presentation components plus Arcade styles. The host surface provides lobby, active-game, pause/resume, score, and results/Play again states; the phone control pad uses pointer events with touch action disabled for reliable dragging. Rendering consumes server snapshots only; the canvas does not simulate physics or score.
- Added server-signed `spectator` ticket claims. The authenticated ticket route now issues controller tickets only to the two match seats and read-only spectator tickets to other active, non-bot room players. The Worker already rejects all non-controller/player input; spectator connection messages still receive the public snapshot.
- Added deterministic per-match seat rotation in stable room seat order. Match 1 keeps the first two eligible human players; later matches rotate the pair by match number. The ticket route uses the same assignment calculation as the controller roster.
- Added a signed Worker `lobby` control contract for D1 Play again and fixed Worker start after lobby return to adopt the new committed match ID. The Site-side D1 transition, binding retention, and forwarding are still pending the approved transport integration.
- Added regression coverage for spectator public snapshots/input rejection, match seat rotation, and lobby-return/new-match control ordering.

## Authorization gate

The parent agent relayed that the user explicitly approved both the short-lived first-frame Worker ticket handshake and signed D1-confirmed control traffic to `ARCADE_WORKER_URL`. On resuming, automatic approval review still rejected adding `useArcadeSocket.ts`, stating that the user had not specifically authorized the ticket/session egress to that destination. The policy rejection explicitly prohibits implementing the same egress through an alternate route or helper, so this task stopped at the gate. It did not add Site host-action forwarding or wire the new components into the live host/player pages. The menu still leaves games `in-development`.

## Verification

- `node --import tsx --test tests/arcade-auth.test.ts tests/arcade-room.test.ts` — 28/28 passed.
- `npm run typecheck -- --incremental false` — passed.
- `git diff --check` — passed (Git printed only existing line-ending conversion notices).
- Required Site+Worker browser scenarios at 1366×768 and 390×844 were not run: host/player surfaces are not wired and authenticated Worker ticket/socket traffic remains rejected by automatic approval review despite the parent's notice of user approval.

## Remaining Task 6 work

- After the review gate recognizes the user's approval: implement the D1-first, idempotent signed control forwarding path; reconnecting socket hook with fresh first-frame ticket and bounded backoff; integrate host and phone components into room pages; add Arcade browser checks for desktop/phone/spectator/reconnect/results; then re-run the task's focused browser, typecheck, and diff gates.
- No production Site or Worker deployment was performed.
