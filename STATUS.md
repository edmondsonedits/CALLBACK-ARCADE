# Current status

All six standalone demos are imported and served by the Worker asset package: Royal Ballistix, Royal Roller Ruckus, Royal Scratch Match, Royal Twisted, Space Bash and Royal Sumo. The searchable catalog links to solo play and shared-screen phone rooms.

The vault v2 improvements add authenticated Cloudflare Durable Object rooms, one host/local contestant plus nine reconnectable phone seats, bot substitution, game-specific phone controls, QR join, explicit lifecycle controls and safe held-input cancellation. Game-specific originals remain archived and gameplay tuning is preserved. See docs/VAULT_V2_APPLIED.md for source mapping.

Verified locally 2026-10-02: typecheck, automated suite, catalog freshness, Worker dry-run build and actual Worker browser flows for all six games. Mobile browser tests join, start, pause, resume and refresh the same seat at 390px width. Two simultaneous Ballistix phones operate separate seats during the fight; disconnect releases one seat to a bot, refresh keeps identity, host reload requires a new round, and a tenth phone is denied. See docs/ROOM_VERIFICATION.md for exact final counts and commands.

This is a locally verified party-room implementation, not a public deployment. No production Cloudflare database, Durable Object or Worker has been provisioned or deployed by this change. Game multiplayer metadata remains in-progress pending physical-phone internet testing. The designated host owns simulation and scoring; the server validates room lifecycle and phone input. No competitive anti-cheat or recoverable physics claim is made.

Next: merge the reviewed candidate, authorize Cloudflare login, configure the production D1 ID, deploy through the guarded command, then test the real HTTPS URL with independent phones over Wi-Fi/mobile data. Keep the seven creative party games on ChatGPT Sites.
