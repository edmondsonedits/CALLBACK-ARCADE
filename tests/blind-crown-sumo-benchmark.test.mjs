import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../games/blind-crown/source/index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const context=vm.createContext({});
for(const marker of ['deterministic, authoritative match rules','Tactical learning and neutral gamepad']){
 const source=scripts.find(([, ,s])=>s.includes(marker));
 if(source)vm.runInContext(source[2],context);
}
const E=context.BlindCrown;
const T=context.CrownTactics;
const plain=x=>JSON.parse(JSON.stringify(x));
function match(){const g=new E.Match({bots:0,time:8},{seed:7});g.addPlayer('A');g.addPlayer('B');g.begin();Object.assign(g.players[0],{x:200,y:390,a:0});Object.assign(g.players[1],{x:800,y:390,a:Math.PI});return g;}
test('review refuses all incomplete phases and cannot record private plans',()=>{
 assert.ok(T,'tactical learning module');const g=match();
 for(const phase of ['lobby','planning','reveal','volley']){g.phase=phase;assert.equal(T.capture(g.state(1)),null);}
});
test('completed volley snapshot is detached; report preserves mutual hits without changing rules',()=>{
 assert.ok(T);const g=match();g.fire();for(let i=0;i<18;i++)g.update(.2);const state=g.state(1);const before=JSON.stringify(state);const record=T.capture(state);
 assert.equal(record.round,1);assert.equal(record.shots.length,2);
 assert.equal(T.outcome(record,1,0),'Your arrow is in flight.');
 assert.match(T.outcome(record,1,2),/Hit B.*Hit by A|Hit B.*Hit by B/);
 assert.equal(JSON.stringify(state),before);state.players[0].name='changed';assert.equal(record.players[0].name,'A');
});
test('bounded review history replaces duplicate round and clears at new match',()=>{
 assert.ok(T);const history=new T.History();const g=match();g.fire();g.phase='results';history.add(g.state(1));history.add(g.state(1));assert.equal(history.records.length,1);
 for(let round=2;round<=24;round++){g.round=round;history.add(g.state(1));}assert.equal(history.records.length,24);history.clear();assert.equal(history.records.length,0);
});
test('standings includes every contestant, champions first, living before eliminated, stable equal points',()=>{
 assert.ok(T);const s={players:[{id:1,points:900,alive:false},{id:2,points:10,alive:true},{id:3,points:10,alive:true}],winners:[3]};
 assert.deepEqual(plain(T.standings(s)).map(p=>p.id),[3,2,1]);assert.deepEqual(s.players.map(p=>p.id),[1,2,3]);
 assert.match(T.reason({...s,round:4}),/Last survivor|round limit/i);
});
test('validated preferences bound volume and reject malformed flags',()=>{
 assert.ok(T);assert.deepEqual(plain(T.accessPrefs({volume:'oops',highContrast:'false',reducedMotion:'yes'},true)),{volume:.7,highContrast:false,reducedMotion:true});
 assert.equal(T.accessPrefs({volume:500},false).volume,1);assert.equal(T.accessPrefs({volume:-1},false).volume,0);
});
test('gamepad requires neutral after reset, emits lock edge once, gates pause and disconnects cleanly',()=>{
 assert.ok(context.CrownPad);const pad=new context.CrownPad();const input=(pressed=false,axis=0)=>({connected:true,axes:[axis,0,0,0],buttons:Array.from({length:16},(_,i)=>({pressed:pressed&&i===0}))});
 assert.equal(pad.poll(input(true,1),true).lock,false);pad.poll(input(),true);assert.equal(pad.poll(input(true),true).lock,true);assert.equal(pad.poll(input(true),true).lock,false);
 pad.reset();assert.equal(pad.poll(input(true),true).lock,false);pad.poll(input(),false);assert.equal(pad.poll(input(true),false).lock,false);assert.equal(pad.poll(null,true).x,0);
});
test('embedded classic scripts compile',()=>{for(const [,attrs,code]of scripts)if(!/type\s*=\s*["'](?:module|importmap)/i.test(attrs))new vm.Script(code);});
function appHarness(){
 const nodes=new Map(),listeners=new Map();let frame,now=0,pad=null;
 const ctx=new Proxy({measureText:()=>({width:40}),createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]||(()=>{})});
 class Node{constructor(tag='DIV'){this.tagName=tag.toUpperCase();this.value='';this.children=[];this.options=[];this.dataset={};this.style={};this.listeners={};this.classList={toggle(){},add(){},remove(){}};this.width=1000;this.height=640;this.open=false;this.hidden=false;this.textContent='';this.checked=false;}
 addEventListener(k,f){(this.listeners[k]??=[]).push(f);}emit(k,e={}){for(const f of this.listeners[k]||[])f(e);}setAttribute(){}append(...n){this.children.push(...n);}getContext(){return ctx;}getBoundingClientRect(){return {left:0,top:0,width:1000,height:640};}focus(){}showModal(){this.open=true;}close(){if(this.open){this.open=false;this.emit('close');}}setPointerCapture(){}hasPointerCapture(){return false;}releasePointerCapture(){}
 set innerHTML(v){this._html=v;if(this.tagName==='SELECT'){this.options=[...v.matchAll(/value="([^"]+)"/g)].map(m=>({value:m[1]}));this.value=this.options[0]?.value||'';}}get innerHTML(){return this._html||'';}}
 for(const m of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const n=new Node(m[1]);n.value=m[0].match(/\bvalue="([^"]*)"/)?.[1]||'';nodes.set(m[2],n);}
 for(const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const n=nodes.get(m[1]);n.options=[...m[2].matchAll(/<option value="([^"]+)"([^>]*)>/g)].map(q=>({value:q[1],selected:q[2].includes('selected')}));n.value=(n.options.find(q=>q.selected)||n.options[0])?.value||'';}
 const doc={hidden:false,body:new Node(),getElementById:id=>nodes.get(id),createElement:tag=>new Node(tag),querySelector:()=>[...nodes.values()].find(n=>n.open)||null,addEventListener:(k,f)=>{(listeners.get(k)||listeners.set(k,[]).get(k)).push(f);}};
 const c=vm.createContext({document:doc,navigator:{getGamepads:()=>[pad]},location:{search:'',protocol:'file:',href:'file:///test'},localStorage:{getItem:()=>null,setItem(){}},performance:{now:()=>now},matchMedia:()=>({matches:false}),URLSearchParams,URL,Event:class{},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:f=>{frame=f;}});c.window=c;c.addEventListener=()=>{};
 for(const marker of ['deterministic, authoritative match rules','Tactical learning and neutral gamepad','root.CrownInput ='])vm.runInContext(scripts.find(([, ,s])=>s.includes(marker))[2],c);
 c.CrownPerspective={VIEWS:['overhead','isometric','first','third']};c.CrownArt={portraitSvg:()=>'<svg></svg>',environment(){},materials(){}};c.CrownArena={create:()=>({clear(){},render(){},getStats:()=>({})})};c.CrownRoomClient=class{constructor(){}action(){}disconnect(){}};
 vm.runInContext(scripts.find(([, ,s])=>s.includes('Application coordinator.'))[2],c);
 return {nodes,c,advance:n=>{for(let i=0;i<n;i++){now+=80;frame(now);}},key:(key)=>{for(const f of listeners.get('keydown')||[])f({key,target:{tagName:'CANVAS'},repeat:false,preventDefault(){}});},setPad:p=>{pad=p;}};
}
test('real coordinator gates local review, preserves clock, scrubs detached snapshot and clears rematch history',()=>{
 const h=appHarness(),n=h.nodes;assert.equal(h.c.BlindCrownDebug.getState().phase,'lobby');n.get('overlayStart').onclick();h.advance(20);const before=h.c.BlindCrownDebug.getState();
 h.key(' ');assert.equal(h.c.BlindCrownDebug.getState().players[0].locked,true);h.key(' ');assert.equal(h.c.BlindCrownDebug.getState().players[0].locked,false);
 n.get('settingsBtn').onclick();h.advance(20);assert.equal(h.c.BlindCrownDebug.getState().clock,before.clock);n.get('settingsClose').onclick();h.advance(240);assert.equal(n.get('reviewBtn').hidden,false);
 n.get('reviewBtn').onclick();const state=h.c.BlindCrownDebug.getState();assert.equal(n.get('reviewDialog').open,true);assert.ok(n.get('reviewRound').options.every(o=>/^\d+$/.test(o.value)));assert.ok(n.get('reviewRound').options.length>0);h.advance(30);assert.deepEqual(plain(h.c.BlindCrownDebug.getState()),plain(state));
 n.get('reviewScrub').value='0';n.get('reviewScrub').oninput();assert.match(n.get('reviewRows').innerHTML,/Arrow in flight/);n.get('reviewClose').onclick();n.get('overlayStart').onclick();assert.equal(n.get('reviewBtn').hidden,true);assert.equal(h.c.BlindCrownDebug.getState().round,1);
 n.get('menuBtn').onclick();assert.equal(h.c.BlindCrownDebug.getState().phase,'lobby');assert.equal(n.get('settingsDialog').open,true);
});
test('every map and ruleset review uses actual cover-boundary outcomes without adding aim help',()=>{
 for(const arena of Object.keys(E.MAPS))for(const ruleset of ['classic','precision']){
  const g=new E.Match({arena,ruleset,bots:0},{seed:123});g.addPlayer('One');g.addPlayer('Two');g.begin();g.fire();g.phase='results';const r=T.capture(g.state(1));
  assert.equal(r.settings.arena,arena);assert.equal(r.settings.ruleset,ruleset);assert.equal(r.shots.length,2);assert.equal(T.outcome({...g.state(1),phase:'planning'},1),'');
  for(const shot of r.shots)assert.ok(T.shotLabel(r,shot).length);
 }
});
test('coordinator gamepad locks/unlocks once per press, pause gates movement and resume rejects held sticks',()=>{
 const h=appHarness(),n=h.nodes;n.get('overlayStart').onclick();
 const pad=(a=false,start=false,x=0)=>({mapping:'standard',connected:true,axes:[x,0,0,0],buttons:Array.from({length:16},(_,i)=>({pressed:i===0?a:i===9?start:false}))});
 h.setPad(pad());h.advance(1);h.setPad(pad(true));h.advance(1);assert.equal(h.c.BlindCrownDebug.getState().players[0].locked,true);h.advance(2);assert.equal(h.c.BlindCrownDebug.getState().players[0].locked,true);
 h.setPad(pad());h.advance(1);h.setPad(pad(true));h.advance(1);assert.equal(h.c.BlindCrownDebug.getState().players[0].locked,false);
 h.setPad(pad());h.advance(1);h.setPad(pad(false,true));h.advance(1);const before=h.c.BlindCrownDebug.getState();h.setPad(pad(false,false,1));h.advance(20);assert.deepEqual(plain(h.c.BlindCrownDebug.getState()),plain(before));
 n.get('pauseBtn').onclick();h.advance(1);assert.equal(h.c.BlindCrownDebug.getState().players[0].x,before.players[0].x);h.setPad(pad());h.advance(1);h.setPad(pad(false,false,.5));h.advance(1);assert.notEqual(h.c.BlindCrownDebug.getState().players[0].x,before.players[0].x);
});
