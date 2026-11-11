# Fish colour gradient

Twenty evenly spaced rainbow swatches follow the existing eight main colours in the scrolling fish palette. Custom picker remains last. No drawing behaviour changes.

Real-room browser check passes at three phone viewport sizes, including scrolling to/selecting the last gradient swatch and drawing with it. Typecheck and 1232 unit tests pass (11 skips). Release logs: ignored .logs/fish-editor-layout/palette-*. Physical-device checks and unrelated broad legacy Arcade tests were not rerun. Disposable room cleanup logged a version conflict; QA harness stopped afterward.

Rollback: v127 / 8330757018ab6c3a34afb8ec921ec0851f436a1b.
