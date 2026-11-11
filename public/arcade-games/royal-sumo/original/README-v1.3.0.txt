ROYAL SUMO: CROWNFALL  v1.3.0
==============================
PLAY: open royal_sumo_crownfall_v1.3.0.html in any recent Chrome / Safari 15+ / Firefox (phone or desktop).
It is ONE offline file: no downloads, no network, nothing else needed.

CONTROLS
  Phone: drag left side = move, hold BASH to charge then release to strike, DASH = shoulder rush.
  Keyboard (player 1): WASD move, Space/J hold-and-release = BASH, Shift/K/L = DASH, Esc/P = pause.
  Keyboard (player 2): arrows move, Enter = BASH, Right Shift / . / Numpad0 = DASH.   Gamepads: stick, A/X bash, B/Y/RB/RT dash.

WHAT'S NEW IN 1.3
  * One persistent seat table (Player/Slot model): every fighter has an owner (bot / local / remote), a name, a look and an optional
    bot skill. It survives rounds, rematches, restarts and browser reloads (remote ownership is session-only by design).
  * "Your sumo" picker on the setup screen: type a name, choose one of 10 looks (belt colour + hair + accessory).
  * RoyalSumo.multiplayer.setHumanSlot() / setOwner() really change who drives a fighter, live or between matches;
    submitInput() only drives remote-owned seats (sanitised, dead-man timeout 5 s); names flow to HUD, labels, results.
  * Seeds: scenario({seed}), restart({seed}), setSeed(), ?seed= all reach the simulation (API > URL > random);
    restart() replays the same match exactly; rematches / cup arenas derive new seeds reproducibly. Results show the seed.
  * Crown Cup podium and standings are ranked by points, then arena wins, then KOs; true ties share a rank.
  * Auto Quality is a real governor now: steps resolution down only when a live match is slow, verifies the step helped,
    steps back up when there is headroom, and turning it off restores full resolution immediately.
  * Versioning is explicit: build 1.3.0, sim 1.2.1, protocol 2, save 1 (RoyalSumo.versions).

DEVELOPING (source/ folder, needs Node 20+; no npm install)
  node build.js          compile src/ (ES modules) into dist/royal_sumo_crownfall_v<version>.html
  node build.js --check  lint only (layers, cycles, undeclared names, no network/eval)
  node test/run.mjs      144 deterministic unit tests incl. golden match hashes; if you change sim behaviour,
                         bump VERSIONS.sim in src/core/versions.js, then: node test/unit/golden.test.js --update
  python3 test/e2e/<name>.py   browser tests (Playwright + Chromium); tools/e2e_all.sh runs them all
