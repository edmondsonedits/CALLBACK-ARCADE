import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=id=>readFile(new URL(`../games/${id}/source/index.html`,import.meta.url),'utf8');

for (const id of ['royal-ballistix','royal-sumo','royal-twisted','royal-roller-ruckus','space-bash']) {
  test(`${id} settings stay paused until an explicit resume`, async()=>{
    const source=await read(id);
    assert.match(source,/data-pause-flow="manual-resume"/);
    assert.match(source,/data-resume-game/);
  });
}

test('Sumo and Twisted do not stack the pause overlay over settings', async()=>{
  for (const id of ['royal-sumo','royal-twisted']) {
    const source=await read(id);
    assert.doesNotMatch(source,/settingsBtn\.addEventListener\("click",\(\)=>\{settingsModal\.classList\.add\("open"\);togglePause\(true\)/);
  }
});

test('closing settings never directly resumes gameplay', async()=>{
  const ballistix=await read('royal-ballistix');
  const roller=await read('royal-roller-ruckus');
  const space=await read('space-bash');
  assert.doesNotMatch(ballistix,/function closeSettings\(\).*G\.paused=false/);
  assert.doesNotMatch(roller,/closeSettings\.addEventListener\("click",\(\)=>\{settingsModal\.classList\.remove\("open"\);paused=false/);
  assert.doesNotMatch(space,/close\.onclick=\(\)=>\{modal\.classList\.remove\("open"\);paused=false/);
});
