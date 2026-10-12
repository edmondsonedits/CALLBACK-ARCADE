# CALLBACK Arcade: the Sumo quality benchmark

## User intent

Danny explicitly designated the supplied Royal Sumo: Crownfall v1.3.0 as the true Royal Sumo and asked to examine why it is better, then upgrade **all six other games** to comparable quality. This is implementation work, not a request to stop at suggestions. Preserve each game's identity and existing solo/bot behavior. Existing task context authorizes repository updates and publication when verified.

## Verified reference

Reference: `games/royal-sumo/source/project/src/` and byte-identical `source/index.html`. Leave every Royal Sumo file unchanged.

Sumo's strengths visible in source:

- A complete title/setup/play/pause/help/results flow, arena cards, concise copy and progressive disclosure.
- Six distinct arenas with rules and bot avoidance in `core/maps.js`; quick match and multi-arena Crown Cup; clear tie-aware standings.
- Persistent, validated settings grouped by rules, controls, audio, graphics and accessibility. Names/looks and bounded player slots have defined ownership.
- Touch, keyboard and gamepad input mapping; configurable floating/fixed stick, hand swapping, control scale; explicit charge/cooldown feedback.
- Fixed-step simulation, seeded replay, separation of gameplay RNG and presentation, and 144 behavioral/golden tests.
- Procedural character variation, modeled environments, ground/contact effects, trails, impact/recovery animation, timed sound/visual effects and anticipation before hazards.
- Camera framing, reduced motion/flash options, quality settings and an adaptive resolution governor.

These are code findings, not a claim of hardware playtest superiority. Sumo's online transport is not implemented, its sequence handling is not strict duplicate rejection, and it requires WebGL2. Do not copy those limitations or imply online readiness.

## Approach

Upgrade the six existing games in place. Use their existing rendering systems and physics, enhancing each game's flow, legibility, responsiveness, personality and technical reliability. Avoid an engine rewrite or a shared framework imposed on unrelated simulations. Keep complete runnable standalone entry points and preserve original source archives. No new runtime CDN dependencies.

Each game receives a code-grounded comparison and a substantial cohesive upgrade across these categories:

1. **Playable flow:** an intentional pre-match setup, obvious primary action and objective, help available without dominating play, explicit pause/resume, clean restart/rematch/menu routes, and meaningful round/match results. Preserve currently working flows and deepen gaps.
2. **Player control:** robust touch and keyboard behavior; no stuck input, gameplay behind menus, accidental scroll or double actions. Add standard gamepad actions where absent and practical. Accessible targets and short contextual controls.
3. **Presentation and feedback:** game-specific world/character/arena improvements, anticipation/action/impact/recovery cues, legible player identity and danger signals, celebration and readable standings. This must include in-play work, not only a menu reskin.
4. **Settings and access:** persist validated useful settings, mute/volume and reduced motion; expose appropriate existing tuning as understandable choices, with concise defaults and advanced controls tucked away.
5. **Gameplay/replay quality:** a concrete genre-specific improvement to skill expression, bot fairness, pacing, practice, round variation or session progression based on the actual audit. Preserve existing good mechanics; avoid arbitrary numeric retuning or invented networking.
6. **Engineering evidence:** focused behavioral regression tests for changed gameplay/lifecycle/input, syntax checks and repository integration. Add an audit explaining strengths, gaps, changes, remaining gaps and verification scope.

## Global constraints

- Do not modify Royal Sumo.
- Support existing 2–10 contestant capacities and local human/bot defaults.
- Preserve public integration APIs and existing working camera controls, unless a concrete compatibility-preserving change is documented.
- Retain existing renderers and standalone `source/index.html`; avoid new dependencies.
- Menus pause/gate gameplay and reset held input. Settings changes must not silently restart active matches unless clearly presented as an explicit restart.
- No sound before the user's enabling gesture; bounded audio resources; no uncaught storage errors.
- Honor reduced motion. Keep the playfield clear and mobile controls usable at 390x844 and 844x390; desktop reference 1365x900.
- Keep seed/RNG and simulation behavior separate from purely cosmetic effects when adding deterministic options.
- Original archives stay unchanged. Source changes must update version, provenance and changelog accurately.
- Multiplayer remains unverified/not integrated according to actual state; no hosted-room claims or placeholders.
- Subtasks own only their game folder and uniquely named game-specific root tests. Parent owns generated catalogs, STATUS and cross-game tests.
- Do not publish or push from a subtask; parent integrates and publishes after review.
- Report browser limitations honestly. Local Chromium currently fails a sandbox socket restriction; the cloud browser currently cannot initialize WebGL2. Canvas games may still be browser-testable after publication or through supported tooling.

## Per-game focus

- **Ballistix:** defend/catch/release/counter clarity, radial-control feedback, cannon telegraphs, attractive beach/castle arena and contestant identity; deliberate setup, a replayable/practice or match-variation feature, gamepad, persistent access/audio settings.
- **Scratch Match:** musical count-in and phrase/echo distinction, note readability and timing feedback, latency/practice affordances, DJ/stage performance, clean recovery/results, persistent settings and repeat-safe keyboard/gamepad chords.
- **Roller Ruckus:** racing setup and full results, lap/checkpoint/direction guidance, fair recovery and momentum clarity, richer course/character movement/collision feedback, intentional difficulty/session choices and persistent settings.
- **Twisted:** jump/duck anticipation and controls, hazard rhythm/readability, platform/castle atmosphere and character animation, survival progression/results, persistent preferences and gamepad robustness.
- **Space Bash:** grab/throw/kick intent, aimed throws and danger readability, expressive fighters/destructible orbital deck, countdown/results, fair bot pacing, practice/rule variation, gamepad and persistent settings.
- **Blind Crown:** preserve secret simultaneous planning and Classic/Precision rules, build stronger pre-match/player identity/help/results flow, improve placement/aim/lock feedback and cinematic volley clarity, retain all three arenas/four camera modes and existing accessibility; a substantive clarity/replay/learning improvement appropriate for a tactical game rather than reflex controls.

## Acceptance

Each game has a meaningful upgrade documented against the benchmark, with passing relevant tests and no regressions to shared gates. Generated catalog, live deployment and source hashes are verified. Do not promise subjective equality, physical-device validation or online multiplayer without evidence.
