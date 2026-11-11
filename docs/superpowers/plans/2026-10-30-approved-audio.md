# Approved Audio Integration Implementation Plan

> For agentic workers: use subagent-driven-development for the bounded audio runtime task; the owner handles asset import and release verification.

**Goal:** Import every currently liked Suno clip, use them with existing audio at quiet levels and correct presentation moments, rotate music with no overlap, fade every start/stop, and remove only the task-created Downloads duplicates after verified import.

**Architecture:** Retain HostMusicProvider as the single music owner across main and embedded games. Approved local assets are described by lib/game/audio-library.ts; the host hook consumes authoritative presentation events and forwards bounded presentation-only music/ducking information to the parent. Sound effects may overlap through individual fade envelopes; music transitions must fade out, pause the old track, then fade in the next.

**Spec:** User requests in this chat on 2026-10-30, including the follow-up to create missed effects and keep existing effects/music.

## Global constraints
- Work only in the isolated current v95 Site source at H:\ChatGPT\King-Prompter-Audio-2026-10-30. Do not modify the older C: checkout or concurrent Sketch source edits.
- Access H: only under H:\ChatGPT.
- Server/D1 remain authoritative. Audio is presentational and TV/host-only; phone controllers remain silent.
- Preserve mute, explicit user preferences, voice selection, captions, read-only displays and same-origin/source validation for embedded messages.
- Music never overlaps another music track or procedural music. Quiet base music multiplier 0.55 over the existing preference and asset-normalized levels; existing preference controls remain usable.
- Short effects have independent attack/release fades and may overlap; no replays from stale snapshots, reconnect or unmounted routes. Existing synthesized cues remain available as safe fallbacks and to fill missing events.
- All selected clips are downloaded through Suno's official Download action. Keep source IDs and hashes in the import receipt. Delete only task-created downloaded originals after imported files verify; do not delete other Downloads files or Suno library entries.
- Do not introduce paid runtime dependencies or new paid generation.

## Review focus
- Rapid phase changes, stale play promises, route changes, mute/unmute during a fade and track errors must not leak two audible music decks.
- Asset fetch/decode failure must use a quiet synthesized effect and leave gameplay usable; stale async completions must not sound after mute/teardown.
- Polling/reconnect and early submissions must not replay event cues or continue countdown loops after pause/end/phase changes.
- Every liked asset must have a real local file and a reachable role; legacy tracks must remain in rotation.
- Embedded native games, main/mirror routes and title autoplay must keep the single-owner and silent-phone contracts.

### Task 1: Approved asset import (owner)
Files: lib/game/audio-library.ts; public/media/audio/*; assets/source/audio/approved-import.json; scripts/import-approved-audio.mjs.
- Inventory the liked-filtered Suno workspace, download each official MP3, map source IDs to semantic roles, verify file size/hash and actual decoded duration.
- Import quiet game assets with short boundary fades and sensible trim windows for one-shot effects. Preserve full approved music; retain provenance in the import receipt.
- Remove only the exact browser download files created during this task after verified copies exist.

Runtime interface supplied by the owner in lib/game/audio-library.ts:
export interface ApprovedAudioClip { id: string; src: string; title: string; category: 'music' | 'effect' | 'ambience' | 'countdown'; role: string; durationSeconds: number; gain: number; }
export const APPROVED_AUDIO: readonly ApprovedAudioClip[].
Roles: menu, thinking, voting, game, results (music); join, response-lock, vote-lock, all-votes, card, round, reveal, score, winner, tie, timer, time-up, pigeon, comic (effect); tavern (ambience); countdown-light and countdown-urgent (countdown).

### Task 2: Music rotation and semantic effects (focused worker)
Own: app/components/HostMusicProvider.tsx; app/components/useHostAudio.ts; lib/game/soundtrack.ts; new audio runtime/policy modules under lib/game or app/components; related tests/host-music*, tests/audio*; exact small presentation event mapping changes if needed.
Do not edit the owner-supplied audio-library.ts or downloaded files.
- Add meaningful failing tests for a sequential fade envelope (incoming and outgoing are never simultaneously positive), playlist rotation including legacy and approved tracks, rapid target replacement, and selected semantic effect roles.
- Run the targeted tests to demonstrate expected failures, then implement and rerun.
- Use quiet context-appropriate playlists that rotate on ended and phase context changes without restarting on each snapshot. All approved music roles must be reachable, including menu and native hosted games.
- Replace crossfades with fade-out/stop/fade-in, including intro/menu handoff if necessary. Preserve graceful autoplay retry, stale generation guards, mute preferences, device routing and unmount cleanup.
- Play approved effect variants at matching authoritative semantic events (join, lock, reveal, score, winners/ties, timer expiry); use the existing procedural cues for missing effects. Give every effect its own finite fade envelope and cap voice density.
- Add quiet countdown/ambience only where appropriate; loops must stop/fade on pause, phase change, mute and cleanup. Keep music as the only music lane, and avoid layering a second musical countdown over it; countdown percussion can be an effects lane.
- Bridge ducking/context from embedded native/standard hosts to parent with bounded same-origin, correct-source messages. Respect game-owned narration.
- Extend targeted browser regression coverage for actual music non-overlap, rotation, effects, mute/reload and silent phones.
- Report files changed, exact checks, failures and remaining risks. Do not commit, push, publish or edit unrelated files.

### Task 3: Integration QA and release (owner)
- Review runtime changes and map all approved assets. Add missing grounded event wiring for native games if not covered by Task 2.
- Run focused tests, typecheck/lint/build, full unit suite and required related browser/production render checks; report existing unrelated browser failures without weakening tests.
- Check audio source/envelope ownership in browser, real files, legacy rotation and media response hashes. Update STATUS.md and .logs receipt.
- Refresh remote ancestry/concurrent source before any release; preserve the prior working Site/version. Follow Sites workflow for exact source and build publication only after required verification.

## Download allowance decision

The user chose the existing allowance. Import 27 selected liked clips (12 music, 14 effects, one tavern ambience), skip 16 redundant or unavailable variants, retain all five existing tracks, and generate missing countdown accents locally. No new credits or paid generation.
