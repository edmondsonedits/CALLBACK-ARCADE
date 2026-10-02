import { mkdir, readFile, realpath, stat, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { buildCatalog, validateManifest, validateCatalog, type GameManifest } from '../src/catalog.ts';
import { revisionOf } from './revision.ts';
import { validateManifestFiles } from './manifest-files.ts';
const root = process.cwd();
const gamesRoot = path.join(root, 'games');
const files = (await (await import('node:fs/promises')).readdir(gamesRoot, { withFileTypes: true })).filter(x => x.isDirectory() && x.name !== '_template' && !x.name.startsWith('.intake-')).map(x => x.name).sort();
const entries: GameManifest[] = [];
for (const id of files) {
  const dir = `games/${id}`;
  const manifest = JSON.parse(await readFile(path.join(root, dir, 'manifest.json'), 'utf8')) as GameManifest;
  const errors = [...validateManifest(manifest, dir), ...await validateManifestFiles(root, dir, manifest)];
  if (errors.length) throw new Error(`${id}: ${errors.join('; ')}`);
  entries.push(manifest);
}
const catalog = { ...buildCatalog(entries), revision: revisionOf(entries) };
const errors = validateCatalog(catalog);
if (errors.length) throw new Error(errors.join('\n'));
const json = `${JSON.stringify(catalog, null, 2)}\n`;
const md = `# Game index\n\nGenerated from validated game manifests. Run \`npm run catalog:generate\` after editing a manifest. Source links open the current repository copy when present and the known provenance link otherwise.\n\n${catalog.games.map(game => {
  const repo = 'https://github.com/edmondsonedits/CALLBACK-ARCADE/blob/main';
  const source = game.source.paths.length ? game.source.paths.map(p => `[${p}](${repo}/games/${game.id}/${p})`).join(', ') : game.source.url ? `[known source](${game.source.url})` : 'awaiting source attachment';
  return `## ${game.title}\n\n- ID: \`${game.id}\` ([manifest](${repo}/games/${game.id}/manifest.json), [game guide](${repo}/games/${game.id}/README.md))\n- Status: ${game.source.status}; multiplayer ${game.multiplayer.status}\n- Players: ${game.players.min}–${game.players.max}\n- Version: ${game.version}\n- Source: ${source}\n\n${game.description}\n`;
}).join('\n')}`;
const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
const seed = `DELETE FROM games WHERE id NOT IN (${catalog.games.map(g => quote(g.id)).join(', ') || "''"});\n` + catalog.games.map(g => `INSERT INTO games (id, title, version, lifecycle, source_status, multiplayer_status, manifest_json) VALUES (${[g.id,g.title,g.version,g.lifecycle,g.source.status,g.multiplayer.status,JSON.stringify(g)].map(quote).join(', ')}) ON CONFLICT(id) DO UPDATE SET title=excluded.title, version=excluded.version, lifecycle=excluded.lifecycle, source_status=excluded.source_status, multiplayer_status=excluded.multiplayer_status, manifest_json=excluded.manifest_json;`).join('\n') + `\nINSERT INTO catalog_meta (id, revision, game_count) VALUES (1, ${quote(catalog.revision)}, ${catalog.games.length}) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision, game_count=excluded.game_count;\n`;
const outputs = [['catalog/games.json', json], ['GAME_INDEX.md', md], ['db/seed.sql', seed]] as const;
if (process.argv.includes('--check')) {
  for (const [file, contents] of outputs) if (await readFile(path.join(root, file), 'utf8').catch(() => '') !== contents) throw new Error(`${file} is stale; run npm run catalog:generate`);
} else {
  for (const [file, contents] of outputs) {
    const target = path.join(root, file); await mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.tmp-${process.pid}`; await writeFile(temp, contents); await rename(temp, target);
  }
}
