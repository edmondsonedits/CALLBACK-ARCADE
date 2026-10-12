import { readFileSync } from 'node:fs';
import vm from 'node:vm';
export const source = readFileSync(new URL('../source/index.html', import.meta.url), 'utf8');
export function game(seed = 12345) {
  const elements = new Map(), listeners = {}, intervals = [], frames = [], sounds = [];
  const noop = () => {};
  const context = new Proxy({}, {get: (o,k) => o[k] ?? noop, set: (o,k,v) => (o[k]=v,true)});
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const classes = new Set(), events = {};
    const e = {style:{},dataset:{},textContent:'',value:'',events,
      classList:{add:(...a)=>a.forEach(x=>classes.add(x)),remove:(...a)=>a.forEach(x=>classes.delete(x)),contains:x=>classes.has(x),toggle:noop},
      appendChild:noop,setAttribute:noop,setPointerCapture:noop,releasePointerCapture:noop,
      getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),getContext:()=>context,
      addEventListener:(k,fn)=>(events[k]??=[]).push(fn)};
    elements.set(id,e);return e;
  }
  const math=Object.create(Math);math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const sandbox={Math:math,console,performance:{now:()=>1000},innerWidth:390,innerHeight:844,devicePixelRatio:1,
    navigator:{vibrate:noop},localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},
    document:{querySelector:element,querySelectorAll:()=>[],getElementById:id=>element('#'+id),createElement:element,
      body:element('body'),head:element('head'),addEventListener:(k,fn)=>(listeners[k]??=[]).push(fn)},
    addEventListener:(k,fn)=>(listeners[k]??=[]).push(fn),
    setTimeout:noop,clearTimeout:noop,setInterval:fn=>intervals.push(fn),requestAnimationFrame:fn=>frames.push(fn)};
  sandbox.window=sandbox;
  const exports=`window.testGame={get fighters(){return fighters},set fighters(v){fighters=v},get crates(){return crates},set crates(v){crates=v},get tiles(){return tiles},get particles(){return particles},get wins(){return wins},get phase(){return phase},set phase(v){phase=v},get phaseT(){return phaseT},set phaseT(v){phaseT=v},get timeLeft(){return timeLeft},set timeLeft(v){timeLeft=v},get paused(){return paused},set paused(v){paused=v},get flash(){return flash},set flash(v){flash=v},get round(){return round},joy,step,makeFighter,grabThrow,kick,jump,drop,eliminate,explode,damage,destroyTile,nearCrate,ai,drive,updateCrates,collide,finishRound,checkRound,resetRound,restartMatch,openSettingsPaused,closeSettingsToPause,resumeFromPause,drawCrate,drawFighter,render,resize,get board(){return board},setAudioContext(ctx){beep.ctx=ctx}};`;
  const script=source.match(/<script>([\s\S]*?)<\/script>/)[1].replace('resetRound();updateHUD();requestAnimationFrame(loop);',exports+'resetRound();updateHUD();requestAnimationFrame(loop);');
  vm.runInNewContext(script,sandbox);
  if(!sandbox.testGame)throw new Error(element('#errorText').textContent);
  const g=sandbox.testGame;g.phase='fight';
  return Object.assign(g,{sandbox,elements,frames,element,fire:(type,data={})=>(listeners[type]||[]).forEach(fn=>fn({preventDefault:noop,...data})),
    pointer:(id,type,data={})=>(element(id).events[type]||[]).forEach(fn=>fn({pointerId:1,clientX:80,clientY:50,preventDefault:noop,currentTarget:element(id),...data})),
    poll:()=>intervals.forEach(fn=>fn()),advance:(seconds)=>{for(let i=0;i<Math.ceil(seconds*120);i++)g.step(1/120)}});
}
export function crate(overrides={}) {return {id:1,type:'normal',x:0,z:0,y:.22,vx:0,vz:0,vy:0,r:.32,alive:true,grounded:true,held:null,armed:false,fuse:3,warn:false,...overrides};}
export function arena(n=2) {const g=game();g.sandbox.SpaceBash.setPlayers(n);g.phase='fight';g.crates=[];g.fighters.forEach((f,i)=>{f.x=i?2:0;f.z=i?2:0;f.faceX=1;f.faceZ=0;f.think=100;});return g;}
