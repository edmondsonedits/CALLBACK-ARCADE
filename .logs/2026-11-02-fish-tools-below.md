# Fish toolbar below canvas

Moves fish tools below the full-width canvas at every viewport. Colours scroll horizontally; secondary settings remain in the lower scrollable tray. Core tools retain 44px targets. Corrects Preview/Blank wrapping on intermediate widths. No drawing-state, upload or game-rule changes.

Verified: real three-player fish browser fixture at 320x568, 393x700 and 667x375; canvas/tool geometry, colour selection, drawing, undo and extra parts controls pass. Screenshots reviewed. Resize checks wait for the visual viewport and canvas layout to settle. Test cleanup logged a version conflict; disposable QA was torn down afterward.

Typecheck and diff check pass; lint has zero errors/eight inherited warnings. Unit suite: 1,231 pass/11 skips. Sites build and ten production-render checks pass. Prior broad legacy Arcade QA limitations remain; the unrelated suite was not rerun for this scoped CSS change. Evidence: ignored `.logs/fish-editor-layout/`.

Base/rollback: Site v124, source `1c95671d78ee0acc6ff1a8b9276ff4016c86ebac`.
