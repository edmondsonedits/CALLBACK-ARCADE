import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {harness} from './harness.mjs';
const three=await import(pathToFileURL(process.env.THREE_MODULE).href);
const h=harness({three});
const result=h.run(`(()=>{
 buildCurve();buildCourseZones();resetRace();camera=new THREE.PerspectiveCamera(49,1280/720,.1,260);camera.position.set(0,8,10);
 let worstY=-Infinity,worstTurn=0;const previous=new THREE.Quaternion();let initialized=false;
 // Continuous, constant 7.7 world-unit/sec travel along the actual elevated spline.
 const steps=Math.ceil(trackLength/7.7*60);
 for(let step=0;step<steps;step++){
  const sample=step/60*7.7/trackSampleSpacing,i=Math.floor(sample)%TRACK_SAMPLES,f=sample-Math.floor(sample);
  const r=racers[0],p=trackSamples[i],q=trackSamples[(i+1)%TRACK_SAMPLES],t=trackTangents[i];
  Object.assign(r,{x:lerp(p.x,q.x,f),y:lerp(p.y,q.y,f)+CAGE_R,z:lerp(p.z,q.z,f),trackIdx:i,vx:t.x*7.7,vz:t.z*7.7,speed:7.7,falling:false});
  updateCamera(1/60);camera.updateMatrixWorld();if(initialized)worstTurn=Math.max(worstTurn,previous.angleTo(camera.quaternion));previous.copy(camera.quaternion);initialized=true;
  const screen=new THREE.Vector3(r.x,r.y-CAGE_R,r.z).project(camera);worstY=Math.max(worstY,(1-screen.y)*360);
 }
 callbackCameraSet({rotate:72,zoom:1.24,tilt:-12});const code=callbackCameraSave();callbackCameraReset();const loaded=callbackCameraLoad(code,false);
 return{speed:7.7,steps,worstY,worstTurn,loaded,state:window.CallbackCamera.get(),code};
})()`);
console.log(JSON.stringify(result));assert.ok(result.worstY<532,'player must stay above the desktop controls');assert.ok(result.worstTurn<.10,'normal camera turn must remain bounded');assert.ok(result.loaded);assert.deepEqual({...result.state},{rotate:72,zoom:1.24,tilt:-12});
