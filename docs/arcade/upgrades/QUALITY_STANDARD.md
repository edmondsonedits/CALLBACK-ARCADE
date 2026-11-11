# CALLBACK arcade upgrade standard

User brief, 2026-10-12: improve every Sites arcade entry one at a time, using complete reusable games/code/assets where that produces a better result. Every physical game should offer live gameplay behind its starting menu, configurable bot-filled matches, substantial settings, and multiple arenas with distinct learnable mechanics. Card/word/party games need equivalent strategic boards, round variants and customization without losing their identity.

The current Site contains 19 room games and 20 local prototypes. The GitHub arcade is a separate collection. Keep existing room, D1, secret/snapshot, solo and phone controls intact. Local simulation remains isolated from authoritative room state. Do not recreate polished games already available in the user's source.

Quality evidence is required for game feel, meaningful arenas, readable presentation, fair bots, replayability, input and lifecycle. A target rating of 9/10 is a design objective, not a verified numeric measurement. Never label an untested build AAA or claim physical-phone performance from unit tests.

## First deliverable: Royal Sumo

Replace the one-player dots-on-a-ring prototype with the supplied Crownfall v1.3.0 game. Preserve the complete game; its WebGL2 renderer, six mechanical arenas, Crown Cup, charged Bash/Dash, one/two local controls, persistent names/looks, and extensive settings are stronger than the prototype. Use the existing CALLBACK camera adapter. Keep the exact imported source available and record hashes/provenance.

Serve full games from same-origin `public/arcade-games/<game-id>/`. Existing `/arcade/practice/<id>` URLs resolve to an embedded full game when a completed replacement exists, with an always-available Arcade exit. Retain legacy prototype simulation modules for regression/research; do not display them as the active replacement. No room or paid API request is needed for local play. Online relay availability remains accurately stated.

Verification: supplied deterministic suite and source hashes, package paths/dependencies, rendered route/canonical catalog, relevant input and gameplay tests, full Site tests/typecheck/lint/build. Managed Sites browser QA is unavailable because the required control-browser skill is not installed; skip browser automation per Sites instructions, preserve the limitation and do not claim the 9/10 target achieved.

Later games get a game-specific design/implementation entry and evidence before clearing only their placeholder flag. Existing player limits must be tested; ten contestant slots support all-bot demonstrations or one human plus nine bots. Do not disguise a two-player game's limits as ten concurrent players.
