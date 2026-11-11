# Sketch & Sorcery main-menu winners

The default homepage and the older `?menu=1` menu load `/api/showcase/sketch-winners` when entering the menu, then refresh at most once per minute while visible. Navigation never waits for the feed. The normal menu presents the bounded winners card beside the role choice, stacking below it on phones. The older menu places the card below its existing navigation.

## Winner and image evidence

Only completed v2/v3 showdowns qualify. The selector uses each round's authoritative laughter ballot (100/75/50, with that round's v3 multiplier), keeps all positive first-place ties, and ignores artist-guess and overall match points. All-zero rounds, legacy relay, practice/bot drawings, fallback rounds, originals without a successful displayed transformation, and missing/mismatched receipts are excluded. A bot winner never promotes the next human into a winner.

The completion hook runs the projection independently before the generic History Books early return. Each candidate has a unique source match/round/entry key, frozen artist name, game/rules metadata, completion time, tie count, internal ownership and minimal immutable source/job evidence. `unapproved` is private and default; it freezes attribution before a later nickname change. An artist's affirmative preference promotes their own candidates to `pending`. Both actual byte types, dimensions and SHA-256 hashes are verified and stored for the durable copies under `showcase/sketch/`. The record becomes `ready` only after both copies are read back and verified. Partial copies and pending records can retry; one entry's failure never blocks the completed match. No provider or image-generation call occurs.

The public feed returns at most 24 entries plus `nextOffset` for rotation through further batches. Its allowlist is `id`, `artistName`, `round`, `tiedCount`, `completedAt`, `originalUrl`, `transformedUrl`. It never returns room codes, player IDs, ballots, prompts, source keys or credentials. The two media kinds are allowlisted and require the entry still be `ready` on every request. Feed and media responses use `Cache-Control: no-store`; the UI drops removed entries on refresh. Already downloaded images cannot be recalled.

## Consent and withdrawal

`GET/POST /api/rooms/[code]/showcase` uses the existing valid active player seat cookie. A host cookie alone cannot opt anyone in. Strict POST bodies are `{ "enabled": true|false }` or `{ "withdrawId": "skw_…" }`; caller-supplied artist IDs are rejected. POST enforces same origin and the normal rate limiter. Preference is remembered with the existing verified `callback_profile` cookie when available, without modifying its character schema or inventing an identity system. A new seat can inherit that affirmative saved preference when the preference component loads.

The player controller exports the compact `SketchShowcasePreference` control for completed main games. Turning it off withdraws this seat's candidates/featured entries from this room. Individual withdrawal is idempotent and ownership-bound. `withdrawn` and `hidden` are terminal to archive retries and future preference enabling. No supported owner/admin authentication was found in the repository, so this feature does not invent an admin endpoint. After the player seat expires this implementation cannot accept new ownership claims or promise self-service removal via that expired seat.

## Retention and backfill

Projection rows deliberately have no live-room foreign key. Verified copies use their own `showcase/sketch/` prefix, outside the `rooms/` cleanup prefix; room expiry does not delete them. The root integration retries up to 30 pending entries before cleaning a room. A still-incomplete pair stays private, and missing source bytes after cleanup cannot be reconstructed. Pending partial copies retain their verified metadata and can finish from their durable copy. Historical archives lacking authoritative state, matching immutable image receipts, successful partner media, or explicit consent are never guessed into public entries. No historical backfill was executed in this implementation; the first feed can truthfully be empty.

## Presentation and verification

The decoded original holds for two seconds, the aligned contained transformation dissolves for two, and the derived image holds for four before the next pair starts at its original. The artist name and pair URLs change together only after both images decode. Loads are cancelled on navigation, bounded to ten seconds, and failed entries are skipped without a retry loop. Pause, tab hiding and the legacy menu settings dialog preserve the current phase; reduced motion shows a static side-by-side comparison with manual navigation. Blob URLs are released when a pair is discarded.

`tests/sketch-showcase.test.ts` exercises actual SQLite SQL via the D1-shaped adapter and in-memory R2 bytes: round-aware ties, guess-total separation, exclusion, default-off consent, frozen attribution, immutable pair mismatch/hash rejection, pending copy retry, terminal withdrawals, cross-artist rejection, durable media after live sources are removed, paging beyond 24, and the real authenticated preference route/profile-cookie flow. These tests establish local logic/storage boundaries, not a hosted D1/R2 acceptance check or physical-device playback claim.

The takeover adds `tests/sketch-showcase-storage.test.ts`, using actual Miniflare D1/R2 and `cleanupExpiredRooms`, plus Chromium/WebKit menu tests with clearly labelled browser-only fixtures. Exact results and limits are in [the takeover acceptance report](fish-finale-acceptance-2026-10-31.md). No historical backfill was performed.
