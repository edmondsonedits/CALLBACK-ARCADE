import test from 'node:test';
import assert from 'node:assert/strict';
import { isProductionDatabaseId } from '../scripts/deployment.ts';
import { execFileSync } from 'node:child_process';
test('production deploy preflight rejects placeholder and malformed D1 IDs', () => {
  for (const id of [undefined, '', 'local-only-placeholder', '00000000-0000-0000-0000-000000000000', '------------------------------------']) assert.equal(isProductionDatabaseId(id), false);
  assert.equal(isProductionDatabaseId('123e4567-e89b-42d3-a456-426614174000'), true);
  assert.throws(() => execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/deploy-preflight.ts', '--production'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), /Production deploy blocked/);
});
