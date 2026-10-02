import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const repository = process.cwd();
test('intake atomically creates a validated starter, refuses overwrite, and cleans failed staging', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'arcade-intake-test-'));
  const games = path.join(fixture, 'games');
  const template = path.join(games, '_template');
  const script = path.join(repository, 'scripts/intake.ts');
  try {
    await cp(path.join(repository, 'games/_template'), template, { recursive: true });
    const id = 'fixture-game';
    const destination = path.join(games, id);
    execFileSync(process.execPath, ['--experimental-strip-types', script, id, '--title', 'Fixture Game'], { cwd: fixture, encoding: 'utf8' });
    const manifest = JSON.parse(await readFile(path.join(destination, 'manifest.json'), 'utf8'));
    assert.equal(manifest.id, id);
    assert.equal(manifest.source.status, 'awaiting-import');
    assert.throws(() => execFileSync(process.execPath, ['--experimental-strip-types', script, id], { cwd: fixture, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), /refusing to overwrite/);
    const original = await readFile(path.join(destination, 'README.md'), 'utf8');
    assert.equal(await readFile(path.join(destination, 'README.md'), 'utf8'), original);

    const failing = JSON.parse(await readFile(path.join(template, 'manifest.json'), 'utf8'));
    failing.players.min = 0;
    await writeFile(path.join(template, 'manifest.json'), JSON.stringify(failing));
    assert.throws(() => execFileSync(process.execPath, ['--experimental-strip-types', script, 'failed-game'], { cwd: fixture, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), /template validation failed/);
    assert.equal((await readdir(games)).some(name => name.startsWith('.intake-')), false);
    assert.equal((await readdir(games)).includes('failed-game'), false);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
