# Changelog

## Quality branch — timing and feedback

- Judgment samples a monotonic game clock on input; hidden-page intervals freeze countdown and phrases. Audio unlock/suspension cannot change the clock origin.
- Retained difficulty windows, lives, score/combo rules, controls, CAM codes and generation-guarded round-end cancellation.
- Added opt-in `configure({seed})` replayability, independent of cosmetic randomness. Bots preserve success/perfect probabilities and use timed lane judgments; missed intents expire once.
- Added 100 ms DJ audio lookahead, cancellation on mute/restart/background/audio suspension, and a 35 ms stale-event cutoff. Response tones use a higher sine timbre.
- Notes approach linearly, hit feedback includes signed timing offset, and the response heading clears correctly. Highway geometry reserves space beneath HUD/topbar and above controls.
- Archived the exact original v0.5 import and moved its immutable SHA-256 check to that archive.
- Added executable runtime quality tests and an evidence report in `tests/QUALITY.md`. No asset imports or metadata/version finalization.

## Standalone reliability fixes

- Restart cancels the pending round-end timer and invalidates callbacks from earlier rounds, so an old result callback cannot end a new match.
- Added root runtime regression tests covering repeated restarts, forced stale callbacks and normal results.

## 0.5.0 — repository import

- Imported the complete royal_scratch_match_v0.5_ten_player.html attachment as source/index.html with the supplied source hash preserved.
- Preserved the existing call-and-response rhythm gameplay, forward-moving note highway, timing windows, touch/keyboard controls, synthesized audio, graphics, bot behavior, 2–10 slot menu, and one-human-plus-bots standalone mode.
- Updated manifest source status from awaiting-import to imported while keeping multiplayer status not-integrated.
- Added asset provenance documentation; the v0.5 runtime has no external asset dependencies.
- Added source smoke checks and practical manual verification instructions.
- Documented ScratchMatchAPI, debug state, player-slot/bot behavior, and remaining CALLBACK room-code work.
- No production deployment and no ChatGPT Sites changes were made.

## Earlier chat development

- v0.5: expanded the standalone build to 2–10 contestant slots and generalized bot/human input state.
- v0.4: improved timing UI and changed notes to approach the player-facing hit line.
- v0.3: mobile/HUD readability pass.
- v0.2: changed the core loop to DJ call-and-response phrase repetition.
- v0.1: initial Royal Scratch Match prototype.
