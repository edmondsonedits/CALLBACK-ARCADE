# Changelog

## 0.7.0 — Four Courts Tour

- Added a compact silent title with real call/response bots, independent state and MIT Alea stream, Watch/Return, and clean fresh Start. Returning from an audio-enabled session cannot sound the demo.
- Added Tide Pavilion swing pairs, Clockwork Foundry half-beat/chord motifs and explicitly mapped Mirror Ballroom responses. Royal Hall retains classic note generation; all stages use unchanged scoring windows and shared note timestamps for display/audio/bots/judgment.
- Added stage-specific rehearsal and a four-court, eight-phrase Tour with deliberate next-stage flow, aggregate standings and seeded replay.
- Added grouped persisted settings for stage, goal, tempo, name, color, costume, instrument and high contrast, preserving existing sound/input/access options. Rules stage until Start; native text input normalizes on blur.
- Added open-sea pavilion architecture, interlocking foundry gear trains and presses, tall ballroom mirrors/chandeliers/checkerboard, bounded CC0 star impacts and a quiet locally decoded CC0 perfect-hit accent. All resources have local licenses, official archive provenance and hashes.
- Added 18 worlds regressions alongside 47 retained tests; public state now identifies stages, demo progression, Tour records and legal response lanes. Browser/hardware validation is separately scoped.

## 0.6.0 — Crown & Cadence / Sumo benchmark

- Added a four-beat 96 BPM count-in, gold DJ-call/cyan echo identity, linked chord notes and a signed early/on-time/late timing meter. Chord feedback reports the worst constituent timing.
- Added rehearsal with no elimination, exact-phrase retry, deliberate phrase advance and cumulative attempt results. Fresh sets choose a seed; same-set replay keeps phrase/bot randomness.
- Added pause/resume, help/soundcheck and setup/results routes. Pause, hidden-page and CAM freezes compose without advancing notes; held input/audio resources are neutralized. Deferred result callbacks still retain epoch protection.
- Persisted validated volume, mute, beat guide, difficulty, contestant count, mode, reduced motion, vibration and ±200 ms local input correction. Correction shifts judgment and expiration together without affecting bots or remote inputs. OS reduced-motion preference supplies the default.
- Added standard gamepad face-button chords and Start actions with repeat, menu, blur, disconnect/reconnect and release guards. Kept existing touch/keyboard mappings and public input/configuration hooks.
- Deepened the castle stage with curtain folds, gallery rails, torch niches, speaker towers, a faceted apron and proscenium. Performers gain distinct costume silhouettes, badges, labels and recovery faces; DJ mixer/vinyl react to call notes. Compact layouts place the DJ beside the highway.
- Removed implementation/transport copy from player setup. Results add accuracy, recent successful-note median and timing distribution; settings/help use progressive disclosure and visible keyboard focus.
- Added 18 real-runtime behavioral tests to the existing 29 timing tests, syntax/smoke checks, immutable archive verification and current source hashes. No authored media, CDN dependency, engine replacement or online transport was added.


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
