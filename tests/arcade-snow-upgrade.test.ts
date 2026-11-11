import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnowMatch, stepSnowMatch, snowBotInput, SNOW_ARENAS, SNOW_DEFAULTS } from '../lib/arcade/upgrades/snow-bash';
const ids = Array.from({length:10},(_,i)=>`bot-${i}`);
test('Snow supports ten distinct bots and finishes every mechanical arena',()=>{
 for(const arena of SNOW_ARENAS){let s=createSnowMatch(ids,712,{...SNOW_DEFAULTS,arena:arena.id,duration:30});let moved=false,acted=false;
  for(let n=0;n<1000&&!s.core.finished;n++){const inputs=Object.fromEntries(ids.map(id=>[id,snowBotInput(s,id)]));acted ||= Object.values(inputs).some(i=>i.action!=='none');const x=s.core.players[ids[0]!]!.x;s=stepSnowMatch(s,inputs);moved ||= Math.abs(s.core.players[ids[0]!]!.x-x)>.01}
  assert.equal(Object.keys(s.core.players).length,10);assert.ok(moved&&acted,arena.id);assert.ok(s.core.finished,arena.id);
  assert.ok(Object.values(s.core.players).every(p=>[p.x,p.y,p.vx,p.vy].every(Number.isFinite)),arena.id);
 }
});
test('Snow map mechanics change physics and floor topology',()=>{
 let still=createSnowMatch(ids,712,{...SNOW_DEFAULTS,arena:'palace'}),wind=createSnowMatch(ids,712,{...SNOW_DEFAULTS,arena:'crosswind'}),thaw=createSnowMatch(ids,712,{...SNOW_DEFAULTS,arena:'thaw'});
 for(let n=0;n<200;n++){still=stepSnowMatch(still,{});wind=stepSnowMatch(wind,{});thaw=stepSnowMatch(thaw,{})}
 assert.notEqual(wind.core.players[ids[0]!]!.vx,still.core.players[ids[0]!]!.vx);assert.ok(thaw.core.floor!.tiles.some(t=>t.state==='destroyed'));assert.equal(still.core.floor,null);
});
test('Snow bot actions use the same pickup, jump and throw rules as the human',()=>{
 const s=createSnowMatch(ids,31,SNOW_DEFAULTS),p=s.core.players[ids[0]!]!;p.x=s.core.crate!.x;p.y=s.core.crate!.y;
 const input=snowBotInput(s,ids[0]!);assert.equal(input.action,'pickup');let next=stepSnowMatch(s,{[ids[0]!]:input});assert.equal(next.core.players[ids[0]!]!.carriedCrate,true);
 next.core.penguin!.state='sleep';next.core.players[ids[1]!]!.x=p.x+2;next.core.players[ids[1]!]!.y=p.y;
 const shot=snowBotInput(next,ids[0]!);assert.equal(shot.action,'throw');next=stepSnowMatch(next,{[ids[0]!]:shot});assert.ok(next.core.projectiles.length>0);
});
