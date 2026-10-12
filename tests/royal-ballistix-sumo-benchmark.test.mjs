import test from 'node:test';
import assert from 'node:assert/strict';
import {game,ballAt,tick} from '../games/royal-ballistix/tests/runtime-harness.mjs';
const pad = () => ({connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))});
const call = (g,name,...args) => {assert.equal(typeof g[name],'function',`${name} must exist`);return g[name](...args)};

test('starts at deliberate setup with input gated until Start siege',()=>{
 const g=game(4,123,{initial:true});assert.equal(g.G.paused,true);assert.equal(g.G.menu,true);
 g.dispatch('window','keydown',{code:'KeyD'});g.dispatch('#magnet','pointerdown');assert.equal(g.input.keyAxis,0);assert.equal(g.input.mag,false);
 call(g,'startMatch','siege');assert.equal(g.G.phase,'countdown');assert.equal(g.G.paused,false);assert.equal(g.G.menu,false);
});
test('rules changed in settings wait for explicit restart',()=>{
 const g=game(4);g.G.wins[0]=1;g.openSettings();g.elements.get('#playerCount').onchange({target:{value:'10'}});
 assert.equal(g.G.playerCount,4);assert.equal(g.G.wins[0],1);g.closeSettings();assert.equal(g.G.paused,true);
 g.elements.get('#restart').onclick();assert.equal(g.G.playerCount,10);assert.equal(g.G.wins[0],0);assert.equal(g.G.paused,true);
});
test('validated saved preferences reject invalid booleans and enums, bound ranges',()=>{
 const g=game(4,123,{initial:true,reduceMotion:true,storage:{getItem:k=>k==='royalBallistix.preferences.v1'?JSON.stringify({volume:9,muted:'false',reduceMotion:'false',highContrast:true,playerCount:99,arenaSize:'no',difficulty:'broken',winTarget:5}):null,setItem(){throw Error('blocked')}}});
 assert.ok(g.preferences);assert.equal(g.preferences.volume,1);assert.equal(g.preferences.muted,false);assert.equal(g.preferences.reduceMotion,true);assert.equal(g.preferences.playerCount,10);assert.equal(g.preferences.arenaSize,115);assert.equal(g.preferences.difficulty,'normal');assert.equal(g.preferences.winTarget,5);
 assert.doesNotThrow(()=>g.elements.get('#mute').onchange({target:{checked:true}}));assert.equal(g.preferences.muted,true);
});
test('gamepad axis, held catch, release and counter work with deadzone and edge actions',()=>{
 const p=pad(),g=game(2,123,{pads:[p]});p.axes[0]=.1;call(g,'pollGamepad');g.player(1/120,g.P[0]);assert.equal(g.P[0].pos,0);
 p.axes[0]=.7;p.buttons[0].pressed=true;g.pollGamepad();g.player(1/120,g.P[0]);assert.ok(g.P[0].pos>0);assert.equal(g.P[0].mag,true);
 const b=ballAt(g,g.P[0]);g.G.balls=[b];g.capture(b,g.P[0]);p.buttons[0].pressed=false;g.pollGamepad();g.player(1/120,g.P[0]);assert.equal(b.held,null);
 p.buttons[2].pressed=true;g.pollGamepad();assert.equal(g.input.pulse,true);g.player(1/120,g.P[0]);g.pollGamepad();assert.equal(g.input.pulse,false);
});
test('gamepad pause and disconnect neutralize held controls; held actions cannot resume through menus',()=>{
 const p=pad(),g=game(2,123,{pads:[p]});call(g,'pollGamepad');p.axes[0]=1;p.buttons[0].pressed=true;call(g,'pollGamepad');g.player(1/120,g.P[0]);
 p.buttons[9].pressed=true;g.pollGamepad();assert.equal(g.G.paused,true);assert.equal(g.input.mag,false);
 p.buttons[9].pressed=false;g.pollGamepad();p.buttons[9].pressed=true;g.pollGamepad();assert.equal(g.G.paused,false);g.pollGamepad();g.player(1/120,g.P[0]);assert.equal(g.P[0].mag,false);assert.equal(g.P[0].pos>0,true);
 p.buttons[0].pressed=false;p.axes[0]=0;g.pollGamepad();p.buttons[0].pressed=true;g.pollGamepad();g.player(1/120,g.P[0]);assert.equal(g.P[0].mag,true);
 p.connected=false;g.pollGamepad();g.player(1/120,g.P[0]);assert.equal(g.P[0].mag,false);assert.equal(g.input.padAxis,0);
});
test('defense drill gives timed feedback without damage or crown awards',()=>{
 const g=game();call(g,'startMatch','practice');g.G.phase='fight';const p=g.P[0],life=p.life,b=ballAt(g,p);g.G.balls=[b];g.scoreGoal(0,b);
 assert.equal(p.life,life);assert.equal(g.G.stats.misses,1);assert.equal(g.G.phase,'fight');
 g.G.balls=[ballAt(g,p)];g.startMag(p);g.capture(g.G.balls[0],p);assert.equal(g.G.stats.catches,1);g.releaseMag(p,false);assert.equal(g.G.stats.volleys,1);
 g.G.practiceTime=.001;g.step(1/120);assert.equal(g.G.phase,'end');assert.ok(g.G.wins.every(w=>w===0));assert.equal(g.elements.get('#next').textContent,'Practice Again');
});
test('queued cannon telegraph direction is exactly the emitted ball direction',()=>{
 const g=game();g.queueBall();const plan={...g.G.launch};assert.ok(Number.isFinite(plan.dx)&&Number.isFinite(plan.dy));g.addBall(plan.launcher,plan);const b=g.G.balls.at(-1),m=Math.hypot(b.vx,b.vy);
 assert.ok(Math.abs(b.vx/m-plan.dx)<1e-9);assert.ok(Math.abs(b.vy/m-plan.dy)<1e-9);
});
test('volley aim guide uses the same center direction as released balls',()=>{
 const g=game(),p=g.P[0];g.startMag(p);p.aim=.8;const v=call(g,'releaseVector',p,0,1),b=ballAt(g,p);g.G.balls=[b];g.capture(b,p);g.releaseMag(p,false);const m=Math.hypot(b.vx,b.vy);
 assert.ok(Math.abs(b.vx/m-v[0])<1e-9);assert.ok(Math.abs(b.vy/m-v[1])<1e-9);
});
test('incoming defense cue projects the ball to the gate and disappears for outbound shots',()=>{
 const g=game(),p=g.P[0],b=ballAt(g,p,{front:.2,side:g.S.pad*.5});g.G.balls=[b];const cue=call(g,'defenseCue',p);assert.ok(cue);assert.ok(cue.time>0);assert.ok(Number.isFinite(cue.x)&&Number.isFinite(cue.y));b.vx*=-1;b.vy*=-1;assert.equal(g.defenseCue(p),null);
});
test('practice drills cycle lanes and keep pressure bounded to one ball',()=>{
 const g=game();call(g,'startMatch','practice');g.G.phase='fight';g.queueBall();const a={...g.G.launch};g.G.launch=null;g.queueBall();const b={...g.G.launch};assert.notEqual(a.dx,b.dx);g.addBall(a.launcher,a);g.addBall(b.launcher,b);assert.equal(g.G.balls.length,1);
});
test('first-to-one setup crowns once and produces ordered results',()=>{
 const g=game();assert.ok(g.preferences);g.preferences.winTarget=1;call(g,'startMatch','siege');g.G.phase='fight';g.P[1].alive=false;g.endCheck();g.timers.at(-1).fn();assert.equal(g.G.wins[0],1);assert.equal(g.elements.get('#next').textContent,'Play Again');assert.match(g.elements.get('#standings').textContent,/YOU.*1/);g.endCheck();assert.equal(g.G.wins[0],1);
});
test('cosmetic drawing and particle bursts do not advance gameplay random stream',()=>{
 const a=game(2,88),b=game(2,88);a.draw();a.queueBall();b.queueBall();assert.deepEqual({...a.G.launch},{...b.G.launch});
});
test('audio remains silent before a gesture and caps/disposes concurrent voices',()=>{
 let voices=0,stopped=0;const oscillators=[];
 class Audio {constructor(){this.currentTime=0;this.state='running';this.destination={}}resume(){return Promise.resolve()}createOscillator(){voices++;const o={frequency:{value:0},connect(){return {connect(){}}},start(){},stop(){stopped++},disconnect(){}};oscillators.push(o);return o}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}}
 const g=game(2,123,{AudioContext:Audio});g.G.sound=true;g.tone(200);assert.equal(voices,0);call(g,'unlockAudio');for(let i=0;i<40;i++)g.tone(200);assert.equal(voices,16);assert.equal(stopped,16);oscillators[0].onended();assert.equal(g.audioVoices,15);g.tone(200);assert.equal(voices,17);
 g.elements.get('#mute').onchange({target:{checked:true}});g.tone(200);assert.equal(voices,17);
});
test('menu invalidates queued results and help keeps play paused until explicit resume',()=>{
 const g=game();g.P[1].alive=false;g.endCheck();const old=g.timers.at(-1);call(g,'showMenu');old.fn();assert.equal(g.elements.get('#resultOv').classList.contains('open'),false);assert.equal(g.G.menu,true);
 g.startMatch('siege');g.elements.get('#help').onclick();assert.equal(g.G.paused,true);g.elements.get('#helpClose').onclick();assert.equal(g.G.paused,true);assert.equal(g.elements.get('#pauseOv').classList.contains('open'),true);
});
test('preferences persist with exact validated values without restarting an active match',()=>{
 const saved=[];const g=game(2,123,{storage:{getItem:()=>null,setItem:(k,v)=>saved.push([k,v])}});const phase=g.G.phase,round=g.G.round;
 g.elements.get('#volume').oninput({target:{value:'35'}});g.elements.get('#reduceMotion').onchange({target:{checked:true}});g.elements.get('#highContrast').onchange({target:{checked:true}});
 assert.equal(g.preferences.volume,.35);assert.equal(g.preferences.reduceMotion,true);assert.equal(g.G.phase,phase);assert.equal(g.G.round,round);assert.equal(g.sandbox.document.body.dataset.reduceMotion,'true');assert.equal(g.sandbox.document.body.dataset.highContrast,'true');assert.equal(JSON.parse(saved.at(-1)[1]).highContrast,true);
});
test('failed audio allocation releases its voice budget and nodes',()=>{
 let disconnected=0;class Audio {constructor(){this.currentTime=0;this.state='running';this.destination={}}createOscillator(){return {frequency:{},connect(){},start(){throw Error('device unavailable')},stop(){},disconnect(){disconnected++}}}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){disconnected++}}}}
 const g=game(2,123,{AudioContext:Audio});g.G.sound=true;call(g,'unlockAudio');assert.doesNotThrow(()=>g.tone(200));assert.equal(g.audioVoices,0);assert.equal(disconnected,2);
});
test('reconnecting a held gamepad requires neutral before gameplay can resume',()=>{
 const p=pad(),g=game(2,123,{pads:[p]});call(g,'pollGamepad');p.connected=false;g.pollGamepad();p.buttons[0].pressed=true;p.connected=true;g.pollGamepad();g.player(1/120,g.P[0]);assert.equal(g.P[0].mag,false);
 p.buttons[0].pressed=false;g.pollGamepad();p.buttons[0].pressed=true;g.pollGamepad();g.player(1/120,g.P[0]);assert.equal(g.P[0].mag,true);
});
test('changing the rendering viewport preserves the queued cannon firing angle',()=>{
 const g=game(2);g.queueBall();const plan={...g.G.launch};g.sandbox.innerWidth=844;g.sandbox.innerHeight=390;g.dispatch('window','resize');g.addBall(plan.launcher,plan);const b=g.G.balls.at(-1);assert.ok(Math.abs(b.vx/Math.hypot(b.vx,b.vy)-plan.dx)<1e-9);
});
test('paused setup preserves native range, checkbox and select keyboard defaults',()=>{
 const g=game();g.openSettings();let prevented=0;
 for(const [tagName,code] of [['INPUT','ArrowRight'],['INPUT','Space'],['SELECT','ArrowLeft'],['TEXTAREA','Space']])g.dispatch('window','keydown',{target:{tagName},code,preventDefault(){prevented++}});
 assert.equal(prevented,0);assert.equal(g.input.keyAxis,0);assert.equal(g.input.mag,false);
});
test('native typing controls keep their keys while an active game still accepts body controls',()=>{
 const g=game();let prevented=0;g.dispatch('window','keydown',{target:{tagName:'INPUT'},code:'KeyD',preventDefault(){prevented++}});g.dispatch('window','keydown',{target:{isContentEditable:true},code:'Space',preventDefault(){prevented++}});
 assert.equal(prevented,0);assert.equal(g.input.keyAxis,0);assert.equal(g.input.mag,false);
 g.dispatch('window','keydown',{target:{tagName:'BODY'},code:'ArrowRight',preventDefault(){prevented++}});assert.equal(prevented,1);assert.equal(g.input.keyAxis,1);
});
test('focused buttons do not swallow movement after starting or resuming a match',()=>{
 const g=game();call(g,'startMatch','siege');g.dispatch('window','keydown',{target:{tagName:'BUTTON',id:'startSiege'},code:'KeyD'});assert.equal(g.input.keyAxis,1);g.pauseToggle();g.elements.get('#resume').onclick();g.dispatch('window','keydown',{target:{tagName:'BUTTON',id:'resume'},code:'KeyA'});assert.equal(g.input.keyAxis,-1);
});
test('Space and Enter on focused buttons retain native activation during play',()=>{
 const g=game();let prevented=0;for(const code of ['Space','Enter'])g.dispatch('window','keydown',{target:{tagName:'BUTTON',id:'pause'},code,preventDefault(){prevented++}});assert.equal(prevented,0);assert.equal(g.input.mag,false);
});
test('start, resume and in-game Sound restore focus to the playfield for subsequent Space catch',()=>{
 const g=game();call(g,'startMatch','siege');assert.equal(g.sandbox.document.activeElement,g.elements.get('#game'));g.pauseToggle();g.elements.get('#resume').onclick();assert.equal(g.sandbox.document.activeElement,g.elements.get('#game'));
 g.sandbox.document.activeElement=g.elements.get('#sound');g.elements.get('#sound').onclick();assert.equal(g.sandbox.document.activeElement,g.elements.get('#game'));g.dispatch('window','keydown',{target:g.sandbox.document.activeElement,code:'Space'});assert.equal(g.input.mag,true);
});
