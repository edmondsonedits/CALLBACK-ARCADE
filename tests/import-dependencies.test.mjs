import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
for (const file of ['games/royal-roller-ruckus/source/vendor/three.module.js','games/royal-twisted/assets/vendor/three.module.js']) {
  test(`${file} includes its local runtime dependencies`, async () => {
    const source = await readFile(file, 'utf8');
    const dependencies = [...source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)].map(m => m[1]);
    assert.ok(dependencies.length > 0);
    for (const rel of new Set(dependencies)) assert.ok((await stat(path.resolve(path.dirname(file), rel))).isFile());
  });
}
