# Solo Arcade Practice Lab

`/arcade/practice` is a local, solo-only practice launcher for the 20 game prototypes listed below. Each direct route loads one allowlisted simulation, accepts keyboard or touch input, and draws its current snapshot. The fixed-step runner does not create a King Prompter room or send player input to the multiplayer Worker.

## Direct routes

| Game | Route |
| --- | --- |
| Sumo | `/arcade/practice/sumo` |
| Space Bash | `/arcade/practice/space-bash` |
| Twisted System | `/arcade/practice/twisted-system` |
| Snow Bash | `/arcade/practice/snow-bash` |
| Drain Bash | `/arcade/practice/drain-bash` |
| Jungle Bash | `/arcade/practice/jungle-bash` |
| Roller Ruckus | `/arcade/practice/roller-ruckus` |
| Tie-Breaker | `/arcade/practice/tie-breaker` |
| Manic Panic | `/arcade/practice/manic-panic` |
| Rubble Alliance | `/arcade/practice/rubble-alliance` |
| Scratch Match | `/arcade/practice/scratch-match` |
| Sky Balls | `/arcade/practice/sky-balls` |
| Dragon Drop | `/arcade/practice/dragon-drop` |
| Volt Vault | `/arcade/practice/volt-vault` |
| Mystery Beat | `/arcade/practice/mystery-beat` |
| Tailblazer | `/arcade/practice/tailblazer` |
| Jungle Fox | `/arcade/practice/jungle-fox` |
| Metal Fox | `/arcade/practice/metal-fox` |
| Paint Panic | `/arcade/practice/paint-panic` |
| Rhythm | `/arcade/practice/rhythm` |

## Practice behavior

- There are no opponents or bots. Competitive winner/result fields are removed from adapted snapshots; Practice has no score persistence or results screen.
- A death or normal trial endpoint triggers a brief cue and a fresh seeded state. Reset starts a new attempt; Exit returns to the Practice catalog.
- Movement uses a fixed 30 Hz simulation and the canvas paints at the browser animation rate. Inputs are cleared on blur, hidden tabs, and cancelled touch gestures.
- Sound is off by default. Enable it per page for a short auto-reset tone; the Web Audio context is closed when leaving the game.
- Seed and tuning version are available in the collapsed Practice details panel.
- The shared canvas reads Tie-Breaker's nested combat arena and shows Twisted System's approaching obstacle and JUMP/DUCK cue; the sound toggle becomes interactive after the game client is ready.

## Boundary and verification

These routes are for testing basic movement, hazards, and prototype interactions. They are not the server-authoritative realtime multiplayer games, do not use phones as networked controllers, and do not yet claim original-game fidelity or 20 fully polished game reproductions. Multiplayer Worker integration and live latency playtests are separate work.

Published as Site version 54 from commit `e0dbd83be8935740bffb68599fc8bcf51467e9aa` at <https://callback-party-game.dans-host.chatgpt.site/arcade/practice>. Production browser verification opened all 20 direct routes and confirmed each title, canvas arena, Reset, and Exit; Sumo's sound toggle, Reset, and Exit were exercised. The production check did not create rooms or mutate game data. The full 44-scenario existing browser suite had 40 passes; its four failures were Worker-backed realtime Arcade flows that did not reach LIVE, which remain separate work.
