# Task 3 independent spec and quality review

Reviewed package `2186441..e56f574` against `task3-brief.md`, `task3-report.md`, and the Task 1/2 API and action contracts. Scope: shared TV host, phone controller, HTML/CSS, seven minimal script injections, and focused VM/DOM tests. Existing backend and adapter implementation reviews remain separate.

**Verdict: CHANGES REQUIRED.** Most requested functionality is present and the scope is controlled, but two reproducible input-neutralization defects block acceptance. No credential exposure or hidden-opponent rendering issue was found in the reviewed client paths.

## Important findings

### 1. P2 — queued actions replay after the phone is hidden and controls are released

Location: `public/arcade-games/phone/controller.js`, `Session.neutral()` (line 77), `Session.receive()` (lines 38–49), and the visibility-change handler near the end of `mount()`.

`neutral()` resets the live controls but appends a neutral packet behind the existing queue. When an input is already in flight, hiding the phone sets `suspended` before those queued packets can drain. Returning to the page and receiving an active snapshot re-enables input without invalidating the old queued presses. They are then sent as new actions despite having been released while the phone was away. The host's 500ms mailbox expiry cannot protect against these packets because they only reach the server after returning.

Targeted counterexample, executing the production controller in Node VM:

1. Enable a Space Bash session; start sending an axis packet (`seq:1`) and hold its response.
2. Press Jump, queuing `seq:2, buttons:4`.
3. Call the mounted visibility handler's neutralization sequence: `neutral(); suspended=true`.
4. Complete the first input response, advance the clock by two seconds, restore visibility, and poll an active snapshot with `lastSeq:1`.
5. Drain the queue.

Observed input packets: `[{seq:1,x:0.5,buttons:0},{seq:2,x:0.5,buttons:4},{seq:3,x:0,buttons:0}]`. The Jump and previous movement replay two seconds after release.

Required correction: make blur/hidden cancellation invalidate unsent pre-cancellation actions while preserving sequence reconciliation for an already in-flight packet and sending a neutral state when possible. Normal short press/release ordering must remain intact while the controller stays active. Add a focused regression with an in-flight input, queued press, hidden interval, and visible reconnect; assert that the old press is never sent.

### 2. P2 — delayed successful host responses revive inputs older than the safety window

Location: `public/arcade-games/phone/host.js`, `Room.receive()` (lines 61–65) and `Room.poll()` (lines 70–81).

Event age is calculated solely as `data.serverNow - event.receivedAt`. Both values describe the server snapshot; elapsed time while that response is in transit is omitted. `member.inputAt = now - age` consequently makes a delayed packet fresh at its arrival on the TV. The 2.5-second HTTP timeout still permits responses well beyond the 500ms input window. A held action can therefore arrive late and remain held for another 500ms.

Targeted counterexample, executing the production host in Node VM:

1. Start an active `Room.poll()` at local time 1000 and defer its response.
2. Advance local time to 3000.
3. Resolve the response with `serverNow:1000`, a connected/non-stale seat, and its held input received at server time 1000.

Observed calls: `[['input',0,1]]`; stored member state: `{inputAt:3000,cleared:false,seenAt:3000}`. The two-second-old packet is applied instead of discarded/neutralized.

Required correction: account for response/request elapsed time when deciding whether received controls are safe to apply, without assuming synchronized client/server clocks or inventing an input sequence. Ensure that a delayed success cannot refresh stale held controls. Add a focused deferred-response regression asserting no adapter input for an over-window packet and appropriate clear behavior for an already-held seat.

## Spec compliance outside these findings

- Seven game pages each receive only the requested classic deferred host script with the matching game ID. No game physics, backend, or catalog changes are introduced by these injections.
- TV room creation, local QR, ten-seat roster, explicit Start, native pause following, collapse/reopen, End, and code-only optional session restoration are implemented. Host polls do not routinely restart the adapter.
- Normal active-controller edges remain distinct and ordered; accepted-but-lost response recovery uses authenticated `lastSeq`. Host acknowledgements follow successful handling and deduplicate replay. The ordinary watchdog uses `adapter.clear()` without consuming a sequence and releases disconnected seats.
- Pause, inactive/missing-host, eliminated/finished, seat-zero restoration, continued polling for later phases, and bounded loop failures have focused test coverage. The two transition defects above are absent from that coverage.
- Controls match the seven action contracts, including Roller Recover and the Scratch rune palette. Roller draws own radar state; Blind renders board geometry and own optimistic plan only, with `appliedSeq` reconciliation.
- Host event capture is scoped to `.cp-host` targets. The relevant real game handlers and deferred initialization order were inspected; no additional input-isolation defect was identified. Controller names/identity and roster names use `textContent`.
- Imported CSS selectors and variables are scoped to the phone widgets; local fonts, safe areas, responsive bounds, large touch targets, and reduced-motion rules are present.

## Review evidence and limits

Inspected the reported 22-test production-script VM/DOM suite and its boundary harness. Ran only the two additional deterministic counterexamples above; both exited successfully while printing the defective behavior. Did not repeat the full suite or modify implementation/tests. No browser, installation, preview workaround, publish, or live-device operation was attempted.

The existing DOM simulation does not prove native dialog behavior, mobile layout, pointer capture, multitouch, QR scanning, iframe focus, or physical-phone feel. Those already-disclosed limitations remain; they are not additional findings. Acceptance requires the two scoped corrections and their affected regression checks before the parent refreshes release artifacts.

## Fix re-review — commit `62b9178`

**Spec verdict: PASS for the reviewed Task 3 scope. Quality verdict: ACCEPT.** This supersedes the initial CHANGES REQUIRED verdict. Both P2 findings above are resolved; no remaining blocker was identified in the scoped correction review.

Finding 1: cancellation now discards abandoned queued actions and resets held sources, while an already in-flight request retains its own packet/sequence for completion or `lastSeq` reconciliation. A newer neutral packet replaces the abandoned queue when input is available. Visible reconnect preserves that neutral packet. The mounted regression reproduces the original delayed Jump scenario and confirms that only the first axis packet and newer neutral packet reach the mailbox. The additional blur regression covers both lost success and unaccepted failure, with no retry of the cancelled packet and successful later fresh input. Ordinary active press/release ordering and same-sequence retry behavior remain intact.

Finding 2: host polling now passes nonnegative local request duration into packet-age handling. Adding that conservative duration to server-relative snapshot age avoids assuming synchronized clocks. Over-window responses do not apply or acknowledge their packets; an already-held seat is cleared without changing its acknowledgement. Under-window packets retain only the remaining freshness budget. The added regressions cover both newly assigned and already-held seats, and independently offset client/server clocks. Discarding some inputs conservatively on slow requests is consistent with the brief's stale-input protection and disclosed variable latency.

Inspected `/tmp/callback-task3-fix-review.diff` and the appended fix report. Independent focused verification:

`node --import tsx --test --test-name-pattern='mounted hidden cancellation|blur cancellation|delayed host success|host under-window|phone queue preserves short press|accepted-but-lost response|unaccepted input retries same sequence' tests/phone-ui.test.ts`

Result: **7 passed, 0 failed, 0 skipped**, exit 0. This covers all four new regressions plus the three affected ordering/recovery tests. The implementer separately reports 26/26 focused UI tests and scoped lint passing; this re-review did not repeat those broader checks. No implementation/test edits, full suite, unrelated review expansion, browser/preview workaround, or publish occurred. Parent-owned release-artifact refresh and the previously disclosed browser/device limitations remain unchanged.

## Production timing re-review — commit `ee0edf6`

**Spec verdict against the updated timing rule: PASS. Quality verdict: ACCEPT.** The parent's product ruling supersedes the earlier 500ms delivery window: delivery now permits a conservative total age up to 1500ms, and held controls clear 500ms after the last successfully applied TV arrival. No blocker was found in this scoped change.

The backend contract constant controls mailbox expiry and roster transport-stale flags at 1500ms. The host independently enforces that delivery budget using server-relative age plus nonnegative local request duration, then records acceptance time for its separate 500ms hold watchdog. Ignoring the mailbox stale flag for local holds prevents recently delivered valid input from being cleared immediately. The existing two-second response counterexample remains rejected without advancing acknowledgement. Pause/inactive filtering, successful-application acknowledgements, sequence deduplication, 3-second seat release, and 8-second host timeout are unchanged.

Independent verification ran seven targeted timing, ordering, sequence, and native-pause tests from `tests/arcade-phone.test.ts` and `tests/phone-ui.test.ts`: **7 passed, 0 failed, 0 skipped**, exit 0. Checks cover ordered press/release after 750ms; backend retention through 1500ms and expiry at 1501ms; two-second rejection; offset-clock handling; delayed valid input retained through 500ms after arrival even with a stale roster flag; and transit-only/mixed ages totaling 1501ms rejected while old holds clear. Inspected the appended Task 3 report and the constant's existing cleanup/pause call sites; did not repeat the reported 53-test run or lint.

This acceptance covers the revised timing implementation, not a claim that production packet loss is solved. Delayed actions can still arrive noticeably late, conservative age estimation can discard borderline inputs, and live delivery verification remains parent-owned. No implementation edits, broader review/tests, browser workaround, or publishing occurred in this re-review.
