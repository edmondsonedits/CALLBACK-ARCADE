# Phone simplification

User direction: remove the in-app room scanner, add a separate face-camera action, and fit ordinary phone screens when practical. Keep natural scrolling for long lists, expanded help, accessibility and keyboard recovery.

- Remove scanner navigation from `app/play/page.tsx`; keep manual codes and externally scanned host links. Make the primary action explicit and move legacy connection help out of the main flow.
- Add native front-camera capture beside photo upload in `PhotoFaceEditor.tsx`. Both use existing validation/crop/generation. Keep initial selection compact and avoid a blank workspace or disabled generation action before a photo exists.
- Inspect Home, join, mirror/display, saved character and settings at short and normal phone sizes. Reduce redundant headings, card margins and oversized secondary controls in `interface-layout.css`; keep readable text and 44px touch targets. Do not hide overflow to disguise clipped controls.
- Verify navigation, camera selection with synthetic local images, character crop/retry flows, long-content scrolling and game workspace regressions. No paid generation. Run release checks and package/publish the reviewed source through Sites.

Ownership: main agent handles entry/navigation/shared layouts and publication; Luna worker handles photo editor/CSS/photo tests. No gameplay, persistence, provider or schema changes intended.
