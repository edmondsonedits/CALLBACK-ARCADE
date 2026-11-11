# The King Prompter Bible

Product, game, art, interface, accessibility, and production reference  
Status: approved living documentation  
Updated: 2026-08-30

## What this document is

This is the human-readable source of truth for King Prompter. It explains what the product is, how its games work, how it should look and feel, what must never change accidentally, and how future work should fit the existing system.

Use this Bible for product, creative, design, writing, asset, and implementation decisions. The engine, role-filtered snapshots, current configuration, and tests remain authoritative for exact runtime behavior. If older notes conflict with current code or tests, current runtime truth wins.

Supporting references:

- [`VISUAL_SYSTEM.md`](./VISUAL_SYSTEM.md) — exact visual and accessibility specification.
- [`SCREEN_FAMILIES.md`](./SCREEN_FAMILIES.md) — real phase-to-screen map.
- [`ASSET_MANIFEST.json`](./ASSET_MANIFEST.json) — structured planned-asset inventory.
- [`GAME_DESIGN.md`](./GAME_DESIGN.md) — detailed game-design contract.
- [`KING_PROMPTER.md`](./KING_PROMPTER.md) — primary pack rules.
- [`BOWL_OF_FOOLS.md`](./BOWL_OF_FOOLS.md) — complete Fishbowl-inspired team-memory mode contract.
- [`THE_ROYAL_FRAME_UP.md`](./THE_ROYAL_FRAME_UP.md) — bluff-and-investigate case-file mode, including exact privacy, Royal Seal, scoring, failure, and acceptance contracts.
- [`ROUND_SYSTEM.md`](./ROUND_SYSTEM.md) — phase, scoring, and round responsibilities.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — server and data boundaries.
- [`TESTING.md`](./TESTING.md) — verification record and release matrix.
- [`GRAND_HALL_IMPLEMENTATION_PLAN.md`](./GRAND_HALL_IMPLEMENTATION_PLAN.md) — approved menu implementation plan.

## 1. The product

**King Prompter is a live royal variety show broadcast from an absurd enchanted castle. Every game pack occupies a different castle location. A theatrical pigeon is the master of ceremonies, and the crown is the show's global emblem.**

Players gather around one shared host display and use their phones as private controllers. The TV is theatrical, cinematic, and readable across a room. Phones are fast, flat, practical, and built for touch.

King Prompter is the public umbrella identity. `CALLBACK` may remain an internal architecture term and the name of a Legacy Standard mechanic, but it must not compete with the public King Prompter brand.

The defining qualities are:

- room-made comedy rather than passive content consumption;
- a theatrical host presentation with practical phone controls;
- multiple game packs that feel like rooms within one castle;
- generated imagery that supports play but never controls rules or scoring;
- deterministic fallbacks that keep every game finishable;
- accessible controls and presentation treated as core product behavior.

## 2. Current product truth

- Normal rooms support **2–10 active seats**.
- Solo Playtest Mode supports **one human plus two to five deterministic bots**.
- The public game selectors are **Royal War Room**, **Royal Rumours**, **The Royal Frame-Up**, **King Prompter**, **Let's Make a Comic**, and **Legacy Standard**.
- Royal War Room is the no-image social-ranking campaign: every player ranks six castle orders, rival councils reconstruct the hidden room consensus, and Play Again strictly alternates invasion with defence. `ROYAL_WAR_ROOM.md` is its authoritative rebuild specification.
- Royal Rumours is the AI picture-telephone mode: secret rumour → confirmed AI painting → another player's blind interpretation → confirmed AI painting → full chain reveal and contributor-safe final vote. `ROYAL_RUMOURS.md` is its authoritative rebuild specification.
- The **Big 30** birthday pack has a separate route and setup.
- **Legacy Quick**, **Legacy Extended**, and **Question Cards** are retired.
- Secondary host displays are read-only mirrors of the authenticated host presentation.
- Avatar Studio and Developer Mode already exist.
- Host audio and narration are generated locally in the host browser and require a device gesture.
- AI and generated images are optional backstage systems. Provider failure cannot stop a match.
- The server and D1 database—not React—decide phases, deadlines, eligibility, votes, scores, jobs, and winners.

## 3. The castle

The castle creates one coherent public world while allowing each pack to have its own visual identity.

### Grand Hall / Royal Broadcast Stage

The public entrance to King Prompter.

Used for:

- press-to-start;
- cinematic introduction;
- main menu;
- room-setup entry;
- lobby;
- public recovery and error states;
- Join Host Display.

Visual motifs: navy velvet curtains, warm spotlight, gold/cyan royal broadcast trim, stage machinery, signs, and balcony silhouettes.

### Royal Prompt Foundry

Home of King Prompter's image-prompt competition.

Used for Canvas One, Canvas Two, image production, image voting, Royal Restoration, and results.

Visual motifs: the AI-Dramatron, easels, prompt chutes, cyan magic glass, coral warning plates, and gold winner frames.

### Royal Scriptorium

Home of Let's Make a Comic.

Used for Setup, Escalation, Punchline, image voting, the connected strip, and results.

Visual motifs: illuminated manuscripts, a three-panel folio, quills, ink, purple bindings, and marginal creatures.

### Banquet Hall

Home of the Big 30 birthday pack.

Used for Birthday Bets, creative rounds, predictions, author guessing, awards, and the final celebration.

Visual motifs: banners, cake, candles, presents, banquet portraits, and coral/gold celebration details.

### Hall of Echoes

Home of Legacy Standard and the castle's shared memories.

Used for The Seed, Read the Room, Make It Real, The Catch, Crowd Control, Callback, The Remix, Tonight's Lore, and optional encore presentation.

Visual motifs: memory tapestries, archive shelves, purple relationship threads, cyan echoes, rewind wheels, and glowing lore frames.

The selector continues to say **Legacy Standard**. Only winning and tied-winning established memories may appear as active Room Lore.

### Jousting Field / Heraldry Pavilion

Home of Avatar Studio and pre-join identity selection.

Visual motifs: tournament flags, painted shields, contestant pennants, daylight, a dressing pavilion, and cyan selection details.

The editor itself remains a clean coded surface. The environment provides context around it, not behind dense controls.

### Backstage Prop Workshop

Home of Developer Mode.

Used for isolated solo testing, temporary room-scoped tuning, playtest notes, and Copy for Chat packages.

Visual motifs: rigging, cue lights, prop shelves, pinned notes, a budget board, and the “Everything Is Fine” machine.

## 4. Game packs

### Bowl of Fools

Bowl of Fools is the four-to-ten-human ceremonial-bowl game. Team Bells and Team Motley contribute permanently anonymous 1–5-word scrolls, then guess the same collection through Speak, Draw/Perform, and One Word rounds. It supports Same Table and Remote Live, optional best-effort peer-to-peer voice/current-performer video, fair team clue rotation, host undo, and one-scroll sudden death. It has no solo/bot path and never reveals scroll authors. The full rebuild specification is in `BOWL_OF_FOOLS.md`.

### King Prompter

King Prompter is the primary image-prompt pack.

#### Match flow

1. **Canvas One:** the King gives one shared all-ages request and every player has 120 seconds to submit a visual prompt under 20 words.
2. **Optional poll:** early finishers may choose Canvas Two's request from exactly three curated options.
3. **Overlapping image work:** Canvas One generates during Canvas Two writing; Canvas Two generates during Canvas One voting. Every failed image receives a concept-card fallback.
4. **Canvas ballots:** every prompt remains beside its image. Players choose one eligible favorite and cannot vote for themselves. Received votes are worth 100 points on Canvas One and 150 on Canvas Two.
5. **Royal Restoration:** every player fills one deterministic torn-paper slot around an unchanged King, producing one shared collage.
6. **Final vote:** each eligible player chooses one restored section, never their own. Every received Royal Seal is worth 300 points.
7. **Results:** score totals determine the overall champion, tied winners remain co-winners, and the complete restored portrait remains visible.

If a canvas or Royal Restoration ballot has tied leaders, every tied leader remains recorded. Submission speed does not break the tie.

#### Main ballot values

| Ballot | Points per received favorite vote |
| --- | ---: |
| Canvas One | 100 |
| Canvas Two | 150 |
| Royal Restoration | 300 |

#### Waiting feedback

After an eligible answer or ballot locks, a phone may offer a two-option direction card. Each player receives six cards per match from a larger mode-specific bank.

- 25 points per completed card;
- ten-second server cooldown;
- one response per card;
- 150-point maximum per match.

Feedback may influence future prompt launchpads, themes, and art direction. It never decides current winners, phases, eligibility, or scores beyond its fixed 25-point event.

### Let's Make a Comic

The room builds one connected three-panel comic:

1. **Setup:** create the star.
2. **Escalation:** give the star a new problem.
3. **Punchline:** show the final joke.

Every under-20-word submission becomes an image or concept card. The mode goes directly from writing to image voting; it has no separate prompt ballot. Earlier winning panels remain visible as context.

| Panel | First | Second | Third |
| --- | ---: | ---: | ---: |
| Setup | 300 | 200 | 100 |
| Escalation | 500 | 300 | 150 |
| Punchline | 1,000 | 600 | 300 |

Ties remain explicit while stable deterministic selection fills the one physical panel space.

### Big 30 birthday pack

The birthday route creates a seven-round personalized pack around a supplied first name and one Birthday VIP.

It includes:

- Birthday Bets;
- The Biopic;
- Who Wrote It?;
- Thirty Words or Less;
- Most Likely To;
- Future Message;
- final awards and celebration.

The VIP's private answer remains server-side until reveal. Birthday mode is deterministic and does not require generated images. In solo mode, the human automatically becomes the Birthday VIP.

### Legacy Standard

Legacy Standard is the castle's story-building game. Winning creative answers form a relationship graph:

1. **The Seed** creates the Anchor.
2. **Read the Room** adds a social prediction round.
3. **Make It Real** reveals the Anchor image and creates its Voice.
4. **The Catch** creates the World under a mechanical writing constraint.
5. **Crowd Control** adds social prediction and prepares the callback.
6. **Callback** collides the Anchor, Voice, and World; its winner becomes the Consequence.
7. **The Remix** creates a final answer from the four connected story slots.
8. **Tonight's Lore** reveals champions, awards, memories, and relationships.

Only winning and tied-winning creative answers become active Room Lore. Social rounds never create memories. The graph preserves Anchor → Voice → World → Consequence meaning through explicit relationships rather than a flat list.

## 5. Roles and screens

### Host

The authenticated host owns room-control actions and receives a full 16:9 presentation. The host UI may request actions but cannot decide their results locally.

### Secondary display

A secondary display receives a read-only host-shaped snapshot. It may show presentation audio after its own user gesture. It never exposes host mutations or private player controls.

### Phone player

The phone is a private controller. It shows only the player's eligible task, choices, vote order, locked state, results, and authorized developer tools in developer solo rooms.

### Audience

Audience support remains dormant/deferred. Do not design or expose audience screens until the product and engine contract is deliberately expanded.

### Reusable screen families

The real phase contract maps into these presentation families:

| Family | Runtime phases |
| --- | --- |
| Connect and recovery | before snapshot, reconnect, `ENDED` |
| Lobby | `LOBBY` |
| Ceremonial transition | `INTRO`, `ROUND_INTRO` |
| Creative response | `ANSWERING`, `FINAL_ANSWERING` |
| Structured private choice | `PERSONAL_CHOICE`, `ROOM_PREDICTION`, `AUTHOR_GUESSING`, `FINAL_WAGER` |
| Locked and waiting | `ANSWER_LOCK`, `VOTE_LOCK` |
| Media processing | `IMAGE_REVEAL`, `ENCORE_IMAGE` |
| Voting | `VOTING`, `FINAL_VOTING` |
| Reveal | `REVEAL` |
| Round results | `ROUND_RESULTS` |
| Final results | `FINAL_RESULTS`, `POST_GAME` |
| Encore | `ENCORE_CONTRIBUTING`, `ENCORE_FOLLOWUP` |

## 6. Art direction

The host display uses painterly environments with clean coded interfaces. Phones use flatter, quieter surfaces. The art is theatrical and comedic, not grim fantasy, photorealism, or generic mobile-game neon.

### Core colours

| Token | Value | Role |
| --- | --- | --- |
| `--kp-night` | `#101A3B` | Primary navy field |
| `--kp-night-soft` | `#172451` | Raised dark surface |
| `--kp-night-deep` | `#070D25` | Vignette and deepest depth |
| `--kp-parchment` | `#FFF4D6` | Main light surface |
| `--kp-parchment-high` | `#FFF9E8` | Highest light surface |
| `--kp-cyan` | `#46DBDC` | AI magic, focus, information |
| `--kp-gold` | `#FFD84B` | Crown, victory, progression |
| `--kp-coral` | `#FF6F61` | Urgency and comic impact |
| `--kp-purple` | `#9C7CFF` | Memory and mystery |
| `--kp-ink` | `#111A39` | Text/outlines on light surfaces |
| `--kp-copy-muted` | `#5C6070` | Secondary parchment copy |
| `--kp-border-muted` | `#D8CEB6` | Quiet borders |

Approved high-contrast text combinations are parchment, cyan, gold, coral, or purple on night; and ink on parchment, cyan, gold, coral, or purple. Bright accents are not normal text colours on parchment. Colour is never the only state indicator.

### Typography

- **Fredoka:** wordmark, display titles, buttons, player names, scores, timers, and short celebratory copy.
- **Space Grotesk:** body copy, instructions, forms, settings, captions, errors, and metadata.

The bundled Fredoka files support weights 300–700. Do not request synthetic 800, 900, or 950. Use scale, outline, spacing, and hard shadow for stronger emphasis.

### Shape language

- Spacing: 4, 8, 12, 16, 24, 32, 48, 64, and 96px.
- Borders: 2px phone, 3px host, 4px hero/image, and 5px winner/urgent.
- Corners: 8, 12, 16, 24, 40, and 999px.
- Shadows: hard `4×5px` phone, `8×10px` host, and `12×14px` hero shadows.

Approved materials are velvet, clean parchment, painted wood, royal gold, cyan magic glass, purple memory magic, and coral wax/warning details.

## 7. Host and phone presentation

### Host depth order

1. Painterly backdrop.
2. Slow ambient atmosphere.
3. Edge-biased set dressing.
4. Readability scrim.
5. Live HTML interface.
6. Pigeon and nonessential effects.
7. System overlays, focus, captions, and errors.

Functional text, buttons, timers, room codes, scores, and form controls are always live HTML. They are never baked into background images or video.

Host cards are 92–100% opaque. Dark prompt panels are at least 88% navy; light cards are at least 94% parchment. Painterly texture never appears inside a form control.

### Host safe areas

- 5% overscan protection.
- Primary UI: x 6–94%, y 9–94%.
- Central quiet zone: x 16–84%, y 14–84%.
- Pigeon bays: x 2–19% or 81–98%, y 18–82%.
- Result/action band: y 82–96%.

### Phones

Phones use a navy header, parchment task surface, one mode accent, and at most a small static room motif.

- No full painterly environment behind interactive content.
- No decorative movement during writing or voting.
- Primary controls are at least 48px.
- Inputs remain at least 16px to avoid unwanted zoom.
- Keyboard-height layouts keep the task, validation, and submit action reachable.
- Locked, waiting, reconnecting, cooldown, and complete states are explicit in text.

### Generated images

Generated player art is never tinted or textured. During galleries and reveals:

- dim the environment by 20–30%;
- pause or greatly slow ambient movement;
- move the pigeon out of the image field;
- use neutral navy/parchment frames;
- reserve gold for an authoritative winner;
- keep labels, choices, scores, and prompts outside image pixels.

## 8. Main menu and introduction

Preserve:

- press-to-start audio initialization;
- the short cinematic introduction structure;
- Skip Intro after 3.5 seconds;
- the 1.2-second crossfade into the menu;
- seamless menu ambience;
- direct `/?menu=1` return;
- Join Host Display;
- complete accessible media fallbacks.

The menu background is textless. Its controls are visible HTML in this fixed order:

1. Start Game
2. Join Game
3. Royal War Room
4. Royal Rumours
5. The Royal Frame-Up
6. Comic
7. Birthday
8. How to Play
9. Avatar Studio
10. History Books
11. Settings
12. Join Host Display

Settings are device-local and limited to sound, volume, motion preference, and Replay Intro. Gameplay options remain in room setup.

The current Grand Hall menu loop is a verified textless 1920×1080 H.264/AAC asset. The cinematic introduction is a verified 1920×1080 H.264/AAC asset with a static-poster/reduced-motion fallback. The retired 864×496 intro is retained only under source history and the legacy title loop is not referenced by live routes.

The completed implementation order was:

1. Establish tests for the complete menu-action contract.
2. Add approved CSS tokens and the coded Grand Hall fallback.
3. Build one semantic live menu.
4. Harden gate/intro/menu state and media failures.
5. Implement real reduced motion.
6. Approve the coded composition.
7. Produce the poster, textless loop, and 1080p intro.
8. Run the complete release matrix and remove obsolete hotspots.

## 9. Pigeon

The pigeon is overconfident, earnest, proud of the show, protective of the crown, and comically overwhelmed when production goes wrong. It is a presenter, never gameplay authority.

Canonical appearance:

- rounded grey silhouette readable at 48px;
- navy wing tips;
- cream chest;
- coral beak and feet;
- ink eyes;
- navy/purple host garment;
- gold crown only when appropriate.

Approved poses are neutral, present-left, present-right, thinking, panic, clipboard-wait, reveal, crown-presentation, victory, and technical-recovery.

Rules:

- no more than one pigeon on an ordinary screen;
- flocks only in an intro or finale;
- persistently available on host/display screens, while allowed to leave any dense or unsafe composition;
- static or nearly still during writing and ranked voting;
- no reaction to a specific anonymous entry before reveal;
- never cover prompts, choices, timers, scores, QR codes, captions, or generated art;
- decorative instances are hidden from assistive technology;
- meaningful status always has a text equivalent.

## 10. Crown

The crown is one canonical five-point SVG:

- tall centre point;
- gold body;
- navy outline;
- purple centre diamond;
- restrained coral and cyan jewels;
- readable at 16px.

Approved states are brand, candidate, advancing, crowned image, player champion, tie, and disabled. A crowned image must never be confused with the overall score champion. Unicode crowns are fallback glyphs only.

## 11. Motion, media, and fallback

### Motion timing

- 80ms instant response.
- 160ms control transition.
- 240ms standard interface transition.
- 420ms stage transition.
- 700ms major reveal.
- 1200ms ceremonial beat.

Ambient loops run 12–18 seconds. Pigeon reactions remain under 1.2 seconds. Countdown pulsing begins only in the final ten seconds and never exceeds scale 1.04. Nothing flashes more than three times per second.

### Reduced motion

Reduced motion retains the explicit audio gate, then shows a static poster or coded stage with the menu immediately. It disables intro/loop video, parallax, bouncing, pulsing, moving confetti, and sliding panels. Gameplay timing remains unchanged unless extended timers are separately enabled.

### Media delivery

- Minimum final video: 1920×1080.
- Preferred source master: 2560×1440.
- H.264 video, AAC audio, `yuv420p`, fast start.
- 24fps unless source motion requires otherwise.
- CRF 18–20 and 192kbps audio.
- Intro target: under 20MB.
- Menu loop target: under 15MB.
- Every video has a representative poster.
- Painterly stills use responsive AVIF/WebP variants.
- Pigeon poses use transparent WebP with PNG fallback.
- Crown and core icons use SVG.

### Fallback hierarchy

- Video → poster → coded Grand Hall → complete live HTML.
- Generated image → concept card → visible prompt text.
- Animated pigeon → static pigeon → no pigeon.
- Painterly room → base navy/parchment coded shell.

Nothing important waits for decorative media.

## 12. Accessibility

King Prompter targets WCAG 2.2 AA.

Non-negotiable requirements:

- visible keyboard focus;
- semantic headings, labels, buttons, forms, and live regions;
- logical DOM order matching visual order;
- contrast-compliant text, controls, and focus indicators;
- text equivalents for sound, colour, motion, and mascot reactions;
- captions clear of controls and player artwork;
- 200% text zoom without lost functionality;
- no drag-only, hover-only, fine-pointer, or rapid-input requirement;
- safe-area support;
- reduced motion, mute, local audio initiation, and extended timers;
- useful alt text for informational images and empty alt text for decoration;
- errors that state both the problem and recovery action.

## 13. Technical and gameplay boundaries

- D1 and the server own all authoritative game state.
- Clients render snapshots and request typed actions.
- Clients do not decide winners, points, deadlines, eligibility, or phase changes.
- Hidden authorship and assignments stay out of snapshots until reveal.
- Every score mutation comes from a uniquely keyed score event.
- Mutations use optimistic version checks and idempotent action IDs.
- Client identity, ownership, timestamps, and AI output are untrusted.
- Solo bots use the same authoritative round structures as human players.
- Bots do not enqueue paid work unless the explicit live-image solo setting authorizes the normal image path.
- Generated content never decides scores, winners, identities, phases, or eligibility.
- Provider, R2, media, or connection failure always has a finishable fallback.

## 14. Asset governance

Every planned asset has a stable ID in `ASSET_MANIFEST.json`. The manifest records:

- castle room;
- screen families;
- purpose;
- source dimensions;
- delivery formats;
- transparency;
- safe areas;
- focal points;
- responsive variants;
- fallback;
- specification and production status.

`specification-approved` means the asset brief is approved. It does not mean the asset exists. An asset reaches `production-approved` only after review in its real layout, including responsive crops, fallback behavior, and reduced motion.

Produce assets in controlled families rather than uncontrolled batches. Review the coded interface before commissioning a background so the art is built around proven safe areas.

## 15. Approval gates

Future visual work should stop at these points for review:

1. Coded information architecture and responsive layout.
2. Master room poster/background.
3. Motion or seamless-loop behavior.
4. Intro-to-room handoff.
5. Pigeon or crown master system.
6. Accessibility and deterministic fallback states.
7. Full release candidate in real host and phone viewports.

## 16. Verification state

Grand Hall Checkpoint A was implemented and verified on 2026-08-27. The homepage now has one visible semantic menu, an explicit gate → intro → menu state machine, device-local presentation settings, media-independent navigation, and a genuine reduced-motion route that skips both videos after the retained gate.

Verification passes lint, typecheck, 42 discovered unit checks (41 pass and the opt-in local D1 vertical-slice check skipped without a configured base URL), two rendered-HTML checks, three focused menu/viewport Playwright scenarios, and the production build. Review captures exist at 1366×768, 1920×1080, 2560×1440, 390×844, and 375×450.

Checkpoint B Candidate A is production-approved: a textless painterly Grand Hall poster integrated beneath the semantic menu, with AVIF/WebP desktop and phone variants plus the coded-stage fallback. Checkpoint C has a 1080p textless loop under review. The 2026-09-02 presentation release adds the 1080p cinematic intro, responsive pack-room families, transparent canonical pigeon poses, the coded five-point crown, shared presentation events, and the full CastleRoom host/display system.

## 17. Documentation policy

This Bible is the best entry point for people. Supporting documents hold exact specialist detail. Avoid copying the same mutable number into many places when a link is clearer.

Update this Bible when any of the following changes:

- public identity or premise;
- active game-pack list;
- player-count contract;
- game flow or scoring;
- castle-room ownership;
- core tokens, typography, mascot, or crown;
- menu information architecture;
- accessibility requirements;
- media delivery minimums;
- authority or failure boundaries.

Historical entries in `STATUS.md` remain dated records. New entries supersede old behavior without rewriting history.
# Bowl of Fools mode

The complete, build-authoritative specification for Bowl of Fools lives in `BOWL_OF_FOOLS.md`. It defines the medieval fiction, setup controls, anonymous data contract, three-round shared-bowl loop, drawing and charades variants, Same Table and Remote Live behavior, host undo, sudden death, privacy rules, failure fallbacks, and server-authoritative state machine. That document takes precedence for this mode.
