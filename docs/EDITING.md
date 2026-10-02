# Editing guide

## Find source

Search `GAME_INDEX.md` for the game's title, aliases, or tags. Open that game's `README.md` and `manifest.json`; the manifest links into checked-in source or names the known provenance source. If status says `awaiting-import`, obtain the original standalone HTML from the user before implementing gameplay changes. A remote source link is a locator, not proof that the source is imported or licensed.

## Make a change

Use the stable `games/<id>/` folder. Preserve the whole standalone HTML file first, including inline CSS, JavaScript, simulation logic, and current control hooks. Tune existing values in place. Keep assets, tests, and integration notes beside it. Extraction into modules is optional and should keep the imported version recoverable. Record what changed and how it was checked in `CHANGELOG.md`.

## Refresh discovery

Edit only the manifest for descriptive metadata, then run `npm run catalog:generate` and `npm run catalog:check`. Never manually edit generated catalog/index/seed files. The generator rejects unsafe paths, absent source/evidence files, mismatched folder IDs, and unsubstantiated ready statuses.

A regular ChatGPT chat can edit files only when this repository is available in that task or the user uploads the source. A catalog entry does not grant another chat access, download an attachment, or publish/commit automatically.

## Readiness evidence

An imported source path must point to a real game entry file in `source/` (`.html`, `.htm`, `.js`, `.mjs`, or `.ts`); intake READMEs do not count. To set multiplayer status to `verified`, add a JSON record under `integration/` or `tests/` in the format shown in `docs/GAME_SDK.md`. The record must list passed checks and SHA-256 hashes for every source path. Regenerate the hashes whenever source changes. This binds an automated-check attestation to source bytes; it does not establish human playtesting or production readiness.
