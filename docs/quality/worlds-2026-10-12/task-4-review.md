# Task 4 — independent spec and quality review

Reviewed 2026-10-12 against `docs/superpowers/specs/2026-10-12-arcade-worlds-design.md` and the task-4 brief. Review range: `b931c94..2728cc3`; implementation `81b108a`. Active source SHA-256 independently confirmed as `ec9125ec7813812c4129202fdb4aaa90ffb65d5ca542670fdb2866a76a72fe75`.

**Spec verdict: NEEDS WORK.** The expansion substantially implements the binding requirements, but replay applies obsolete player cosmetics and leaves the visible character inconsistent with the current saved settings. See F1.

**Task-quality verdict: NEEDS WORK.** Fix F1 and the small public snapshot correctness issue F2, then retain the parent-owned browser acceptance gate. No broad physics rewrite is indicated. No numerical quality rating or hardware acceptance is claimed.

## Findings

### F1 — P2: Replay restores captured cosmetics while displaying current preferences

Path: `games/royal-twisted/source/index.html`, lines 316–320, with captured data assembled at line 561 and style applied at line 562.

`capturedRun` contains the whole normalized preference object. `replayRun()` spreads it over current preferences before `restartMatch()`, which applies the old name, color and headwear. It subsequently restores current preferences without applying their style again. A player who customizes during a run sees their old character/name after Replay despite the settings still showing their newer choices. Captured replay rules should govern gameplay rules and seed; current cosmetic/access preferences must remain coherent with the rendered character and settings.

Reproduced on the exact reviewed source using the existing runtime harness and actual UI handlers:

1. Set `#playerName` to `Original`, fire its blur handler, and start/restart a run.
2. Change the name to `Current` through its blur handler and set `#helmetStyle` to `plain` through its change handler.
3. Invoke the actual `#rematchBtn` click handler.
4. Saved preferences and native field values remain `{name: 'Current', helmet: 'plain'}`, but `getSession().standings[0].name` is `Original`; instrumenting the existing `applyPlayerStyle` call records `{name: 'Original', helmet: 'crown'}`.

Expected: Replay restores captured gameplay rules/seed while keeping the current immediate player style. A narrowly scoped regression should use these UI handlers and verify both preferences and the applied style.

### F2 — P3: Public contestant-count API produces an incorrect current rules snapshot

Path: `games/royal-twisted/source/index.html`, lines 557–561 and 927 (`setPlayerCount`).

`restartMatch()` captures `matchRules` before normalizing the contestant-count and rhythm controls. The preserved `RoyalTwisted.setPlayerCount` API updates its control and then restarts, so the actual new match has ten contestants while the additive readonly session reports four in `rules.players`.

Exact reproduction with `const r=runtime(); r.game.RoyalTwisted.setPlayerCount(10)`:

```text
returned: 10
getPlayerCount(): 10
getSession().rules.players: 4
getSession().standings.length: 10
```

Expected: publish the final normalized active rules, after control/API overrides are resolved. This does not remove contestants or break the 2–10 simulation capacity, but the advertised current rules snapshot is incorrect for existing API clients.

## Review coverage and evidence

- Read the brief, worker report, review diff, binding spec, repository instructions, prior Twisted benchmark report, implementation, new tests, runtime harness and source-bound evidence. Reviewed the new demo/session and rule paths directly.
- Existing engine, fixed timestep, original collision authority, conservative rod arrival enforcement, jump buffer, independent duck sources, imperfect bot plans, seven-hit elimination and camera/public API structure are retained. Nonclassic mechanics use existing actions: Ember changes rod sequences, Frost supplies controllable braking/refill/recovery, and Storm warns then defers gusts around unresolved rod conflicts. No new unavoidable-damage path was identified in this source review.
- Demo uses the real simulation, all-bot ownership, a separate RNG stream, guarded public action hooks and gamepad polling, and explicit sound/haptics/record guards. Fresh starts reset round/input/statistics and use the chosen real seed. Finite Practice/Tour stages and actual-clear aggregate scoring are implemented. Scoped best keys include map/mode/rules.
- Read the worker's exact-source evidence of 123 focused and 479 root checks; did not rerun those identical suites. Independent executions were narrowly targeted concern reproductions and integrity checks.
- Confirmed the normal Customize → change difficulty/count → close flow yields the selected hard/ten-seat demo. The hidden legacy `setup*` controls are mirrors, not additional user-facing selectors; directly changing those hidden controls is not a review finding.
- Inspected async asset promise caching, generation rejection, bounded scenery attachments and disposal paths. Independently verified recorded hashes for all three GLBs, their colormap, and both local Three addons. The supplied texture closure and complete local CC0/MIT notices are present. Performance mode disables shadows, limits DPR and hides scenery/filter work; FPS accumulation uses unclamped wall time.
- `git diff --name-only b931c94..2728cc3 -- games/royal-sumo games/royal-twisted/source/original games/royal-twisted/source/archive` produced no changes. Root workflow/browser harness/status changes in the review range are parent-owned integration, not worker scope violations.
- No code edits, commits, push, deployment or delegation were performed by this review. This report is the only review artifact added.

## Cannot verify here

Parent-owned ordinary Chromium/native UI screenshots and checks were queued independently and were not rerun or claimed as passed in this review. Representative rendered scene quality, native settings/results scrolling at 390×844 and 844×390, ten-seat world/control occlusion, actual GPU/resource behavior, audible sound quality, physical touch/gamepads and subjective feel remain unverified by this review. CPU construction and source inspection do not establish those outcomes. The evidence's existing browser/hardware caveats are appropriately explicit.
