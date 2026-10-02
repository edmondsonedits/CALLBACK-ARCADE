import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const game=path.resolve(here,'..');
const source=await readFile(path.join(game,'source/index.html'),'utf8');
const original=await readFile(path.join(game,'source/original/space_bash_orbital_breakout_v1.13.1_standalone.html'),'utf8');
assert.match(source,/1\.13\.1-standalone/);
assert.match(source,/2–10 total contestants/);
assert.match(source,/window\.SpaceBash=/);
assert.match(source,/no external scripts, CDN, modules, WebGL, or network connection required/i);
assert.doesNotMatch(source,/cdn\.jsdelivr\.net/);
assert.equal(source,original);
console.log('Space Bash source checks passed.');