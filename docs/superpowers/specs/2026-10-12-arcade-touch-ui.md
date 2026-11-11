# Consistent Arcade touch UI

The user wants all Arcade games, including the subsequently imported Blind Crown to avoid long-press copy menus and support simultaneous movement/action thumbs. Apply shared interaction standards to twenty physical games (online and local) and nineteen room/controller games. Preserve rules, authentication, keyboard access, editable text fields and menus that scroll.

Use scoped selection/callout/context-menu/drag suppression on game surfaces, never a global touchmove cancellation. Interactive controls have 48px minimum targets, safe-area spacing, clear pressed/focus feedback and reduced-motion support. Add a saved larger-controls toggle in the existing game menu or phone toolbar. Phone control groups adapt to small portrait and landscape screens.

Track pointer ownership per control. Only the owning movement pointer may steer/release; action pointers and keyboard holds remain independent. Cancellation, lost capture, blur, hidden pages and opening/resizing controls clear the appropriate inputs. A second finger must never end another finger's charge, drag or drawing stroke. Shared-menu forms retain normal text entry/paste and scrolling.

Verify actual shipping handlers with DOM/hook contract harnesses and existing engine tests, then run release checks and publish through Sites. No browser control skill is available in managed Sites; report physical Android/iOS and visual playtesting as unverified.
