import test from 'node:test';
import assert from 'node:assert/strict';
import {game,ballAt,tick} from './runtime-harness.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('paddle contact keeps its lateral impact position',()=>{const g=game(),p=g.P[0],side=g.S.pad*.7,b=ballAt(g,p,{side}),q=g.pxy(p),t=g.tangent(p);assert.equal(g.hitPaddle(b,p),true);near((b.x-q[0])*t[0]+(b.y-q[1])*t[1],side)});
test('a scored ball removes exactly one life even if reported twice',()=>{const g=game(),b=ballAt(g,g.P[0]);g.G.balls=[b];let life=g.P[0].life;g.scoreGoal(0,b);g.scoreGoal(0,b);assert.equal(g.P[0].life,life-1);assert.equal(g.G.balls.length,0)});
test('round awards and result callbacks occur once',()=>{const g=game();g.P[1].alive=false;g.endCheck();g.endCheck();assert.equal(g.G.wins[0],1);assert.equal(g.timers.length,2)});
test('a queued old result cannot reopen over a restarted round',()=>{const g=game();g.P[1].alive=false;g.endCheck();const old=g.timers.at(-1);g.restart();old.fn();assert.equal(g.G.phase,'countdown');assert.equal(g.elements.get('#resultOv').classList.contains('open'),false)});
test('later balls cannot eliminate the round winner in the same physics step',()=>{const g=game();g.P.forEach(p=>p.life=1);g.G.balls=g.P.map(p=>{const a=Math.PI/2+p.id*g.S.sector;return{x:g.S.cx+Math.cos(a)*(g.S.radius+20),y:g.S.cy+Math.sin(a)*(g.S.radius+20),vx:0,vy:0,r:5,held:null,age:0}});g.balls(1/120);assert.equal(g.G.wins.reduce((a,b)=>a+b,0),1);assert.equal(g.P.filter(p=>p.alive).length,1)});
for(const event of ['pointercancel','lostpointercapture'])test(`stick ${event} returns to neutral`,()=>{const g=game();g.dispatch('#move','pointerdown');g.dispatch('#move',event);assert.equal(g.input.axis,0);assert.equal(g.input.strength,0);assert.equal(g.input.drag,false)});
test('second touch cannot steal an active movement pointer',()=>{const g=game();g.dispatch('#move','pointerdown',{pointerId:1});g.dispatch('#move','pointerdown',{pointerId:2});g.dispatch('#move','pointerup',{pointerId:1});assert.equal(g.input.drag,false)});
for(const action of ['pause','restart','blur','hidden'])test(`${action} clears pending local actions and releases held balls`,()=>{const g=game();g.dispatch('window','keydown',{code:'KeyD'});g.dispatch('#magnet','pointerdown');g.player(1/120,g.P[0]);const b=ballAt(g,g.P[0]);g.G.balls=[b];g.capture(b,g.P[0]);g.input.pulse=true;if(action==='pause')g.pauseToggle();if(action==='restart')g.restart();if(action==='blur')g.dispatch('window','blur');if(action==='hidden'){g.sandbox.document.hidden=true;g.dispatch('document','visibilitychange')}assert.equal(g.input.keyAxis,0);assert.equal(g.input.mag,false);assert.equal(g.input.pulse,false);assert.equal(b.held,null)});
for(const event of ['pointercancel','lostpointercapture'])test(`Magnet ${event} detaches its captured ball`,()=>{const g=game();g.dispatch('#magnet','pointerdown');g.player(1/120,g.P[0]);const b=ballAt(g,g.P[0]);g.G.balls=[b];g.capture(b,g.P[0]);g.dispatch('#magnet',event);g.player(1/120,g.P[0]);assert.equal(b.held,null);assert.equal(g.P[0].held.length,0)});
test('cancelled Pulse cannot queue a counter',()=>{const g=game();g.dispatch('#pulse','pointerdown');g.dispatch('#pulse','pointercancel');g.player(1/120,g.P[0]);assert.equal(g.P[0].pulseCd,0)});
test('settings return to pause; paused input cannot queue actions',()=>{const g=game();g.openSettings();g.closeSettings();g.dispatch('#magnet','pointerdown');g.dispatch('#pulse','pointerdown');g.dispatch('window','keydown',{code:'KeyD'});assert.equal(g.G.paused,true);assert.equal(g.input.mag,false);assert.equal(g.input.pulse,false);assert.equal(g.input.keyAxis,0)});
test('stick and Magnet work simultaneously; releasing stick preserves Magnet',()=>{const g=game();g.dispatch('#move','pointerdown');g.dispatch('#magnet','pointerdown',{pointerId:2});g.player(1/120,g.P[0]);assert.ok(g.P[0].pos>0);assert.equal(g.P[0].mag,true);g.dispatch('#move','pointerup');assert.equal(g.input.mag,true)});
test('keyboard Shift and API run remain supported',()=>{const g=game();g.dispatch('window','keydown',{code:'ShiftLeft'});assert.equal(g.input.run,true);g.sandbox.RoyalBallistix.setPlayerInput(1,{moveX:.4,run:true});g.paddles(1/120);assert.ok(g.P[1].vel>0);g.sandbox.RoyalBallistix.releasePlayer(1);assert.equal(g.sandbox.RoyalBallistix.getState().players[1].external,false)});
for(const seats of [2,4,10])test(`${seats} seats: maximum-speed defended contact does not tunnel`,()=>{const g=game(seats);for(const p of g.P){const life=p.life,b=ballAt(g,p,{front:.10,side:g.S.pad*.6});g.G.balls=[b];for(let i=0;i<20;i++)g.balls(1/120);assert.equal(p.life,life);assert.equal(b.last,p.id);assert.ok([b.x,b.y,b.vx,b.vy].every(Number.isFinite))}});
test('wall and opposing ball collisions remain finite at maximum speed',()=>{const g=game(4);g.P[1].alive=false;const b=ballAt(g,g.P[1],{front:-.03});g.G.balls=[b];for(let i=0;i<120;i++)g.balls(1/120);assert.equal(g.G.balls.length,1);const s=g.S.size;g.G.balls=[{x:g.S.cx-10,y:g.S.cy,vx:s,vy:0,r:8,held:null,age:0},{x:g.S.cx+10,y:g.S.cy,vx:-s,vy:0,r:8,held:null,age:0}];g.balls(.04);assert.ok(g.G.balls[0].vx<0);assert.ok(g.G.balls[1].vx>0);assert.ok(g.G.balls.every(b=>[b.x,b.y,b.vx,b.vy].every(Number.isFinite)))});
test('Magnet capacity, moving attachment, release and overheat are bounded',()=>{const g=game(),p=g.P[0];g.startMag(p);for(let i=0;i<5;i++){const b=ballAt(g,p);g.G.balls.push(b);g.hitPaddle(b,p)}assert.equal(p.held.length,4);g.input.mag=true;g.input.keyAxis=.5;g.paddles(.02);assert.ok(p.pos>0);assert.ok(p.held.every(b=>b.held===0));g.releaseMag(p,false);assert.ok(g.G.balls.every(b=>b.held===null));g.startMag(p);g.capture(g.G.balls[0],p);g.paddles(g.TUNING.magnet.overheat);assert.equal(p.mag,false);assert.equal(p.held.length,0);assert.ok(p.lock>0)});
for(const [age,side,result]of [[.055,0,'perfect'],[.055001,0,'hit'],[.02,.47,'hit'],[.180001,0,'miss']])test(`Pulse contact age=${age}, side=${side} yields ${result}`,()=>{const g=game(),p=g.P[0];g.pulse(p);p.pulseAge=age;p.pulseT=Math.max(0,g.TUNING.pulse.activeWindow-age);g.hitPaddle(ballAt(g,p,{side:g.S.pad*side}),p);assert.equal(p.lastPulse,result);const cd=p.pulseCd;g.pulse(p);assert.equal(p.pulseCd,cd)});
test('CAM codes round-trip without changing simulation',()=>{const g=game(),before=JSON.stringify(g.sandbox.RoyalBallistix.getState()),c=g.sandbox.CallbackCamera;c.set({rotate:15,zoom:1.1,tilt:10});const code=c.code();c.reset();assert.equal(c.load(code,false),true);assert.equal(c.code(),code);assert.equal(JSON.stringify(g.sandbox.RoyalBallistix.getState()),before)});
for(const seats of [2,4,10])test(`${seats} seats complete first-to-three once with neutral human and bots`,()=>{const g=game(seats);let frames=0;while(!g.G.wins.some(w=>w===3)&&frames<120*14400){g.phase(1/120);g.step(1/120);frames++;if(g.G.phase==='end'){assert.equal(g.P.filter(p=>p.alive).length,1);if(!g.G.wins.some(w=>w===3)){g.G.round++;g.resetRound()}}}assert.ok(g.G.wins.some(w=>w===3),'match did not finish within four simulated hours');const wins=[...g.G.wins];tick(g,1);g.endCheck();assert.deepEqual([...g.G.wins],wins);assert.ok(g.G.balls.every(b=>[b.x,b.y,b.vx,b.vy].every(Number.isFinite)))});

test('contact feedback expires without changing the impact position',()=>{const g=game(),p=g.P[0],b=ballAt(g,p);g.hitPaddle(b,p);assert.ok(p.contactT>0);g.paddles(.5);assert.equal(p.contactT,0)});
test('Magnet status distinguishes capacity and imminent overheat',()=>{const g=game(),p=g.P[0];g.startMag(p);for(let i=0;i<4;i++){const b=ballAt(g,p);g.G.balls.push(b);g.capture(b,p)}g.hud();assert.match(g.elements.get('#magState').textContent,/FULL/);p.magT=4.5;g.hud();assert.match(g.elements.get('#magState').textContent,/RELEASE/)});
test('Pulse cooldown meter starts empty for both normal and Perfect counters',()=>{for(const side of [0,.6]){const g=game(),p=g.P[0],b=ballAt(g,p,{side:g.S.pad*side});g.G.balls=[b];g.pulse(p);g.hud();assert.equal(g.elements.get('#pulseFill').style.width,'0%');assert.match(g.elements.get('#pulseState').textContent,side===0?/PERFECT/:/COUNTER/);g.paddles(.5);g.hud();assert.equal(g.elements.get('#pulseState').textContent,'READY')}});

test('a different pointer cannot release Magnet; keyboard hold survives touch release',()=>{
 const g=game();g.dispatch('#magnet','pointerdown',{pointerId:2});g.dispatch('#magnet','pointerup',{pointerId:3});assert.equal(g.input.mag,true);
 g.dispatch('window','keydown',{code:'Space'});g.dispatch('#magnet','pointerup',{pointerId:2});assert.equal(g.input.mag,true);g.dispatch('window','keyup',{code:'Space'});assert.equal(g.input.mag,false);
});
test('stick and Pulse work simultaneously and cancellation returns stick to neutral',()=>{
 const g=game();g.dispatch('#move','pointerdown',{pointerId:1});g.dispatch('#pulse','pointerdown',{pointerId:2});g.player(1/120,g.P[0]);assert.ok(g.P[0].pos>0);assert.ok(g.P[0].pulseT>0);g.dispatch('#move','pointercancel',{pointerId:1});assert.equal(g.input.axis,0);
});
test('Pulse immediate spatial boundary and miss cooldown remain intact',()=>{
 const g=game(),p=g.P[0],b=ballAt(g,p,{front:.12001});g.G.balls=[b];const old=b.vy;g.pulse(p);assert.equal(p.lastPulse,'miss');assert.equal(b.vy,old);assert.equal(p.pulseCd,g.TUNING.pulse.missCooldown);g.pulse(p);assert.equal(b.vy,old);
});
test('stale result cannot overwrite a newer completed round',()=>{
 const g=game();g.P[1].alive=false;g.endCheck();const old=g.timers.at(-1);g.resetRound();g.G.phase='fight';g.P[0].alive=false;g.endCheck();old.fn();assert.equal(g.elements.get('#resultOv').classList.contains('open'),false);g.timers.at(-1).fn();assert.equal(g.elements.get('#resultTitle').textContent,'RUFUS Wins');
});
test('third crown shows match results once; Play Again resets wins and round',()=>{
 const g=game();g.G.wins[0]=2;g.P[1].alive=false;g.endCheck();const timer=g.timers.at(-1);timer.fn();g.endCheck();assert.equal(g.G.wins[0],3);assert.equal(g.elements.get('#next').textContent,'Play Again');g.elements.get('#next').onclick();assert.equal(g.G.round,1);assert.ok(g.G.wins.every(w=>w===0));timer.fn();assert.equal(g.elements.get('#resultOv').classList.contains('open'),false);
});

test('held-key repeats cannot restore input after a lifecycle reset',()=>{
 for(const action of ['pause','restart','blur']){
  const g=game();for(const code of ['KeyD','Space'])g.dispatch('window','keydown',{code});
  if(action==='pause'){g.pauseToggle();g.pauseToggle()}if(action==='restart')g.restart();if(action==='blur')g.dispatch('window','blur');
  for(const code of ['KeyD','Space'])g.dispatch('window','keydown',{code,repeat:true});
  g.player(1/120,g.P[0]);assert.equal(g.input.keyAxis,0);assert.equal(g.input.mag,false);assert.equal(g.P[0].pos,0);
  g.dispatch('window','keyup',{code:'KeyD'});g.dispatch('window','keydown',{code:'KeyD'});g.player(1/120,g.P[0]);assert.ok(g.P[0].pos>0);
 }
});

test('20, 60 and 120 Hz rendering advance the same fixed simulation time',()=>{
 const values=[];
 for(const hz of [20,60,120]){const g=game();g.G.nextSpawn=999;g.pulse(g.P[0]);for(let frame=1;frame<=hz;frame++)g.loop(1000+frame*1000/hz);values.push(g.P[0].pulseCd)}
 // Floating accumulator boundaries can differ by one 120 Hz step.
 assert.ok(Math.max(...values)-Math.min(...values)<=1/120+1e-9);for(const value of values)assert.ok(Math.abs(value-1)<=1/120+1e-9);
});

test('movement and reversal stop at both sector limits',()=>{
 const g=game(),p=g.P[0];g.input.keyAxis=1;for(let i=0;i<240;i++)g.player(1/120,p);near(p.pos,g.S.moveLimit);
 g.input.keyAxis=-1;for(let i=0;i<240;i++)g.player(1/120,p);near(p.pos,-g.S.moveLimit);
 g.dispatch('window','blur');g.player(1/120,p);assert.equal(p.vel,0);
});
