# King Prompter Screen-Family Matrix

Fish drawing correction (2026-11-02): tools belong below the full-width canvas, in the same workspace. The lower tray can scroll its colours and secondary settings independently. This supersedes earlier references to an adjacent fish tool rail.

## Interface reconstruction — 2026-11-02

Menus, setup, archives, guides, settings and secondary character controls use natural scrolling. Home exposes Host, Join and secondary destinations directly. The party picker renders the complete catalog under Party Games / Arcade tabs. History Books combines search with one game filter. Do not split continuous content into measured pixel pages or add Next screen to compensate for overflow.

Active play keeps a stable host/phone workspace. The TV remains 16:9 without scrolling; phone tasks keep their prompt, input and primary action together. Long ballots, lobby rosters and accessibility overflow can scroll inside the task area while navigation stays available. Canvas tools must stay beside the canvas: fish drawing has a persistent tool rail and an inline More settings disclosure. Ordinary document menus may scroll with the browser.

`ScrollPanel` handles bounded menu/dialog bodies; `GameMenuGrid` renders every catalog card. Phone sections remain mounted and inert when hidden to retain drafts. Task changes reset internal scroll without moving game authority into the UI. Character preview and save/cancel remain fixed while secondary controls scroll. Exhibition Previous/Next navigates actual artworks, and spellbook chapters remain semantic destinations. External guest sites keep their own interfaces.

Status: approved implementation reference  
Updated: 2026-09-02

This matrix maps the actual `RoomPhase` contract in `lib/contracts.ts` to reusable presentation families. It describes rendering only. `server/engine.ts`, D1 state, authenticated actions, and role-filtered snapshots remain authoritative.

## Role contract

| Role | Presentation responsibility | Prohibited behavior |
| --- | --- | --- |
| Host | Full 16:9 broadcast presentation plus authenticated host-control drawer | Must not infer phase, deadline, score, eligibility, or winners in React |
| Display | Read-only host-shaped 16:9 mirror, with device-local audio opt-in and connection status | No host mutations, player actions, secret data, or room authority |
| Phone/player | Private mobile-first task, ballot, status, and score controller | Must not reveal hidden authorship or decide transitions/results locally |
| Audience | Contract remains dormant/deferred | Do not add audience screens until product and engine support is approved |

## Actual phase-to-template matrix

| Screen family | Actual phase(s) | Host and display template | Phone template | Key states and constraints |
| --- | --- | --- | --- | --- |
| Connect and recovery | Before first snapshot; reconnect; `ENDED` | `CastleShell` + `SystemBanner` | `ControllerShell` + `SystemNotice` | Visible reconnect/error/retry copy; no decorative dependency |
| Lobby | `LOBBY` | Grand Hall `BroadcastHeader`, room code/QR, roster, settings summary, start readiness | Join/identity card, avatar, roster, ready/wait state | Host authority stays in authenticated actions; display hides controls |
| Ceremonial transition | `INTRO`, `ROUND_INTRO` | Room backdrop + `RoundPlacard` + optional `PigeonCue` | Compact `TaskCard` with next-task summary | Pigeon may present; transitions cannot delay authoritative timing |
| Creative response | `ANSWERING`, `FINAL_ANSWERING` | `PromptMarquee`, `TimerSeal`, `ResponseMeter`; previous winning context where required | `TaskCard`, labelled field, validation, submit, `StickyActionBar` | No decorative phone motion; authorship private; keyboard-height safe |
| Structured private choice | `PERSONAL_CHOICE`, `ROOM_PREDICTION`, `AUTHOR_GUESSING`, `FINAL_WAGER` | Prompt/instruction, timer, response progress; no secret choice disclosure | `ChoiceGrid`, allocation/wager control, confirmation | Server validates totals, ownership, and VIP secrets |
| Locked/waiting | `ANSWER_LOCK`, `VOTE_LOCK` | Stage wait card, progress, optional clipboard-wait pigeon | Explicit locked state + eligible `FeedbackDuel`/cooldown | Six feedback cards maximum; +25 each; 150-point ceiling |
| Media processing | `IMAGE_REVEAL`, `ENCORE_IMAGE` | Dimmed room, processing/fallback stage, timer/status | Wait card or authorized media status | Never block completion; image failure becomes concept card |
| Ranked or favorite voting | `VOTING`, `FINAL_VOTING` | `GalleryGrid`, ballot instructions, timer, response meter | `RankedBallot` or single-favorite `ChoiceGrid`/`PhoneGallery` | Ballot shape comes from snapshot; self-vote controls disabled and server-rejected |
| Reveal | `REVEAL` | `RevealDais`, authorship reveal, points, optional reaction pigeon | Selection result, revealed authorship, points | Hidden authorship appears only when snapshot permits |
| Round results | `ROUND_RESULTS` | Winner frame, scores, persistent story/image context | Round placement and score list | Gold/crown only for authoritative winners; ties remain explicit |
| Final results | `FINAL_RESULTS`, `POST_GAME` | `ResultsTapestry`, champions, pack-specific artifact, replay/encore affordance | Champion/score summary and available host/player continuation | Royal Restoration winners and overall score champions are labelled separately |
| Encore contribution | `ENCORE_CONTRIBUTING`, `ENCORE_FOLLOWUP` | Hall of Echoes encore prompt/results frame | Contribution/follow-up `TaskCard` | Reuses normal authenticated action and fallback rules |
| Host controls | Any active phase | `HostControlDrawer` over current family | Solo-only compact host tools when explicitly authorized | Presentation is subordinate; no duplicated client authority |
| Developer overlay | Approved developer solo rooms, any supported phase | Backstage workshop context | Device-local studio overlay plus real underlying screen | Room-scoped authenticated edits only; notes/package remain device-local |
| Bowl tutorial | `BOWL_TUTORIAL` | Royal pigeon + ceremonial-bowl television tutorial | Concise private rules card | Host may skip through the authoritative deadline only |
| Bowl writing | `BOWL_SCROLL_WRITING` | Finished-player count; never scroll text | Configured scroll fields and locked confirmation | Server validates count/words/duplicates and fills missing slots |
| Bowl turn | `BOWL_TURN`, `BOWL_SUDDEN_DEATH` | Teams, clue giver, timer, scores, count, public drawing/word | Active secret only for clue giver; guessing stage otherwise | Author never disclosed; media is non-authoritative |
| Bowl intermission | `BOWL_INTERMISSION` | Scores, next rules, next starter | Bowl-refill wait card | Complete original collection returns deterministically |
| Frame-Up investigation | `MYSTERY_DECOYS`, `MYSTERY_VOTING`, `MYSTERY_REVEAL` | Evidence frame, anonymous files, then staged truth/authorship/Seal/points | Cover story, eligible ballot, then compact case result | Incident truth, authorship, and Royal Seal stay hidden until the snapshot reveals them |
| Rumour chain | `RUMOUR_GUESSING`, `RUMOUR_IMAGE_REVEAL`, `RUMOUR_REVEAL`, `RUMOUR_VOTING` | Press machinery, honest processing, four-step chain, eligible final ballot | Blind interpretation, wait state, reveal, ballot | Contributor identities and chain links remain role-filtered until disclosure |
| War campaign | `WAR_RANKING`, `WAR_COUNCIL`, `WAR_TURN_REVEAL`, `WAR_ROUND_REVEAL` | Physical council board, commander turn, intelligence check, chapter reveal | Private ranking or commander controls | Consensus plan stays server-hidden; Lion/Raven and Attack/Defend use text/shape as well as colour |

## Pack and room ownership

| Product surface or pack | Castle room | Families used |
| --- | --- | --- |
| Intro, main menu, setup entry, lobby, system recovery, host-display join | Grand Hall / Royal Broadcast Stage | connect, lobby, transition, system overlay |
| King Prompter: Canvas One, Canvas Two, Royal Restoration | Royal Prompt Foundry | transition, creative, locked, processing, voting, reveal, round/final results |
| Let's Make a Comic: Setup, Escalation, Punchline | Royal Scriptorium | transition, creative, locked, processing, voting, reveal, round/final results |
| Big 30 birthday pack | Banquet Hall | lobby/setup accent, transition, creative, structured choice, voting, reveal, final results |
| Legacy Standard, Callback, The Remix, Tonight's Lore, encore | Hall of Echoes | transition, creative, structured choice, locked, processing, voting, reveal, results, encore |
| Avatar Studio and pre-join identity selection | Jousting Field / Heraldry Pavilion | identity/editor surface outside `RoomPhase`; flat coded editor |
| Developer Mode and Copy for Chat workflow | Backstage Prop Workshop | developer overlay plus whichever real family is under test |
| Bowl of Fools | Royal Fool’s Court / Ceremonial Bowl | lobby teams, pigeon tutorial, secret writing, timed clue stage, intermission, sudden death, Crown of Fools results |
| The Royal Frame-Up | Royal Evidence Vault | incident writing, evidence processing, anonymous cover stories, verdict, case closure |
| Royal Rumours | Royal Rumour Press | whisper, image, blind interpretation, second image, chain reveal, final ballot |
| Royal War Room | Royal War Room council chamber | private ranking, council command, intelligence checks, campaign reveal/results |

## Mode-specific use of shared families

### King Prompter

Each canvas uses creative response → overlapping media processing → single-favorite image voting → reveal/results. There is no prompt-voting stage. Royal Restoration assigns every player one deterministic torn-paper slot around the unchanged King, then uses one single-favorite ballot for the contributed sections. Every gallery keeps generated art neutral and prominent, and tied winners remain explicit.

### Let's Make a Comic

Each of the three panels uses creative response → image processing/fallback → ranked image voting → reveal/results. There is no prompt-vote family between writing and image voting. Previously locked panels remain visible as context in a stable three-panel folio.

### Big 30

The Banquet Hall skins the shared creative, private-choice, prediction, author-guessing, voting, reveal, and result families. VIP answers and private choices remain phone/private-snapshot concerns until the authoritative reveal.

### Legacy Standard

The Hall of Echoes skins the seven-round authoritative plan and results. Memory nodes and relationship visuals render only the winning/tied-winning lore disclosed by snapshots. “CALLBACK” may label the internal round or legacy mechanic; the public umbrella remains King Prompter.

## Main-menu family

The main menu is outside `RoomPhase` but follows the same role/accessibility rules. It preserves press-to-start audio, intro, delayed skip, crossfade, menu return, host-display join, and fallback behavior. Its textless media remains beneath these visible HTML actions in fixed DOM order:

1. Start Game
2. Join Game
3. Bowl of Fools
4. Royal War Room
5. Royal Rumours
6. The Royal Frame-Up
7. Comic
8. Birthday
9. Arcade
10. Party Games
11. How to Play
12. Avatar Studio
13. History Books
14. Settings
15. Join Host Display

The reduced-motion, poster, and media-error versions expose the identical action set and DOM order.

Party Games opens `/party-games`, a public guest-pack launcher outside the King Prompter room lifecycle. Doot and Joystick Jammers launch in separate tabs and use their own QR codes, rooms, controls and scoring. King Prompter's existing room and Arcade flows remain separate.

## Shared session screens — 2026-10-13

The entry title and existing intro lead to a host/player choice. Session host selection shows a stable code, QR and roster before a game exists. Session phone waiting shows membership and hosted character editing. Active views frame the existing role-specific game surfaces; New Game returns the whole session to selection. Generic player entry includes user-initiated QR scanning and a manual code fallback. These navigation screens do not introduce engine phases.
