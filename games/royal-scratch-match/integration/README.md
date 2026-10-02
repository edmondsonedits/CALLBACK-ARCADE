# CALLBACK integration boundary

Royal Scratch Match v0.5 is a complete standalone browser game with useful local integration hooks, but it is not an authenticated online multiplayer implementation. The manifest intentionally remains multiplayer.status = not-integrated.

## Contestant model

- Total slots: 2–10.
- Default: 4 slots.
- Default human set: slot 0 only.
- Every slot not in humanSlots is controlled by the built-in bot resolver.
- One human plus nine bots is supported before a round:

    ScratchMatchAPI.configure({ playerCount: 10, humanPlayers: [0] });
    ScratchMatchAPI.start();

Multiple human slots can be declared before a round:

    ScratchMatchAPI.configure({
      playerCount: 10,
      humanPlayers: [0, 1, 2, 3],
      players: [
        { name: 'DANNY', color: '#ff5db1' },
        { name: 'PLAYER 2', color: '#ffd34f' }
      ]
    });

Slots not listed remain bots.

## Existing runtime hooks

### window.ScratchMatchAPI.press(playerIndex, lane)

Routes an A/B/X/Y lane press into the existing rhythm judgment system.

- playerIndex is clamped to the configured slot range in v0.5.
- lane is clamped to 0..3 for A/B/X/Y.
- Gameplay rejects input unless the game is in the response phase, the player exists, is alive, and that slot is marked human.
- Slot 0 also receives local audio/VFX/button feedback; remote human slots receive gameplay scoring/life effects but do not have separate private-device presentation.

This is a useful host-side application hook, not a trusted network endpoint.

### window.ScratchMatchAPI.configure(opts)

Supported options:

- playerCount: integer, clamped to 2–10.
- humanPlayers: array of slot indexes, or a number meaning the first N slots.
- players: optional name/color profiles, first ten used.
- difficulty: current difficulty string.

configure() reinitializes players. Use it in a lobby/pre-round phase, not for seamless mid-round joins.

### window.ScratchMatchAPI.start(opts)

Optionally calls configure(opts), then starts a round.

### window.ScratchMatchAPI.getState()

Returns the same state snapshot as GameDebug.getState().

### window.ScratchMatchAPI.setSound(boolean)

Controls host-page sound.

## State/debug access

window.GameDebug.getState() exposes:

- game/version
- phase and difficulty
- configured player count and human slot list
- phrase index, BPM, phase time
- timing/perfect windows
- input/resolution counters
- player IDs, names, lives, score, combo, alive state, misses
- current pattern times/lanes and per-slot resolved/hit state

window.GameDebug.tuning exposes the centralized tuning object.

This is appropriate for diagnostics and a future host adapter. It is not a server-authoritative snapshot protocol by itself.

## Current bot control

resolveBotsFor(note) evaluates each non-human slot at note time using difficulty, phrase pressure, chord penalties, and botSkillFor(index), then directly calls score/miss functions.

Important future change: docs/GAME_SDK.md requires bot substitution to use the same validated action path as network players. v0.5 does not do this yet.

## Required CALLBACK multiplayer work

A production phone-controller adapter should keep the game host authoritative and translate validated room inputs into the existing gameplay action layer. Missing work:

1. Room/seat transport and room-code join lifecycle.
2. Opaque server-issued seat credentials; phones must never choose trusted player IDs.
3. Versioned input messages with seat token, monotonic per-seat sequence, action type, and bounded payload.
4. Strict network-boundary rejection rather than clamping invalid player/lane/schema values.
5. Phase/action validation on the authoritative host before ScratchMatchAPI.press is called.
6. Duplicate/out-of-order rejection and per-seat rate limiting.
7. Disconnect neutralization and credential-bound reconnect.
8. Lobby seat replacement so phones can claim bot slots without resetting an in-progress match.
9. Bot substitution through the same validated action pipeline rather than direct award/miss calls.
10. Deterministic/replayable events: replace unseeded Math.random() where necessary and record accepted inputs/bot actions.
11. Host snapshots/interpolation contract for controller/TV display; phones must not run independent authoritative simulations.
12. Rhythm-specific latency calibration so transport delay does not silently redefine musical timing.

## Suggested adapter shape

The future host should keep seat-to-game-slot mapping outside the game:

    function applyValidatedArcadeInput(seat, message) {
      // Authentication, room membership, sequence, schema, rate and
      // phase validation happen before this function.
      const slot = seat.gameSlot;
      if (message.type === 'lane-press') {
        ScratchMatchAPI.press(slot, message.payload.lane);
      }
    }

Do not expose playerIndex as a trusted value supplied by a phone.

## Readiness statement

Source import is complete. Local multi-slot hooks exist. Online multiplayer remains unverified and not integrated. No arcade-multiplayer-verification JSON file is included because the authenticated room/seat/input contract has not been implemented for this game.
