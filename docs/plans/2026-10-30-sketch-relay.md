# Sketch & Sorcery

Native Callback game using the existing Cloudflare FLUX.2 reference image generator. OpenAI setup deferred by user.

Three rounds, 3–10 players. Each round: choose one of three short prompts → simultaneous drawing → AI transformation of actual sketch → blind caption by another player → redraw by a third player → second transformation → TV reveal with aligned slow AI overlays → scores. Parallel play, bounded waits, original-sketch fallback, one applause each round.

D1 owns assignments, phases, deadlines, asset eligibility and score events. PNG upload is cookie-authenticated, bounded and atomic with submission. Hidden prompts are never sent to the image model. Bots use free coded samples. Private media requires role/assignment/reveal access even if an asset ID is known. Generation cannot stall the game. Pause/reconnect/replay preserve authoritative state.

Owners: relay_backend (contracts/engine/native integration); relay_pipeline (upload/jobs/media); relay_phone (fullscreen controller/drafts/submission); relay_stage (TV/effects/tutorial/voice); root (composition, existing audio/lobby integration, review, release).

Release gates: meaningful state/privacy/job tests; TypeScript, lint, full unit suite, production build; browser host/phone draw→guess→redraw→reveal check; reviewed source publication with existing public audience; live provider acceptance and honest verification limits.

Research applied: Gartic Phone's simultaneous relay and grouped reveals; simple phone input praised in Drawful reviews; Jackbox's customer-survey feedback supports skippable/replayable instructions and extended timers. Original prompts/code/art only.

Research sources: https://garticphone.com/ ; https://www.jackboxgames.com/blog/responding-to-your-questions-from-the-jackbox-customer-survey ; https://www.destructoid.com/reviews/review-drawful-2/ . The design uses original prompts/code/art; the structure and interaction lessons informed the implementation.

Final local verification:992pass/9skip/0fail; full lint and TypeScript pass. Browser room3VDG reached complete with9chains; two actual480px source assets loaded in the final gallery, and manual upload/caption/redraw and pause/resume were observed. Real provider acceptance follows publication.
