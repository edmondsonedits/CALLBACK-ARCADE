# Nightfall v1.5 connected verification

Game source SHA-256: `06a0238b9827cd6f4395ec33cd0b2c8c7ce758bc15135a946ed7c737e53ef0e4` (171542 bytes).

The isolated-branch verification run completed successfully:
https://github.com/edmondsonedits/CALLBACK-ARCADE/actions/runs/38103013709

Verified steps: exact baseline/delta hash validation, six standalone Node tests including original v1.4 preservation and unchanged deterministic engine, catalog generation/check, repository tests, TypeScript checking, Pages build, Chromium Canvas privacy/effects checks, responsive HUD checks, a seeded match through the actual UI, and the HTTP-served Pages build.

`evidence/static-http.json` records the connected HTTP/browser checks: the seven-game catalog loaded; its Blind Crown launch link was exercised; the expected Nightfall source bytes were served; desktop 1440x960, emulated phone 390x844 and landscape 844x390 passed without game page exceptions or external game requests. The browser scripts and the final match screenshot are retained alongside the game.

`nightfall-local-verification.json` separately records 18 passing local checks bound to the same standalone SHA. Local socket tests used real clients against the shipped Node server; they are not evidence of a deployed multiplayer service.

Scope limits: the default renderer is Canvas 2D/2.5D. This does not verify actual WebGL/glTF rendering, physical mobile performance, Safari, production phone-room networking, or a public deployment. Public deployment is verified separately through the existing Pages workflow and live URL after merge. No other arcade game's runtime was modified.
