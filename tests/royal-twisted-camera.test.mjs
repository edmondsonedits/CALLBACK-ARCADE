import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../games/royal-twisted/source/index.html',import.meta.url),'utf8');

test('Royal Twisted defaults close to CAM-3R-23-U',()=>{
  assert.match(source,/TWISTED_CAMERA_DEFAULT=Object\.freeze\(\{rotate:-45,zoom:\.75,tilt:-5\}\)/);
  assert.match(source,/callbackCameraState=\{\.\.\.TWISTED_CAMERA_DEFAULT\}/);
  assert.match(source,/callbackCameraReset\(\)\{callbackCameraSet\(TWISTED_CAMERA_DEFAULT\)/);
});

test('Royal Twisted camera framing reacts to Player 1 setback, not the whole pack',()=>{
  assert.match(source,/const focus=fighters\[0\]/);
  assert.match(source,/const focusT=clamp\(focus\?\.trackT\?\?PLAYER_T,TUNING\.hit\.minTrackT,PLAYER_T\)/);
  assert.match(source,/const playerSetback=Math\.max\(0,PLAYER_T-focusT\)/);
  assert.doesNotMatch(source,/Math\.min\(\.\.\.active\.map\(f=>f\.trackT\)\)/);
  assert.doesNotMatch(source,/Math\.max\(\.\.\.active\.map\(f=>f\.trackT\)\)/);
});

test('non-player hits do not shake the camera',()=>{
  assert.match(source,/if\(f\.player\)cameraShake=Math\.max\(cameraShake,\.62\)/);
  assert.doesNotMatch(source,/f\.player\?\.62:Math\.max\(cameraShake,\.20\)/);
});
