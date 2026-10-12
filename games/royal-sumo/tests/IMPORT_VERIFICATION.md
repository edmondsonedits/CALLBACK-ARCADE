# v1.3.0 and CALLBACK phone-room verification

Checked 2026-10-12. Public relay deployment is pending authentication; this is local automated evidence, not a claim of production multiplayer operation.

- The supplied HTML SHA-256 is `86bcf200c457a9b3da5cb222bcd5e22a46cc95d229b98edf53354eb503589c7e`. Its complete editable project reproduces those bytes. No supplied simulation, renderer or module was changed.
- The active entry adds only the CALLBACK camera adapter, phone-room adapter and pause-flow metadata. Source integrity checks pass.
- All 144 supplied deterministic gameplay/input tests pass.
- After integrating the latest main, all 280 repository tests pass; TypeScript, catalog consistency and the Pages build also pass.
- Seven room/transport/Worker tests pass: authentication, unique bot-seat assignment, invalid/duplicate input rejection, reconnect sequences, capacity, pause/host lifecycle, persisted room closure and allowed-origin CORS. The transport test uses actual HTTP and WebSocket clients.
- Sixteen Chromium browser checks pass, with zero captured runtime errors: boot; host authentication; phone seat takeover; movement; simultaneous touch/Bash and paused-input clearing; charged Bash release; Dash; disconnection; credential reconnect; changed match sizes; explicit Leave; room shutdown; camera codes; pause/settings/resume; and all six arenas with ten fighters.
- Screenshots in `evidence/` were visually inspected at 1100×740 host, 390×844 phone portrait and 844×390 phone landscape. Controls and status remain visible without scrolling.
- Wrangler production-package dry run builds successfully with static assets and the `SumoRoom` Durable Object binding. No public relay was deployed: this session has no Cloudflare authentication.

`evidence/browser-results.json` records the exact browser checks and hashes of the tested entry, adapters and server. Tests disable the unsupported native gamepad hardware probe and use software WebGL. During combat assertions only, other fighters are held still to remove random AI interference. Screenshots show that test fixture.

Physical phones/gamepads, haptics, audio by ear, real hardware performance and WAN reliability remain unverified. Phones are controllers for a shared host screen; separate phone game views and full deterministic replay export are not implemented. Multiplayer remains **in-progress**.
