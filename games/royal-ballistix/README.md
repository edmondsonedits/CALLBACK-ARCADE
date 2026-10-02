# Royal Ballistix — Beach Siege

Imported standalone build: **v0.12.0**.

Royal Ballistix is a radial ball-deflection survival game for **2–10 contestants**. One local human can play while AI fills the remaining seats. The imported source also exposes per-seat input hooks so bots can eventually be replaced by authenticated CALLBACK phone controllers, but no room-code transport is implemented in this package yet.

## Gameplay

Each contestant owns a gate sector around the circular arena. Protect your gate while balls ricochet through the court.

- **Magnet:** hold to capture nearby incoming balls; release to fire the held volley back into the arena.
- **Pulse:** timed defensive counter. Precise centered timing can trigger a stronger Perfect Pulse.
- **Run:** increases movement speed along your gate sector.
- Eliminated gate sectors become walls.
- The last surviving gate wins the round.
- First contestant to **3 round wins** takes the match.
- Starting lives scale with contestant count: 2–4 = 12, 5–6 = 9, 7–8 = 7, 9–10 = 6.
- Ball/cannon pressure scales upward with larger groups.

## Controls

### Touch / phone browser

- Drag the **Slide** control left/right to move.
- Hold **Magnet** and release to fire captured balls.
- Tap **Pulse** for the timed counter.
- Hold **Run** for extra movement speed.
- Pause → **Settings** exposes contestant count (2–10), arena size, and AI difficulty.

### Keyboard

- Move: **A / D** or **Left / Right Arrow**
- Magnet: **Space** (hold/release)
- Pulse: **X** or **E**
- Run: **Shift**

## Setup

No build step or remote dependency is required.

1. Open `source/index.html` in a modern browser.
2. Choose the desired contestant count in Settings.
3. Play locally; non-human seats remain AI unless a caller uses the external input API documented under `integration/`.

The imported HTML contains all CSS, JavaScript, Canvas rendering and generated Web Audio tones. It does not fetch external scripts, styles, images, models or audio files.

## Tuning locations

Gameplay tuning is centralized in the inline `TUNING` object inside `source/index.html`:

- `simulation` — fixed timestep and catch-up limits
- `ball` — speeds, restitution, collision substeps and safeguards
- `paddle` — player and bot movement speeds
- `magnet` — overheat, capacity, release speed and aiming
- `ai` — retargeting and offensive biases
- `pulse` — normal/perfect timing windows, speeds and cooldowns
- `readability` — cannon telegraph and threat trails
- `gate` — critical-life presentation and hit feedback
- `arena` — gate coverage, paddle coverage, ball/cannon scaling
- `players` — supported player range

Arena display size is also adjustable at runtime from **80% to 135%**, defaulting to 115%.

## Current architecture

The game is intentionally preserved as one standalone HTML source file. It uses:

- HTML5 Canvas 2D rendering
- Web Audio oscillator tones
- 120 Hz fixed-step simulation with capped catch-up
- local touch/keyboard input
- AI-controlled bot seats
- `window.RoyalBallistix` integration hooks
- `window.GameDebug.getState()` structured state access

See `integration/README.md` for exact hooks and multiplayer gaps.

## Known issues / limitations

- No authenticated room-code join flow exists.
- No server-issued seat credentials or authoritative transport exists.
- `setPlayerInput` currently trusts the caller-supplied seat ID and does not enforce sequence/timestamp ordering.
- Disconnect/reconnect, stale-input neutralization and network snapshots are not implemented.
- Multiplayer status must therefore remain **not-integrated**.
- The package has static/source smoke checks and a manual verification checklist, but no claim of production multiplayer verification or formal human playtest evidence.

## Modifying the game

1. Preserve a recoverable standalone `source/index.html`.
2. Tune existing `TUNING` values before adding unnecessary systems.
3. If source behavior changes, update the internal debug version and this package version/changelog.
4. Update `manifest.json` source metadata only when it remains accurate.
5. Run the source smoke test and manual gameplay checks in `tests/README.md`.
6. Run `npm run catalog:generate` and `npm run catalog:check` after manifest edits.
7. Do not mark multiplayer verified until repository-format JSON evidence exists and is bound to current source hashes.

## Provenance

Imported from:
`edmondsonedits/CALLBACK@ed09d25b690b36b397516e4d77437e3dd21247c8`

Upstream source is Apache-2.0 licensed. A copy of the upstream license is included at `source/UPSTREAM-LICENSE.txt`.
