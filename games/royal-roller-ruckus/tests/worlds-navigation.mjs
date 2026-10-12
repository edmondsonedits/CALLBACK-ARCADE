import assert from 'node:assert/strict';
import {simulateBots} from './bot-simulation.mjs';
import * as THREE from '../source/vendor/three.module.js';
import {writeFileSync,mkdirSync} from 'node:fs';
const results=[];
for(const course of ['crownway','frostglass','foundry','skygarden'])for(const count of [2,10])for(const seed of [123,456,789]){
 const result=simulateBots(THREE,{course,count,seed,hazards:1.25,horizon:240});results.push({course,count,seed,...result});
 console.log(JSON.stringify({course,count,seed,seconds:result.elapsedSeconds,finished:result.racers.filter(r=>r.finished).length,falls:result.racers.reduce((n,r)=>n+r.falls,0),illegal:result.racers.reduce((n,r)=>n+r.nonForwardCredits,0)}));
 assert.ok(result.racers.every(r=>r.finite&&r.finished&&r.lap===3),`${course}/${count}/${seed}: every bot finishes three legal laps`);
 assert.equal(result.racers.reduce((n,r)=>n+r.nonForwardCredits,0),0);assert.equal(new Set(result.racers.map(r=>r.rank)).size,count);
}
mkdirSync(new URL('../integration/worlds/',import.meta.url),{recursive:true});writeFileSync(new URL('../integration/worlds/navigation.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
