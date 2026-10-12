> Historical owner evidence for implementation head 3763723858ae2cc3b427f1a6dada71189852a8ac. Version/source hash below describe that head; final coordinator metadata and checks are recorded in coordinator-review.md.

# Royal Ballistix quality review

Scope approved by the coordinating conversation: contact/input/lifecycle/landscape fixes and restrained existing procedural feedback. No balance, bot personality, victory-rule, transport or runtime dependency change. This is local, unmerged work.

Base: `785a15000abe11970c7b92c5f3cab197061fcedf` (fetched `origin/main`, clean before work). Branch: `quality/royal-ballistix`. Playable entry: `games/royal-ballistix/source/index.html`. Final commit ID is supplied in the handoff rather than self-referenced here. Final standalone HTML SHA-256: `705506d33b7892fd7cab9e8c6c6e8b1f99a66813a05009635c613b3373a31f1b`.

## Reproductions and changes

| Area | Before | After / evidence |
| --- | --- | --- |
| Gameplay feel | Off-center paddle contact snapped 18.9189 px to center. | Tangential impact position preserved; short contact flash/recoil affects rendering only. Maximum-speed paddle, sealed-wall and ball/ball fixtures remain finite. |
| Reliable input | Lost pointer capture, extra stick touch and lifecycle transitions could leave pending local input. Held-key repeats could rearm after reset. | Pointer ownership and cancel/lost-capture handlers, local neutralization on pause/reset/blur/hidden document, and repeat guard. Independent stick/Magnet/Pulse and keyboard/API controls retained. |
| Camera/UI | 844×390 movement region began at x=-268; stick was off-screen. Top HUD covered part of the court. | Selected-layout transform reset; landscape controls beside court, HUD above it, message below. 12 layout combinations pass. CAM round-trip changes view only. |
| Visual/audio | Pulse meter began 89% full immediately after Perfect Pulse; limited capacity/heat status. | Meter uses actual cooldown duration; compact counter/heat/full states, contact cue, cannon charge arc/tone and critical-life roster border. Existing threat trails and targeting guide preserved. |
| Bots | Held-volley line pointed outward; intent changes were subtle. | Short inward aim line and defensive chevron reflect existing state; no decision/personality changes. |
| Lifecycle | Repeated goal calls removed multiple lives; repeated endCheck awarded multiple crowns; old callback reopened results after reset. | Ball membership/phase guards, exactly-once terminal transition, generation-checked/cancelled result timer, and stop remaining same-step goals after round completion. |
| Mobile/performance | Landscape failed; no physical-phone evidence. | Browser geometry/touch checks pass at DPR 1. Performance numbers below are headless scheduling observations only. |
| Testability | Source-pattern tests only. | Real inline-script behavioral harness, controlled timer races, full-match runs, reproducible Chromium geometry/touch and injected feedback captures. No test-only hook ships in the game. |

## Verification

- **Passed:** `node --test games/royal-ballistix/tests/source-smoke.test.mjs tests/royal-ballistix-mobile-ui.test.mjs tests/royal-ballistix-quality.test.mjs` — **47/47**; see `after/focused-tests.txt`.
- **Passed:** `npm test` — **102/102**; see `after/full-suite.txt`; includes shared camera/pause, Twisted saved-camera, Space Bash and Scratch Match regressions.
- **Passed:** `python3 games/royal-ballistix/tests/browser-quality.py --output /workspace/ballistix-baseline/browser-final` against a local server rooted at the checkout — see `after/browser-results.json` (16 checks).
- **Passed:** `python3 games/royal-ballistix/tests/capture-feedback.py --output /workspace/ballistix-baseline/feedback`; actual pixels inspected for contact, charge/heat, Perfect Pulse, critical gate and cannon warning.
- **Passed:** `git diff --check`; standalone source parses; smoke checks reject external scripts/styles/fetches.
- **Passed, limited:** fixed simulation progression at 20/60/120 Hz render cadence, allowing one fixed-step accumulator boundary.
- **Passed, limited:** seeded neutral-human plus bots at 2/4/10 seats complete first-to-three. See `after/matches.json`. The 10-seat match distributes wins across 12 rounds; long matches remain a diagnostic, not a reason to change balance. The initial 70-simulated-minute fixture ceiling was insufficient and was raised to four simulated hours after examining progressing rounds. No physics/timing value was changed to shorten matches.
- **Failed before fixes:** behavioral failure logs under `baseline/`, landscape baseline screenshot, and input-state record. Red checks were run before their fixes.
- **Blocked:** Royal Sumo v1.3 reference Library materialization. The supported helper returned exactly `library file transfer failed: download failed` on the initial attempt and one retry. No readable bytes, no reference pixel inspection and no claimed visual comparison. No further/restricted route attempted.
- **Not run:** physical phone, audio-by-ear, real GPU, gamepad or human feel evaluation. Browser CDP touch is emulation. Injected screenshots are deliberate feedback fixtures, not playtesting. Typecheck/Worker build/catalog generation were not needed for this standalone HTML-only product change; shared metadata was not edited.

## Conditions and limitations

Chromium 154.0.8037.57, Linux cloud container, headless, 390×844 and 844×390, DPR 1, 2/4/10 seats, arena 80/135%. Browser report contains measured frame intervals over 119 intervals at 2 seats in portrait. These are not physical-device or real-GPU benchmarks. Full-match tests run accelerated without rendering; their wall time is not a frame-performance measurement. Baseline live captures and post-change simulation harnesses consume random values differently, so their match durations are not a controlled balance comparison.

Manual-checklist items 1–19 have targeted code or emulated-browser coverage, with human feel/audio still unverified; item 20 has synthetic render-cadence coverage, not a display-device test. Settings scrolling and gate visibility were inspected in actual browser pixels. Extreme user-selected camera transforms can intentionally move/tilt the canvas; layout assertions use the default view, while code round-trip is separately checked.

Independent code review found the held-key repeat issue; its reproduction was added, observed failing, then fixed. No other concrete regression was reported.

## Rights and metadata proposal

All added visuals are procedural Canvas/CSS; audio uses existing Web Audio oscillators. No external art, audio, font or Sumo asset imported. `source/UPSTREAM-LICENSE.txt` is unchanged (SHA-256 `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4`). The modified HTML carries a change notice.

Coordinator proposal: release as a patch quality revision (suggested package version `0.12.1`), update the debug version and its smoke assertion together, note radial-stick running and behavioral/browser evidence, retain standalone/imported and multiplayer `not-integrated`. Current manifest, debug version and generated metadata are deliberately unchanged pending coordinator finalization. No publication authorization requested or used.
