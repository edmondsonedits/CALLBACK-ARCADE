import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
for (const id of ['space-bash', 'royal-scratch-match', 'royal-twisted']) {
  test(`${id} import smoke checks`, () => {
    const filename = id === 'space-bash' ? 'source-smoke.mjs' : 'smoke.mjs';
    const result = spawnSync(process.execPath, [`games/${id}/tests/${filename}`], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}
