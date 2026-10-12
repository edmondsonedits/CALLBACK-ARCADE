# Sumo benchmark progress

Plan: docs/superpowers/plans/2026-10-12-sumo-benchmark.md
Original audit base: d36d8743db27012d5c12f1744168636d198dfa97
Integrated upstream base: 2a275812045d210d66210f710bae025b42635fc2

- All six game implementations and source-bound reports are complete.
- Independent final review approved. Fixed and regression-tested: Roller focused-button keyboard input and held-gamepad resume; Ballistix native settings keys and focused-button gameplay input.
- Final integrated `npm test`: 386 passed, 0 failed. TypeScript, catalog, Pages build and Worker dry-run pass. Sumo supplied suite: 144 passed; source/build integrity and seven phone-room tests plus relay dry-run pass.
- All 116 Sumo/original/archive files from the latest upstream remain unchanged by this task. The concurrent Sumo phone-room update is preserved, including its pending public relay deployment status.
- Published code: feba4619b0b6c172c89e1b37bf00bee805603ac2. Both verify and publish-pages workflows succeeded. All seven live HTML SHA-256 hashes and the live catalog match the verified build.
- Final desktop Canvas browser smoke checks passed for setup/play/pause and inspected world rendering. Ballistix native range/checkbox keys and Blind Crown completed-volley review/scrubbing worked. No game-origin console errors or document overflow observed at 1363×936. Screenshots and exact scope are in live-verification.json.
- Local Chromium cannot start under the execution sandbox and cloud WebGL2 is unavailable. Mobile pixel/device, physical gamepad and audio-by-ear testing remain pending.
