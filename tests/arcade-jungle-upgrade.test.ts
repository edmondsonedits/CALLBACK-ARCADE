import assert from 'node:assert/strict';import test from 'node:test';
import{JUNGLE_GAME,createJungleMatch,stepJungleMatch,jungleBotInput}from'../lib/arcade/upgrades/jungle-bash';
import{tileIndexAt}from'../lib/arcade/practice/games/destructible-floor';
const ids=Array.from({length:10},(_,n)=>String(n).padStart(2,'0'));
test('Jungle runs ten bots to a finite result across all three arenas',()=>{for(const arena of JUNGLE_GAME.arenas){let s=createJungleMatch(ids,51,{...JUNGLE_GAME.defaults,arena:arena.id,duration:30});for(let n=0;n<1000&&!s.core.finished;n++)s=stepJungleMatch(s,Object.fromEntries(ids.map(id=>[id,jungleBotInput(s,id)])));assert.equal(Object.keys(s.core.players).length,10);assert.ok(s.core.finished,arena.id);assert.ok(Object.values(s.core.players).every(p=>[p.x,p.y,p.vx,p.vy].every(Number.isFinite)))}});
test('Canopy pillars physically deflect players and Ruins allows timed gap jumps',()=>{
 const p=createJungleMatch(ids,51,{...JUNGLE_GAME.defaults,arena:'canopy'});p.core.players['00']!.x=2.2;p.core.players['00']!.y=0;const q=stepJungleMatch(p,{}).core.players['00']!;assert.ok(Math.hypot(q.x-3,q.y)>=1.7);
 const s=createJungleMatch(ids,51,{...JUNGLE_GAME.defaults,arena:'ruins'}),floor=s.core.floor!,human=s.core.players['00']!;floor.tiles[tileIndexAt(floor,human.x,human.y)!]!.state='destroyed';const jump=stepJungleMatch(s,{'00':{sequence:1,x:0,y:0,action:'jump'}});assert.equal(jump.core.players['00']!.eliminated,false);const grounded=stepJungleMatch(s,{});assert.equal(grounded.core.players['00']!.eliminated,true);
});
