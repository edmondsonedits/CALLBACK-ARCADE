import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('new uploaded arcade games have runnable entry files and preserved originals', async()=>{
  const twisted=await read('games/royal-twisted/source/index.html');
  const twistedOriginal=await read('games/royal-twisted/source/original/royal_twisted_spiral_keep_v0.5_original_camera_knockback.html');
  const roller=await read('games/royal-roller-ruckus/source/index.html');
  const rollerOriginal=await read('games/royal-roller-ruckus/source/original/royal_roller_ruckus_v1.4_vertical_crownway.html');
  const space=await read('games/space-bash/source/index.html');
  const spaceOriginal=await read('games/space-bash/source/original/space_bash_orbital_breakout_v1.13.1_standalone.html');

  assert.equal(twisted,twistedOriginal);
  assert.equal(roller,rollerOriginal);
  assert.equal(space,spaceOriginal);
  assert.match(twisted,/0\.5\.0-original-camera-knockback/);
  assert.match(roller,/1\.4\.0-vertical-crownway/);
  assert.match(space,/1\.13\.1-standalone/);
});

test('older uploaded builds are archived rather than promoted over newer versions', async()=>{
  assert.match(await read('games/royal-twisted/source/archive/royal_twisted_spiral_keep_v0.4_ten_players.html'),/0\.4\.0-ten-player-arena/);
  assert.match(await read('games/royal-sumo/source/archive/royal_sumo_crownfall_v0.19_10players.html'),/0\.19\.0-crownfall/);
  const currentSumo=JSON.parse(await read('games/royal-sumo/manifest.json'));
  assert.equal(currentSumo.version,'0.21.0');
});