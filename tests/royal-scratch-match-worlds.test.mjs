import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from '../games/royal-scratch-match/tests/runtime.mjs';
const pattern=r=>r.run('JSON.stringify(notes.map(n=>[n.time,n.lanes,n.responseLanes]))');
for(const stage of ['royal','tide','foundry','mirror'])test(`${stage} exact rehearsal and legal bot responses`,()=>{
 const r=runtime();r.g.ScratchMatchAPI.start({stage,mode:'practice',seed:55,playerCount:10});r.run('startPhrase(2)');const p=pattern(r);
 r.run('beginResponse();for(const n of notes){songTime=n.time+.2;resolveBotsFor(n)};repeatPracticePhrase()');assert.equal(pattern(r),p);
 assert.equal(r.g.ScratchMatchAPI.getState().stage,stage);assert.equal(r.run('players.length'),10);
});
test('swing pairs and foundry offbeats/chords actually change musical timestamps',()=>{
 const r=runtime();r.g.ScratchMatchAPI.start({stage:'tide',seed:9});r.run('startPhrase(0)');
 assert.ok(Math.abs(r.run('(notes[1].time-notes[0].time)/phraseBeat')-2/3)<1e-9);
 assert.ok(Math.abs(r.run('(notes[2].time-notes[1].time)/phraseBeat')-1/3)<1e-9);
 r.g.ScratchMatchAPI.start({stage:'foundry',seed:9});r.run('startPhrase(0)');assert.equal(r.run('notes[1].lanes.length'),2);
 assert.ok(Math.abs(r.run('(notes[1].time-notes[0].time)/phraseBeat')-.5)<1e-9);
});
test('mirror response lanes are demonstrated and judged identically for human and bots',()=>{
 const r=runtime();r.g.ScratchMatchAPI.start({stage:'mirror',seed:21});r.run('startPhrase(0);beginResponse()');
 const lane=r.run('notes[0].lanes[0]');assert.equal(r.run('notes[0].responseLanes[0]'),3-lane);
 r.advance(r.run('notes[0].time')*1000);r.g.ScratchMatchAPI.press(0,3-lane);assert.equal(r.run('players[0].perfect'),1);
 r.run('gameplayRandom=()=>0;songTime=notes[0].time+.04;resolveBotsFor(notes[0])');assert.equal(r.run('players[1].perfect'),1);
});
test('title demo progresses through shared call/response without real state or sound leakage',()=>{
 const r=runtime();const seed=r.run('randomState');for(let i=0;i<1800;i++)r.tick(10);
 const s=r.g.ScratchMatchAPI.getState();assert.equal(s.phase,'menu');assert.equal(s.demo.active,true);assert.ok(s.demo.resolved>0);
 assert.equal(r.run('randomState'),seed);assert.equal(r.run('players.every(p=>p.score===0)'),true);assert.equal(r.sounds.length,0);assert.equal(r.saved,null);
 r.g.ScratchMatchAPI.start({seed:12});assert.equal(r.g.ScratchMatchAPI.getState().demo.active,false);assert.equal(r.run('players.every(p=>p.score===0&&p.lives===8)'),true);
 r.g.ScratchMatchAPI.menu();r.sounds.length=0;for(let i=0;i<1800;i++)r.tick(10);assert.equal(r.sounds.length,0);assert.equal(r.run('activeVoices.size'),0);
});
test('staged rules change only on start, style applies immediately, tempo scales count and notes',()=>{
 const r=runtime();r.g.ScratchMatchAPI.start({seed:9});r.run('startPhrase(0)');const p=pattern(r);
 r.g.ScratchMatchAPI.setSettings({stage:'tide',tempo:'relaxed',phraseGoal:3,name:'Lute',costume:'crown',highContrast:true});assert.equal(pattern(r),p);assert.equal(r.g.ScratchMatchAPI.getState().stage,'royal');assert.equal(r.run('players[0].name'),'Lute');
 r.run('newSession()');r.tick(625);assert.equal(r.run('countdownStage'),4);r.run('startPhrase(0)');assert.ok(Math.abs(r.run('phraseBpm')-76.8)<1e-9);
});
test('tour has four stages, per-stage records, aggregate score and clean replay',()=>{
 const r=runtime();r.g.ScratchMatchAPI.start({mode:'tour',seed:42});
 for(let i=0;i<4;i++){r.run('players[0].score=100;endRound()');if(i<3)r.run('nextTourStage()');}
 assert.equal(r.g.ScratchMatchAPI.getState().tour.records.length,4);assert.equal(r.g.ScratchMatchAPI.getState().tour.totalScore,400);
 r.g.ScratchMatchAPI.replay();assert.equal(r.g.ScratchMatchAPI.getState().tour.records.length,0);assert.equal(r.g.ScratchMatchAPI.getState().stage,'royal');
});
test('focused native text fields accept spaces and p/r/m keys without shortcuts',()=>{
 const r=runtime();for(const key of ['p','r','m','d',' '])r.listeners.keydown({key,target:{tagName:'INPUT'},preventDefault(){throw Error('native key prevented')}});
 assert.equal(r.run('phase'),'menu');assert.equal(r.run('audioCtx'),null);
});
test('new settings reject malformed values and survive denied storage',()=>{
 for(const storageError of [false,true]){const r=runtime({storageError,stored:JSON.stringify({stage:'other',tempo:'warp',phraseGoal:99,name:' ',color:'red',voice:'loud',costume:'invisible',highContrast:'yes'})});
 const s=r.g.ScratchMatchAPI.getSettings();assert.equal(s.stage,'royal');assert.equal(s.tempo,'standard');assert.equal(s.phraseGoal,9);assert.equal(s.name,'YOU');assert.equal(s.color,'#ff5db1');
 r.g.ScratchMatchAPI.setSettings({stage:'foundry',tempo:'brisk',phraseGoal:3,name:'  Court Bard  ',color:'#22aabb',voice:'bell',costume:'mage',highContrast:true});
 assert.equal(r.g.ScratchMatchAPI.getSettings().name,'Court Bard');if(!storageError){const p=runtime({stored:r.saved}).g.ScratchMatchAPI.getSettings();assert.equal(p.stage,'foundry');assert.equal(p.phraseGoal,3);assert.equal(p.voice,'bell');assert.equal(p.highContrast,true);}}
});
test('API seat changes rebuild demo independently and clean starts retain configured humans',()=>{
 const r=runtime();r.g.ScratchMatchAPI.configure({playerCount:10,humanPlayers:[0,3],seed:66});assert.equal(r.run('demo.players.length'),10);
 for(let i=0;i<1500;i++)r.tick(10);assert.equal(r.run('players.every(p=>p.score===0)'),true);assert.equal(r.run('demo.players.every(p=>!p.human&&!p.local)'),true);
 r.g.ScratchMatchAPI.start();assert.equal(r.run('players.length'),10);assert.equal(r.run('players.filter(p=>p.human).map(p=>p.id).join()'),'0,3');
 r.g.ScratchMatchAPI.configure({playerCount:2,humanPlayers:[0]});r.g.ScratchMatchAPI.start();assert.equal(r.run('players.length'),2);assert.equal(r.run('notes.length'),0);
});
test('staged seat and difficulty UI preserve active phrase and apply on fresh Start',()=>{
 const r=runtime();r.g.ScratchMatchAPI.start({seed:42});r.run('startPhrase(0)');const before=pattern(r);
 r.run("setPlayerCount(10);document.getElementById('difficultySetting').onchange({target:{value:'hard'}})");
 assert.equal(r.run('players.length'),4);assert.equal(r.run('difficulty'),'normal');assert.equal(pattern(r),before);
 r.run('newSession()');assert.equal(r.run('players.length'),10);assert.equal(r.run('difficulty'),'hard');
});
test('mirror chord requires every transformed rune and wrong call rune fails fairly',()=>{
 const r=runtime();r.g.ScratchMatchAPI.start({stage:'mirror',seed:11});r.run("phase='response';phaseClock=gameClock();notes=[{time:1,lanes:[0,1],responseLanes:[2,3],responses:players.map(()=>({hits:new Set(),errors:[],resolved:false}))}]");r.advance(1000);
 r.g.ScratchMatchAPI.press(0,2);assert.equal(r.run('players[0].score'),0);r.g.ScratchMatchAPI.press(0,3);assert.equal(r.run('players[0].perfect'),1);assert.equal(r.run('players[0].score'),200);
 const other=runtime();other.g.ScratchMatchAPI.start({stage:'mirror',seed:11});other.run('startPhrase(0);beginResponse()');other.advance(other.run('notes[0].time')*1000);other.g.ScratchMatchAPI.press(0,other.run('notes[0].lanes[0]'));assert.equal(other.run('players[0].misses'),1);
});
test('all stages schedule call audio at authoritative note timestamps with unchanged windows',()=>{
 for(const stage of ['royal','tide','foundry','mirror']){const r=runtime();r.g.ScratchMatchAPI.start({stage,tempo:'brisk',seed:70});r.run('startPhrase(0)');const time=r.run('notes[1].time');r.advance((time-.08)*1000);r.sounds.length=0;r.tick(.00001);
 assert.ok(r.sounds.some(s=>Math.abs(s.t-3.08)<.000001));assert.equal(r.g.ScratchMatchAPI.getState().timingWindow,.155);assert.equal(r.g.ScratchMatchAPI.getState().perfectWindow,.063);}
});
test('same-seed replay retains original stage and tempo despite staged changes and title RNG',()=>{
 const r=runtime();r.g.ScratchMatchAPI.start({stage:'tide',tempo:'brisk',seed:82});r.run('startPhrase(2)');const p=pattern(r);
 r.g.ScratchMatchAPI.setSettings({stage:'mirror',tempo:'relaxed'});r.g.ScratchMatchAPI.menu();for(let i=0;i<2200;i++)r.tick(10);r.g.ScratchMatchAPI.replay();r.run('startPhrase(2)');assert.equal(pattern(r),p);
});
test('watch/return and settings freeze preserve live demo and never enable audio',()=>{
 const r=runtime();r.run('watchDemo(true)');assert.equal(r.run('watching'),true);r.tick(800);const t=r.run('demo.songTime');r.run('openSettings()');r.tick(4000);assert.equal(r.run('demo.songTime'),t);r.run('closeSettings();watchDemo(false)');r.tick(200);assert.ok(r.run('demo.songTime')>t);assert.equal(r.run('audioCtx'),null);
});
test('all stage scene renderers and bounded impact effects execute at ten seats',()=>{
 for(const stage of ['royal','tide','foundry','mirror']){const r=runtime();r.g.ScratchMatchAPI.start({stage,playerCount:10,seed:7});r.run('startPhrase(0);W=844;H=390;draw();for(let i=0;i<100;i++)burstLane(i%4,true);drawParticles()');assert.ok(r.run('particles.length')<=240);assert.ok(r.run('sparks.length')<=48);assert.ok(r.drawCalls.length>100);assert.ok(r.run('highwayGeom().targetY>highwayGeom().topY'));}
});
