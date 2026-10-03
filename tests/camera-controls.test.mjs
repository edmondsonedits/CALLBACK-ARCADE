import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const games = [
  'royal-ballistix',
  'royal-scratch-match',
  'royal-sumo',
  'royal-twisted',
  'royal-roller-ruckus',
  'space-bash',
];

for (const id of games) {
  test(`${id} exposes adjustable camera controls and save/load codes`, async () => {
    const source = await readFile(new URL(`../games/${id}/source/index.html`, import.meta.url), 'utf8');
    assert.match(source, /data-camera-control="rotate"/);
    assert.match(source, /data-camera-control="zoom"/);
    assert.match(source, /data-camera-control="tilt"/);
    assert.match(source, /data-camera-action="reset"/);
    assert.match(source, /data-camera-action="save"/);
    assert.match(source, /data-camera-action="load"/);
    assert.match(source, /window\.CallbackCamera/);
    assert.match(source, /CAM-/);
  });
}
