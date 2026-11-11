# Practical interface reconstruction

**Goal:** Replace arbitrary viewport pagination with understandable menus and coherent game workspaces, following the user's correction that no-scroll applies to gameplay rather than every menu.

**Design:** Keep the existing castle palette and current Sorcery artwork. Use compact headings, a clear primary action and ordinary document scrolling for menus, archives and setup. Home offers Host and Join directly, with secondary destinations grouped below. Game selection is a responsive grid, not a sliced stack. History uses search and a game dropdown. Dialog bodies can scroll under a fixed close/header. Character preview and Save/Cancel remain visible while its control panel can scroll. Fixed gameplay shells retain primary actions; secondary choice/content regions adapt within the task instead of cutting the whole DOM into fake screens. Drawing canvases remain mounted and tools stay adjacent to them.

**Architecture:** Remove the shared pixel-based ScreenPages machinery. Separate natural menu flow from fixed phone/TV game surfaces. Preserve the phase-key boundary, mounted drafts, hidden/inert phone tabs, keyboard viewport handling, server authority, anonymity and all scoring rules. No paid providers in QA. Existing public Site v122 is the rollback baseline.

**Ownership:** Root owns shared layout components/CSS, home/session/history/character screens, gameplay task wrappers and integration tests. Luna worker owns FishEditor.tsx/FishEditor.module.css and focused editor tests. Independent Sol reviewer audits boundaries and the final changes. No worker may revert concurrent edits.

- [x] Remove automatic document/card pagination; reconstruct menu flow, filters, headings and direct entry.
- [x] Keep game task/action/canvas layouts coherent, with compact responsive typography and secondary content handling.
- [x] Rebuild fish editing controls beside the canvas at compact portrait and landscape sizes.
- [x] Restore readable character controls with a retained preview and save/cancel actions.
- [x] Verify menu scrolling/reachability, keyboard/focus, saved drafts, canvas/tools co-visibility, representative party-game phases and host no-scroll layouts.
- [x] Run release checks and document actual results and limitations. Package and publish the exact reviewed source through Sites; the native publication receipt records that final outcome.

Review focus: short phone windows and browser chrome; virtual keyboard and zoom; long titles/answers/ten-player lists; preserved drafts when opening help/style; fixed canvas pointer coordinates and transparent fish output. The supplied History Books screenshot is the acceptance example: no Screen 1/16 or artificial Next screen bar, and useful archive content appears after a compact search/filter header.
