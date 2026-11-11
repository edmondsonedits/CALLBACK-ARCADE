# Sketch narrator comedy library

User brief: research humorous host material, supply ten alternatives per situation, maintain one funny mood per game, and substitute player names. Implement directly within the existing browser-voice/caption architecture.

## Design

- Eight moods: nice art teacher, dry funny emcee, quirky museum bureaucrat, silly wizard, sassy diva, critical reviewer, analytical researcher and mean theatrical roast critic. One automatic match-stable mood, with an accessible TV selector. Mood changes affect presentation only.
- Twenty-five scenario banks, ten original lines per mood per scenario (2,000 lines). Fixed factual instructions precede the quip, so improvisational wording never changes rules, points, timers or eligibility. New three-round and saved two-round matches both retain accurate copy.
- Name substitution is literal, bounded and uses only public roster data. Artist names are used only after a server-authorized reveal; anonymous galleries get letters. No image analysis or invented observations about private drawings.
- A shuffled deck avoids repeated jokes until its ten options are used; event identities prevent polling/reload replay. Captions persist, voice stays opt-in, mute and music ducking remain intact. Optional chatter has freshness windows, spacing and lower priority than countdowns.
- Keep existing gameplay authority, deadlines, scoring, avatar ownership, optional fish finale and public-showcase privacy unchanged.

## Work and acceptance

1. Research official Jackbox writing guidance, Toastmasters comedy advice and real host examples; record links and distinguish original writing from quoted source material.
2. Build and validate the complete catalogue (one focused Luna worker owns only the new content file).
3. Add pure deck/template/timeline logic with tests for ten-option coverage, name safety, match consistency, no hidden authorship and accurate multi-version instructions.
4. Integrate mood selection, captions, pause/resume and voice scheduling into the existing stage; browser-check real-room playback, timers, controls and layout.
5. Run relevant and release checks, preserve current source ancestry, package the exact verified source, and record publication/checkpoint provenance. Inspect latest version's existing save-only boundary before deploying unrelated unfinished work.

Research and runtime details: docs/sketch-narrator-research.md. Verification evidence will be added below.

## Completed evidence

- Catalogue validated: 8 × 25 × 10, unique within each bank, bounded line length, authorized placeholders only. Editorial pass removed literal non-jokes, false observations of private canvases, turn-taking claims, already-submitted pending-player lines, and incorrect fixed counts for voting/transitions/ties. The readable scriptbook is generated from the exact source catalogue.
- Runtime review: fixed stale speech/captions with phase/card/pause provenance and a voice-readiness guard. Capped heard/pick history and persisted per-scenario progress; a 725-event mixed replay regression proves restoration continuity. Storage writes occur on selected cues or explicit mood changes.
- Red/green browser reproduction: an intro permanently suppressed an already-pending last contributor. Introductions now leave optional callouts eligible after the quiet gap; urgent warnings still suppress superseded chatter. Final tests assert a positive spoken resume and no stale paused utterance.
- Full unit run: 1,167 discovered, 1,158 passed, 9 existing skips, 0 failed. Final related run after brief copy tightening: 23 passed. Logs: .logs/qa-narrator-full-unit.log and .logs/qa-narrator-focused-final.log.
- Browser: 3 narrator/audio checks and 6 game/control checks passed. The full three-round four-phone flow includes avatars, delayed polling, reduced motion and narration. Logs: .logs/qa-narrator-browser-final2.log and .logs/qa-narrator-game-browser.log. Screenshot: .logs/qa-narrator/mood-selector-1366.png, visually inspected.
- TypeScript, lint (0 errors, 4 inherited warnings), official production build, all 9 production-render tests and diff checks passed. Logs use the .logs/qa-narrator- prefix. Physical-device listening and a clean whole-application browser suite are not claimed.
- Native latest source at selection: saved v101 / 936ccb1ea310913dc54f189c90a719c6c0aa9041. Versions 100 and 101 have no deployment. Preserve the explicit save-only boundary recorded in docs/plans/2026-10-31-fish-finale-implementation.md; save the verified narrator checkpoint and ask for concrete publication approval afterward.
