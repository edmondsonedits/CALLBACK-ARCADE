# Callback export validation

Source: Sites v133, commit `8b15b694506e844875ca4ecbf5e207b38726d676`.
Validation performed 2026-11-11 on Node v24.22.1 / npm11.9.0.

## Exact sanitized export

- 1,458 original files plus EXPORT-NOTES.md; all 1,459 manifest blob hashes rechecked with zero differences.
- Privacy omissions: four user reference JPGs under .codex-remote-attachments and ten PNG screenshots under .logs. Full private preservation archive is managed separately by coordinator.
- `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/callback-npm-cache`: success, 518 packages. Initial attempt with default home cache failed due inaccessible cache directory; retried with writable temporary cache.
- `npm run typecheck`: passed.
- `npm test`: 1,273 discovered, 1,262 passed, 11 skipped, zero failures (61.5 seconds).
- Unmodified `npm run build`: failed during prebuild. scripts/build-arcade.mjs uses git show against historical commit c6f1d3c2cf01a71a6ebeef165712b685e1e5fb2d, unavailable to a standalone source snapshot.

## Applied portability patch

`callback-portability.patch` changes only scripts/build-arcade.mjs: helper reads already-preserved per-game original files rather than invoking historical git show; two call sites await those reads. Source provenance SHA remains untouched. No game mechanics or application behavior changed.

Verified all 35 archived original copies byte-identical to historical Git blobs: five Snow Bash .ts files and 30 .ts.txt copies across Drain Bash, Jungle Bash, Tie-Breaker, Manic Panic, Rubble Alliance, Dragon Drop and Volt Vault. No historical source bytes are lost by using these copies.

The patch was first tested in the isolated callback-build-check directory and then applied to this final export. Exact unmodified source is preserved in the separate private v133 ZIP. Focused tests arcade-archive-build, arcade-snow-upgrade and archived-arcade: eight passed, zero failed/skipped. Full production build outcome to be appended below.

No deployment, GitHub remote change, live D1/R2 export, browser playtest or independent-hosting configuration was performed by this validation worker. Source preservation and build success do not prove live multiplayer/backend migration.

## Patched build result

`npm run build` completed successfully (exit 0), including arcade prebuild generation, all Vinext production build phases and postbuild archive gates for 17 archived IDs/aliases. Vinext emitted route-classification notices; these are not deployment or runtime test results. No source portability change beyond the supplied patch was needed for this successful build.
