# Space Bash — Orbital Breakout

Space Bash is a self-contained 2–10 contestant arena brawler on a destructible orbital deck. The imported build is v1.13.1.

## Gameplay
Move around the deck, grab and throw crates, kick crates or rivals, jump small gaps and survive as the deck breaks apart. CPU-controlled contestants fill the match.

## Controls
- Touch: analog movement
- Grab / Throw
- Kick
- Jump
- Players: 2–10

## Source
- Active: `source/index.html`
- Preserved upload: `source/original/space_bash_orbital_breakout_v1.13.1_standalone.html`

The standalone source explicitly requires no external scripts, modules, CDN assets, WebGL or network connection.

## Multiplayer
The current `window.SpaceBash` API exposes player-count/state helpers, but no per-seat remote-input transport is present, so multiplayer remains not integrated.

## Tuning
Movement, jump, kick, throw, gravity and related values live in the inline `TUNE` object.

## Quality review
The active source includes carrying/fuse/impact safeguards, clearer action and hazard cues, input cleanup and conservative CPU safety improvements. See [quality evidence](tests/QUALITY.md) for automated checks and the remaining rendered-browser/reference verification blockers. The preserved original upload is unchanged.