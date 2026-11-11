# Phone Back navigation

Base: Site v130 / cee58f46fad0f7a8bb52f61fefed0e765a03b715.

Reproduced: completing the intro left the root URL unmarked, so route Back mounted the starting gate again. Internal artwork, settings and phone section changes also had no browser history entries.

Fix scope: mark the completed home menu in the existing menu=1 URL contract; preserve framework history state and unrelated query/hash values. Add bounded local panel history without storing game state or rewinding server phases. Preserve explicit Replay Intro.

Focused review covers conditional dialog teardown, nested artwork details, avatar cancel/photo cleanup and Style becoming unavailable on game start. Implementation reviewed and verified; Sites history/ignored outputs receipt records publication.

Verification:
- RED reproduced intro completion leaving the root entry unmarked and Back leaving local artwork instead of closing it.
- Final browser checks: four navigation scenarios plus first-entry/explicit replay/query preservation, six phone-section/layout/draft checks, artwork carousel/settings checks, host music and PWA checks, and the Quick workshop flow including native browser Back from a conditionally mounted practice dialog. Twenty distinct focused scenarios passed across runs.
- The first combined workshop run hit STALE_ARCADE_TRANSITION while Vite auto-reloaded trace HTML under .tmp; moving artifacts to the already-ignored .logs/workshop-phone-back-artifacts path and rerunning the complete workshop passed (34.2 seconds).
- Full units: 1,259 passed, 11 environment-dependent skips, zero failures. Lint zero errors/eight existing private-image optimization warnings; typecheck passed.
- Sol read-only review findings addressed: stable dialog baseline, own-entry/branch teardown, Style expiry with nested editor, trim cleanup, avatar cancel versus Done, nested exhibition details.
- No server phases, scores, authentication or persistence contracts changed. No paid provider work. Physical-phone hardware Back was approximated with mobile browser history and native dialog events; actual-device validation remains manual.
