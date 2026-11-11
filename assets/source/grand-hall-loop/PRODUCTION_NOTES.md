# Grand Hall menu-loop production notes

Status: Checkpoint C review  
Source: production-approved Checkpoint B Candidate A  
Selected treatment: Stage Breath  
Delivery: `public/media/grand-hall/grand-hall-menu-loop.mp4`

## Tool decision

The Runway plugin was listed as available but was not installed or callable in the active project. Its installation prompt was not confirmed, so no remote image-to-video generation was used. This avoided introducing unapproved objects or composition drift. The comparison set was created deterministically from the exact approved poster, then the selected clip was finished and checked through AI Video Studio and FFmpeg.

## Motion comparisons

1. **Stage Breath — selected:** restrained periodic stage drift, roughly 1.5px edge-curtain movement, low-opacity cyan shaft drift, sparse dust, and quiet periodic room tone.
2. **Curtain Drift — alternate:** the same source and effects with slightly stronger edge-curtain and light movement.

Both clips are 16-second, 1920×1080, 24fps comparisons with no text, signs, controls, characters, pigeons, crowns, or new focal objects. The central live-HTML field remains quiet. Source comparisons are stored under `assets/source/grand-hall-loop/candidates/`.

## Selected delivery

- AI Video Studio source of truth: `assets/source/grand-hall-loop/ai-video-studio/edit-plan.json`.
- Codec: H.264 High / AAC stereo.
- Pixel format: `yuv420p`.
- Display size and rate: 1920×1080 at 24fps.
- Decoded duration: 15.958333 seconds.
- Delivery size: 1,530,983 bytes (1.531MB decimal).
- Fast start: verified (`moov` before `mdat`).
- Complete decode: verified, 383 decoded frames and 768,000 audio samples per channel.
- SHA-256: `45136a85fd34d8ef936ad130fdbbb36a615dd7fc0b457c91781dee99a02c89af`.

## Seam and poster evidence

- First/last frame PSNR: 42.112dB full frame and 43.724dB in the central quiet area.
- First frame versus approved poster: 34.650dB full frame and 38.204dB in the central quiet area.
- Audio boundary peak jump: 0.00000074, below the measured typical adjacent-sample delta.
- Responsive centered-cover stills were produced for 1366×768, 1920×1080, 2560×1440, 390×844, and 375×450.
- Full machine-readable evidence: `assets/source/grand-hall-loop/qa-report.json`.

The loop is decorative. The approved poster remains beneath it, reduced motion does not play it, and menu navigation never depends on playback success.
