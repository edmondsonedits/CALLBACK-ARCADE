import test from 'node:test';
import { execFileSync } from 'node:child_process';

test('Royal Roller Ruckus imported source smoke checks pass', () => {
  execFileSync(process.execPath, ['games/royal-roller-ruckus/tests/smoke.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
});
