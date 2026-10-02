# Integration notes

The game exposes `window.RoyalTwisted` with player-count, state, remote-player registration/release, Jump and Duck input hooks.

These hooks are useful for a future CALLBACK host/controller adapter, but they are not a trusted multiplayer transport. Server-issued seat credentials, monotonic input sequencing, reconnect behavior, rate limits and authoritative validation still need to be implemented before multiplayer can be marked verified.