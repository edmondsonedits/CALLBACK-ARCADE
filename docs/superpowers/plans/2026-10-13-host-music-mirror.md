# Host Music and Mirror Implementation Plan

> Execute inline with one bounded music worker and one focused read-only review.

**Goal:** Publish continuous 20% host music and simple four-digit mirror joining.

**Architecture:** A layout-owned music player survives navigation. Mirrors use separate session credentials and the existing authoritative display projections.

**Tech stack:** React/Vinext, D1, existing MP3 tracks and host display components.

**Spec:** ../specs/2026-10-13-host-music-mirror-design.md

## Constraints and review focus

- Main and mirror hosts play music; phones and embedded duplicate players stay silent.
- Fades, media failure and blocked autoplay never block navigation.
- Four-digit codes remain private to hosts. Mirror joining is rate limited and same-origin; tokens are hashed.
- Mirrors cannot start, pause or advance games. Concurrent allocations and menu updates retain version guards.
- Mirrors follow main games, Online Arcade, New Game and reload. Expired or closed sessions reject joining.

## Task 1: Music

Ownership: HostMusicProvider, TVIntroMenu, useHostAudio, soundtrack helpers and focused audio tests.

- [x] Add failing tests for volume bounds, fades, phone exclusions and authenticated frame messages.
- [x] Implement the two-track player, gesture fallback and authoritative phase handoff.
- [ ] Verify real playback through navigation and game changes.

## Task 2: Mirrors

Ownership: session contracts/service/runtime/schema, Online Arcade display access, host choices, mirror code entry, SessionLobby and mirror rendering.

- [x] Add SQLite-backed tests for stable numeric codes, private disclosure, read-only credentials, menu CAS and cross-game following.
- [x] Implement mirror sessions and display-only Online Arcade GET access.
- [x] Add Main host/Mirror host choice, topbar code and passive mirrored menus.
- [ ] Verify host, mirror and phones through main game, Online Arcade, New Game and reload; observe that mirrors never POST host ticks.

## Task 3: Release

- [ ] Review the complete change and run unit, build, typecheck, lint, production rendering and related browser checks.
- [ ] Package and publish the same public Site; verify the fresh live flow.

## Execution rulings

The user explicitly requested this work and has authorized live Site changes in this session. Continue within that detailed scope without another permission gate. Reuse the clean version-72 checkout and preserve the divergent parent workspace. Browser policy may defer initial audio until a gesture; the title click and mirror join naturally provide it. The existing direct main-game display endpoint remains a public display capability, which provides no game control.

Ruling: The requested four-digit number is a pairing code for the public game display, not a credential for host actions or private player projections. Keep it simple and stable, rate-limit joining, and enforce the distinct read-only cookie and active-child checks. A guessed code can view that same display; it cannot control the game.

Final repairs: generation-guarded play promises, synchronous unlock, portal controls in standalone host headers, passive Arcade mirror cards, hidden legacy embedded codes, a visible framed Start Game button, and serial cancellable lobby polling. A held snapshot response produced three requests before the polling repair and one afterward. Two broad browser timeouts showed pending requests without a server response; focused reruns and live checks remain the decisive release gate.
