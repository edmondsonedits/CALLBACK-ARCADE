# Integration notes

`window.CallbackInput` exposes up to ten player slots with bounded movement/action packets, sequence values, disconnect handling, player-count control and lobby/controller state.

The hooks are not equivalent to the repository's future trusted transport. Authentication, server-issued seats, authoritative phase validation, rate limits, reconnect and replay/event handling still need integration and verification.