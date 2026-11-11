# King Prompter Native Arcade Design

**Status:** Design for review  
**Date:** 2026-09-27  
**Decision:** Build a King Prompter-owned arcade that uses King Prompter rooms, host display, phone controllers, identity, and visual language. Reuse or adapt free/open-source game code when its license, dependencies, architecture, and quality fit; rebuild only when reuse is impractical or would compromise the product. Open Party Lab is not a room, server, or runtime dependency.

**Implementation boundary:** This is the umbrella product design. Its first implementation plan should cover the shared catalog/room foundation and the Air Hockey vertical slice only. The other 18 titles remain the explicit completion target, but are separate porting batches with their own focused plans and verification; they are not silently included in the first delivery.

## Problem and goal

King Prompter players should be able to choose from the Open Party Lab catalog of multiplayer game ideas and play those games together through King Prompter: one host display and phones connected to the same King Prompter room. Games should feel responsive, work reliably on phones, and fit the existing product rather than appear as an embedded third-party app.

The goal is to make all 19 catalog titles playable in King Prompter, with each title enabled only after its implementation meets the game's completion and performance checks. A catalog card may show a clear development status while a title is unfinished; it must not claim an unfinished title is playable.

## Product experience

1. Add **Arcade** to the King Prompter Grand Hall menu.
2. Open a King Prompter-branded catalog with all 19 titles:
   - Arena Survivor
   - Buzzwort
   - Chaos-Kommando
   - Drift Racer
   - Flatterfluff
   - Kartentisch / Card Table
   - Magic Arena
   - Magic Duell
   - MinionsTD
   - Schaetzorama
   - Word Tiles
   - Zeichnen & Erraten
   - Air Hockey
   - Imposter
   - Light Trails
   - Pantomime
   - Schattenjagd
   - Tap Race
   - Dungeon Party
3. Selecting an available title starts or joins a King Prompter room with its familiar room code and phone-controller flow. Players do not visit or create an Open Party Lab room.
4. The host runs the game on the King Prompter display; each player uses the connected King Prompter phone controller. The catalog and game screens use King Prompter branding, accessibility behavior, and navigation.
5. The match has its own ready, playing, results, replay, and return-to-Arcade flow. Arcade match points remain separate from creative-round scoring and Room Lore unless a later, explicit product decision defines a safe shared scoring rule.

## Technical direction

### Game module boundary

Create a typed catalog and a reusable game-module contract. Each game module declares its stable ID, title, category, player range, readiness, input shape, initial state, validated action handling, update/tick behavior where needed, role-specific public views, host presentation, phone controller, and results mapping. Shared room/transport code handles room membership, reconnects, deadlines, and common match lifecycle; game modules own their distinct rules and presentation.

Game state and input validation remain server-authoritative. Host and phone clients render snapshots and send requests; they cannot decide eligibility, phases, winners, or points. Hidden assignments and answers must remain absent from role-specific snapshots until their reveal phase. Results and point changes must be idempotent and traceable with unique event keys.

### Fast-game transport

Keep the existing King Prompter/D1 path for turn-based and low-frequency games where it meets the experience requirements. Current polling is roughly 0.9–1.2 seconds, so it is not the transport for responsive Air Hockey, racing, or similarly action-heavy play.

For fast games, use a King Prompter-owned real-time room service backed by one authoritative room process per active match, with WebSockets for compact input and state messages. The existing Site remains the first-party menu and room entry point. Verify the actual Sites binding/deployment support before implementation; if Sites cannot bind the required realtime primitive, host the King Prompter-owned Worker behind a King Prompter-controlled route and authenticate it through short-lived server-issued tickets. Never put credentials or reusable room secrets in URLs.

The realtime room owns transient simulation and validates inputs. D1 remains the durable record for King Prompter room identity, final match results, and uniquely keyed score events; do not write every animation frame or position update to D1. Reconnects receive a current safe snapshot. Disconnects, stale tickets, malformed input, room closure, and duplicate result delivery have explicit handling. Active simulation loops must have bounded lifetime and stop when the match ends; idle room/socket behavior should be measured before choosing hibernation or other cost controls.

### Smoothness and efficiency

- Render host and phone visuals locally at the display refresh rate; do not send render frames over the network.
- Use small input messages, sequence numbers, and compact state snapshots. Send control changes and meaningful events, not redundant unchanged state.
- Use a fixed-step authoritative simulation for real-time games, and interpolate remote state between received snapshots where appropriate.
- Keep assets lightweight, cacheable, and loaded only when needed. Prefer Canvas 2D or simple DOM rendering when sufficient; add a heavier renderer only when a specific game needs it.
- Measure host frame pacing, input-to-authoritative-response time, state-message rate, reconnect recovery, and CPU/runtime cost on supported desktop and phone profiles. Record thresholds and results in the implementation plan before marking a game ready.
- No universal zero-lag promise: network conditions vary. The acceptance goal is consistently responsive play within measured supported-device and network conditions, with graceful behavior when connections degrade.

### First vertical slice

Implement Air Hockey first to validate the catalog-to-room flow and the action-heavy transport. Before building its loop, inspect the game's source repository, license, dependencies, and simulation quality. Adapt a compatible, useful open-source simulation if that is the fastest reliable path; otherwise implement the loop natively. In either case it must include touch controls, authoritative puck/paddle rules, boundaries and goals, match timing, reconnect recovery, host/phone views, results, and performance instrumentation. The upstream Air Hockey project describes its source as alpha, so reuse must be measured and polished for King Prompter rather than assumed production-ready.

Once the vertical slice passes its agreed verification gates, port the remaining catalog games through the same module boundary in small batches. Drift Racer is described upstream as not ready for ordinary play, and Dungeon Party as early development, so their catalog entries remain visibly in development until King Prompter implementations are complete. Card Table includes multiple rulesets and should represent the supported variants clearly rather than hiding them behind an ambiguous single card.

## Source use and licensing

Use Open Party Lab's SDK and game repositories to find reusable code for game rules, simulation, rendering, and content. For each title, record its source URL, repository license, dependency licenses, asset/data rights, runtime coupling, and a reuse decision: reuse, adapt, or rebuild. Prefer the smallest compatible open-source component that saves work without bringing in the Open Party Lab platform or weakening King Prompter's server authority, privacy, accessibility, reliability, or performance. Preserve license texts, required notices, and attribution with reused code. Audit each asset, audio clip, font, word list, and third-party dependency separately; the upstream notice states that some media and data have their own rights conditions. Prefer King Prompter-owned art and sound when provenance is unclear. Do not import the Open Party Lab platform or its room/host/controller experience.

## Scope and non-goals

**Overall product scope:** Grand Hall discovery, complete 19-title catalog, King Prompter room and phone flow, typed game modules, an action-game transport where required, suitable open-source game code reused or adapted and native rebuilds only where needed, accessibility, reconnection and failure handling, match results, licensing checks, and measured performance.

**First implementation scope:** Catalog foundation and readiness model, verified King Prompter room/phone integration, real-time transport feasibility, a source/license/dependency reuse audit, and a complete Air Hockey integration (adapting compatible source code or rebuilding only as justified) with measured performance. Later title batches reuse this foundation and retain all 18 remaining titles as required work.

**Not in scope:** Open Party Lab accounts/rooms/servers, embedding its UI, changing the existing creative game engine's scoring or lore rules, claiming all games are ready before they pass, or publishing a production deployment without the separate release approval required by project policy.

## Risks and decisions to resolve in implementation planning

- **Sites compatibility:** Durable Object bindings are not documented in the reviewed Sites hosting configuration. Verify support; otherwise use a first-party King Prompter Worker route with a signed, short-lived connection handshake.
- **Room identity:** Map existing host/player authentication to the realtime room without trusting client-supplied roles, seats, or room codes. Preserve role-filtered disclosure.
- **Operational cost:** A continuously simulated active match cannot rely on sleeping between every frame. Measure active room duration and idle cleanup; choose hibernation only where it fits actual game behavior.
- **Game breadth:** Nineteen games are a substantial porting effort. Maintain one authoritative catalog and readiness state; deliver in verified batches without dropping titles from the completion target.
- **Content rights:** Validate each game's assets and non-code data independently of its source code license.
- **Performance variability:** Define supported device/network profiles and measurable gates from the Air Hockey slice. Network latency cannot be eliminated by client rendering alone.

## Acceptance criteria for the overall feature

- The Grand Hall exposes Arcade and the catalog lists all 19 target titles with accurate readiness labels.
- Every title can be selected and played through King Prompter's room, host, and phone flow once marked ready; no title uses an Open Party Lab room or runtime.
- Each game has server-validated actions, safe role-specific snapshots, deterministic/idempotent outcome recording, accessible phone controls, and reconnect/error behavior appropriate to its format.
- Fast games use responsive transport rather than the existing slow polling loop; D1 stores durable outcomes rather than per-frame simulation state.
- Each title passes its focused logic, rendering, phone, host, and multiplayer checks before being marked ready. The catalog's final completion claim waits for all 19 titles.
- Performance reports include frame pacing, input response, network update volume, reconnect behavior, and supported-device results; claims match observed evidence.
- Existing King Prompter creative modes, scoring, Room Lore, and room privacy contracts continue to pass their relevant regression checks.

## Acceptance criteria for the first implementation slice

- Arcade is discoverable from the Grand Hall and the catalog lists all 19 titles with accurate ready/in-development states.
- Air Hockey is fully playable through King Prompter's host, phone, and room flow, with no Open Party Lab room or runtime.
- Deployment feasibility for the fast-game transport is verified before committing to a binding or service layout; any required King Prompter-owned Worker is documented and included in the plan.
- Air Hockey's upstream code, dependencies, and assets have a recorded reuse/rebuild decision with license evidence; compatible useful code is reused or adapted where it materially saves work.
- Air Hockey's server rules, input validation, role-safe state, reconnect handling, match results, and score idempotency are covered by focused checks.
- Host/phone frame pacing, input response, state-message rate, and reconnect recovery are measured on declared supported profiles; the results and remaining limitations are recorded.
- Existing creative-mode privacy, scoring, lore, and room behavior passes relevant regression checks.
