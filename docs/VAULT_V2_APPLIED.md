# Knowledge vault v2: applied findings

Reviewed 2026-10-02 against Astra Knowledge Vault v2.0 Moku Doot. This work applies the relevant architecture to all six imported arcade demos. The creative party games remain on their existing Sites deployment. Original game pages are retained under each source/original directory; physics, cameras, scoring and art tuning are preserved.

| Vault reference | Verified source | Applied here | Deferred |
| --- | --- | --- | --- |
| ASTRA-2026-0127 Moku Room | [README](https://github.com/moku-labs/room/blob/da4f16be5ed8d06770c156e6dfd352725581a6f9/README.md), pinned transport protocol at that revision | Separate typed room/input contracts, opaque reconnect identities, heartbeat, bounded input, safe cancel, backpressure, shared host/controller boundary | WebRTC direct lane and ICE/TURN. Current upstream MAX_CONTROLLERS is 8 and default gameplay is LAN peer-to-peer; importing it wholesale would not meet our ten-seat internet requirement. |
| ASTRA-2026-0128 Doot Games | [Engine README](https://github.com/virgilvox/doot-games/blob/0f78d6d11e7a7863cc9aa575ab2cfa39c5f6bd9b/packages/engine/README.md), [identity module](https://github.com/virgilvox/doot-games/blob/0f78d6d11e7a7863cc9aa575ab2cfa39c5f6bd9b/packages/engine/src/identity.ts) | Shared room phases and presence independent of game; reusable transport plus six bounded adapters; no framework migration | Creative prompt/reveal/vote blocks belong to the separate Sites engine. Name-derived identity was deliberately replaced with opaque credentials here to prevent name-based seat impersonation. |
| ASTRA-2026-0124 Claude of Tanks | Vault research record | Preserve the demos' fixed-step simulation; test input edges and bot handoff before retuning gameplay | No engine or mixed-license content copied. |
| ASTRA-2026-0125 HexStacker | Vault research record | Study only | No source/assets copied without verified root licensing. |

Original code implements the room and adapter patterns. Neither Moku nor Doot is a runtime dependency and no upstream implementation was copied. The QR runtime is pinned qrcode-generator 2.0.4; its MIT header remains intact and its package notice is shipped locally. Existing Three.js notices remain intact.

## Concrete changes

- Real Worker asset package serves all six complete games and local dependencies, excludes archived originals from uploads, rejects traversal and junction escapes, and preserves unowned build folders.
- Shared catalog adds previews, solo links, host links, search and a join-room entry.
- Host shows a QR code, readable room code, ten-slot roster, explicit start/pause/resume/new-round controls and a 16:9 game screen.
- Phones get game-specific controls, 44px+ touch targets, alternate movement buttons, keyboard action access, safe-area spacing, status/latency, pointer cancellation and optional screen wake.
- Cloudflare room validates credentials, roles, phase, input bounds, message size, increasing sequence and rate. Credentials never appear in shareable URLs. Guest names are rendered as text.
- Empty/disconnected seats use bots. Phone refresh keeps its reserved seat and accepted sequence. A lost host pauses; a fresh host simulation requires New round. No score or physics recovery is invented.
- Hibernation restores live socket ownership and sends safe neutral controls on event/alarm wake. Unauthenticated sockets cannot receive room/snapshot broadcasts.
- Scratch gains non-resetting seat assignment and pause clock offsets; Space Bash gains remote human slots. Ballistix gets safe Magnet cancel. Roller rejects all old sequences and gains safe neutralization. Twisted/Sumo retain their established input hooks.

## Evidence and limits

See STATUS.md and tests/browser for reproducible checks. Tests prove local Worker and simulated mobile browser operation, not a deployed public service, real-phone radio behavior, human game quality, internet latency, or trusted competitive scoring. The designated browser host owns physics and results. Cloudflare owns room identity, membership, phase and input validation. D1 stores catalog metadata, not high-frequency movement. Server simulation, persistence of match physics, adaptive snapshot deltas, spectator mode and internet playtesting remain separate milestones.
