# King Prompter Testing

## Disposable configured QA — 2026-11-02

`npm run qa:local` starts a loopback-only app and real local party Worker with ephemeral D1/R2/Durable Object storage. It generates a local-only secret in memory, removes inherited provider credentials and disables paid images. Its generated Wrangler config lives outside normal `.dev.vars` discovery and is removed at shutdown. Ports default to 3017/8789; override `CALLBACK_QA_APP_PORT` / `CALLBACK_QA_PARTY_PORT` if occupied. The installed local workerd binary uses compatibility date 2026-08-22; production retains its own configuration.

- `npm run qa:local -- --api` runs configured API and replay/parent-admission regressions, then tears down its owned processes.
- `npm run qa:local -- --browser tests/session-kick.browser.spec.ts tests/session-realtime.browser.spec.ts` runs selected Playwright checks with working realtime/retirement bindings.
- `npm run qa:local -- --browser` runs the complete browser suite. Provider-backed scenarios still require explicit opt-in; the launcher does not enable them.
- `npm run qa:local -- --benchmark` records five synthetic browser-action-to-host-snapshot latency samples in `.logs/qa-local/latency.json`. These local desktop measurements do not certify Wi-Fi, physical phones, TV frame times or scalability.

Review regressions cover opaque Frame-Up ballot identity, the Restoration role/phase disclosure matrix, two real HTTP matches with distinct archives, session-owned child admission and SQLite migration/bootstrap in both orders. Legacy published archives are preserved. A successful default `npm test` does not execute opt-in HTTP/browser checks; run the configured commands above as well.

The single-party admission cap remains enabled in QA. Standalone party fixtures record only their own host credentials in memory and end those rooms during teardown; tests must not leave native admission leases behind. Poll-specific tests explicitly select HTTP fallback; `party-realtime.browser.spec.ts` separately verifies all six packs through real sockets with host, four phones and a mirror. `party-close.browser.spec.ts` verifies that completed HTTP retirement permits the next party without raising the cap.

## Native Arcade verification — 2026-09-28

- The native Arcade suite covers all 19 catalog titles in the existing King Prompter room lifecycle. D1-backed games keep private choices/roles/aim out of host and spectator snapshots until reveal; Air Hockey, Tap Race, and Light Trails use the ticketed King Prompter Worker for low-latency realtime simulation.
- `CALLBACK_TEST_BASE_URL=http://localhost:5173 npx playwright test tests/arcade-schaetzorama.browser.spec.ts` covers five estimate rounds, private estimate visibility, result, and same-room replay. `CALLBACK_TEST_BASE_URL=http://localhost:5173 npm run test:browser -- tests/arcade-imposter.browser.spec.ts` covers three phone roles, secret clues, voting, reveal, and replay.
- Buzzwort room and Playwright tests cover role-authoritative turns, private cards, taboo detection, reveal, stable results, timeout/pause behavior, and same-room replay. Pantomime tests cover three-player setup, performer-only prompt, per-player attempt ordering, private guesses, exact answer matching, host reveal vs timeout, stable finalization, and same-room replay. No new Arcade title has been deployed from this worktree.
- Word Tiles unit/room coverage verifies dictionary and rack validation, private choice snapshots, corrupted persisted-history rejection, recomputed five-round scoring, timeout recovery, pause/resume, final results, same-room replay, and physical duplicate-tile limits. Its focused three-phone browser flow passed all five rounds, reveal, final scoring, and same-room replay (1/1).
- Schattenjagd tests cover original clue/case validation, private clue and vote snapshots, scoring, timeouts/abstentions (including zero points for abstainers when the team succeeds), pause/recovery, persistence, final reveal, and same-room replay. Its focused three-phone four-case browser flow passed with final scoring and replay (1/1).
- Flatterfluff unit/room tests cover seeded target waves, normalized input bounds, private locked aim, recomputed persisted scores, timeout fallback, pause/resume, D1 round progression and same-room replay. Its focused two-phone flow aimed on the SVG controller, completed all five waves, revealed scores, and replayed in the same room (1/1).
- Minions TD has focused authoritative order, wave resolution, timeout, pause/recovery, persistence, and replay checks; its King Prompter room browser flow passed (1/1).
- Light Trails tests cover bounded deterministic grid simulation, steering validation, simultaneous collision, deadline ranking, pause/recovery, role-safe snapshots, controller capacity, authenticated Worker input, and same-room lifecycle. Its eight-rider test verifies durable sequence guards, compact 10 Hz board checkpoints, and steering recovery; its two-phone host/phone flow completed steering, pause/resume, D1 result finalization, and same-room replay (1/1). The shared realtime regression flow for Air Hockey, Tap Race, and Light Trails passed (3/3).
- Magic Duell tests cover private 1v1 loadouts/casts, bounded deterministic glyph classification (including Playwright-style interpolated pointer samples), mana/damage resolution, timeout defaults, privacy, D1 round-trip, pause/recovery, and replay. Its two-phone browser flow draws actual SVG strokes through five rounds and replay (1/1).
- Chaos-Kommando uses four original team missions. Unit and room tests cover private tool choices, distinct-player coverage, timeout scoring, serialization, and same-room replay; the browser flow uses three phones to finish all missions and replay. Air Hockey/Tap Race browser flows verify real Worker sockets, input, results, and replay.
- Magic Arena uses two fixed phone seats, private simultaneous Strike/Guard/Focus choices, server-side health/energy resolution, timeout defaults, pause/recovery, tie breaks, and same-room replay. Tests cover hidden actions, winner persistence guard, late reveals, and a five-round two-phone browser flow.
- Kartentisch tests cover private dealt hands, legal follow-suit turns, hidden plays, trump scoring, timeout fallback, serialization, final reveal on every seated phone, and a three-phone five-trick browser replay.
- Dungeon Party tests cover three-player minimum/eight-player capacity, hidden choices, deterministic encounter resolution, a reachable party defeat, matching damage labels, defensive timeout defaults, stale/duplicate input rejection, serialization, pause/resume, score/result persistence, and same-room replay. Three-phone browser flows passed for both escape and defeat.
- Final merged verification on 2026-09-28: `npm test` reports 357 checks (350 passed, 7 skipped); typecheck and lint pass; `npm run build` completes. The broad browser matrix passes 39/39 scenarios when excluding the three Worker-backed realtime games. Air Hockey, Tap Race, and Light Trails still fail locally because the Arcade ticket sync endpoint returns 503 with a locally launched Worker; production Worker bindings and credentials are also not configured in the Sites environment. No claim is made that those three realtime games work on the live Site until that service is deployed and bound.

Updated: 2026-09-28

## Verification record

- Character-piece editor, 2026-09-03: lint, typecheck and production build pass. The unit/integration suite discovers 82 checks: 77 pass, five intentional skips. Seven added checks cover all 13 presets and all available parts, independent eye styles/expressions, transform geometry, payload rejection, local/server/reconnect/host preservation, hidden parts and rendered editor controls. Interactive browser/touch QA was not run in this change; verify drag, numeric edits, face zoom, undo/redo and saving on a real phone.


- Host-and-phone workbench gate, 2026-09-02: lint, typecheck, unit tests, all 21 Playwright scenarios, and the production build pass. The unit suite discovers 75 checks with 70 passing and five intentional skips; browser checks verify live same-origin host/phone previews, isolated Developer Studio edits, Bowl's human-only launch path, narrow workbench layout, and the complete pre-existing multiplayer/presentation matrix.
- Presentation-overhaul release gate, 2026-09-02: lint and TypeScript validation pass; `npm test` discovers 74 checks with 69 passing and five intentional skips; `npm run test:browser` passes all 20 scenarios; the production build passes.
- New presentation coverage proves first-load resume, stale-event rejection, skipped polling phases, stable Play Again keys, semantic deduplication, joins/reconnects/locks, score deltas, ties, image retry/fallback/ready events, no pre-reveal authorship inference, and reduced-motion policy.
- Browser presentation coverage now checks all eight shipped packs enter their own CastleRoom, host/display stay no-scroll at 1366×768, room and pigeon assets produce no console errors, reduced motion removes travel/ambient loops, phone writing/voting remain decoration-free, the lobby pigeon does not intersect the QR code, and Bowl host/phone setup remains live.
- Settled 1366×768 captures were reviewed for Grand Hall lobby, Legacy reveal, Hall of Echoes results, Banquet Hall results, Scriptorium results, and Evidence Vault results. The generated room backdrops, canonical pigeon, broadcast header, stage hierarchy, and phone controller treatments were evaluated in rendered gameplay rather than by source inspection alone.

- Bowl of Fools focused engine coverage proves its four-human floor, no-solo/no-bot contract, balanced editable teams, scroll validation/fallback/anonymity, Correct/Pass/timeout rotation, bounded clue-giver drawing, one-word validation, full bowl return/starter rules, cross-transition undo, sudden death, strict serialization, and clue-giver-only reconnect secret.
- `npm run test:browser` — 20/20 pass on 2026-09-02, including the complete regression matrix, all-pack room ownership, reduced motion, Bowl setup filtering, a complete Same Table three-round loop, Remote Live phone presentation, and authenticated expiring media signaling.

- `npm run lint` — pass, zero errors or warnings.
- `npm run typecheck` — pass.
- `npm test` — 74 checks discovered: 69 pass and five intentional legacy/opt-in checks are skipped. Verified 2026-09-02.
- Current unit coverage includes the complete three-frame Comic lifecycle, King Prompter's overlapping canvases and Royal Restoration, fixed 100/150/300 vote values, three-model image retry order and byte confirmation, the six-card/150-point feedback ceiling, the two-seat normal-room minimum, retired-mode rejection, deterministic bots, display-role media access, phase authority, snapshots, scoring, replay variety, avatars, and Legacy Standard memory behavior.
- `node --test tests/rendered-html.test.mjs` — 2 production-Worker SSR/starter-removal checks pass after `npm run build`.
- Local D1 integration — opt-in and skipped by the documented 2026-08-27 `npm test` run because no base URL was supplied. When configured, its scenario covers create, three joins, audience-v1 rejection, late-join rejection, answer, anonymous vote, winner memory, reveal/score, host/player reconnect, and cross-room isolation.
- Focused Grand Hall Playwright verification — 3/3 scenarios pass, covering the complete twelve-action order and routes, unique accessible names, keyboard order and focus restoration, persisted device settings, direct menu return, Skip Intro, missing media, rejected playback, reduced motion, Join Host Display validation, and the requested host/phone viewports.
- Grand Hall poster verification — the focused suite additionally covers poster failure before hydration, retention of the complete CSS-fallback menu, successful poster readiness before screenshots, and selection of the dedicated tall/short phone sources. AVIF/WebP metadata and decode were validated for all ten delivery files.
- Full `npm run test:browser` — remains required before the Checkpoint F release candidate. Its wider multiplayer and opt-in live-image matrix covers Comic, developer, one-phone, birthday, King Prompter, and Legacy Standard scenarios.
- `npm run build` — pass; every page/API route and bundled font asset emits to the Worker output.
- In-app preview inspection — the integrated poster and semantic Grand Hall menu were inspected at 1366×768 and 390×844. The browser selected the 1920×1080 desktop AVIF and 780×1688 phone AVIF respectively; both had no horizontal overflow and retained Join Game in the first phone view.

## Browser matrix

- Responsive entry/join: the Grand Hall captures and layout checks pass at 1366×768, 1920×1080, 2560×1440, 390×844, and 375×450; player join remains covered at 360×640, 412×915, 375×667, and 430×932.
- UI vertical slice: host plus three independent phone contexts; Unicode nickname; answer lock; pairwise feedback submission and 10-second cooldown; player refresh with lock restoration; anonymous vote; memory clue; reveal; clean host console.
- Solo UI vertical slice at 390×844: customize Standard mode, enable two local bots, create/start from the same phone, skip intros/locks with the embedded host controls, submit and vote as the human, and render all three revealed answers with authors/applause without horizontal overflow.
- Testing workbench vertical slice at 1366×900: launch from `/developer`, render the live host and 390px-wide phone routes together, start and skip through authoritative controls, open the phone's Developer Studio during Round Intro, change the prompt and score cap, continue into answering, and verify the two-item device-local change package. Bowl coverage separately verifies its first human seat, four-human guidance, unavailable bots, and 430×932 responsive workbench controls.
- Solo birthday full match: one browser context retains separate host/player cookies, the human is assigned Birthday VIP, two bots complete every turn type, all seven rounds reach post-game results, and Play Again is available on the phone.
- Full deterministic matches: Standard/3 with replay; Standard/6; Standard/10; Monster Factory/6.
- Birthday/6 covers VIP designation, private four-option choices, Birthday Bets scoring, all six mini-game styles, final awards, and a 1366×768 no-scroll results screen.
- King Prompter/3 completes both overlapping canvases and Royal Restoration through the real job endpoint with no-provider concept-card fallbacks, verifies anonymous authorship, fixed-value favorite voting, tie preservation, the shared collage, final results, and replay.
- Live-image solo King Prompter creates one human and two bots, queues every contribution through the real job endpoint, completes both canvases and Royal Restoration, and asserts the human can finish the complete image lifecycle.
- King Prompter ballot assertions verify all images reach the human phone, the player's own entry is marked ineligible, the server rejects self-voting, and every canvas/restoration ballot accepts one eligible favorite.
- Let's Make a Comic/3 completes Setup, Escalation, and Punchline through the real job endpoint, verifies anonymous ranked image voting, locks three connected panels, checks replay, and captures a readable no-scroll 1366×768 final strip. Its live-image solo scenario confirms bots create candidate panels and rank the human into all three winning frames.
- Standard/6 also keeps a live host page open through the match, asserts Tonight's Lore is visible without host-screen scrolling, captures `.logs/host-tonights-lore-1366.png`, and checks its console.
- Role filtering inspects raw host voting snapshots and asserts no authorship appears before reveal.

## Callback coherence gauntlet

- Unit fixtures assert that only winning/tied-winning answers become memories and that the deterministic primary selection does not use submission speed.
- The Gum Reaper quality fixture must preserve Anchor, Voice, World, and Consequence meaning in both callback and Remix fallbacks.
- Runtime candidates are rejected unless source IDs are distinct, safe graph memories; the prompt is unique; the question is singular and final; and semantic connection, coherence, answerability, and surprise clear their thresholds.
- Social rounds are asserted not to create memory. Crowd Control uses a variable-size 100% distribution scorer; Read the Room retains its exact ten-chip formula.
- `.prompts/callback-quality-corpus.md` documents accepted and rejected combinations. Real-key review must score a representative corpus for meaning preservation, causality, answerability, surprise, and economy—not mere schema success.

## Covered security and failure risks

- Secure room codes, high-entropy cookie restoration, grapheme/Unicode limits, newline normalization, escaped HTML-looking text, Catch rules, and prompt-library minimums.
- Immutable score events, ties, deterministic ordering, stale/duplicate actions, deadlines, D1 compare-and-swap races, room isolation, role-filtered responses, and stable v1 feature errors.
- Local and remote moderation exclusions mark blocked memory nodes unsafe before callback/image reuse.
- Server-created prompt hashes and job leases prevent caller-authored paid work; top-level Anchor/final images survive round changes; unavailable AI/image/R2 paths finish with deterministic prompts and concept cards.
- Solo engine coverage completes a Standard match with one human and two bots, verifies bot visibility/reconnect snapshots, and asserts that no OpenAI/image/lore job effect is created.

## Remaining private-production checklist

1. Configure the intended private provider credentials in Sites settings—Cloudflare credentials for the active text/image paths and an OpenAI key only for the optional OpenAI paths being exercised—without exposing any secret to source or logs.
2. Run a private Standard candidate with one host and three isolated players.
3. Verify real structured lore, moderation rejection, Anchor image, final image, R2 retrieval, reconnect, Tonight's Lore, and Play Again.
4. Inspect production network, console, Worker logs, and Room A/Room B isolation.
5. Change access to public only after every check passes, then verify clean-browser anonymous entry and QR join.

## Persistent Callback session verification

Focused service tests cover create-before-selection, capacity, role isolation, retained seat IDs, version races and code collisions. The new session browser scenario uses a host and two independent phone contexts through main/online/main changes, character Save/Undo/reload, and host/phone reload. Scanner denial and foreign QR handling preserve manual entry. Existing engine, controller and rendering suites remain release checks. Browser automation does not certify physical camera behavior or network/game feel.
