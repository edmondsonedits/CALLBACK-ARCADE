import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {SNOW_GAME} from '../lib/arcade/upgrades/snow-bash';
class Element {
 open=false;hidden=false;className='';width=600;height=500;clientWidth=600;clientHeight=500;textContent='';style:Record<string,string>={};dataset:Record<string,string>={};children:Element[]=[];parts=new Map<string,Element>();onclick?:()=>void;
 append(...els:Element[]){this.children.push(...els)}replaceChildren(...els:Element[]){this.children=els}querySelector(s:string){if(!this.parts.has(s))this.parts.set(s,new Element());return this.parts.get(s)!}setAttribute(){}setPointerCapture(){}listeners=new Map<string,(e:unknown)=>void>();addEventListener(n:string,f:(e:unknown)=>void){this.listeners.set(n,f)}fire(n:string,e:unknown){this.listeners.get(n)?.(e)}showModal(){this.open=true}close(){this.open=false}getBoundingClientRect(){return{left:0,top:0,width:100,height:100}}getContext(){return new Proxy({},{get:()=>()=>{},set:()=>true})}
}
async function runtime(spec:unknown=SNOW_GAME){const doc=new Element(),events=new Map<string,(e:unknown)=>void>(),window={CallbackOnlineView:null as unknown as {apply(s:unknown):void},CallbackArcadeGame:null as unknown as {start(o:unknown,watch:boolean):void;pause(on:boolean):void;state():{phase:string;frame:{tick:number;actors:unknown[]};wins:Record<string,number>}},addEventListener(n:string,f:(e:unknown)=>void){events.set(n,f)}};let raf:(t:number)=>void=()=>{},time=0,active=true;const vibrations:number[]=[];const gains:{value:number;setTargetAtTime(v:number):void;setValueAtTime(v:number):void;exponentialRampToValueAtTime(v:number):void}[]=[];class AudioContext{state="running";currentTime=0;destination={};createGain(){const gain={value:0,setTargetAtTime(v:number){this.value=v},setValueAtTime(v:number){this.value=v},exponentialRampToValueAtTime(v:number){this.value=v}};gains.push(gain);return{gain,connect(){return this}}}createOscillator(){return{type:"",frequency:{value:0},connect(){return this},start(){},stop(){}}}resume(){}close(){}};(window as unknown as Record<string,unknown>).AudioContext=AudioContext;
 const src=readFileSync(new URL('../public/arcade-games/shared/arena-runtime.js',import.meta.url),'utf8').replace(/^import \* as THREE .*;$/m,'').replace('export async function mountArena','async function mountArena');
 const context=vm.createContext({window,document:{querySelector:(s:string)=>doc.querySelector(s),createElement:()=>new Element(),body:{dataset:{arcadeView:'watch'}},hidden:false,addEventListener(n:string,f:(e:unknown)=>void){events.set("document:"+n,f)}},THREE:{WebGLRenderer:class{constructor(){throw Error('Canvas contract harness')}}},matchMedia:()=>({matches:true}),navigator:{vibrate(n:number){vibrations.push(n)}},performance:{now:()=>time},requestAnimationFrame:(f:(t:number)=>void)=>{raf=f;active=true;return 1},cancelAnimationFrame(){active=false},innerWidth:600,innerHeight:500,devicePixelRatio:1,console});
 vm.runInContext(src,context);context.spec=spec;await vm.runInContext('mountArena(spec)',context);
 return{game:window.CallbackArcadeGame,online:window.CallbackOnlineView,doc,gains,vibrations,fire(name:string,e:unknown){events.get(name)?.(e)},advance(seconds:number){for(let n=0;n<seconds*60;n++){time+=1000/60;if(active)raf(time)}}};
}
test('shipping arena lifecycle starts real ten-bot gameplay and pause clears elapsed catch-up',async()=>{
 const h=await runtime();h.game.start({...SNOW_GAME.defaults,players:10},true);h.advance(4);assert.equal(h.game.state().frame.actors.length,10);assert.ok(h.game.state().frame.tick>0);const tick=h.game.state().frame.tick;h.game.pause(true);h.advance(5);assert.equal(h.game.state().frame.tick,tick);h.game.pause(false);h.advance(.1);assert.ok(h.game.state().frame.tick<=tick+4);
});
test('shipping player result button resets a completed one-crown cup',async()=>{
 const h=await runtime();h.game.start({...SNOW_GAME.defaults,players:2,crowns:1,duration:30},false);h.advance(34);assert.equal(h.game.state().phase,'result');assert.equal(h.doc.querySelector('.arena-result').open,true);h.doc.querySelector('.arena-result').querySelector('.next').onclick!();assert.equal(h.game.state().phase,'countdown');assert.equal(h.doc.querySelector('.arena-result').open,false);
});

test('persisted pagehide and pageshow preserve a recoverable running arena',async()=>{
 const h=await runtime();h.game.start({...SNOW_GAME.defaults,players:10},true);h.advance(4);const tick=h.game.state().frame.tick;h.fire('pagehide',{persisted:true});h.advance(1);assert.equal(h.game.state().frame.tick,tick);h.fire('pageshow',{persisted:true});h.advance(.2);assert.ok(h.game.state().frame.tick>tick);
});
test('starting after a paused menu restores initialized master audio gain',async()=>{
 const h=await runtime();h.fire('document:pointerdown',{});h.game.start({...SNOW_GAME.defaults,sound:true},false);assert.equal(h.gains[0]!.value,.12);h.game.pause(true);assert.equal(h.gains[0]!.value,0);h.game.start({...SNOW_GAME.defaults,sound:true},false);assert.equal(h.gains[0]!.value,.12);
});
test('a first-to-seven cup keeps going when twenty-five rounds produce no clinching entrant',async()=>{
 let leg=0;const fast={...SNOW_GAME,create(ids:string[]){return{ids,tick:0,winner:ids[leg++%ids.length]}},step(s:{ids:string[];tick:number;winner:string}){return{...s,tick:1}},bot(){return{sequence:1,x:0,y:0,action:'none'}},frame(s:{ids:string[];tick:number;winner:string}){return{tick:s.tick,finished:s.tick>0,winners:s.tick?[s.winner]:[],actors:s.ids.map((id,i)=>({id,x:i-5,y:0,alive:true,health:3,maxHealth:3})),objects:[],radius:10,theme:{sky:0,floor:0,rim:0},status:'Test',skill:'Test'}}};
 const h=await runtime(fast);h.game.start({...SNOW_GAME.defaults,players:10,crowns:7},true);h.advance(160);const s=h.game.state() as ReturnType<typeof h.game.state>&{round:number};assert.ok(s.round>25);assert.ok(Math.max(...Object.values(s.wins))<7);
});

test('score gains and eliminations trigger optional feedback even in the Canvas fallback',async()=>{
 for(const event of ['score','elimination']){const controlled={...SNOW_GAME,create(ids:string[]){return{ids,tick:0}},step(s:{ids:string[];tick:number}){return{...s,tick:1}},bot(){return{sequence:1,x:0,y:0}},frame(s:{ids:string[];tick:number}){return{tick:s.tick,finished:false,winners:[],actors:s.ids.map(id=>({id,x:0,y:0,alive:event==='score'||s.tick===0,health:1,maxHealth:1,score:event==='score'?s.tick:0})),objects:[],radius:10,theme:{sky:0,floor:0,rim:0},status:'Test',skill:'Test'}}};const h=await runtime(controlled);h.fire('document:pointerdown',{});h.game.start({...SNOW_GAME.defaults,players:2,haptics:true},false);h.advance(4);assert.ok(h.vibrations.length>0,event);assert.ok(h.vibrations.length<=2,'feedback happens on state changes, not every frame');}
});

test('online arena renderer displays ten authoritative seats without advancing the simulation',async()=>{
 const h=await runtime(),ids=Array.from({length:10},(_,i)=>String(i).padStart(2,'0'));
 const state=SNOW_GAME.create(ids,912,SNOW_GAME.defaults),frame=SNOW_GAME.frame(state);
 h.online.apply({view:{kind:'arena',frame,options:SNOW_GAME.defaults},players:[{id:'09',name:'Phone Ten'}],round:4,wins:{'09':2},paused:false});
 h.advance(8);assert.equal(h.game.state().frame.tick,frame.tick);assert.equal(h.game.state().frame.actors.length,10);assert.equal(h.doc.querySelector('.arena-result').open,false);
 assert.ok(h.doc.querySelector('.arena-scoreboard').children.some(e=>e.textContent.includes('Phone Ten')));assert.equal(h.game.state().wins['09'],2);
});

test('releasing the movement thumb does not discard the other thumb queued action',async()=>{
 const actions:string[]=[];const game={...SNOW_GAME,step(s:Parameters<typeof SNOW_GAME.step>[0],inputs:Parameters<typeof SNOW_GAME.step>[1]){actions.push(inputs['00']?.action??'none');return SNOW_GAME.step(s,inputs)}};
 const h=await runtime(game);h.game.start({...SNOW_GAME.defaults,players:2},false);h.advance(3.2);actions.length=0;
 const stick=h.doc.querySelector('.arena-stick'),action=h.doc.querySelector('.arena-actions').children[0]!;const e=(pointerId:number)=>({pointerId,clientX:90,clientY:50,currentTarget:stick,preventDefault(){}});
 stick.fire('pointerdown',e(1));action.fire('pointerdown',e(2));stick.fire('lostpointercapture',e(1));h.advance(.1);assert.ok(actions.includes(action.dataset.action!));
});
