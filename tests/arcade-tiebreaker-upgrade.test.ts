import assert from 'node:assert/strict';import test from 'node:test';
import{TIE_GAME,createTieTournament,stepTieTournament,tieBotInput}from'../lib/arcade/upgrades/tie-breaker';
const ids=Array.from({length:10},(_,n)=>String(n).padStart(2,'0'));
test('Tie-Breaker genuinely includes all ten bots in a completed duel bracket',()=>{
 let s=createTieTournament(ids,73,{...TIE_GAME.defaults,duration:15});const appeared=new Set<string>();
 for(let n=0;n<60000&&!s.finished;n++){for(const id of Object.keys(s.duel.core.players))appeared.add(id);s=stepTieTournament(s,Object.fromEntries(ids.map(id=>[id,tieBotInput(s,id)])))}
 assert.deepEqual([...appeared].sort(),ids);assert.ok(s.finished);assert.equal(s.winners.length,1);assert.equal(s.completedDuels,9);
});
test('Tie-Breaker maps apply a wind field and a real breakable gap floor',()=>{
 const wind=createTieTournament(ids,73,{...TIE_GAME.defaults,arena:'wind'}),plain=createTieTournament(ids,73,{...TIE_GAME.defaults,arena:'court'});const id=Object.keys(wind.duel.core.players)[0]!;assert.notEqual(stepTieTournament(wind,{}).duel.core.players[id]!.vx,stepTieTournament(plain,{}).duel.core.players[id]!.vx);
 const ruins=createTieTournament(ids,73,{...TIE_GAME.defaults,arena:'ruins'});assert.ok(ruins.duel.core.floor);assert.equal(ruins.duel.core.gapJumping,true);assert.equal(Object.keys(ruins.duel.core.players).length,2);
});
