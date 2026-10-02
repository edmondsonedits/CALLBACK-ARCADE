import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const game=path.resolve(here,'..');
const source=await readFile(path.join(game,'source/index.html'),'utf8');
const original=await readFile(path.join(game,'source/original/royal_sumo_crownfall_v0.21_player_scaled_arena.html'),'utf8');
const threeModule=await readFile(path.join(game,'source/vendor/three.module.js'),'utf8');
const threeCore=await readFile(path.join(game,'source/vendor/three.core.js'),'utf8');
const license=await readFile(path.join(game,'source/vendor/LICENSE-three.txt'),'utf8');

assert.match(source,/const VERSION = "0\.21\.0-crownfall";/);
assert.match(source,/import \* as THREE from "\.\/vendor\/three\.module\.js";/);
assert.doesNotMatch(source,/cdn\.jsdelivr\.net\/npm\/three/);
assert.match(original,/https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.180\.0\/\+esm/);
assert.match(source,/const MAX_PLAYERS = 10;/);
assert.match(source,/option value="10">10 fighters/);
assert.match(source,/function submitRemoteInput\(/);
assert.match(source,/updateRemoteHuman/);
assert.match(source,/setHumanSlot/);
assert.match(source,/submitInput:submitRemoteInput/);
assert.match(source,/getState:/);
assert.match(source,/touch-action:none/);
assert.match(source,/overscroll-behavior:none/);
assert.match(source,/name==="tenplayers"/);
assert.match(source,/name==="crowdpressure"/);
assert.match(source,/const CROWD_ARENA/);
assert.match(threeModule,/\.\/three\.core\.js/);
assert.match(threeCore,/const REVISION = '180';/);
assert.match(license,/MIT License/);

console.log('Royal Sumo v0.21 source smoke checks passed.');
