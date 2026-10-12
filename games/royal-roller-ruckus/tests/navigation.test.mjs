// Explicit Three.js integration regression; not a replacement for the dependency-free suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {simulateBots} from './bot-simulation.mjs';
import {readFileSync} from 'node:fs';
const html=process.env.NAV_ENTRY?readFileSync(process.env.NAV_ENTRY,'utf8'):undefined;
const three=await import(pathToFileURL(process.env.THREE_MODULE).href);
const results=[];
const seeds=(process.env.NAV_SEEDS||'123,456,789').split(',').map(Number);
for(const count of [2,4,10])for(const difficulty of ['easy','normal','hard'])for(const seed of seeds){
 await test(`${count} ${difficulty} seed ${seed}: forward gates, no progress stalls, three legal laps`,()=>{
  const r=simulateBots(three,{html,count,difficulty,seed});results.push({count,difficulty,seed,...r});
  assert.ok(r.racers.every(p=>p.finite&&p.finished&&p.lap===3),'every seat must finish three legal laps within 240 seconds');
  // A missed-finish observation can be followed by a short legal turn-back.
  // Bound actual route/time without credit; keep raw overshoots in the evidence.
  assert.ok(r.racers.every(p=>p.maxRouteWithoutCheckpoint<320),'no extra half circuit after a missed gate');
  assert.ok(r.racers.every(p=>p.maxNoCheckpointSeconds<25),'no 25-second checkpoint gap');
  assert.equal(r.racers.reduce((n,p)=>n+p.nonForwardCredits,0),0,'no non-forward checkpoint credit');
  assert.equal(r.racers.reduce((n,p)=>n+p.stallEpisodes,0),0,'no two-second low-speed stall');
 });
}
await test('effective difficulty ordering holds for both mean and median finish time at each seat count',()=>{
 const median=a=>{const s=a.slice().sort((a,b)=>a-b);return(s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2};
 for(const count of [2,4,10]){
  const times=d=>results.filter(r=>r.count===count&&r.difficulty===d).flatMap(r=>r.racers.map(p=>p.finishTime??240));
  for(const metric of [a=>a.reduce((x,y)=>x+y,0)/a.length,median])assert.ok(metric(times('hard'))<metric(times('normal'))&&metric(times('normal'))<metric(times('easy')),`difficulty ordering at ${count} contestants`);
 }
});
if(process.env.NAV_OUTPUT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.NAV_OUTPUT,results.map(r=>JSON.stringify(r)).join('\n')+'\n');}
