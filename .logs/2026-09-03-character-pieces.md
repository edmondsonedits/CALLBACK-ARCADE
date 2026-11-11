# Character piece editor

Implemented independent transforms in the shared SVG renderer and all editor entry points, with finite strict server validation and optional v2 data for backward compatibility. See STATUS.md and tests/avatar-pieces.test.ts. Saved/live character configs share one renderer. All 13 family presets and every eye/expression combination are covered. Lint, typecheck, 77 passing tests (five intentional skips), and build validated. No browser interaction or touch QA performed in this task.
