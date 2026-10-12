# Space Bash integration

Standalone entry: `source/index.html`, v1.15.0. Canvas2D/2.5D and fixed 1/120 simulation retained. Public `window.SpaceBash` version/setPlayers/getState and CallbackCamera/CAM remain. `getState()` adds immutable value snapshots for real rules/map/seed/Series, paused state, hazard cue, fighter movement/cargo/actions, fight stats, and separate demo elapsed/fighters/map/hazard/time.

Stable UI: setup/startMatch/setupSettings, watchDemo/returnTitle/demoStart, modal/restart/close, pauseOverlay/resumeGame/help/menu, results/resultMenu/rematch/replay/nextStage. Preferences: map (orbital/cryo/reactor/garden), mode (classic/series), rule (standard/practice/volatile), seed, players (2–10), difficulty (.78/1/1.18), goal (1/3/5), roundLength (30/60/90), hazards, cargo (mixed/safe), playerName/playerColor/patch, aimGuide/coaching/haptics, volume/reducedMotion/swapHands/contrast, header sound mute. Rules stage; style/access are live. Browser review: coordinator-owned.

This package has no authenticated per-seat transport and makes no online readiness claim. Manifest remains experimental/not-integrated. `provenance.json` binds evidence to exact active/archive bytes. Original upload must retain SHA-256 `e6fc6342764b743bc125c0519b2f61d9384411b69b563799e26a10ac834b46d8`.
