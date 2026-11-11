# Upgrade progress — 2026-10-12

Baseline: Site version 60, source b47f9085b404b72ef202adedf8513096b9d438c3. Nineteen room-game placeholders and twenty solo prototypes. Existing room/D1 and social-game workflows remain authoritative.

The first six full packages reuse the user's complete CALLBACK-ARCADE sources pinned at 2a275812045d210d66210f710bae025b42635fc2. Original files, per-file hashes and Three.js MIT notices are included. New presentation and adapters are isolated from room state.

| Entry | Full-game upgrade | Functional evidence |
|---|---|---|
| Sumo | Crownfall v1.3.0, six hazard arenas, Crown Cup, native customization and one/two local controls | 144 supplied deterministic checks; registry/source/SSR integration checks |
| Space Bash | Live ten-bot attract mode; Orbital, Low-G, Ion Ice and Meteor arenas; count, skill, time, crowns, seed, name and sound | Four new adapter/physics checks plus 40 upstream checks |
| Twisted System | Ten bots; Spiral, Frost, Clockwork and Foundry timing mechanics; lives, match length, speed, skill, graphics and feedback | Actual simulation checks for bot control and distinct obstacle/physics rules |
| Roller Ruckus | Three real 3D courses, including low-grip Glacier; ten finishing bots; one to seven laps, speed, skill, graphics and feedback | All ten bots finish all three courses; strict native-select regression for every lap option |
| Scratch Match | Ten bots; longer memory, faster tempo and chord stages; phrases, tempo, bot accuracy, seed, name and sound | Three actual phase/sequence/pause tests |
| Sky Balls | Full Royal Ballistix with ten gates; reef-bumper collisions and curved Whirlpool trajectories; custom match target, paddle size, speed and skill | Three actual simulation/result-button checks, including crown targets 1, 2, 4 and 7 |

The front catalog promotes these six full games and accurately identifies the remaining fourteen physical prototypes and nineteen room games. No 9/10 certification is claimed.

Whole-branch review found and fixed three issues: unsupported Roller lap-select values, hardcoded Ballistix match targets, and unrecoverable tab pauses. Regression checks failed before the fixes and pass afterward. Title/watch demos recover on tab return; player matches offer an explicit Resume dialog; customization retains pause.

Release evidence: 453 Site tests passed, seven existing skips, zero failures (460 total). TypeScript and ESLint passed. The production build and publication are recorded by Sites release metadata.

Remaining sequence: Snow Bash, Drain Bash, Jungle Bash, Tie-Breaker, Manic Panic, Rubble Alliance, Dragon Drop, Volt Vault, Mystery Beat, Tailblazer, Jungle Fox, Metal Fox, Paint Panic, Rhythm, then the nineteen native room titles. Reuse research and pinned license constraints are in REUSABLE_SOURCES.md; proposed donors have not yet been imported.

Verification limit: managed Sites has no required control-browser skill. Sites explicitly instructs skipping browser automation rather than improvising another browser-control path. Desktop/phone visual QA and physical-phone performance remain unverified. Online Sumo relay deployment is still pending; local bot matches are available and do not require a room.

## Snow Bash — source upgrade checked, next release pending

Polar Panic reuses the complete existing Jungle/Snow combat rules and destructible-floor module. Three arenas add penguin baiting, periodic crosswinds, and a genuinely eroding tile topology. Ten bots use ordinary movement, pickup, throw, jump and attack inputs. A shared local presentation adds a fixed-step Crown Cup, thirteen real settings, 3D characters, score/name labels, optional sound/haptics, pause/input cleanup, and touch controls; unsupported WebGL falls back to Canvas. Original engine sources and MIT Three.js provenance are preserved.

Focused evidence: twelve gameplay, lifecycle, package and SSR checks passed; typecheck and focused lint passed. Those checks establish functional behavior, not rendered quality or phone performance. Six earlier games were published as Site version 61, source c6f1d3c2cf01a71a6ebeef165712b685e1e5fb2d. The local workspace unexpectedly refreshed after publication; the exact pushed source was restored through the normal Sites workflow. Direct HTTP verification returned 403 at the executor's access boundary; native deployment succeeded.

## Drain Bash — source upgrade checked, next release pending

Sump Siege preserves the existing mystery-weapon simulation. Sump Junction teaches weapon selection, Floodgate Spiral applies real circulating currents, and Echo Vault reflects special projectiles from the rim. Ten bots collect pickups and spend Homing, Burst and Sonic charges through ordinary inputs. Mystery crates may legitimately grant healing; the weapon regression supplies each normal inventory to verify spending rather than assuming every random pickup is a weapon. Fifteen focused simulation/lifecycle/package/SSR checks passed; typecheck and focused lint passed. Browser/phone quality remains unverified.

## Jungle Bash — source upgrade checked, next release pending

Verdant Clash retains crate combat, Nitro contact blasts, fruit healing and ordinary bot inputs. Vine Canopy adds solid pillars and projectile deflection; Sunken Ruins uses destructible floor tiles and explicitly enables jumping across gaps. The gap rule is opt-in in the shared combat state; existing default practice behavior still passes its regressions. Thirteen focused combat, specialized-practice, new-map and package checks passed, including a failed-before-fix gap-jump regression. Typecheck and focused lint passed. Archived original engine files are taken from the exact version-61 base commit, while current bundles include the documented upgrades.

## Tie-Breaker — source upgrade checked, next release pending

Crown Gauntlet uses the actual existing best-of-three duel engine inside a seeded elimination bracket. Ten entrants all participate; two are active per duel. A ten-bot bracket completed all nine qualifying duels in the deterministic test. Draws replay as one-heart, steel-crate sudden death, rather than awarding a random winner. Duellist's Court, Crosswind Duel and Broken Crown teach pickup control, wind compensation and gap jumps. Bench status and the per-duel clock are explicit. Eleven focused tournament/lifecycle/package/SSR checks, typecheck and focused lint passed. These do not certify browser or physical-phone quality.

## Ten-game checkpoint review and release gate

A second independent review found four shared issues. Failed-before-fix regressions now cover all four: first-to-seven cups continue beyond 25 non-clinching rounds, paused master sound restores on a new match, bfcache page transitions preserve a recoverable game, and every Jungle/Drain/Tie arena applies the advertised intensity setting. Shared explosive reach/impulse is opt-in; original combat practice regressions still pass. Returning player matches get a Resume control, and bot demonstrations recover automatically.

Whole Site suite: 471 passed, seven existing skips, zero failures (478 total). The release runs TypeScript, ESLint, production build and the two production-Worker SSR checks. Browser/physical-phone QA remains blocked by the managed Sites requirement for control-browser; a 9/10 rating has not been established.

Free assets imported and used: four unmodified Lorc SVGs from game-icons/icons commit 82d948812bfe3f269ef8f731dcdb07b08160edc4 (CC BY 3.0, visible art credits), and Fredoka Latin variable font (SIL OFL 1.1, original license preserved). All SVG Git blobs were verified. Thirteen unmodified files of SharpTurn commit 22e177d6d43a49c4d920cf3745a90173fe0aa26a were imported for the pending Tailblazer step; all Git blobs matched, and its MIT license is included. Tailblazer has not yet been replaced or promoted.

Current source integrations: ten of thirty-nine entries. Remaining: ten physical prototypes and nineteen room titles. Their notices stay in place. Sumo's separate online relay is still undeployed; local bot matches and touch controls are available. Existing authoritative room play remains unchanged.

## Fourteen-game checkpoint — next four games

| Entry | Mechanics and settings | Functional evidence |
|---|---|---|
| Manic Panic · Bomb Joust | Mounted/foot combat, real bomb pickup/throw, crosscurrents and armed-bomb ricochets; ten contestants, one/two-hit rules, intensity and Crown Cups | Ten real bots finish each map; seeded default demos land hits and award crowns; lost carrier bombs respawn |
| Rubble Alliance · Faultline Run | Cracking footprints, pulse rows and twenty-second anchor islands; ten distinct starts, boost, warning pressure and custom survival cups | Ten bots navigate actual gaps; pulse/anchor rules differ; equal survival receives equal points; Hard movement differs from Normal |
| Dragon Drop · Jewel Joust | Collect, aim and fire jewels at a moving dragon; distance scoring, timed switchbacks and alternating projectile gusts | Ten bots collect, shoot and score on every map; actual target reversals and projectile forces are checked |
| Volt Vault · Polarity Palace | Electrical telegraphs, alternate-cycle control reversal and dynamo currents; lives, warning pressure and bot skill | Ten bots respond to hazards on all maps; displayed polarity matches movement on cycle transitions; Hard movement differs from Normal |

Shared changes include visible buggies, bomb/dragon/electrical-cell models, rectangular arena bounds, live point scores and optional score/elimination feedback. Canvas fallback draws actors over hazard tiles. Original engine files are archived from the version-61 base; generated bundles and provenance hashes include the opt-in upgrades. Free Three.js and the already-imported licensed font/icons are reused, with no new dependency or paid service.

Review found four issues before release: repeated Manic draws from ineffective seed/throwing strategy, one-tick hidden Volt reversal, ineffective Hard settings and missing feedback for score/elimination games. Dedicated regressions failed before fixes and passed afterward. A separate fairness regression found and fixed alphabetical Rubble tie awards. The entire suite passes 490 checks with seven existing skips (497 total); typecheck and lint pass. Worker production-render checks include all four new launch routes.

Current source integrations: fourteen of thirty-nine. Remaining physical sequence: Mystery Beat, Tailblazer, Jungle Fox, Metal Fox, Paint Panic and Rhythm; nineteen room titles follow. These still display their notices. Sumo online relay remains undeployed. Managed browser QA and physical-phone performance remain unavailable; no numerical quality rating is claimed. Publication metadata identifies the exact saved/deployed version.

## Online ten-phone integration — 2026-10-12

All 39 Arcade entries now have a canonical online launch with ten actual controller seats. Twenty physical titles and the three realtime room games use same-origin D1-authoritative matches; the other sixteen retain their native room/controller routes. The Sumo external relay is no longer required for the canonical Site launch. Original relay files remain available as archives. See PHONE_MULTIPLAYER.md for operation and verification limits. This extends multiplayer capacity without certifying the unfinished games at 9/10.
