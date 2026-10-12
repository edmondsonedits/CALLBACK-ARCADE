import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const game = fileURLToPath(new URL('../', import.meta.url));
const source = await readFile(path.join(game, 'source/index.html'));
const original = await readFile(path.join(game, 'source/original/royal_sumo_crownfall_v1.3.0.html'));
const manifest = JSON.parse(await readFile(path.join(game, 'manifest.json'), 'utf8'));
assert.deepEqual(source, original, 'Active Royal Sumo must preserve the designated upload exactly');
assert.equal(createHash('sha256').update(original).digest('hex'), '86bcf200c457a9b3da5cb222bcd5e22a46cc95d229b98edf53354eb503589c7e');
assert.equal(manifest.version, '1.3.0');
assert.equal(manifest.players.max, 10);
const out = await mkdtemp(path.join(tmpdir(), 'royal-sumo-build-'));
try {
  const run = spawnSync(process.execPath, ['build.js', '--out', out], {
    cwd: path.join(game, 'source/project'), encoding: 'utf8'
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.deepEqual(await readFile(path.join(out, 'index.html')), source, 'Editable source must reproduce the supplied HTML exactly');
} finally {
  await rm(out, { recursive: true, force: true });
}
console.log('Royal Sumo v1.3.0 exact-upload and reproducible-build checks passed.');
