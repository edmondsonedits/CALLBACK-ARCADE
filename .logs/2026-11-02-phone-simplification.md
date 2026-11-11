# Simpler phone menus and native face capture

Base: published Site v123, source `232aff956d02f96ebb43e998cb4e1caf153fb866`. Preserve it as rollback. Audience remains public.

## Changes

- Removed the unused `QrScanner` component and the separate scan destination. `/play` offers manual room code, nickname and Join game. Host QR links still work when opened by the native phone camera. Older Arcade service entry is available under help.
- Added native front-camera capture alongside normal photo upload. Both use the existing local validation, crop/chin guide, generation, trim, retry and save behavior. Picking/canceling a file does not generate. Hidden file controls stay out of the tab order; privacy disclosure participates in the dialog focus cycle.
- Removed the empty initial photo workspace/disabled Generate action, improved chooser contrast and fixed stretched action rows. Kept 44px source actions and normal-sized generation/cancel buttons.
- Reduced excess framing on Home, join, mirror/display and saved-character screens. One character card replaces repeated headings and nested cards; the browser-cookie explanation remains expandable. Long menus, help, keyboard recovery and accessibility overflow retain ordinary scrolling.
- Join fields wait for interactive readiness, preventing a code/nickname typed before hydration from being lost. No backend, scoring, schema, provider or billing-control changes.

## Evidence

Ignored logs/screenshots: `.logs/phone-simplification/`.

- `npm test`: 1,231 passed, 11 intentional skips, zero failures (`unit.log`).
- Typecheck passes; lint has zero errors and eight inherited image warnings. Diff whitespace check passes.
- Focused navigation, character, fish and phone task run: 25 passed; the additional main/Arcade/main integration failed entering the unconfigured legacy Sumo service (`focused-browser.log`).
- Final photo/entry layout suite: 12 passed (`photo-final.log`). Includes shared crop pixels, reference alpha, retry keys, preview/apply/save, trim recovery and unavailable-face fallback using synthetic/mocked images.
- Fresh final acceptance after the privacy focus fix: 4 passed (`final-acceptance.log`). Explicit native file-chooser tests cover cancel, camera capture input and ordinary upload, with no generation before the explicit action. Compact join/mirror/display/character screens fit at 320×568, 393×700 and 430×780. Home fits at 393×700. Extended help remains scroll reachable. Character/crop controls also checked in landscape and desktop layouts.
- Fresh isolated API checks: 7 passed (`api.log`).
- Sites production build passes, including 17 static archive gates; all 10 production-render checks pass (`build.log`, `render.log`).
- Broader release browser attempt: 16 passed, five failures, 150 not run; cutoff also reports one teardown error (`release-browser.log`). The same five failures as v123 involve legacy Arcade bot switches/phone connections in the QA harness without that separate Worker. This is not an all-browser-suite pass.
- Screenshots reviewed for Home, join, character, camera chooser and crop. Screenshot inspection caught secondary-action contrast and stretched grid rows that DOM visibility assertions alone missed.

## Limits

Native camera hardware/OS presentation requires a physical-phone check; browser tests supply synthetic images through the actual file-chooser controls. No real provider work or photo uploads were performed. Full legacy Arcade QA, physical keyboard/browser chrome differences, enlarged-text extremes and group play are not certified by these checks.

Publication receipt and live asset hashes are retained in the ignored evidence directory. Production build/render verification is recorded there before source packaging.
