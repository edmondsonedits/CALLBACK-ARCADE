# Phone Back navigation — 2026-11-03

- Completing or skipping the intro marks the current home entry as the live menu, preserving other query/hash values and framework history state. Returning with phone/browser Back no longer restarts the intro; first entry and explicit Replay Intro remain available.
- Artwork, settings, phone sections, avatar/photo editing and full-screen panels participate in bounded local history. Back closes the current layer; nested exhibition details return to the exhibition. Expired Style branches are retired on game start without rewinding authoritative phases.
- Checks: 20 focused browser scenarios passed across the navigation/menu/character/audio/install and Quick workshop runs, including practice-canvas Back. Lint/typecheck passed (eight existing image optimization warnings); full unit suite 1,259 passed, 11 skipped. Build/render results are recorded in .logs/2026-11-03-phone-back-navigation.md and Sites history.

# Sorcery workshop and independent fish — 2026-11-03

Implemented and verified from Site v129. Sites version history records the published source and deployment; the preceding v129 source is retained.

- Quick Sorcery has two rounds (normal/curse) and two-minute drawings; Long retains normal/curse/final and four-minute drawings. Main scoring, ranked voting, artist guesses, curses, prompt content and drawing fidelity are preserved.
- The Last Fish Swimming launches independently from the catalog/persistent lobby with its own setup, roster, results and replay. New Sorcery matches do not offer an encore or early fish preparation; existing legacy rooms remain readable.
- Submitted players can save/edit/place aquarium scenery, choose server-issued prompt preferences, practice, play personal-only Pocket Pairs, or trigger bounded TV reactions. Preferences award 25 after ten seconds, at most 50 per match; future-prompt learning is bounded and does not change the active election.
- One shared ten-second editor finish window starts when all main drawings are accepted. Drafts recover locally and through owner-bound profile revisions. Five newest shared scenery additions return, shrinking with original creation age; edits retain that age.
- TV reveals fade original artwork over the enchanted version, hold at 50%, then settle side by side. Reduced motion uses the final comparison.
- A separate unscored nomination after round points selects Edmondson Hall of Questionable Art entries. Separate explicit Hall sharing consent is required; previous winning-art consent never expands automatically.
- Opted-in historical fish visit only allowed waiting/drawing scenes for participating owners; current-match fish are excluded and visitors never enter competitive/shark state. Permanent copies retry from verified upload receipts before room cleanup.
- Verification: 1,259 unit tests passed (11 integration-environment skips); 7/7 live API tests passed; Quick/Long and home-to-game Sorcery journeys passed; 5/5 independent fish, controls, shark and duration browser checks passed. Three broader Arcade bot/lobby failures were reproduced unchanged against v129; the full browser suite is not claimed green.
- Execution and verification evidence: .logs/2026-11-03-sorcery-workshop-execution.md. No paid provider calls were used for QA.

# Fish drawing time and swimming wave — 2026-11-03

- Four-minute default for new fish bonuses and temporary tests. Before starting, hosts can choose 90 seconds or 2–6 minutes; existing saved rounds retain their chosen duration. Server validates and persists the selection.
- Faster swimmers have a stronger wave through the body and tail in WebGL and Canvas fallback, with faster tail beats during bursts. Gentle/reduced motion remains still. Verification: `.logs/2026-11-03-fish-time-and-wave.md`.

# Fish colour gradient — 2026-11-03

- Existing eight main swatches are followed by twenty evenly spaced rainbow hues in the same scrolling palette, then the custom colour picker. Gradient swatches use the existing drawing and selection flow.

# Swipeable fish tools — 2026-11-03

- Compact horizontal tool strip supports touch swiping and mouse dragging, with shapes alongside painting tools. Undo/redo remain beside colours. Selecting Spray, Brush or Eraser opens a left-side panel with size and opacity, applied immediately; Done, Escape or a canvas tap dismisses it. The dismissal tap does not paint.
- Smaller tray gives the canvas more space. Optional stroke opacity preserves existing saved strokes at full opacity.
- Verification: `.logs/2026-11-03-fish-tool-strip.md`.

# Soft fish airbrush — 2026-11-03

- New fish spray uses a 144-unit default diameter, broad radial fade, fine grain, interpolated strokes and gentle hold-to-build colour. Tools remain below the canvas. Versioned mist operations preserve existing saved artwork.
- Verification and research: `.logs/2026-11-03-soft-fish-spray.md`.

# Fish tools below the canvas — 2026-11-02

- Fish drawing now uses a full-width canvas above its tool tray on phones and desktop. Drawing tools/history remain together; colours scroll horizontally and extra settings scroll inside the lower tray. The canvas stays fixed while using settings.
- Corrected Preview/Blank button sizing on intermediate phone widths. Drawing, drafts, upload and game rules are unchanged. Verification: `.logs/2026-11-02-fish-tools-below.md`.

# Simpler phone entry and face camera — 2026-11-02

- Removed the in-app room scanner and its separate empty/error screen. Join now offers code, nickname and an explicit Join game action; host QR links still work with the phone's native camera. Older Arcade service help is a secondary disclosure.
- Added separate Take a photo and Upload photo actions using native front-camera capture and the existing local validation/crop flow. Generation is available only after selection, and picking/canceling a photo does not send it to the provider. Improved chooser contrast, focus and action sizing.
- Compacted Home, join, mirror/display entry and character setup. The standalone character page uses one card instead of repeated headings/nested panels; save-cookie details remain available in help. Short screens, keyboard recovery and extended help keep natural scrolling; gameplay workspaces remain unchanged.
- Join fields wait for hydration, preventing early input from being reset when the interactive form mounts. No server, scoring, provider, schema or spending-control changes.
- Verification and release notes: `.logs/2026-11-02-phone-simplification.md`.

# Practical interface reconstruction — 2026-11-02

- Supersedes the earlier blanket no-scroll menu policy below. Menus, setup, archives, guides and secondary character options now scroll naturally. Removed the shared pixel-slicing `ScreenPages` and card-pagination `MenuPages` components.
- Home has direct Host / Join actions and visible secondary destinations. Back to Grand Hall returns to this same menu. Party / Arcade tabs show a continuous catalog. History Books has compact search and a game dropdown instead of sixteen artificial screens.
- Fish drawing keeps the canvas, tools, history controls and submit action together. Secondary settings expand in the adjacent rail; submitted PNG transparency and authoritative bonus scoring are preserved.
- Game interfaces retain fixed shells, TV no-scroll layouts, mounted private drafts and keyboard recovery. Long ballots and accessibility overflow remain reachable within the task area. Character editing retains its preview and save action while offering readable, scrollable controls.
- Corrected roster focus transfer/restoration, selected-category persistence after removal, narrow join navigation, guide readiness and complete character preview sizing. No scoring, provider or schema changes.
- The real removal test exposed a pre-existing WebSocket gap: child-game kicks did not revoke parent membership. The shared authenticated host-action service now performs the same post-commit cleanup for HTTP and realtime actions, including idempotent retries. The atomic admission guard also rejects a previously removed token, preventing concurrent lobby polling from reattaching it before revocation finishes. Deliberate rejoining uses fresh credentials and remains supported. Server authority and private snapshots remain intact.
- Release evidence and limitations: `.logs/2026-11-02-interface-reconstruction.md`; screenshots and command logs are ignored under `.logs/interface-reconstruction/`.

# Sorcery storybook journey — 2026-11-02 (historical)

- Reworked the home-to-Sketch & Sorcery path with locally bundled Cinzel headings, heraldic framing, a Party Games field guide and optional House Edmondson lore. Short-screen menus use explicit pages and preserve keyboard focus.
- Added a four-chapter pocket spellbook, a hidden Edmondson seal, phase-aware TV progress, restrained spell particles and crown/reveal motion. Body copy, player artwork and controls remain readable; reduced motion and pause stop decoration. Phones remain silent.
- Completed exhibitions now have full-screen previous/next artwork, original/enchanted comparison, a personal-art filter and original downloads. Entries remain server-disclosed only. Replay failures show a retryable message and retain results.
- Moved fish practice into its own lobby screen after the walkthrough exposed clipped Start controls. Corrected fixed-prompt drawing help, three-prompt graphics and fish voting/reveal guidance. No scoring, timing, provider, migration or authorization changes.
- Verified: 1,226 automated test passes (11 skips), 14 focused browser cases, ten production-render checks, typecheck, lint (zero errors/eight inherited warnings) and build. The broader browser attempt stopped at five older Arcade failures (16 passed, 143 not run); it is not an all-suite pass. Evidence and publication receipt: `.logs/2026-11-02-sorcery-storybook.md` and ignored local `.logs/sorcery-journey/`. Physical-device and real-provider quality are outside local QA.

# Full-screen party navigation — 2026-11-02

- Main entry has separate More, artwork, settings and character destinations. Shared game selection uses bounded pages based on the rendered grid; players have their own roster screen. Dropdown option lists may scroll internally.
- All seven active party games use viewport-sized phone tasks or dedicated drawing workspaces. Longer tasks expose explicit page buttons while keeping drafts mounted. Phase/round changes reset navigation, and keyboard/focus changes recalculate available space.
- Character editing uses the same feature/piece dropdown controls on desktop and phones. Photo crop and chin alignment are separate full-screen steps. Drawing and fish tools, previews and vote results use full-screen menus; profile history, save/cancel and ownership checks remain intact.
- Corrected image-ballot captions falling into the narrow rank column. Preserve server authority, private snapshots, silent phones and host audio. The earlier review fixes below are retained in this source.
- Validation and publication evidence are recorded in `.logs/2026-11-02-fullscreen-navigation.md`, local `.logs/fullscreen/`, and Sites version history. Full browser-suite success must not be inferred from focused checks; the disposable party harness leaves the separate legacy Arcade Worker unconfigured.

# Review fixes and configured QA — 2026-11-02

- Fixed the five review findings: opaque Frame-Up ballots/turns/progress, phase-filtered Restoration patches and authorship, match-scoped replay archives with a non-destructive migration, parent-only session child admission, and current API/phone test expectations. Final winner IDs and legitimate parent rejoin remain intact.
- Added all-role privacy and migration regressions, disposable app + real party-Worker QA, explicit HTTP-fallback tests and current architecture guidance. Offline epochs ignore late responses/failures; completed screens stop reconnecting retired sockets. HTTP End Game completes best-effort coordinator retirement; tests close only their own standalone parties without relaxing the single-party cap.
- Verified locally: npm test 1,225 pass/11 skip; seven configured API checks pass; 29 selected browser scenarios pass across focused runs, including eight complete matches, six-pack host/four-phone/mirror delivery, kick/reset, photo mocks, offline races and lease cleanup. Build, typecheck, ten production-render checks and diff check pass. Lint has zero errors/eight existing image warnings. Independent security/migration review completed and material follow-ups addressed.
- Local synthetic action-to-host-snapshot timing: median 505ms, worst of five 944ms; host animation callback cadence median16.7ms/p95 16.8ms. These are desktop loopback measurements, not phone/Wi-Fi/GPU/load certification. See `.logs/2026-11-02-review-fixes.md`.
- Not committed or deployed. Migration is prepared/tested locally; existing published archives and production data were not rewritten. Current dependency advisory lookup still requires its separate metadata-transfer approval. Physical-device, human-group and live provider checks remain outside this verification.

# Host player removal and lobby reset — 2026-11-02

- Adds host-only X controls to persistent roster and main-game lobby player cards, plus confirmed Reset lobby retaining the host/code while retiring the active child and clearing members. Removed phones close parent sync on denied membership. Existing signed socket invalidation remains; no separate party-worker deployment.
- Main and online child removal propagates to parent membership across version/game transitions. Launch completion checks its captured version; conflict retires the stale child and clears only that launch. Reset deletion is the atomic membership cutoff; deliberate new joins afterward remain allowed.
- Focused sessions14/14, typecheck, lint0errors8existing image warnings, build and ten production-render checks pass. Initial broad suite1210pass9skip with unrelated randomized Showdown prompt assertion; immediate focused Showdown2/2pass. Independent auth/reset/launch review found no remaining blocker after race fixes. Browser verification recorded separately.

# Automatic curved head finishing — 2026-11-01

- Live synthetic testing of head-only input plus stronger prompt still produced a small neck stub. Generation now automatically saves a derivative using the selected reference chin curve; no second AI call. Raw generated source remains available for adjusting the output curve. If finishing fails, the editor opens trim recovery instead of treating an unfinished head as ready.

# Curved chin and head-only reference — 2026-11-01

- Adds adjustable chin height/curvature before generation. Browser canvas removes reference pixels below that curved boundary before upload; the AI receives the isolated head area, and the prompt tells it to preserve empty alpha rather than reconstruct a neck. This requires aligning the guide to the actual chin; prompt adherence remains generative, not guaranteed.
- Saved/generated portrait trimming now uses an adjustable symmetric quadratic jaw curve with matching overlay/transparent preview and server pixel removal. Curve is validated, defaults to zero for old clients, and participates in deterministic derivative IDs.
- Build, ten production-render checks, typecheck and lint (zero errors/eight image warnings) pass. Broad unit run1208 pass9skip with one Worker fixture parameter mismatch, corrected and rechecked in the five passing focused service/Worker tests. Reference masking/browser coverage and curved alpha are directly checked. Existing unrelated Arcade QR-label full-browser limitation remains.

# Deterministic portrait neck trimming — 2026-11-01

- Adds Trim neck for existing saved faces and generated results. An adjustable horizontal chin cutoff previews transparent pixels; Save trimmed face creates an owner-bound PNG derivative without another AI call. Original asset remains unchanged, dimensions are retained, and duplicate same-cutoff saves resolve to the same ID.
- Server checks ownership, origin, input size/time, cutoff range and rates; output is decoded, alpha-cleared, encoded and validated before storage.
- Full unit/API suite:1209 pass,nine existing skips. Build and ten production-render checks pass; lint zero errors/eight image warnings. Focused browser and Worker trim checks recorded with final verification. Existing broader Arcade QR-label mismatch remains outside this change.

# Head-only portrait instruction — 2026-11-01

- Strengthened the portrait prompt to define a detached head sprite ending at the underside of the chin/jaw or natural beard tip. Explicitly removes neck skin, stumps, throat, collars and shoulders from the reference; requires transparent pixels below the head silhouette. Existing generated portraits are unchanged.

# Portrait provider fix — 2026-11-01

- Live synthetic reproduction on v114 returned IMAGE_BACKGROUND_UNSUPPORTED (HTTP 502): the configured GPT Image 2 access rejects native transparent background. Portrait edits now explicitly use gpt-image-1.5 at low quality, PNG and background transparent. Existing image-only key, reservation limits, no-retry policy and alpha validation are preserved; ordinary gameplay image generation remains unchanged.
- Crop checks pass in Chromium and WebKit, including matching submitted pixels, drag positioning, new crop keys and byte-identical unchanged retries. Original real-user failures retained no provider detail; the matching synthetic failure confirms the incompatible option in this workflow.

# Portrait crop and failure diagnosis — 2026-11-01

- Adds a circular framing guide with drag, zoom and accessible position sliders before sending a 768px square crop. Original photo stays on-device; submitted crop is stripped of metadata. Retry bytes/key are preserved until the crop changes or an explicit new attempt starts.
- Production D1 shows three provider failures completing in about one second. Prior code discarded provider details. Added fixed error classifications and allowlisted diagnostic metadata; no raw provider text, photos or credentials are logged. Root-cause verification awaits a live synthetic test.
- Verified 1208 unit/API passes with nine existing skips, six Chromium photo checks, typecheck, build and ten production render checks. Lint zero errors/six inherited image warnings. Full browser gate still stops at inherited Arcade QR label mismatch (149 not run).

# Optional face-photo character — 2026-11-01

- Added Use a face photo alongside normal character customization. A locally normalized preview is sent only after explicit Generate; returned cartoon previews on the current body before Use this face. Save/reload, drawn-face restore, undo history, pose movement, piece positioning and missing-image fallback are preserved.
- Dedicated gpt-image-2 image edit uses the existing OPENAI_IMAGE_API_KEY, low quality, background transparent, PNG output and zero SDK retries. Separate head-only prompt lives in .prompts/profile-face-cartoon.md and server/profile-faces/prompt.ts. Decoded PNG validation requires visible content and a substantially transparent perimeter; opaque/empty/corrupt output is not applied.
- Original photos are transient and never stored by the game. Generated cartoons persist for saved character/game history; switching to the drawn face is not deletion, as disclosed in the uploader. Ownership is enforced across saved profile/history, room and session joins, avatar changes and Bowl host seats. Upload bytes/dimensions/inflation, IP/profile rates and existing allowance/circuit limits remain bounded. Durable idempotency prevents duplicate paid calls; a known failed attempt offers an explicit new generation, while network retry uses its existing key.
- Verified: full serial suite 1,207 pass, nine existing skips, zero failures; focused Chromium photo/ownership/existing-style checks and four WebKit photo checks pass; all ten production-render checks, typecheck and build pass. Lint: zero errors, six image-element warnings (four inherited, two intentional native blob/transparent preview images). Bundled Worker test exercises the actual SDK edit multipart contract, Workers decompression, D1 reservation/idempotency and R2 exact-byte retrieval with a mocked provider.
- Review caught and resolved copied face IDs at room boundaries, terminal retry recovery, disabled-key result recovery and a Cloudflare runtime import leaking into the pure session service. Full suite was rerun after the fix.
- Publication authorized by the user. Release validation retains one known broader-suite limitation: the first Arcade archive UI test expects "Scan to join lobby", while the unchanged shared QR component exposes "Scan to join room"; the full browser run stopped there (147 cases not run). Focused face-photo, ownership, mobile-style and WebKit checks are green. No paid generation or personal face upload was performed. Real-photo likeness, live provider transparency preview access, and physical-device behavior remain unverified. Source is based on Site commit e5462da6d15480659600880ef68278a11af37441 in H:/ChatGPT/CALLBACK-face-photo-2026-11-01.

# Installable home PWA — 2026-11-01

- Main page now advertises a standalone manifest with root start URL/scope, 192/512 crown icons and Apple home-screen metadata/icon. Optional home-only Install Callback button invokes the browser prompt from a tap or explains browser-menu installation; iOS gets Share → Add to Home Screen. Dismissal is session-scoped and installed standalone mode hides the control.
- No service worker or offline gameplay cache: live rooms and current assets keep their existing network behavior. Root icon aliases remain available for browser discovery.
- Chromium/WebKit checks pass for manifest/icons, simulated native install gesture/dismissal, iOS guidance, standalone hiding and 320/390/1280px menu hit targets. Manifest parses through Chromium CDP; built HTML metadata and PNG dimensions verified. Full suite 1,196 pass/nine existing skips; typecheck/lint (four existing warnings), build and ten production-render checks pass. Physical OS installation was not exercised.

# Join stylesheet recovery — 2026-11-01

- Reproduced unstyled join markup by failing the root stylesheet request; historical cause is unproven. Current live root and component CSS responded 200.
- Added a post-DOM-ready inline guard that checks the root style token and retries the root CSS once, next to its original link, with a cache-busting query. Supports development and hashed production names. No document reload, nickname reset or retry loop.
- Chromium and WebKit each pass four browser cases: transient failure, production-shaped hashed link failure, healthy no-retry and persistent-failure cap. Typed nickname and single document navigation verified. Full unit/API suite: 1,196 pass, nine existing skips; typecheck, lint (four existing warnings), build and nine production render tests pass. Not a guarantee against a permanently unavailable asset or network.

# Screenshot-driven phone regression fixes — 2026-11-01

- Fixed nested overflow clipping in the real player Style panel: profile actions scroll above the persistent section navigation, with a sticky Back heading. Verified enlarged controls and opening/closing the avatar editor.
- Suppressed selection/callouts across the regular DrawingStudio controls, prompt and dialogs, preserving editable text fields. Added context-menu suppression on painting UI. Fixed fish preview text overflow at 375px.
- Chromium and WebKit route checks cover regular drawing, fish drawing and Style at short phone sizes (320x480, 375x600, 390x664, 412x700 and landscape). Tests verify control hit targets, bounds and scroll reachability. 1,196 unit/API tests pass with nine existing skips; types, lint (four existing warnings), build and nine production render tests pass. Native long-press browser UI and real hardware safe areas remain unverified.

# Phone usability and visible spray — 2026-11-01

- Prompt writing now allows 120 seconds and selection 60 seconds (extended timers remain 1.5x). Phone, TV and narrator voting instructions ask for the drawing enjoyed most.
- Added a blank transparent canvas option with template switching, undo/redo and draft recovery. Mobile editor tracks the dynamic viewport; phone game surfaces suppress accidental selection while text fields remain editable.
- Spray combines a soft paint core with fine deterministic grain, keeping blendable edges visible after phone downsampling and retaining incremental caching.
- Release validation: 1,196 unit/API passes, nine existing skips; typecheck, lint (four inherited warnings), build and nine production render checks pass. Focused browser evidence and physical-device limits are documented in [usability acceptance](docs/fish-phone-usability-2026-11-01.md).

# Fine blending spray — 2026-11-01

- Replaced chunky uniform spray with deterministic fine grains, a denser centre and feathered edge. Colour layers blend gradually; size and opacity remain adjustable in both editors. Retained the incremental raster cache and transparent export.
- Verified centre/edge coverage, colour blending, transparent pixels and incremental/reload equivalence in Chromium and WebKit; Chromium also passes the real fish undo/redo/export flow. Typecheck, lint (four inherited warnings), build, nine production render checks and 22 final focused unit tests pass; the earlier broad suite passed 1,193 with nine existing skips.

# Fish performance, spray editor and immediate phone aquarium — 2026-11-01

- Fixed lost animation time on slow frames, bounded texture/fallback work, cached render data, paused/hidden-tab behavior and graphics recovery. Added varied coasting/darts, vertical/depth travel, shark feints and continuous shot changes, with 36 falling original-art fragments per bite.
- Spray is the default fish tool with size/opacity and bounded incremental stroke caching; regular drawing games expose it under Other. Free drawing extends into transparent space; compact phone UI and dismissible help maximize the drawing area. Accepted art swims immediately on its phone and the temporary test host; normal-game disclosure and server ranking remain authoritative.
- Release checks: 1,193 unit/API passes, nine existing skips; TypeScript, build and nine production-render checks pass; lint has zero errors/four inherited image warnings. Eight Chromium scenarios cover phone/test/graphics recovery and a six-human, five-elimination, full-revival run; WebKit verifies real spray/undo/redo/export alpha. Final editor wording correction is separately checked. Independent review found no blocker.
- Synthetic 390×844 DPR3 / CPU4× rendering sample: Canvas median 16.7 ms / p95 50 ms versus original 83.4 / 116.7 ms; WebGL median 16.7 ms / p95 16.8 ms. Physical device performance/audio remain unverified. [Acceptance details](docs/fish-performance-editor-acceptance-2026-11-01.md). The six-fish recording is `.logs/fish-acceptance/runtime-six/runtime-six-demo.webm`.

# Solo fish-test phone aquarium — 2026-11-01

- Solo Sketch & Sorcery test rooms now support the host aquarium in portrait, including the lobby before launch and after exit. Responsive layout keeps the tank and controls reachable, simplifies the TV header/QR lobby, and removes overlapping drawing captions. Normal TV hosts retain their rotation guard.
- Focused Chromium regression passed at 390×844 and 320×568: launch, pause/resume, exit/restart, scrolling controls, no horizontal overflow and preserved normal-host guard. Screenshots in `.logs/fish-acceptance/shortcut/portrait-aquarium-*.png` were reviewed. Physical Android hardware was not directly tested. TypeScript/lint/build/production-render gates precede publication.

# Temporary fish drawing test and animation polish — 2026-11-01

- Added `/fish-test` with free solo practice bots, Shark/Peaceful choice and direct server-authoritative drawing entry. Multiplayer lobbies also expose the labelled temporary shortcut. Separate aquarium view and controller/host **Return to lobby** support repeated tests without main rounds, score changes, image jobs or archived winners.
- Added original-drawing paint fragments that scatter and dissipate on shark bites, fading ripples, shark wakes and release bubbles. Original PNGs, full revival, pause, gentle motion and graphics fallback are preserved. Fixed early setup submission and validated dual-cookie solo access to the artist's own hidden drawing.
- Verified 1,185 unit/API passes with nine existing skips; six targeted browser scenarios across Chromium/WebKit cover the complete solo loop, normal six-human shark/revival, multiplayer shortcut exit/normal start, editor/reload and graphics recovery. TypeScript and lint pass (four inherited image warnings). Build/production render evidence and limits are recorded in the [acceptance report](docs/fish-test-polish-acceptance-2026-11-01.md).
- Live verification exposed the general solo lobby paging the desktop launch control out of view. A compact fish-only lobby fixes this and removes unrelated game settings and first-place bot promises; the desktop create/draw/exit regression passes.
- Includes previously local single-PNG/backdrop checkpoints below. Publication uses the existing public Site; exact commit/version/deployment receipt is saved beside this checkout as `fish-test-polish-publication-receipt.json`. Earlier unpublished notes below describe historical checkpoints.

# CALLBACK single-drawing fish runtime — 2026-10-31

- Implemented the user correction in the actual FishTank renderer: one submitted alpha PNG is the only texture on two curved faces, with continuous turning, a mirrored reverse, tail flex and more active seeded swimming through depth. No extra front image, second upload, AI generation or video dependency is required. The curvature approximates a body from existing pixels/anchors; no unseen anatomy is reconstructed.
- Per-art geometry is cached (442 vertices / 768 triangles). Sixteen depth bands avoid per-fish depth clears, and canvas backing resolution is capped at 1280x720. Original PNGs survive mesh failure and WebGL loss via Canvas fallback. Victim heading now turns continuously into the shared shark mouth.
- Verification: full serial unit/API suite 1,174 passed, nine existing skips; final geometry/motion checks 12/12 passed. Six normal authenticated PNG submissions and phone ballots completed all five shark eliminations and full revival, preserving main results and creating zero extra jobs. Final six-player Chromium run passed in 4.3 minutes; its local recording sample measured 33.3 ms median / 33.5 ms p95. WebKit phone-editor/reload passed (2.9 minutes), and Chromium controls/Canvas fallback/WebGL recovery passed (2.8 minutes). Physical device/audio and hosted/WAN acceptance remain unverified.
- [Runtime acceptance and limitations](docs/fish-runtime-acceptance-2026-10-31.md). Actual game recording: `.logs/fish-acceptance/runtime-six/runtime-six-demo.webm`. Local preview remains <http://127.0.0.1:4187>. This checkpoint is unpublished.

# Layered aquarium visual pilot — 2026-10-31

- Added an original image-generated aquarium backdrop behind the fish finale’s independently animated fish, shark and bubbles. Soft moving light creates depth, respects reduced motion and pauses with the room. The 1672×941 WebP is 150,244 bytes and has a gradient fallback; no video or new dependency is required. Attribution/provenance and draft review status are recorded in ASSET_MANIFEST.json.
- Three-artist Chromium peaceful finale passed with real uploaded PNGs, ballots and reload; an additional local screenshot was reviewed using explicitly labelled practice fish. Physical phones, audio and hosted deployment were not tested. This visual pilot is local and unpublished.

# Fish finale follow-up verification — 2026-10-31

- Retested the saved application source `6ca32d7`: 1,168 unit/API tests passed with nine existing skips; all nine production-render checks passed. Nine distinct browser scenarios passed across the ten-player Chromium shark flow, WebKit three-artist editor/reload flow, six menu cases and a new visible-control/graphics-recovery test.
- The new regression verifies host mode/time/start controls, all phone ballot buttons, reload persistence, gentle motion, painted Canvas fallback, restored WebGL art, keyboard artist-card focus and return to unchanged main scores. Screenshots were inspected. No paid jobs were created.
- Corrected demonstrated test assumptions about pending CSS pause, UI timer defaults and wrapped labels; the pause check still requires exact opacity equality after confirmed pause. Added bounded UI action waits. Application code is unchanged; TypeScript, focused lint and diff checks pass. No push/publication or physical-device claim. Evidence and retained failures/reruns: [acceptance report](docs/fish-finale-acceptance-2026-10-31.md).

# Fish finale takeover completion — 2026-10-31

- Continued the existing fish finale and winners showcase, preserving the concurrent narrator source v102 (`e11d5cdb040d405cac9466770d74a65dd5d24738`) in an isolated branch. The Sites service confirmed v102 is deployed; older checkpoint-only wording below is historical. This follow-up has not been pushed or published.
- Fixed the opaque aquarium hit layer that hid every swimming fish, progressive player/spectator media disclosure, ten simultaneous ballot contention, global fish audio volume/mute/ducking and the invalid untimed aquarium Pause control. Improved shark clearance and captions, preserved original drawing contact and made the legacy menu showcase pause under settings.
- Verification: 1,168 unit/API tests passed, nine existing skips, zero failures; TypeScript and production build passed; all nine production-render checks passed. Lint has zero errors and four inherited image warnings. Targeted Chromium covers skip, zero/one/two entries, three-person peaceful and four/ten-person shark flows. Final ten-person shark and three-person WebKit peaceful reruns pass with visible aquarium screenshots and reload checks. All six cross-engine menu scenarios pass. Actual disposable D1/R2 cleanup preserves opted-in archive copies, and withdrawal removes public access without resurrection on retry.
- The final active ten-fish development-browser sample measured 16.7 ms median and 33.4 ms p95 frame intervals; this is a short local sample, not a hardware performance guarantee. Physical iPhone/Android touch/audio, physical TV listening, WAN/realtime Worker and hosted provider/R2 acceptance remain unverified. No paid jobs, public test winners, historical backfill, new dependencies or production changes were introduced.
- Full evidence, commands, sources, screenshots and limitations: [fish finale acceptance](docs/fish-finale-acceptance-2026-10-31.md). Local preview: <http://127.0.0.1:4187>.

# Sketch & Sorcery themed host narrator — 2026-10-31

- Added 2,000 original comic lines: eight consistent moods, twenty-five situations, ten options per mood/situation. Research references official Jackbox writing guidance, Toastmasters comedy advice and host examples; the scripts are original, not copied quotations or an empirical funniest-joke ranking. Research and full readable scriptbook: docs/sketch-narrator-research.md and docs/sketch-narrator-scriptbook.md.
- The TV chooses an automatic match-stable mood or overrides it using a labelled keyboard-accessible selector. Shuffled bags use all ten variants before reuse; bounded local heard/pick history survives reload, preserves shuffle progress after eviction and writes only on new cues or explicit selections.
- Fixed facts remain separate from punchlines: phase tasks, standard/extended drawing time, round multipliers, two-/three-round transitions, vote/guess values and tie rules stay accurate. Fresh countdowns outrank optional banter, short transitions preserve instructions, and each anonymous drawing receives its own lettered introduction without author inference. Literal bounded player-name substitution is used only for the actual final pending contributor or authorized artist reveal.
- Runtime review found and resolved a stale-caption/voice race across phase, card and pause/resume transitions, plus bounded-history continuity. Browser QA also reproduced a final-contributor callout being suppressed by an introduction; it now remains eligible after a quiet gap. Existing opt-in browser speech, mute, music ducking, pause and captions remain intact. No new AI/provider calls or gameplay authority changes.
- Verification: full serial suite 1,158 passed, nine existing skips, zero failures; all 23 final focused narrator/showdown tests passed after copy tightening. Nine focused browser checks passed, including all three rounds with four phones, six artist moves, delayed transport/reduced motion, ten-player layout, prompt browsing, upload recovery, desktop/mobile host dialogs, mood/reload/deduplication, spoken resume and music ducking. TypeScript, production build, all nine production-render checks and diff checks passed. Lint has zero errors and four inherited fish-panel image warnings.
- Browser speech was instrumented for utterances and ducking; physical TV/phone voice quality and listening are not established. An initial browser attempt found no preview listener and was rerun after restarting it. The build required process-local Git trust and normal compiler filesystem access. No full-application browser claim is made.
- This is a saved source/version checkpoint. The inherited fish-finale brief explicitly requires separate publication approval; preserve its hold and the live Site until the user authorizes the combined version. Source/version/archive provenance is recorded in the sibling narrator-checkpoint-receipt.json.

# Optional fish finale and winners showcase — 2026-10-31

- Added an optional postgame encore to completed version-3 Sketch & Sorcery matches. The room chooses a peaceful aquarium or cartoon shark showdown. The separate bonus never changes the three-round scores, creates paid image jobs, or destroys the stored artwork.
- Phones have a transparent fish editor with clipped body paint, attached shapes outside the silhouette, layers, undo/redo, touch zoom, swim preview and immutable PNG retry. Private server-authoritative submissions, shuffled ranked ballots, readiness checks and bounded cinematic timing drive fish introductions, eliminations, champion reveal, artist lineup and the restored final aquarium. Host controls include setup Back, pause, extra time, gentle mode, skip and return to results.
- The default main menu now cycles verified positive-vote round winners, fading from each original drawing to its actual transformed image with artist attribution. Public display requires explicit artist opt-in. Durable D1/R2 copies, bounded feeds, withdrawal and retry guards keep this independent of expiring room media. Unverifiable historical entries and practice bots are excluded.
- Independent review resolved suppressed same-version cinematic updates, dual host/player cookie ballot authentication, per-voter ordering and irreversible setup cancellation. Full suite: 1,157 tests, 1,148 passed, nine existing skips, zero failures. TypeScript, production build, nine production-render checks and diff checks passed. Lint has zero errors and four native-image optimization warnings.
- Browser checks used the managed preview: a real three-bot match completed all rounds and its bonus returned to identical main scores; editor gestures/tools, a real 1024×768 transparent PNG export and locked draft reload, plus Canvas fallback scenes and a narrow editor layout were inspected. Post-fix real-room playback also delivered fish introductions, shark arrival, elimination, final two, champion and artist lineup. Temporary QA routes were removed. Local Playwright scenarios remain unexecuted because Chromium and executor-to-preview transport were unavailable. Physical phones, WebGL/GPU performance, WAN synchronization, authenticated human upload and hosted R2 acceptance remain unverified. No paid provider calls were made.
- Prepared as a source/version checkpoint without production deployment, as the supplied implementation brief requires. Architecture and operational details: docs/fish-finale.md and docs/sketch-showcase.md.

# Sketch & Sorcery playtest upgrade — 2026-10-31

- New matches have three rounds: normal, a last-place-selected global curse at 2× points, then a personalized modifier/starter finale at 3×. Timed defaults handle absent players; saved version-2 matches retain their rules. All choices and scoring stay server-authoritative, including unique score-event keys.
- Drawing editor: compact bottom dock, two-finger pan/zoom, transparent copy/paste/move/resize/rotate, gap-tolerant fill, bounded long assignment support, curse handler locks and editable starter sketches. Bot practice art remains free and reflects curse/starter style. PNG upload remains the trust boundary, not a malicious-client anti-cheat protocol.
- Enlarged accessible QR dialog in shared/game lobbies. Reveal/gallery distinguish drawing assignment from the unchanged exact AI transformation instruction.
- Verification: full serial run had 1,077 passes, nine existing skips and one outdated 141-character rejection assertion; after correcting the 240/241 boundary, all 48 affected editor/gameplay tests passed. TypeScript, production build, nine production-render checks and diff checks passed. Independent authority/privacy review found no blocker. Browser checked lobby/QR close/focus and editor draw/select/copy/resize/rotate; free-bot match progressed through round two. Physical phone pinch/audio and live AI generation were not tested. Preview restarted after a build-time connection interruption.

# Sketch & Sorcery researched 100-prompt catalogue — 2026-10-30

- Replaced the sixteen repeated inspiration examples with 100 distinct ideas, at most 37 characters each, from eleven documented sources. The phone exposes the whole scrollable list with a visible count.
- Research supports a curated selection, not a verified popularity ranking: 21 published phrases with capitalization/articles normalized and 79 concise adaptations, including analogous drawing-game suggestions. Every entry carries provenance in lib/content/sketch-prompts.ts and the complete list is in docs/sketch-sorcery-prompt-research.md.
- Automatic election filling now uses the persisted private shuffle seed to sample the full catalogue rather than always choosing its first five. Borrowed ideas stay non-original; player-written prompts retain tie priority.
- Final combined verification: 1,056 unit tests with nine existing skips, eight focused browser checks, TypeScript/lint/build/diff and nine production-render checks. The unit suite ran serially after an unrelated Light Trails timing assertion failed under parallel load; that exact test and both complete serial suites passed unchanged.
- A broader animation assertion exposed a leak in the test's delay gate: a second TV poll bypassed the first held request. Trace review identified the early delivery; gating every TV poll preserved the movement assertions and the final six browser checks passed. No production animation code changed in this update.
- Catalogue review found no blocking issue. Physical-device touch/audio, live AI generation and a clean whole-application browser suite are not established by this follow-up. Publication provenance and final live acceptance are recorded in sibling prompt-catalogue-publication-receipt.json.
- Preserved concurrent approved-audio source v97 (97df1f92fc1bee9181c2def5e78a7f2c6e322e50) by merging it as an ancestor. Revalidated the combined source, including narration ducking and music rotation; retained both release records when resolving the STATUS-only conflict.

# Approved TV soundtrack and effects - 2026-10-30

- Imported 27 explicitly liked Suno clips within the user's existing download allowance: 12 music tracks, 14 effects and one tavern ambience. Skipped 16 extra/unavailable variants. All five existing medieval tracks remain in the context playlists.
- Music rotates quietly through one parent-owned playback sequence with fade-out, stop, then fade-in. Host/TV effects include join, submission/vote locks, card/scroll reveals, round opening, all-votes, score counting, time-up and winner/tie cues. Existing synthesized effects remain fallbacks; urgent timer beats and six artist animation accents are generated locally with soft envelopes.
- Native Sketch phases follow the authoritative snapshot, including v96's longer spotlight durations. Narration ducks music; late speech callbacks cannot unduck a replacement utterance. Phones stay silent, mute persists, and effect bursts remain bounded while existing voices fade.
- Verified all 27 audio hashes and decodes (22,659,414 bytes); removed precisely the 27 matching Downloads originals after verification. Source URLs, selection/skips and hashes are in assets/source/audio/approved-import.json.
- Verification: 1,054 unit tests passed, nine existing skips; two focused browser audio checks passed on isolated disposable storage. Lint, TypeScript, production build and nine production-render checks passed before the final packaging build. Independent review's effect-cap and narration lifecycle findings were fixed and rechecked.
- Broader browser attempt: six passed, three failed (Arcade picker navigation, Arena Survivor, bot-switch flow), 103 not run after the failure limit. An earlier audio navigation timeout and local D1 collision were resolved by a single isolated test server; the final focused checks passed. This is not a clean full-application browser release. Physical TV/phone listening remains for the user.

# Sketch & Sorcery longer spotlights and reliable avatar moves — 2026-10-30

- Anonymous drawings now receive ten seconds each, up from four. Artist reveals last twenty seconds, up from fourteen. The TV uses larger contained artwork and compact presentation chrome during both phases.
- Fixed avatar moves that arrived after their animation time had been consumed. Each recent authorized sequence starts once at the TV's first painted frame, survives repeated snapshots, and clears afterward. Reduced motion displays a distinct still pose and action label; phones acknowledge accepted moves.
- Regressions reproduced the old 16-second four-drawing showcase, undersized artwork, late-update neutral poses and a delayed first animation frame. Browser coverage checks all six moves for the winning artist, a held 3.5-second TV poll, actual SVG joint motion, unchanged reduced-motion poses, phone acknowledgement and performer ownership.
- Verified 1,044 unit tests with nine existing skips, all five focused browser release checks, TypeScript, lint, production build and nine production-render checks. Exact publication hashes and live acceptance are recorded in the sibling showcase-fix-publication-receipt.json.
- Independent review found no material new issue. Physical phone/TV hardware and live AI generation were not exercised in this follow-up; the previous broader app browser failures remain outside this change. Current rules: docs/sketch-sorcery-rules.md. Plan and evidence: docs/superpowers/plans/2026-10-30-sketch-showcase-fix.md.

# Sketch & Sorcery shared-prompt exhibition — 2026-10-30, release candidate

- New matches elect two shared prompts, give every artist four minutes per sketch (six extended), show anonymous AI-first tours/galleries, and use ranked 100/75/50 laughter ballots plus 50-point artist-guess bonuses. Existing saved relay matches retain their original rules.
- Added original/AI comparisons, staged low-to-high results, saved-avatar/name reveals, performer-only dance/cheer/wave/bow/shrug/facepalm controls, joint champions and a complete phone exhibition. Host and controller use the existing navy/parchment/cyan/gold system with reduced-motion support.
- The scripted narrator announces tasks, remaining time and the second-prompt halfway transition; it names the final submitter and revealed artist with gentle rotating jokes. It uses browser voice and explicit host opt-in, with permanent captions and no paid text generation.
- Fixed the first-render countdown across phase changes, preserved playable HTTP fallback when the native socket is unavailable, and bounded PNG preparation so a stalled encoder unlocks for retry without dropping the sketch.
- Final verification: 1,042 unit tests passed with nine existing skips; all five targeted browser checks passed (complete four-phone match, ten-player gallery/scoreboard, forced encoder failure/retry and desktop/mobile host-control dialogs); all nine production-render checks, TypeScript, lint, production build and diff checks passed. Independent server review and the private-shuffle follow-up found no remaining critical or important issues.
- Live v94 acceptance reached the new two-prompt showcase with three free practice bots, no image jobs and no exposed shuffle seed. Its generic End game cleanup call was rejected by the existing Arcade lifecycle guard; the game instead finishes through its own results/replay controls.
- Real uploads, full two-prompt scoring, avatar ownership and ten-player TV layouts have been exercised locally using original-image fallbacks. Physical-phone touch/audio and real hosted AI acceptance remain unverified by this change.
- Broader application browser run: 75 passed and 34 failed across Arcade/shared-lobby/realtime/presentation cases, including an animation-measurement assertion in the new scenario that was subsequently corrected and passed in the final targeted run. This is not a clean full-application browser release. Tests were not weakened; failures outside the requested game remain unresolved.
- Anonymous gallery order now uses a persisted private server seed; a red/green regression proves the public room identity cannot reconstruct the artist permutation. Short ballot narration finishes before time reminders. The existing native Worker forwards opaque actions/snapshots, so these new Site-authoritative actions require no Worker protocol redeployment.
- Rules: docs/sketch-sorcery-rules.md. Plan/ledger: docs/superpowers/plans/2026-10-30-sketch-showdown.md. Published core update v94 from ea3771a777b0cef3d90eeb51b32f5f2c8c3d4689. The final live-smoke follow-up removes the unsupported generic End game control from Sketch & Sorcery and maps expected action rejections to actionable HTTP statuses. The sibling publication-receipt.json records the latest published version and exact build hashes.

# Character action contrast — 2026-10-30

- Fixed cream-on-cream Customize character styling in the shared character profile card. The saved/disabled button now remains readable at full opacity; editing and save behavior are unchanged.
- Verified TypeScript, lint and 1,006 unit tests (9 existing skips). Focused phone checks cover button contrast, touch size, placement and opening the editor at 320px and 390px. The regression reproduces the original Customize contrast failure.

# Allowance-protected OpenAI images — 2026-10-30

- Connected the existing low-quality image option through a dedicated image-only secret. OpenAI text remains separate. Added Sketch & Sorcery source-image editing and generator choices in setup and its authoritative lobby.
- Added atomic D1 reservations and single-use request permits, hard limits of 100 requests per room, 300 per UTC day and 1,000 per verified window, a finite stop date, a kill switch, and a credit/billing circuit with two independent persistence paths. Failed and timed-out attempts still count; there are no automatic OpenAI retries or paid provider fallbacks.
- Guard stops produce an allowance-protection message and keep matches usable with concept cards or original drawings. Generic provider errors are sanitized before persistence so they cannot save credential fragments.
- Verification: 1,006 unit tests passed with 9 existing skips; TypeScript and lint passed. The 3 focused browser checks passed; the no-key API integration check passed; the picture match and solo fallback browser scenarios passed.
- Broader QA is incomplete: the full browser attempt stopped after 3 Arcade failures (7 passed, 93 not run), and the older three-phone reload scenario timed out separately on two runs. These checks were not weakened. Physical-phone performance and a full clean browser release run are not established.
- Funding boundary: a normal API key cannot verify remaining free-credit balance or stop a transition into purchased credits. Activation relies on verified subscription credits and no paid billing plan/payment/recharge path, plus the earlier stop date and request caps. If both durable circuit writes fail, only the current worker's memory stop is assured across that failure.
- Live pilot v90 generated a confirmed WebP through the real authenticated job endpoint. A temporary one-request cap then made availability false and rejected another OpenAI room with HTTP503/ALLOWANCE_STOP before another provider call. Final activation keeps the same spent reservation and raises the request cap to the reviewed limit. Deployment and image hashes are recorded in the local release receipt. Rollback to v89 must remove the image-only secret before redeployment, since v89 does not enforce the new guard flag.

# Sketch & Sorcery — 2026-10-30

- Added a complete native Callback party game (`sketch-relay`) with three rounds for3–10players: three simple prompt choices, drawing, actual-sketch FLUX.2 transformation, blind caption, redraw and TV chain reveals. Shared party and direct room launches, free practice bots, server timers, participation/applause scoring, pause/resume, reveal replay, replay game and an all-round gallery are integrated.
- Phones retain a full-screen canvas with compact tools, private assignment-specific drafts, a fixed redraw caption,480px padded PNG upload, manual retry and deadline auto-submit. Uploaded sources are immutable and atomically submitted. Images are reference-based; missing providers/storage cannot create fake AI output or stall the match. Original sketches remain honest fallbacks.
- TV presentation includes aligned original→AI dissolves, comparison controls, subtle animated lighting, reduced motion, optional browser voice tutorials/captions, and existing host music. Screens use one music owner. Public instructions never speak private prompts.
- Independent review repaired upload-ID compatibility, HTTP-preview crypto support, pause keyboard controls, reveal timing/replay, and queued-work dispatch. Up to10 distinct jobs dispatch concurrently with leases, in-flight guards,204-poll retries and current-match completion checks. Both game timing modes fit the fixed party session budget without host pauses.
- Release verification:992 unit tests passed,9 existing skips; TypeScript and full lint passed. Browser playthrough reached the final gallery across all three rounds; actual original/redraw480px assets loaded, points were credited, and pause/resume preserved the assignment. The local preview used real source-image fallbacks because its provider is unconfigured. Physical touch/audio and real hosted provider acceptance remain separate from these checks.
- Implementation plan and independent review: docs/plans/2026-10-30-sketch-relay.md and docs/sketch-relay-review.md. OpenAI image activation remains deferred by user instruction.

# Drawing prompt and interface review — 2026-10-29

- Replaced the long fixed prompt with three selectable short ideas, refresh and optional custom input. The full selected prompt wraps, is announced to screen readers, and persists with the sketch. The 48 original prompts use familiar concrete subjects with at most five words.
- New pages fit the viewport immediately with bounded rectangular dimensions. Renderer, fill and PNG export preserve both dimensions. Existing square drafts retain their pixels and view behavior; a confirmed New page action creates a viewport-shaped replacement. Whole drawing preserves sized pages after rotation.
- Pen/eraser and history are direct stable controls. Advanced options start collapsed; persistent restore overlays are gone. Done disables after Clear and recovers after Undo. Native fullscreen is requested from prompt selection where supported; no forced load-time request.
- Browser checks: 320×640 and 844×390 viewports; complete wrapped prompt; exactly three choices and refresh; saved prompt/page recovery; rectangular shape/fill/history and 512×1024 PNG; Clear→Undo state. Independent review found no remaining material issues. Native fullscreen success and physical touch/download remain unverified.
- Release checks: 963 tests passed with nine existing skips; TypeScript, lint and production build passed.
- Real player/critic review evidence, tradeoffs and detailed critique: docs/drawing-studio-review.md. No multiplayer or paid AI changes.

# Full screen drawing — 2026-10-29

- The drawing canvas now covers the viewport. Removed the title/sidebar and fixed tool trays; a compact floating dock opens tools, colour, size and expandable canvas/display/file menus. Short landscape phones use a vertical dock.
- Added Hand pan, zoom, Fill screen/Fit whole sketch, focus mode and optional browser full screen. Uniform scaling preserves the original document geometry, drafts, history and 1024px PNG export.
- Browser checks cover 320×640 portrait and 844×390 landscape, dropdowns, focus mode/return, pan, actual drawing, undo/redo and full-sketch PNG preview. Physical phone touch and native download UI remain unverified. The cloud browser denied native full screen; its unavailable message was verified. No changes to game engines or AI generation.
- Release checks: 959 tests passed, nine existing skips; TypeScript, lint, production build and independent review passed.

# Drawing Studio — 2026-10-29

- Added /drawing-studio: a working phone-first drawing dashboard for the planned sketch-to-AI game. Includes pen, eraser, flood fill, line/rectangle/oval, palette and brush sizes, undo/redo including Clear, device draft recovery, sketch review and 1024px PNG export.
- Researched official Gartic Phone, Skribbl, Drawful and Quick, Draw! interfaces. The original UI follows the existing navy, parchment, cyan and gold visual system. Research and scope: docs/drawing-studio.md.
- Canvas operations remain separate from multiplayer phases/scoring. No paid image requests occur here; sketch-to-AI transformation is not connected yet. The pre-existing optional OpenAI image backend remains unavailable without an image API key.
- Browser checks cover actual drawing, shapes, fill, undo/redo, undoable Clear, restored drafts, PNG preview/data export and 320px/390px portrait plus 844×390 landscape layouts. Physical phone touch and file-download UI remain unverified.
- Release checks: 959 tests passed with nine existing skips; TypeScript, lint and production build passed. Independent review found no remaining material issues.

# OpenAI low images — 2026-10-29, activation pending

- Added ChatGPT Images · Low to setup and host lobby selectors. The server fixes this choice to GPT Image 2, low quality, one image, and preserves comic reference edits.
- Image-only OPENAI_IMAGE_API_KEY keeps paid text/lore off. Missing-key selections are disabled and rejected server-side. Existing FLUX defaults and fallback chains remain; FLUX cannot implicitly call OpenAI.
- One OpenAI attempt ends in a concept card on failure. SDK retries are disabled; the 150-second lease exceeds the 120-second API timeout, and attempt acquisition uses a compare-and-swap guard.
- Final checks: 953 unit tests passed, nine opt-in/legacy skips; TypeScript, lint and production build passed. Independent review found no remaining issues. Browser confirmed both selectors, setup-required state, and FLUX room creation. Opening the native selector later stalled browser automation; direct executor-to-preview HTTP acceptance checks were unavailable, so the new opt-in missing-key API test has not passed against a running server.
- Activation is pending: no OpenAI image key is configured. No real OpenAI image was generated. Configure the image-only secret and run real-image acceptance before enabling this option.

# Callback Status

## Arcade persistent WebSockets — 2026-10-15 release candidate

- All 23 active Arcade games now use authenticated host/phone WebSockets. Six continuous-action games and standalone Sumo use durable server simulation; normal shared-lobby Sumo uses the proven 120 Hz backend. Sixteen native games retain D1 authority with socket actions and individually projected snapshots.
- Normal Crownfall selects the faster backend, with optional bots, sparse roster mapping, mirrors and persistent parent identity. Connections reconnect when changing game frames; the parent party and player identities stay the same.
- Shared admission belongs to the parent lobby, persists across New Game, and releases only when the lobby closes. The existing free limits remain one active party, ten seats and a fixed 20-minute session. No paid plan changes or schema migrations.
- Review repairs cover dual HTTP/socket authority, removed-seat takeover, pause/resume continuity and epochs, lease deadlines, stale child cleanup, native rate limiting and socket-loss polling recovery. Release checks and exact deployed identifiers are recorded separately in .logs.
- Local release checks: 944 unit tests passed, eight existing skips; TypeScript, lint, build and nine render checks passed. All 23 games passed host/phone/mirror transport, with focused online and native gameplay, pause/reconnect and replay tests.
- Physical-phone latency across all games is not certified by automated browsers. Native D1-based games may still have database latency.


## Deep review repairs — 2026-10-15, local only

- Fixed Sumo delivered-result cold recovery and cumulative replay backlog by separating the visible latest result from pending delivery; legacy checkpoints safely requeue idempotent deliveries. Failed checkpoint writes no longer poison subsequent writes. Retirement waits for pending result/checkpoint work before deleting state.
- Human Sumo seats begin disconnected and time out correctly. Recovery resets stale connectivity, restores only current-match authenticated sockets, selects the newest controller, and rejects match replacement during ticket authentication.
- Child-room character edits update persistent parent membership in the same guarded D1 transaction. Parent music changes synchronize the embedded host's controls and cached preferences without changing SFX/narrator selections.
- Separate local fixes remove Scratch Match's future patterns from PR 7 phone snapshots and enforce preview join capacity/locking inside its transaction. Those remain in their respective checkouts; they are not ported into the Site.
- Independent review accepted all seven fixes. Final Sites checks: 923 unit tests passed, eight existing skips; TypeScript, lint, production build, nine render checks and five focused browser cases passed. Sumo Worker dry-run bundle passed. PR checkout tests: 58 passed; local preview tests: 15 passed. Physical devices and fresh hosted acceptance remain unverified. No deployment or push performed; production remains unchanged by this work.
- Repair branch: `codex/fix-seven-review-findings`, based on `3456d1874cc7d443effffbbfe8d88bf5d297e4ed`. Full repair evidence and locations: workspace `output/deep-review-2026-10-15/FIXES.md`.

## Royal Sumo real-time pilot — 2026-10-13

- Opt-in Arcade entry uses a free Cloudflare SQLite Durable Object with persistent authenticated WebSockets. Original Royal Sumo physics remain authoritative at 120 Hz; compact host snapshots arrive at 20 Hz and phone status at 10 Hz. The original renderer interpolates a 33 ms buffer with bounded extrapolation. D1 is outside the movement/simulation loop.
- Shared-session code, identities and membership survive New Game and launching the next existing game. Join all phones before selecting the pilot. Six maps and cup mode are supported; other games wait for physical Sumo acceptance.
- Workers Free only: one active pilot party, ten seats, maximum 20 minutes. Quota failures never trigger a paid upgrade. Short-lived origin-bound tickets, stale input, reconnect epochs, host loss, recovery checkpoints and idempotent durable results have focused regressions.
- Concurrent changes through v81, including bot/archive/music and phone polish, are preserved. Unit verification passed 913 checks with eight existing skips; all nine production render checks, lint, TypeScript and the final build pass. The 99-case browser catalog is covered across broad runs and focused repairs; the final built preview passes both Sumo touch/reconnect/party switching and Bowl guess/TV-resize checks. A scoped overflow fix prevents focused Bowl controls from scrolling the TV scene during transitions.
- Ten live cloud controllers passed input, pause/resume and reconnect, with 42 ms median / 56 ms p95 RTT across 219 samples from this PC. Site v82 is published; fresh hosted touch, paused reload, resumed input, responsive layouts and same-party Air Hockey switching passed. Physical Android/iOS response remains unverified.
- Instructions: `docs/arcade/SUMO_REALTIME_PILOT.md`. Rollback is Site v81. Release identifiers and fresh hosted verification are recorded in `.logs/party-latency/release-receipt.json`.

## Game curation and optional bots — 2026-10-13 release candidate

- Archived the sixteen explicitly marked Arcade games from every active selector, new room/start/replay path and direct playable entry. Production builds also replace their static entry pages, since Sites can serve assets before the Worker. Already-playing legacy iframes require a matching authenticated host, phone or active mirror session. Source and licences are preserved; earlier Classic Bowl, Birthday and Royal War Room archives remain intact.
- All thirty retained game concepts have a phone-enabled launch and optional free bots. Empty seats use red Off / green On switches; phones replace bots with fresh authenticated identities. Hosts can select zero through ten bots within each game's participant minimum. Online and featured matches freeze sparse rosters; bot preferences survive phone replacement/departure. Historical native player rows and score attribution are preserved.
- Bowl and all sixteen native engines use validated authoritative bot actions. Bots cannot inspect rival hidden roles or ballots. Drawing/acting bots offer limited coded practice cues; Bowl host-entered guesses must match the secret scroll before earning points. Incorrect guesses remain correctable in the UI.
- Preserved the concurrently published v77 avatar/mirror changes, v78 music preference correction and v80 phone-section/puppet polish. Phone-bot migration 0011 follows the immutable live avatar 0009 and mirror 0010 migrations; the complete local migration chain passes on a fresh QA database.
- Fixed strict persistence schemas for Bowl/Pantomime bot clues, native lobby switch routing, imported sparse contestant names, direct archive asset routing, Flatterfluff deadline recovery, and private-board/input isolation during phone-seat replacement. A visual Bowl check also found and corrected player-strip overlap; desktop layout checks pass at 720p, 768p and 1080p; compact embedded lobbies keep Start and bot switches visible.
- Review of each retained game, AI value, further archive recommendations and hosted alternatives: `docs/2026-10-13-game-curation-review.md`. Doot, Gartic Phone, skribbl.io and AirConsole links are available in Party Games. No AI images or paid AI work were generated.
- Validation: the final merged unit suite passes 882 checks with eight existing opt-in/legacy skips. All sixteen native games complete three-bot and ten-bot matches with persistence after each turn. The 63 phone-runtime/adapter checks, eight production render checks, TypeScript, lint and production build pass. Across the broad browser run and focused repairs, 98 scenarios are verified, including the thirteen v80 phone/puppet/mirror cases. Light Trails' unit test now stops its background simulation before asynchronous setup; its durable-write assertions are unchanged. Mirror reload traces showed valid authentication and a delayed local Vite child load; explicit parent/child readiness waits pass without changing production mirror logic. Air Hockey passed its isolated result/replay check after a full-suite timeout under local load.
- Twelve fresh hosted scenarios passed on v79, including all five featured phone input/reconnect/close flows, bot-free and sparse rosters, shared membership, and Bowl judging. Live QA exposed the static archive bypass; the build-time gate and authenticated mirror compatibility now pass focused checks. Built output has seventeen archive notices, two guarded legacy renderers and nine unchanged retained entries. The release receipt records the final source build, republication and fresh deployed checks. Physical Android/iOS, virtual keyboards and real Wi-Fi latency remain unverified.

## Phone sections and jointed clothing — 2026-10-13

- Phones use fixed Game, Character and Style sections with Back controls. Character dragging, nine reactions and joint controls have separate screens; short landscape layouts paginate reactions and controls. Native tasks advance with Next area/Back area, retain private drafts and keep focused controls visible. Manual scrolling is disabled in these phone sections.
- Mobile character editing shows one feature or piece adjustment at a time, with reachable history/reset and Done controls. Ten-player shared phone lobbies fit compact portrait and landscape screens; names and bot labels retain separate space from character art.
- Sleeves, patterned sleeves, tattoos and body/head accessories now follow their corresponding joints and saved arm transforms. Existing SVG art, configuration IDs and server-authoritative cosmetic transport are preserved.
- Preserved the concurrently published v79 curation and bot controls. The merged unit suite passes 879 tests with eight existing skips; 17 related browser checks pass, including all phone/puppet checks and the new Bowl bot seats. A further offline/online check passes: player identity and gameplay version survive, and new motion is accepted after recovery. The separate Sumo mirror reload selector fails despite a visible game screenshot and is recorded as unresolved. Joint sliders hold their own targets, so spring animation cannot overwrite input; opening Joint controls pauses the previous reaction. The prior final 13-check run and three repeated slider runs passed. Exact-source build checks and fresh deployed evidence follow in the release log. Physical Android/iOS, real virtual keyboards and Wi-Fi performance remain unverified.

## Host music preference correction — 2026-10-13

- Title, main host and mirror host now use one music preference. An older saved host mute or volume cannot override the default Music on at 20% when entering Main Host.
- Deliberate mute and volume changes persist across reload and embedded games. Fade envelopes retain their progress while muted, so turning music back on restores audible volume. Sound effects, narrator and voice changes preserve the current music choice.
- Browser regressions reproduced the old menu-to-host mute, delayed unmute after reload, and sound-effect controls overriding mute. The final release receipt records verification and publication.

## Continuous host music and mirrored screens — 2026-10-13

- Main and mirror hosts share a layout-owned two-song menu playlist at 20%, with guarded asynchronous fades and a synchronous title-click unlock. Phones and embedded duplicate players remain silent. Game phase switches the parent soundtrack only when play begins; New Game restores the playlist.
- Host selection now offers Main host and Mirror host. The shared host header exposes a stable four-digit display pairing code; mirrors follow categories, lobby, main games, online Arcade, reload and New Game with read-only credentials. One join code and membership persist across games.
- Appended mirror and presentation tables match runtime bootstrap and Drizzle migration0010. Version guards, role-specific snapshots, current-child checks, hashed credentials and rate limiting preserve server authority.
- Review and targeted backend/audio checks passed. The merged release preserves Site v75's live paper puppets, six active packs and archive guards. Migration0009 is retained unchanged; mirror tables are appended in0010. The final built-Worker gate passed all five cases for main/mirror audio, silent phones, persistent players and characters, archived packs, and serial polling. The full merged unit suite passed 815 tests with eight existing skips; all eight production render checks and all eight preserved character browser checks passed. Embedded game headers hide legacy duplicate join/display links, and the compact lobby keeps Start Game visible.
- Final release checks and fresh live verification are recorded in the release receipt; physical phone audio/camera and real Wi-Fi performance remain unverified.


## Live paper puppets — 2026-10-13

- Host cards reserve a clipped character stage and a separate name/bot footer; compact spacing keeps the Start button visible at 1280×720, 1366×768 and inside the shared lobby frame. Avatar SVGs stay within their boxes; an open phone puppet pad preserves the game panel and allows scrolling.
- Phones have a collapsible puppet pad: drag hands, feet, head, body, eyes and mouth, with elbow/knee bending and spring release. Nine timed reactions include wave, jump, cheer, cry, funny, dance, facepalm, laugh and wobble; Settle resets the puppet. Keyboard controls and stationary reduced-motion reactions are available.
- Saved character pieces, profile history and Undo/Redo remain intact. Cookie-authenticated transient pose rows expire after three seconds and do not change gameplay versions, phases, scores or match history. Host polling is single-flight; phones avoid pose polling and send at most three updates per second while moving.
- Verification: 820 unit checks passed (eight existing opt-in/legacy skips), eight production render checks, production build, TypeScript and lint. All 95 browser scenarios were verified across the broad run and focused reruns, including eight new pose scenarios. Fresh deployed smoke follows; physical devices and real Wi-Fi performance remain unverified.
- Implementation and source references: `docs/avatar-live.md`. Existing SVG art and local spring/IK math were reused; no generated images or new physics dependency.

## Pack archive — 2026-10-13

- Archived `bowl` (Bowl of Fools Classic), `royal-war-room` (Royal War Room), and `birthday` (30th Birthday) from new room creation and game selection. Their source, gameplay engines, and persisted-room compatibility remain available for restoration.
- Current native pack selection has six packs: Bowl of Fools, Royal Rumours, The Royal Frame-Up, King Prompter, Let's Make a Comic, and Legacy Standard. Arcade remains on its separate launch paths.
- New archived room creation, shared-session launches, archived host configuration, new starts, and replays are rejected. Existing archived matches can continue. Old birthday and setup links display an unavailable notice with a return to the active menu.
- Archive IDs, date, and restoration notes: `docs/archive/game-packs.md`.
- Verified 809 unit checks (eight legacy/opt-in skips), the archive API gate, and all 87 browser scenarios across the broad run and focused reruns. A fresh local database needed its existing phone-input schema; one retained phone replay control was restored during review. Production build, render, lint, TypeScript, and whitespace checks run against the exact source before publication.

## Shared lobby and character profiles — 2026-10-13

- Approved CALLBACK title and preserved intro now lead to host/player roles. The host creates a shared lobby before selecting a category or game; phones join a stable session route.
- New Game retains session membership and code across native party and online Arcade adapters. Existing game engines retain phase, scoring, player-count and disclosure authority; retired game mutations and late jobs are guarded.
- Anonymous hosted character profiles retain bounded Undo/Redo across Save/reload, starting baseline and canonical default. QR scanning is user initiated with manual entry and native/jsqr decoding. No account or download is needed.
- Release verification passed: 805 unit tests with seven existing skips, 89 browser cases covered across the broad run and focused repairs, eight production render checks, build, TypeScript, lint and whitespace. Arena Survivor passed twice on isolated reruns after one unreproduced API/DOM mismatch during dev-server updates. Public publication and fresh live verification follow; physical phone camera/device performance remains unverified.


## Interface and phone QA pass — 2026-10-12

- Fixed the online Arcade phone-join failure observed against real local D1: ten seats now use a single atomic VALUES query compatible with D1's compound-SELECT limit. Token authentication, room/phase guards, seat capacity and uniqueness remain intact.
- Improved dark phone instruction/title contrast and the Arcade controller link's spacing and 48px target. Host control dialogs wrap keyboard focus at their boundaries. Featured phone lobbies wait for asynchronously installed game adapters.
- Verified all 23 same-origin online Arcade games with two isolated phone browsers, accepted game inputs, pause/resume, reload/reconnect, and portrait/short-landscape layouts. All 15 full-game packages and all 20 practice routes passed browser layout/boot checks. Main game lifecycles include both Bowl versions, Rumours and War Room; no paid image generation was used.
- All sixteen native room routes passed their 22 browser scenarios. All seven featured mailbox games passed phone joining, accepted controls, reconnect and closure; Roller uses an actual on-screen stick drag. Air Hockey, Light Trails and Tap Race passed server-recorded results and same-room replay. Older setup links now redirect to their current online service.
- Release candidate verified: 794 unit tests passed with seven existing skips; all eight production Worker render checks, production build, TypeScript, lint and whitespace checks pass. Browser coverage includes 87 scenarios across targeted runs. Windows harness file URLs/path separators and raw imported-asset line endings are handled without changing licensed asset bytes. Exact-source packaging and publication follow these checks; physical Android/iOS and real Wi-Fi performance remain unverified.


## Shared Arcade touch UI — 2026-10-12

- Applied the same scoped touch policy to all twenty physical practice games, nineteen room games and Blind Crown: game text/images avoid browser copy/select/drag callouts; editable name/answer/settings fields keep typing and paste. Controls use 48px targets, safe-area spacing, pressed/focus feedback and reduced-motion behavior. A saved larger-controls toggle is available in each full game's menu and the prototype/native/online phone toolbar.
- Independent pointer ownership fixes second-finger stick theft, action releases that cancel another hold, lost-capture movement and second-finger drawing/aim changes. Online keyboard/pointer hold sources stay separate. Releasing a stick preserves pending action taps. Match/auth resets discard stale drags; backgrounding/resizing releases controls. Removed Roller's global touchmove cancellation and restored explicit gesture suppression for imported game pads/actions.
- Eleven focused shipping-handler/policy checks, the arena lifecycle regression and the mounted native phone multi-touch/focus/reset regression cover these cases. Review found and fixed focus-change key releases, match-change drag ownership and native CSS cascade gaps. Full release evidence is recorded in docs/arcade/upgrades/TOUCH_UI.md. Browser and physical Android/iOS gesture/layout verification remain unavailable; no 9/10 certification is added.

## Featured arcade TV and phone rooms — 2026-10-12

- Imported the current seven CALLBACK-ARCADE games, preserving Royal Sumo Crownfall 1.3.0. Each featured game has a TV lobby, local QR/code, ten phone seats, per-game controls, pause/reconnect/close handling, and bots for unoccupied seats. Blind Crown has private planning boards; Roller Ruckus has a phone radar.
- Room ownership and private routing use a separate authenticated D1 mailbox. The TV runs these standalone simulations; existing party scoring remains authoritative and separate. Delayed input expires for safety, so network delay affects play, especially rhythm timing. Keep the TV tab active.
- Concurrent Site v65 is preserved: its online service, existing titles, and matching simulation/view/map contracts remain available. Featured worlds use their newer shared-phone flow. Applied v65 migration0006 is unchanged; phone tables are appended in0007.
- Verification: pre-merge690unit/integration passes and7existing skips; merged release763passes/7skips with5 legacy-reference failures subsequently resolved by24 targeted online tests. Phone schema/catalog27checks and final UI29checks pass; lint/typecheck pass; final merged production build and seven Worker render checks pass. Version69 is live. The strict125-request HTTP check passed all seven game rooms:10Sumoseats and2perothergame, every submitted input delivered,11thseat rejected, private routing/reconnect/closure verified. Browser and physical-phone playtests are unavailable in this managed environment; no9/10 or competitive-latency claim.
- Live verification isolated a D1 compound-SELECT limit during joining. Seat allocation now uses a VALUES CTE in the same atomic statement; 22 backend regressions pass. The live ten-seat join passed after this fix. A separate live input-expiry issue led to a 1500ms delivery budget with a 500ms held-control watchdog; 53 focused backend/UI checks pass. Final live delivery verification passed onversion69.
- Play instructions: docs/ARCADE-PHONE-ROOMS.md.

## Ten-phone online Arcade checkpoint — 2026-10-12

- All twenty physical titles and nineteen native room titles have a ten-controller online launch. The twenty physical games plus Air Hockey, Light Trails and Tap Race use authenticated same-origin Site rooms, QR/link joining, persistent phone seats, bot fill-ins, host pause/resume and server-owned results. The other sixteen native room games retain their existing private phone flows with actual ten-player rules and persisted-state validators.
- Sumo uses the pinned v1.3 simulation and original renderer. Five other imports preserve native physics and rendering; eight full arena packages and six remaining prototypes reuse their existing engines. The formerly two-seat magic/minion games now resolve a living rival ring; Air Hockey uses two teams of up to five paddles.
- Review regressions cover atomic seat capacity, role separation on a shared browser, stale movement/charge, pause epochs, input replay, Sumo charge authority, terminal Air Hockey timing, complete Roller bot finishes, visible Tailblazer trails, actual engine results and one result row per match. The appended migration preserves existing migrated tables and data. Release validation is recorded in docs/arcade/upgrades/PHONE_MULTIPLAYER.md.
- Fourteen full packages remain the quality checkpoint. Six physical prototypes and nineteen native room titles still need the wider 9/10 upgrade work. Browser and physical ten-phone sessions, latency and device performance remain unverified in the managed environment. Online functionality and automated tests do not certify AAA quality or the overall 9/10 goal.

## Fourteen-game arcade source checkpoint — 2026-10-12

- Added Manic Panic, Rubble Alliance, Dragon Drop and Volt Vault to the ten existing full packages. Each uses the existing deterministic engine, ten contestants, a live bot starting demonstration, Crown Cups, saved customization, three real map mechanics, keyboard/touch controls and local 3D presentation with Canvas fallback. The Party Games hub from version 63 is preserved.
- Review regressions cover Manic combat/seed variation and lost-bomb recovery, fair simultaneous Rubble results, Normal/Hard behavior, Volt's displayed polarity on the exact transition tick, and optional score/elimination feedback in both renderers. Legacy four-player Dragon/Volt defaults remain intact; capacity and rules are opt-in for the isolated full games.
- Release checks: 490 unit/integration tests passed, seven existing skips, zero failures; typecheck and lint passed. The full suite used two concurrent test workers. Production build and Worker rendering are verified by the release workflow.
- Six physical prototypes and nineteen room titles remain unfinished. Browser/physical-phone quality and online Sumo relay availability remain unverified/pending. The 9/10 goal has not been certified; source tests do not establish game feel.

## Party Games guest-pack hub — 2026-10-12

- Added Party Games beside Arcade in the Grand Hall, with the same navigation/audio handoff and shared fallback menu. `/party-games` is a responsive, server-rendered launcher for Doot and Joystick Jammers.
- Launch buttons open the existing hosted packs in new tabs. Each card includes its GitHub source; the hub explains the pack-specific QR/room flow and retains Grand Hall and Arcade return links. No external game runtime, backend or assets were imported, and King Prompter rooms/scoring remain unchanged.
- The production regression checks first failed on the missing menu link and the new route's 404, then passed against the built Worker. Verification: 471 unit/integration checks passed with seven existing skips, all four production-render checks passed, and typecheck, lint and Sites production build passed.
- Both external launch destinations were retrieved successfully. Browser and physical-phone multiplayer playtesting remain unavailable in this managed environment; these checks do not certify ten-player sessions or the third-party games' quality/availability.

## Ten-game arcade source checkpoint — 2026-10-12

- Full packages now replace ten physical prototypes: Sumo, Space Bash, Twisted System, Roller Ruckus, Scratch Match, Sky Balls, Snow Bash, Drain Bash, Jungle Bash and Tie-Breaker. The first six are live as version 61; the next release packages all ten.
- New arenas include crosswinds, thawing ice, mystery weapons, rebound shots, vine pillars and playable gap jumps. Tie-Breaker uses a genuine ten-entrant bracket with two active duelists and sudden death. Shared cups, settings, input/pause cleanup and optional sound are checked.
- The latest unit/integration run passed 471 checks with seven existing skips. Independent review findings have dedicated regressions. Browser/physical-phone QA remains unavailable under managed Sites instructions, so neither AAA quality nor the 9/10 target is certified.
- Ten physical prototypes and nineteen room titles remain unfinished. Their placeholder flags and existing room routes are preserved. See docs/arcade/upgrades/PROGRESS.md for per-game evidence and pending work.

## Arcade full-game replacements — 2026-10-12

- Public Site version 61 serves six full replacements: Royal Sumo, Space Bash, Royal Twisted, Roller Ruckus, Royal Scratch Match and Royal Ballistix. Packages retain original source and license/provenance records.
- Full starting demonstrations, bot modes, custom matches and distinct learnable arenas replace those solo prototypes. Nineteen authoritative room games and fourteen other physical prototypes remain marked as unfinished.
- Release checks: 453 passed, seven skips; typecheck, lint and production build passed. Browser/physical-phone QA was skipped under managed Sites instructions because control-browser is unavailable. A 9/10 rating is a target, not a verified result.
- Snow Bash's next upgrade is recorded in docs/arcade/upgrades/PROGRESS.md. Existing rooms, secrets and D1 authority remain intact.

## Menu, reconnect, and host-controls corrections — 2026-10-12

- All four Grand Hall audio fades clamp normalized progress to 0–1 before deriving outgoing/incoming levels. Early animation-frame timestamps can no longer produce invalid media volumes or interrupt menu navigation; fade durations and soundtrack choices are unchanged.
- A healthy unchanged-room sync response clears only its outstanding network/server connection error. Newer action, authentication, and room errors remain visible, and the existing snapshot/version handling is preserved.
- Host controls use the existing native-dialog convention: opening focuses Close controls, keyboard focus is contained by browser modality, Escape dismisses, and closing restores the opening control. The non-dismissing backdrop, drawer geometry, and end-game confirmation are unchanged.
- Verification: 433 unit/integration checks passed, seven intentional skips; typecheck, lint, production Sites build, and both production-render checks passed. The render test's outdated menu expectation was corrected to include the already-shipped Bowl of Fools and Arcade entries. Classic lobby safeguards and authoritative game mechanics were not changed.
- Added 35 deterministic regressions and two browser scenarios. The configured Playwright Chromium is absent, so browser scenarios were not run in this executor. Simulated media/hook/component checks do not establish physical-device audio, native focus behavior, or mobile touch/layout quality; those remain live-QA items.

## Classic Bowl lobby corrections — 2026-10-11

- Classic now stays correctly selected in the host game-pack menu. Both Bowl lobbies hide bot and image-generator controls, and Classic displays its four-to-ten-human/two-per-team requirement.
- Classic's Start readiness ignores inactive seats, rejects inherited bots with guidance to the existing host controls, and respects its ten-human maximum. No players or bots are silently removed.
- Switching into Classic now runs the existing authoritative team-balancing helper so already-joined humans remain visible and correctly assigned. The modern Bowl mode's existing readiness and game rules are unchanged.
- Thirteen rendered-lobby/engine regression checks cover the controls, team minimums, inactive seats, inherited bots, removal recovery, and repeated pack switches. Baseline live checks verified disposable room creation, player join, refresh restoration, roster sync, and read-only TV mirroring without starting AI work.
- Automated browser verification is incomplete in this executor: the configured Playwright Chromium is absent, and local Cloudflare preview encountered network-interface/sandbox failures. The two attempted Bowl browser scenarios failed before browser launch, not on application assertions. Do not treat these as a passed browser matrix or physical-phone testing.

## Arcade placeholder replacement policy — 2026-10-08

- The owner designates all 19 current Arcade room-game entries and all 20 Practice Lab games as placeholders for future full games.
- Each game card now says: “This game is a placeholder and will be replaced with a full game. Games will be upgraded one at a time.” Individual Practice screens and Arcade room setup show the same notice.
- Placeholder presentation is tracked separately from playable launch status. Existing routes, room mechanics, controls, and simulations are unchanged. Clear only the replaced game's placeholder flag after its full-game integration is accepted; retain notices on the remaining placeholders.
- Focused catalog/render checks: 28 passed. Full unit suite: 385 passed, 7 skipped, no failures. Typecheck passed. This change labels the current experience; it does not import the finished GitHub games or certify multiplayer readiness.

## Arcade lobby solo entry — 2026-09-30

- The native Arcade room lobby now shows the selected Arcade game's title and hides the unrelated King Prompter game-pack, content-mode, and image-generator controls. Player cards reserve space beneath the full avatar for the name.
- Drift Racer now starts with one human player and ends as a no-winner practice run. The 20 Crash Bash/Fuzion Frenzy practice routes remain one-player, no-bot physics sandboxes with Reset and Exit.
- Local verification: 381 tests passed, 7 skipped, typecheck, lint, and production build passed. The local Node preview cannot load the Cloudflare-specific `cloudflare:` module scheme, so room-flow browser checks ran against production instead.
- Published public Site version 57 from commit `23ba18f181f46e0481d284a0a68853b2406f0669` at `https://callback-party-game.dans-host.chatgpt.site`. The version-56 hand-built archive served CSS with the wrong MIME type; it was rolled back to version 54, then version 57 was built from the pushed source and verified styled.
- Live browser verification passed: Arcade setup showed Drift Racer with no unrelated settings, one-player Drift Racer started and advanced through one phone input, the solo lobby showed an enabled Start Game button, and player names sat below the avatar.

## Solo Arcade Practice Lab — 2026-09-30

- Added a Practice Lab catalog and direct routes for all 20 arcade prototypes. Each route runs one human-controlled local simulation with no bots, no competitive results screen, a persistent Reset and Exit, short automatic restart after terminal states, desktop keyboard controls, touch controls, and opt-in auto-reset sound.
- The practice runtime is isolated from rooms, D1, and the Arcade Worker. It uses allowlisted imports and a 30 Hz fixed-step simulation. Practice scope and direct URLs are documented in `docs/arcade/practice-lab.md`.
- Shared scene normalization now unwraps Tie-Breaker's combat snapshot and renders Twisted System's incoming jump/duck cues and runner lane. Sound controls stay disabled until their client handlers are ready, avoiding a dropped first tap during hydration.
- Fixed the Arcade room screenshot issue: the lobby now names the selected Arcade title instead of displaying a false “Bowl of Fools” setting, hides unsupported lobby settings, uses the catalog title in player-count guidance, and maps `ARCADE_CONFIG_LOCKED` to a clear 409 rather than a generic 500.
- Local verification on the managed v52 worktree: Node suite 383 passed / 7 skipped / 0 failed; all 20 direct Practice routes passed, and the Arcade lobby regression passed. Typecheck (incremental cache disabled), lint, and the production build passed. Browser assertions found no Practice room or Worker API requests.
- Published public Site version 54 at `https://callback-party-game.dans-host.chatgpt.site` from commit `e0dbd83be8935740bffb68599fc8bcf51467e9aa`. The previous live version 52 remains available in Sites history for rollback.
- Production browser verification opened all 20 direct Practice routes and confirmed each title, canvas arena, Reset, and Exit. Sumo sound toggle, Reset, and Exit were exercised; no browser console errors appeared. No production room was created during verification.
- Version 53's first deploy attempt found the existing `arcade_matches` table. The Arcade migration now uses idempotent table/index creation and a regression applies it twice successfully; version 54 deployed without changing existing room data.
- The full 44-scenario browser suite previously ran with 40 passes and four Worker-backed realtime Arcade scenarios that did not reach LIVE. Those flows remain outside this solo Practice release and still need separate Worker deployment/integration verification.
- This is a solo prototype/physics-testing experience, not a claim of finished console-quality fidelity or networked multiplayer.
## King Prompter Native Arcade — nineteen playable titles, 2026-09-28

- Schaetzorama, Imposter, Buzzwort, and Pantomime run as native King Prompter Arcade titles in existing King Prompter rooms. Schaetzorama includes five server-authoritative estimate rounds; Imposter uses private role assignments, secret clues, phone voting, timed recovery, and a final reveal; Buzzwort gives only the clue giver a private word/taboo card; Pantomime gives the performer a private prompt and supports up to five private guesses per player. All four use authoritative D1 room state and same-room Play Again.
- Imposter uses D1-backed room state and role-filtered snapshots; civilians see the secret word, the imposter sees only the category, and host/spectator views receive no assignment. The upstream game informed the social-deduction loop; its OPL runtime and uncleared word/media data were not copied.
- Buzzwort uses an original King Prompter word deck and host/phone UI; D1 controls the round deadline, taboo checks, guesses, and result. The upstream Taboo-style mechanic informed the design; its runtime, word lists, and assets were not copied.
- Pantomime uses an original 56-prompt deck with D1-controlled guesses, exact normalized matching, timeout recovery, privacy-filtered snapshots, and an explicit host reveal. The upstream performance mechanic informed the design; its runtime, prompt/media data, and assets were not copied.
- Air Hockey, Tap Race, and Light Trails run in the same King Prompter room over ticketed WebSockets to the King Prompter Arcade Worker. D1 remains authoritative for room lifecycle, match identity, score events, pause/results, and replay; the Worker runs fixed-step simulation and broadcasts role-filtered snapshots. Controller seats are fixed per match, removed seats are revoked from live sockets, and position inputs are coalesced to the simulation rate.
- Light Trails is an original native rebuild: up to eight phone riders steer a 64×36 deterministic grid with collision resolution, pause/recovery, distance-based deadline ranking, and same-room replay. The host renders the shared arena and riders; phones receive directional controls and role-appropriate status. Position inputs are coalesced, the compact encoded board is checkpointed at 10 Hz, and the latest steering recovers after Worker eviction. No upstream code, assets, audio, or content was copied.
- Chaos-Kommando adds four cooperative missions with private phone tool choices, distinct-player requirement coverage, server-resolved scoring, timeout recovery, host reveals, and same-room replay. A three-phone browser flow completed all missions and confirmed the final debrief and replay.
- Magic Arena adds a simultaneous-move two-player duel with server-validated Strike, Guard, and Focus actions; hidden moves; timeout defaults; pause/recovery; final health/energy tiebreaks; and same-room replay.
- Kartentisch adds five-trick card play for three to eight phones, with private hands, a visible trump suit, server-validated legal plays, deadline fallback, and same-room replay.
- Flatterfluff adds five deterministic target waves for 2–8 phones. Each player locks a bounded normalized aim; shots stay private until reveal, scoring runs on the server, and missed turns become zero-point timeout shots. Pause/resume, deadline recovery, same-room replay, typed D1 persistence, and role-filtered snapshots are wired. Its two-phone five-wave browser flow passed (1/1); no upstream code or art was reused.
- Minions TD adds six simultaneous-order 1v1 rounds with server-resolved tower upgrades, unit waves, economy, timeout recovery, and same-room replay. It is a native King Prompter implementation; no OPL room/runtime is used.
- Dungeon Party adds three cooperative encounters for 3–8 players with private phone moves, shared health, server-resolved outcomes, timeout fallback, pause/resume, score persistence, and same-room replay. Its focused three-phone browser flow passed through final reveal and replay.
- Word Tiles adds five shared-rack rounds for 2–8 phones, private server-validated words, a first-party embedded lexicon, authoritative letter scoring, timeout passes, hidden-choice snapshots, host reveals, and same-room replay. Persisted choices/results are checked against racks, dictionary entries, and recomputed scoring; the phone clears drafts per round and prevents overusing repeated tiles. Focused unit/room tests and the three-phone five-round browser/replay flow pass.
- Schattenjagd adds four original timed shadow cases for 3–8 players, with one private clue per phone, simultaneous private suspect votes, deadline abstentions, server-calculated case/room scores, pause/recovery, reveal, and same-room replay. Focused unit/room checks and the three-phone four-case browser/replay flow pass; the upstream game had no root license in the inspected snapshot, so no upstream code, art, clues, or rules text was copied.
- Magic Duell adds private spellbook drafting and five simultaneous 1v1 rounds. Players draw server-classified, size-bounded phone glyphs to cast original spells; mana, shields, damage, timeouts, pause/recovery, results, and same-room replay are server-authoritative. The real-pointer two-phone browser flow passes. The upstream repo’s loadout, gesture, mana, and shield loop informed the design, while its spell names, code, assets, and runtime were not copied.
- The app CSP allows only the configured Arcade Worker WebSocket origin in addition to same-origin connections. Worker ticket, control, and callback secrets are documented as required bindings and kept out of source control.
- Air Hockey, Tap Race, and Light Trails passed focused end-to-end browser flows against the local King Prompter app and Worker: host/phone connection, phone inputs, pause/resume, D1 results, and same-room replay.
- Zeichnen & Erraten adds a private prompt, low-traffic phone canvas submission, host drawing reveal, bounded private guesses, deterministic scoring, and same-room replay. Arena Survivor adds scenario choices, hidden answer keys until reveal, server scoring, and timeout recovery. Both are first-party King Prompter implementations; no upstream runtime, media, or game content was copied.
- Arena Survivor's eight scenarios now use explicit answer keys validated by the server and persistence schema. Their emergency guidance is being checked against official sources and documented in `docs/arcade/arena-survivor-content.md`.
- No Open Party Lab room, server, prompt list, or runtime is used. The connection stays in King Prompter’s current room/phone flow.
- All 19 Open Party Lab catalog entries are represented as King Prompter-native games in the existing room flow. The existing King Prompter Sites project is the deployment target; production bindings for the standalone realtime Worker remain pending.
- Final merged verification on 2026-09-28: 357 automated checks (350 passed, 7 skipped), typecheck, lint, and production build pass. The browser matrix passes 39/39 scenarios excluding the three Worker-backed realtime games. Their ticket sync still returns 503 in local integration and production Arcade Worker bindings are not configured; these games remain unverified for live play.

## Individual character-piece editor — 2026-09-03

- Added the Move pieces workspace to the shared editor: direct pointer/touch dragging, screen-axis position controls, 10–400% size, full rotation, separate width/height, flips, visibility, per-piece/all-piece reset, undo/redo, face zoom, keyboard nudging, focus containment, and cancellation that restores the opening draft.
- Every family preset uses the same 29-part registry, with independent screen-left/right eyes, brows, ears, arms, legs/shoes and earrings. Hair, face, nose, mouth, facial hair, glasses, clothing, hats, accessory groups and family signature overlays expose their own transforms.
- Optional validated pieceTransforms extend the existing v2 avatar contract without changing old saved avatars. Shared rendering, local preferences, authenticated lobby updates, room serialization and host snapshots retain the adjustments.
- Regression coverage checks all available pieces in all 13 family presets, every eye style/expression, finite bounded payloads, independent transforms, persistence and rendered editor controls. No database migration or game-rule change.


## Complete host-and-phone testing workbench — 2026-09-02

- Rebuilt `/developer` around a live split-screen workbench that renders the real authenticated host route beside the real phone controller for every shipped game pack, with Both, Host, and Phone inspection modes plus full-size escape links.
- Added authoritative tester controls for start, pause/resume, +15/+60 seconds, phase skip, lobby bots, join locking, Bowl Correct undo, replay, pane refresh, join-link copying, and guarded game ending. Embedded phone views hide the redundant solo control strip while retaining the isolated Developer Studio.
- Added Bowl of Fools to the testing launcher without weakening its four-human/no-bot contract: the first tester seat joins automatically and the workbench explains how to connect three more private windows or devices.
- Kept ordinary pages protected from framing while permitting only explicit same-origin `/host/{code}?tester=1` and `/play/{code}?tester=1` previews. Also corrected two missing accessible Bowl setup labels found during the surrounding polish pass.
- Unit coverage now verifies exact +60-second changes for running and paused timers; browser coverage verifies live host/phone framing, authoritative Developer Studio edits, Bowl entry, and narrow-screen workbench behavior. The complete release gate passes: lint, typecheck, 75 unit/integration checks (70 pass, five intentional skips), all 21 browser scenarios, and the production build.

## Complete castle presentation overhaul — 2026-09-02

- Resolved the interrupted merge while preserving Bowl of Fools, Royal Rumours, Royal War Room, Royal Frame-Up, History Books, Royal Restoration, snapshot privacy, scoring, replay, and timers. Restored the Bowl setup controls and connected its live host/phone render paths.
- Added a pure, stale-safe presentation-event layer and shared `PresentationDirector` driven only by accepted role snapshots. Phase, round, join/reconnect, lock, image, reveal, score, winner/tie, and completion cues now share stable semantic keys with host audio.
- Added the layered CastleRoom system across every shipped pack, Motion-based cancellable stage transitions, broadcast header, player rail, stage instruments, score reveal, canonical coded crown, bounded particles, reduced-motion mapping, and quiet tactile phone-controller treatments.
- Produced responsive AVIF/WebP review families for Prompt Foundry, Scriptorium, Hall of Echoes, Banquet Hall, Evidence Vault, Rumour Press, War Room, and Fool’s Court; produced a transparent canonical pigeon master and reviewed static pose family; replaced the low-resolution intro with a reviewed 1920×1080 cinematic edit.
- Expanded unit and Playwright coverage for event derivation/deduplication/resume, skipped phases, Play Again keys, privacy, tie/score/image events, all-pack room ownership, no-scroll host rendering, reduced motion, quiet phone tasks, media fallback, Bowl integration, and mascot/QR separation. Publication follows the complete release gate recorded in `TESTING.md`.

## Bowl of Fools — 2026-08-30

- Added a complete four-to-ten-human Fishbowl-inspired pack with Team Bells/Team Motley, permanently anonymous scrolls, Speak/Draw-or-Charades/One-Word rounds, authoritative 60/90-second turns, one pass, deterministic reshuffles, intermissions, host undo across transitions, and one-scroll sudden death.
- Added Same Table and Remote Live presentation. Remote Live includes optional no-paid-service peer-to-peer voice and current-performer Charades video with short-lived authenticated signaling, independent device layouts, privacy controls, and a gameplay-independent outside-call fallback.
- Added responsive host/display/phone treatments, a royal-pigeon tutorial, live normalized drawing, Crown of Fools results, relevant room settings, a unique 25%-volume soundtrack assignment, strict persistence/snapshot privacy, D1 signaling schema, and the complete rebuild specification in `BOWL_OF_FOOLS.md`.
- Release verification is green: lint, typecheck, 50 passing unit/engine checks with one intentional local-D1 skip, two production rendered-route checks, all 17 Playwright scenarios (including Same Table and Remote Live Bowl coverage), Drizzle migration generation, and the production build. Production publication is recorded with the deployed version.
## Royal War Room — alternating castle campaign, 2026-08-30

- Added a production `royal-war-room` mode: private six-order rankings become one server-hidden consensus plan, then balanced Lion and Raven councils alternate rotating commanders to reconstruct it over three escalating chapters.
- Added commander-only placements, Earlier/Later feedback, one non-turn-consuming Spyglass per council and match, team-wide banner/point scoring, tied co-champions, bot-safe timeouts, reconnect-safe serialization, and strict snapshot privacy through chapter reveal.
- Added Attack for odd matches and Defend for even matches. Every Play Again increments the match and guarantees the opposite castle role; results and replay buttons announce that reversal.
- Added a dedicated host war board, mobile ranking and commander controls, tutorial, narration/music routing, Grand Hall/setup/archive discovery, curated replayable scenarios, and the authoritative `ROYAL_WAR_ROOM.md` rebuild contract.

## Royal Rumours — AI picture telephone, 2026-08-30

- Added a production `royal-rumours` mode based on the physical picture-telephone loop: simultaneous secret whispers, confirmation-gated AI paintings, deterministic anonymous passing, blind interpretations, a second confirmation-gated AI pass, sequential full-chain reveals, and a contributor-safe final ballot.
- Added host and phone tutorials, dedicated presentation, narration, soundtrack routing, setup/menu/archive entries, bot and solo behavior, scoring and tie preservation, snapshot privacy rules, serialization defaults, and the authoritative `ROYAL_RUMOURS.md` rebuild contract.
- Each official vote pays 500 points to the blind interpreter and 250 to the original rumour writer. Three active players are required; incomplete interpretations and exhausted image models resolve safely instead of blocking the room.

## The Royal Frame-Up — 2026-08-30

- Rebuilt the former visual-mystery pack as a squire-free royal case-file comedy: players submit secret castle incidents, inspect enchanted evidence paintings, forge cover stories, identify the true report, and receive attributed case reveals.
- Added a server-authoritative, one-use Royal Seal per player and match. Its use stays hidden during voting, is revealed with authorship, pays 750 instead of 500 per fooled investigator, rejects repeat use, resets on replay, and survives serialization and reconnects.
- Updated the Grand Hall, setup, host TV, phones, tutorial, narration, scoring explanations, awards, bots, image fallback copy, rules, and implementation Bible to the Royal Frame-Up identity while retaining stable internal IDs for existing rooms.
- Added privacy and scoring regression coverage for sealed submissions, hidden ballots, 750-point rewards, repeat-use rejection, and old-room serialization defaults.

## Public History Books — 2026-08-30

- Added a public `/history-books` castle archive with game-type filters, full-text search, dated match cards, winner and player rosters, avatar/score records, generated-image galleries, and expandable round ledgers containing prompts and visible player answers.
- Finished matches are archived idempotently in dedicated D1 tables. Confirmed generated images are copied to permanent History Books R2 keys before normal live-room expiry removes temporary room data.
- The public archive excludes session tokens, credential hashes, hidden/removed answers, moderation internals, and raw authoritative room state. The Grand Hall now links directly to History Books.

## Authoritative documentation and release verification — 2026-08-30

- Removed stale current-rule descriptions of prompt ranking, ranked canvas ballots, the two-image Crown Gallery, and 1,200-point finale from the round guide, King Prompter guide, product Bible, screen-family map, visual-system map, and testing record.
- Those references now match the shipped two overlapping canvases plus Royal Restoration lifecycle, exact 100/150/300 per-vote scoring, prompt-beside-image presentation, single-favorite self-vote-safe ballots, deterministic torn slots, and explicit tied winners.
- Verified 55 unit/integration checks with 50 passing and five intentional skips, followed by clean lint, TypeScript validation, and production build. Real multi-device/browser playtesting remains the next release gate.

## Royal Frame-Up foundation — 2026-08-30

- Added the production `king-mystery` compatibility pack: simultaneous secret reports, confirmation-gated parallel image generation, sequential evidence investigations, believable player-written cover stories, one-choice truth ballots, and eight-second attributed reveals.
- Added server-enforced three-player minimum, 18-word limits, creator sit-outs, duplicate-forgery rejection, no-self-forgery voting, early locks, deterministic reconnect order, missing-response timeout behavior, and idempotent 500/500/250 scoring.
- Added role-filtered snapshots that keep true reports and author mappings private until each reveal, including neutral image metadata that cannot leak the secret incident.
- Added dedicated 16:9 TV evidence-board presentation, phone write/vote/sit-out/reveal states, tutorial, narration, music assignment, final awards, solo bots, live-image solo support, home-menu discovery, and exact implementation documentation.
- Added a full three-player lifecycle/privacy/scoring/serialization regression plus action, timing, soundtrack, lint, and TypeScript coverage.

## Confirmed image generation and model fallback — 2026-08-29

- Image entries now require recognized JPEG, PNG, or WebP bytes plus a confirmed R2 object before becoming revealable.
- Failed jobs retry automatically across three distinct models. Quality falls back to Fast and then Schnell; every other starting choice also receives two distinct fallback models.
- The room sees which model failed and that another is being tried. The server holds the Royal Workshop intermission until every entry is confirmed or all three models have failed, then uses a concept card only for the exhausted entry.
- Added model-order, official endpoint-ID, and image-byte validation coverage. Client job leasing now prevents duplicate in-flight requests while retaining multiplayer parallel generation.

## Royal Restoration lifecycle — 2026-08-29

- Replaced King Prompter's prompt-ranking and Crown Gallery revote with the approved two-canvas plus Royal Restoration lifecycle.
- Added a 120-request all-ages royal commission deck and an optional three-choice poll for early Canvas One finishers. Poll ties use first-to-reach and no-vote rooms use deterministic selection.
- Canvas One generation overlaps Canvas Two writing; Canvas Two generation overlaps Canvas One voting. Every ballot is one favourite with exact 100/150/300 points per received vote and server-enforced no-self-voting.
- Added three rotating base portraits and deterministic reusable torn-piece layouts for every player count from 3 through 10. Ordinary square model output is cropped beneath each slot's irregular mask and layered around the unchanged King.
- Added the 40-second skippable tutorial, Royal Squire fiction, prompt-beside-image presentation, complete-collage results, tied winner preservation, restoration reconnect state, provider-independent generation contract, and focused full-lifecycle coverage.
- Unit/game tests, lint, TypeScript validation, and the production build pass. Real 4–6-player pacing and laughter validation remains the final product test.

## Medieval menu playlist and game themes — 2026-08-28

- Added five normalized, compressed medieval tracks. The Grand Hall now fades from the menu loop audio into a 25%-volume playlist, crossfades between songs, and wraps back to the first track.
- Assigned a unique initial theme to King Prompter, Let's Make a Comic, Legacy Standard, and Birthday. The editable mapping is centralized in `lib/game/soundtrack.ts`; host and secondary-display playback loops the selected game's theme after the normal audio-unlock click.
- Preserved device-local mute/channel controls, narration ducking, effects, autoplay-safe degradation, and the procedural soundtrack as a fallback when a game-theme asset cannot play.
- Verification is green: five complete audio decodes, lint, typecheck, 42 passing unit tests with one intentional local-D1 skip, two rendered-HTML checks, three focused Grand Hall browser scenarios, and the production build.

## Grand Hall loop Checkpoint C — awaiting approval, 2026-08-27

- Candidate A is now recorded as the production-approved Checkpoint B poster.
- Created two deterministic 16-second ambient-motion comparisons from the exact approved poster. Selected the quieter Stage Breath treatment; Curtain Drift remains the alternate. Runway was available only as an uninstalled plugin and was not callable, so no remote image-to-video generation was used.
- Finished `public/media/grand-hall/grand-hall-menu-loop.mp4` through AI Video Studio and FFmpeg at 1920×1080, 24fps, H.264/AAC, `yuv420p`, fast start, and 1.531MB. Complete decode, visual seam, audio seam, poster match, and approved centered cover crops are recorded in `assets/source/grand-hall-loop/qa-report.json`.
- Integrated the loop beneath the unchanged semantic HTML menu. The poster remains below the video; loop failure preserves navigation; effective reduced motion pauses both videos and uses the approved static poster.
- No intro, pigeon, canonical crown, gameplay, engine, database, scoring, phase, or menu-information-architecture changes were made.
- Verification is green: JSON validation, lint, typecheck, 41 unit tests with one intentional local-D1 skip, two rendered-HTML tests, three focused Playwright menu/media/viewport tests, and the production build. The local Sites server reported its expected unavailable `Request.cf` development placeholder but did not limit the browser checks.

## Grand Hall poster Checkpoint B — approved, 2026-08-27

- Generated two textless painterly Grand Hall concepts with the built-in ImageGen workflow and selected Candidate A because it provides the clearest theatrical-stage read and quietest central UI field. Candidate A is production-approved; Candidate B remains available as an architectural alternate.
- Prepared a documented 2560×1440 review master from the native 1672×941 generation plus AVIF/WebP delivery files at 2560×1440, 1920×1080, 1280×720, 780×1688 phone-tall, and 750×900 phone-short. All ten delivery files decode at their declared dimensions and remain well below the 900KB 1080p target.
- Integrated the poster below the unchanged semantic HTML menu with dedicated phone crops, a readability scrim, load-state reconciliation, and the existing coded Grand Hall as a deterministic failure fallback. No video, audio, pigeon, crown, gameplay, engine, database, or menu information architecture changed.
- Verification passes: lint, typecheck, two rendered-HTML checks, three focused Grand Hall/viewport Playwright scenarios, manual in-app desktop/phone inspection, media decode validation, and the production build. Five integrated review captures are saved for approval.

## Grand Hall main-menu Checkpoint A — awaiting approval, 2026-08-27

- Replaced the video-aligned invisible hotspots and duplicate clipped landing content with one visible semantic Grand Hall menu in the approved eight-action DOM and keyboard order.
- Added explicit gate → intro → menu orchestration, separate intro/loop failure handling, the 3.5-second Skip Intro control, the 1.2-second handoff, direct `/?menu=1` return, and media-independent navigation. The existing text-filled loop is retained as a reference file but is no longer displayed behind controls.
- Added device-local menu sound, volume, motion, and Replay Intro settings. Reduced motion retains the press-to-start gate, skips both videos, reveals the coded menu immediately, and does not change gameplay timing.
- Added the approved menu token bridge, responsive coded Grand Hall fallback, semantic Join Host Display validation, visible focus treatment, and 1366×768, 1920×1080, 2560×1440, 390×844, and 375×450 review captures.
- Verification passes: lint, typecheck, 42 discovered unit checks (41 pass, one opt-in D1 check skipped), two rendered-HTML checks, three focused Grand Hall/viewport Playwright scenarios, and the production build. No gameplay, engine, database, generated asset, or existing media file was changed.

## Approved visual-system documentation — 2026-08-27

- Added the approved production rules in `VISUAL_SYSTEM.md`, the actual phase/role mapping in `SCREEN_FAMILIES.md`, and the structured planned-asset inventory in `ASSET_MANIFEST.json`.
- Confirmed King Prompter as the public umbrella identity while retaining CALLBACK for internal architecture and the Legacy Standard mechanic.
- Corrected current descriptive guides to match the engine: 2–10 active seats, six feedback cards/150 points, exactly two Crown Gallery representatives, a single-favorite final vote, and no Legacy Quick, Legacy Extended, or Question Cards mode.
- Documentation-only verification reports 42 discovered tests: 41 pass and the opt-in local D1 vertical slice is skipped without a configured base URL. Runtime code, gameplay, art, and media were not changed.
- Older entries below are dated milestone records. Counts and behavior in a later entry supersede earlier descriptions rather than rewriting those historical notes.

## Two-player rooms, lobby bots, mirrored audio, and shorter Comic tasks — 2026-08-26

- Normal rooms now start with two active seats. Hosts can add deterministic bot players directly in the lobby; those bots use the same authoritative answer, vote, prediction, scoring, and persistence paths as human seats.
- Secondary host displays now run the host audio system and expose a clear one-click sound control to satisfy per-device browser autoplay rules.
- Let’s Make a Comic uses short noun-first phone headlines: create the star, give them a problem, and show the punchline. The premise and visible winning panels carry the context without repeating a paragraph-sized heading.

## Secondary-display Comic image fix — 2026-08-26

- Fixed generated Comic and King Prompter images appearing missing on a joined desktop/TV display. The authenticated read-only `display` role may now fetch room-owned generated media.
- The display role remains unable to run image jobs, submit actions, change phases, or access another room's media.
- Added regression coverage for the media-viewer role boundary.

## Home-menu host display join — 2026-08-26

- Added a visible **Join host display** panel directly to the animated home menu, with a four-character room-code field for another desktop or TV.
- A valid code opens the existing read-only secondary display, mirroring the authoritative main host without exposing host controls or player actions.
- Added an accessible fallback-menu entry and compact responsive styling for smaller desktop windows.

## Free house narrator — 2026-08-26

- Made the default narrator a distinctive, slightly slower/lower “house” delivery that prioritizes Microsoft Natural and strong English voices when the host browser provides them, with automatic fallback for other devices.
- Kept narration entirely free and local to the host browser: no account, paid service, API key, or player-phone playback.
- Preserved manual voice selection for hosts who prefer a different installed voice.
- Lint, typecheck, unit tests, and the production build pass.

## Persistent menu return and secondary host displays — 2026-08-26

- Returning home from a game now opens the animated menu state directly instead of replaying the intro.
- The intro now offers a small, faint **Skip intro** button after 3.5 seconds.
- Added a read-only `/display` flow: another TV can enter the room code, receive a display session, and mirror the authoritative host screen without host controls or player-phone actions.
- Added short-lived D1 display heartbeats so the main host can show how many secondary TVs are currently live; secondary screens show a tiny LIVE/RECONNECTING status and request screen wake lock when the browser supports it.
- Added the `display_sessions` schema/migration with expiry-aware cleanup and no gameplay state mutation.
- Lint, typecheck, unit tests, and the production build pass.

## Structured Legacy finale and mode steering — 2026-08-26

- Reframed Legacy Standard as a deterministic story-building arc. Winning creative answers now fill four explicit slots—Hero, Motto, Rule, and Disaster—and the finale asks for one short headline using the four visible story cards instead of concatenating unrelated prose.
- Made the Callback round use the Hero, Motto, and Rule in a fixed causal setup, while the winning Callback answer becomes the Disaster that completes the finale recipe.
- Split rewarded waiting votes by game mode. Standard votes steer setting, stakes, and finale tone; King Prompter votes steer canvas premise and visual direction; Comic votes steer escalation and punchline shape; Birthday votes steer spotlight and finale direction.
- Steering remains server-authoritative and deterministic. Votes affect only later prompts/instructions for the same mode, remain idempotently persisted, and never alter scoring, winners, phases, or hidden authorship.
- Typecheck, lint, 37 active unit/game checks, the complete deterministic seven-round solo Standard flow, and the production build pass.

## Cloudflare comedy writer — 2026-08-26

- Added Cloudflare Llama 3.1 8B Instruct Fast as the active text provider when Cloudflare credentials are configured and no OpenAI key is present. It runs asynchronously inside the existing leased lore jobs, so it improves Callback and Remix writing without delaying phase transitions.
- The writer receives only winning/tied-winning room lore, its graph relationships, original context, and a short ranked summary of durable plus current-room comedy preferences. It favors specific characters, status reversals, mundane crises treated as epic, social embarrassment, and open punchline targets.
- Responses use Cloudflare JSON mode, strict Zod validation, established-memory checks, and the existing quality gates. A 1,100-token output ceiling limits usage. Quota errors, timeouts, malformed JSON, or model unavailability automatically fall back to the deterministic writer and cannot block a game.
- Scoring, winners, votes, eligibility, timers, and transitions remain server-authoritative. Solo games continue using deterministic local bots and do not queue text-model jobs.

## Adaptive replay and comedy system — 2026-08-26

- Added a persistent match number and retained bounded prompt history, so **Play Again** rotates Standard, Birthday, King Prompter, Comic, Catch, and solo-bot seeds instead of recreating the same match. Comic themes now rotate without repeats across the full 32-theme library; Birthday creative prompts and normal prompt decks suppress already-seen entries.
- Expanded feedback from six fixed comparisons to 18 funny theme, visual-style, and prompt-deck cards. Each player receives a deterministic six-card window per match, and the next two replays use entirely fresh windows while preserving the 150-point per-game ceiling.
- Durable D1 tallies and every current-room vote now weight future Canvas launchpads, theme direction, and art direction. Feedback is no longer merely collected: a winning prompt candidate can enter a later game, and previously used launchpads are suppressed.
- Reworked King Prompter guidance around a practical comedy scaffold—specific character, readable place, status reversal or escalating problem, and an open visual punchline. Added 24 curated image launchpads and compositional solo-bot scenes with duplicate avoidance.
- Kept live text generation out of the authoritative prompt path. The game remains instant and finishable without quota or AI availability; the existing optional AI sidecars remain appropriate for lore analysis and illustration, while future model-generated prompt candidates should be validated and curated before entering the deterministic deck.
- Lint, typecheck, 35 active unit/game checks, two production-Worker rendering checks, and the production build pass. The browser suite could not launch because this workspace does not contain Playwright's Chromium executable; no browser assertion ran or failed against this feature. The server-dependent local D1 integration remains separately gated.

## Host audio director — 2026-08-26

- Replaced the five isolated host beeps with a persistent TV-only audio director. Layered procedural music changes tempo, harmony, density, and mood across lobby, writing, image-generation/matching, voting, reveal, and finale phases.
- Added mixed join, submission-lock, phase-transition, rewind, countdown, image-ready, and winner cues. A dynamics compressor protects the final output, and narration automatically ducks the music.
- Added phase-aware spoken hosting for round introductions, prompts, phone directions, prompt-author matching, voting, reveals, ten-second warnings, pauses, and final winners. The host chooses from installed English voices; narrated text also appears as an on-TV caption.
- Added persistent host controls for master, music, effects, narrator, per-channel levels, voice selection, mute, and voice testing. Audio is initialized only by a host click to satisfy browser autoplay rules and never runs on player phones.
- The soundtrack and effects are synthesized locally with Web Audio, and narration uses the browser's installed speech service. The system needs no paid API, external asset license, download, account, or game-state mutation and continues silently when an audio capability is unavailable.
- Lint, typecheck, 33 active unit/game checks, two production-Worker rendering checks, and the production build pass. The browser suite could not launch in this workspace because its Chromium executable is not installed; no browser assertion ran or failed against the feature.

## Retired game packs — 2026-08-26

- Removed Question Cards, Legacy Quick, and Legacy Extended from the authoritative game contract, round plans, selectors, prompt content, solo bots, snapshots, and release matrix.
- Room creation now rejects all three retired identifiers at the schema boundary. The remaining public packs are King Prompter, Let's Make a Comic, and Legacy Standard; the separate Big 30 route remains available.

Updated: 2026-08-25

## Architecture hardening — 2026-08-25

- Added monotonic client snapshot acceptance so an older overlapping sync response can never replace a newer host or phone state.
- Added versioned, Zod-validated room serialization at the D1 boundary with migration support for existing unversioned room snapshots.
- Versioned avatar configurations as schema v2 while preserving and migrating existing family presets and device preferences.
- Extracted deterministic weighted `PromptDeck` selection with recent-prompt suppression, so the existing prompt weights now affect gameplay.
- Extracted CALLBACK-specific `CallbackPool` selection with explicit eligibility, quality ranking, source-round and usage metadata.
- Added focused regression coverage. Typecheck, lint, and 32 active unit/game checks pass; the server-dependent local D1 integration remains separately gated.

## CALLBACK avatar creator — 2026-08-25

- Integrated the original CALLBACK Avatar Studio into the live join and lobby flows, with all 13 family look-alike presets plus a full face, hair, features, style, and extras editor.
- Moved character selection and creation onto the opening screen, with a device-saved choice that carries automatically into the room join flow while remaining editable in the lobby.
- Photo-refined all 13 family presets around a small set of recognizable cues, including distinctive hair, face proportions, glasses, facial hair, hats, outfits, straps, freckles, florals, tattoos, outdoor gear, and jewelry while preserving the shared simplified CALLBACK silhouette.
- Avatar choices now travel through the server-authoritative room state, reconnect correctly, and render consistently on player phones and every host scoreboard, reveal, roster, and podium surface.
- Added vibrant, mobile-first CALLBACK styling, live previews, randomization, legacy-player fallbacks, strict payload validation, and focused regression tests. Lint, typecheck, 26 active game/unit checks, and the production build pass.

## King Prompter complete-gallery showdown — 2026-08-24

- Every generated canvas image now appears on the TV and every phone during image voting. A player's own image remains fully visible with a clear **YOU** label, but its vote control is disabled and the server continues to reject forged self-votes.
- Each canvas now contributes exactly one winning image to the Crown Gallery. Tied leaders remain recorded, while stable deterministic selection fills that canvas's one final slot without using submission speed.
- The final round is a true two-image showdown: both canvas winners remain visible and each eligible player chooses one favorite for the 1,200-point crown vote.
- Updated public copy, host/phone presentation, deterministic bots, and multiplayer/solo regression coverage. This revision is release-verified and included in the current public version.

## Let's Make a Comic — public release, 2026-08-24

- Added a standalone three-frame comic pack: Setup, Escalation, and Punchline. A curated random theme guides the opening, winning frames remain visible as connected context, and the final joke is left entirely to the players.
- Every under-20-word panel prompt becomes a square generated image or voteable concept card. The mode goes directly from writing to image voting; the winning image locks into the strip before the next frame begins.
- Ranked points rise from 300/200/100 to 500/300/150 and then 1,000/600/300 for the punchline. Top ties are retained, with stable deterministic selection filling the single physical panel space.
- Multiplayer and opt-in live-image solo play reuse the authenticated Cloudflare/R2 job pipeline. Quota-free solo remains the default, bots create all three panels, and test ballots favor the human panel so a one-phone player can verify their winning comic.
- Added connected host/phone comic presentation, final-strip results, curated themes and bot panels, replay hydration, architecture notes, unit coverage, and multiplayer/solo browser scenarios. Lint, typecheck, 24 active unit/game checks, production build, two SSR checks, and all 16 browser scenarios pass; the 1366×768 final strip is readable without scrolling. This revision is included in the current public version.

## King Prompter authoritative game loop — 2026-08-24

- Replaced the public CALLBACK identity with **King Prompter** and made the image-prompt pack the default game.
- The new match has two 120-second prompt canvases followed by the Crown Gallery. Prompts must stay under 20 words; prompt ballots rank up to three places, every prompt queues its own image in the background, image ballots are worth 2×, and the final ballot is worth 4× the prompt round.
- Ballots are anonymous and server-authoritative, self-voting is blocked, three-player rooms automatically rank the two eligible entries, and every tied image winner advances.
- Multiplayer image work uses the configured Cloudflare provider and authenticated R2 media. Provider moderation is not called for King Prompter prompts; basic request validation and the provider's unavoidable safety behavior remain. Solo rooms remain quota-free by default, with an explicit **Generate live solo images** switch that queues the human and every bot canvas through the same hosted Cloudflare pipeline.
- In King Prompter solo tests, deterministic bot ballots rank the human entry first during prompt, image, and Crown Gallery voting. This makes the human image advance reliably without moving scoring or winner authority out of the server.
- Replaced the post-submit fidget counter with 12 server-authoritative pairwise feedback choices. Each completed comparison awards 25 points, the server enforces a 10-second cooldown and one vote per pair, and the complete deck is capped at 300 bonus points per player.
- Feedback choices are written to D1 as idempotent records that survive room cleanup. Community totals seed future rooms, while current-room preferences can influence Canvas Two and later Question Card prompts.
- Generation failures and the 90-second gallery deadline fall back to voteable concept cards, so a provider outage cannot block the game.
- Release verification passes: lint, typecheck, 23 active unit/game checks, the production build, and all 14 browser scenarios, including a complete opt-in live-image solo King Prompter match through the real job endpoint.

## Prompt & Circumstance community-pick flow — 2026-08-23

- Added `prompt-vote-canva-flow.html` and its rendered preview as the verified source for a two-page editable Canva whiteboard proposing a revised image-game loop: all players submit short visual prompts, the room votes anonymously, the winner locks before generation, and the final image or concept-card fallback is revealed.
- The proposal preserves hidden authorship, server-side eligibility and vote validation, no self-voting, deterministic tie resolution, uniquely keyed score events, authenticated media, solo no-paid-work behavior, and a finishable failure path. It is a design proposal only; the existing decoy-and-guessing implementation has not been changed.

## Editable Standard flow map — 2026-08-23

- Added `CALLBACK_FLOW.md`, an editable Mermaid board that maps the full Standard match from room setup through The Seed, Read the Room, Make It Real, The Catch, Crowd Control, Callback, The Remix, Tonight's Lore, replay, and encore.
- The diagram mirrors the reference concept-board grammar while preserving CALLBACK's real server-authoritative phases, winner-only Room Lore mutations, graph edges, asynchronous AI/image sidecars, deterministic fallbacks, and authority boundaries.
- Added `callback-canva-flow.html` and its rendered previews as the verified source for a two-page editable Canva whiteboard: a readable experience overview plus the full authoritative phase map. The Canva version preserves the real labels instead of relying on generated placeholder copy.

## Browser developer mode — 2026-08-22

- Added `/developer`, a dedicated one-phone workshop that launches isolated solo rooms with two to five deterministic bots and remains quota-free unless the tester explicitly enables live King Prompter images.
- The in-game Developer Studio can change the authoritative live prompt, display instruction, birthday choice labels, creative score cap, and current phase time without moving authority into React state or affecting another room.
- Every applied edit and free-form playtest observation is saved only on the developer's device with round, phase, prompt ID, before/after values, and source hints. **Copy for Chat** produces a versioned JSON change package that can be pasted into Codex for reviewed permanent source edits.
- Normal rooms reject developer mutations. Developer context is disclosed only to the authenticated human seat in a developer solo room; bot and ordinary player snapshots receive none.
- Release verification passes: lint, typecheck, 20 active unit/game checks, two production-Worker rendering checks, production build, and all 13 browser scenarios including the complete live-edit developer workflow.

## Brandon's Big 30 personalization — 2026-08-22

- Personalized the birthday landing and setup for Brandon, replaced the stylized “3–0” wording with “30,” and prefilled Brandon as the birthday legend so his name flows into the full birthday pack by default.
- Release verification passes: lint, typecheck, 18 active unit/game checks, two production-Worker rendering checks, production build, and all 11 browser scenarios, including the Brandon setup default at desktop and phone widths.

## Prompt & Circumstance — 2026-08-22

- Added a complete three-round image bluffing game for 3–10 players. Each player writes a scene in 12 words or fewer using a beginner-friendly Someone → Action → Place recipe; the server secretly features one scene and turns every other submission into a decoy.
- Correct prompt guesses, fooled-player bonuses, and director rewards are deterministic, server-authoritative, and uniquely keyed. Featured prompts and authorship stay hidden until reveal.
- Added a Cloudflare Workers AI FLUX.1 Schnell image provider that can run independently of OpenAI. Restricted credentials stay in hosted secrets; generation uses the existing leased job, local safety, R2, authenticated media, retry, and concept-card fallback pipeline.
- Added dedicated host/phone presentation, image-wait behavior, replay support, bot scenes, and release coverage.
- Lint, typecheck, 18 unit/game checks, two production rendering checks, production build, and all 11 browser scenarios pass.

## One-phone solo playtest — 2026-08-22

- Added a customizable solo option to both `/host/new` and `/birthday/new`: one human plus two to five free deterministic local bots.
- A solo room keeps distinct HTTP-only host and player sessions on the same phone, locks new joins, and makes the human the birthday VIP automatically when using the 30th-birthday pack.
- The phone now contains the complete experience: game/content/timer settings, Start, Pause/Resume, +15 seconds, Skip Phase, every answer/author/applause reveal, complete final standings, awards/lore, and Play Again.
- Bots submit answers, Catch-compliant responses, votes, choices, 100% predictions, author guesses, and wagers through the same server-authoritative round state and D1 effects as normal play.
- Solo mode never queues OpenAI, moderation, generated-image, or R2 jobs by default. Deterministic concept cards preserve the pacing and make the default mode permanently free to operate; the later King Prompter live-image switch is an explicit Cloudflare/R2 test exception.
- Release verification passes: lint, typecheck, 17 unit/game checks, two production-Worker rendering checks, production build, and all ten browser scenarios. New browser coverage includes visible one-phone setup/control/reveal and a complete seven-round birthday match with one human session and two bots.

## The Big 30 party pack — 2026-08-22

- Added a customizable `/birthday` party pack with six Jackbox-inspired mini-games across seven rounds: Birthday Bets, The Biopic, Who Wrote It?, Thirty Words or Less, Most Likely To, and Future Message.
- The host supplies a first name and designates the birthday player in the lobby. His Birthday Bets choices remain server-side until reveal; predictions and points use uniquely keyed score events.
- Reworked the birthday content after reviewing highly engaged Reddit question patterns: 28 balanced Birthday Bets scenarios and 48 original creative/social/finale prompts now favor concrete mental pictures, personality-revealing trade-offs, petty debates, group stories, and clear punchline targets over generic wish-list questions.
- The pack needs no OpenAI key or generated images. Existing CALLBACK modes and the current deployment remain intact.
- Lint, typecheck, 15 unit/game checks, two production-Worker rendering checks, production build, and all eight browser scenarios pass, including a complete six-player birthday match and no-scroll host results at 1366×768.

## Architecture review — 2026-08-21

- `ARCHITECTURE_DECISION.md` recommends private GitHub as canonical source with ChatGPT Sites retained as production hosting for now; no production runtime or data migration was performed.
- The review identifies polling/D1 contention and request-bound AI jobs as real constraints, but not current release blockers. One Durable Object per room remains the preferred measured-growth path.
- `AGENTS.md`, `GAME_DESIGN.md`, `ARCHITECTURE.md`, `ROUND_SYSTEM.md`, and `AI_PIPELINE.md` now document safe edit surfaces and authority boundaries for future AI-assisted maintenance.
- The standard ChatGPT GitHub app is documented as read-only; direct repository edits/pushes still require Codex or a separately configured write-capable integration.

## Structured-memory revision complete locally

- The authoritative Standard arc is now The Seed → Read the Room → Make It Real → The Catch → Crowd Control → Callback → The Remix → Tonight's Lore.
- Only creative winners and tied winners enter Room Lore. Typed Anchor, Voice, World, and Consequence nodes preserve their original context and are connected with persisted semantic edges.
- The Seed starts Anchor-image work; Read the Room hides the latency; Make It Real reveals the winning invention before creating its Voice.
- Strict AI schemas and server quality gates accept only safe, coherent, answerable, surprising, semantically connected callback/Remix candidates. Deterministic causal fallbacks keep every game finishable.
- The finale uses a fixed Remix contract and one 2–4-element commemorative image. Important text remains in HTML/CSS.
- Locked phones now offer rewarded pairwise feedback that improves later prompts. The host has callback rewind, winning-memory clues, and a no-scroll Tonight's Lore graph gallery.
- Audience mode and new mid-game seats are explicitly deferred beyond v1. Existing players can still refresh and reconnect.

## Verification

- Lint, typecheck, 13 unit checks, 2 production-Worker rendering checks, local D1 integration, and the production build pass.
- The browser matrix covers responsive entry/join, three-phone UI restoration, Standard/3+replay, Standard/6, Standard/10, and Monster Factory/6.
- In-app visual inspection reports clean logs. The 1366×768 Tonight's Lore capture fits without gameplay scrolling.
- The callback quality corpus includes explicit accept/reject examples and quantitative runtime thresholds.

## Deployment state

- Sites project `CALLBACK` exists with D1, R2, production environment configuration, and public access at `https://callback-party-game.dans-host.chatgpt.site`.
- The previous public version remains available as rollback. The verified King Prompter gallery update and Let's Make a Comic mode are included in the current public version.

## External blocker

No `OPENAI_API_KEY` has been supplied, but King Prompter image generation uses the separately configured Cloudflare provider. All modes remain finishable with deterministic fallbacks. The new live-image solo path is verified through the real job endpoint with fallback output; a post-publish provider-backed smoke test is still required before describing successful Cloudflare image bytes as production-tested.
# Bowl of Fools

Bowl of Fools is implemented as a complete phone-first multiplayer mode: the room creator is both host and full player, no desktop or TV is required, join-code sharing and a live roster are on the host phone, teams are randomly balanced then editable, all players ready up before play, and a 200-cue hint bank supports three anonymous scrolls per player. The full repeated-pool flow includes randomized clue-giver order, drawing or charades, one pass per turn, synchronized phone scoreboards and round reminders, behind-team starts, host undo and score correction, one-scroll sudden death, Same Table and Remote Live presentation, and optional zero-service-fee WebRTC media with outside-call fallback. See `BOWL_OF_FOOLS.md` for the authoritative rules and implementation contract.
# Shared lobby and party-game connections — 2026-10-30

- The parent lobby has a signed, role-bound persistent WebSocket that remains open through game switches. Authoritative HTTP snapshots still issue child cookies on notifications and occasional presence checks; connection loss restores polling. Household ticket renewal has per-actor limits rather than sharing a restrictive bucket across all phones on one Wi-Fi.
- All six active party packs and Sketch & Sorcery now use the existing native WebSocket transport. Royal Rumours/image jobs continue dispatching from pushed snapshots and heartbeats. Server/D1 remain authoritative for identity, private projections, phases and scores; no game rules or paid hosting plans changed.
- Native batches load and advance one room once, project each authenticated actor separately, isolate expired tickets/private-projection failures, serialize actions and push committed changes promptly. Bounded relay calls, liveness heartbeats and reconnect watchdogs recover stalled connections.
- Local checks: 1020 unit tests passed, nine existing skips; typecheck, lint, production build and nine render checks passed. Production-preview browser checks passed native Buzzwort play/replay/reconnect and all six party packs with host, four phones and mirror, one parent socket throughout, stable membership and no steady gameplay HTTP polling. Final local all-view start observations were 249–530ms including UI/test overhead; these are not real-device latency measurements.
- Independent review fixes include notification delivery lifetime, role/cookie boundaries, single-flight connection creation, callback stability, image-job dispatch and per-player failure isolation. Concurrent Site v91 was merged and its image allowance guard and migration 0012 preserved. Final review also separated mirror renewal buckets by authenticated identity. The local Wrangler proxy crashed during a Sumo check; the same Sumo movement/pause/reload/cross-game test passed on a fresh ephemeral Miniflare runtime without application changes. Physical phones/Wi-Fi remain unverified; D1 action persistence and image-provider time still limit end-to-end responsiveness.

