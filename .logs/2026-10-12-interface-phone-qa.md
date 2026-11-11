# Interface and phone QA

Base: Sites version 70, source `b199c5b48c2bb9d550b87d8368b63d1f6381b9fe`. Work uses an isolated Sites checkout; the older workspace changes were preserved. No image generation tools or paid image providers were used. Existing artwork and local concept-card fallbacks supplied visual game states.

## Repairs

- Same-origin online Arcade joining: real D1 rejected the ten-term compound SELECT. A single VALUES CTE now allocates the first available seat atomically; token cookies, room status/expiry predicates and uniqueness checks remain unchanged. Regression reproduced the failure before the change; all eleven service tests pass after it.
- Shared phone instructions and lobby titles: dark ink inherited onto dark controller backgrounds. Scoped presentation rules restore readable light copy; join-controller help has an 18px gap and a 48px target. Both browser regressions failed before the repair and passed afterward.
- Host controls: native modal focus could leave the panel at keyboard traversal boundaries. Visible first/last controls now wrap Tab and Shift+Tab; desktop and phone-size keyboard checks pass.
- Featured phone lobby: module-based games can install their adapter after document readiness. The shared host integration waits for that adapter before mounting the phone button.
- Older Air Hockey, Light Trails and Tap Race setup links redirect to their current same-origin online service, avoiding obsolete room implementations.
- Verification portability: Windows file URLs and separators are handled correctly in touch/asset harnesses and provenance recording. Imported public files preserve their raw hash-bound bytes.

## Verified evidence

- All nine main game variants have complete local browser/API lifecycle coverage, including both Bowl games, Royal Rumours and Royal War Room. Existing three/six/ten-player scenarios, private snapshots, restore, results and replay checks remain intact. Main host family checks include no-scroll 1366×768 rendering.
- All fifteen full Arcade packages: HTTP boot, canvas/control visibility and viewport bounds at 1366×768, 390×844 and 844×390. Eleven representative captures were visually inspected. All twenty practice routes: boot, native simulation progress or embedded full-game visibility, reset/exit, and no accidental room requests.
- All twenty-three same-origin online games: two isolated phone browsers join, a real controller input receives acknowledgement, TV has game state, pause disables input, resume/reload preserves the seat, and controller bounds fit portrait and short landscape. Thirteen cases passed in the initial run; ten remaining cases passed after the test waited for the phone's own enabled state before using raw pointer input.
- All sixteen native room routes passed 22 browser scenarios. All seven featured mailbox games passed two-phone joining, accepted per-game controls, reconnect, roster and room closure. Roller Ruckus includes an on-screen stick drag. Air Hockey, Light Trails and Tap Race each passed accepted phone controls, a server-recorded terminal result and same-room replay.
- Final post-build unit suite: 801 discovered, 794 passed, seven existing opt-in/legacy skips, zero failures. Production build and all eight Worker rendering checks pass. TypeScript, lint and whitespace checks pass. Browser evidence covers 87 scenarios across targeted runs. Focused independent review found no actionable regression in the product changes.

## Remaining release gates

Exact-source packaging and public deployment remain. Physical Android/iOS devices, actual Wi-Fi latency and third-party Party Games packs are outside this browser-emulation evidence. Existing prototype/placeholder quality labels remain accurate; this pass does not certify a quality rating.
