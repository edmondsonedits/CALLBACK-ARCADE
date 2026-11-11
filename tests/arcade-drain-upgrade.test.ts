import assert from 'node:assert/strict';import test from 'node:test';
import {createDrainMatch,stepDrainMatch,drainBotInput,DRAIN_GAME} from '../lib/arcade/upgrades/drain-bash';
const ids=Array.from({length:10},(_,n)=>String(n).padStart(2,'0'));
test('Drain starts ten weapon-using bots and finishes on each arena',()=>{
 for(const arena of DRAIN_GAME.arenas){let s=createDrainMatch(ids,72,{...DRAIN_GAME.defaults,arena:arena.id,duration:30});
  for(let n=0;n<1000&&!s.game.core.finished;n++){const inputs=Object.fromEntries(ids.map(id=>[id,drainBotInput(s,id)]));s=stepDrainMatch(s,inputs)}
  assert.equal(Object.keys(s.game.core.players).length,10);assert.ok(s.game.core.finished,arena.id);assert.ok(Object.values(s.game.core.players).every(p=>[p.x,p.y,p.vx,p.vy].every(Number.isFinite)));
 }
});
test('Drain flood currents and echo rebounds change real movement and shot paths',()=>{
 const a=createDrainMatch(ids,42,{...DRAIN_GAME.defaults,arena:'flood'}),b=createDrainMatch(ids,42,{...DRAIN_GAME.defaults,arena:'junction'});assert.notEqual(stepDrainMatch(a,{}).game.core.players['00']!.vy,stepDrainMatch(b,{}).game.core.players['00']!.vy);
 const s=createDrainMatch(ids,42,{...DRAIN_GAME.defaults,arena:'echo'});s.game.projectiles=[{ownerId:'00',kind:'burst',x:9.1,y:0,vx:7,vy:0,ageTicks:3}];assert.ok(stepDrainMatch(s,{}).game.projectiles[0]!.vx<0);
});

test('Drain bots spend every available weapon through ordinary special inputs',()=>{
 // Mystery crates can legitimately grant healing; prove weapon use with each real inventory.
 for(const weapon of ['homing','burst','sonic'] as const){const s=createDrainMatch(ids,72,DRAIN_GAME.defaults);s.game.specials['00']={weapon,ammo:2};const input=drainBotInput(s,'00');assert.equal(input.action,'special');const next=stepDrainMatch(s,{'00':input});assert.equal(next.game.specials['00']!.ammo,1);assert.ok(next.game.projectiles.length+next.game.waves.length>0)}
});
