import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from '../games/royal-twisted/tests/runtime-harness.mjs';

test('preferences validate enums, counts, volume and hostile storage',()=>{
 const r=runtime();
 const p=r.run(`normalizePreferences({players:99,difficulty:'oops',graphics:'fast',volume:-2,reducedMotion:true,rhythm:'jumps',sound:false})`);
 assert.equal(p.players,10);assert.equal(p.difficulty,'normal');assert.equal(p.graphics,'balanced');assert.equal(p.volume,0);assert.equal(p.rhythm,'jumps');assert.equal(p.sound,false);
 r.run(`localStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};loadPreferences();savePreferences()`);
});
test('setup gates all gameplay then start enters the established countdown',()=>{
 const r=runtime();r.run('showSetup()');
 assert.equal(r.game.RoyalTwisted.jump(),false);assert.equal(r.run('phase'),'setup');
 r.click('#startBtn');assert.equal(r.run('phase'),'countdown');assert.equal(r.run('paused'),false);
 r.tick(3.4);assert.equal(r.run('phase'),'fight');
});
test('contestant changes stage next match without erasing an active round',()=>{
 const r=runtime();r.run(`fighters[0].score=9;playerCountEl.value='10'`);
 r.el('#playerCount').listeners.change[0]();
 assert.equal(r.run('playerCount'),4);assert.equal(r.run('fighters[0].score'),9);
 r.click('#restartBtn');assert.equal(r.run('playerCount'),10);assert.equal(r.run('fighters[0].score'),0);
});
test('seeded hazard rhythms repeat independently of cosmetic random draws',()=>{
 const pattern=(noise)=>{const r=runtime();r.run(`seedInput.value='241';restartMatch();roundTime=45;${noise?'for(let i=0;i<800;i++)Math.random();':''}`);return r.run(`JSON.stringify(Array.from({length:15},()=>pickPattern()))`)};
 assert.equal(pattern(false),pattern(true));
 const r=runtime();r.run(`rhythmEl.value='jumps';restartMatch();roundTime=50`);
 assert.equal(r.run(`Array.from({length:20},()=>pickPattern()).flat().every(h=>h.type==='low')`),true);
 r.run(`rhythmEl.value='ducks';restartMatch()`);
 assert.equal(r.run(`Array.from({length:20},()=>pickPattern()).flat().every(h=>h.type==='high')`),true);
});
test('clear streak and match statistics count one outcome per rod and survive round reset',()=>{
 const r=runtime();r.run(`for(let i=0;i<5;i++){const h={type:'low',checked:new Set()};clearHazard(fighters[0],h);clearHazard(fighters[0],h)}`);
 assert.equal(r.run('fighters[0].stats.clears'),5);assert.equal(r.run('fighters[0].stats.bestStreak'),5);
 r.run(`hitFighter(fighters[0],{type:'high',checked:new Set()});resetRound()`);
 assert.equal(r.run('fighters[0].stats.hitsHigh'),1);assert.equal(r.run('fighters[0].stats.clears'),5);assert.equal(r.run('fighters[0].stats.streak'),0);
 r.run('restartMatch()');assert.equal(r.run('fighters[0].stats.clears'),0);
});
test('survival statistics use fight simulation time only',()=>{
 const r=runtime();r.tick(.25);const before=r.run('fighters[0].stats.survival');r.run('togglePause(true)');r.tick(3);
 assert.equal(r.run('fighters[0].stats.survival'),before);r.run('togglePause(false)');r.tick(.25);
 assert.ok(r.run('fighters[0].stats.survival')>before);
});
test('hazard preview orders pending rods relative to setback and keeps safe NOW timing',()=>{
 const r=runtime();r.run(`createHazard('high',PLAYER_T+.014+currentSpeed()*.8);createHazard('low',PLAYER_T+.014+currentSpeed()*.3);updateHUD()`);
 assert.match(r.el('#reactionCue').textContent,/JUMP NOW/);assert.match(r.el('#nextRod').textContent,/DUCK/);
 r.run(`hazards[1].checked.add(0);updateHUD()`);assert.match(r.el('#reactionCue').textContent,/NEXT.*DUCK/);
});
test('gamepad Start pauses and resumes on edges while held actions stay neutral',()=>{
 const r=runtime();const buttons=Array.from({length:14},()=>({pressed:false}));r.pads[0]={buttons};
 buttons[9].pressed=true;r.run('pollGamepadMenu()');assert.equal(r.run('paused'),true);
 r.run('pollGamepadMenu()');assert.equal(r.run('paused'),true);
 buttons[9].pressed=false;r.run('pollGamepadMenu()');buttons[9].pressed=true;r.run('pollGamepadMenu()');assert.equal(r.run('paused'),false);
});
test('help pauses, clears held posture, and returns to explicit Resume',()=>{
 const r=runtime();r.run(`setDuck(fighters[0],true,'key:KeyS')`);r.click('#helpBtn');assert.equal(r.run('paused'),true);assert.equal(r.run('fighters[0].duck'),false);
 r.click('#closeHelp');assert.equal(r.run('paused'),true);r.click('#resumeBtn');assert.equal(r.run('paused'),false);
});
test('standings use shared crown ranks and final results have direct replay and menu routes',()=>{
 const r=runtime();r.run(`fighters[0].roundWins=2;fighters[1].roundWins=2;fighters[2].roundWins=1`);
 assert.deepEqual(Array.from(r.run('getStandings().map(x=>x.rank)')),[1,1,3,4]);
 r.run(`fighters[0].roundWins=2;lastRoundWinner=fighters[0];phase='roundover';finishOrNext()`);
 assert.equal(r.run(`resultsModal.classList.contains('open')`),true);
 r.click('#rematchBtn');assert.equal(r.run('phase'),'countdown');assert.equal(r.run(`resultsModal.classList.contains('open')`),false);
 r.click('#menuBtn');assert.equal(r.run('phase'),'setup');
});
test('gameplay keys do not hijack focused input fields',()=>{
 const r=runtime();let prevented=false;r.fire('keydown',{code:'Space',target:{tagName:'INPUT'},preventDefault(){prevented=true}});
 assert.equal(prevented,false);assert.equal(r.run('fighters[0].jumpY'),0);
});
test('reduced motion suppresses added effects without changing safe collision outcomes',()=>{
 const r=runtime();r.run(`preferences.reducedMotion=true;createHazard('low',PLAYER_T+.014+currentSpeed()*.3);requestJump(fighters[0])`);r.tick(.65);
 assert.equal(r.run('fighters[0].lives'),7);assert.equal(r.run('effectsReduced()'),true);
});
test('persisted preferences reload and setup settings cannot be covered or overwritten',()=>{
 const r=runtime();r.run(`var saved={};localStorage={getItem:key=>saved[key],setItem:(key,value)=>saved[key]=value};preferences.volume=.35;preferences.reducedMotion=true;savePreferences();preferences=loadPreferences();showSetup()`);
 assert.equal(r.run('preferences.volume'),.35);assert.equal(r.run('effectsReduced()'),true);
 r.click('#setupSettingsBtn');r.run(`playerCountEl.value='8'`);r.el('#playerCount').listeners.change[0]();r.click('#closeSettings');r.click('#startBtn');assert.equal(r.run('playerCount'),8);
});
test('audio stays locked before a gesture and zero volume schedules no voice',()=>{
 const r=runtime();r.run(`var created=0;window.AudioContext=function(){created++;throw Error('not expected')};audioCtx=null;audioUnlocked=false;initAudio();tone(440);noise()`);assert.equal(r.run('created'),0);
 r.run(`audioUnlocked=true;preferences.volume=0;tone(440);noise()`);assert.equal(r.run('created'),0);
});
test('keyboard movement controls remain active when a native action button has focus',()=>{
 const r=runtime();r.fire('keydown',{code:'ArrowUp',target:{tagName:'BUTTON'}});assert.ok(r.run('fighters[0].jumpY')>0);
});
test('airborne, duck and running animation poses reflect real simulation posture',()=>{
 const r=runtime();const run=r.run('movementPose(fighters[0],1)');r.run('requestJump(fighters[0])');const air=r.run('movementPose(fighters[0],1)');assert.notEqual(air.armL,run.armL);assert.equal(air.legL,.55);
 r.run('fighters[0].jumpY=0;fighters[0].vy=0;setDuck(fighters[0],true)');assert.equal(r.run('movementPose(fighters[0],1).scale'),.66);
});
test('replay requires release of gamepad actions held through menus',()=>{
 const r=runtime();r.pads[0]={buttons:[{pressed:true},{pressed:true}]};r.run('restartMatch();updatePhase(4);pollGamepads()');assert.equal(r.run('fighters[0].jumpY'),0);assert.equal(r.run('fighters[0].duck'),false);
 r.pads[0].buttons[0].pressed=false;r.pads[0].buttons[1].pressed=false;r.run('pollGamepads()');r.pads[0].buttons[0].pressed=true;r.run('pollGamepads()');assert.ok(r.run('fighters[0].jumpY')>0);
});
test('procedural tower and character geometry build with the bundled real Three.js API',async()=>{
 const THREE=await import('../games/royal-twisted/source/vendor/three/three.module.js');
 const {source}=await import('../games/royal-twisted/tests/runtime-harness.mjs');
 const r=runtime();r.game.THREE=THREE;
 const oldCreate=r.game.document.createElement;
 r.game.document.createElement=(tag)=>tag==='canvas'?{width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})}:oldCreate(tag);
 r.run(source.slice(source.indexOf('function buildDummy'),source.indexOf('function makeLaneOffsets')));
 r.run('scene=new THREE.Scene();particles=[];rings=[];createWorld();createFighters();resetRound();phase="fight";updateVisuals(.016,1)');
 assert.ok(r.run('towerFlags.length')>0);assert.equal(r.run('fighters.every(f=>!!f.visual.identityRing)'),true);
 r.run('requestJump(fighters[0]);updateVisuals(.016,1.2)');
 assert.equal(r.run('fighters[0].visual.shadow.position.y+fighters[0].jumpY'),.02);
 assert.equal(r.run(`(()=>{let valid=true;scene.traverse(node=>{const a=node.geometry?.attributes?.position?.array;if(a&&!Array.from(a).every(Number.isFinite))valid=false});return valid})()`),true);
});
