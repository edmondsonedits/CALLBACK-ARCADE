import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
// The active build includes reviewed changes; immutable uploads retain their exact bytes.
assert.equal(createHash('sha256').update(original).digest('hex'),'68170440ea2584201fccd8cc8e6c251ae598b223af1cd9ab6aa99cac1d988ae2');
assert.equal(createHash('sha256').update(archive).digest('hex'),'50d44a32a0be10fade5ddabe00493113ee1194b69f2411b1d7d21222538a4dbe');
console.log('Royal Twisted source checks passed.');