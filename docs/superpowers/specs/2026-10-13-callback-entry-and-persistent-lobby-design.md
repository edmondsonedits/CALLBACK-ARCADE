# Callback entry, persistent lobby, and saved characters

Status: proposed design for user review; product code and production are unchanged.
Date: 2026-10-13

## Requested experience

The link opens a video-game title screen with a large CALLBACK title near the top and “Press anywhere to begin.” Remove the “Sound on · 25%” text. Clicking, tapping, Enter, or Space plays the existing picture/video introduction, then shows a visually appealing “How are you playing?” choice:

- I am a host screen — TV / computer.
- I am a player — phone / controller.

The host opens a persistent lobby immediately, before choosing a game. Its QR code and join code remain visible while the host browses categories, changes options, selects a game, plays, and returns to New Game. Players join once and follow the host into subsequent games.

Players can enter a code or tap “Scan the QR Code,” join the lobby, and customize their character while the host chooses a game. Save stores the character in Callback's hosted database. Undo survives Save, closing the editor, and later visits. A baseline and a “Restore default character” action remain available. Players need no account, installed app, or download.

New title-screen motion is deferred as requested. Retain existing media and the current castle art direction; implement titles and controls as accessible HTML rather than baking text into images. CALLBACK becomes the entry/platform name; King Prompter remains the individual game name.

## Verified starting point

Sites lists version 71 with source commit `e69bc8cf4434207e81bb1160d477a1c79a7bd850`. The existing `.sites-qa-live-2026-10-12` checkout is clean at that exact commit. The older parent checkout contains unrelated edits and must not be deployed.

- `app/components/TVIntroMenu.tsx` owns the gate, introduction, transition, and Grand Hall menu.
- `app/components/GrandHallMenu.tsx` links to separate setup flows that currently select a game before creating its room.
- `app/play/page.tsx` accepts a four-character code; it does not provide a camera scanner.
- `app/components/AvatarEditor.tsx` supports Undo/Redo in component memory, currently bounded to 80 past states. Reopening the component loses that history.
- `lib/avatar-preference.ts` saves the avatar in browser local storage. It is not a hosted returning-player profile.
- The main authoritative room engine already preserves participants on `PLAY_AGAIN`, but `SET_CONFIG` only runs in the lobby and prohibits switching to or from Arcade.
- `server/arcade/online/service.ts` has separate rooms, seat cookies, controls, and match state for online physical Arcade games.
- `server/arcade-phone/service.ts` also owns a separate legacy controller-room and seat service; compatibility must cover this namespace as well.
- `app/party-games/page.tsx` links to independent third-party services. They do not share Callback authentication or seats.

These are source observations, not a claim that the requested behavior is implemented or tested.

## Proposed screen flow

1. **Title:** CALLBACK at the top, existing background, large press-to-begin area. Keep sound preferences available later; remove the volume readout from this screen.
2. **Introduction:** preserve the existing animation, skip control, and audio unlock. Reduced motion, playback failure, and skipping all lead to the role choice.
3. **Role choice:** two prominent illustrated-by-code cards with the exact requested labels, clear TV/phone hints, visible focus, and large touch targets.
4. **Host lobby:** create or resume the server-owned session. Display its stable QR, four-character join code, roster, categories, and options. Category selection opens Select a Game inside this same session. Change category and Back remain session navigation.
5. **Player entry:** code field, Scan the QR Code, nickname, saved character preview, and customization. A scanned host QR can fill the code directly. Join confirms one authenticated session seat.
6. **Player lobby:** show “You're in — the host is choosing a game,” the roster, and Edit Character. Save updates the hosted profile and the current lobby avatar.
7. **Game:** host and phones follow the session's active game instance automatically. Host remains a display/controller role; it does not consume a player seat just by opening the TV menu.
8. **New Game:** return the same session to selection and preserve the code, player IDs, cookies, nicknames, avatars, and connected phones. Starting another game resets that game's match state. Leaving an unfinished match uses a clear host confirmation in the product.

Direct QR/join links bypass the title/intro/role choice and open the player flow. Existing direct game and room URLs remain compatible with their current rooms.

## Persistent session boundary

Introduce a small D1 session layer above the existing game engines. A session owns its public code, host authentication, version, roster, membership, availability/expiry, and active game instance. A game instance owns its existing phases, inputs, deadlines, results, jobs, and scoring. Returning to selection ends the instance rather than ending the session.

Use one stable host route and one stable phone route for a session. The session snapshot tells each authenticated client which game view to render. Adapters launch supported main-engine and online-Arcade instances with authenticated membership derived on the server, including legacy Arcade controller compatibility where that service is still used. Browsers must not fabricate a room, seat, or role to enter an instance. Child-room credentials and internal codes are not exposed as a new player join flow.

Persist a mapping from session members to engine participant/seat IDs. Keep host and player credentials distinct when both roles use one browser. Allocate public session codes atomically in a namespace that avoids ambiguity with existing room codes; the join resolver must unambiguously support old links.

Session actions are strict, authenticated, version-guarded, and idempotent. Give every game instance a new identifier/generation. Reject actions and input from an old instance after switching. Enforce that predicate in the mutation, not just in an earlier read: the current online input service can otherwise accept a stale write after a concurrent switch. Late AI/image results may finish historical work but cannot mutate the new game. Switching must not create scoring events for an abandoned match.

Preserve each game's player-count, human-only, bot, and privacy rules. The lobby shows whether the selected game can start with its current roster. Retain human seats; reconcile game-specific bots through existing authoritative mechanisms. Do not silently eject humans to fit a game.

Session membership persists while the session is alive; disconnected phones can reconnect without joining again. Use a documented, refreshed idle expiry and an explicit End Session action. New Game does not rotate or expire the session. A returning-player profile has an independent lifetime and outlives a lobby.

Third-party guest links remain clearly labeled as opening a separate service and stay outside the shared-session game picker. They require separate integration work before they can promise the same lobby. All built-in Callback party and online Arcade games must pass the shared-session transition checks before this flow is released.

## Hosted anonymous character profile

On first player entry, the server issues a high-entropy anonymous identifier in a Secure, HttpOnly, SameSite cookie. Store only its hash in D1. Resolve the profile from that cookie; never use nickname, public code, or a caller-supplied profile ID as authorization.

Store schema-validated current avatar, preset, selected starting baseline, canonical default, bounded past/future history, and a profile version. Keep the baseline separately so trimming old Undo states never removes it. Use the existing 80-step history bound consistently for UI, API validation, and storage.

- **Save:** persist the current avatar and complete retained history atomically with a profile version guard. Show success only after the server confirms it. Update an authenticated current session seat without dropping membership.
- **Undo / Redo:** navigate the saved history in the editor even after reopening or reloading. Changes remain a draft until Save. A new edit after Undo discards the redo branch.
- **Restore starting character:** return to the recorded selected baseline.
- **Restore default character:** return to the canonical default at any time. Record the reset as an undoable edit; Save commits it.
- **Cancel:** restore the editor-open state without modifying the hosted profile.
- **Failure/conflict:** retain the draft and explain the save failure or version conflict; do not claim a save succeeded or silently overwrite another tab's newer changes.

Reuse legacy local avatar preferences as a migration candidate only when the returning hosted profile does not already exist. Hosted data wins thereafter. Local storage can hold a recoverable draft, but is not the record of a successful Save.

This recognizes the same browser without sign-in. Clearing its identity cookie or using another device cannot automatically recover the same anonymous person. Cross-device identity linking is outside this request. Surface that practical limit briefly in profile help, without adding sign-in to the player flow.

## QR scanner behavior

Camera access begins only after the player taps Scan the QR Code and grants the browser permission. Preview the camera, prefer the rear camera, offer Cancel, and stop all camera tracks on success, cancellation, navigation, or unmount.

Use feature detection with a maintained decoder fallback when native QR decoding is unavailable. Accept only a valid same-origin Callback session/join URL or valid Callback code. Do not navigate to an arbitrary scanned URL. Invalid/expired codes, denied camera access, unsupported cameras, and decoding failures keep manual code entry available.

Scanning locates the lobby; it does not itself authorize a player seat or bypass nickname, capacity, or server validation.

## Data and implementation responsibilities

- Entry/menu: `TVIntroMenu`, `GrandHallMenu`, entry CSS, and platform metadata/copy.
- Sessions: new typed session contracts, service, routes, role-filtered snapshots, membership, and game adapters; integrate with `server/database.ts`, `server/engine.ts`, and online Arcade service boundaries.
- Player/profile: reuse `AvatarEditor`, `Avatar`, and avatar schemas; add profile/history contracts, persistence, authenticated API, and draft handling.
- Joining: shared player code entry, scanner component, stable QR links, and reconnect-aware session sync.
- Schema: update Drizzle schema, migration, and runtime bootstrap DDL together. Preserve existing rooms and historical scores.
- Documentation: update current status, architecture, visual brand hierarchy, screen families, and relevant test instructions to describe the resulting behavior.

Keep all phase, eligibility, scoring, deadlines, authority, and hidden-information rules inside the current server engines. Do not replace the game implementations or loosen authentication to make navigation easier.

## Acceptance and release checks

1. First visit shows CALLBACK and Press anywhere to begin, with no sound/volume text. Mouse, touch, and keyboard work; normal, reduced-motion, skip, and media-failure paths reach role selection.
2. Host receives a join code/QR before selecting a game. Phones can join and edit characters while the host browses categories.
3. Save a customized character, close the editor, reload, reopen, and Undo earlier edits. Save the undo, reconnect, and confirm it persists. Restore baseline/default and undo those resets. Verify save failure and concurrent-save handling.
4. Join multiple phones once, play a main-engine game, return to New Game, switch to another main-engine game, then online Arcade and back. Assert identical session code and member IDs, automatic phone routing, correct controller types, and no extra Join screen.
5. Refresh host and phones during lobby, gameplay, and game switching. Test a disconnected/reconnected phone, maximum seats, rejected overflow, expired sessions, and strict host/player role separation.
6. Concurrent/replayed switch/start actions do not create two active instances, double-award points, leak authorship, or accept delayed old-game inputs or image results.
7. Scanner success, cancellation, permission denial, unavailable camera/decoder, and foreign QR content all behave safely and keep code entry usable. Verify track cleanup. Physical iOS/Android camera behavior needs device testing and must be reported separately from browser automation.
8. Host views fit the supported 16:9 sizes without scrolling. Phone controls fit small viewports with safe areas, visible focus, readable contrast, labels, and usable touch targets.

Run focused logic/service and browser tests during implementation. Before a hosted release, run the repository's lint, typecheck, unit/integration, browser, rendered-route, production build, and whitespace checks. Package from the current Site source lineage, preserve version 71 as rollback, publish the reviewed artifact through Sites, and verify the deployed flow. Passing a subset is not a full release claim.

## Review checkpoint

This document describes the complete requested flow and the proposed implementation boundaries. Review the screen sequence, hosted character behavior, and persistent-session approach before implementation planning. No product feature in this document is marked complete.
