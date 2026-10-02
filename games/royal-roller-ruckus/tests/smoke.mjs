import assert from 'node:assert/strict';
import { readFile, stat, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const game = path.resolve(here, '..');
const sourcePath = path.join(game, 'source', 'index.html');
const originalPath = path.join(game, 'source', 'original-v1.4.0.html');
const vendorPath = path.join(game, 'source', 'vendor', 'three.module.js');
const html = await readFile(sourcePath, 'utf8');
const original = await readFile(originalPath, 'utf8');

for (const expected of [
  'const VERSION="1.4.0-vertical-crownway"',
  'const MAX_PLAYERS=10',
  'FIXED_DT=1/120',
  'TRACK_SAMPLES=640',
  'TRACK_WIDTH=4.6',
  'window.CallbackInput={',
  'import * as THREE from "./vendor/three.module.js";',
]) assert.ok(html.includes(expected), `missing source invariant: ${expected}`);

for (const hook of ['push(playerId,packet={})', 'disconnect(playerId)', 'setPlayerCount(count)', 'getPlayerCount()', 'getControllers()', 'getLobby()']) {
  assert.ok(html.includes(hook), `missing CallbackInput hook: ${hook}`);
}
assert.ok(!html.includes('cdn.jsdelivr.net/npm/three'), 'packaged entry must not depend on jsDelivr');
assert.ok(original.includes('https://cdn.jsdelivr.net/npm/three@0.180.0/+esm'), 'original chat source should preserve its CDN import');
await stat(vendorPath);

const baseline = await readFile(path.join(game, 'source', 'original', 'standalone-before-room.html'), 'utf8');
const normalized = baseline.replace('import * as THREE from "./vendor/three.module.js";', 'import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/+esm";');
assert.equal(normalized, original, 'packaged entry should differ from the chat snapshot only by the Three.js import path');

const start = html.indexOf('<script type="module">');
const end = html.indexOf('</script>', start);
assert.ok(start >= 0 && end > start, 'module script not found');
let moduleBody = html.slice(start + '<script type="module">'.length, end);
moduleBody = moduleBody.replace('import * as THREE from "./vendor/three.module.js";', '');
const temp = path.join(os.tmpdir(), `royal-roller-ruckus-${process.pid}.mjs`);
await writeFile(temp, moduleBody);
const check = spawnSync(process.execPath, ['--check', temp], { encoding: 'utf8' });
await rm(temp, { force: true });
assert.equal(check.status, 0, check.stderr || 'JavaScript syntax check failed');

console.log('Royal Roller Ruckus source smoke checks passed.');
