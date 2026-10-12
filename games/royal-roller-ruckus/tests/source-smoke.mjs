import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const game=path.resolve(here,'..');
const source=await readFile(path.join(game,'source/index.html'),'utf8');
const original=await readFile(path.join(game,'source/original/royal_roller_ruckus_v1.4_vertical_crownway.html'),'utf8');
assert.match(source,/1\.4\.0-vertical-crownway/);
assert.match(source,/const MAX_PLAYERS=10/);
assert.match(source,/window\.CallbackInput=/);
assert.match(source,/RESPAWN AT CHECKPOINT/);
assert.match(source,/WASD/);
assert.equal(createHash('sha256').update(original).digest('hex'),'643eea4257d0ab94ba9aee6ca2706b83b43ae10e1d9a05de7d2fd83289c2b515');
assert.match(source,/window\.CallbackCamera=/);
assert.match(source,/manual-resume/);
console.log('Royal Roller Ruckus source checks passed.');