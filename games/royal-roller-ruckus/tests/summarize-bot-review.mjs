import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const dir=new URL('../integration/bot-review/',import.meta.url);
const variants=['baseline','candidate','defects-only','no-corner-brake'];
const rows=[];
for(const variant of variants){const data=(await readFile(new URL(`matrix-${variant}.jsonl`,dir),'utf8')).trim().split('\n').map(JSON.parse);assert.equal(data.length,27,variant);
 assert.equal(new Set(data.map(r=>`${r.count}/${r.difficulty}/${r.seed}`)).size,27,`Unique cells: ${variant}`);
 for(const r of data){assert.equal(r.variant,variant);assert.equal(r.horizonSeconds,360);assert.equal(r.fixedHz,120);assert.ok([2,4,10].includes(r.count));assert.ok(['easy','normal','hard'].includes(r.difficulty));assert.ok([123,456,789].includes(r.seed));assert.equal(r.racers.length,r.count);assert.equal(new Set(r.racers.filter(p=>p.finished).map(p=>p.rank)).size,r.racers.filter(p=>p.finished).length);for(const p of r.racers){assert.equal(p.lapTimes.length,p.lap);if(p.finished)assert.equal(p.lap,3);}}
 rows.push(...data);}
const key=r=>`${r.count}/${r.difficulty}/${r.seed}`;
const base=new Map(rows.filter(r=>r.variant==='baseline').map(r=>[key(r),r]));
for(const r of rows){const b=base.get(key(r));assert.ok(b);assert.deepEqual(r.racers.map(p=>[p.initialPersonality,p.initialDecision,p.initialLaneTimer]),b.racers.map(p=>[p.initialPersonality,p.initialDecision,p.initialLaneTimer]),`Initial bot random state: ${r.variant}/${key(r)}`);assert.ok(r.racers.every(p=>p.finite));}
function q(values,p){if(!values.length)return null;const a=values.slice().sort((x,y)=>x-y),i=(a.length-1)*p,l=Math.floor(i);return a[l]+(a[Math.ceil(i)]-a[l])*(i-l);}
function describe(values){return{n:values.length,min:q(values,0),p10:q(values,.1),median:q(values,.5),p90:q(values,.9),max:q(values,1),mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null};}
function aggregate(group){const racers=group.flatMap(r=>r.racers),laps=racers.flatMap(p=>p.lapTimes),sum=k=>racers.reduce((a,p)=>a+p[k],0);return{
 runs:group.length,completeRaces:group.filter(r=>r.racers.every(p=>p.finished)).length,racers:racers.length,finishers:racers.filter(p=>p.finished).length,unfinished:racers.filter(p=>!p.finished).length,lapsCompleted:sum('lap'),lapsTarget:racers.length*3,falls:sum('falls'),respawns:sum('respawns'),landings:sum('landings'),gatePlaneNonAwards:sum('gateMisses'),nonForwardCredits:sum('nonForwardCredits'),missedFinishPasses:sum('missedFinishPasses'),lowSpeedStallEpisodes:sum('stallEpisodes'),progressStalledRacers:racers.filter(p=>p.progressStall).length,maxNoCheckpointSeconds:Math.max(...racers.map(p=>p.maxNoCheckpointSeconds)),lapSeconds:describe(laps),finishSeconds:describe(racers.filter(p=>p.finished).map(p=>p.finishTime)),restrictedFinishSeconds:describe(racers.map(p=>p.finishTime??360))};}
const groups=[];for(const variant of variants)for(const count of [2,4,10])for(const difficulty of ['easy','normal','hard'])groups.push({variant,count,difficulty,...aggregate(rows.filter(r=>r.variant===variant&&r.count===count&&r.difficulty===difficulty))});
const overall=variants.map(variant=>({variant,...aggregate(rows.filter(r=>r.variant===variant))}));
const ordering=[];for(const variant of variants)for(const count of [2,4,10]){
 const cells=groups.filter(g=>g.variant===variant&&g.count===count),order=field=>cells.filter(c=>c[field].n).slice().sort((a,b)=>a[field].median-b[field].median).map(c=>c.difficulty);
 ordering.push({variant,count,fastestToSlowestCompletedLapMedian:cells.every(c=>c.lapSeconds.n>0)?order('lapSeconds'):null,fastestToSlowestFinishMedian:cells.every(c=>c.finishers>0)?order('restrictedFinishSeconds'):null,restrictedFinishMean:cells.map(c=>({difficulty:c.difficulty,seconds:c.restrictedFinishSeconds.mean}))});
}
const summary={baseCommit:'785a15000abe11970c7b92c5f3cab197061fcedf',candidateCommit:'e1141247bc44bc0d2188b6547624f94f5add8d60',seeds:[123,456,789],horizonSeconds:360,initialRandomStateMatched:true,groups,overall,ordering};
await writeFile(new URL('summary.json',dir),JSON.stringify(summary,null,2)+'\n');
const f=v=>v===null?'—':v.toFixed(2);
let table='| Variant | Seats | Difficulty | Finished / total | Laps / target | Falls / respawns | Missed finish passes | Progress-stalled racers | Completed lap seconds: median [p10, p90] | Finish seconds: median / restricted mean |\n| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |\n';
for(const g of groups)table+=`| ${g.variant} | ${g.count} | ${g.difficulty} | ${g.finishers}/${g.racers} | ${g.lapsCompleted}/${g.lapsTarget} | ${g.falls}/${g.respawns} | ${g.missedFinishPasses} | ${g.progressStalledRacers} | ${f(g.lapSeconds.median)} [${f(g.lapSeconds.p10)}, ${f(g.lapSeconds.p90)}] | ${f(g.finishSeconds.median)} / ${f(g.restrictedFinishSeconds.mean)} |\n`;
await writeFile(new URL('results-table.md',dir),table);
console.log(JSON.stringify({overall,ordering},null,2));
