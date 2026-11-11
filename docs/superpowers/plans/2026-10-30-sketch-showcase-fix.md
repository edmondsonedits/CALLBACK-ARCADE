# Sketch showcase and avatar feedback Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for this bounded follow-up.

**Goal:** Give each drawing a larger, ten-second anonymous spotlight and make the revealed artist's phone moves visibly work on the TV.

**Architecture:** Keep timing and performer eligibility on the existing authoritative server. Share the spotlight interval between renderer and engine. Treat avatar motion as bounded local playback of a server-authorized sequence, with a distinct static pose for reduced motion.

**Tech Stack:** Existing React/Vinext, CSS, SVG avatar rig and Playwright.

**Spec:** User's playtest feedback in this conversation. Implementation choices: ten seconds per anonymous drawing, twenty seconds per artist reveal, compact TV chrome during art presentation, no new dependencies.

## Global Constraints
- Preserve ballots, scoring, anonymity, saved matches, mute, pause and server authority.
- Preserve the current Site audience and existing allowance-protected AI pipeline.
- Original dirty workspace remains untouched; work uses the synchronized isolated v95 checkout.

## Review Focus
- An authorized move received several seconds late must still be visible, once.
- Repeated snapshots must not restart moves; expired events on a later reload must not replay indefinitely.
- Reduced motion must show the chosen pose and action text instead of silently ignoring controls.
- Only the current artist can perform, including the winning artist.
- Artwork and controls must fit the TV without scrolling or cropping drawings.

### Task 1: Reproduce and fix
- [x] Add failing authoritative duration checks and browser pose assertions for a winner, delayed TV updates and reduced motion.
- [x] Share the ten-second interval, extend artist reveals, and enlarge the art presentation.
- [x] Play each recent authorized sequence from its first painted frame; preserve expiry/repeat guards and show static reduced-motion feedback.
- [x] Run focused red/green checks and inspect TV screenshots.

### Task 2: Verify and publish
- [x] Update rules and STATUS; run relevant unit/browser checks, typecheck, lint and production build.
- [x] Review the final diff and prepare exact synchronized source for Sites publication. Native save/deploy and acceptance outcomes are recorded in the sibling release receipt.

## Execution evidence
- Duration regression failed at 16,000ms for four drawings versus expected 40,000ms; it now passes.
- Artwork regression measured the old showcase at about 445px tall; enlarged stage passes over 500px tall and 900px wide at 1366x768, with contained art and retained outer room/host controls.
- Delayed TV update regression received Dance while all avatar joints remained neutral. Full local playback and explicit reduced-motion poses repair that path.
- Independent trace review identified a second case: the first animation frame could occur after animation time was consumed. Actual-effect regression failed with a 3,000ms first-frame delay and now passes; polling the same event does not restart playback.
- Browser test synchronization requires the TV's correct artist, holds a poll before sending the action, watches the TV in the foreground, and waits for the new emote before comparing reduced-motion poses.
- Independent review found no material regression in authority, privacy or scoring. Existing physical-device/live-AI limits remain.
- The sibling showcase-fix-publication-receipt.json records native publication and live build verification without a post-publication source edit.
- Final checks: 1,044 unit passes / nine existing skips; all five focused browser checks passed after a clean preview restart; nine production-render passes; TypeScript/lint/build/diff green. A concurrent build had interrupted one earlier reload check; final browser verification ran after the build with no overlapping source-generation work.
