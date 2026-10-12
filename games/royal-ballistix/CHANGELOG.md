# Changelog

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
