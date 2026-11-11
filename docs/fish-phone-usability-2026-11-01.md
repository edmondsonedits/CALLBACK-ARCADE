# Phone drawing usability follow-up

Scope: double prompt writing to 120 seconds, extend prompt selection to 60 seconds, replace funniest-drawing voting instructions with enjoyment, prevent accidental long-press selection without disabling text fields, offer a transparent blank fish canvas, improve short/narrow iPhone layouts, and make spray visibly useful at phone scale.

Keep the server authoritative, extended timers at 1.5x, original transparent PNG exports, incremental stroke caching, undo/reload and normal host layout. Early completion still advances when everyone submits.

Spray reference: Fabric.js SprayBrush (https://www.fabricjs.com/api/classes/spraybrush/) separates density and dot size and defaults random opacity off. The implementation here remains custom and deterministic; evaluate downscaled coverage rather than merely counting nonzero pixels.

Acceptance: focused server deadline tests; browser prompt selection and ranked voting; blank-canvas draw/reload/export and viewport checks in Chromium/WebKit; phone-scale spray coverage/blending; release type/lint/unit/build/render gates. Emulation does not establish every physical phone/browser combination.


## Verified results

- 1,196 unit/API tests pass, nine existing skips. Typecheck and lint pass (four existing image warnings); production build and all nine rendered-HTML tests pass.
- Chromium prompt browsing and ten-player narrow ballot tests pass.
- Chromium/WebKit: blank template switching, pixel alpha, undo/redo, reload, selectable text fields, and phone-surface selection suppression pass. Viewports: 390x844, 320x568, 844x390, 568x320. A cascade conflict that stacked the landscape toolbar was corrected; its scrollable dock uses four columns and 44px controls.
- Chromium/WebKit: phone-scale spray coverage, colour blend, untouched alpha and cached incremental equivalence pass. Actual authenticated exports tested separately for template and blank canvases: correct 1024x768 size, authored exterior pixels, transparent corner, and transparent blank centre versus opaque template centre.
- Physical phones and browser chrome/safe-area behavior on every hardware model remain unverified.
