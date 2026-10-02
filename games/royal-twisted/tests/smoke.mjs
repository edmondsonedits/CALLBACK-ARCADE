import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const game = path.resolve(here, '..');
const html = await readFile(path.join(game, 'source', 'index.html'), 'utf8');
const manifest = JSON.parse(await readFile(path.join(game, 'manifest.json'), 'utf8'));

assert.equal(manifest.id, 'royal-twisted');
assert.equal(manifest.version, '0.5.0');
assert.equal(manifest.source.status, 'imported');
assert.deepEqual(manifest.source.paths, ['source/index.html']);
assert.deepEqual(manifest.players, { min: 2, max: 10 });
assert.equal(manifest.multiplayer.status, 'not-integrated');
assert.deepEqual(manifest.multiplayer.evidence, []);

assert.match(html, /const VERSION="0\.5\.0-original-camera-knockback"/);
assert.match(html, /import \* as THREE from "\.\.\/assets\/vendor\/three\.module\.js"/);
assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/three/);
assert.match(html, /fixedDt:1\/120/);
assert.match(html, /maxLives:7/);
assert.match(html, /setbackT:\.045/);
assert.match(html, /setPlayerCount:n=>/);
assert.match(html, /registerRemotePlayer:/);
assert.match(html, /releaseRemotePlayer:/);
assert.match(html, /input:\(id,cmd,value=true\)=>/);
assert.match(html, /controller!=="ai"/);
assert.match(html, /Math\.min\(10/);
assert.match(html, /window\.GameDebug=/);

assert.ok((await stat(path.join(game, 'assets', 'vendor', 'three.module.js'))).size > 500_000);
assert.ok((await stat(path.join(game, 'assets', 'vendor', 'three-LICENSE.txt'))).size > 500);

console.log('royal-twisted smoke: PASS');
