# Royal Sumo phone rooms

Use the supplied v1.3.0 simulation and WebGL2 renderer. One trusted host browser runs the match; phones send inputs and render controller status. The dedicated WebSocket room server assigns seats and credentials, validates inputs and broadcasts the roster. This follows the arcade SDK's authoritative-host design; it does not add placeholder routes to the catalog Worker.

- Host opens Phone players, creates a six-character room and shows a join link/code. One host-controlled fighter plus up to nine phones, or TV-only plus ten phones.
- Every joining phone replaces one bot. Unclaimed/disconnected seats run the existing AI. Refresh reclaims the same seat using its opaque credential.
- Inputs contain protocol version, monotonic sequence, bounded movement, Bash hold and Dash edge. The server derives the seat from the authenticated connection; clients cannot select another fighter or submit scores.
- Paused/menu/disconnected-host rooms reject gameplay inputs. Neutralize controls on blur, cancellation, stale input and disconnect. Host disconnect pauses the local game and returns remote seats to bots.
- Preserve native solo, local two-player, camera settings, Crown Cup and all arenas.
- A Cloudflare Durable Object owns each online room. A Node/WebSocket adapter runs the same core for local multi-client tests and self-hosting. No D1, paid APIs or external signaling service is required.
- Room credentials stay in message bodies and browser storage, never URLs. Room codes and join URLs are public invitations. No player details are persisted outside room lifetime.

Deployment limitation identified: the existing Sites realtime Worker is unconfigured and Wrangler has no login in this session. GitHub Pages can publish the game and phone UI; a persistent public relay still needs an authorized Cloudflare deployment. Do not claim online publication until tested against a public endpoint.

## Implementation plan

1. Add the strict room core, WebSocket transports, and tests for authentication, slot replacement, duplicate input, capacity, timeout/reconnect and host lifecycle.
2. Add the host panel and responsive phone controller; keep them outside the imported modules. Add the online bundle through the existing CALLBACK build wrapper.
3. Verify the imported deterministic suite, repository checks, and real multi-client/browser flows. Record limits and evidence.
4. Publish GitHub changes and verify Pages. Deploy the relay only with authorized credentials; otherwise deliver the concrete deployment command and clearly report the blocker.
