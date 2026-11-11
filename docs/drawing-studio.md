# Drawing Studio

The requested phone drawing dashboard lives at /drawing-studio. It is a working, local drawing surface for the future sketch-to-AI game. Finishing reviews and exports the actual sketch; it does not claim to submit a multiplayer turn or generate an AI image.

## Research and decisions

- Gartic Phone: pencil, eraser, shapes, fill, adjustable thickness and undo/redo. Keep the drawing surface dominant and expose tools through a compact toolbar menu. https://play.google.com/store/apps/details?id=com.gartic.garticphone
- Skribbl: compact toolbar, colours, undo, mobile support. Use visible selected states and keep the canvas dominant. https://skribbl.io/
- Drawful: low-pressure phone drawing. Keep the task short and accept simple doodles. https://www.jackboxgames.com/games/drawful-2
- Quick, Draw!: a clear prompt and immediate drawing surface. Keep instructions outside the canvas. https://quickdraw.withgoogle.com/

Use original coded UI in CALLBACK's navy, parchment, cyan and gold. No copied assets or game source. Mouse, finger and stylus share one pointer owner; a second touch cannot steal or extend the first stroke. Normal text inputs keep native editing.

## Full screen layout

The drawing surface covers the viewport. A small floating toolbar opens separate tool, colour and brush menus. More contains expandable Canvas view, Display and Sketch & file options. The drawing idea is a compact top dropdown; Done opens the existing preview. Focus mode hides all controls except a small Tools button. Short landscape phones use a vertical toolbar at the right edge.

New pages match the opening viewport, with 1024 pixels on the longest edge. An untouched page follows window resizing; pages with history preserve their geometry. Whole drawing is the default for sized pages, so rotation never crops or stretches the art. Legacy square drafts retain their prior fill-view behavior and unchanged pixels; a confirmed New page action creates a viewport-shaped replacement. Hand and zoom remain optional. PNG includes the whole document at its saved aspect ratio. Native browser fullscreen is requested from prompt selection or the explicit menu action, with no error interruption for unsupported automatic requests.

## Implementation

- Normalized vector operations preserve drawings across layout/rotation; raster fill uses a bounded queue.
- Undo/redo includes clear and fill. Drawing after undo discards the redo branch.
- Drafts are versioned and validated, saved on the device, and restored after reload.
- White-background PNG export uses the saved canvas dimensions (up to 1024px per edge), without burning the prompt into the picture.
- The drawing UI is separate from existing room engines, scoring and paid AI generation.

## Checks

Test history branching, draft validation, edge-safe fill, same-colour fill and stroke ownership. Verify actual pointer drawing, undo, clear confirmation, review/export and reload in the browser. Check portrait and short landscape layouts.

## Review-driven improvements

The full prompt wraps and is exposed to screen readers. A visible “3 ideas” control offers three short prompts from a curated original library of 48, refreshes without immediate repeats and allows a custom idea. Prompt metadata survives reload and history edits. Pen and eraser are direct controls; redo stays in a stable position. Advanced controls are collapsed by default. Clear disables Done until a mark is restored or added. Detailed findings and source links: drawing-studio-review.md.
