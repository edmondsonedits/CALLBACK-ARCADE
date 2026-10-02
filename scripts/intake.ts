import { cp, mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createIntakePlan, validateManifest, type GameManifest } from '../src/catalog.ts';

const [id, ...flags] = process.argv.slice(2);
const titleIndex = flags.indexOf('--title');
const title = titleIndex >= 0 ? flags[titleIndex + 1] : id?.split('-').map(x => x[0]?.toUpperCase() + x.slice(1)).join(' ');
if (!id || !title) throw new Error('usage: npm run intake -- <safe-game-id> [--title "Game Title"]');
const plan = createIntakePlan(id, 'games');
const repositoryRoot = await realpath(process.cwd());
const gamesPath = path.resolve(repositoryRoot, 'games');
const gamesRoot = await realpath(gamesPath);
if (!gamesRoot.startsWith(repositoryRoot + path.sep)) throw new Error('games folder must resolve inside the repository');
const target = path.resolve(gamesRoot, id);
if (!target.startsWith(gamesRoot + path.sep) || target !== path.join(gamesRoot, path.basename(plan.target))) throw new Error('unsafe intake destination');
const temp = await import('node:fs/promises').then(fs => fs.mkdtemp(path.join(gamesRoot, `.intake-${id}-`)));
if (!path.resolve(temp).startsWith(gamesRoot + path.sep)) throw new Error('unsafe temporary intake path');
async function exists(file: string) { try { await stat(file); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; } }
try {
  if (await exists(target)) throw new Error(`refusing to overwrite ${plan.target}`);
  await cp(path.join(gamesRoot, '_template'), temp, { recursive: true, errorOnExist: true });
  const manifestPath = path.join(temp, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as GameManifest;
  manifest.id = id;
  manifest.title = title;
  const errors = validateManifest(manifest, `games/${id}`);
  if (errors.length) throw new Error(`template validation failed: ${errors.join('; ')}`);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  if (await exists(target)) throw new Error(`refusing to overwrite ${plan.target}`);
  await rename(temp, target);
  console.log(`Created ${plan.target}; add source and evidence before marking it ready.`);
} finally {
  if (await exists(temp)) {
    const realTemp = await realpath(temp);
    if (!realTemp.startsWith(gamesRoot + path.sep)) throw new Error('refusing to clean intake path outside games folder');
    await rm(realTemp, { recursive: true, force: true });
  }
}
