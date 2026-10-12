import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, source } from '../games/royal-roller-ruckus/tests/harness.mjs';

test('settings reject malformed values and survive unavailable storage',()=>{
 const h=harness();
 const s=h.run(`normalizeRaceSettings({difficulty:'impossible',racers:99,laps:2,volume:'oops',reduceMotion:'yes',haptics:false,graphics:'potato'})`);
 assert.equal(s.difficulty,'normal');assert.equal(s.racers,10);assert.equal(s.laps,3);assert.equal(s.volume,.72);assert.equal(s.reduceMotion,false);assert.equal(s.haptics,false);assert.equal(s.graphics,'balanced');
 assert.doesNotThrow(()=>h.run('persistRaceSettings();loadRaceSettings();'));
});
test('opening setup freezes time, clears held inputs and starts a deliberate countdown',()=>{
 const h=harness();h.fire('keydown',{code:'KeyW'});h.run('raceTime=12;openRaceSetup();updatePhase(10);fixedUpdate(1);');
 assert.equal(h.run('phase'),'setup');assert.equal(h.run('raceTime'),12);assert.equal(h.run('readKeyboardTouch().moveY'),0);
 h.click('#startRaceBtn');assert.equal(h.run('phase'),'countdown');assert.equal(h.run('paused'),false);assert.equal(h.run('raceTime'),0);
});
test('race rule edits are staged until an explicit new race',()=>{
 const h=harness();h.run('phase="race";targetLaps=3;');
 const el=h.els.get('#lapSetting');el.value='1';for(const fn of el.events.change)fn({});
 assert.equal(h.run('targetLaps'),3);h.run('resetRace()');assert.equal(h.run('targetLaps'),1);
});
test('lap timing counts only validated gates and recovery cannot award a split',()=>{
 const h=harness();h.run('const r=racers[0];raceTime=40;for(let c=1;c<8;c++)cross(r,c);respawn(r);checkpointUpdate(r);');
 assert.equal(h.run('r.lapTimes.length'),0);h.run('cross(r,0)');assert.deepEqual(Array.from(h.run('r.lapTimes')),[40]);
 h.run('raceTime=75;for(let c=1;c<=8;c++)cross(r,c%8);');assert.deepEqual(Array.from(h.run('r.lapTimes')),[40,35]);
});
test('coaching distinguishes wrong way, missed gate, edge and airborne recovery',()=>{
 const h=harness();h.run('const r=racers[0];pose(r,20);const t=trackTangents[r.trackIdx];r.vx=-t.x*3;r.vz=-t.z*3;');
 assert.match(h.run('raceGuidance(r).text'),/WRONG WAY/);
 h.run('r.vx=r.vz=0;pose(r,84)');assert.match(h.run('raceGuidance(r).text'),/MISSED CP 1/);
 h.run('pose(r,20);r.offDist=TRACK_WIDTH*.49');assert.match(h.run('raceGuidance(r).text'),/EDGE/);
 h.run('r.falling=true');assert.match(h.run('raceGuidance(r).text'),/RECOVER/);
});
test('personal best records are rules-scoped and only improve on legal completed races',()=>{
 const h=harness();h.run('raceTime=100;const r=racers[0];for(let lap=0;lap<3;lap++)for(let c=1;c<=8;c++)cross(r,c%8);');
 assert.equal(h.run('personalBests[recordKey()].race'),100);
 h.run('resetRace();raceTime=120;for(let lap=0;lap<3;lap++)for(let c=1;c<=8;c++)cross(racers[0],c%8);');assert.equal(h.run('personalBests[recordKey()].race'),100);
 h.run('lapSetting.value="1";resetRace();raceTime=35;for(let c=1;c<=8;c++)cross(racers[0],c%8);');assert.equal(h.run('personalBests[recordKey()].race'),35);
});
test('result rows retain finish times and label unfinished rivals honestly',()=>{
 const h=harness();h.run('raceTime=30;finishRacer(racers[1]);raceTime=35;finishRacer(racers[0]);renderRaceResults();');
 assert.match(h.els.get('#resultsList').innerHTML,/0:30.0/);assert.match(h.els.get('#resultsList').innerHTML,/Unfinished/);
});
test('gamepad pause and recover buttons trigger once per press',()=>{
 const h=harness();h.run('let pressed=true;navigator.getGamepads=()=>[{connected:true,index:0,axes:[0,0],buttons:Array.from({length:10},(_,i)=>({pressed:i===9&&pressed}))}];pollGamepadActions();pollGamepadActions();');
 assert.equal(h.run('paused'),true);h.run('pressed=false;pollGamepadActions();pressed=true;pollGamepadActions();');assert.equal(h.run('paused'),false);
});
test('audio stays locked until an enabling gesture and reduced motion suppresses flash effects',()=>{
 const h=harness();h.run('soundOn=true;initAudio();');assert.equal(h.run('audioUnlocked'),false);assert.equal(h.run('audioCtx'),null);
 h.run('reduceMotion=true;flash.style.opacity="0";hitFlash(1);');assert.equal(h.els.get('#flash').style.opacity,'0');
});
test('shipped startup opens setup and retains archive/version provenance',()=>{
 assert.match(source,/openRaceSetup\(\);setTimeout/);assert.match(source,/1\.6\.0-worlds/);
});

test('null or invalid stored JSON falls back without breaking startup',()=>{
 const h=harness();h.run('localStorage={getItem:()=>"null",setItem(){throw new Error("blocked")}};');
 assert.doesNotThrow(()=>h.run('loadRaceSettings();persistRaceSettings();'));
});
test('difficulty edits keep the running bot level until restart',()=>{
 const h=harness();h.run('phase="race";difficultyEl.value="hard";');for(const fn of h.els.get('#difficulty').events.change)fn({});
 assert.equal(h.run('raceDifficulty'),'normal');h.run('resetRace()');assert.equal(h.run('raceDifficulty'),'hard');
});
test('finished menus and settings cannot resume simulation behind an overlay',()=>{
 const h=harness();h.run('finished=true;phase="finished";openSettingsPaused();');h.click('#closeSettings');h.fire('keydown',{code:'KeyP'});
 assert.equal(h.run('phase'),'finished');assert.equal(h.run('paused'),true);assert.equal(h.els.get('#finishOverlay').classList.contains('open'),true);
});
test('gamepad recover and lost touch capture neutralize held steering',()=>{
 const h=harness();h.run('phase="race";racers[0].falling=true;racers[0].inputX=1;joystick.x=1;let recover=true;navigator.getGamepads=()=>[{connected:true,index:0,axes:[0,0],buttons:[{}, {pressed:recover}]}];pollGamepadActions();pollGamepadActions();');
 assert.equal(h.run('racers[0].recoveries'),1);assert.equal(h.run('racers[0].inputX'),0);assert.equal(h.run('joystick.x'),0);
 h.run('joystick.pointerId=3;joystick.active=true;joystick.x=.8;');for(const fn of h.els.get('#joyWrap').events.lostpointercapture)fn({pointerId:3,preventDefault(){}});assert.equal(h.run('joystick.active'),false);
});

test('bot finish timestamps keep advancing during the results reveal',()=>{
 const h=harness();h.run('phase="finish";raceTime=10;for(const r of racers)r.finished=true;fixedUpdate(.1);');assert.ok(h.run('raceTime')>10);
});
test('audio voice bursts are capped and ended voices release their graph nodes',()=>{
 const h=harness();h.run(source.slice(source.indexOf('function tone('),source.indexOf('function haptic(')));
 h.run(`audioUnlocked=true;soundOn=true;let starts=0,disconnected=0;const nodes=[];const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};audioCtx={currentTime:1,destination:{},createOscillator(){const o={frequency:param,connect(){return this},start(){starts++},stop(){},disconnect(){disconnected++}};nodes.push(o);return o;},createGain(){return{gain:param,connect(){return this},disconnect(){disconnected++}}}};audioMaster={};for(let i=0;i<100;i++)tone(440);`);
 assert.equal(h.run('starts'),24);h.run('for(const node of nodes)node.onended();');assert.equal(h.run('liveAudioVoices'),0);assert.equal(h.run('disconnected'),48);
});

test('modeled course and riders produce finite poses and release rematch resources',async()=>{
 const three=await import('../games/royal-roller-ruckus/source/vendor/three.module.js');
 const h=harness({three});
 h.context.document.createElement=()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})});
 h.run(source.slice(source.indexOf('function buildDummy('),source.indexOf('function sampleTrackIndex(')));
 h.run('scene=new THREE.Scene();createTrack();racerCountEl.value="10";resetRace();for(let i=0;i<120;i++)updateVisuals(1/60,i/60);racers[0].finished=true;updateVisuals(1/60,3);');
 assert.equal(h.run('checkpointMarkers.length'),8);assert.equal(h.run('checkpointMarkers.every(m=>m.pennants.length===2)'),true);
 assert.equal(h.run('racers[0].visual.dummy.limbs.la.rotation.z'),-2.45);
 assert.equal(h.run('racers.every(r=>[r.visual.dummy.root.position.y,...r.visual.dummy.root.rotation.toArray().slice(0,3)].every(Number.isFinite))'),true);
 h.run('let disposed=0;racers[0].visual.group.traverse(n=>{if(n.geometry)n.geometry.addEventListener("dispose",()=>disposed++);});resetRace();');assert.ok(h.run('disposed')>0);
});

test('Start and Resume leave keyboard driving available when activation target was a button',()=>{
 const h=harness();h.run('openRaceSetup()');h.click('#startRaceBtn');h.fire('keydown',{code:'KeyW',target:{tagName:'BUTTON'}});assert.equal(h.run('readKeyboardTouch().moveY'),-1);
 h.fire('keydown',{code:'Escape',target:{tagName:'BUTTON'}});assert.equal(h.run('paused'),true);h.click('#resumeBtn');h.fire('keydown',{code:'ArrowUp',target:{tagName:'BUTTON'}});assert.equal(h.run('readKeyboardTouch().moveY'),-1);
 h.run('neutralizeInput()');h.fire('keydown',{code:'Space',target:{tagName:'BUTTON'}});assert.equal(h.run('keys.Space===true'),false);
});

test('held gamepad axes require neutral before steering after resume and a new race',()=>{
 const h=harness();h.run('let axis=1;navigator.getGamepads=()=>[{connected:true,index:0,axes:[axis,0],buttons:[]}];togglePause(true);togglePause(false);');
 assert.equal(h.run('samplePlayerInput(0).moveX'),0);
 h.run('axis=0;samplePlayerInput(0);axis=1;');assert.equal(h.run('samplePlayerInput(0).moveX'),1);
 h.run('resetRace()');assert.equal(h.run('samplePlayerInput(0).moveX'),0);h.run('axis=0;samplePlayerInput(0);axis=1;');assert.equal(h.run('samplePlayerInput(0).moveX'),1);
});
