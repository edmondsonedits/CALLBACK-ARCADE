# Grand Hall and Main-Menu Implementation Plan

Status: implementation-ready, runtime not yet changed  
Updated: 2026-08-27  
Scope: Grand Hall entry sequence, corrected main menu, device-local menu settings, media fallbacks, reduced motion, and associated tests

## 1. Purpose and authority

This document is the durable handoff for the King Prompter visual audit, approved art system, screen-family system, and the smallest safe implementation path for the Grand Hall and main menu. It compiles the decisions and repository findings established during the current design and product-truth review.

Read these sources in this order before implementation:

1. `STATUS.md` for current product state.
2. `VISUAL_SYSTEM.md` for approved art, typography, layout, motion, accessibility, room, mascot, crown, media, and menu rules.
3. `SCREEN_FAMILIES.md` for the real phase-to-host/display/phone presentation map.
4. `ASSET_MANIFEST.json` for planned asset IDs, formats, safe areas, focal points, fallbacks, and approval status.
5. `AGENTS.md`, `GAME_DESIGN.md`, `ARCHITECTURE.md`, and `TESTING.md` for authority, security, gameplay, and release constraints.
6. The engine, contracts, role-filtered snapshots, current UI, configuration, and tests whenever older prose disagrees.

This plan does not authorize changes to game rules, server authority, scoring, phases, room creation, snapshots, AI behavior, generated-image behavior, or player eligibility.

## 2. Product truth that must remain intact

- King Prompter is the public umbrella identity. `CALLBACK` remains an internal architecture and Legacy Standard mechanic term only.
- Normal rooms support 2–10 active seats. Solo Playtest Mode uses one human plus two to five deterministic bots.
- The currently supported selectors are King Prompter, Let's Make a Comic, and Legacy Standard. The Big 30 birthday route remains separate.
- Legacy Quick, Legacy Extended, and Question Cards are retired and rejected at room creation.
- King Prompter uses two canvases followed by a two-image Crown Gallery with one eligible favorite per voter.
- Each player receives six rotating feedback cards worth 25 points each, for a 150-point ceiling.
- The server and D1 remain authoritative for phases, deadlines, actions, eligibility, authorship, scores, winners, jobs, and persistence.
- Secondary host displays are read-only host-shaped mirrors. They may initialize local audio after a gesture but cannot mutate gameplay.
- Host gameplay is a no-scroll 16:9 presentation. Phones remain mobile-first, keyboard-safe, safe-area aware, and low animation.
- Every gameplay and menu path must remain usable when video, audio, generated images, providers, storage, or a connection fails.

## 3. Approved creative direction

King Prompter is a live royal variety show broadcast from an absurd enchanted castle. Each game pack occupies a different castle location. The pigeon is a theatrical master of ceremonies used for transitions, waits, warnings, reactions, reveals, and results rather than as a permanent onscreen figure. The five-point crown is the global brand, progression, and victory emblem.

The shared display combines cinematic painterly environments with clean coded HTML/CSS interfaces. Phone surfaces remain flat, practical, and low animation. Generated player artwork receives visual priority over environment art.

Approved locations are:

| Surface | Castle location |
| --- | --- |
| Entry, intro handoff, menu, setup entry, lobby, system recovery, host-display join | Grand Hall / Royal Broadcast Stage |
| King Prompter | Royal Prompt Foundry |
| Let's Make a Comic | Royal Scriptorium |
| Big 30 | Banquet Hall |
| Legacy Standard, Tonight's Lore, encore | Hall of Echoes |
| Avatar Studio and identity selection | Jousting Field / Heraldry Pavilion |
| Developer Mode | Backstage Prop Workshop |

## 4. Current Grand Hall implementation audit

### 4.1 `app/components/TVIntroMenu.tsx`

The component currently preserves several valuable behaviors:

- an explicit full-screen press-to-start control that supplies the browser gesture needed for sound;
- intro playback with audio at 50%;
- a Skip Intro control after 3.5 seconds;
- a crossfade beginning about 1.2 seconds before the intro ends;
- a seamless looping menu video;
- direct menu return through `/?menu=1`;
- a four-character Join Host Display form;
- media-error state and a basic fallback menu.

The current menu architecture is not suitable for the approved system:

- six transparent absolute-positioned hotspots are aligned to words baked into `title-loop.mp4`;
- hotspot labels are visually clipped and only become visible to assistive technology;
- there is no Join Game action;
- Settings incorrectly links to `/host/new` instead of opening device-local menu settings;
- labels differ from the approved names (`Let's Make a Comic` and `Birthday Mode` instead of `Comic` and `Birthday`);
- the Join Host Display form sits outside the menu's defined action order;
- the media-error fallback exposes only Start Game, Comic, Birthday, and Join Host Display;
- the single `mediaUnavailable` flag cannot distinguish an intro failure from a loop failure;
- `startExperience` can leave the user at the gate when video refs are unavailable;
- the menu becomes visible only after loop playback succeeds, coupling navigation to decorative media;
- both videos preload automatically before the user's gesture;
- volume is hard-coded rather than driven by a device-local preference;
- reduced motion removes CSS transition duration but still plays both videos.

### 4.2 `app/page.tsx`

The homepage currently passes a full static landing page into `TVIntroMenu`, then visually clips it through `.tv-accessible-content`. This creates a second set of navigation and product content in the accessibility tree while the video hotspot menu is also present.

Additional drift in that hidden landing content includes:

- `3–10 players` rather than the current 2–10 active seats;
- the Comic feature link points to `/host/new` instead of `/host/new?game=comic`;
- the static landing and video menu compete as two different homepage information architectures.

The approved live HTML menu makes this hidden duplicate unnecessary. Metadata can remain in `page.tsx`; concise product copy can live visibly inside the Grand Hall menu.

### 4.3 `app/globals.css`

The core palette already matches most approved colours through legacy names, but the complete `--kp-*` token system is not yet declared. The menu CSS is explicitly built around transparent hotspots and percentage coordinates tied to the old video.

Current issues include:

- `.tv-hotspot-layer` and six per-button coordinate rules;
- menu controls with clipped visible text;
- hard-coded colours and geometry instead of approved aliases and tokens;
- synthetic font weights such as 850 and 950 in touched menu styles, despite bundled variable fonts ending at 700;
- a translucent blurred utility form rather than the approved clean coded placard treatment;
- media fallback styles with a separate, incomplete navigation;
- mobile display-join controls dropping below the 48px primary-control target;
- a reduced-motion rule that only removes transitions;
- a globally clipped `.tv-accessible-content` containing duplicate homepage content.

### 4.4 Current media

| File | Duration | Dimensions | Audio | Size | Assessment |
| --- | ---: | ---: | --- | ---: | --- |
| `public/intro.mp4` | 15.07s | 864×496 | yes | 6,944,307 bytes | Preserves the approved story and behavior, but is below the 1080p delivery minimum and ends in the old baked menu language. |
| `public/title-loop.mp4` | 13.89s | 1280×720 | yes | 7,663,273 bytes | Fully decoded and seam-verified, but below 1080p and contains the old six-item menu and wordmark as pixels. |

The loop project uses 24fps, H.264, AAC at 192kbps, `yuv420p`, CRF 18, fast start, and a 1.25-second audio/video dissolve. Its technical seam is sound. Its content is not suitable behind the corrected live controls.

No approved 1080p textless menu loop or responsive poster currently exists. The present loop must not be shown behind the new live menu because doing so would duplicate and contradict the controls.

### 4.5 Relevant tests

`tests/callback.browser.spec.ts` currently opens `/` and expects the clipped static heading “Write it. Generate it.” to be visible before the intro is started. That assertion describes the superseded hidden landing implementation and has recently prevented the saved browser run from being treated as current green evidence.

`tests/rendered-html.test.mjs` checks for old landing-page copy rather than the approved live menu contract. Existing browser coverage does not directly assert:

- the eight-action order;
- unique accessible names with no duplicate hidden navigation;
- Settings behavior and persistence;
- direct `/?menu=1` return;
- media-error fallback parity;
- reduced-motion static behavior;
- Skip Intro timing and transition;
- keyboard order;
- host-display validation from the unified menu.

## 5. Target menu contract

The Grand Hall background is decorative. The menu is one semantic live HTML interface rendered independently of video success.

The fixed DOM and keyboard order is:

1. **Start Game** — `/host/new`
2. **Join Game** — `/play`
3. **Comic** — `/host/new?game=comic`
4. **Birthday** — `/birthday/new`
5. **How to Play** — `/how-to-play`
6. **Avatar Studio** — `/avatar-studio`
7. **Settings** — opens a device-local dialog
8. **Join Host Display** — labelled four-character code form

Information hierarchy:

- Start Game and Join Game are the dominant primary pair.
- Comic and Birthday are featured pack actions.
- How to Play, Avatar Studio, and Settings are secondary actions.
- Join Host Display is a clearly separated utility action, not a substitute for Join Game.

The visible composition should remain inside the Grand Hall primary safe area (x 6–94%, y 9–94%) and keep its most important content within the central quiet zone (x 16–84%, y 14–84%). A live King Prompter wordmark, short show premise, and the controls may occupy the centre. High-detail background props remain at the edges.

At narrow widths, the menu becomes one column. Start Game and Join Game remain first, Join Game remains visible without opening another panel, and primary controls are at least 48px high. The main menu may scroll vertically on genuinely phone-sized or keyboard-height viewports; 16:9 host viewports must not scroll.

## 6. Minimal reusable component boundary

Avoid a broad homepage or navigation rewrite. Use three focused responsibilities:

### `TVIntroMenu`

Retain this as the entry-sequence orchestrator. It owns:

- gate, intro, crossfade, menu, and media-fallback state;
- intro and loop refs;
- media play/pause/volume synchronization;
- `/?menu=1` handling;
- effective motion preference;
- the handoff to the live menu.

Replace loosely coupled booleans with one explicit presentation state:

```ts
type EntryStage = "gate" | "intro" | "menu";
```

Track intro and loop availability separately. A failed loop must not imply a failed intro, and neither failure may hide or disable the menu.

### `GrandHallMenu`

Create a presentational component for the single canonical menu DOM. It owns:

- live wordmark and concise premise;
- primary, featured, and secondary action groups;
- the Settings button;
- the Join Host Display form as the eighth action;
- visible labels, semantic grouping, and responsive layout.

It receives settings state and callbacks as props. It does not own gameplay, video playback, routing authority, or room state.

### `MenuSettingsDialog`

Create a device-local settings dialog using native `<dialog>` behavior where supported. It owns:

- sound on/off;
- volume;
- motion choice: system, default, or reduced;
- Replay Intro;
- close/Escape behavior and initial focus.

It must not contain gameplay timers, content mode, family-friendly settings, image models, bot settings, or room configuration. Those remain in room setup.

The Join Host Display validation may remain within `GrandHallMenu` for the smallest change. Extract a shared form only if the existing `/display` entry is deliberately consolidated in a separate reviewed task.

## 7. Device-local settings contract

Use a versioned, narrowly scoped local-storage record such as:

```ts
type MenuPreferencesV1 = {
  version: 1;
  soundEnabled: boolean;
  volume: number; // clamp to 0–1
  motion: "system" | "default" | "reduced";
};
```

Recommended defaults are sound enabled, volume `0.5`, and motion `system`. Parse stored data defensively and fall back to defaults for malformed, missing, or future versions. Do not store room codes, sessions, player identity, or gameplay settings.

The press-to-start gate remains the event that initializes audible playback. Changing volume updates both video elements and any menu ambience immediately. Sound off uses the media mute state as well as zero effective volume. A failed attempt to play audio leaves the visible menu functional and provides a clear local sound control rather than switching to an incomplete fallback menu.

Effective motion behavior:

- `system`: follow `prefers-reduced-motion`;
- `default`: use the approved normal Grand Hall motion after the user explicitly selects it;
- `reduced`: use the static poster/CSS shell and immediate menu transition.

An explicit menu-scoped `data-motion` attribute is preferable to changing global gameplay motion behavior.

## 8. CSS-token work

Add the approved tokens without breaking existing consumers. Initially alias legacy names to the approved system:

```css
:root {
  --kp-night: #101a3b;
  --kp-night-soft: #172451;
  --kp-night-deep: #070d25;
  --kp-parchment: #fff4d6;
  --kp-parchment-high: #fff9e8;
  --kp-cyan: #46dbdc;
  --kp-gold: #ffd84b;
  --kp-coral: #ff6f61;
  --kp-purple: #9c7cff;
  --kp-ink: #111a39;
  --kp-copy-muted: #5c6070;
  --kp-border-muted: #d8ceb6;

  --navy: var(--kp-night);
  --navy-soft: var(--kp-night-soft);
  --cream: var(--kp-parchment);
  --cyan: var(--kp-cyan);
  --yellow: var(--kp-gold);
  --coral: var(--kp-coral);
  --purple: var(--kp-purple);
  --ink: var(--kp-ink);
}
```

Add only the tokens used by this implementation: approved spacing values, 3px/4px host outlines, 16px/24px/40px radii, host and hero hard shadows, and 80/160/240/420/700/1200ms motion timings. Do not attempt a whole-application CSS migration in this milestone.

New Grand Hall CSS should:

- replace `.tv-hotspot-layer`, `.tv-hotspot`, and six coordinate classes;
- render 92–100% opaque coded panels over a local navy scrim;
- use Fredoka for wordmark, action labels, and short headings, capped at weight 700;
- use Space Grotesk for descriptions, field labels, validation, and settings, capped at the bundled weight range;
- use approved ink outlines, hard shadows, corners, and focus indicators;
- keep the environment behind the controls rather than inside them;
- provide an unanimated CSS Grand Hall shell before any new media exists;
- preserve a no-scroll 16:9 host composition and a one-column phone layout;
- support `data-motion="reduced"` and the system preference without altering gameplay timers.

## 9. Media and loading plan

### Required production media

Before the animated Grand Hall background is enabled, produce and approve:

1. `media.menu.poster`
   - textless Grand Hall / Royal Broadcast Stage;
   - 2560×1440 source where practical;
   - AVIF and WebP at 2560×1440, 1920×1080, and 1280×720;
   - clean central quiet zone and edge-biased props;
   - no baked wordmark, buttons, labels, room codes, or settings icon.

2. `media.menu.loop-background`
   - textless seamless Grand Hall ambience;
   - minimum 1920×1080 delivery, preferably from a 2560×1440 master;
   - 24fps H.264/AAC, `yuv420p`, fast start, CRF 18–20, 192kbps audio;
   - under 15MB where quality permits;
   - restrained 12–18 second ambient motion;
   - same crop-safe composition as the poster.

3. `media.intro.cinematic`
   - preserve typing → AI processing → royal pigeon → crown fight → comic explosion → Grand Hall handoff;
   - minimum 1920×1080 delivery;
   - remove or recut the old baked menu ending so the final transition lands on a textless stage;
   - preserve the user-started audio behavior and Skip Intro affordance;
   - under 20MB where quality permits.

### Loading behavior

- The CSS Grand Hall shell and live menu are the baseline, not an error-only branch.
- Render the poster below video whenever an approved poster is available.
- Do not preload both full videos before the user gesture. Metadata may load initially; begin buffering the loop when the user starts the intro, providing roughly 15 seconds before handoff.
- Menu visibility is controlled by `EntryStage`, never by the resolution of `video.play()`.
- Begin the 1.2-second handoff near the approved intro endpoint, but reveal the live controls independently of loop success.
- Keep the current loop only as a rollback/reference file. Do not layer it behind the new controls.

## 10. Deterministic fallback behavior

Use one canonical live menu in every branch.

### Normal motion and all media available

Gate → intro → optional Skip Intro → 1.2-second crossfade → textless loop + live menu.

### Intro unavailable

Gate supplies the audio gesture, then transition immediately to poster or CSS Grand Hall + live menu. If loop playback succeeds, it may replace the poster. Report no blocking error unless audio itself requires another gesture.

### Loop unavailable or playback rejected

Show poster or CSS Grand Hall + live menu immediately. Do not switch to a smaller fallback navigation and do not hide Settings or Join Game.

### Poster unavailable

Use the coded navy Grand Hall gradient/frame + live menu.

### Reduced motion

Retain the explicit gate. After it is activated, show the static poster or CSS Grand Hall and the live menu immediately. Do not play intro or loop video, parallax, confetti travel, pulsing, bouncing, or sliding panels. Replay Intro must respect the active reduced setting; it may return to the static gate/menu state but must not silently play motion.

### Direct `/?menu=1` return

Show the live menu immediately. Attempt background media only when allowed by the effective motion and browser playback policy. A rejected audio/video promise affects ambience, not navigation.

### JavaScript or hydration failure

Include a concise `<noscript>` menu with Start Game, Join Game, Comic, Birthday, How to Play, Avatar Studio, and Join Host Display entry. Settings is intentionally unavailable without JavaScript because it is device-local interactive state. The normal hydrated page must never expose this as duplicate navigation.

## 11. Smallest safe implementation sequence

### Step 0 — Freeze the behavioral baseline

- Record the current media facts, route targets, Skip Intro delay, crossfade timing, direct-menu query, and host-display validation.
- Confirm the working tree and preserve unrelated `.logs` images and attachments.
- Do not change server, engine, database, snapshots, room setup, or gameplay tests.

**Exit:** implementation branch knows exactly which existing behaviors must survive.

### Step 1 — Add contract tests for the corrected menu

- Replace the obsolete browser assertion that expects the hidden landing heading before start.
- Add static assertions for the eight action names/routes and absence of hotspot classes.
- Add browser coverage through `/?menu=1` so menu tests do not wait through the 15-second intro.
- Make exact action order, uniqueness, visible labels, keyboard order, and Join Host Display validation explicit.

**Exit:** tests fail for the current hotspot implementation for the intended reasons.

### Step 2 — Add the token bridge and coded Grand Hall fallback

- Declare approved `--kp-*` colour aliases and the small set of menu geometry/motion tokens.
- Build the CSS-only Grand Hall stage and readability scrim.
- Do not show the old textful loop behind the target menu.

**Exit:** a usable visual baseline exists without new art or video.

### Step 3 — Introduce the canonical live menu

- Add `GrandHallMenu` with the exact action order and route targets.
- Preserve the existing host-display normalization and validation behavior.
- Add `MenuSettingsDialog` with validated device-local preferences.
- Simplify `app/page.tsx` so it renders one canonical homepage/menu instead of a second clipped landing site.
- Remove the hidden hotspot navigation and the incomplete fallback navigation only after the live menu is present in every media state.

**Exit:** the full menu is visible, semantic, keyboard operable, and independent of decorative media.

### Step 4 — Harden the entry state machine

- Convert gate/intro/menu presentation to explicit state.
- Split intro and loop availability.
- Decouple menu reveal from media promise success.
- Apply settings volume/mute values to both media elements.
- Preserve the 3.5-second Skip Intro control and 1.2-second handoff.
- Preserve direct `/?menu=1` return.

**Exit:** all media failures reach the same complete menu without trapping the user.

### Step 5 — Implement reduced motion correctly

- Resolve system/default/reduced device preference.
- Skip both videos under effective reduced motion.
- Use poster/CSS shell and immediate menu reveal after the gate.
- Remove decorative movement while preserving focus, settings, routes, and gameplay timer behavior.

**Exit:** reduced motion is a first-class presentation path, not a shorter transition duration.

### Step 6 — Review the coded menu before media production

- Capture 1366×768, 1920×1080, 2560×1440, 390×844, and 375×450 views using the CSS fallback.
- Review hierarchy, safe areas, no-scroll host behavior, one-column phone behavior, focus order, dialog behavior, and utility-form clarity.
- Correct layout in code before commissioning the background, so art is built around proven quiet zones.

**Exit:** coded composition receives visual/accessibility approval.

### Step 7 — Produce and integrate approved media

- Produce poster first, then textless loop, then the 1080p intro/handoff.
- Update `ASSET_MANIFEST.json` with real paths, dimensions, hashes, focal points, responsive variants, review notes, and production approval status.
- Validate full decode, start/end seam, audio seam, cover crops, poster match, load size, and the 1.2-second intro handoff.

**Exit:** media is production-approved and can replace the CSS background without changing menu DOM or behavior.

### Step 8 — Release verification and cleanup

- Run lint, typecheck, unit tests, rendered HTML tests, focused browser tests, full browser matrix, and production build.
- Inspect console/network behavior with media available, blocked, missing, and reduced.
- Remove obsolete hotspot CSS and old hidden landing CSS only after repository search proves they are unused.
- Retain old source media outside the live path until the reviewed release is stable and rollback is documented.

**Exit:** one complete accessible menu works across normal media, direct return, reduced motion, and every fallback.

## 12. Test-change matrix

| Test area | Required assertion |
| --- | --- |
| Static/rendered source | Exact action names and routes exist; no transparent hotspot menu; Fredoka requests no touched weight above 700; reduced-motion branch exists. |
| Initial gate | “Press anywhere to begin” is visible and keyboard operable; menu is not accidentally duplicated in the active accessibility tree. |
| Normal intro | User gesture starts intro audio; Skip Intro appears after 3.5 seconds; natural end and Skip both reach menu. |
| Direct return | `/?menu=1` shows the complete menu immediately without replaying the intro. |
| Menu IA | Exactly one visible Start, Join, Comic, Birthday, How to Play, Avatar Studio, Settings, and Join Host Display action appears in the fixed order. |
| Routes | Start `/host/new`; Join `/play`; Comic `/host/new?game=comic`; Birthday `/birthday/new`; How `/how-to-play`; Avatar `/avatar-studio`. |
| Settings | Dialog has name, close behavior, focus management, sound, volume, motion, Replay Intro; valid preferences persist; malformed storage falls back safely. |
| Host display | Input accepts only the existing unambiguous four-character alphabet; invalid length reports a labelled alert; valid code targets `/display/{CODE}`. |
| Media failure | Abort intro, loop, and poster separately; every case retains the same complete menu and working routes. |
| Play rejection | Stub rejected `HTMLMediaElement.play()`; menu still appears and local sound recovery remains available. |
| Reduced motion | Emulate system reduction and select device-local reduction; videos remain unplayed, menu appears after gate, no decorative animation runs. |
| Viewports | Host 1366×768, 1920×1080, 2560×1440 has no scroll; phone 390×844 is one column; 375×450 keeps Join Game and current focus/action reachable; no horizontal overflow. |
| Keyboard | Tab order matches the approved eight actions, focus is visible, Settings traps/restores focus, Escape closes the dialog. |
| Accessibility | No baked functional text dependency; unique roles/names; labels and error descriptions connected; decorative media `aria-hidden`; contrast uses approved pairs. |
| Regression | Host setup, player join, birthday setup, display join, and game return through `/?menu=1` still work. |

Do not weaken unrelated tests to land the visual change. Update assertions only where they encode the deliberately retired hidden-landing/hotspot architecture.

## 13. Approval checkpoints

### Checkpoint A — Coded information architecture

Review the CSS-fallback menu before any media is generated. Approve hierarchy, exact labels, grouping, safe-area use, host/phone layout, visible focus, Settings scope, and Join Host Display placement.

**Status, 2026-08-27:** implemented, verified, and awaiting approval. Review evidence is saved at 1366×768, 1920×1080, 2560×1440, 390×844, and 375×450. No artwork, video, audio, pigeon, or canonical crown asset was generated or edited.

### Checkpoint B — Grand Hall poster

Approve the textless painterly room at desktop and phone crops with the real coded menu over it. Reject any bright prop, face, lettering, or focal point that competes with controls.

**Status, 2026-08-27:** Candidate A is integrated, explicitly production-approved, and recorded as `production-approved` in the manifest. Candidate B remains a retained alternate. Five integrated viewport captures and both native concept files remain available as approval evidence.

### Checkpoint C — Textless loop

Approve normal frames, seam frames, motion intensity, audio ambience, file size, and reduced-motion poster match. The loop must remain decorative with controls disabled in the video itself.

**Status, 2026-08-27:** Stage Breath is the selected Checkpoint C review delivery, derived only from the production-approved Candidate A poster. The 1920×1080, 24fps H.264/AAC loop is 1.531MB, fast-start enabled, completely decoded, and validated for visual seam, audio seam, poster match, and the five approved cover crops. Curtain Drift is retained as the slightly more active comparison. Runtime integration preserves the static poster, CSS fallback, live HTML controls, media-independent navigation, and reduced-motion poster path. Production approval remains pending explicit Checkpoint C review.

### Checkpoint D — Intro handoff

Approve the preserved story, 1080p quality, Skip behavior, final textless stage, 1.2-second transition, and audio crossfade.

### Checkpoint E — Accessibility and fallback review

Approve keyboard order, screen-reader names, focus restoration, contrast, reduced motion, video rejection, missing-media behavior, and phone keyboard-height layouts.

### Checkpoint F — Release candidate

Approve the complete automated matrix and screenshots before the old hotspot path is removed from rollback consideration.

## 14. File-level implementation map

| File | Planned responsibility |
| --- | --- |
| `app/components/TVIntroMenu.tsx` | Explicit gate/intro/menu orchestration, separate media failures, preference application, direct-menu handling, crossfade preservation. |
| `app/components/GrandHallMenu.tsx` | New canonical visible menu and Join Host Display utility. |
| `app/components/MenuSettingsDialog.tsx` | New device-local sound, volume, motion, and Replay Intro dialog. |
| `app/page.tsx` | Remove duplicate clipped landing architecture; retain metadata and render the canonical entry/menu. |
| `app/globals.css` | Approved token bridge, Grand Hall live menu, responsive layout, focus, dialog, poster/CSS fallback, reduced-motion rules; delete hotspot CSS after cutover. |
| `public/` | Later approved poster, textless 1080p loop, and 1080p intro only; no media change in the coded-menu milestone. |
| `ASSET_MANIFEST.json` | Later record real production paths and approval evidence; current entries correctly remain `not-created`. |
| `tests/callback.browser.spec.ts` | Replace obsolete hidden-heading assertion; add entry, IA, settings, media failure, reduced motion, responsive, and keyboard coverage. |
| `tests/rendered-html.test.mjs` | Assert the current public menu contract rather than retired landing copy. |
| `STATUS.md` and `TESTING.md` | Update only when an implementation milestone is actually completed and verified. |

## 15. Non-goals

- No gameplay redesign.
- No engine, D1, snapshot, scoring, eligibility, timer, bot, or AI changes.
- No host gameplay screen redesign in this milestone.
- No phone gameplay redesign.
- No change to room setup settings.
- No plugin installation.
- No asset generation before Checkpoint A.
- No canonical pigeon or crown production as part of the menu code milestone; Unicode crown remains the documented fallback until the SVG is separately approved.
- No global CSS rewrite.
- No attempt to make the old textful loop visually compatible with the new menu.

## 16. Known unresolved items

- `public/og.png` still visually carries the legacy CALLBACK identity despite King Prompter metadata. It is a separate public-brand asset task.
- The current intro and retired `title-loop.mp4` are below the approved 1080p minimum. The new textless Grand Hall menu loop meets the 1080p minimum and is awaiting Checkpoint C approval.
- The existing intro ends in the old menu language and needs a textless handoff edit or replacement.
- The focused Checkpoint A browser scenarios are green; the complete multiplayer/live-image browser matrix remains a Checkpoint F release requirement.
- Historical `STATUS.md` entries intentionally retain older player counts, test counts, and superseded mode behavior as dated records.
- Several internal architecture files and identifiers retain CALLBACK by approved design.
- This local repository currently has no configured Git remote. This document is stored in the Git working tree and is ready for a reviewed commit/push once a GitHub remote and desired branch are explicitly selected.

## 17. Verification performed for this plan

Read-only inspection covered:

- the approved `VISUAL_SYSTEM.md`, `SCREEN_FAMILIES.md`, and `ASSET_MANIFEST.json`;
- `app/components/TVIntroMenu.tsx`, `app/page.tsx`, `app/layout.tsx`, and the relevant `app/globals.css` rules;
- `/play`, `/display`, `/host/new`, `/how-to-play`, `/avatar-studio`, and menu-return links;
- relevant Playwright and rendered-HTML assertions;
- current landing and menu-loop QA screenshots;
- media metadata and the existing loop edit/QA report.

No runtime file, test, artwork, video, audio, plugin, dependency, or gameplay behavior was changed while creating this plan.
