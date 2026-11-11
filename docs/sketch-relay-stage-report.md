# Sketch & Sorcery shared-screen stage

- Added a responsive navy, parchment, cyan and gold studio with public phase instructions, three-round progress, aggregate readiness, roster, authoritative countdown and pause treatment. It fills its parent broadcast area without internal scrolling.
- Reveal presentation uses the shared server budget: 12 seconds per chain, two six-second legs, one second of the original and a four-second aligned dissolve. Reconnect, pause and host replay use the supplied remaining time. React never advances phases or awards scores.
- Only public reveal/results chains are rendered. Private `self` prompts and assignments are never read. Authenticated room images load before fading; failed or absent transformations retain the source with explicit status. Free bot art is labelled as coded practice.
- Added Before/Magic/After comparison, a reduced-motion side-by-side comparison, a three-step skippable/replayable guide that explicitly leaves the live clock running, and gesture-enabled browser narration with matching visible captions. Voice cancels on pause, mute, disabling or unmount; mirrors can disable it entirely.
- Results show server scores with ties and a gallery paginated three chains at a time, up to all 30 chains. Points include participation and applause; the UI labels them as points. Host-only next/replay/play-again actions remain optional props.

## Focused verification

- `node --import tsx --test tests/sketch-relay-stage.test.ts`: 4 passed. Covers shared timer consistency, both reveal legs, fade timing, reconnect/replay position and unknown/out-of-range clocks.
- `npx eslint app/components/sketch-relay/SketchRelayStage.tsx lib/game/sketch-relay-audio.ts`: passed without warnings.
- Root integration owns repository typecheck, production build and live host/phone/browser acceptance. No paid media was requested for this stage.
