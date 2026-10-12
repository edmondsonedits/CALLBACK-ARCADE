import assert from 'node:assert/strict';
import * as three from '../source/vendor/three.module.js';
import {harness} from './harness.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const results=[];
for(const course of ['crownway','frostglass','foundry','skygarden']){
 const h=harness({three});const r=h.run(`(()=>{courseEl.value='${course}';buildCurve();resetRace();camera=new THREE.PerspectiveCamera(49,1280/720,.1,260);let worstY=0,worstTurn=0;const last=new THREE.Quaternion();const steps=Math.ceil(trackLength/7.7*60);for(let step=0;step<steps;step++){const sample=step/60*7.7/trackSampleSpacing,i=Math.floor(sample)%TRACK_SAMPLES,f=sample-Math.floor(sample),r=racers[0],p=trackSamples[i],q=trackSamples[(i+1)%TRACK_SAMPLES],t=trackTangents[i];Object.assign(r,{x:lerp(p.x,q.x,f),y:lerp(p.y,q.y,f)+CAGE_R,z:lerp(p.z,q.z,f),trackIdx:i,vx:t.x*7.7,vz:t.z*7.7,speed:7.7,falling:false});updateCamera(1/60);camera.updateMatrixWorld();if(step)worstTurn=Math.max(worstTurn,last.angleTo(camera.quaternion));last.copy(camera.quaternion);const screen=new THREE.Vector3(r.x,r.y-CAGE_R,r.z).project(camera);worstY=Math.max(worstY,(1-screen.y)*360);}return{course:'${course}',worstY,worstTurn};})()`);results.push(r);assert.ok(r.worstY<532);assert.ok(r.worstTurn<.1);console.log(JSON.stringify(r));}
mkdirSync(new URL('../integration/worlds/',import.meta.url),{recursive:true});writeFileSync(new URL('../integration/worlds/camera.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
