# Room implementation verification

Date: 2026-10-02. This attests local checks of the review candidate, not production or human playtesting.

## Automated checks

- npm test: 56 passed, zero failed. Covers catalog/source readiness, immutable import baselines, safe staging/traversal/junctions, room auth/private fields, exactly ten slots, capacity, phase gates, monotonic sequence/replay, malformed input/rate limits, controller replacement, host pause, expiry, heartbeat, safe cancellation and hibernation recovery on message/alarm/status/close.
- npm run typecheck: passed.
- npm run catalog:check: passed.
- npm run build: passed actual Wrangler dry run, with 71 staged files and ASSETS/DB/ROOMS bindings. No production upload occurs.
- git diff --check: passed.

## Real local Worker browser checks

Reproduce with Node 22.13+, npm ci and npx playwright install chromium. Start npm run dev -- --ip 127.0.0.1 --port 4194. In another terminal, run npm run test:browser. ARCADE_TEST_URL can select another already-running test service. Stop the Windows preview before rebuilding its watched assets. Browser screenshots/logs remain ignored under .local.

The six-game test uses a desktop host and 390×844 mobile browser, real room HTTP/WS transport, ten contestants, phone join, gameplay countdown, actions, pause/resume, same-seat refresh, 44px+ touch targets and no horizontal overflow/page errors. It checks each game's actual remote human state; Roller receives network input, Scratch accepts a response-phase phone input, and Sumo reports the human slot.

The two-phone test exercises separate Ballistix contestants during fight, a second isolated room, invalid-token rejection (4003), pointer-cancel safe Magnet release, disconnect-to-bot without affecting the other phone, same-seat refresh, explicit New round after host reload, and exactly nine reserved phone seats with a further join denied (409).

The earlier import review also checked complete standalone packages at desktop/mobile sizes and missing modules. Original standalone tests remain; room tests do not replace them.

## Review and limits

A focused Sol architecture/security review found and prompted fixes for hibernated socket ownership, pre-auth broadcast leakage, charged attack release on interruption, iframe startup race and fresh-host recovery. Further wake-path tests ensure neutral input arrives even when the first event is an alarm/status/close; heartbeat timestamps survive hibernation without renewing stale presence.

No production Cloudflare provisioning/deploy has occurred. Physical phones, real internet latency/loss, Wi-Fi-to-cellular handover, device audio/autoplay, QR camera scanning and human full-match balance remain acceptance work. The host owns game physics and results; these tests do not prove competitive integrity, server simulation or restoration of match physics. Multiplayer manifests remain in-progress.

GitHub's GPU-free Linux runner uses Roller Ruckus's existing Performance graphics setting and disables headless background timer/renderer throttling. Gameplay, input, phase and seat assertions remain identical; the local full-suite pass used the normal Balanced setting. Physical GPU frame rate is not a CI claim.
