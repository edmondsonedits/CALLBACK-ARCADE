import assert from 'node:assert/strict';
import test from 'node:test';
import {createManicPanicState,stepManicPanic} from '../lib/arcade/practice/games/manic-panic';
import {createRubbleAllianceState,stepRubbleAlliance} from '../lib/arcade/practice/games/rubble-alliance';
import {createDragonDropState,stepDragonDrop} from '../lib/arcade/practice/games/dragon-drop';
import {createVoltVaultState,stepVoltVault} from '../lib/arcade/practice/games/volt-vault';
const ids=Array.from({length:10},(_,i)=>String(i).padStart(2,'0'));
test('Manic custom clock and blast reach are opt-in',()=>{
 const s=Reflect.apply(createManicPanicState,null,[ids,12,{durationTicks:1,blastScale:1.5}]);
 s.bombs=[{ownerId:'00',x:0,y:0,vx:0,vy:0,fuseTicks:1}];s.players['00'].x=3.2;s.players['00'].y=0;
 const next=stepManicPanic(s,{});assert.equal(next.players['00']!.bombHits,1);assert.equal(next.finished,true);
 assert.equal(stepManicPanic(createManicPanicState(ids,12),{}).finished,false);
});
test('Manic recovers the only bomb when its carrier falls',()=>{let s=createManicPanicState(ids,12);s.bombs=[];s.players['00']!.carryingBomb=true;s.players['00']!.x=11;s=stepManicPanic(s,{});assert.equal(s.players['00']!.eliminated,true);for(let i=0;i<70;i++)s=stepManicPanic(s,{});assert.ok(s.bombs.some(b=>b.fuseTicks===null));});
test('Rubble ten entrants have separate starts and custom single-leg results',()=>{
 const s=Reflect.apply(createRubbleAllianceState,null,[ids,12,{rounds:1,durationTicks:1}]);
 assert.equal(new Set(Object.values(s.players).map((p:unknown)=>{const q=p as {x:number;y:number};return q.x+','+q.y})).size,10);
 const next=stepRubbleAlliance(s,{});assert.equal(next.finished,true);assert.equal(next.roundScores['00']!.length,1);
 assert.equal(stepRubbleAlliance(createRubbleAllianceState(['a','b'],12),{}).finished,false);
 assert.equal(next.winners.length,10,'equal survival must not award the alphabetically first entrant');
});
test('Dragon ten-player and custom clock support leaves the four-player default intact',()=>{
 const s=Reflect.apply(createDragonDropState,null,[ids,12,{capacity:10,rounds:1,durationTicks:1}]);
 assert.equal(Object.keys(s.players).length,10);assert.equal(stepDragonDrop(s,{}).finished,true);
 assert.equal(Object.keys(createDragonDropState(ids,12).players).length,4);
});
test('Volt ten-player and custom clock support leaves the four-player default intact',()=>{
 const s=Reflect.apply(createVoltVaultState,null,[ids,12,{capacity:10,durationTicks:1}]);
 assert.equal(Object.keys(s.players).length,10);assert.equal(stepVoltVault(s,{}).finished,true);
 assert.equal(Object.keys(createVoltVaultState(ids,12).players).length,4);
});
