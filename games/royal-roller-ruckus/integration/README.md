# Integration notes

`window.CallbackInput` exposes up to ten player slots with bounded movement/action packets, sequence values, disconnect handling, player-count control and lobby/controller state.

The hooks are not equivalent to the repository's future trusted transport. Authentication, server-issued seats, authoritative phase validation, rate limits, reconnect and replay/event handling still need integration and verification.
Worlds v1.6.0 adds `window.CallbackRace.getState()` as a read-only public session/debug summary. Its `phase` remains `setup` during the title; `isDemo` and `demo.time` identify the isolated live simulation. The separate `raceTime` is preserved when returning to title and resets to zero on Start. `racers` shows current visible progress and honest nullable finish timestamps. `selectedCourse` reflects staged preferences; `activeCourse` reflects the current demo/race. `series` contains completed per-race results and aggregate scores. API seat changes discard Series scoring; countdown seat changes update the record scope. Demo packets do not claim human seats.

See `worlds/README.md` for current acceptance evidence and limits. No authenticated room-ready claim is added.
