import { readFileSync } from 'node:fs';
import vm from 'node:vm';
export const entry = new URL('../source/index.html', import.meta.url);
export const source = readFileSync(entry, 'utf8');
// DOM/rendering substitutes only. Tests execute the shipping simulation functions.
class Vector3 {
  constructor(x=0,y=0,z=0){this.set(x,y,z);}
  set(x,y,z){Object.assign(this,{x,y,z});return this;}
  copy(v){return this.set(v.x,v.y,v.z);}
  addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
}
function element(){const classes=new Set(),events={};return {value:'',style:{},textContent:'',innerHTML:'',events,addEventListener(k,fn){(events[k]??=[]).push(fn)},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k),toggle(k,b){b?classes.add(k):classes.delete(k)}},setPointerCapture(){},releasePointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:100})};}
export function harness({three,html=source}={}){
 const els=new Map(),events={};const select=s=>{if(!els.has(s))els.set(s,element());return els.get(s)};
 const context=vm.createContext({THREE:three||{Vector3,Quaternion:class{}},window:{},document:{querySelector:select,addEventListener(k,f){(events[k]??=[]).push(f)},hidden:false},navigator:{},performance:{now:()=>1000},setTimeout(){},clearTimeout(){},addEventListener(k,f){(events[k]??=[]).push(f)},console,innerWidth:1280,innerHeight:720});
 const start=html.indexOf('const $=');const end=html.lastIndexOf('initRenderer();createTrack();');
 vm.runInContext(html.slice(start,end),context);
 const run=code=>vm.runInContext(code,context);
 run(`buildCage=()=>({group:{position:new THREE.Vector3(),visible:true},ring:{visible:true},label:{visible:true}});scene={remove(){}};

 tone=noise=haptic=sfxHit=sfxFall=sfxLap=sfxFinish=spark=ringFX=hitFlash=impactFeedback=updateHUD=()=>{};
 soundOn=false;racerCountEl.value='4';lapSetting.value='3';difficultyEl.value='normal';
 trackSamples=Array.from({length:TRACK_SAMPLES},(_,i)=>{const a=i/TRACK_SAMPLES*Math.PI*2;return new THREE.Vector3(100*Math.sin(a),0,100*Math.cos(a))});
 trackTangents=trackSamples.map((_,i)=>{const a=i/TRACK_SAMPLES*Math.PI*2;return new THREE.Vector3(Math.cos(a),0,-Math.sin(a))});
 trackNormals=trackTangents.map(t=>new THREE.Vector3(-t.z,0,t.x));trackSampleSpacing=2*Math.PI*100/TRACK_SAMPLES;
 resetRace();
 function pose(r,index,lane=0){const i=(index+TRACK_SAMPLES)%TRACK_SAMPLES,p=lanePosition(i,lane);r.x=p.x;r.y=p.y;r.z=p.z;r.lastTrackIdx=r.trackIdx;r.trackIdx=i;r.offDist=Math.abs(lane);r.grounded=true;}
 function cross(r,cp){const i=cp===0?5:cp*80;pose(r,i-1);checkpointUpdate(r);pose(r,i+1);checkpointUpdate(r);}
 `);
 return {run,context,els,fire(k,e={}){for(const f of events[k]||[])f({preventDefault(){},...e})},click(s){for(const f of select(s).events.click||[])f({})}};
}
