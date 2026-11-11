# Fish finale takeover acceptance — 31 October 2026

## Source and scope

The supplied revision-2 handoff covers the optional fourth fish activity and the persistent main-menu winners showcase. Both were already present in current Site source v101, commit `936ccb1ea310913dc54f189c90a719c6c0aa9041`. The Sites deployment service confirmed the v101 deployment succeeded; that contradicts the older STATUS checkpoint wording. This takeover preserves that source and the separate ongoing narrator work.

Working checkout: `H:\ChatGPT\Sketch-Sorcery-Fish-Finale-20261031`, branch `codex/fish-finale-completion`. Local preview: <http://127.0.0.1:4187>. During final verification the other chat published v102, commit `e11d5cdb040d405cac9466770d74a65dd5d24738`. Its narrator changes were fast-forwarded into this isolated branch without conflicts. The deployment service confirmed v102 succeeded. These additional fish/menu fixes have not been pushed or published.

## Follow-up retest requested by the user

The application source at `6ca32d7371d0850d6682f03cee05345c0ce202a2` was tested again. This follow-up changes tests and documentation only.

- Fresh full serial suite: **1,168 passed, nine existing skips, zero failures** (101.7 seconds). All nine production-render checks passed again.
- **Nine distinct browser scenarios accepted:** Chromium ten-player shark flow; WebKit three-artist transparent-editor/peaceful/reload flow; three menu scenarios in each engine; and the new Chromium visible-control/recovery scenario. Focused reruns replaced the initially failing test attempts described below.
- The new control scenario drives visible mode selection, the real 90-second timer option, start buttons and all three phone ballot buttons. It verifies saved submission/ballot state after reload, gentle motion, actual WebGL loss, visibly painted Canvas fallback, restored WebGL artwork, keyboard artist-card open/close/focus restoration and return to identical main results. No extra image jobs were created. Final run: 1/1 passed in 2.5 minutes.
- Fallback, restored-renderer and artist-card screenshots were inspected in `.logs/fish-acceptance/controls/`. The fallback assertion requires more than 200 opaque blue artwork pixels on the rear Canvas layer; the restored screenshot visibly contains all three fish.
- Final TypeScript, focused lint and staged whitespace checks passed. The production application code and existing build are unchanged from the preceding checkpoint.

The first menu attempt caught a test sampling the fade while its browser pause was still pending (opacity changed from 0.574956 to 0.583355). Instrumentation observed `pending: true` in both Chromium and WebKit. The test now waits for the visible Play-button state, paused CSS state and `Animation.ready`, then still requires **exactly unchanged opacity for 2.4 seconds** and the same fade phase. Six diagnostic repetitions and the final three menu cases per engine passed. The asynchronous pause behavior is documented in [MDN Animation.pending](https://developer.mozilla.org/en-US/docs/Web/API/Animation/pending) and [Animation.ready](https://developer.mozilla.org/en-US/docs/Web/API/Animation/ready).

The new control test initially assumed the API fixture's 90-second setting while the actual UI default was 120 seconds, then used an overly exact label selector. It now explicitly chooses the visible 90-second option, verifies the authoritative saved duration, and uses a 15-second UI action timeout. No production timer was shortened and no failing behavior assertion was removed.

Raw follow-up logs use `.logs/fish-final-recheck-*.log`; the failing attempts remain identifiable separately from their passing reruns. Physical device/audio, WAN/realtime Worker and hosted provider/R2 boundaries below still apply. No push or publication was performed.

## Changes in this checkpoint

- Increased the bounded guarded-write retry budget to support all ten ballots arriving together. A synchronized ten-seat regression reproduced two rejected ballots at the old limit and verifies ten unique accepted ballots, unchanged main results and idempotent replay after the fix.
- Player and spectator snapshots/media reveal fish progressively. Host and paired TV roles may preload anonymous textures; an artist retains access to their own submitted drawing. Stable anonymous labels do not expose artist identities.
- The untimed final aquarium no longer offers an authoritative Pause action that the server rejects. Its artwork gallery retains its own Pause control.
- Fixed the final aquarium being covered by an opaque full-tank click button: host button defaults overrode its transparent background. Scoped the hit-plane styles above those defaults, retained its keyboard focus outline and added computed-style regressions in both browser flows.
- Shark size and approach paths leave space for the cinematic heading and tank floor. The shared mouth anchor still meets the actual submitted artwork at the bite. Compact chase/aquarium captions leave more space for the drawings. Canvas backing dimensions change only when their pixel dimensions change, avoiding unnecessary clears during resize notifications.
- Fish sound effects and the original synthesized tension bed follow global master/effects volume, effects enablement and mute. A shared gain node covers sounds already playing. Disabled effects do not duck background music. The local toggle explicitly says “Mute fish sounds.”
- The legacy menu showcase pauses while its blocking settings dialog is open, preserving its image phase and attribution.
- Added shared independent-seat browser fixtures, four/ten-player shark acceptance, cross-engine menu coverage and an actual Miniflare D1/R2 storage/cleanup/withdrawal test.

## Evidence and exact scope

Final verification results are recorded below after the last run. Browser contexts are separate authenticated human seats controlled by automation, with touch emulation on the phone surfaces. The main three-round match uses the normal endpoints before opening the bonus. There are no shipping QA routes, injected room snapshots, accelerated server clocks or provider credentials.

The menu screenshot fixtures are explicitly labelled **QA fixture** and are routed only inside Playwright. They are never inserted into the winners archive or published as historical winners. The storage fixture is a separately isolated disposable Miniflare database/bucket with authoritative round and job receipts and valid decoded PNGs. It exercises real public feed/media handlers, duplicate projection, explicit opt-in, actual `cleanupExpiredRooms`, retained durable copies, withdrawal and archive retry.

### Final checks

- Full serial unit/API suite: **1,177 tests, 1,168 passed, nine existing skips, zero failures** (100.9 seconds). Includes synchronized ten-ballot contention, progressive media access, audio controls and real D1/R2 cleanup/withdrawal.
- TypeScript: passed. ESLint: zero errors, four inherited native-image optimization warnings.
- Production build: passed. All **nine production-render checks passed**.
- Targeted Chromium: main-game skip, transparent editor/partial peaceful voting, zero/one/two usable entries, four-player shark story, ten-player simultaneous ballots and full shark story.
- Targeted WebKit: three independent authenticated artists, editor PNG storage/retry, partial peaceful ballots, host/phone reload and unchanged final main scores.
- Menu: three scenarios passed in each engine (six total), covering exact original/transformation pairing, fade/pause/manual navigation, attribution, reduced motion, broken assets, narrow layout and blocking legacy settings.
- Final aquarium CSS regression reruns: **Chromium ten-player passed (6.3 minutes)** and **WebKit three-player passed (2.5 minutes)**. Both assert a transparent, borderless click layer; final screenshots were inspected and show the submitted fish. The ten-player run also checks ten introductions, nine ordered eliminations, all fish returning and a 60-second idle interval.
- `git diff --check`: passed. These are targeted browser results, not a complete application-wide release suite.

Commands: `node --import tsx --test --test-concurrency=1 tests/*.test.ts`, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`, `node --test tests/rendered-html.test.mjs`, and focused `npx playwright test -c playwright.fish.config.ts --project=<chromium|webkit>` runs. Browser runs use `CALLBACK_TEST_BASE_URL=http://127.0.0.1:4187`; WebKit uses the local ignored browser cache.

### Build footprint

The final shared fish/other-presentation/narrator JavaScript chunk is 334,751 bytes (97,330 gzip); its CSS is 117,301 bytes (23,880 gzip). The menu chunk is 18,772 bytes (5,832 gzip), and showcase CSS is 6,289 bytes (1,719 gzip). These are whole shared chunks, **not incremental feature costs**; gzip measurements use Python compression level 9. Exact filenames and SHA-256 hashes are retained in `.logs/fish-acceptance/build-assets.json`.

### Browser error classification

The frozen WebKit trace isolated one diagnostic 125 ms after an explicit phone reload: its old same-room `/sync` fetch was canceled while the new document and subsequent sync returned 200/204. The polling fetch already has a `try/catch`. The fixture now classifies only the exact WebKit cancellation messages for that room's `sync`, `realtime`, and `display-status` polling URLs on the exact reloading page, from explicit reload until a fresh successful same-room sync. A later trace also reproduced cancellation of `realtime` 257 ms after reload, alongside two canceled sync polls. Every other page error still fails the test. This does not suppress server authorization failures, arbitrary CORS errors or errors during ordinary play.

### Browser and visual artifacts

Local, ignored artifacts live in `.logs/fish-acceptance/`: editor/tool evidence, menu original/fade/transformed/phone views, and four/ten-fish voting, shark entrance, mouth contact, final two, winner, artist lineup and final aquarium. `observed.json` records the exact browser, viewport, renderer, frame samples, elimination order and result invariants. Earlier failed attempts and superseded timing samples are not acceptance evidence. An initial paint assertion incorrectly expected an opaque center in the deliberately transparent water canvas; the corrected assertion checks its painted edge plants. Pixel-buffer checks alone then missed the opaque click-layer overlay; screenshot review found it, and final acceptance also checks that the overlaid hit-plane background is transparent and its border is zero.

The final ten-fish active sample (`2026-10-31T15:07:35.357Z`, Chromium 151, 1366 x 768, DPR 1, WebGL) contains 179 frame intervals: median 16.7 ms, p95 33.4 ms and maximum 66.7 ms. Raw measurements are recorded in `10-fish/observed.json`; earlier four-fish timing was sampled during paused voting and is excluded from performance acceptance. The active animation sample is measured during a hunt with the shark and moving fish. It is a short local development-browser sample, not a sustained GPU benchmark. Aquarium idle checks last 60 seconds and check mounted canvas count and page errors; they do not prove the absence of all long-term leaks.

## Assets, data and publication boundaries

No new dependencies, downloaded source code, stock artwork, paid image jobs or paid audio generation were added. The existing shark, water, plants and animation are original procedural/vector code; fish remain the player's exact alpha PNGs on a WebGL mesh with the existing Canvas fallback. The existing approved soundtrack remains under its original owner; fish accents are original Web Audio synthesis. Asset provenance remains in `ASSET_MANIFEST.json` and `assets/source/audio/approved-import.json`.

No new schema change is required for these corrections. The existing showcase migration `drizzle/0013_sketch_showcase.sql`, Drizzle schema and runtime bootstrap remain intact. Public winners still require positive authoritative round-winning votes, matching original/transformed receipts and explicit artist opt-in. Withdrawal stays terminal. No historical backfill was performed and no unproven historical winners were fabricated.

The local server used disposable D1/R2 and authenticated HTTP synchronization. Its separate realtime Worker was unavailable (expected `/realtime` 503), so these runs establish the HTTP fallback, not live Worker/WebSocket or WAN acceptance. Physical iPhone/Android touch/audio, physical TV listening, hosted provider transformations, production R2 acceptance and long-session hardware performance remain untested. Existing unrelated whole-application browser failures are not represented as fixed by these targeted checks.

## Primary references consulted

- [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events): gesture ownership and cancellation.
- [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices): user activation and user audio controls.
- [MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API): background animation throttling; host motion samples bring the actual host page to the foreground.
- [PixiJS mesh guide](https://pixijs.com/8.x/guides/components/scene-objects/mesh): mesh deformation reference; no Pixi dependency was introduced.
- [Cloudflare R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/): storage reference; local tests are not hosted consistency measurements.
