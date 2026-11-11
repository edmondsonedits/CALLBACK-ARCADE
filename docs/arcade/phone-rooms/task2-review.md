# Task 2 review — seven phone adapters

Spec-compliance verdict: **NEEDS CHANGES**.

Code-quality verdict: **NEEDS CHANGES**. The adapters use the real gameplay hooks and generally preserve the existing engines, but three important lifecycle/settings gaps remain. No critical findings.

## Important findings

### 1. P2 — Sumo and Roller retain remote ownership after `stop()`

Locations: `public/arcade-games/royal-sumo/index.html:6054–6060`; `public/arcade-games/royal-roller-ruckus/index.html:1148`, with native roster reconstruction at `:537–540`.

Both stop implementations neutralize input and leave phone mode, but retain ownership in the underlying native roster. This breaks the requirement to return safely to offline play.

Confirmed counterexamples using the shipping closures through existing harnesses:

- Sumo: assign seats 0/9, start, stop, then `RoyalSumo.scenario({fighters:10,players:1})`. Seat 0 becomes local but seat 9 remains remote instead of a bot. `CallbackPhoneGame.input(9,{seq:1,x:1,y:0,buttons:0})` still returns `true`: this input method also lacks a `phoneActive` guard.
- Roller: assign seats 0/9, start, send a recent movement packet to seat 0, stop, set native racer count to 2 and reset the race. The race still creates 10 racers because seat 9 remains connected; seat 0's sampled input source is `network`, and seat 9 remains human-controlled. Neutralizing axes does not disconnect the network roster.

Restore native ownership/disconnect the underlying remote slots on stop while retaining any roster metadata needed for a later phone start. Reject phone input outside phone mode. Add focused stop → offline start regressions.

### 2. P2 — Ballistix native settings/help pauses do not clear phone controls

Locations: `public/arcade-games/royal-ballistix/index.html:474`, `:477`; compare adapter clearing at `:503`, `:507`.

`openSettings()` and `showHelp()` set `G.paused=true` but only call `neutralizeLocal()`. That deliberately leaves externally controlled players untouched. Unlike `pauseToggle()` and the adapter's `pause()`, these native pause paths do not call `phoneClear()`.

Confirmed counterexample: start with phone seat 0, enter fight, send `{seq:1,x:1,y:0,buttons:1}`, then open settings. Status reports paused but seat 0 still has `mag=true`. Close settings and use the native resume button: Magnet remains active and the next paddle step moves seat 0 (`pos=0.3495742269648537`) without a fresh phone packet.

Make every native pause entry clear phone axes/actions and edge state without consuming sequence numbers. Cover settings/help → resume with held movement/Magnet.

### 3. P2 — Roller and Space native settings overwrite assigned seat 0 names

Locations: `public/arcade-games/royal-roller-ruckus/index.html:1151` and callers `:1131–1132`; `public/arcade-games/space-bash/index.html:723`, `:754`.

The native style/preferences paths still assign the local preference name to the live seat 0, ignoring phone ownership. This violates assigned-name preservation and makes TV standings disagree with the phone payload.

Confirmed counterexamples:

- Roller: assign seat 0 as `Zero`, start, call the native `applyPlayerStyle()` used by name/cosmetic settings. Live racer name changes from `Zero` to `YOU`.
- Space: assign seat 0 as `Zero`, start, invoke native volume `onchange`. Live fighter name becomes `YOU`, while `phoneState(0).name` remains `Zero`. Any setting routed through `changeSetting()` has the same unconditional overwrite; direct player-name handlers also overwrite it.

Keep assigned names authoritative during phone mode across all native preference/style handlers. Add focused cosmetic/volume/name-setting regressions.

## Reviewed behavior and evidence

- All seven adapters expose the requested contract. Action mappings reach actual movement, Bash/Dash, Magnet/Pulse, four Scratch lane hits, fall recovery, Jump/Duck, Grab/Throw/Kick/Jump, and Blind placement/aim/lock hooks.
- Static review supports seat 0/9 phone ownership, unused bot routing, release-to-bot behavior, short action edges, sequence-preserving neutral clears, and roster reconstruction for restart/count/Tour paths. The findings above identify the remaining exceptions.
- Blind phone state builds a detached own-plan/public-board payload; TV rendering/diagnostics use spectator filtering, and active phone/online session summaries suppress captured seeds. No hidden-plan or active-seed leakage was found in the reviewed paths.
- Roller has a stable world-axis camera basis, a top-down course/racer fit, and bounded radar track sampling. Browser/rendering QA remains unavailable as already documented.
- Accepted reported verification: 136 world regressions plus initial 14 adapter checks passed; final 27 focused/schema checks, typecheck, scoped lint and diff checks passed. These suites were **not rerun**. Review executed only the concrete counterexample probes described above.
- Shared host/phone UI is outside Task 2 and was not treated as a missing implementation.

Recommendation: fix the three groups above, then run focused regressions and a scoped re-review before the Task 3 integration gate.

## Scoped fix re-review — commit `2186441`

Current spec-compliance verdict: **APPROVED**.

Current code-quality verdict: **APPROVED**. All three important finding groups above are resolved. No remaining important/critical findings or regressions were found in the scoped fix review.

- Sumo now rejects input outside phone mode and restores native local/bot ownership on stop. Roller disconnects all underlying network seats before returning to setup. Both retain roster metadata and reconstruct phone owners/names on the next phone start.
- Ballistix clears phone controls through the native neutralization path used by settings/help, so native resume cannot revive held axes/Magnet. Sequence tracking remains intact, and a fresh press is accepted. Checked adjacent pause/menu/round/reset/blur callers for changes introduced by this shared fix; no blocker found.
- Roller style handlers and Space preference/direct-name handlers preserve assigned seat 0 names during phone mode while allowing native preference edits for subsequent offline play.

Verification: ran only the six new regression tests with `node --test --test-name-pattern='Sumo stop hands|Roller stop disconnects|Ballistix native (settings|help) pause|Roller native name|Space native volume' tests/phone-worlds/phone-adapters.test.mjs`: **6 passed, 0 failed**. Reviewed `/tmp/callback-task2-fix-review.diff` and the appended fix report. Accepted the implementer's reported 33/33 runtime/schema checks and scoped lint/diff checks; no broad world suite was rerun.

Task 2 passes the scoped integration gate. Shared UI and browser/rendering release verification remain outside this review.
