import test from 'node:test';
import assert from 'node:assert/strict';
import { IMPORTED_ONLINE_ENGINES } from '../lib/arcade/online/imported';
import type {OnlineInput} from '../lib/arcade/online/types';
import {game as spaceBrowser} from './full-games/space-bash-harness.mjs';
import {runtime as twistedBrowser} from './full-games/twisted-harness.mjs';
import {harness as rollerBrowser} from './full-games/roller-harness.mjs';
import {runtime as scratchBrowser} from './full-games/scratch-harness.mjs';
import {game as ballBrowser} from './full-games/ballistix-harness.mjs';

const ids = Array.from({length:10}, (_,i)=>String(i).padStart(2,'0'));
const clone = <T,>(s:T):T => JSON.parse(JSON.stringify(s));
test('all five full imported simulations expose ten seats and persist deterministically', () => {
  assert.deepEqual(IMPORTED_ONLINE_ENGINES.map(e=>e.id), ['space-bash','twisted-system','roller-ruckus','scratch-match','sky-balls']);
  for (const e of IMPORTED_ONLINE_ENGINES) {
    let a=e.create(ids,17,{},ids.slice(1)), b=clone(a);
    for(let i=0;i<150;i++) {
      const inputs = {'00':{seq:i,x:.7,y:-.2,action:i===120?'jump':undefined}};
      a=e.step(a, inputs, ids.slice(1)); b=e.step(clone(b),inputs,ids.slice(1));
    }
    assert.deepEqual(a,b,e.id+' JSON continuation');
    assert.equal(Object.keys(e.publicState(a).scores).length,10,e.id+' scores cover every seat');
    const view=e.publicState(a).view as {fighters?:unknown[];racers?:unknown[];players?:unknown[];P?:unknown[]};
    assert.equal((view.fighters??view.racers??view.players??view.P)?.length,10,e.id+' actual roster');
  }
});
test('Scratch tenth-seat chord uses the real rhythm judgment and only consumes its sequence once', () => {
  const e=IMPORTED_ONLINE_ENGINES.find(e=>e.id==='scratch-match')!;
  const state=e.create(ids,123,{},[]) as {now:number;data:{phase:string;phaseClock:number;phraseIndex:number;notes:unknown[]}};
  state.data.phase='response';state.data.phaseClock=state.now;state.data.phraseIndex=0;
  state.data.notes=[{id:0,time:1/120,lanes:[0,3],callPlayed:false,responses:ids.map(()=>({hits:{$set:[]},errors:[],resolved:false}))}];
  const input={'09':{seq:1,x:0,y:0,laneMask:9} as OnlineInput};
  const hit=e.step(clone(state),input,[]),miss=e.step(clone(state),{},[]);
  assert.equal(e.publicState(hit).scores['09'],200,'native PERFECT awards both chord runes');
  assert.equal(e.publicState(miss).scores['09'],0);
  assert.equal(e.publicState(e.step(hit,input,[])).scores['09'],200,'same packet is not replayed');
});
test('full crate pickup references survive JSON and throw through native Space Bash physics', () => {
 const e=IMPORTED_ONLINE_ENGINES.find(e=>e.id==='space-bash')!;
 type Fighter={id:number;x:number;z:number;faceX:number;faceZ:number;carrying:number|null};
 type Crate={id:number;x:number;z:number;y:number;vx:number;vz:number;vy:number;r:number;alive:boolean;grounded:boolean;held:number|null;type:string;armed:boolean;fuse:number;warn:boolean};
 const state=e.create(ids,17,{},[]) as {data:{phase:string;fighters:Fighter[];crates:Crate[]}};
 state.data.phase='fight';const f=state.data.fighters[9];f.x=f.z=0;f.faceX=1;f.faceZ=0;
 state.data.crates=[{id:77,type:'normal',x:.3,z:0,y:.22,vx:0,vz:0,vy:0,r:.32,alive:true,grounded:true,held:null,armed:false,fuse:3,warn:false}];
 const pickup=e.step(state,{'09':{seq:1,x:0,y:0,action:'grab'}},[]) as typeof state;
 assert.equal(pickup.data.fighters[9].carrying,77);assert.equal(pickup.data.crates[0].held,9);
 const thrown=e.step(clone(pickup),{'09':{seq:2,x:0,y:0,action:'grab'}},[]) as typeof state;
 assert.equal(thrown.data.fighters[9].carrying,null);assert.equal(thrown.data.crates[0].held,null);
 assert.ok(thrown.data.crates[0].vx>5,'uses native throw impulse');assert.ok(thrown.data.crates[0].vy>1,'uses native ballistic lift');
});
test('full Twisted jump integrates native gravity and duck stays held independently of a tap', () => {
 const e=IMPORTED_ONLINE_ENGINES.find(e=>e.id==='twisted-system')!;
 const state=e.create(ids,8,{},[]) as {data:{phase:string;fighters:{jumpY:number;vy:number;duck:boolean}[]}};
 state.data.phase='fight';
 const jumped=e.step(state,{'09':{seq:1,x:0,y:0,action:'jump'}},[]) as typeof state;
 assert.ok(jumped.data.fighters[9].jumpY>.1);assert.ok(jumped.data.fighters[9].vy<5.15&&jumped.data.fighters[9].vy>4.6);
 const crouch=e.create(ids,8,{},[]) as typeof state;crouch.data.phase='fight';
 const ducked=e.step(crouch,{'09':{seq:1,x:0,y:0,heldActions:['duck']} as OnlineInput},[]) as typeof state;
 assert.equal(ducked.data.fighters[9].duck,true);
});
test('each imported adapter freezes its native terminal round for server-owned progression', () => {
 for(const e of IMPORTED_ONLINE_ENGINES){
  const s=e.create(ids,8,{},ids) as {data:Record<string,unknown>};
  if(e.id==='space-bash')s.data.phase='over';
  if(e.id==='twisted-system')s.data.phase='roundover';
  if(e.id==='roller-ruckus')s.data.finished=true;
  if(e.id==='scratch-match')s.data.phase='results';
  if(e.id==='sky-balls')(s.data.G as {phase:string}).phase='end';
  assert.equal(e.publicState(s).finished,true,e.id);
  let next:unknown=s;for(let i=0;i<120;i++)next=e.step(next,{},ids);
  assert.equal(e.publicState(next).finished,true,e.id+' does not advance its local cup');
 }
});
test('shipping browser bridges receive JSON snapshots and stop local animation simulation', async () => {
 const snapshot=(id:string)=>{const e=IMPORTED_ONLINE_ENGINES.find(e=>e.id===id)!;let state=e.create(ids,43,{},[]);for(let n=0;n<160;n++)state=e.step(state,{},[]);return clone(e.publicState(state));};
 const sb=spaceBrowser();(sb.sandbox as unknown as {CallbackOnlineView:{apply(s:unknown):void}}).CallbackOnlineView.apply(snapshot('space-bash'));
 const before=sb.fighters.map(f=>[f.x,f.z]);(sb.frames as ((t:number)=>void)[])[0](2000);assert.deepEqual(sb.fighters.map(f=>[f.x,f.z]),before);assert.equal(sb.fighters.length,10);
 const tb=twistedBrowser(10);tb.run(`window.CallbackOnlineView.apply(${JSON.stringify(snapshot('twisted-system'))});requestAnimationFrame=()=>{};renderer={render(){}};updateVisuals=updateCamera=updateHUD=()=>{}`);
 const time=tb.run('roundTime');tb.run('animate(1000)');assert.equal(tb.run('roundTime'),time);assert.equal(tb.run('fighters.length'),10);
 const three=await import(new URL('../public/arcade-games/royal-roller-ruckus/vendor/three/three.module.js',import.meta.url).href);
 const rb=rollerBrowser({three});rb.run(`textSprite=()=>({position:{},material:{dispose(){}},userData:{}});buildCage=()=>({group:{position:new THREE.Vector3(),remove(){},add(){}},ring:{},label:{material:{dispose(){}},userData:{}}});window.CallbackOnlineView.apply(${JSON.stringify(snapshot('roller-ruckus'))});requestAnimationFrame=()=>{};renderer={render(){}};updateVisuals=updateCamera=updateDynamicAudio=updateHUD=updateDebug=()=>{}`);
 const race=rb.run('raceTime');rb.run('animate(1000)');assert.equal(rb.run('raceTime'),race);assert.equal(rb.run('racers.length'),10);
 const sc=scratchBrowser();sc.run(`window.CallbackOnlineView.apply(${JSON.stringify(snapshot('scratch-match'))})`);const song=sc.run('songTime');sc.run('frame(101000)');assert.equal(sc.run('songTime'),song);assert.equal(sc.run('players.length'),10);
 const bb=ballBrowser(10);(bb.sandbox as unknown as {CallbackOnlineView:{apply(s:unknown):void}}).CallbackOnlineView.apply(snapshot('sky-balls'));const paddle=bb.P[9].pos;(bb as unknown as {loop(t:number):void}).loop(2000);assert.equal(bb.P[9].pos,paddle);
});
test('imported displays map sparse contestants to the correct phone names', async () => {
 const snapshot=(id:string)=>{const e=IMPORTED_ONLINE_ENGINES.find(e=>e.id===id)!;return {...clone(e.publicState(e.create(['02','07'],43,{},[]))),seatIds:['02','07'],players:[{id:'00',name:'Old seat'},{id:'02',name:'First phone'},{id:'07',name:'Second phone'}]};};
 const expected=['First phone','Second phone'];
 const sb=spaceBrowser();(sb.sandbox as unknown as {CallbackOnlineView:{apply(s:unknown):void}}).CallbackOnlineView.apply(snapshot('space-bash'));assert.deepEqual(sb.fighters.map(f=>f.name),expected);
 const tb=twistedBrowser(2);tb.run(`setFighterName=(f,name)=>{f.name=name};window.CallbackOnlineView.apply(${JSON.stringify(snapshot('twisted-system'))})`);assert.deepEqual(Array.from(tb.run('fighters.map(f=>f.name)') as string[]),expected);
 const three=await import(new URL('../public/arcade-games/royal-roller-ruckus/vendor/three/three.module.js',import.meta.url).href);
 const rb=rollerBrowser({three});rb.run(`textSprite=()=>({position:{},material:{dispose(){}},userData:{}});buildCage=()=>({group:{position:new THREE.Vector3(),remove(){},add(){}},ring:{},label:{material:{dispose(){}},userData:{}}});window.CallbackOnlineView.apply(${JSON.stringify(snapshot('roller-ruckus'))})`);assert.deepEqual(Array.from(rb.run('racers.map(r=>r.name)') as string[]),expected);
 const sc=scratchBrowser();sc.run(`window.CallbackOnlineView.apply(${JSON.stringify(snapshot('scratch-match'))})`);assert.deepEqual(Array.from(sc.run('players.map(p=>p.name)') as string[]),expected);
 const bb=ballBrowser(2);(bb.sandbox as unknown as {CallbackOnlineView:{apply(s:unknown):void}}).CallbackOnlineView.apply(snapshot('sky-balls'));assert.deepEqual(Array.from((bb.P as unknown as {name:string}[]).map(p=>p.name)),expected);
});
test('Roller extraction uses the genuine spline courses and native collision/movement integration', async () => {
 const three=await import(new URL('../public/arcade-games/royal-roller-ruckus/vendor/three/three.module.js',import.meta.url).href);
 const e=IMPORTED_ONLINE_ENGINES.find(e=>e.id==='roller-ruckus')!;
 for(const arena of ['crownway','clockwork','glacier']) {
  const browser=rollerBrowser({three});browser.run(`window.CallbackArcadeGame.start({...window.CallbackArcadeGame.defaults,arena:${JSON.stringify(arena)},players:10,laps:1},false);phase='race';cameraBasis=()=>({f:new THREE.Vector3(0,0,-1),right:new THREE.Vector3(1,0,0)});for(let i=0;i<10;i++){networkInputs[i]={connected:true,timestamp:1,moveX:.5,moveY:-.4,sequence:1};humanControl[i]=true;lastHumanPacket[i]=1}`);
  const initial=e.create(ids,1,{arena,laps:1},[]) as {data:{phase:string;racers:{x:number;y:number;z:number;vx:number;vz:number}[]}};initial.data.phase='race';
  const stepped=e.step(initial,Object.fromEntries(ids.map(id=>[id,{seq:1,x:.5,y:-.4}])),[]) as typeof initial;
  browser.run('for(let tick=0;tick<4;tick++)fixedUpdate(1/120)');
  const source=browser.run('racers.map(r=>[r.x,r.y,r.z,r.vx,r.vz])') as number[][];
  const extracted=stepped.data.racers.map(r=>[r.x,r.y,r.z,r.vx,r.vz]);
  for(let seat=0;seat<10;seat++)for(let value=0;value<5;value++)assert.ok(Math.abs(source[seat][value]-extracted[seat][value])<1e-10,arena+' native racer '+seat);
 }
});
test('movement and action inputs reach the tenth human seat in the original full simulations', () => {
  for(const id of ['space-bash','twisted-system','roller-ruckus','sky-balls']) {
    const e=IMPORTED_ONLINE_ENGINES.find(e=>e.id===id)!;
    let idle=e.create(ids,91,{},[]), moved=clone(idle);
    for(let tick=0;tick<150;tick++) {
      idle=e.step(idle,{},[]);
      moved=e.step(moved,{'09':{seq:tick,x:.8,y:-.4,action:id==='twisted-system'&&tick>=120?'duck':tick===120?'jump':undefined}},[]);
    }
    assert.notDeepEqual(e.publicState(moved).view,e.publicState(idle).view,id+' tenth player input changes physics');
  }
});
