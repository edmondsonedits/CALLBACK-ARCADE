# Solo playtest milestone — 2026-08-22

- Added one-phone solo setup for both standard and 30th-birthday routes.
- One human receives separate host and player cookies; two to five deterministic local bots fill the remaining seats.
- The phone can customize game length, content mode, and timer accessibility, then start, pause/resume, add 15 seconds, skip a phase, view every reveal, inspect final results, and replay without opening a second display.
- Bots answer, vote, make social choices, distribute predictions, guess authors, and wager through the authoritative server state. Solo rooms lock new joins and the birthday human becomes VIP automatically.
- Solo mode never enqueues OpenAI, moderation, image-generation, or R2 jobs. Deterministic concept cards preserve the image-reveal beats.
- Unit coverage completes a full Quick match and asserts zero job effects. Browser coverage plays a complete birthday pack from one session and exercises the visible one-phone controls through a creative round.
