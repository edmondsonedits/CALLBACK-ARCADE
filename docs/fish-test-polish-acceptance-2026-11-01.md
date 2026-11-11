# Temporary fish drawing test and animation polish

The user authorized direct access to fish drawing, visual improvements and publication. This release continues from 266e0b7 and includes the previously local original aquarium backdrop and single-PNG swimming renderer. It preserves production v103 and the narrator source in its ancestry.

## Use the temporary test

Open `/fish-test`, keep solo practice enabled, choose two to five bot opponents, and press **Create fish test room**. Choose **Shark showdown** or **Peaceful tank**, then press **Test fish drawing (temporary)**. The real drawing editor opens immediately, without the main rounds. Five bots plus the human give six fish. Free bots supply clearly marked practice artwork and deterministic ballots; they do not queue image generation.

Use **Open aquarium screen** to watch on a separate landscape display while drawing and voting in the original controller tab. Both the host screen and solo controller have **Return to lobby**. A normal multiplayer Sketch & Sorcery lobby also offers the temporary test when it has three to ten active seats. The common session host and home choice link to the separate test setup.

## Boundaries and animation

The server creates an explicitly marked fish-test container while retaining the lobby lifecycle. It never fabricates completed main rounds, main scores, match results or public winner archive entries. Normal game/setup actions are guarded while practice is active. Exit validates host identity and current fish IDs, clears the test atomically and restores the previous joining lock, even if the live roster has changed. Ordinary Arcade solo starts remain unsupported.

The single submitted alpha PNG remains the only player texture. Existing curved mirrored sides, tail flex, swimming through depth and original-image fallback remain intact. New bites scatter up to twenty beveled samples of the actual submitted image, with rotation, water drag, buoyancy, shrinking and fading over at most 1.2 seconds. Fading ripples, shark wakes and release bubbles add motion without derived image assets or dependencies. Effects are deterministic from event time, freeze with pause, and are suppressed by gentle/reduced motion. Every original drawing returns to the final aquarium.

A dual-cookie solo session now recovers its own player identity for fish media only after validating an active, non-pending human seat in the same room and frozen fish match. Other hidden drawings and host-only drawing access remain denied. Setup submission waits for hydration to prevent premature native form navigation.

## Fresh verification

- Full serial unit/API suite: **1,194 tests; 1,185 passed, nine existing skips, zero failures**. Final focused media regressions: **12/12**. Independent authority/media review found no remaining blocker.
- Two Chromium shortcut scenarios passed (**3.4 minutes**): ordinary multiplayer lobby entry/exit followed by normal game start, and solo setup through real editor PNG upload/readback, bot practice fish, visible ballot, shark paint fragments, champion, full revival, zero image jobs and controller-side lobby exit with restored joining lock.
- A 1342×964 desktop regression also passes: dedicated fish lobby, no unrelated game selector or first-place bot promise, reachable launch button, real editor and controller exit (**5.5 seconds**).
- Six authenticated human seats completed the normal main match, submitted six single PNGs and locked phone ballots. The unskipped shark presentation completed five vote-ordered eliminations, paint fragments and six-fish revival with unchanged main results and zero new image jobs: **Chromium passed, 4.4 minutes**. Recording and phase screenshots were inspected.
- Visible mode/time/start/phone ballots, gentle motion, painted Canvas fallback, restored WebGL art, keyboard artist focus and return to main results: **Chromium passed, 2.7 minutes**.
- Real editor alpha/white/external-part pixels, upload idempotency, staged privacy, partial peaceful ballots and phone/host reload: **WebKit passed, 3.0 minutes**, using the ignored local browser cache.
- Final TypeScript passed. Lint has zero errors and four existing image-element warnings. Production build and nine production Worker render checks are recorded in the release logs; the dedicated setup route is also checked against the built Worker before packaging.
- The six-fish recording sample measured 33.3 ms median and 50 ms p95 frame intervals (179 samples, 66.7 ms maximum). Other local checks overlapped this sample; it is not a hardware performance certification.

Evidence: `.logs/fish-acceptance/shortcut/`, `.logs/fish-acceptance/runtime-six/`, `.logs/fish-acceptance/controls/` and `.logs/fish-final-*.log`. The normal-game recording is `runtime-six/runtime-six-demo.webm`; it starts after normal submissions and contains actual game rendering, not generated video.

## Retained limits and resolved attempts

The first shortcut run exposed early form submission and solo own-media denial; both were fixed. Later test-only assumptions were corrected for the actual two-minute drawing timer, practice-fish button labels and the intentional portrait host rotation guard. A normal capture overlapped source hot reloads and lost its decoded artwork; the frozen-source rerun passed unchanged, including revival. The first published live smoke check exposed a desktop paging problem in the reused general solo lobby. A dedicated compact fish lobby removes that paging trap and misleading unrelated settings; its new desktop regression passes. WebKit initially looked in the global cache; the established local cache resolved launch without an installation or source change.

Physical phone/TV GPU and audio, WAN/realtime Worker and hosted paid-provider behavior are not certified by these local tests. The full unrelated application browser matrix was not rerun. One image cannot reconstruct unseen fish anatomy; the runtime approximates volume using the original pixels.

To remove the temporary test later, remove the setup/menu/lobby links, `START_FISH_TEST` entry and solo creation flag, plus its marked lobby-container/snapshot/exit branches. Keep the normal optional finale and visual effects. The Sites publication receipt is saved beside this checkout as `fish-test-polish-publication-receipt.json`, recording the exact saved version, source commit, deployment and production URL. Production v103 is the pre-release rollback.
