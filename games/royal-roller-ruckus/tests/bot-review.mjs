// Evidence-only matched-seed study. Does not edit the product or inject race progress.
// THREE_MODULE=/.../three/build/three.module.js node .../bot-review.mjs > matrix.jsonl
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {harness} from './harness.mjs';
const three=await import(pathToFileURL(process.env.THREE_MODULE).href);
const base='785a15000abe11970c7b92c5f3cab197061fcedf';
const candidate='e1141247bc44bc0d2188b6547624f94f5add8d60';
const entry='games/royal-roller-ruckus/source/index.html';
const read=ref=>execFileSync('git',['show',`${ref}:${entry}`],{encoding:'utf8'});
const candidateHtml=read(candidate);
export function excludeOptionalBalance(html){
 const from=`  // Aim through the next gate before looking beyond it; no progress is awarded here.
  const gateAhead=(checkpointIndex(r.nextCheckpoint)-r.trackIdx+TRACK_SAMPLES)%TRACK_SAMPLES;
  const look=Math.min(Math.floor((11+sp*2.25)*D.look*(1-cornerFactor*.8)),gateAhead<40?Math.max(2,gateAhead+1):40),idx=`;
 if(!html.includes(from)||!html.includes('cornerFactor*.5-edgeFactor*.18'))throw Error('Candidate bot code does not match reviewed boundary');
 return html.replace(from,'  const look=Math.floor((11+sp*2.25)*D.look),idx=').replace('cornerFactor*.5-edgeFactor*.18','cornerFactor*.31-edgeFactor*.18');
}
const variants={'baseline':read(base),'candidate':candidateHtml,'defects-only':excludeOptionalBalance(candidateHtml),
 'no-corner-brake':candidateHtml.replace('cornerFactor*.5-edgeFactor*.18','cornerFactor*.31-edgeFactor*.18'),
 'no-path-retarget':excludeOptionalBalance(candidateHtml).replace('cornerFactor*.31-edgeFactor*.18','cornerFactor*.5-edgeFactor*.18')};
const selected=(process.env.BOT_VARIANTS||'baseline,candidate,defects-only').split(',');
const seeds=(process.env.BOT_SEEDS||'123,456,789').split(',').map(Number);
const counts=(process.env.BOT_COUNTS||'2,4,10').split(',').map(Number);
const difficulties=(process.env.BOT_DIFFICULTIES||'easy,normal,hard').split(',');
const horizon=Number(process.env.BOT_SECONDS||360);
for(const variant of selected)for(const count of counts)for(const difficulty of difficulties)for(const seed of seeds){
 const html=variants[variant];if(!html)throw Error('Unknown variant');
 const h=harness({three,html});
 const result=h.run(`(()=>{
  let randomState=${seed};Math.random=()=>((randomState=(Math.imul(randomState,1664525)+1013904223)>>>0)/4294967296);
  buildCurve();buildCourseZones();difficultyEl.value=${JSON.stringify(difficulty)};racerCountEl.value='${count}';resetRace();phase='race';
  updatePlayer=updateAI;for(let i=0;i<${count};i++)networkInputs[i].connected=true;
  let time=0,tick=0,relocations=0;const gateObservations=[];
  const finishIndex=typeof checkpointIndex==='function'?checkpointIndex(0):0;
  const stats=racers.map(r=>({id:r.id,falls:0,landings:0,respawns:0,checkpoints:0,gateMisses:0,nonForwardCredits:0,finishPasses:0,missedFinishPasses:0,stallEpisodes:0,stallSeconds:0,maxStallSeconds:0,maxNoCheckpointSeconds:0,lapTimes:[],finishTime:null,finite:true,initialPersonality:{...r.aiPersonality},initialDecision:r.aiDecision,initialLaneTimer:r.aiLaneTimer}));
  const history=racers.map(r=>({x:r.x,y:r.y,z:r.z,idx:r.trackIdx,cp:r.nextCheckpoint,lap:r.lap,lapAtLine:0,lastLapTime:0,lastCheckpointTime:0,stall:0,routeSinceLine:0}));
  const fall=startFall;startFall=r=>{if(!r.falling&&!r.finished)stats[r.id].falls++;return fall(r)};
  const land=landOnTrack;landOnTrack=(r,hit)=>{stats[r.id].landings++;relocations|=1<<r.id;return land(r,hit)};
  const recover=respawn;respawn=r=>{stats[r.id].respawns++;relocations|=1<<r.id;return recover(r)};
  const checkpoint=checkpointUpdate;
  checkpointUpdate=r=>{
   const s=stats[r.id],prev=history[r.id],cp=r.nextCheckpoint,lap=r.lap;
   const idx=typeof checkpointIndex==='function'?checkpointIndex(cp):cp*TRACK_SAMPLES/CHECKPOINT_COUNT;
   const p=trackSamples[idx],t=trackTangents[idx],n=trackNormals[idx];
   const before=(prev.x-p.x)*t.x+(prev.z-p.z)*t.z,after=(r.x-p.x)*t.x+(r.z-p.z)*t.z;
   const near=i=>Math.abs(((i-idx+TRACK_SAMPLES*1.5)%TRACK_SAMPLES)-TRACK_SAMPLES*.5)<16;
   const geometricCross=!r.falling&&!r.finished&&!(relocations&(1<<r.id))&&near(prev.idx)&&near(r.trackIdx)
    &&Math.abs(prev.y-CAGE_R-p.y)<.55&&Math.abs(r.y-CAGE_R-p.y)<.55
    &&Math.abs((r.x-p.x)*n.x+(r.z-p.z)*n.z)<=TRACK_WIDTH*.5+TUNING.track.supportMargin
    &&before<0&&after>=0&&Math.hypot(r.x-prev.x,r.z-prev.z)<=trackSampleSpacing*4;
   checkpoint(r);
   const awarded=r.nextCheckpoint!==cp||r.lap!==lap;
   if(awarded){s.checkpoints++;s.maxNoCheckpointSeconds=Math.max(s.maxNoCheckpointSeconds,time-prev.lastCheckpointTime);prev.lastCheckpointTime=time;if(r.vx*t.x+r.vz*t.z<=0)s.nonForwardCredits++;}
   if(geometricCross&&!awarded){s.gateMisses++;
    if(${process.env.BOT_TRACE==='1'})gateObservations.push({time,id:r.id,checkpoint:cp,gateIndex:idx,previousIndex:prev.idx,currentIndex:r.trackIdx,before,after,lateral:Math.abs((r.x-p.x)*n.x+(r.z-p.z)*n.z),distance:Math.hypot(r.x-prev.x,r.z-prev.z),grounded:r.grounded,previousY:prev.y,currentY:r.y,gateY:p.y});
   }
   Object.assign(prev,{x:r.x,y:r.y,z:r.z,idx:r.trackIdx,cp:r.nextCheckpoint});
  };
  const dt=1/120;
  for(;tick<120*${horizon}&&racers.some(r=>!r.finished);tick++){
   time=(tick+1)*dt;relocations=0;
   const before=racers.map(r=>({idx:r.trackIdx,falling:r.falling,finished:r.finished}));
   fixedUpdate(dt);
   for(const r of racers){
    const s=stats[r.id],prev=history[r.id],old=before[r.id];if(old.finished)continue;
    s.finite=s.finite&&[r.x,r.y,r.z,r.vx,r.vy,r.vz].every(Number.isFinite);
    if(r.lap>prev.lap){s.lapTimes.push(time-prev.lastLapTime);prev.lastLapTime=time;prev.lap=r.lap;}
    if(r.finished&&s.finishTime===null)s.finishTime=time;
    const stalled=!r.falling&&!r.finished&&Math.hypot(r.vx,r.vz)<.25;
    if(stalled){prev.stall+=dt;s.maxStallSeconds=Math.max(s.maxStallSeconds,prev.stall);if(prev.stall>=2&&prev.stall-dt<2)s.stallEpisodes++;if(prev.stall>=2)s.stallSeconds+=dt;}else prev.stall=0;
    s.maxNoCheckpointSeconds=Math.max(s.maxNoCheckpointSeconds,time-prev.lastCheckpointTime);
    if(!old.falling&&!r.falling&&!(relocations&(1<<r.id))){
     const delta=((r.trackIdx-old.idx+TRACK_SAMPLES*1.5)%TRACK_SAMPLES)-TRACK_SAMPLES*.5;
     if(Math.abs(delta)<=44){
      prev.routeSinceLine+=delta;
      const line=(finishIndex+8)%TRACK_SAMPLES,distance=(line-old.idx+TRACK_SAMPLES)%TRACK_SAMPLES;
      if(delta>0&&distance>0&&distance<=delta&&prev.routeSinceLine>TRACK_SAMPLES*.5){s.finishPasses++;if(r.lap<=prev.lapAtLine)s.missedFinishPasses++;prev.lapAtLine=r.lap;prev.routeSinceLine=0;}
     }
    }
   }
  }
  return{elapsedSeconds:tick/120,finishIndex,gateObservations,racers:racers.map((r,i)=>({...stats[i],lap:r.lap,nextCheckpoint:r.nextCheckpoint,trackIdx:r.trackIdx,finished:r.finished,rank:r.finishRank,progressStall:stats[i].maxNoCheckpointSeconds>=30}))};
 })()`);
 console.log(JSON.stringify({variant,baseCommit:base,candidateCommit:candidate,sourceSha256:createHash('sha256').update(html).digest('hex'),count,difficulty,seed,horizonSeconds:horizon,fixedHz:120,...result}));
}
