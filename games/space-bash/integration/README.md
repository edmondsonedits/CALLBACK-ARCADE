# Integration notes

`window.SpaceBash` currently exposes version, player-count and state helpers. It does not expose a per-seat remote input contract.

A future CALLBACK integration needs authenticated seats and validated movement/action input before this game can be used as phone-controller multiplayer.
The active v1.14.0 `getState()` also describes the selected rule (`standard`, `practice` or `volatile`). `setPlayers()` remains an explicit match restart with a bounded 2–10 count. It does not apply pending rule/difficulty settings. The default state now begins in `setup` until the local user launches a match.

`provenance.json` binds the current active and immutable original source bytes to the focused automated checks. It is source/quality evidence, not multiplayer verification.
