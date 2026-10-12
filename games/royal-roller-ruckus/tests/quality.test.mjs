import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';

test('checkpoint requires forward crossing, not proximity or reverse approach',()=>{
 const h=harness();h.run('pose(racers[0],79);checkpointUpdate(racers[0]);');assert.equal(h.run('racers[0].nextCheckpoint'),1);
 h.run('pose(racers[0],81);checkpointUpdate(racers[0]);');assert.equal(h.run('racers[0].nextCheckpoint'),2);
 const b=harness();b.run('pose(racers[0],81);checkpointUpdate(racers[0]);pose(racers[0],79);checkpointUpdate(racers[0]);');assert.equal(b.run('racers[0].nextCheckpoint'),1);
});
test('checkpoints cannot be skipped, crossed airborne, or on another vertical deck',()=>{
 for(const setup of ['pose(r,161)','pose(r,79);checkpointUpdate(r);pose(r,81);r.falling=true','pose(r,79);r.y+=6;checkpointUpdate(r);pose(r,81);r.y+=6']){
  const h=harness();h.run(`{const r=racers[0];${setup};checkpointUpdate(r);}`);assert.equal(h.run('racers[0].nextCheckpoint'),1,setup);
 }
});
test('legal landing on the next gate does not grant credit; recrossing it does',()=>{
 const h=harness();h.run('const r=racers[0];r.falling=true;r.vy=-4;pose(r,80);landOnTrack(r,{idx:80,lateral:0,surfaceY:0});checkpointUpdate(r);');
 assert.equal(h.run('r.falling'),false);assert.equal(h.run('r.nextCheckpoint'),1);h.run('cross(r,1)');assert.equal(h.run('r.nextCheckpoint'),2);
});
test('respawn preserves validated progress and repeated recovery cannot duplicate a lap',()=>{
 const h=harness();h.run('const r=racers[0];for(let c=1;c<8;c++)cross(r,c);r.falling=true;respawn(r);respawn(r);checkpointUpdate(r);');
 assert.deepEqual(Array.from(h.run('[r.lap,r.nextCheckpoint,r.lastCheckpointIdx,r.trackIdx]')),[0,0,560,566]);h.run('cross(r,0)');assert.equal(h.run('r.lap'),1);
});
test('rank stays behind validated progress when a racer skips ahead or starts behind line',()=>{
 const h=harness();h.run('const a=racers[0],b=racers[1];cross(a,1);pose(b,639);');assert.equal(h.run('standings()[0].id'),0);
});
test('collisions respect separate crossover heights',()=>{
 const h=harness();h.run('const a=racers[0],b=racers[1];b.x=a.x+.1;b.z=a.z;b.y=a.y+6;');assert.equal(h.run('collide(a,b)'),false);
});
for(const count of [2,10])test(`${count} exactly coincident racers separate without nonfinite values`,()=>{
 const h=harness();h.run(`racerCountEl.value='${count}';resetRace();for(const r of racers){r.x=0;r.y=0;r.z=0;r.vx=r.vz=0;}for(let n=0;n<120;n++)for(let i=0;i<racers.length;i++)for(let j=i+1;j<racers.length;j++)collide(racers[i],racers[j]);`);
 assert.equal(h.run('racers.every(r=>[r.x,r.y,r.z,r.vx,r.vz].every(Number.isFinite))'),true);
 assert.ok(h.run('Math.min(...racers.flatMap((a,i)=>racers.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.z-b.z))))')>1.10);
});
for(const count of [2,4,10])test(`${count} seats complete ordered three-lap progression with unique finish/reset state`,()=>{
 const h=harness();h.run(`racerCountEl.value='${count}';resetRace();for(let i=0;i<${count};i++)networkInputs[i].connected=true;for(let lap=0;lap<3;lap++)for(let cp=1;cp<=8;cp++)for(const r of racers)cross(r,cp%8);for(const r of racers)finishRacer(r);`);
 assert.equal(h.run('finishOrder.length'),count);assert.equal(h.run('new Set(racers.map(r=>r.finishRank)).size'),count);assert.equal(h.run('phase'),'finish');
 h.run('let reveals=0;revealFinish=()=>reveals++;updatePhase(2);updatePhase(2);');assert.equal(h.run('reveals'),1);
 h.run('resetRace()');assert.equal(h.run('finishOrder.length'),0);assert.equal(h.run('racers.every(r=>!r.finished&&r.finishRank===0&&r.lap===0)'),true);
});
test('blur clears keys and touch and requires explicit resume',()=>{
 const h=harness();h.fire('keydown',{code:'KeyW'});h.run('joystick.x=.8;joystick.active=true;');h.fire('blur');
 assert.equal(h.run('readKeyboardTouch().moveY'),0);assert.equal(h.run('joystick.active'),false);assert.equal(h.run('paused'),true);h.click('#resumeBtn');assert.equal(h.run('paused'),false);
});
test('pause/settings clear held input, closing settings stays paused',()=>{
 const h=harness();h.fire('keydown',{code:'KeyW'});h.click('#settingsBtn');h.click('#closeSettings');assert.equal(h.run('paused'),true);h.click('#resumeBtn');assert.equal(h.run('readKeyboardTouch().moveY'),0);
});
test('touch cancellation neutralizes the stick',()=>{
 const h=harness();h.run('joystick.pointerId=3;joystick.active=true;joystick.x=.8;');const el=h.els.get('#joyWrap');for(const f of el.events.pointercancel)f({pointerId:3,preventDefault(){}});assert.equal(h.run('readKeyboardTouch().moveX'),0);
});
test('disconnect neutralizes network packet, smoothed steering and public input state',()=>{
 const h=harness();h.run('window.CallbackInput.push(0,{moveX:1,sequence:1});samplePlayerInput(0);racers[0].inputX=1;window.CallbackInput.disconnect(0);');
 assert.equal(h.run('window.CallbackInput.getState(0).moveX'),0);assert.equal(h.run('racers[0].inputX'),0);assert.equal(h.run('samplePlayerInput(0).moveX'),0);
});

test('countersteering shortens stopping distance by 15% while preserving acceleration on three grades',()=>{
 for(const [slope,baselineAccel,baselineStop] of [[.002541635,.608333,2.522131],[.045858358,.616667,2.440420],[.121252423,.641667,2.356949]]){
  const h=harness();const result=h.run(`(()=>{const r=racers[0];Object.assign(r,{vx:0,vz:0,inputX:0,inputZ:0});let raw={moveX:0,moveY:-1};samplePlayerInput=()=>raw;cameraBasis=()=>({f:{x:1,z:0},right:{x:0,z:1}});const dt=1/120;let elapsed=0,dist=0;function step(){updatePlayer(r,dt);const sp=Math.hypot(r.vx,r.vz);if(sp>7.7){r.vx*=7.7/sp;r.vz*=7.7/sp;}dist+=r.vx*dt;r.vx=r.vx*Math.exp(-.34*dt)-11.5*${slope}*.58*dt;r.vz*=Math.exp(-.34*dt);elapsed+=dt;return r.vx;}while(step()<7&&elapsed<5){}const acceleration=elapsed;raw={moveX:0,moveY:1};elapsed=0;dist=0;while(step()>0&&elapsed<5){}return{acceleration,stopDistance:dist,stopTime:elapsed};})()`);
  assert.ok(Math.abs(result.acceleration/baselineAccel-1)<.10,JSON.stringify(result));assert.ok(result.stopDistance<=baselineStop*.85,JSON.stringify(result));
 }
});

test('checkpoint sweep rejects lateral shortcut and long jumps across a gate',()=>{
 for(const code of ['pose(r,79,4);checkpointUpdate(r);pose(r,81,4);checkpointUpdate(r);','pose(r,70);checkpointUpdate(r);pose(r,81);checkpointUpdate(r);']){
  const h=harness();h.run(`const r=racers[0];${code}`);assert.equal(h.run('r.nextCheckpoint'),1);
 }
});
test('keyboard repeat cannot toggle pause repeatedly or bypass open settings',()=>{
 const h=harness();h.fire('keydown',{code:'KeyP'});assert.equal(h.run('paused'),true);h.fire('keydown',{code:'KeyP',repeat:true});assert.equal(h.run('paused'),true);h.click('#settingsBtn');h.fire('keydown',{code:'KeyP'});assert.equal(h.run('paused'),true);
});
test('remote hooks retain bounded seats, lobby and controller state',()=>{
 const h=harness();assert.equal(h.run('window.CallbackInput.setPlayerCount(20)'),10);assert.equal(h.run('window.CallbackInput.getLobby().length'),10);assert.equal(h.run('window.CallbackInput.getControllers().length'),10);assert.equal(h.run('window.CallbackInput.push(.5,{moveX:1})'),false);
});

test('packets received while paused cannot leave held actions on resume',()=>{
 const h=harness();h.run('togglePause(true);window.CallbackInput.push(0,{moveX:1,primaryAction:true,secondaryAction:true,sequence:1});togglePause(false);');
 assert.equal(h.run('samplePlayerInput(0).primaryAction'),false);assert.equal(h.run('samplePlayerInput(0).secondaryAction'),false);
});
