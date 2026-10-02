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

assert.match(html, /const VERSION="1\\.4\\.0-vertical-crownway"/);
assert.match(html, /const MAX_PLAYERS=10/);
assert.match(html, /FIXED_DT=1\\/120/);
assert.match(html, /TRACK_SAMPLES=640/);
assert.match(html, /TRACK_WIDTH=4\\.6/);
assert.match(html, /window\\.CallbackInput=\\{/);
for (const hook of ['push(playerId,packet={})', 'disconnect(playerId)', 'setPlayerCount(count)', 'getPlayerCount()', 'getControllers()', 'getLobby()']) {
  assert.ok(html.includes(hook), `missing CallbackInput hook: ${hook}`);
}
assert.match(html, /import \\* as THREE from "\\.\\/vendor\\/three\\.module\\.js";/);
assert.doesNotMatch(html, /cdn\\.jsdelivr\\.net\\/npm\\/three/);
assert.match(original, /https:\\/\\/cdn\\.jsdelivr\\.net\\/npm\\/three@0\\.180\\.0\\/\\+esm/);
await stat(vendorPath);

const normalized = html.replace('import * as THREE from "./vendor/three.module.js";', 'import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/+esm";');
assert.equal(normalized, original, 'packaged entry should differ from the chat snapshot only by the Three.js import path');

const moduleMatch = html.match(/<script type="module">([\\s\\S]*?)<\\/script>/);
assert.ok(moduleMatch, 'module script not found');
const temp = path.join(os.tmpdir(), `royal-roller-ruckus-${process.pid}.mjs`);
const moduleBody = moduleMatch[1].replace(/^\\s*import \\* as THREE[^\\n]*\\n/m, '');
await writeFile(temp, moduleBody);
const check = spawnSync(process.execPath, ['--check', temp], { encoding: 'utf8' });
await rm(temp, { force: true });
assert.equal(check.status, 0, check.stderr || 'JavaScript syntax check failed');

console.log('Royal Roller Ruckus source smoke checks passed.');
