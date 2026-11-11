# Full-screen navigation implementation plan

**Goal:** Keep CALLBACK menus, all seven active party games, and character customization usable without manual page or panel scrolling, then publish the verified source.

**Design:** Preserve the castle presentation and authoritative game state. Use full-screen menu destinations with Back, explicit previous/next controls for collections and long tasks, and native dropdowns for large option sets. Preserve mounted inputs and private drafts. Fit the dynamic viewport, safe areas and keyboard; do not solve overflow by making content unreachable.

**Source:** Existing Site version 120, commit 21620b94a9b35385ff530b0caaaa7c7e49ed6ce5, dedicated H:\ChatGPT\CALLBACK-face-photo-2026-11-01 checkout. Preserve the prior verified review fixes and the older C: checkout. User has authorized publication.

## Tasks

- [x] Add browser coverage for menu destinations, all party-game phone task families, paged collections, keyboard/focus and retained drafts at compact and desktop sizes.
- [x] Replace scrolling shared game selection with responsive pages and full-screen settings/player destinations. Page legacy menus and guest game hub; keep every action reachable.
- [x] Make phone task pagination handle large ballots, image/context cards, forms and keyboard resize without clipping controls or losing state. Audit host controls and Sketch & Sorcery.
- [x] Convert character/profile/photo/piece editors to full-screen menus or bounded steps. Preserve save/cancel/history and all existing controls. Worker owns character components and dedicated CSS only.
- [x] Inspect screenshots and run affected browser scenarios, all unit/API tests, lint, typecheck and production build/render checks. Record exact coverage and limitations.
- [ ] Package and push the exact verified source with the Sites helper, save and publish preserving public access, then verify the deployed version and representative live routes.

Publication is recorded in the ignored `.logs/fullscreen/release-receipt.json` and Sites history after this plan's source commit is sealed.

## Review focus

Long player text and ten-person ballots; landscape and short phones; keyboard and 200% text; conditional photo actions and crop/trim recovery; phase changes and back navigation retaining drafts; mirrors following host selection; production migration/source compatibility from earlier fixes.

## Acceptance

No manual scrolling required to reach an action or read content in supported layouts. Overflow has a visible page/menu destination. Inputs stay mounted, offscreen screens are inert, focus follows intentional navigation, and server responsibilities remain unchanged. External guest sites retain their own interfaces.
