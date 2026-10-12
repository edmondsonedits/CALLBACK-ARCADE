import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../games/blind-crown/source/index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const c=vm.createContext({});
for(const marker of ['deterministic, authoritative match rules','Tactical learning and neutral gamepad'])vm.runInContext(scripts.find(([, ,s])=>s.includes(marker))[2],c);
const E=c.BlindCrown,T=c.CrownTactics,plain=x=>JSON.parse(JSON.stringify(x));
function match(arena='citadel',count=2,seed=91){const g=new E.Match({arena,bots:count-1,time:8,roundLimit:4},{seed});g.addPlayer('Human');g.addBots(count-1);g.begin();return g;}
test('four tactical worlds: absorbing corners, permeable hedges, reflective ice and announced shutters',()=>{
 assert.equal(Object.keys(E.MAPS).length,4);
 for(const [map,material]of [['citadel','stone'],['orchard','hedge'],['glacier','ice'],['clockwork','shutter']])assert.ok(E.roundGeometry(1,map,'tactical').walls.some(w=>w.material===material));
 const hedge=E.traceShot({id:1,x:420,y:320,a:0},[{id:2,x:580,y:320,alive:true}],1,'orchard','tactical');assert.equal(hedge.hit,2);
 assert.equal(E.canPlace({x:500,y:320},1,'orchard','tactical'),false);
 const stone=E.traceShot({id:1,x:420,y:320,a:0},[],1,'citadel','tactical');assert.equal(stone.material,'stone');
 const odd=E.roundGeometry(1,'clockwork','tactical'),even=E.roundGeometry(2,'clockwork','tactical');assert.notDeepEqual(plain(odd.walls),plain(even.walls));assert.match(odd.forecast,/next|round/i);
});
test('bounded ice bank resolves actual segments, endpoint and finish time with no phantom straight lane',()=>{
 const p={id:1,x:420,y:320,a:0},target={id:2,x:360,y:320,alive:true};const s=E.traceShot(p,[target],1,'glacier','tactical');
 assert.equal(s.hit,2);assert.equal(s.segments.length,2);assert.equal(s.bounces,1);assert.ok(s.dist<1400);assert.ok(s.finish<=1.7);
 const bend=E.shotPoint(s,s.segments[0].dist+1);assert.ok(bend.dx<0);
 const end=E.shotPoint(s,s.dist);assert.ok(end.x<target.x+20);assert.ok(Math.abs(end.y-320)<1e-6);
 assert.deepEqual(plain(E.shotPoint(s,1e9)),plain(end));
});
test('clockwork open forecast lane changes collision only between rounds; locked plans freeze',()=>{
 const g=match('clockwork');const before=plain(g.state(1).geometry);g.lock(1,true);g.fire();assert.deepEqual(plain(g.state(1).geometry),before);assert.equal(g.position(1,200,200,0),false);assert.equal(g.lock(1,false),false);
 const a=E.traceShot({id:1,x:350,y:220,a:0},[],1,'clockwork','tactical'),b=E.traceShot({id:1,x:350,y:220,a:0},[],2,'clockwork','tactical');assert.notEqual(a.dist,b.dist);
});
test('every arena has legal two/ten seat spawn and swept movement throughout all shrinking rounds',()=>{
 for(const map of Object.keys(E.MAPS))for(const seats of[2,10]){const g=match(map,seats);for(let r=1;r<=24;r++){g.round=r-1;g.advance();for(const p of g.players){assert.ok(E.canPlace(p,r,map,'tactical'),`${map}/${seats}/${r}`);assert.ok(E.canPlace(E.movePosition(p,1500,-1500,r,map,'tactical'),r,map,'tactical'));}}}
});
test('new geometry public fields carry no private plans; Classic and Precision preserve simultaneous mutual hits',()=>{
 for(const map of Object.keys(E.MAPS))for(const ruleset of['classic','precision']){const g=match(map);g.settings.ruleset=ruleset;const s=g.state(null,true);assert.equal(s.shots.length,0);assert.ok(s.players.every(p=>!('x'in p)&&!('a'in p)));assert.ok(!JSON.stringify(s.geometry).includes('players'));
 Object.assign(g.players[0],{x:200,y:370,a:0});Object.assign(g.players[1],{x:800,y:370,a:Math.PI});g.fire();assert.deepEqual(plain(g.shots.map(q=>q.hit)),[2,1]);}
});
test('completed geometry and bounced segments are immutable and retained after map/round changes',()=>{
 const g=match('glacier');Object.assign(g.players[0],{x:420,y:320,a:0});g.fire();g.phase='results';const h=new T.History();h.add(g.state(1));const r=h.records[0],before=JSON.stringify(r);assert.ok(Object.isFrozen(r.geometry));g.settings.arena='clockwork';g.advance();assert.equal(JSON.stringify(r),before);assert.equal(r.shots[0].segments.length,2);
 for(let i=2;i<=30;i++){h.add({...r,round:i,phase:'results'});}assert.equal(h.records.length,24);assert.equal(T.capture(g.state(1)),null);
});
test('natural all-bot games finish on every tactical arena and preserve replay seeds',()=>{
 for(const arena of Object.keys(E.MAPS)){const play=()=>{const g=new E.Match({arena,time:8,roundLimit:4},{seed:121});g.addBots(10);g.begin();for(let i=0;i<650&&g.phase!=='final';i++)g.update(.2);assert.equal(g.phase,'final');return JSON.stringify(g.state());};assert.equal(play(),play());}
});
test('finite Tour accepts only natural final states and captures exact replay rules/seed',()=>{
 const tour=new T.Tour({time:8,bots:1,roundLimit:24,ruleset:'precision'},99);assert.equal(tour.stage().settings.roundLimit,4);
 for(let i=0;i<4;i++){const stage=tour.stage();assert.equal(stage.settings.arena,Object.keys(E.MAPS)[i]);const g=new E.Match(stage.settings,{seed:stage.seed});g.addBots(2);g.begin();assert.equal(tour.complete(g.state()),false);for(let n=0;n<650&&g.phase!=='final';n++)g.update(.2);assert.equal(tour.complete(g.state()),true);const replay=tour.stage();assert.equal(replay.seed,stage.seed);assert.deepEqual(plain(replay.settings),plain(stage.settings));if(i<3)assert.equal(tour.next(),true);}
 assert.equal(tour.next(),false);assert.equal(tour.summary().completed,4);assert.equal(tour.summary().standings.length,2);
});

function appHarness({corrupt=false,denied=false}={}){
 const nodes=new Map(),listeners=new Map();let frame,now=0,pad=null,audioGraphs=0;
 const ctx=new Proxy({measureText:()=>({width:40}),createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]||(()=>{})});
 class Node{constructor(tag='DIV'){this.tagName=tag.toUpperCase();this.value='';this.children=[];this.options=[];this.dataset={};this.style={};this.listeners={};this.classList={toggle(){},add(){},remove(){}};this.width=1000;this.height=640;this.open=false;this.hidden=false;this.textContent='';this.checked=false;}
 addEventListener(k,f){(this.listeners[k]??=[]).push(f);}emit(k,e={}){for(const f of this.listeners[k]||[])f(e);}setAttribute(){}append(...n){this.children.push(...n);}getContext(){return ctx;}getBoundingClientRect(){return {left:0,top:0,width:1000,height:640};}focus(){}showModal(){this.open=true;}close(){if(this.open){this.open=false;this.emit('close');}}setPointerCapture(){}hasPointerCapture(){return false;}releasePointerCapture(){}
 set innerHTML(v){this._html=v;if(this.tagName==='SELECT'){this.options=[...v.matchAll(/value="([^"]+)"/g)].map(m=>({value:m[1]}));this.value=this.options[0]?.value||'';}}get innerHTML(){return this._html||'';}}
 for(const m of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const n=new Node(m[1]);n.value=m[0].match(/\bvalue="([^"]*)"/)?.[1]||'';nodes.set(m[2],n);}
 for(const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const n=nodes.get(m[1]);n.options=[...m[2].matchAll(/<option value="([^"]+)"([^>]*)>/g)].map(q=>({value:q[1],selected:q[2].includes('selected')}));n.value=(n.options.find(q=>q.selected)||n.options[0])?.value||'';}
 const doc={hidden:false,body:new Node(),getElementById:id=>nodes.get(id),createElement:tag=>new Node(tag),querySelector:()=>[...nodes.values()].find(n=>n.open)||null,addEventListener:(k,f)=>{(listeners.get(k)||listeners.set(k,[]).get(k)).push(f);}};
 const c=vm.createContext({document:doc,navigator:{getGamepads:()=>[pad]},location:{search:'',protocol:'file:',href:'file:///test'},localStorage:{getItem:()=>{if(denied)throw Error('denied');return corrupt?'{bad':null;},setItem(){if(denied)throw Error('denied');}},performance:{now:()=>now},matchMedia:()=>({matches:false}),URLSearchParams,URL,Event:class{},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:f=>{frame=f;}});c.window=c;c.addEventListener=()=>{};c.AudioContext=class{constructor(){audioGraphs++;this.currentTime=0;this.destination={};}resume(){}createOscillator(){return {frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(){},stop(){}};}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
 for(const marker of ['deterministic, authoritative match rules','Tactical learning and neutral gamepad','root.CrownInput ='])vm.runInContext(scripts.find(([, ,s])=>s.includes(marker))[2],c);
 c.CrownPerspective={VIEWS:['overhead','isometric','first','third']};c.CrownArt={portraitSvg:()=>'<svg></svg>',environment(){},materials(){}};c.CrownArena={create:()=>({clear(){},render(){},getStats:()=>({})})};c.CrownRoomClient=class{constructor(){}action(){}disconnect(){}};
 vm.runInContext(scripts.find(([, ,s])=>s.includes('Application coordinator.'))[2],c);
 return {nodes,c,audioGraphs:()=>audioGraphs,advance:n=>{for(let i=0;i<n;i++){now+=80;frame(now);}},key:(key)=>{for(const f of listeners.get('keydown')||[])f({key,target:{tagName:'CANVAS'},repeat:false,preventDefault(){}});},setPad:p=>{pad=p;}};
}

test('native title Watch/Start/menu isolate demo, records, seed and sounded audio',()=>{
 const h=appHarness(),n=h.nodes,d=h.c.BlindCrownDebug;assert.equal(d.getState().phase,'lobby');assert.equal(h.audioGraphs(),0);const initial=d.getSession();h.advance(80);assert.ok(d.getSession().demoElapsed>initial.demoElapsed);assert.equal(d.getState().phase,'lobby');assert.equal(d.getSession().historyRounds,0);
 n.get('watchDemo').onclick();assert.equal(d.getSession().watching,true);n.get('returnDemo').onclick();assert.equal(d.getSession().watching,false);
 n.get('seedInput').value='  123  ';n.get('seedInput').onblur();assert.equal(n.get('seedInput').value,'123');n.get('timeSelect').value='8';n.get('roundLimit').value='4';n.get('soundBtn').onclick();n.get('overlayStart').onclick();assert.equal(d.getSession().captured,null);assert.equal(d.getState().phase,'planning');assert.ok(h.audioGraphs()>0);h.advance(900);assert.equal(d.getState().phase,'final');assert.equal(d.getSession().captured.seed,123);const count=h.audioGraphs();n.get('menuBtn').onclick();n.get('settingsClose').onclick();h.advance(250);assert.equal(d.getState().phase,'lobby');assert.equal(h.audioGraphs(),count);assert.equal(d.getSession().historyRounds,0);
});
test('native fields retain empty/spaced editing; rules stage, styles apply; denied/corrupt storage plays',()=>{
 for(const options of [{corrupt:true},{denied:true}]){const h=appHarness(options),n=h.nodes,d=h.c.BlindCrownDebug;n.get('overlayStart').onclick();n.get('settingsBtn').onclick();const before=d.getState();n.get('nameInput').value='';n.get('nameInput').oninput();assert.equal(n.get('nameInput').value,'');n.get('nameInput').value='  New   Knight  ';n.get('nameInput').oninput();assert.equal(n.get('nameInput').value,'  New   Knight  ');n.get('nameInput').onblur();assert.equal(n.get('nameInput').value,'New Knight');assert.equal(d.getState().players[0].name,'New Knight');n.get('crestSelect').value='star';n.get('crestSelect').onchange();assert.equal(d.getState().players[0].crest,'star');n.get('arenaSelect').value='clockwork';n.get('arenaSelect').onchange();h.advance(20);assert.equal(d.getState().settings.arena,before.settings.arena);assert.equal(d.getState().clock,before.clock);n.get('startBtn').onclick();assert.equal(d.getState().settings.arena,'clockwork');}
});
test('native Tour naturally completes, advances and replays captured rules despite changed menu',()=>{
 const h=appHarness(),n=h.nodes,d=h.c.BlindCrownDebug;n.get('sessionSelect').value='tour';n.get('seedInput').value='55';n.get('timeSelect').value='8';n.get('botSlider').value='1';n.get('overlayStart').onclick();assert.equal(d.getState().settings.roundLimit,4);h.advance(900);assert.equal(d.getState().phase,'final');assert.equal(d.getSession().tour.completed,1);assert.equal(d.getSession().captured,null);const finished=plain(d.getState());n.get('arenaSelect').value='glacier';n.get('replayStage').onclick();assert.equal(d.getSession().captured,null);assert.deepEqual(plain(d.getState().settings),finished.settings);h.advance(900);assert.deepEqual(plain(d.getState()),finished);n.get('nextStage').onclick();assert.equal(d.getState().settings.arena,'orchard');assert.equal(d.getSession().tour.stage,2);
 for(let stage=2;stage<=4;stage++){h.advance(900);assert.equal(d.getState().phase,'final');assert.equal(d.getSession().tour.completed,stage);if(stage<4){assert.equal(d.getSession().captured,null);n.get('nextStage').onclick();}}
 assert.equal(d.getSession().captured.seed,(55+3*104729)>>>0);assert.ok(d.getSession().tour.records.every(r=>!('seed'in r)));n.get('nextStage').onclick();assert.equal(d.getSession().tour.stage,4);
});
test('sprite provenance hashes match actual licensed local bytes; no unbounded new assets',async()=>{
 const crypto=await import('node:crypto');const p=JSON.parse(await readFile(new URL('../games/blind-crown/assets/worlds-provenance.json',import.meta.url),'utf8'));assert.equal(p.license,'CC0-1.0');for(const [name,hash]of Object.entries(p.files)){const bytes=await readFile(new URL('../games/blind-crown/assets/kenney/'+name,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash);}assert.match(html,/impactDecal\?\.complete&&impactDecal.naturalWidth/);assert.match(html,/particles.length<160/);assert.match(html,/audioVoices>=8/);
});

test('read-only diagnostics hide fresh seed and every rival plan throughout active rounds',()=>{
 const h=appHarness(),n=h.nodes,d=h.c.BlindCrownDebug;n.get('overlayStart').onclick();
 for(let i=0;i<200;i++){const s=d.getState(),session=d.getSession();if(s.phase!=='final')assert.equal(session.captured,null);if(s.phase==='planning'){assert.equal(s.shots.length,0);assert.ok(s.players.filter(p=>p.id!==1).every(p=>!('x'in p)&&!('y'in p)&&!('a'in p)));}assert.ok(!JSON.stringify(session).includes('random'));h.advance(1);}
 const detached=d.getState();detached.players[0].name='outside';assert.notEqual(d.getState().players[0].name,'outside');
});
test('geometry-aware bot plans never consult rival current secret coordinates or aim',()=>{
 for(const map of Object.keys(E.MAPS)){const a=match(map,4,731),b=match(map,4,731);for(const p of b.players.filter(p=>p.id!==2))Object.assign(p,{x:111,y:111,a:2.99});a.botPlan(a.players[1]);b.botPlan(b.players[1]);for(const k of ['x','y','a'])assert.equal(a.players[1][k],b.players[1][k]);}
});

test('fresh Tour diagnostics hide every generated seed at first final and subsequent private stages',()=>{
 const h=appHarness(),n=h.nodes,d=h.c.BlindCrownDebug;n.get('sessionSelect').value='tour';n.get('seedInput').value='';n.get('timeSelect').value='8';n.get('botSlider').value='1';n.get('overlayStart').onclick();
 const assertPrivate=()=>{const session=d.getSession();assert.equal(session.captured,null);const inspect=x=>{if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){assert.notEqual(k,'seed','Public Tour diagnostics expose seed');inspect(v);}};inspect(session);assert.equal(n.get('seedInput').value,'');};
 assertPrivate();h.advance(900);assert.equal(d.getState().phase,'final');assert.equal(d.getSession().tour.completed,1);assertPrivate();n.get('nextStage').onclick();assert.equal(d.getState().phase,'planning');assert.equal(d.getSession().tour.stage,2);assertPrivate();assert.ok(d.getState().players.slice(1).every(p=>!('x'in p)&&!('a'in p)));h.advance(105);assertPrivate();
});
test('captured Replay and transactional Next ignore staged zero rivals through real UI handlers',()=>{
 const h=appHarness(),n=h.nodes,d=h.c.BlindCrownDebug;n.get('sessionSelect').value='tour';n.get('timeSelect').value='8';n.get('botSlider').value='1';n.get('overlayStart').onclick();h.advance(900);assert.equal(d.getState().phase,'final');const rules=plain(d.getState().settings);
 n.get('botSlider').value='0';n.get('botSlider').oninput();n.get('replayStage').onclick();assert.equal(d.getState().phase,'planning');assert.equal(d.getSession().tour.stage,1);assert.deepEqual(plain(d.getState().settings),rules);h.advance(900);assert.equal(d.getState().phase,'final');n.get('nextStage').onclick();assert.equal(d.getState().phase,'planning');assert.equal(d.getState().settings.arena,'orchard');assert.equal(d.getState().settings.bots,1);assert.equal(d.getSession().tour.stage,2);assert.equal(d.getSession().tour.completed,1);
 n.get('settingsBtn').onclick();const before=JSON.stringify(d.getState()),tour=JSON.stringify(d.getSession().tour);n.get('startBtn').onclick();assert.equal(JSON.stringify(d.getState()),before);assert.equal(JSON.stringify(d.getSession().tour),tour);assert.equal(n.get('settingsDialog').open,true);
});


test('replay preserves earned Tour history while new round history resets; title/result openings start at their heading',()=>{
 const h=appHarness(),n=h.nodes,d=h.c.BlindCrownDebug;n.get('arenaBackdrop').scrollTop=100;n.get('watchDemo').onclick();n.get('returnDemo').onclick();assert.equal(n.get('arenaBackdrop').scrollTop,0);
 n.get('sessionSelect').value='tour';n.get('timeSelect').value='8';n.get('botSlider').value='1';n.get('overlayStart').onclick();h.advance(900);assert.equal(d.getState().phase,'final');assert.equal(n.get('arenaBackdrop').scrollTop,0);const earned=plain(d.getSession().tour);n.get('arenaBackdrop').scrollTop=180;
 n.get('settingsBtn').onclick();n.get('botSlider').value='0';n.get('botSlider').oninput();n.get('settingsClose').onclick();n.get('replayStage').onclick();const replay=d.getSession();assert.equal(d.getState().phase,'planning');assert.equal(replay.historyRounds,0);assert.equal(replay.captured,null);assert.deepEqual(plain(replay.tour),earned);assert.equal(n.get('arenaBackdrop').scrollTop,0);
 n.get('arenaBackdrop').scrollTop=180;h.advance(900);assert.equal(d.getState().phase,'final');assert.equal(n.get('arenaBackdrop').scrollTop,0);assert.equal(d.getSession().tour.completed,1);assert.deepEqual(plain(d.getSession().tour.records),earned.records);
});
