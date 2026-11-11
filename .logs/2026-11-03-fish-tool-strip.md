# Swipeable fish tools

User requested horizontal swipe/drag tools and left contextual settings. Tool strip includes painting, selection, hand and shapes; undo/redo stay beside the colour strip. Size and opacity update immediately. Done, Escape or the first canvas tap closes settings; the dismissal tap does not paint. No inactivity timeout that could interrupt slider use. Existing drafts preserve their appearance through optional stroke opacity defaulting to one.

Responsive real-room browser checks cover 320x568, 393x700 and 667x375; mouse dragging, settings changes, safe dismissal, shape reachability, drawing and history. Existing hold/release/pause/reload airbrush check also passes. Screenshots inspected. Unit, typecheck, lint and production build/render results recorded in ignored .logs/fish-editor-layout/strip-* logs. Physical hardware and unrelated broad legacy Arcade tests were not rerun. Disposable cleanup may log a version conflict; harness is stopped before production build.

Rollback: v126 / 0dde2dfdb31fa2cb450df588c07cfb792cd06ada.
