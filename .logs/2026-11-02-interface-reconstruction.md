# Practical interface reconstruction

This release supersedes the blanket no-scroll menu treatment. Removed measured pixel/card pagination; menus, guides, archives and settings have normal scrolling. Home offers direct Host/Join and secondary links. Party/Arcade categories render full catalogs. History has a compact search field and game dropdown. Back returns to the same Home. Character controls scroll beneath a retained preview and save action.

Fish canvas, core tools, undo/redo, preview and submission stay together in portrait and landscape. Secondary controls expand alongside the canvas. Phone sections retain mounted drafts, fixed navigation and keyboard recovery. Host evidence reveal fits its TV stage. Long phone ballots retain bounded accessibility overflow rather than sliced screens.

The real kick regression exposed two existing defects. The WebSocket relay skipped HTTP-only parent membership cleanup; moving it to the shared host-action service makes both transports revoke consistently and retry cleanup idempotently. Concurrent parent polling could then reattach the removed token between child commit and parent deletion. The admission UPDATE now atomically rejects removed-token history, and attachMain returns without retrying that token. A deliberate parent rejoin obtains fresh credentials and works. No scoring, provider, schema or separate Worker deployment changes.

## Verification

- `npm test`: 1,231 pass, 11 skip, zero failures. Includes shared-action authorization/order/retry cases and the actual admission SQL exercised in SQLite.
- `npm run typecheck`: pass. `npm run lint`: zero errors, eight existing image warnings. `git diff --check`: pass. Sites `build-site.mjs`: pass, including static archive gates. `node --test tests/rendered-html.test.mjs`: 10/10 built Worker checks pass.
- `npm run qa:local -- --api`: 7/7 pass, including parent-only admission, old credential rejection, deliberate rejoining, role/privacy, replay and a complete D1 round.
- Eight complete party matches: 8/8 on a fresh disposable server. Compact host/phone probes covered the six turn-based packs; a separate ten-player Standard probe covered 14 phases and draft retention. The real Home-to-Sorcery journey completed three rounds with four phone controllers.
- Final targeted evidence: direct Home/History/picker/House/guide cases 5/5; responsive navigation cases 4/4; character/photo control reachability across six sizes; phone reactions, offline recovery, saved style and drafts; crowded ten-player lobby at enlarged text; transparent three-artist fish drawing/upload/voting/results; full-frame Mystery reveal with every verdict and scores visible; real WebSocket kick, deliberate rejoin and reset.
- Mirror roles, host music defaults/rotation and artwork focus/original pairing passed in the affected suite. QR denial recovers to manual entry.
- Full browser release attempt: 16 passed, 5 failed, 148 not run after the five-failure cutoff. Failures are the same legacy Arcade bot/phone-room cases in the local environment lacking its separate legacy Arcade service; an additional teardown error accompanies the cutoff. This is not a complete browser-suite pass.
- Earlier diagnostic failures are retained in ignored logs: obsolete pager/preview selectors, narrow-menu overflow, one high-load timing-sensitive unit case, stale shared-worker admission, and the confirmed removal bugs. Targeted fixes and fresh-server checks above supersede those results; no tests were weakened to hide them.

Local QA used isolated data and disabled paid providers. Physical phones, TV hardware, group enjoyment and live AI-provider quality remain outside this verification. If parent cleanup exhausts retries after a child commit, same-action protocol retry is supported; an automatic durable reconciliation mechanism is not part of this change.

Build/render and publication receipts are saved in ignored `.logs/interface-reconstruction/`. The source helper seals the verified commit and matching archive. Site v122 is the rollback baseline.
