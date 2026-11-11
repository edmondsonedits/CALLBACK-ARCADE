# Audio Runtime Report

## Runtime work

- Replaced the host music crossfade with a single-active-deck sequence: fade out, pause/reset, then fade in. Rapid phase changes keep only the latest target, stale `play()` completions are ignored, and rotation covers approved context tracks plus all legacy tracks.
- Kept host music at the saved volume multiplied by the quiet provider level and approved asset gain. Host routing checks remain bounded to expected source/origin; embedded phone pages stay silent.
- Kept effects as finite, overlapping voices with a bounded cap and synthetic fallback. New approved cues are selected from presentation events; timer ticks replace one another on a single countdown lane, with synthesized urgency accents at the end.
- Added approved ambience handling on host setup, fading out when leaving that context. Added parent duck notifications for game-owned voice and integrated native Sketch phase music/events through the parent-owned native adapter, baselining observations before playback eligibility to avoid replaying historical cues.

## Files owned/changed

- `app/components/HostMusicProvider.tsx`
- `app/components/useHostAudio.ts`
- `app/components/online/OnlineHost.tsx`
- `lib/game/audio-policy.ts` (new)
- `lib/game/soundtrack.ts`
- `tests/host-music.test.ts`
- `tests/host-music-rotation.browser.spec.ts` (new)
- `tests/host-music-default.browser.spec.ts`
- `tests/host-mirror.browser.spec.ts`
- `tests/rendered-html.test.mjs`

The catalogue, imported audio, and `lib/game/native-audio.ts` / `lib/game/sketch-relay-audio.ts` are parent-owned concurrent changes.

## Verification

- `node --import tsx --test tests/host-music.test.ts tests/game.test.ts tests/native-audio.test.ts`: 67 tests, 63 passed, 4 skipped, 0 failed.
- `npx playwright test tests/host-music-rotation.browser.spec.ts --reporter=line`: 1 passed. The browser case checks sampled single-deck playback during rapid transitions, quiet output, phone silence, mute persistence after reload, and retry after unmute.
- `npx eslint` on owned runtime and test files: passed.
- `npm run typecheck -- --pretty false`: passed.
- `git diff --check`: passed.
- `node --import tsx --test --test-name-pattern="disposable Sites starter skeleton" tests/rendered-html.test.mjs`: 1 passed. Full production-render checks were not run because this checkout had no `dist/server` build.

## Local browser server and notes

- Dev server: `http://127.0.0.1:3000/`, tool session `52409` (kept running for parent checks). The earlier server on port 5173 was no longer listening.
- Local dev logs showed socket-ticket requests returning 503; the focused audio browser test still passed through the fallback session flow. No 500 occurred in this test run.
- Playwright needed elevated H: workspace access to create `.logs/playwright-artifacts`; no source files were involved in that permission issue.
