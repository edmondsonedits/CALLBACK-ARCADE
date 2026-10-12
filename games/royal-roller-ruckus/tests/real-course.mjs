// Optional integration check using licensed Three.js installed outside the checkout.
// THREE_MODULE=/absolute/path/to/three/build/three.module.js node .../real-course.mjs
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {harness} from './harness.mjs';
const three=await import(pathToFileURL(process.env.THREE_MODULE).href);
for(const count of [2,4,10]){
 const h=harness({three});
 const result=h.run(`(()=>{
  let seed=123;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  buildCurve();buildCourseZones();racerCountEl.value='${count}';resetRace();phase='race';
  // Every seat uses the actual bot controller and physical simulation. No pose or progress writes.
  updatePlayer=updateAI;for(let i=0;i<${count};i++)networkInputs[i].connected=true;
  let steps=0,respawns=0;const recover=respawn;respawn=r=>{respawns++;recover(r)};
  while(steps<120*360&&racers.some(r=>!r.finished)){fixedUpdate(1/120);steps++;}
  return {count:${count},seconds:steps/120,respawns,finite:racers.every(r=>[r.x,r.y,r.z,r.vx,r.vy,r.vz].every(Number.isFinite)),racers:racers.map(r=>({id:r.id,lap:r.lap,checkpoint:r.nextCheckpoint,finished:r.finished,rank:r.finishRank}))};
 })()`);
 console.log(JSON.stringify(result));assert.ok(result.finite);assert.ok(result.racers.every(r=>r.finished&&r.lap===3),'all racers must complete three legal laps');assert.equal(new Set(result.racers.map(r=>r.rank)).size,count);
}

const stress=harness({three});
const recovery=stress.run(`(()=>{
 buildCurve();buildCourseZones();racerCountEl.value='10';resetRace();phase='race';updatePlayer=updateAI;
 const origin=lanePosition(80);for(const r of racers){Object.assign(r,{x:origin.x,y:origin.y,z:origin.z,vx:0,vy:0,vz:0,trackIdx:80,lastTrackIdx:80,lastCheckpointIdx:80,nextCheckpoint:2});seedCheckpointSweep(r);}
 let finite=true;for(let step=0;step<120*12;step++){fixedUpdate(1/120);finite=finite&&racers.every(r=>[r.x,r.y,r.z,r.vx,r.vy,r.vz].every(Number.isFinite));}
 const r=racers[0];return{finite,playerDistance:Math.hypot(r.x-origin.x,r.z-origin.z),positions:racers.map(r=>[r.x,r.y,r.z])};
})()`);
console.log(JSON.stringify({contactRecovery:recovery}));assert.ok(recovery.finite);assert.ok(recovery.playerDistance>3,'pack recovery must allow physical progress');
const landing=harness({three});
const caught=landing.run(`(()=>{buildCurve();buildCourseZones();resetRace();const r=racers[0],p=trackSamples[80];Object.assign(r,{x:p.x,y:p.y+CAGE_R+2,z:p.z,vx:0,vz:0,vy:-1,falling:true});samplePlayerInput=()=>({moveX:0,moveY:0});for(let i=0;i<240&&r.falling;i++)updateAirborne(r,1/120);checkpointUpdate(r);return{falling:r.falling,landings:r.landingCount,nextCheckpoint:r.nextCheckpoint,lap:r.lap};})()`);
console.log(JSON.stringify({landing:caught}));assert.equal(caught.falling,false);assert.equal(caught.landings,1);assert.equal(caught.nextCheckpoint,1);assert.equal(caught.lap,0);
