import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../games/royal-ballistix/source/index.html',import.meta.url),'utf8');

test('Royal Ballistix uses the selected minimal competitive mobile concept',()=>{
  assert.match(source,/data-ui-concept="minimal-competitive"/);
  assert.match(source,/class="track radial-track"/);
  assert.doesNotMatch(source,/id="run"/);
  assert.doesNotMatch(source,/id="settings" class="icon"/);
});

test('mobile movement uses radial stick distance for speed instead of a run button',()=>{
  assert.match(source,/input\.strength=clamp\(/);
  assert.match(source,/run=input\.run\|\|input\.strength>\.82/);
  assert.match(source,/knob\.style\.transform=/);
});

test('Magnet and Pulse expose compact live status and targeting feedback',()=>{
  assert.match(source,/id="magState"/);
  assert.match(source,/id="pulseState"/);
  assert.match(source,/function drawMagnetGuide\(/);
  assert.match(source,/drawMagnetGuide\(P\[0\]\)/);
  assert.match(source,/MAGNET TARGET/);
});
