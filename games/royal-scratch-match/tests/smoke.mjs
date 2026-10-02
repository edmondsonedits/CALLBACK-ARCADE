import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(here, '../source/index.html');
const source = await readFile(sourcePath, 'utf8');
const sha256 = createHash('sha256').update(source).digest('hex');

assert.equal(sha256, '6c58614db13495393512e9f69496da686dc2962b3cabd49d71680493170cbb03', 'imported source bytes changed from the supplied v0.5 attachment');
assert.match(source, /let playerCount=4;/, 'default player count missing');
assert.match(source, /clamp\(n\|0,2,10\)/, '2–10 player-count clamp missing');
assert.match(source, /window\.ScratchMatchAPI\s*=\s*\{/, 'ScratchMatchAPI missing');
assert.match(source, /press\(playerIndex,lane\)/, 'per-player press hook missing');
assert.match(source, /configure\(opts=\{\}\)/, 'configure hook missing');
assert.match(source, /humanPlayers/, 'human slot configuration missing');
assert.match(source, /window\.GameDebug\s*=\s*\{/, 'GameDebug hook missing');
assert.match(source, /function resolveBotsFor\(n\)/, 'bot resolver missing');
assert.match(source, /const y=lerp\(g\.topY,g\.targetY,q\)/, 'notes no longer travel toward the player-facing target line');
assert.match(source, /addEventListener\('pointerdown'/, 'touch/pointer input wiring missing');
assert.match(source, /const keyMap=\{d:0,f:1,j:2,k:3/, 'keyboard mapping missing');
assert.doesNotMatch(source, /<(?:script|img|audio|video|source)[^>]+(?:src|href)=["']https?:\/\//i, 'unexpected external runtime asset dependency');

const scriptMatch = source.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/i);
assert.ok(scriptMatch, 'inline game script could not be extracted');
if (process.argv.includes('--write-script')) {
  const output = path.resolve(here, '.scratch-match-inline.js');
  await writeFile(output, scriptMatch[1]);
  console.log('wrote ' + output);
}
console.log('Royal Scratch Match v0.5 smoke check passed (' + sha256 + ')');
