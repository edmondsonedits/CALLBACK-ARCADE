import { performance } from 'node:perf_hooks';
import { createSumoParty,controlSumoParty,acceptPartyInput,stepSumoParty,projectSumoSnapshot } from '../lib/party/sumo-runtime';
import { MAP_ORDER } from '../lib/arcade/online/sumo-core.mjs';
const summaries=[];
for(const map of MAP_ORDER){
 const party=createSumoParty({partyId:'synthetic-probe',roomCode:'TEST',matchId:'probe-'+map,now:0,seed:1919,options:{map},roster:Array.from({length:10},(_,seat)=>({id:String(seat).padStart(2,'0'),name:'Probe '+seat,memberId:'member-'+seat}))});
 controlSumoParty(party,'host',{operation:'start',seq:1,epoch:0},0);const costs:number[]=[],bytes:number[]=[];
 for(let i=0;i<600;i++){const now=3000+i*1000/60;for(let seat=0;seat<10;seat++)acceptPartyInput(party,'member-'+seat,{type:'input',v:1,epoch:party.epoch,seq:i,x:Math.sin(i/20+seat),y:Math.cos(i/20+seat),bashDown:i%90<40,dash:i%120===0},now);const t=performance.now();stepSumoParty(party,now);costs.push(performance.now()-t);if(i%3===0)bytes.push(new TextEncoder().encode(JSON.stringify(projectSumoSnapshot(party,{kind:'display',now}))).length);}
 costs.sort((a,b)=>a-b);summaries.push({map,steps:costs.length,meanMs:costs.reduce((a,b)=>a+b,0)/costs.length,p95Ms:costs[Math.floor(costs.length*.95)],maxMs:costs.at(-1),maxSnapshotBytes:Math.max(...bytes)});
}
console.log(JSON.stringify({evidence:'Local synthetic simulation CPU and wire size; no network or device latency',summaries},null,2));
