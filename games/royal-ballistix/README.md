# Royal Ballistix — Beach Siege

Current standalone build: **v0.14.0** (based on the v0.12 import).

Royal Ballistix is a radial ball-deflection survival game for **2–10 contestants**. One local human can play while AI fills the remaining seats. The imported source also exposes per-seat input hooks so bots can eventually be replaced by authenticated CALLBACK phone controllers, but no room-code transport is implemented in this package yet.

## Gameplay

Each contestant owns a gate sector around the circular arena. Protect your gate while balls ricochet through the court.

- **Magnet:** hold to capture nearby incoming balls; release to fire the held volley back into the arena.
- **Pulse:** timed defensive counter. Precise centered timing can trigger a stronger Perfect Pulse.
- **Run:** increases movement speed along your gate sector.
- Eliminated gate sectors become walls.
- The last surviving gate wins the round.
- First contestant to the selected **1, 3 or 5 round wins** takes the match (3 by default).
- Starting lives scale with contestant count: 2–4 = 12, 5–6 = 9, 7–8 = 7, 9–10 = 6.
- Ball/cannon pressure scales upward with larger groups.

## Controls

### Touch / phone browser

- Drag the **radial stick** left/right along your gate. Greater stick distance increases movement speed; the outer range enables Run.
- Hold **Magnet** and release to fire captured balls.
- Tap **Pulse** for the timed counter.
- There is no separate touch Run button. Stick and Magnet/Pulse support simultaneous touches.
- Choose **Match Setup** before playing, or Pause → **Settings**. Rule changes apply at the next start or explicit **Apply & Restart**; they do not silently reset your active match.

### Keyboard

- Move: **A / D** or **Left / Right Arrow**
- Magnet: **Space** (hold/release)
- Pulse: **X** or **E**
- Run: **Shift**

### Gamepad

- Left stick: move along your gate (18% deadzone).
- A: hold to catch, release to fire; X: Pulse; B: Run; Start: pause/resume.
- Pause, menu transitions, blur and disconnect neutralize held input. Return the stick and buttons to neutral before controlling again.

## Setup

No build step or remote dependency is required.

1. Open `source/index.html` in a modern browser.
2. The title runs a silent all-bot exhibition in the selected court. Watch collapses its compact panel; Return to Menu and Start remain accessible. **Match Setup** groups Match / Rules, Player Style, Controls and Audio / Access.
3. **Start Siege** begins a fresh match. **Defense Drill** starts a 60-second practice with one active ball, rotating left/center/right lanes, no eliminations, and a results card counting catches, counters, Perfect counters, volleys and gate misses.
4. **How to Play** is available from setup and pause. Pause, results and drill results include a main-menu route.
5. Non-human seats remain AI unless a caller uses the external input API documented under `integration/`.

Audio volume/mute, reduced motion, high contrast and setup choices persist locally with bounded validation and a safe fallback when browser storage is blocked. Audio begins only after a user action; tone voices are capped at 16 and disposed after playback. Reduced motion removes camera shake and decorative pulse/rotation, steadies shoreline motion and limits particles.

The court adds procedural castle turrets, shoreline foam, palms, sand markings and numbered gate pennants. Defender colors and numbers match the roster. Cannon charge lines show the exact pending firing direction; the incoming landing marker helps you position a defense. With captured balls, the dashed guide follows the actual release vector and volley spread.

The standalone HTML contains all CSS, JavaScript and Canvas rendering. Optional local PNG particles and OGG effects in `source/assets/` add impact/catch/crown feedback with procedural fallbacks. No remote/CDN dependency is used.


## Four courts and Tour

| Court | Simulation and skill | World |
| --- | --- | --- |
| Beach Siege | Classic catch/release, angled counters and bank shots | Raised sand court, coastal islets, palms and castle gates |
| Gale Harbour | 8-second gust cycle: 2-second directional warning, 3-second gust, 3-second lull. Aim against the wind. | Planked dock, moorings, cargo, squalls and directional windsock |
| Moonwell | 2-second warning; a bounded central radial/vortex field operates for 5 seconds, then rests. Bank outside the marked field or curve through it. | Tiled observatory, runic stones, stars and illuminated well |
| Clockwork Keep | Two central capsule deflectors wait 2 seconds then rotate slowly for 6 seconds. Ghost arms show upcoming geometry. Release into open lanes. | Brass clock dial, geared rim, masonry and rotor mechanism |

All forces act only on free balls, scale with court size, and retain speed caps. Deflector rendering and collision use the same segments. Bot intercept forecasts incorporate forces/rotors; their release choices compensate for force and wait for clockwork openings. Hazards do not remove lives directly.

**Four-court Tour** starts at your selected court, visits all four once, and caps each court at 75 seconds (or ends when one gate survives). Higher placement earns more points; equally healthy surviving gates share points at timeout. Results show aggregate standings, coaching and Next Court / Replay Tour. Siege retains its 1/3/5-crown rules. Defense Drill can practice every court.

Exhibition seats are all bots, use 3 lives and a 50-second showcase cap, loop after an end, and use separate random state. They accept no local/external combat inputs, award no crowns/tour points/stats and never write preferences. Returning to the menu stops existing audio; a sounded match cannot make the demo audible. Start resets seats, timers, balls, stats and controller state and focuses the canvas.

The 16 meaningful controls are court, seats, arena size, bot difficulty, crowns, ball pace, hazard strength, defender name, house color, crest, movement response, landing guide, volume, mute, reduced motion and high contrast. Match rules stage until Start / Apply & Restart; style/access/control preferences apply immediately. Saved values are bounded and storage failure is safe. The camera menu and CAM codes remain additional controls.


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
- local touch/keyboard/gamepad input
- AI-controlled bot seats
- `window.RoyalBallistix` integration hooks
- `window.GameDebug.getState()` structured state access

See `integration/README.md` for exact hooks and multiplayer gaps. The Sumo comparison and focused verification are recorded in `docs/quality/sumo-benchmark/royal-ballistix-report.md` in the repository.

## Known issues / limitations

- No authenticated room-code join flow exists.
- No server-issued seat credentials or authoritative transport exists.
- `setPlayerInput` currently trusts the caller-supplied seat ID and does not enforce sequence/timestamp ordering.
- Disconnect/reconnect, stale-input neutralization and network snapshots are not implemented.
- Multiplayer status must therefore remain **not-integrated**.
- Source smoke, behavioral and emulated-browser checks are recorded in `tests/evidence/quality-review.md`. These do not establish production multiplayer readiness, physical-phone quality or human game feel.

## Modifying the game

1. Preserve a recoverable standalone `source/index.html`.
2. Tune existing `TUNING` values before adding unnecessary systems.
3. Record source changes in the changelog. Coordinate the internal debug version and manifest/package version together; v0.14.0 identifies itself as `0.14.0-worlds`.
4. Update `manifest.json` source metadata only when it remains accurate.
5. Run the source smoke test and manual gameplay checks in `tests/README.md`.
6. Run `npm run catalog:generate` and `npm run catalog:check` after manifest edits.
7. Do not mark multiplayer verified until repository-format JSON evidence exists and is bound to current source hashes.

## Provenance

Imported from:
`edmondsonedits/CALLBACK@ed09d25b690b36b397516e4d77437e3dd21247c8`

Upstream source is Apache-2.0 licensed. A copy of the upstream license is included at `source/UPSTREAM-LICENSE.txt`.
