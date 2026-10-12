import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('Royal Sumo preserves the designated v1.3.0 upload and rebuilds documented adapters identically', () => {
  const run = spawnSync(process.execPath, ['games/royal-sumo/tests/source-smoke.mjs'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});

test('Royal Sumo supplied deterministic gameplay and input tests pass', () => {
  const run = spawnSync(process.execPath, ['test/run.mjs'], {
    cwd: 'games/royal-sumo/source/project', encoding: 'utf8'
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
