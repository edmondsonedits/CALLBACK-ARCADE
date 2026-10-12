# Changelog

## 0.13.0 — Sumo benchmark upgrade

- Add paused setup with saved rule summary, siege/drill choices, contextual help, pause/menu routes, ordered crown/life standings and 1/3/5-crown matches. Setup rule edits wait for a new start or explicit Apply & Restart; public immediate count/arena APIs remain available.
- Add a 60-second Defense Drill with one active ball, repeating left/center/right training lanes, no life loss or crowns, and useful catch/counter/Perfect/volley/miss results.
- Add standard gamepad axis/deadzone, hold/release Magnet, edge-triggered Pulse and Start pause, with disconnect and neutral-before-resume protection. Preserve simultaneous touch and keyboard inputs; native form targets keep their arrow/Space defaults while gameplay suppression only applies to accepted game input.
- Show actual cannon shot directions and captured-volley release vectors, plus incoming landing cues. Add coastal foam/palms, sand court markings, castle turrets, numbered pennants and colored defender jackets/headwear.
- Persist validated setup, mute/volume, reduced motion and high contrast with guarded storage. Gate audio behind a user gesture; cap/dispose synthesized voices and handle allocation failures. Reduced motion calms shake, decorative pulses/rotation/waves and particles. Cosmetic effects use their own RNG so drawing cannot change gameplay draws.
- Add real-script behavioral regression coverage; retain 120 Hz physics, default siege timings, bot personalities, camera/CAM hooks, 2–10 contestant capacity and the standalone/no-dependency model. Update source-bound provenance and browser test setup.
- Browser screenshots and physical device/gamepad/audio feel are not attested by Node tests. Multiplayer remains not-integrated.

## 0.12.1 — quality revision

- Preserve lateral paddle impact position, prevent repeated scoring and crown awards, stop post-round scoring, and invalidate stale result callbacks.
- Clear cancelled/lost touch and stale local input on pause, restart, blur or hidden document; preserve independent simultaneous controls and keyboard/API inputs.
- Correct inherited landscape control translation and place short-landscape controls beside the arena. Settings remain scrollable and return to pause.
- Add short paddle contact/recoil and bot intent cues, cannon charge audio/arc, critical roster emphasis, Magnet heat/capacity text, and accurate Pulse cooldown fill. Physics speeds, cooldown durations, bot personalities and victory rules are unchanged.
- Add real-script behavioral tests and reproducible Chromium layout/touch/feedback checks. Correct stale touch-control/source documentation.
- Coordinate manifest and debug version 0.12.1 with source-bound provenance and catalog metadata. Multiplayer remains not-integrated; physical-device/audio-by-ear verification remains pending.

## 0.12.0 — source import

- Imported the complete standalone Royal Ballistix — Beach Siege v0.12 source unchanged from `edmondsonedits/CALLBACK` commit `ed09d25b690b36b397516e4d77437e3dd21247c8`.
- Preserved Canvas graphics, 120 Hz fixed-step physics, Magnet, Perfect Pulse, AI personalities, gate damage, scalable 2–10 player radial arena, corrected controls, pause/settings flow and adjustable arena size.
- Added Apache-2.0 upstream license copy and asset provenance notes.
- Added source smoke-test coverage and practical manual verification instructions.
- Documented current 10-seat input/state hooks and the missing authenticated CALLBACK room-code transport.
- Changed source status from `awaiting-import` to `imported`.
- Multiplayer remains `not-integrated`; no online/verified claim is made.

## 0.9.0 — intake placeholder

- Created the original catalog intake record while source import was pending.
