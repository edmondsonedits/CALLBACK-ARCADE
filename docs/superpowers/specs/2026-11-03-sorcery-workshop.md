<!-- User revision 2026-11-03: fish is independent; no fish preparation in Sorcery. This supersedes earlier encore references. -->
# Sketch & Sorcery: modes, workshop and returning creations

Design proposal, 2026-11-03. Source inspected: `4303bd05492295449ca5ad47e51fe308b6e6802e` (published v129). This document is a plan, not implemented behaviour. Numeric tuning below is a recommended initial configuration, not a measured claim about enjoyment or duration.

## Product contract

Preserve the existing long game's human-drawing transformation contract, prompt-writing/examples, shared curse selection, ranked scoring, artist guesses and 1x/2x/3x multipliers. No post-round quality questionnaires. Do not introduce further family-themed prompts or change the user's existing prompt content. The explicitly requested name Edmondson Hall of Questionable Art belongs to the new award collection.

Add host-selected Quick/Long modes and a separately launched independent fish game; optional activities for submitted players; bounded small points for prompt preferences; persistent owner-controlled scenery and historical fish; the requested original/enchanted reveal; and a separate funniest-art nomination after each round's scores.

No paid AI calls for any workshop, nomination, reaction, minigame, scenery or historical-fish feature. AI never decides scores, eligibility, identity or phase transitions. Drawing transformations keep the existing validated fidelity instruction; do not rewrite it absent demonstrated failure samples.

## 1. Setup and session structure

Host lobby offers two cards, with Long selected by default to preserve the current experience:

| Setting | Quick Spell | Long Sorcery |
|---|---|---|
| Main rounds | 2 | 3, existing progression |
| Round 1 | Existing shared-prompt round, 1x | Existing shared-prompt round, 1x |
| Round 2 | Existing last-place-chosen shared curse, 2x | Existing last-place-chosen shared curse, 2x |
| Round 3 | Not played | Existing private modifier/starter final, 3x |
| Drawing | 2 minutes each | 4 minutes each |
| Anonymous tour per entry | 6 seconds | Existing 10 seconds |
| Artist reveal per entry | 12 seconds | Existing 20 seconds |

Other active vote/guess timers and transformation timeout stay unchanged initially. Existing all-ready advancement remains, except the bounded workshop hold described below. More Thinking Time still adds 50% to eligible interactive clocks. Host can pause for conversation; no hurried drawing deadline is silently imposed on accessibility users. Quick changes match length, not ballot math or the curse's meaning. Support a new rules version; do not repurpose legacy version 2, whose two-round scoring differs.

The Last Fish Swimming is an independent game in the main party catalog and persistent lobby. Launch directly into its own peaceful/shark and drawing-time configuration, without playing Sorcery, creating fake main results or using a temporary-test path. Keep the current four-minute fish default and 90-second/2–6-minute selector. Fish owns its own roster, match, replay, results and return-to-lobby flow. New Sorcery games never advertise or launch a fish encore, and the Sorcery workshop never offers fish preparation. Existing active legacy fish rooms remain readable and finish safely. Sorcery length freezes at start; replay/next-match may change length.

Do not advertise precise play durations until measured with 3, 6 and 10 humans. Setup can state two versus three rounds and drawing time accurately.

## 2. The submitted-player workshop

Only after an authoritative main sketch receipt is accepted, show optional activity cards. Opening a workshop never constitutes submitting the main drawing. A player can return to the activity menu at any time; progress saves. Main submission remains locked.

| Activity | What it does | Competitive reward |
|---|---|---|
| Add to our aquarium | Create/edit/position transparent scenery | None; persistent personal contribution |
| Choose a favourite prompt | Pick one of three existing catalogue ideas | 25 per valid rewarded ballot; 50 total per match |
| Pocket pairs | Simple 6-card, 3-pair solo memory game | Personal best only |
| Practice drawing | Familiarise yourself with the same tools | None |
| Cast a reaction | Brief room animation and occasional narrator quip | None |

Show the reward cap directly: e.g. `25/50 workshop points earned`. Cosmetic work must never be graded by AI or client-reported stroke count. Drawing speed and artistic skill do not determine workshop rewards. Don't award main points for minigame speed, scenery uploads, reactions or number of brush strokes; those are easy to farm and disadvantage touch users.

Workshop drawing uses the existing fish/editor foundation, with an explicit transparent scenery mode and reusable draft handling. Practice never accidentally enters the gallery or fish roster. Pocket pairs can be paused/saved in one click, has no opponent, no stakes and no new currency. It never steals focus from required voting/guessing.

### Shared timing and the extra ten seconds

The present engine advances immediately when everyone submits. Replace that implicit race with a persisted workshop closing state for new rules only:

1. Main drawing receipts arrive normally. Transformation jobs may start immediately after each receipt; do not postpone jobs to wait for side activities.
2. The server detects the first instant when all required main submissions are accepted, or the main drawing deadline closes missing slots. Freeze the already-open scenery editor leases. No newly opened editor can extend this boundary.
3. If at least one such editor has an active lease, set one shared `workshopFinishUntil = boundary + 10,000ms`. Announce once: “The main sketches are sealed. Workshop artists, ten seconds to finish—unfinished work will be saved.” Captions remain available without audio.
4. All active editors share this same deadline, even if ten people are drawing. No per-player stacking, reopening, retry or reconnect can reset it. If everyone exits earlier, release the hold early. If nobody was editing, no hold and no finish announcement.
5. Work saves automatically at expiry; do not force an incomplete drawing into the published tank. Previously published revision remains visible until the owner explicitly places a new revision. A finished revision already acknowledged before cutoff can be committed. Unfinished revisions reopen later.
6. Gallery eligibility requires both the normal transformation completion/fallback decision AND workshop closure. The hold overlaps processing; it adds at most ten seconds when processing finishes immediately. Never wait on an R2 upload beyond the hold.
7. During any remaining transformation wait, prompt choices, practice, pocket pairs and bounded reactions remain available. Persistent scenery editors next reopen during a later drawing workshop or a break; this prevents repeated closure deadlines.
8. Required gallery/vote/guess/reveal phases hide/pause all side activities and flush drafts without waiting for networking. Host skip/reset, expiry, removal and abandoned rooms cancel the hold. Pause freezes the clock, and resume shifts the deadline; backgrounded clients do not accumulate elapsed rewards or edit leases.

Editor leases expire after 15 seconds without a heartbeat; an already-frozen ten-second closing cohort cannot grow. Lease state is not proof of drawing effort and pays no points. A disconnect may consume the remaining one-time ten seconds, but never an unbounded delay. Deadline-expired late work stays a draft. Timer narration uses the existing authoritative event provenance, not local setTimeout or fresh generated speech.

## 3. Prompt preferences and bounded points

This is a preference, not a quiz. There is no correct answer and no extra reward for choosing the majority favourite. Cards say: `Which would you most like to draw?` Show three distinct existing catalogue prompts, excluding current-match prompts/private assignments and already-compared combinations for that profile. Randomise positions independently of prompt quality. A Skip/None appeal option must exist, counts as feedback but not a paid selection.

Recommended competitive cap: two rewarded choices per entire match, 25 points each, no round multiplier. At 25 every ten seconds uncapped, four minutes could yield 600 points and encourage rushing the actual drawing; the cap removes that exploit. After 50, honest preferences may continue with explicit `feedback only` copy. Further feedback has a separate low rate limit.

Protocol:

- Server issues one opaque ballot ID bound to room/match/round/participant/profile, three stable prompt IDs, issued timestamp, `notBefore = now + 10s`, expiry and algorithm version. No parallel active ballots. Reopening or changing tabs returns the same ballot, not three new choices.
- Player can choose/change a highlighted favourite during ten seconds, then press Confirm. No automatic vote that could record an accidental touch. Earliest next ballot is after server acceptance. A foreground-visible eligibility lease avoids billing background tab time as participation, but cannot prove a human read the text; never claim it can.
- Server checks main submission, allowed phase, membership, unique profile seat, issued options, authoritative clock, expiry and reward quota in one version-guarded transaction. Client timestamps/score values are ignored. A `25` reward and ballot acceptance are atomic and replay-safe.
- Unique event key `match:workshop:profile:reward-slot` prevents duplicate points through action IDs, tabs, reloads and request races. Bots and spectators get no competitive rewards and do not train the catalogue. Missing/duplicate profile association permits practice but not reward claiming until repaired.
- Keep workshop points as a separate breakdown in the same match score, maximum 50, unmultiplied. Existing laughter and artist-guess formulas stay exactly as they are. Existing main-match score recomputation currently rebuilds totals: include unique workshop events in that projection so later reveals cannot erase or duplicate them.

### Fair opportunity for slower drawers

Cooldowns stop fast clicking, but do not fix the unfair advantage of having more waiting time. Give all participants access to their unfilled two reward slots during the post-round intermission. They can use this even if their drawing timed out, provided they were an active main-round participant; do not exclude the players needing help most.

After points, the Hall nomination and workshop intermission have a shared maximum 30-second clock: roughly ten seconds to nominate, twenty seconds for up to two prompt ballots. All options are available immediately; this is guidance, not a forced sequence. If everyone has nominated/abstained and no player has an outstanding reward opportunity or activity, advance early. A missing/disconnected player cannot hold beyond 30 seconds. Required main ballots always take priority.

Never announce a final match winner until the last intermission's rewards are settled or expired. Show base round scores first as requested, and a clearly labelled workshop-point adjustment if a player earns their catch-up points afterward. Final standings then show the authoritative combined total. No extra questionnaire is introduced: Hall nomination is the requested award, prompt feedback is optional gameplay.

This bounds farming, but cannot make online anonymous preferences proof of sincerity. Do not introduce invasive tracking to pretend otherwise. A malicious person with many browser profiles cannot be perfectly identified without accounts; use room membership, quotas and robust aggregate weighting.

### Learning which prompts work

Preserve all existing prompt content and player-written prompt voting. Preference data influences which catalogue examples are featured/offered in future matches, not who wins the current prompt election or which player gets points.

Log exposures, chosen ID/skip, profile pseudonym, rules/content mode, algorithm version and source ballot. Aggregate independently from score events. Count a profile's preference for a given prompt at most once per day and cap counted comparisons at 20 per profile/day. Repeated feedback may be retained as diagnostics but receives no extra learning weight. Give each room a bounded contribution so one long-running room cannot dominate.

Initial sampling: 70% weighted exploitation, 30% uniform exploration, smoothing prior to protect unseen prompts, maximum 2:1 sampling weight relative to baseline, no global rank adjustment before 20 distinct participating profiles across at least five rooms. For a recurring small family group that never reaches twenty profiles, a private host-profile preference layer may activate after three matches and three distinct participating profiles; its influence is confined to that host's future rooms, capped at 1.5:1, and never exposes who preferred what. It cannot raise global weights or earn extra points. Freeze weights for a match. Exclude incompatible content-mode prompts. Distinguish frequency of exposure from frequency of preference; no raw win-count popularity contest. Version/report aggregates and allow rollback to uniform sampling. No deletion or rewriting of less-liked prompts automatically. This is a product tuning proposal to calibrate with real data.

## 4. Returning player creations

Use the existing private `callback_profile` cookie and server-side hash as the ownership capability. Never link by nickname, room player ID, avatar resemblance or client-provided owner ID. Cross-room stable profile hashes must not appear in snapshots. A shared browser is one profile; clearing cookies/incognito/new device does not automatically restore a collection. Initial release should explain this plainly, without introducing account/login requirements. Cross-device recovery is a separate feature, not an implied guarantee.

Separate private collection storage, room-local display permission and public Hall publication. Showing scenery in a private room never grants permission to put it on a public website. Provide owner Hide/Delete and host Hide from this room. Revocation invalidates future inclusion and active cached manifests. Deleting an asset also removes it from historical-fish candidates and future scenery manifests; preserve tombstones so delayed upload retries cannot resurrect it.

### Scenery library and placement

At most five active scenery pieces per owner in a room. Newest to oldest suggested scales: 100%, 85%, 72%, 61%, 52%. Newest is largest, fifth/oldest is smallest. “Age” means creation order, not elapsed calendar time or last edit. Editing does not make an old object new or reset its scale. A sixth item remains in the private library and replaces the oldest active item, with an understandable placement preview; it is not silently deleted.

All five pieces from each present owner can appear together: ten players means up to fifty small objects. Reserve a scenery layer behind fish, text and shark action. Cap each newest piece's visible bounding box to about 8% tank width and 12% height; older pieces scale down from that. Device-aware culling can reduce rendering work, but never arbitrarily remove an owner's five from the stored layout. Test the density with ten players before locking these numbers.

Players choose normalised x/y placement using a miniature tank and simple floor/backdrop layer choice. Clamp out of score/UI safe zones. Collisions between players' scenery can overlap intentionally; none has physics, scores, blocking hitboxes, voting eligibility or shark targeting. Each player edits only their own objects. Host can hide an inappropriate object locally. Publish bounded decoded PNGs/WebPs with real alpha, dimensions, byte and pixel limits; no SVG/script/untrusted remote URLs.

Editable source and committed raster are separate immutable revisions. Drafts autosave locally after short debounce and to private profile storage after a bounded interval/checkpoint; show Unsynced if offline. Save before every activity change. If a player returns, restore the latest acknowledged revision plus a newer local draft after a conflict check. Use revision guards for multi-tab/device edits; offer Keep this version/Reload saved version instead of silently overwriting.

Owner library initial limit: 20 saved scenery pieces, five displayed. At capacity, ask them to choose an archived piece to replace; no automatic loss of older creations. Limit private history retention separately and visibly (e.g. one current source plus ten undo checkpoints), and make archival/publication independent. Limits are safety controls to test and expose honestly, not a promise of infinite storage.

### Historical fish swim-bys

Save verified previous fish art with creator profile ownership, source-match provenance and immutable original bytes; this does not add AI work. Independently copy and verify bytes outside the `rooms/{roomId}/` prefix before room cleanup can delete source media. No archive receipt may reference an expiring room blob as its permanent copy. On a new independent fish match, freeze an eligible pool from currently participating owners who have allowed room display. Never fetch a public global art feed or infer ownership by name.

Only tutorial/drawing/grace waiting scenes can show historical fish. First appearance after about 15 seconds; subsequent appearances every 20–35 seconds, one at a time, lasting 5–7 seconds. Shuffle owner order with server seed and exhaust present owners before repeating; shuffle each owner's art separately. Label briefly `From [nickname]'s previous aquarium` so old fish cannot be mistaken for contestants. Historical art has distinct internal IDs and cannot enter votes, counts, scoring, champion lists or shark targets.

At readiness/reveal/voting/cinematic, abort any swim-by and clear historical layers immediately. During shark sequences only this match's involved fish appear; scenery can stay dimmed behind the action but must never cover it. Pause freezes swim-bys; reconnect resumes the current authoritative scene without replaying a backlog. Removed/leaving owners are removed from the display pool on roster update. Reduced motion uses a brief still guest card or skips the flourish. Empty/missing/deleted archives simply produce no visitor.

## 5. TV reveal sequence

Use the existing reveal phase, disclosure boundary and artist reveal timing. Do not expose original/name before the server-authorised reveal begins. Once authorised:

1. 0–0.6s: enchanted art held alone.
2. 0.6–1.8s: original fades over the enchanted image to 50% opacity.
3. 1.8–2.5s: hold at 50%, allowing the room to compare.
4. 2.5–3.5s: original reaches 100%.
5. 3.5–4.7s: original moves into the left frame as enchanted art settles in the right frame; reveal the artist name at the existing authorised beat.
6. Rest of the phase: stable side-by-side comparison with original/enchanted labels and existing scores/emotes.

Use the same contain-fit square framing so crossfade compares corresponding pixels. The overlay is illustrative, not a guarantee AI output is geometrically identical. Cache/readiness checks before starting; if either image is missing show the available original with truthful fallback copy, no empty fade. Reduced motion goes straight to the comparison. Late joins seek from server elapsed time; pause/resume and replay follow existing authoritative presentation keys. Shared scene is never restarted merely because an asset rerendered. No added narrator interruption over laughter; use existing narration channels and priority.

## 6. Edmondson Hall of Questionable Art

After each round's displayed points, ask `Which one made you laugh the most?` One nomination or abstention per eligible main-round player, no self-nomination, no bots. This is separate from ranked scoring, carries no extra points, and cannot change curse chooser or winner. Use already-revealed round art. Name the vote's role clearly: Hall nomination, not a second scoring ballot.

All tied highest positive totals receive the round's Hall honour. All abstain means no inductee. Existing public showcase currently derives laughter-score winners at match completion; do not silently redefine those records. Store an independent award kind and nomination evidence; keep any existing winner gallery correctly labelled. One immutable nomination result per match/round, idempotent on reconnect/retry.

An award is not publication consent. Award appears privately in the room immediately. Existing owner opt-in and withdrawal controls gate the public Hall; off means `Nominated · kept private`. For consented inductees, copy and verify original and enchanted bytes before marking ready, preserving existing pending/ready/withdrawn semantics. Later consent may publish the existing award; it must not rerun the vote or fabricate evidence. Room cleanup cannot delete published permanent copies; withdrawal hides/removes their public access. Artwork report/hide controls reuse existing product conventions.

## 7. Reactions and pocket activity presentation

Offer a few fixed reactions, e.g. sparkles, tiny applause and a wobbling ink bottle. No arbitrary text or main-art hints on the shared display. Two reactions per player/round, at least 20 seconds apart; global visual minimum spacing five seconds, only one current effect. Drop/coalesce excess rather than build a queue. Narrator comments at most once per 20 seconds and never over the ten-second warning or required instructions. Reactions only in drawing/transformation/intermission, never anonymous tour/guess/reveal/shark suspense. Phones remain silent. Motion respects pause, mute and reduced motion. Lines are local authored text/approved existing voice assets; unavailable voice means captions, not a paid synthesis job.

Pocket pairs stores only local progress and an optional profile personal best. No competitive result API is necessary. No negative points, streak rewards, multipliers, purchase flow, public rankings or cards requiring explanation. It suspends immediately when the server phase changes.

## 8. Architecture and data integrity

Current code points: `server/arcade/sketch_showdown.ts` owns all-ready advancement and rebuilds score totals; `lib/arcade/sketch-relay.ts` owns timers/contracts; `server/sketch-showcase.ts` owns opt-in copied public winners; `server/profiles/*` and `app/api/profile/route.ts` implement browser capability identity. Fish uses `server/arcade/fish_finale.ts`, `lib/arcade/fish-finale.ts`, `FishTank.tsx` and `FishMesh.ts`.

Introduce new rules version/settings for Quick/Long rather than mutating older rooms. Persist named main-round plan (normal/curse/final) instead of deducing semantics from round count. Add narrowly scoped workshop module/contracts and a persistent player-creation service. Use stable profile ownership association established server-side, not a cookie hash supplied in request JSON.

Proposed durable entities: creation metadata/revisions/drafts and owner-room manifests; issued prompt ballots/preferences with counted-learning status; uniquely keyed workshop score events; Hall nominations/results; old-fish ownership receipts; settings and one-shot round workshop close state. Keep blobs in R2 with immutable versioned keys, editable source bounded in private storage, and ordinary snapshots limited to authorised asset handles. Public Hall, private collection and current-room visibility are distinct access policies. Every new relational entity requires matching Drizzle schema, migration and runtime DDL, indexes and cleanup policy.

Atomicity: action receipt + reward quota + score event + accepted preference commit together. Publish copied art only after valid bytes/hash/storage confirmation. Failed upload leaves an editable draft and prior published revision. Retries are idempotent, snapshot versions monotonic, and event histories bounded. Handle pause, room reset, owner removal, failed DB/R2, multiple tabs, expired ballots and stale clients explicitly. No private profile identifiers, drafts, hidden artists or future assignments in public/role-inappropriate snapshots. No production test data or paid providers in verification.

## 9. Evidence borrowed from other games

- Jackbox documents returning characters in subsequent Champ'd Up games: https://www.jackboxgames.com/games/champd-up . Apply recognisable returning creations, not its combat rules.
- Jackbox documents audience reactions, alternative activities and visual interactions during other players' work: https://www.jackboxgames.com/blog/how-audience-play-along-differs-in-each-jackbox-game . Apply lightweight, interruptible side participation.
- Player accounts report confusion/loss around saved Champ'd Up history: https://www.reddit.com/r/jackboxgames/comments/15mwnv1/ and https://www.reddit.com/r/jackboxgames/comments/1czplrv/ . These are individual accounts/search-visible evidence, not prevalence estimates. Ownership, successful-save confirmation and collection recovery need explicit handling.
- Board Game Arena documents multi-account boosting as a real competitive issue: https://en.boardgamearena.com/news?id=302 . Our lightweight profile model cannot guarantee one human per profile; bound reward/learning impact rather than claiming a perfect fraud detector.

All formulas, quotas, grace rules and UI timings above are original design proposals derived for this codebase, not claims those games use the same implementation.

An independent read-only architecture review confirmed the main hazards: immediate all-ready advancement; early uploads requiring an active fish finale; room-media deletion on expiry; independent session/profile identities; existing score recomputation; and the winner-only public showcase. Those findings are incorporated above. The reviewer suggested up to three rewarded choices; this proposal deliberately uses the tighter two-choice/50-point match cap and a shared catch-up intermission to reduce pressure to submit main artwork early.

## 10. Build and validation order

1. Independent fish catalog/lifecycle and rules-versioned Quick/Long Sorcery; preserve old matches and tests.
2. Profile ownership, private creation storage/revisions and drafts; test revocation before cross-room display.
3. Workshop lifecycle and one shared ten-second hold; practice, scenery and simple reactions.
4. Prompt ballots, atomic 25-point awards/cap/catch-up and frozen aggregate weighting; ship uniform sampling until evidence threshold exists.
5. Scenery placement/aging and historical fish scheduling; stress 50 scenery objects, no competitive contamination.
6. Reveal choreography and Hall nomination/publication consent.
7. Pocket pairs after the above flows are stable; integrate the existing save/interrupt framework.

Release tests: old/new rules, both Sorcery modes and independent fish flows, host/phone/reconnect/pause, slow drawing and timeouts, last receipt versus upload races, exactly-once ten seconds/narration, all activities interrupted safely, zero/fifty/duplicate workshop rewards, duplicate profiles/tabs, phase-tampered ballots, aggregate poisoning limits, 50 scenery pieces, owner disappearance/deletion, stale manifests, independent fish replay, missing archive assets, reduced motion and only new competitive fish during shark scenes. Full normal release gates before deployment. Automated tests do not establish group enjoyment, real Wi-Fi performance or physical-phone quality; human sessions must validate reward fairness, side-activity distraction, scenery density and Quick/Long pacing.
