# Royal Sumo: Crownfall - resume note (read this first when asked to "continue")

Goal (from the user): a mobile-first 3D sumo party game that looks, plays and feels like Crash Bash / Fusion Frenzy sumo,
iterated "like a whole studio" from 5/10 up to 9/10+. Deliverable: ONE offline HTML file (+ zip), sent with SendUserFile,
with an honest scorecard (say what could NOT be tested here: real-phone touch/haptics, audio by ear, real-GPU fps, 2nd gamepad).

## Where things are (everything under /home/claude/work)
    src/core/   pure logic, runs in node:  util tune options versions maps ai sim settings seed slots remote cup quality session control
    src/gfx/    WebGL2 renderer + scenes:  engine gfx_core gfx_fighter gfx_fx gfx_maps gfx_maps2
    src/app/    DOM/audio/input/main:      audio controls ui main style.css shell.css
    tools/bundler.mjs  zero-dependency ES-module bundler (layers core -> gfx -> app, no cycles, lint: no network/eval/URLs/undeclared names)
    build.js           `node build.js` -> dist/royal_sumo_crownfall_v<build>.html (+ index.html, build-info.json)   `--check` = lint only
    test/unit/*.test.js  deterministic node tests (npm test = node test/run.mjs).  test/golden/sim.json = golden match digests per VERSIONS.sim
    test/e2e/*.py        Playwright + SwiftShader browser tests (python3 test/e2e/<name>.py; RS_HTML=... to test another build)
    src_flat/            the pre-modularisation v1.2 sources (reference only, not built)

## Architecture rules that matter
* VERSIONS (core/versions.js): build / sim / protocol / save are separate. Change sim behaviour => bump sim and run
  `node test/unit/golden.test.js --update`. The golden test fails if hashes change under an unchanged sim version.
* SlotTable (core/slots.js) is the single source of truth for seating (owner bot|local|remote, device p1|p2, name, look, skill).
  Session (core/session.js) plans matches (seeds, seating, Crown Cup); Control (core/control.js) is the service behind menus and
  window.RoyalSumo; main.js only builds/runs/draws. Sim owns `seats[]` (owner/name/style/skill) so they survive round rebuilds.
* Seeds: API seed > ?seed= > random. First match plays the seed exactly, later ones derive. restart() replays the same seed.
* Remote seats (RoyalSumo.multiplayer.submitInput) only drive seats whose owner is 'remote'; dead-man after 5 s of silence.
* Auto quality = core/quality.js QualityGovernor (probe-and-verify, back-off, off => full res at once).

## Status
v1.3.0 is built (dist/royal_sumo_crownfall_v1.3.0.html, sim 1.2.1, protocol 2). 144 node unit tests pass (npm test).
Browser battery (tools/e2e_all.sh <logdir>): smoke, regress (slots, setHumanSlot, seeds, cup podium, auto quality), matrix (18 matches),
desk, touch, audio, cup, p2, robust (context loss / leaks), setup (name + look picker), visual (hi-res sheet), glerrors.
A failing e2e test is retried once by the runner; persistence tests were seen to flake under load and pass alone.
Not testable here: real-phone touch + vibration, audio by ear, real-GPU fps, a second physical gamepad.
Next ideas (not started): online play adapter on top of multiplayer.submitInput, more maps/modes (write golden + unit tests first).
