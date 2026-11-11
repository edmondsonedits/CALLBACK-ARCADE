# King Prompter Visual System

## Navigation correction — 2026-11-02

Use natural scrolling for menus and documents. Never turn one form, filter list or instruction into numbered viewport slices. Keep active gameplay, drawing canvases and their core controls in a stable workspace; use compact layouts and bounded accessibility overflow for long content. Fish tools stay alongside their canvas. Character preview and save actions remain visible while secondary options can scroll. Back returns to the same menu hierarchy. Preserve focus, touch targets, reduced motion, safe areas and readable text.

Simple phone menus should fit the available viewport through concise copy and compact framing. Do not create a small avoidable overflow or hide content to force a fit. Longer lists, expanded help, enlarged text and keyboard recovery may scroll naturally. Room scanning belongs to the phone camera; the website join form only needs the room code. Face capture and photo upload are explicit separate actions.

Status: approved production specification  
Updated: 2026-08-27

This document is authoritative for King Prompter art direction, presentation layout, coded UI styling, motion, media, and visual accessibility. It does not change game rules. When a visual proposal conflicts with the authoritative engine, role-filtered snapshots, accessibility requirements, or `SCREEN_FAMILIES.md`, those constraints win.

## 1. Creative premise and brand hierarchy

**King Prompter is a live royal variety show broadcast from an absurd enchanted castle. Every game pack occupies a different castle room. A theatrical pigeon is the master of ceremonies, and the crown is the show's global emblem.**

CALLBACK is the shared platform identity, approved 2026-10-13. The title screen, role choice, shared lobby and character editor use CALLBACK. King Prompter remains an individual game; existing game-specific art and names remain intact.

The presentation combines:

- painterly, cinematic castle environments on the shared host display;
- clean, real HTML/CSS interfaces above those environments;
- flat, fast, low-animation phone controllers;
- warm theatrical comedy rather than grim fantasy or generic mobile-game gloss;
- generated player artwork as the visual focus whenever it is present.

Functional text, buttons, timers, scores, room codes, focus states, and form controls must never be baked into background art or video.

## 2. Design tokens

### 2.1 Core colours

| Token | Value | Primary role |
| --- | --- | --- |
| `--kp-night` | `#101A3B` | Default host background, dark panels, primary brand field |
| `--kp-night-soft` | `#172451` | Raised dark surfaces and secondary navy fields |
| `--kp-night-deep` | `#070D25` | Vignette, deepest stage depth, modal surround |
| `--kp-parchment` | `#FFF4D6` | Default light card and readable copy surface |
| `--kp-parchment-high` | `#FFF9E8` | Highest light surface and input field |
| `--kp-cyan` | `#46DBDC` | AI magic, active information, focus and progress |
| `--kp-gold` | `#FFD84B` | Crown, victory, primary celebration and progression |
| `--kp-coral` | `#FF6F61` | Urgency, comic impact, warning and wax-seal detail |
| `--kp-purple` | `#9C7CFF` | Memory, mystery, legacy and secondary magic |
| `--kp-ink` | `#111A39` | Text and outlines on light or bright surfaces |
| `--kp-copy-muted` | `#5C6070` | Secondary copy on parchment only |
| `--kp-border-muted` | `#D8CEB6` | Quiet dividers and disabled light-surface borders |

### 2.2 Permitted text combinations

These approved pairs meet or exceed WCAG AA for normal text.

| Foreground | Background | Contrast |
| --- | --- | ---: |
| `--kp-parchment` | `--kp-night` | 15.54:1 |
| `--kp-cyan` | `--kp-night` | 10.08:1 |
| `--kp-gold` | `--kp-night` | 12.31:1 |
| `--kp-coral` | `--kp-night` | 6.24:1 |
| `--kp-purple` | `--kp-night` | 5.47:1 |
| `--kp-ink` | `--kp-parchment` | 15.57:1 |
| `--kp-ink` | `--kp-cyan` | 10.10:1 |
| `--kp-ink` | `--kp-gold` | 12.33:1 |
| `--kp-ink` | `--kp-coral` | 6.26:1 |
| `--kp-ink` | `--kp-purple` | 5.48:1 |

Use `--kp-ink` or `--kp-copy-muted` for normal text on parchment. Do not use cyan, gold, coral, or purple as normal text on parchment, and do not place parchment text directly on a bright accent. Colour must never be the sole indicator of selection, winner, error, readiness, eligibility, or phase.

### 2.3 Room accents

| Room | Primary accents |
| --- | --- |
| Grand Hall | gold and cyan |
| Royal Prompt Foundry | cyan and coral |
| Royal Scriptorium | parchment and ink with purple |
| Banquet Hall | coral and gold |
| Hall of Echoes | purple and cyan |
| Jousting Field | gold and coral with cyan heraldry details |
| Backstage Prop Workshop | coral and cyan |

Room accents identify a location; they do not replace semantic colours or alter the base contrast rules.

## 3. Typography

Use the bundled variable fonts only. The user-requested medieval update (2026-11-02) adds **Cinzel** for short Grand Hall and Sketch & Sorcery headings, spellbook chapters and heraldic labels. Keep instructions, scores, timers and inputs in the existing readable fonts. Cinzel is served locally with its OFL license and a Georgia fallback; no remote font request is needed.

- **Fredoka:** public wordmark, display titles, round titles, primary buttons, player names, scores, timers, comic panel labels, and short celebratory copy.
- **Space Grotesk:** instructions, body copy, forms, captions, settings, errors, metadata, and dense utility information.

The current Fredoka asset supports weights 300–700. Never request synthetic 800, 900, or 950. Use weight 700 plus outline, scale, spacing, or shadow for stronger display emphasis. Avoid all-caps paragraphs. All-caps is limited to short labels with increased letter spacing.

### Host scale

| Role | Size |
| --- | --- |
| Cinematic title | `clamp(4rem, 8vw, 8rem)` |
| Primary prompt | `clamp(2.4rem, 4.8vw, 5.4rem)` |
| Round title | `clamp(3rem, 6vw, 6.5rem)` |
| Result winner | `clamp(3.4rem, 7vw, 7.5rem)` |
| Section title | `clamp(1.6rem, 2.7vw, 2.8rem)` |
| Body | `clamp(1rem, 1.35vw, 1.35rem)` |
| Metadata | `0.75rem–0.9rem` |
| Timer | `clamp(3.5rem, 8vw, 7rem)` |

### Phone scale

| Role | Size |
| --- | --- |
| Primary task | `clamp(2rem, 9.2vw, 3.35rem)` |
| Section title | `1.4rem–1.8rem` |
| Button, body, input | `1rem` minimum |
| Label | `0.78rem–0.9rem` |
| Ancillary copy | `0.75rem` minimum |
| Room code | `clamp(2.5rem, 15vw, 4.5rem)` |

Display copy must fit at supported host sizes without scrolling. Phone text may reflow naturally and must survive 200% zoom without lost controls or clipped content.

## 4. Geometry and elevation

### Spacing

Use the spacing sequence `4, 8, 12, 16, 24, 32, 48, 64, 96px`. Prefer 16px phone gutters, 24px large-phone gutters, and fluid host gutters that preserve the live safe area.

### Outlines

- 2px: phone cards and controls.
- 3px: standard host panels.
- 4px: hero cards, generated-image frames, and major stage pieces.
- 5px: urgent states, champion frames, and winner seals only.

Outlines use `--kp-ink` on light/bright surfaces and parchment or an approved accent on dark surfaces. Avoid hairline borders on a TV.

### Corners

- 8px: compact utility controls.
- 12px: inputs and small cards.
- 16px: standard cards and buttons.
- 24px: hero panels and phone task surfaces.
- 40px: major theatrical placards.
- 999px: pills, status chips, and avatar circles.

### Shadows

Use hard theatrical shadows instead of diffuse glassmorphism:

- phone: `4px 5px 0`;
- host: `8px 10px 0`;
- host hero: `12px 14px 0`.

Soft shadows are reserved for environmental depth and media, never as the only boundary around interactive controls.

## 5. Materials, lighting, and depth

Approved materials are velvet curtains, clean parchment, painted wood, royal gold, cyan magic glass, purple memory magic, and coral wax/warning details. Keep tactile noise in the environment; live UI surfaces remain clean enough for instant reading.

Host lighting uses a warm top-centre theatrical key, a cool cyan or purple rim, and a navy edge vignette. Gold and parchment may receive a local warm highlight. Background contrast and saturation must be reduced underneath live UI. Generated artwork receives the brightest, most neutral presentation light.

Every host composition follows this depth stack:

1. painterly backdrop;
2. slow ambient atmosphere;
3. edge-biased set dressing;
4. readability scrim;
5. live HTML interface;
6. pigeon and nonessential effects;
7. system overlays, focus, captions, and errors.

Do not flatten these layers into one raster image. System overlays must remain legible even if all decorative media fails.

## 6. Live-HTML safe areas

Coordinate percentages are measured from the visible 16:9 host viewport.

- Source masters: at least 2560×1440 when practical.
- Final video delivery: at least 1920×1080.
- Still variants: 1280×720, 1920×1080, and 2560×1440.
- Overscan protection: 5% on every edge.
- Header band: top 8%.
- Primary live UI: x 6–94%, y 9–94%.
- Central quiet zone: x 16–84%, y 14–84%.
- Pigeon/set-piece bays: x 2–19% or 81–98%, y 18–82%.
- Result/action band: y 82–96%.

No baked lettering, face, bright torch, high-contrast prop, or essential focal point may compete with the central quiet zone. Backgrounds must support safe `cover` cropping at 16:9 and include declared focal points in `ASSET_MANIFEST.json`.

## 7. Host, display, and phone behavior

### Shared host

The host is a theatrical 16:9 broadcast surface and must not require scrolling. It may use painterly rooms, restrained ambient loops, strong typographic hierarchy, narration captions, and the full phase presentation. Host controls remain a subordinate drawer or overlay and must not look like player actions.

### Secondary display

The secondary display renders the same presentation template as the host from its read-only host-shaped snapshot. It may initialize its own local audio after a user gesture, but it never shows host mutations, player controls, secrets, or authority. Its LIVE/RECONNECTING state stays visually quiet but readable.

### Phone controller

Phones use a navy header, parchment task surface, one mode accent, and at most a small static room motif. Do not put a full painterly environment behind forms, answer text, rankings, or voting choices. Remove decorative movement during writing and voting. Controls must be mobile-first, thumb reachable, safe-area aware, and at least 48px in their primary dimension.

Use a sticky action area only when it does not obscure fields or choices. Keyboard-height layouts must preserve the current task, input, validation, and submit action. Locked, waiting, cooldown, reconnecting, and completed states must be textually explicit.

## 8. Connecting painterly environments to coded UI

The environment supplies place, mood, and depth. The coded interface supplies information, interaction, and authority.

- Functional text is always HTML.
- Light cards are 94–100% opaque parchment.
- Dark prompt panels are at least 88% opaque navy.
- Form controls contain no painterly texture.
- Major cards use ink outlines and hard shadows so they read as physical show placards.
- High-detail props remain near the edges and outside declared quiet zones.
- A scrim may be local to a panel rather than dimming the whole room.
- Generated images are never tinted, colourized, textured, or placed below translucent ornamental copy.

During generated-image galleries and reveals:

- dim environmental luminance by 20–30%;
- pause or greatly slow ambient movement;
- move the pigeon out of the image field or hold a static edge pose;
- use neutral navy/parchment image frames;
- reserve gold framing for an actual winner;
- keep prompts, eligibility labels, ranking controls, and authorship states outside the image pixels.

## 9. Castle rooms

### Grand Hall / Royal Broadcast Stage

**Uses:** press-to-start, intro handoff, main menu, room setup entry, lobby, shared system states, public errors, and host-display joining.  
**Motifs:** velvet curtains, broadcast spotlight, royal signage, stage machinery, balcony silhouettes, gold/cyan trim.  
**Constraint:** the animated menu background is textless; all actions are real visible HTML.

### Royal Prompt Foundry

**Uses:** King Prompter Canvas One, Canvas Two, image generation, image voting, Royal Restoration, and results.
**Motifs:** AI-Dramatron machinery, easels, cyan magic glass, coral warning plates, paper prompt chutes, gold winner frames.  
**Constraint:** machinery frames the gallery without becoming brighter than player artwork.

### Royal Scriptorium

**Uses:** Let's Make a Comic setup, escalation, punchline, panel voting, strip reveal, and results.  
**Motifs:** illuminated manuscripts, a three-panel folio, quills, ink, purple binding, margin creatures.  
**Constraint:** the locked comic panels remain the central continuity device.

### Banquet Hall

**Uses:** Big 30 setup, Birthday Bets, all birthday rounds, awards, and final celebration.  
**Motifs:** banners, cake, candles, gifts, banquet portraits, coral/gold confetti.  
**Constraint:** personalized HTML names and questions never appear in environment art.

### Hall of Echoes

**Uses:** Legacy Standard, Callback, The Remix, Tonight's Lore, and optional encore presentation. The current selector label remains **Legacy Standard**.  
**Motifs:** memory tapestries, archive shelves, purple relationship threads, cyan echoes, rewind wheels, glowing lore frames.  
**Constraint:** only winning or tied-winning established memories appear as active room lore.

### Jousting Field / Heraldry Pavilion

**Uses:** Avatar Studio and identity selection before joining.  
**Motifs:** daylight tournament field, heraldic flags, painted shields, contestant pennants, dressing pavilion, gold/coral accents with cyan selection highlights.  
**Constraint:** the avatar editor remains a flat coded tool; the field is a restrained header/edge context, not a busy form background.

### Backstage Prop Workshop

**Uses:** Developer Mode launch, room-scoped tuning studio, device-local observations, and Copy for Chat package.  
**Motifs:** rigging, cue lights, prop shelves, pinned notes, budget board, test placards, the “Everything Is Fine” machine.  
**Constraint:** temporary developer edits remain clearly distinct from permanent source content.

## 10. Main-menu information architecture

Preserve the existing press-to-start audio gate, intro playback, delayed skip control, crossfade into the verified textless menu loop, direct `/?menu=1` return, host-display joining, and accessible fallback. Render every control visibly in HTML.

DOM and keyboard order is fixed:

1. **Start Game** — `/host/new`
2. **Join Game** — `/play`
3. **Bowl of Fools** — `/host/new?game=bowl-of-fools`
4. **Royal War Room** — `/host/new?game=royal-war-room`
5. **Royal Rumours** — `/host/new?game=royal-rumours`
6. **Royal Frame-Up** — `/host/new?game=king-mystery`
7. **Comic** — `/host/new?game=comic`
8. **Birthday** — `/birthday/new`
9. **Arcade** — `/arcade`
10. **Party Games** — `/party-games`
11. **How to Play** — `/how-to-play`
12. **Avatar Studio** — `/avatar-studio`
13. **History Books** — `/history-books`
14. **Settings** — device-local overlay
15. **Join Host Display** — four-character code form

Start Game and Join Game are the primary pair. The existing game packs, Arcade and Party Games are featured actions. How to Play, Avatar Studio, History Books and Settings are secondary exploration actions. Join Host Display is a utility panel, not a player join substitute. Party Games is a guest-pack launcher with real external links; it does not share King Prompter room codes or scores.

Settings may contain menu sound, volume, motion preference (`system`, `default`, or `reduced`), and Replay Intro. Gameplay settings remain in room setup. The poster, missing-video, and reduced-motion fallbacks must expose the same complete live menu; there is no reduced “backup navigation.” On phones, Start and Join remain first and Join Game remains immediately visible in a one-column layout.

## 11. Pigeon system

The pigeon is an overconfident, earnest master of ceremonies who becomes comically overwhelmed, is proud of the show, and is protective of the crown. It presents the game but never acts as gameplay authority.

### Canonical appearance

- rounded grey silhouette readable at 48px;
- navy wing tips and cream chest;
- coral beak and feet;
- ink eyes and facial marks;
- navy/purple theatrical host garment;
- gold crown only when the phase meaningfully calls for it.

### Approved semantic state family

Idle, blink, look-left, look-right, talk, laugh, confused, smug, shocked, annoyed, panic, celebrate, point-left, point-right, hold-crown, drop-crown, fly-in, fly-out, land, bow, inspect-card, timer-warning, and technical-recovery. Runtime states map only to reviewed static poses or controlled animation; server or generated text never emits animation code.

### Presentation rules

- Keep the pigeon available as the recurring host/display actor during transitions, waits, warnings, reactions, reveals, and results.
- Use no more than one pigeon on an ordinary screen; flocks are reserved for the intro or finale.
- Freeze or greatly reduce it during writing and voting; remove it during dense galleries or whenever its safe bay is occupied.
- It must never react to or point at a specific anonymous entry before authorship is revealed.
- Stop its motion during writing and ranked voting.
- Never cover prompts, timers, scores, room codes, QR codes, captions, choices, or generated art.
- Decorative instances use `aria-hidden="true"`. Any meaningful status it conveys must also appear as text.

## 12. Crown system

The crown is one canonical five-point SVG with a tall centre point, purple centre diamond, royal-gold body, navy outline, and restrained coral/cyan jewels. It must remain recognizable at 16px. Unicode crowns are fallback glyphs only and must not replace the canonical asset in approved UI.

Approved states are brand, candidate, advancing, crowned image, overall player champion, tie, and disabled. Labels must distinguish a crowned image from the overall score champion. Crown motion and gold emphasis never silently imply points or eligibility before the authoritative result is available.

## 13. Motion and audio-adjacent presentation

### Timing tokens

- instant response: 80ms;
- control transition: 160ms;
- standard UI transition: 240ms;
- stage transition: 420ms;
- major reveal: 700ms;
- ceremonial beat: 1200ms.

Use `cubic-bezier(.2, .8, .2, 1)` for standard motion, `cubic-bezier(.4, 0, 1, 1)` for exits, and `cubic-bezier(.2, 1.25, .4, 1)` only for small mascot reactions.

- Ambient room loops: 12–18 seconds and visually subtle.
- Pigeon reaction: under 1.2 seconds.
- Pigeon idle interval: 6–10 seconds, never continuous twitching.
- Countdown pulse: last 10 seconds only, maximum scale 1.04.
- Never flash more than three times per second.
- No decorative loop near phone writing or voting controls.
- Transitions cannot conceal an authoritative deadline, locked state, or error.

The existing host audio system remains browser-local presentation. Visual and audio cues consume the same deduplicated presentation events without moving timing or phase authority into the client. Approved audio-facing names include `stage.ready`, `round.sting`, `timer.ten`, `response.lock`, `vote.lock`, `gallery.open`, `image.retry`, `image.fallback`, `reveal.anticipation`, `reveal.impact`, `score.tick`, `winner.crown`, `winner.tie`, `finale.fanfare`, `connection.lost`, and `connection.restored`.

### Reduced motion

With `prefers-reduced-motion: reduce` or the device-local reduced setting:

- retain the explicit press-to-start gate required for audio;
- show the static final menu poster instead of playing intro/menu video;
- reveal the menu immediately after the gate;
- disable parallax, ambient video, confetti travel, bouncing, pulsing, and sliding panels;
- use static pigeon poses;
- use short opacity changes or immediate state changes;
- preserve all gameplay timing unless the separate extended-timers accessibility setting is enabled.

## 14. Media production and fallbacks

### Video

- Delivery: minimum 1920×1080; 2560×1440 source master where practical.
- Frame rate: 24fps unless source motion requires otherwise.
- Encode: H.264 video, AAC audio, `yuv420p`, fast start.
- Quality target: CRF 18–20 and 192kbps audio.
- Intro target size: under 20MB.
- Menu loop target size: under 15MB.
- Every video requires a representative poster frame.
- Menu-loop backgrounds contain no text or controls and must tolerate a seamless repeat.

### Stills and transparent assets

- Painterly backdrops: AVIF and WebP responsive variants at 2560×1440, 1920×1080, and 1280×720; target roughly 250–450KB at 1080p and remain below 800KB at 1440p.
- Backdrops contain no baked functional text and declare crop-safe focal points.
- Pigeon poses: transparent WebP with PNG fallback.
- Crown and core interface icons: SVG.
- Do not use animated WebP for core interaction or state communication.

### Deterministic fallback hierarchy

- Video → poster → CSS gradient/frame → complete live HTML.
- Generated image → deterministic concept card → visible text prompt.
- Animated pigeon → static pose → no pigeon.
- Decorative room art → base navy/parchment coded shell.

Gameplay, joining, voting, results, settings, and recovery must never wait for decorative media.

## 15. Accessibility requirements

- Meet WCAG 2.2 AA contrast for text, controls, focus indicators, and meaningful graphics.
- Use semantic headings, labels, field instructions, live regions, and button names.
- Preserve visible keyboard focus on every interactive element.
- Maintain a logical DOM order matching the visual order.
- Provide text equivalents for sound, motion, mascot reactions, and colour-coded states.
- Keep captions clear of controls and generated artwork.
- Respect safe-area insets, 200% text zoom, keyboard-height phone layouts, and supported host viewports.
- Never require drag, hover, fine pointer control, rapid repeated input, or motion interpretation.
- Preserve mute, per-device audio initiation, reduced motion, and extended timers.
- Do not auto-focus in a way that opens a phone keyboard unexpectedly or steals focus during phase changes.
- Errors must identify the problem and recovery action in text.
- Images require useful alt text when informational; decorative environments and mascot art use empty alt text or `aria-hidden`.

## 16. Reusable coded presentation templates

Host/display primitives should converge on: `CastleShell`, `BroadcastHeader`, `RoomBackdrop`, `StageScrim`, `RoundPlacard`, `PromptMarquee`, `TimerSeal`, `ResponseMeter`, `GalleryGrid`, `RevealDais`, `ResultsTapestry`, `PigeonCue`, `SystemBanner`, and `HostControlDrawer`.

Phone primitives should converge on: `ControllerShell`, `PhonePhaseHeader`, `TaskCard`, `ChoiceGrid`, `RankedBallot`, `StickyActionBar`, `FeedbackDuel`, `PhoneGallery`, `ScoreList`, and `SystemNotice`.

These names define intended visual responsibilities, not a mandate to rewrite working runtime components. Introduce or consolidate them only through reviewed implementation work that preserves current snapshots, actions, and tests.

## 17. Approval and change control

The system above is approved. New assets begin as `specification-approved` and `not-created` in `ASSET_MANIFEST.json`; an asset is not production-approved until it has been reviewed in its real host/phone context, including fallback and reduced-motion states.

Any change to core tokens, room ownership, crown silhouette, pigeon silhouette, menu action hierarchy, minimum media resolution, safe areas, or accessibility rules requires explicit design approval. Routine asset variants may proceed within this system after their master is approved.

## 18. Implemented presentation architecture — 2026-09-02

Role-filtered snapshots pass through pure `derivePresentationEvents(previous, next)` interpretation before reaching `PresentationDirector`. Event keys combine state version, semantic type, and subject; first loads resume without replay, stale snapshots emit nothing, skipped polling phases render the newest state immediately, and phone tasks never wait for host choreography.

The shipped host/display stack uses `CastleRoom`, `StageTransition`, `BroadcastHeader`, `PigeonHost`, `PlayerRail`, `StageTimer`, `ResponseMeter`, `ScoreReveal`, the canonical `Crown`, and one bounded particle layer. Motion for React is loaded through `LazyMotion`, `domAnimation`, and `m`; ambient actors remain CSS/WAAPI-style transform/opacity motion. Every decorative sequence is reduced-motion safe and every room retains a coded navy/parchment fallback.

The canonical pigeon master and its reviewed pose derivatives are transparent WebP with PNG fallback. The eight pack environments are responsive AVIF/WebP review assets. The 1920×1080 cinematic intro is a plan-driven H.264/AAC production asset; the previous 864×496 intro is retained only as a source-history fallback.
