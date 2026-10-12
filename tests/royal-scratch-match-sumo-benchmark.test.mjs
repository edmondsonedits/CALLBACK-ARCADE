import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from '../games/royal-scratch-match/tests/runtime.mjs';

test('pause freezes judgment and overlapping hidden time exactly once', () => {
  const r=runtime();r.setup();r.advance(1000);
  r.g.ScratchMatchAPI.pause();const at=r.run('gameClock()');
  r.advance(4000);r.hidden(true);r.advance(2000);r.hidden(false);
  r.g.ScratchMatchAPI.press(0,0);assert.equal(r.run('players[0].score'),0);
  assert.equal(r.run('gameClock()'),at);r.g.ScratchMatchAPI.resume();
  assert.equal(r.run('gameClock()'),at);r.g.ScratchMatchAPI.press(0,0);
  assert.equal(r.run('players[0].perfect'),1);
});
test('CAM modal freezes musical clock and resumes without changing view ownership',()=>{
  const r=runtime();r.setup();r.advance(500);
  r.run('openCameraPause()');const at=r.run('gameClock()');r.advance(7000);
  assert.equal(r.run('gameClock()'),at);r.run('closeCameraPause()');
  assert.equal(r.run('gameClock()'),at);
});
test('musical count-in has four beats at initial phrase BPM',()=>{
  const r=runtime();r.g.ScratchMatchAPI.start();
  assert.equal(r.run('countdownStage'),4);
  r.tick(625);assert.equal(r.run('countdownStage'),3);
  r.tick(625);assert.equal(r.run('countdownStage'),2);
  r.tick(625);assert.equal(r.run('countdownStage'),1);
  r.tick(625);assert.equal(r.run('phase'),'call');
});
test('latency correction adjusts human judgment but never bot timestamp',()=>{
  const r=runtime();r.setup();r.g.ScratchMatchAPI.setSettings({latencyMs:100});
  r.advance(1100);r.g.ScratchMatchAPI.press(0,0);
  assert.equal(r.run('players[0].perfect'),1);
  assert.ok(Math.abs(r.run('players[0].timingErrors[0]'))<1e-9);
});
test('settings validate, persist and never restart active phrases',()=>{
  const r=runtime();r.setup();const before=r.run('notes[0]');
  const s=r.g.ScratchMatchAPI.setSettings({volume:99,latencyMs:-999,reducedMotion:true,vibration:false,mode:'bad'});
  assert.equal(s.volume,1);assert.equal(s.latencyMs,-200);assert.equal(s.mode,'match');
  assert.equal(r.run('phase'),'response');assert.equal(r.run('notes[0]'),before);
});
test('practice retries exact phrase, restores lives and advances only on request',()=>{
  const r=runtime();r.g.ScratchMatchAPI.start({mode:'practice',seed:31});r.run('startPhrase(3)');
  const pattern=r.run('JSON.stringify(notes.map(n=>({time:n.time,lanes:n.lanes})))');
  r.run('beginResponse();missPlayer(players[0]);repeatPracticePhrase()');
  assert.equal(r.run('phase'),'call');assert.equal(r.run('players[0].lives'),8);
  assert.equal(r.run('JSON.stringify(notes.map(n=>({time:n.time,lanes:n.lanes})))'),pattern);
  r.run("phase='practiceReview';advancePracticePhrase()");assert.equal(r.run('phraseIndex'),4);
});
test('practice reaches review even after more than eight misses',()=>{
  const r=runtime();r.g.ScratchMatchAPI.start({mode:'practice'});r.run('startPhrase(0);beginResponse();for(let i=0;i<12;i++)missPlayer(players[0])');
  assert.equal(r.run('players[0].alive'),true);assert.equal(r.run('players[0].lives'),8);
  r.advance(15000);r.tick();assert.equal(r.run('phase'),'practiceReview');
});
test('gamepad edges support chords, held buttons and reconnect neutralization',()=>{
  const r=runtime();r.setup('normal',[0,2]);r.advance(1000);
  const pad=buttons=>[{index:0,id:'pad',mapping:'standard',buttons:Array.from({length:10},(_,i)=>({pressed:buttons.includes(i)}))}];
  r.g.navigator.getGamepads=()=>pad([]);r.run('pollGamepad()');
  r.g.navigator.getGamepads=()=>pad([0,2]);r.run('pollGamepad()');
  assert.equal(r.run('players[0].perfect'),1);const count=r.run('totalInputs');
  r.run('pollGamepad()');assert.equal(r.run('totalInputs'),count);
  r.g.navigator.getGamepads=()=>[];r.run('pollGamepad()');
  r.g.navigator.getGamepads=()=>pad([0]);r.run('pollGamepad()');
  assert.equal(r.run('totalInputs'),count,'reconnected held buttons need release');
});
test('blur neutralizes held pointer and keyboard state and pauses',()=>{
  const r=runtime();r.setup();r.advance(1000);r.buttons[0].pointerdown({pointerId:7,preventDefault(){}});
  r.listeners.blur();assert.equal(r.buttons[0].captures.size,0);assert.equal(r.run('paused'),true);
});
test('same-seed replay repeats phrase generation while new match changes it',()=>{
  const r=runtime();r.g.ScratchMatchAPI.start({seed:9});r.run('startPhrase(0)');
  const p=r.run('JSON.stringify(notes.map(n=>n.lanes))');r.run('replaySession();startPhrase(0)');
  assert.equal(r.run('JSON.stringify(notes.map(n=>n.lanes))'),p);
  r.run('newSession();startPhrase(0)');assert.notEqual(r.run('sessionSeed'),9);
});
test('menu abandons active match and invalidates queued results',()=>{
  const r=runtime();r.setup();r.run('queueRoundEnd()');const timer=r.timers.at(-1);
  r.g.ScratchMatchAPI.menu();timer.fn();assert.equal(r.run('phase'),'menu');
  assert.equal(r.run('activeVoices.size'),0);
});
test('reduced motion suppresses moving effects while preserving notes and judgments',()=>{
  const r=runtime();r.setup();r.g.ScratchMatchAPI.setSettings({reducedMotion:true});
  r.advance(1000);r.g.ScratchMatchAPI.press(0,0);
  assert.equal(r.run('players[0].perfect'),1);assert.equal(r.run('particles.length'),0);
  r.run('missPlayer(players[0])');assert.equal(r.run('screenShake'),0);assert.equal(r.run('flash.a'),0);
});
test('latency-adjusted miss deadline matches both signed offsets and leaves bot timestamps alone',()=>{
  for(const offset of [-100,100]){
    const r=runtime();r.setup();r.g.ScratchMatchAPI.setSettings({latencyMs:offset});
    r.advance((1+.155+offset/1000-.000001)*1000);r.tick(.00001);
    assert.equal(r.run('players[0].misses'),0);
    r.tick(.002);assert.equal(r.run('players[0].misses'),1);
  }
  const r=runtime();r.setup();r.g.ScratchMatchAPI.setSettings({latencyMs:150});
  r.run('humanSlots=new Set([0]);players[1].human=false;gameplayRandom=()=>0;songTime=1.04;resolveBotsFor(notes[0])');
  assert.equal(r.run('players[1].perfect'),1);
});
test('settings survive reload and malformed or inaccessible storage cannot break launch',()=>{
  const r=runtime();r.g.ScratchMatchAPI.setSettings({volume:.4,latencyMs:35,reducedMotion:true,mode:'practice'});
  const next=runtime({stored:r.saved});assert.equal(next.g.ScratchMatchAPI.getSettings().latencyMs,35);assert.equal(next.g.ScratchMatchAPI.getSettings().volume,.4);
  for(const stored of ['broken', 'null', '{"volume":"bad","mode":"unknown","playerCount":99,"difficulty":"hacked"}']){
    const invalid=runtime({stored});assert.equal(invalid.g.ScratchMatchAPI.getSettings().volume,1);assert.equal(invalid.run('difficulty'),'normal');
  }
  const denied=runtime({storageError:true});denied.g.ScratchMatchAPI.start();assert.doesNotThrow(()=>denied.g.ScratchMatchAPI.setSettings({volume:.3}));
});
test('finishing callbacks cannot advance results while paused',()=>{
  const r=runtime();r.setup();r.run('queueRoundEnd()');r.g.ScratchMatchAPI.pause();r.timers.at(-1).fn();
  assert.equal(r.run('phase'),'finishing');const retry=r.timers.at(-1);r.g.ScratchMatchAPI.resume();retry.fn();
  assert.equal(r.run('phase'),'results');
});
test('menu keyboard lane and held Start cannot create accidental gameplay',()=>{
  const r=runtime();const key=k=>r.listeners.keydown({key:k,preventDefault(){}});
  key('d');key('r');assert.equal(r.run('phase'),'menu');assert.equal(r.run('audioCtx'),null);
  r.g.ScratchMatchAPI.start();const pad={index:0,id:'p',mapping:'standard',buttons:Array.from({length:10},()=>({pressed:false}))};
  r.g.navigator.getGamepads=()=>[pad];r.run('pollGamepad()');pad.buttons[9].pressed=true;r.run('pollGamepad()');
  assert.equal(r.run('paused'),true);r.run('pollGamepad()');assert.equal(r.run('paused'),true);
  pad.buttons[9].pressed=false;r.run('pollGamepad()');pad.buttons[9].pressed=true;r.run('pollGamepad()');assert.equal(r.run('paused'),false);
});
test('automatic presentation start stays silent until an enabling action',()=>{
  const r=runtime();r.run('newSession();startPhrase(0)');r.advance(2000);r.tick();
  assert.equal(r.run('audioCtx'),null);assert.equal(r.sounds.length,0);
  r.g.ScratchMatchAPI.setSound(true);assert.notEqual(r.run('audioCtx'),null);
});
test('unavailable gamepad API and malformed preference payloads stay recoverable',()=>{
  const r=runtime();r.g.navigator.getGamepads=()=>{throw Error('gamepad denied')};
  assert.doesNotThrow(()=>r.run('pollGamepad()'));assert.doesNotThrow(()=>r.g.ScratchMatchAPI.setSettings(null));
  assert.equal(r.g.ScratchMatchAPI.getSettings().volume,1);
});
