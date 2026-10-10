# Blind Crown v1.4 import verification

Verified on 2026-10-10. This report records the completed import checks, not a hosted multiplayer or production-readiness claim.

## Exact source

- Input: `BLIND_CROWN_Refined_v1.4_Play_Solo.html`
- Repository entry: `games/blind-crown/source/index.html`
- Size: 159955 bytes
- SHA-256: `496131ad8031a58b8b2ec78cc1aace73f57ab1ca0646271b383bf48bb108c462`
- No gameplay source edits were made during import.

## Remote verification actually executed

GitHub Actions run: https://github.com/edmondsonedits/CALLBACK-ARCADE/actions/runs/38093508145

Job `114334569589` completed successfully and checked:

1. Restored source byte count and SHA-256 match the supplied HTML exactly.
2. `node --test games/blind-crown/tests/standalone.test.mjs`: 5 passed, 0 failed. Covers integrity, embedded script compilation, own-seat/TV planning privacy, countdown after locking, cover collision, simultaneous mutual elimination and ten contestant slots with Classic defaults.
3. `npm ci`: succeeded.
4. `npm run catalog:generate`: succeeded; generated files committed, not hand-edited.
5. `npm run catalog:check`: succeeded.
6. `npm test`: the existing 39 repository tests passed, 0 failed.
7. `npm run typecheck`: succeeded.
8. `npm run pages:build`: succeeded.

The source and generated catalog outputs were committed by that job as `b85138678566d86c1b69fc4bf272e0ae79a809dd`. Subsequent cleanup removes only temporary transfer material, adds this report and includes the five game tests in the normal root test command through `tests/blind-crown-import.test.mjs`. Final-commit CI results are available in GitHub Actions and must be checked independently of the earlier run above.

## Local source verification during import

The supplied full v1.4 package's unit suite and Chromium desktop/mobile-emulated UI suite were re-run successfully. The unit suite included 300 ten-seat seeded matches and 2880 placement/movement cases. Browser viewports were 1440x960, 390x844 and 844x390, using injected standalone HTML rather than live HTTP browser navigation. These checks do not establish physical-phone performance or public deployment.

## Limits and warnings

- Default Canvas solo/bot gameplay is the published use case. The separate Node multiplayer server from the full source package is not hosted by GitHub Pages.
- Actual polygonal WebGL/GLB appearance, real device performance and live multi-phone browser play are not verified by this import.
- Existing game URLs were checked for reachability, not comprehensively playtested again.
- No source changes were made to the other six games.
- `npm ci` reported 4 high-severity findings in the repository's existing dependency tree. This import adds no npm dependency and does not resolve or conceal those audit findings. Investigate them separately before describing the foundation as security-audited; do not apply a forced dependency upgrade without regression testing.
- A successful build is not deployment proof. Confirm the Pages workflow and public URL separately before saying this version is live.
