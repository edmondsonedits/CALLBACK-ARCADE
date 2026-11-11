# Arcade Practice Lab Design

**Status:** Draft for user review

**Date:** 2026-09-30

**Approved direction:** Browser-based solo practice first; Worker-backed multiplayer remains a separate release stage.

## Goal

Let one person open and try each of the 20 Crash Bash / Fuzion Frenzy-inspired prototypes without creating a room, finding a second player, adding bots, or waiting for the realtime Worker. The player should be able to feel movement, momentum, turning, touch controls, hazards, object interactions, and physics. The session has no competitive result. It remains playable through repeated attempts until the player exits.

The user chose quick automatic restart after death, elimination, or a normal round endpoint. A persistent Exit control must return to the Arcade catalog.

## Source and preservation rules

- The current dirty workspace contains the 20 prototype simulations, renderer/controller, tests, and tuning files. Preserve all of it as recoverable source; do not deploy or replace the newer Sites source with this checkout.
- Implement the Practice Lab additively on the current Sites source/version. Port only the needed pure game simulation and presentation modules. Do not port the prototype room, ticket, WebSocket, or result protocol.
- Keep the existing Sites room, authentication, database, and game lifecycles unchanged. Practice is an independent developer/player tool and must not create a room or mutate room state.
- The 20 source game modules expose deterministic `createState`, `step`, `snapshot`, and `result` operations. Their physics can be reused in a browser runner. Existing game/network integration remains a separate server-authoritative concern.

## Player experience

1. An Arcade catalog entry offers **Practice** for each prototype.
2. Practice opens a direct game URL, for example `/arcade/practice/sumo`.
3. The page shows the arena, concise controls, and a visible **Exit** button. Keyboard input is available on desktop; large touch controls are available on mobile.
4. The game runs locally in the browser with no room code, join flow, bot, opponent AI, score persistence, leaderboard, or win/loss/result screen.
5. On death, elimination, or the normal end of a trial, show a brief reset cue and restart the relevant state. The player may press **Reset** at any time to restart immediately, or **Exit** to return to the catalog.

Practice must preserve each game's movement and environmental rules. It must not secretly add an AI opponent. Where basic interactions need a target, use clearly identified static training targets/props or the existing environment. If a title's central multiplayer-only mechanic cannot be demonstrated without another player, its Practice page must explain that limitation while still exposing its solo movement and controls.

## Architecture

### Simulation runner

Add a shared browser runner around the pure game modules. It owns local game state and inputs only for the current practice page. It steps simulations at a fixed 30 Hz with an accumulator, caps catch-up work after a stalled frame, renders at the display refresh rate, and pauses/resets held input when the page is hidden, blurred, or exited. It must increment input sequence numbers at the simulation cadence where a game requires fresh inputs for continuous movement.

Practice deliberately ignores competitive result mapping. The runner detects a terminal game state or its configured practice reset condition, displays short feedback, then creates fresh state for the same game. Use a repeatable seed initially so a tuning change can be compared against the same opening conditions. Seed and tuning/config version should be visible in a compact diagnostic area that can be hidden during normal play.

Game-specific reset policies:

- **Arena/combat and survival:** reset the player's state and unsafe arena state after death, collapse, or elimination; preserve the game's environmental hazards during each attempt.
- **Races and score trials:** end the current attempt without a result screen, then restart the course/trial.
- **Rhythm titles:** loop charts; Mystery Beat retains compose → preview → perform for its own chart.
- **Persistent trails/destructible arenas:** reset the full arena after collision or when the safe space is exhausted, avoiding an immediate repeated death.
- **Targets:** keep any training target static/non-AI and reset its damage or position with the attempt.

The policy may be implemented per game or shared game family, but every catalog item needs an explicit policy and a regression case. `result()` must not be allowed to leave a practice page in a frozen terminal state.

### Presentation and controls

Extract or parameterize only the reusable arena rendering and control presentation from the current combined `ArcadeRoom` component. Keep transport-specific behavior out of the Practice Lab. The practice scene should receive a snapshot, local roster, input callback, reset callback, and exit callback; the existing host/phone room flow continues to use its current Worker adapter.

Desktop input should support the mapped game actions without browser scrolling. Mobile touch targets must be large, have accessible labels, handle pointer cancellation, and remain inside safe areas. Reduced motion and audio opt-in/mute behavior follow existing King Prompter rules. No second phone is required; practice controls and arena share the current device responsively.

Load game code on demand so opening one practice game does not download all 20 simulations up front.

### Data and authority boundaries

- Practice state, reset count, and timing remain in browser memory and disappear on exit/reload.
- Practice creates no D1 room, participant, match, score event, archive entry, Room Lore, or paid AI/media request.
- The browser owns this private sandbox simulation. Do not reuse this client authority for competitive multiplayer; the Worker remains authoritative for multiplayer matches.
- Exit and Reset affect only the local practice runner and cannot stop or alter a room match.

## Viable approaches and decision

1. **Browser Practice Lab first (selected):** quickest way to test all 20 games and feel without Worker deployment. It cannot verify phone-to-TV latency or multiplayer synchronization.
2. **Worker-backed Practice first:** closest to the final room flow, but requires porting 20 simulation modules and adapting v52 auth/control/results before the user can test any game.
3. **Local full-stack Worker:** exercises room integration locally but still requires services running and does not provide public links.

The selected sequence is browser Practice Lab first, then v52-compatible Worker integration and multiplayer verification. The Practice Lab does not claim that a title's multiplayer behavior or physics fidelity is finished.

## Scope boundaries

Included:

- Direct practice URL and catalog entry for every one of the 20 prototype games.
- One-player local simulation, mapped controls, arena rendering, Exit, Reset, automatic restart, and per-game restart rules.
- Efficient simulation loop and lazy-loaded modules.
- Focused automated coverage for all 20 starts, input paths, terminal reset behavior, control cleanup, reset/exit, and no result persistence.
- Responsive desktop/mobile checks, production build, and deployment of the additive Site feature when the deployment path is available.

Not included in this phase:

- Bots, opponent AI, online rooms, multiplayer fairness, reconnects, latency compensation, or public score storage.
- Declaring any prototype production-ready or claiming console-level fidelity without playtests.
- Replacing the Sites project, changing the normal room system, or copying the dirty prototype Worker protocol into v52.

## Verification and release gates

Before calling Practice available:

1. Verify each of the 20 game URLs starts, receives input, renders, resets after its terminal condition, and exits cleanly.
2. Verify no game can stay frozen after a terminal state and no timer, animation frame, audio node, event listener, or held pointer survives exit/reset.
3. Test keyboard and touch input, desktop/mobile layout, reduced motion, pause on hidden tab, and a production build.
4. Deploy to Sites and open every public practice URL. State clearly that this verifies local solo simulation only.

Before calling full Arcade multiplayer operational, separately:

1. Port/adapt each game to v52's authenticated Worker protocol without replacing room lifecycle or identity.
2. Configure the required Worker, Durable Object, callback, and secure hosting bindings.
3. Verify host/phone transitions, solo practice policy where needed, multiplayer rules, reconnect, and poor-network behavior on the deployed Site and Worker.
4. Complete per-game footage comparison, tuning, and human playtests; keep prototype readiness labels until these gates pass.

## Open implementation details

- Select the exact existing Sites source/worktree for implementation before editing; keep the dirty prototype as the simulation donor and recovery copy.
- Check whether each module is safe to bundle in a browser and whether its current per-tick cloning meets the 30 Hz budget on target phones. Optimize only measured hot paths.
- Agree on a short reset-cue duration and on the minimal training target behavior for multiplayer-only interactions during implementation. These do not change the selected Practice Lab architecture.
