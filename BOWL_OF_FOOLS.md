# Bowl of Fools — implementation Bible

## Product promise

Bowl of Fools is a medieval phone-first adaptation of Fishbowl. Four to ten players—people, local deterministic bots, or a mix—split into two teams, anonymously contribute a shared pool of short answers, and guess the same pool three times. Familiarity compounds: a difficult scroll from round one becomes an inside joke by round three. The app is the timer, secret keeper, drawing surface, scorekeeper, host console, and optional call. People still speak and guess naturally; bots provide deterministic practice turns rather than human conversation or speech recognition. Same Table can run from the host-player's phone without a TV, though bot turns require a host to judge the spoken guess.

The story: the royal pigeon has filled the King’s ceremonial bowl with foolish anonymous scrolls. The court must prove it can remember its own nonsense. The winning team receives the Crown of Fools.

## Room setup

| Setting | Values | Default |
|---|---|---|
| Players | 4–10 total, humans and/or local bots | — |
| Scrolls per player | 1–5 | 3 |
| Environment | Same Table (phones only) / Remote Live | Same Table |
| Round Two | Drawing / Charades | Drawing |
| Built-in voice | On / Off; Remote Live only | On |
| Timers | Standard / 1.5× accessibility | Standard |

The person creating the room is immediately given both host authority and a normal player seat on the same phone. Their private scrolls, team turns, and readiness behave like every other human player's. Hosts can switch local bots on or off in vacant logical seats from the TV host screen or the host-player phone; switches are hidden for seats occupied by people. Bots count toward the four-player minimum, submit deterministic scrolls, and ready themselves for team setup. The server balances Team Bells and Team Motley, then shows a dedicated team-confirmation screen. The host may reshuffle or move players; any team edit clears prior ready states. Each team must contain at least two active players.

Bots use a bounded pool of familiar, short answers with deterministic text clues, one-word clues, and drawing strokes. Charades bots provide a public, answer-relevant practice cue for the team to act out; it is a text prompt, not a video performance. Bots do not speak, recognize speech, or guess independently. They never award themselves points. When the clue giver is a bot, the host listens to the team's spoken answer and enters it on the TV or host-player phone. A correct judgment scores only when that bounded entry matches the current secret scroll; a pass follows the normal one-pass rule. The secret remains hidden from the host view. Human clue givers and human scoring controls continue to use the ordinary rules.

## Tutorial

The tutorial plays by default and may be skipped by the host. It teaches:

1. Write anonymous scrolls of one to five words.
2. The same scrolls return in all three rounds.
3. Round One is description, Round Two is drawing or charades, Round Three is one word.
4. Say guesses aloud. The clue giver taps **Correct** or uses their one **Pass**. For a bot clue giver, the host transcribes the team's answer and judges it; the bot never scores automatically.
5. Illegal clues use the honor system; the host can undo the last Correct.
6. Authors are never revealed—not during play, results, history, or sudden death.

## Scroll collection

Every player submits exactly the configured number of scrolls. Blank, over-five-word, duplicate, or already-submitted scrolls are rejected. Comparison for duplicates is case-insensitive. Useful scrolls are memorable people, places, objects, titles, characters, actions, or compact phrases. A bank of 200 original, family-safe creativity cues supplies five small randomized hints at a time; players can refresh the hints without changing or submitting their answers.

The TV displays only completion count. The authoritative state retains author IDs only to enforce one submission per player. Snapshots never serialize the author beside a scroll. History does not archive scroll text or authors.

If the writing timer expires, deterministic all-ages fallback scrolls fill any missing player submission so the room cannot deadlock.

## Shared turn rules

- A turn lasts 60 seconds (90 in accessibility mode).
- Only the current clue giver sees the secret scroll.
- Their teammates guess aloud. There is no speech recognition.
- **Correct** removes that scroll from the current round’s bowl and gives the active team one point.
- **Pass** may be used once per turn and moves the current scroll to the back of the bowl.
- A new scroll clears the drawing and one-word clue.
- When time expires, play changes teams and rotates to that team’s next clue giver. Each team's clue-giver order is randomized for the match.
- Disconnected media never pauses or blocks the authoritative game.

## Round One — Speak, Fool!

The clue giver describes the answer without saying it, any word in it, or an obvious part/variation of an answer word. Gestures are not the intended clue channel. The room judges legality socially.

## Round Two — Draw, Fool! / Perform, Fool!

The host chooses one version before creating the room.

**Drawing:** a human clue giver draws on their phone. Normalized pointer strokes are validated by the server and mirrored to every phone and TV. No letters, numbers, speaking, or gestures outside the drawing. A bot submits deterministic practice strokes; depending on its answer, the sketch may be a simple geometric cue rather than a polished picture.

**Charades:** a human clue giver acts without speaking or meaningful sound. At the same table everyone watches directly. In Remote Live only the current human performer’s camera is transmitted by the built-in call. A bot instead posts a public practice cue describing an answer-related action for the team; there is no bot video or physical acting.

## Round Three — One Word, Fool!

The clue giver submits exactly one whitespace-free clue word. It appears to everyone. They may say only that word; teammates may guess repeatedly. The one-word clue resets for each scroll.

## Between rounds

The complete original bowl is deterministically reshuffled. The team behind in total points starts the next round. If tied, the team that did not empty the previous bowl starts. Clue-giver rotation is maintained per team.

## Winner and sudden death

After round three, the higher team score wins. A tie immediately creates a one-scroll sudden death:

- one anonymous scroll is selected deterministically from the original bowl;
- the team that did not empty round three starts;
- turns last 30 seconds and alternate with the same scroll until guessed;
- there is no pass;
- the first Correct wins the match.

The result screen crowns the entire winning team. It never identifies scroll authors.

## Host authority

The host controls remain in a compact drawer on their phone without replacing their player interface. The host can pause, resume, add 15 seconds, skip the tutorial or intermission, reshuffle or edit teams, lock joining, remove a player, end the game, undo the most recent Correct, and add or subtract individual team points. Undo subtracts one team point, restores that scroll as the current scroll, returns to the originating round/phase (including sudden death), and clears the undo slot. It is intentionally one-level and designed for immediate honor-system correction.

## Same Table

Every phone presents the tutorial, teams, current round rule, active clue giver, synchronized timer, live score, bowl count, drawings, and results. A human clue giver's phone alone reveals the secret scroll and player scoring controls. During a bot turn, the host receives the spoken-guess entry and judgment controls, not the secret. Speaking and human charades happen in the room; no browser media is requested. A shared TV remains an optional mirror, never a requirement.

## Remote Live

Every phone receives the shared game state plus private controls. Bot practice cues are public; bot secret scrolls remain hidden from the host. Built-in media is optional:

- direct peer-to-peer WebRTC mesh;
- Cloudflare’s public STUN endpoint for discovery;
- short-lived, authenticated D1 signaling messages;
- audio from joined players when built-in voice is enabled;
- video track only from the current charades performer;
- per-device Stage, Grid, or Hidden video layout and local mute;
- no recording, transcription, speech recognition, or author metadata;
- no paid TURN dependency and therefore no promise to traverse every restrictive network.

If permission, signaling, or peer connection fails, the UI tells the player to continue through a normal phone/group call. Gameplay remains fully usable and never waits for media.

## Authoritative state machine

`LOBBY → FOOL_TEAM_SETUP → INTRO → ROUND_INTRO → FOOL_WRITING → FOOL_TURN ⇄ FOOL_TURN → FOOL_ROUND_REVEAL → FOOL_TURN … → FINAL_RESULTS → POST_GAME`

A tied third round branches from `FOOL_TURN` to `FOOL_SUDDEN_DEATH`, which alternates until Correct and then enters `FINAL_RESULTS`.

All actions include room version context, expected phase, round ID, and an idempotency ID. The server validates clue-giver ownership, phase, word/count limits, pass availability, drawing bounds, and team membership. Clients render snapshots and never decide scores, turns, secrecy, or winners.

## Replayability and tone

Replayability comes from player-authored content, the second-round format toggle, 1–5 scroll density, team permutations, and the accelerating shared memory of each room. Presentation is all-ages medieval absurdity. The pigeon explains rules and reacts at key moments; it does not participate in scoring or reveal authors.
