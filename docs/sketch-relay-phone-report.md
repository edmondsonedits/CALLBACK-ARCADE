# Sketch & Sorcery phone controller

Implemented `SketchRelayController`, deterministic free `PracticeDoodle`, and optional controlled `DrawingStudio` props. The standalone drawing page retains its prompt refresh, custom 100-character ideas, device draft, and download flow.

Game assignments use `callback:sketch-relay:${code}:${matchId}:${round}:${phase}:${chainId}`. Memoized prompt choices and keyed initialization preserve work through repeated snapshots. Original drawings choose among the supplied three prompts. Redraws display only the assigned caption. Caption drafts allow 140 characters and persist by assignment.

Drawing submission exports the actual canvas, proportionally contained on opaque white 480×480 PNG. The binary room upload carries match, round, chain, leg, original prompt index, and a UUID persisted per assignment and reused across retries. The existing portable UUID utility works on HTTP preview origins without `crypto.subtle`. Upload acknowledgement locks the studio and refreshes the room; errors close review and retain the draft for retry. Latest nonblank ink automatically submits four seconds before the corrected server deadline. Pause blocks drawing, undo, redo, and submission. Cleared/white images are checked against pixels and never submitted.

Reveal includes the permitted chain and author labels; server-provided applause options send the bound chain/leg once. Wait screens show response progress and authoritative scores. Practice art is explicitly labelled free and no AI.

Validation: scoped ESLint passed; `npm run typecheck` passed; all 11 drawing-studio tests passed, including 140-character redraw caption marks/draft restoration and rejection at 141 characters. Browser acceptance is owned by the root agent. Paused and submitting toolbars are disabled for keyboard navigation; the clear action also checks the lock. Controlled storage-failure copy asks the player to keep the page open.
