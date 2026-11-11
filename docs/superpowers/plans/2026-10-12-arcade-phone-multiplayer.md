# Phone multiplayer for the entire Arcade

Goal: each of the twenty physical arcade titles and nineteen room titles accepts up to ten authenticated phone players. Vacant physical-game slots use existing free bots. Keep the current local games, Party Games hub and authoritative King Prompter rooms intact. Two-player genres need fair participation rather than silently dropping eight seats. No 9/10 or physical-phone performance claim comes from unit checks.

The Site already has D1 and HTTPS; its separate realtime Worker is unconfigured. Use a same-origin authenticated HTTP transport and D1 compare-and-swap state for physical games and a hosted transport for the three realtime room titles. The server owns inputs, time, progression and results. Browser renderers consume snapshots; they never submit positions, winners or scores. No new paid service, client credential, arbitrary module import or client-owned room authority.

Files and tasks:

1. `lib/arcade/online/types.ts` defines JSON-persistable engines, canonical inputs and public views. Full source extraction/adapters for Sumo and the five other imported games must keep original physics and rendering, with deterministic serialization tests.
2. `lib/arcade/online/engines.ts` adapts the eight existing full model packages and remaining six prototype engines. Enforce all ten seats and test actual input/step/results, rather than increasing catalog limits alone.
3. `server/arcade/online/` provides independent online-room persistence, role/seat cookies, same-origin validation, bounded input/event queues, monotonic sequences, stale-input release, lifecycle and a server 30 Hz simulation advanced by host sync. Schema is recorded in Drizzle, an appended migration and the runtime schema registry. Joins have an atomic ten-seat limit; every game mutation uses CAS.
4. `app/arcade/online/` adds host setup/lobby/display and phone joining/controllers. QR links stay same-origin. Refresh restores the same seat; host controls are authenticated. Full renderers receive public snapshots through an origin-checked iframe bridge; local play remains available.
5. Native room games: expand the actual non-duel simulations/schemas to ten; handle duels as a fair roster competition. Remove the missing external realtime deployment requirement for Air Hockey, Light Trails and Tap Race through Site-hosted authoritative transport.
6. Run focused red/green gameplay, authentication, capacity, reconnect, ordering, privacy and lifecycle checks; request bounded independent review; run the full unit suite, typecheck, lint, production build and Worker route tests. Publish through Sites, preserve the audience and report browser/physical-phone validation honestly.

Execution boundaries: Sumo adapter, the five other full-engine adapters, and native capacity changes may be delegated independently. The Site owner handles transport/UI integration, database migration, review fixes and publication. Generated source is built from pinned local assets; original files and license/provenance stay preserved.
