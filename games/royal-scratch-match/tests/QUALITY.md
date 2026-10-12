# Current v0.6.0 benchmark evidence (2026-10-12)

The current source is audited in `../../../docs/quality/sumo-benchmark/royal-scratch-match-report.md` with byte-bound evidence in `sumo-benchmark-evidence.json`. Focused production-runtime tests pass **47/47**: 29 previous timing tests plus 18 benchmark regressions. Standalone smoke parses the inline script and verifies the unchanged v0.5 archive. This is controlled Node/VM evidence, not browser pixels, audio-by-ear, physical touch/gamepad latency or measured FPS. Version/manifest finalization is included in v0.6.0; multiplayer remains not-integrated.

The evidence below describes the earlier quality branch and is retained as historical context. Its old source hashes/check counts do not attest the current runtime.

# Scratch Match quality evidence

Branch: `quality/royal-scratch-match`. Base: `785a15000abe11970c7b92c5f3cab197061fcedf` (fetched origin/main). Runtime entry: `games/royal-scratch-match/source/index.html`.

## Scope and behavior

The coordinating conversation approved the bounded brief, including hidden-page clock freezing and timed bot intents. No multiplayer service, victory-rule change, Sumo import, manifest/version update, shared-contract edit, push or deployment is included.

Before: inputs used the previous simulation sample; suspending audio could change the clock origin (97-second discontinuity in the controlled baseline probe); overdue DJ notes sounded together; eased notes visually lingered at the hit line; the response heading compared against the wrong label. After: input samples a monotonic clock, hidden time is subtracted, notes travel linearly through the timing line, and audio schedules/cancels separately. The original round-generation guard and cancellation are retained.

Timing windows remain perfect/good: easy 80/190 ms, normal 63/155 ms, hard 50/125 ms. Outside the good window inputs do not score; unresolved notes miss after the late window. Human chords score once after both independent lanes arrive; rating uses the larger error. Bots keep the same probability formula and 67% conditional perfect rate, realizing successful outcomes as legal timed lane actions against the intended note. Ordinary play stays random unless a seed is supplied.

## Automated evidence

Node v24.19.0, Linux container; DOM, Web Audio and time are controlled stubs. The real standalone script runs inside a VM. This is neither a browser frame-rate benchmark nor physical touch/audio validation.

- 48 boundary probes across three difficulties, early/late sides and 96/152 BPM pass at 1 microsecond inside/outside each cutoff, without a simulation tick before input. Deadline probes verify misses only after expiration and only once. Clock continuity and audio timestamp mapping error are below 1e-9 seconds in this synthetic harness; this does not establish hardware latency.
- Full rounds in 2/4/10 seats pass with default one-human ownership and with two preconfigured humans, including elimination/results and rematch. Ten interrupted restart cycles force every old callback; the new round remains active and final fanfare cannot repeat.
- Independent pointer chord, pointer-cancel capture/visual release, repeat-key rejection, phase guards, and CAM transform/save-code lane ownership pass in the harness. These are synthetic DOM events, not emulated or physical-phone browser tests.
- Seeded phrase and bot outcomes remain identical with extra cosmetic draw calls. `seed:null` restores Math.random.
- Hidden intervals, suspended audio, unlock, mute/unmute and restart retain clock position and cancel queued voices. Future cancelled notes may rearm; expired notes do not replay. DJ lookahead is 100 ms, dropping call audio more than 35 ms late; controlled 80/60 ms scheduling probes pass. The <=10 ms real audio and <=1-frame rendered alignment targets remain unverified.
- Linear note-center travel and hit-line arrival pass using recorded canvas calls. Geometry reserves 60 px above controls and 14 px below the topbar; the topbar explicitly allocates a fourth column for the existing CAM launcher. Landscape source math puts the line at roughly y=260 instead of y=308 at 844x390; portrait geometry keeps the line above controls at 390x844. These calculations do not prove actual pixels. Extreme user-saved CAM transforms may intentionally move the canvas outside the viewport; input ownership/timing remain independent of that transform.

Commands from the branch checkout:

```
node --test tests/royal-scratch-match-quality.test.mjs
node --test tests/standalone-game-lifecycle.test.mjs
node games/royal-scratch-match/tests/smoke.mjs
npm test
npm run typecheck
npm run catalog:check
npm run build
```

Passed: focused quality tests 29/29; protected lifecycle tests 15/15; repository suite 89/89; smoke, typecheck, catalog check and build dry-run. Build is Wrangler dry-run only. No live deployment.

## Source preservation and assets

The exact original attachment bytes were restored from import commit `02b4b16` to `source/archive/royal_scratch_match_v0.5_ten_player.html`. SHA-256 remains `6c58614db13495393512e9f69496da686dc2962b3cabd49d71680493170cbb03`. Smoke now protects this immutable archive while checking the current runtime's APIs, controls and offline dependency markers. Existing assets/notices are retained. Audio remains locally synthesized; no authored recordings or new external assets were imported.

## Blocked and not run

- Royal Sumo Library materialization: both the initial supported transfer and one consumer-local retry returned exactly `library file transfer failed: download failed` (exit 1). No readable ZIP bytes were produced. No Sumo pixel comparison was made; no alternate storage route was attempted.
- Chromium initial command failed with `Failed to create headless user data directory container.` A bounded attempt with a `/tmp` profile emitted `chrome_crashpad_handler: --database is required`, DBus/font-cache and read-only OOM-adjustment errors, then produced no screenshot before termination. No browser visual pass is claimed, and this route was not retried after the coordinator instruction.
- One executor call reported `exec-server transport disconnected`; the same environment recovered on the next command and work remained intact. No executor switch occurred.
- Initial dependency install failed because `/home/agent/.npm/_cacache` could not be created. The same locked install succeeded using `--cache /tmp/scratch-npm-cache`; no dependency metadata was changed.
- Browser full rounds, actual 390x844/844x390 pixels, audio by ear, physical phone, real GPU performance and hardware input latency: not run. Review these before asserting game-feel or visual acceptance. No measured production FPS is available.

Coordinator owns manifest/version finalization, any archive metadata listing, packaging and independent review. Multiplayer remains not integrated.
