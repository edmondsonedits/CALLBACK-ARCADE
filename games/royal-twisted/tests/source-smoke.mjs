import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const game=path.resolve(here,'..');
const source=await readFile(path.join(game,'source/index.html'),'utf8');
const original=await readFile(path.join(game,'source/original/royal_twisted_spiral_keep_v0.5_original_camera_knockback.html'),'utf8');
const archive=await readFile(path.join(game,'source/archive/royal_twisted_spiral_keep_v0.4_ten_players.html'),'utf8');
assert.match(source,/0\.5\.0-original-camera-knockback/);
assert.match(source,/window\.RoyalTwisted=/);
assert.match(source,/registerRemotePlayer/);
assert.match(source,/2–10 total players/);
assert.match(archive,/0\.4\.0-ten-player-arena/);
assert.equal(source,original);
console.log('Royal Twisted source checks passed.');