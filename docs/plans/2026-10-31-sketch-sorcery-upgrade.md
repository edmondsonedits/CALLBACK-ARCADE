# Sketch & Sorcery playtest upgrade

User authorized implementation and publication of the reviewed playtest notes.

## Design decisions
- Preserve Callback architecture and public Site. Extend new showdown matches to three rounds; retain saved two-round matches.
- Server owns chooser, choices, deadlines, personalized finale assignments and 1x/2x/3x score events. Bounded selection phases prevent stalled games. Curses last one round only.
- Keep common drawing controls in a compact bottom dock outside the canvas. Two touches navigate; selecting and transforming preserve transparency. Gap closing uses a bounded logical-pixel tolerance and does not alter visible ink.
- Restrictions are enforced by editing handlers as well as UI locks. PNG upload architecture cannot prove that a malicious modified client obeyed a curse; no claim of anti-cheat enforcement.
- Finale uses bounded modifiers and simple starter shapes, avoiding slow free-form prompt entry. Starter transformations reuse selection controls.
- QR opens a keyboard-accessible native dialog, with enlarged crisp source, Escape and focus restoration.
- Distinguish drawing assignment from generation instructions, only reveal private assignments when artist disclosure is allowed.

## Work and verification
1. Editor agent owns drawing utility/component and regression tests.
2. Gameplay agent owns server match state, projections, controller/stage, copy and regression tests.
3. Parent owns join QR, integration, browser smoke, full unit/type/build checks and publication.
4. Preserve provider settings and allowance protections. No extra image generation is used for QA.
5. Publish only after inspecting combined changes and fixing relevant failures; document limits honestly.
