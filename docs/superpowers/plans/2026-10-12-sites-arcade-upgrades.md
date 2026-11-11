# Sites Arcade Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace the Sites arcade placeholders sequentially with full games matching the user's requested menus, bot play, customization and meaningful arenas.

**Architecture:** Same-origin full game packages preserve their simulation and controls. A small allowlisted registry resolves existing Practice URLs to completed replacements. Unreplaced prototypes and authoritative room games remain functional; new local games never modify D1 state.

**Tech Stack:** Existing React/Vinext Site and complete standalone HTML/JS/WebGL2/Canvas games.

**Spec:** `docs/arcade/upgrades/QUALITY_STANDARD.md`

## Global Constraints

- Keep all 19 room games and 20 prototype routes; replace entries individually.
- Preserve the public Site, D1/R2 configuration, credentials and existing party workflows.
- Preserve complete source and record license/provenance for reused material.
- Managed browser QA must be skipped when control-browser is unavailable; report that limitation.
- Target 9/10 is not an automated score or an achieved claim without playtest evidence.

## Review Focus

- Game files and vendored assets resolve on the deployed Site, including relative modules.
- Route exit/re-entry leaves no active game audio, animation or hidden controller state.
- Local games cannot accidentally create rooms or use paid APIs.
- Replacements retain real bot counts and map mechanics, not UI-only options.
- Remaining placeholder entries stay honest and existing multiplayer contracts remain unchanged.

### Task 1: Royal Sumo full-game replacement

Files: `lib/arcade/full-games.ts`, `app/components/FullArcadeGame.tsx`, `app/components/ArcadePracticeLab.tsx`, `public/arcade-games/royal-sumo/`, `tests/arcade-full-games.test.ts`, affected catalog/presentation tests.

- [x] Write registry/package/SSR regressions and observe failure before registry exists.
- [x] Add Royal Sumo package with recorded source hashes and original source.
- [x] Implement allowlisted same-origin iframe and persistent Exit; replace only Sumo's placeholder and instructions.
- [x] Run source/unit and Site checks; record evidence and commit.

### Next tasks: game-specific upgrades

- [x] Inspect and complete Space Bash, Twisted System, Roller Ruckus, Scratch Match, and Sky Balls individually, reusing the corresponding GitHub full game where appropriate.
- [x] Design and integrate Snow Bash, Drain Bash, Jungle Bash, Tie-Breaker, Manic Panic, Rubble Alliance, Dragon Drop and Volt Vault individually; record simulation and lifecycle evidence.
- [ ] Upgrade the remaining physical games individually: Mystery Beat, Tailblazer, Jungle Fox, Metal Fox, Paint Panic and Rhythm. Complete browser/physical-phone quality validation for all replacements.
- [ ] Upgrade the 19 room-game titles individually with genre-appropriate starting demonstrations, bot practice, meaningful board/round variants and customization, preserving existing authenticated room play.
- [ ] Verify release checks and package/publish through Sites; retain previous live version for rollback.

This ledger records real completed work, findings and blockers. It is not a promise that all 39 entries are already 9/10.
