# Royal Sumo phone acceptance pilot

Open https://callback-party-game.dans-host.chatgpt.site/arcade/sumo-pilot on the TV/host. Create a host lobby and join every phone using its QR/code. Select Arcade, choose the map/cup options, then choose **Royal Sumo · Real-time pilot** and **Start Sumo**. The normal Sumo entries retain the previous connection.

Start with 2–4 phones on the same Wi-Fi for about ten minutes. Move while holding charge with the other finger, release to bash, and tap Dash. Try two rounds, host Pause/Resume, then reload one phone and check that its name/control returns. Use **New Game → Choose New Game**, then launch an existing game such as Air Hockey: everyone should follow with the same code and names.

If responsive, put one phone on cellular and repeat a short game while others remain on Wi-Fi. Later try up to ten phones. Report device/browser models, phone count, Wi-Fi/cellular arrangement, approximate remote location, RTT p95 shown on the screens, and whether movement, charge release or dash feels delayed or inconsistent. RTT measures round-trip transport, not finger-to-TV response.

The free pilot permits one party at a time and up to 20 minutes per active party server. Use New Game to retire Sumo before ending the test. If another pilot party is using the server, wait for it to finish. A free quota failure ends availability; no paid plan or overage is enrolled. Keep the host visible: absent host/display heartbeats pause the match. Seats survive short disconnections; neutral input prevents a disconnected phone from continuing to move or charge.

Only Royal Sumo is migrated. Parent D1 membership persists across existing game switches; a dedicated Sumo socket runs during the pilot. The later catalog migration will keep the common room socket across game families after physical acceptance. Regional remote play is supported, but cross-region delay cannot be eliminated. Physical tests decide whether a local host option is needed.

## Verification evidence

- Baseline Site v75, reconciled with v77, v79 and v81; isolated branch `codex/sumo-realtime-pilot`. Rollback v81: `appgprj_6a84e36be0d48191896a3e5b980d4416~appgver_508c579da7fc8191944a8c301ee97137`.
- Backend: `https://callback-party-sumo-pilot.edmondsonedits.workers.dev`, Workers Free, SQLite Durable Objects. Secret is held in Worker and Sites secret management.
- Ten live cloud Node controllers passed accepted input, pause/resume and reconnect on Worker version `08c2ecd2-ed61-412e-8eeb-9a28429e4a06`: 219 pings, RTT median 42 ms / p95 56 ms, maximum compact snapshot 6284 bytes. This is one PC's cloud probe, not ten physical phones.
- Local six-map/ten-fighter CPU probe: mean 0.015–0.049 ms per step, p95 0.036–0.110 ms, maximum snapshot 7768 bytes. Snapshot cap is 8 KiB to retain hazards and complete fighter fields.
- Targeted regressions cover independent phone holds/dash, emitted result/broker compatibility, atomic callbacks, stale/replayed input, retired callbacks, recovery timers, invalid checkpoints, durable retry and lifetime expiry. Browser checks cover two phone contexts, two-contact touch start/end, accepted input, pause/resume, reconnect, responsive layouts and party switching.
- Release identifiers and deployed smoke are recorded in `.logs/party-latency/release-receipt.json`. Physical Wi-Fi/cellular acceptance is left for the user before other games migrate.
