import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const game=path.resolve(here,'..');
const source=await readFile(path.join(game,'source/index.html'),'utf8');
const original=await readFile(path.join(game,'source/original/space_bash_orbital_breakout_v1.13.1_standalone.html'),'utf8');
assert.match(source,/const VERSION="1\.14\.0"/);
assert.match(source,/2–10 total contestants/);
assert.match(source,/window\.SpaceBash=/);
assert.match(source,/no external scripts, CDN, modules, WebGL, or network connection required/i);
assert.doesNotMatch(source,/cdn\.jsdelivr\.net/);
assert.equal(createHash('sha256').update(original).digest('hex'),
  'e6fc6342764b743bc125c0519b2f61d9384411b69b563799e26a10ac834b46d8',
  'The preserved upload must remain immutable');
assert.doesNotMatch(source, /<script[^>]+src=|fetch\s*\(|new WebSocket|new XMLHttpRequest|https?:\/\//i);
console.log('Space Bash source checks passed.');