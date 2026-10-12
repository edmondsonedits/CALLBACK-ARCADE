import test from 'node:test';
import assert from 'node:assert/strict';
import {game, arena, crate} from '../games/space-bash/tests/harness.mjs';
const click=(g,id)=>g.element(id).onclick();
const change=(g,id,value)=>{g.element(id).value=value;g.element(id).onchange();};
const storage=value=>({getItem:key=>key==='space-bash:settings:v1'?JSON.stringify(value):null,setItem(){}});

test('boot briefing gates gameplay until an explicit start',()=>{
 const g=game();assert.equal(g.sandbox.SpaceBash.getState().phase,'setup');
 const time=g.timeLeft;g.advance(5);assert.equal(g.timeLeft,time);
 click(g,'#startMatch');assert.equal(g.phase,'countdown');assert.equal(g.paused,false);
});
test('saved settings are validated and a failed storage write is harmless',()=>{
 const g=game(123,{storage:storage({players:99,difficulty:999,rule:'bad',volume:9,reducedMotion:true,swapHands:true})});
 assert.equal(g.preferences.players,10);assert.equal(g.preferences.difficulty,1);assert.equal(g.preferences.rule,'standard');assert.equal(g.preferences.volume,1);assert.equal(g.preferences.reducedMotion,true);
 const h=game(123,{storage:{getItem(){throw Error('denied')},setItem(){throw Error('denied')}}});
 assert.doesNotThrow(()=>change(h,'#volume','.4'));assert.equal(h.preferences.volume,.4);
});
test('editing contestant and rule settings does not silently restart the active match',()=>{
 const g=arena(4),original=g.fighters;g.openSettingsPaused();change(g,'#players','8');change(g,'#rule','practice');
 assert.equal(g.fighters,original);assert.equal(g.sandbox.SpaceBash.getState().playerCount,4);assert.equal(g.rules.id,'standard');
 click(g,'#restart');assert.equal(g.fighters.length,8);assert.equal(g.rules.id,'practice');assert.equal(g.paused,true);
});
test('practice supplies normal crates, passive bots and a one-crown session',()=>{
 const g=game();change(g,'#rule','practice');click(g,'#startMatch');
 assert.ok(g.crates.every(c=>c.type==='normal'));assert.equal(g.rules.winTarget,1);
 g.phase='fight';g.crates=[];const f=g.fighters[1],o=g.fighters[0];f.x=.5;f.z=0;o.x=0;o.z=0;f.think=0;
 g.ai(f,.1);assert.equal(o.hp,100);assert.equal(f.kickCd,0);
 g.finishRound(o);assert.equal(g.phase,'match');assert.equal(g.element('#results').classList.contains('open'),true);
});
test('volatile deck creates an explosive supply mix and a distinct rule briefing',()=>{
 const g=game();change(g,'#rule','volatile');click(g,'#startMatch');assert.equal(g.rules.id,'volatile');
 assert.ok(g.crates.some(c=>c.type!=='normal'));assert.match(g.element('#ruleSummary').textContent,/TNT|explosive/i);
});
test('CPU waits its reaction interval before grabbing a nearby crate',()=>{
 const g=arena(),f=g.fighters[1];f.x=0;f.z=0;f.faceX=1;f.faceZ=0;f.think=.3;g.crates=[crate({x:.4})];
 g.ai(f,.01);assert.equal(f.carrying,null);f.think=0;g.ai(f,.01);assert.equal(f.carrying,g.crates[0]);
});
test('gamepad right stick aims before edge-triggered grab and throw',()=>{
 const pad={connected:true,mapping:'standard',axes:[0,0,1,0],buttons:Array.from({length:16},()=>({pressed:false}))};
 const g=game(123,{navigator:{getGamepads:()=>[pad]}});g.sandbox.SpaceBash.setPlayers(2);g.phase='fight';g.crates=[crate({x:.4})];g.fighters[0].x=g.fighters[0].z=0;
 g.pollGamepad();pad.buttons[2].pressed=true;g.pollGamepad();assert.equal(g.fighters[0].carrying,g.crates[0]);
 g.pollGamepad();assert.ok(g.fighters[0].carrying);pad.buttons[2].pressed=false;g.pollGamepad();pad.buttons[2].pressed=true;g.pollGamepad();
 assert.equal(g.fighters[0].carrying,null);assert.ok(g.crates[0].vx>7);assert.equal(g.crates[0].vz,0);
});
test('held gamepad buttons cannot fire on resume; disconnect neutralizes movement',()=>{
 let pads=[];const g=game(123,{navigator:{getGamepads:()=>pads}});g.sandbox.SpaceBash.setPlayers(2);g.phase='fight';
 const pad={connected:true,mapping:'standard',axes:[1,0,0,0],buttons:Array.from({length:16},()=>({pressed:false}))};pads=[pad];
 g.pollGamepad();assert.ok(g.joy.x>.9);g.crates=[crate({x:g.fighters[0].x+.4,z:g.fighters[0].z})];g.openSettingsPaused();pad.buttons[2].pressed=true;g.pollGamepad();g.closeSettingsToPause();g.resumeFromPause();g.pollGamepad();assert.equal(g.fighters[0].carrying,null);
 pads=[];g.pollGamepad();assert.equal(g.joy.x,0);
});
test('throw landing guide follows actual first landing physics without changing game state',()=>{
 const g=arena(),f=g.fighters[0],c=crate({x:.4});g.crates=[c];g.grabThrow(f);const before=[f.x,f.z,c.x,c.z,c.fuse];
 const preview=g.throwPreview(f);assert.deepEqual([f.x,f.z,c.x,c.z,c.fuse],before);g.grabThrow(f);
 for(let i=0;i<240&&!c.grounded;i++)g.updateCrates(1/120);
 assert.ok(Math.hypot(c.x-preview.x,c.z-preview.z)<.025);assert.ok(preview.points.length>3);
});
test('reduced motion suppresses cosmetic particles and blast flash, not explosion gameplay',()=>{
 const g=game(123,{storage:storage({reducedMotion:true})});g.sandbox.SpaceBash.setPlayers(2);g.phase='fight';g.crates=[];g.fighters[0].x=g.fighters[0].z=0;
 g.explode(crate({type:'tnt',x:.1}));assert.equal(g.particles.length,0);assert.equal(g.flash,0);assert.ok(g.fighters[0].hp<100);
});
test('no synthesized audio is created before a user gesture',()=>{
 const g=arena();let created=0;g.sandbox.AudioContext=function(){created++;throw Error('boundary')};g.kick(g.fighters[0]);assert.equal(created,0);g.fire('pointerdown');g.fighters[0].kickCd=0;g.kick(g.fighters[0]);assert.equal(created,1);
});
test('match results list all seats and provide rematch and setup routes',()=>{
 const g=arena(10);for(let i=0;i<3;i++){g.phase='fight';g.finishRound(g.fighters[0]);}
 assert.match(g.element('#resultStandings').textContent,/YOU.*3/);assert.match(g.element('#resultStandings').textContent,/AXIS/);
 click(g,'#rematch');assert.equal(g.phase,'countdown');assert.ok(g.wins.every(v=>v===0));
 g.openSettingsPaused();click(g,'#menu');assert.equal(g.phase,'setup');assert.equal(g.element('#setup').classList.contains('open'),true);
});
test('cosmetic accessibility settings do not change seeded match outcomes',()=>{
 const normal=game(42),reduced=game(42,{storage:storage({reducedMotion:true})});
 for(const g of [normal,reduced]){g.sandbox.SpaceBash.setPlayers(4);g.advance(30)}
 const state=g=>JSON.parse(JSON.stringify({round:g.round,phase:g.phase,wins:g.wins,fighters:g.fighters.map(f=>({x:f.x,z:f.z,y:f.y,hp:f.hp,alive:f.alive})),crates:g.crates.map(c=>({x:c.x,z:c.z,y:c.y,type:c.type,fuse:c.fuse}))}));
 assert.deepEqual(state(normal),state(reduced));
});
test('keyboard independent aim survives movement and Escape clears held keys',()=>{
 const g=arena();g.fire('keydown',{code:'KeyL'});g.fire('keydown',{code:'KeyW'});g.poll();g.step(1/120);
 assert.equal(g.fighters[0].faceX,1);assert.equal(g.fighters[0].faceZ,0);assert.ok(g.fighters[0].vz<0);
 g.fire('keydown',{code:'Escape'});assert.equal(g.paused,true);g.fire('keydown',{code:'Escape'});g.poll();assert.equal(g.joy.z,0);
});
test('new guides and suit/deck paths render without mutating simulation',()=>{
 const g=arena(10),f=g.fighters[0];g.crates=[crate({x:.4,type:'tnt'}),crate({id:2,x:1,y:3,grounded:false})];g.grabThrow(f);g.destroyTile(1.5,1.5);
 const before=g.crates.map(c=>({x:c.x,z:c.z,y:c.y,fuse:c.fuse}));g.frames.length=0;g.render();assert.doesNotThrow(()=>g.frames.shift()());
 assert.deepEqual(g.crates.map(c=>({x:c.x,z:c.z,y:c.y,fuse:c.fuse})),before);
});
test('menu keyboard navigation keeps native arrows and Space available',()=>{
 const g=arena();g.openSettingsPaused();let prevented=0;
 for(const code of ['ArrowDown','Space'])g.fire('keydown',{code,target:{tagName:'SELECT'},preventDefault(){prevented++}});
 assert.equal(prevented,0);assert.equal(g.fighters[0].vy,0);
});
test('urgent carried TNT preview warns when the fuse ends before landing',()=>{
 const g=arena(),f=g.fighters[0],c=crate({type:'tnt',x:.4,armed:true,fuse:.1});g.crates=[c];g.grabThrow(f);
 assert.equal(g.throwPreview(f).fuseFirst,true);c.fuse=3;assert.equal(g.throwPreview(f).fuseFirst,false);
});
test('short landscape uses the clear middle between touch controls for a larger deck',()=>{
 const g=game();g.sandbox.innerWidth=844;g.sandbox.innerHeight=390;g.resize();const b=g.board;
 assert.ok(b.size*.96>350,'deck should use the open middle rather than a narrow strip above controls');
 assert.ok(b.cx-b.size*.48>146);assert.ok(b.cx+b.size*.48<844-198);assert.ok(b.cy-b.size*.23>=110);assert.ok(b.cy+b.size*.23+Math.max(8,b.tile*.2)<340);
});
