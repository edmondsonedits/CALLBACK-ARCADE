import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Control,pickOptions} from '../../src/core/control.js';
import {Session,simOptions} from '../../src/core/session.js';
import {SlotTable} from '../../src/core/slots.js';
import {Sim} from '../../src/core/sim.js';
import {MAP_ORDER} from '../../src/core/maps.js';
import {OPT_DEFAULTS} from '../../src/core/options.js';
import {FIXED_DT} from '../../src/core/tune.js';
import {VERSIONS} from '../../src/core/versions.js';

const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),dump:()=>m}};
/** A control wired to a fake page: a host that really builds Sims, and a clock we move by hand. */
function rig(o={}){
  const clock={t:1000},store=mem();
  const slots=new SlotTable({storage:store});
  let r=0;const seq=[.11,.27,.39,.41,.58,.62,.73,.85,.97];
  const session=new Session({slots,maps:MAP_ORDER,random:()=>seq[r++%seq.length],urlSeed:o.urlSeed});
  const host={simv:null,mode:null,changed:0,launched:[],
    sim(){return this.simv},
    launch(plan,how){this.launched.push(plan);this.simv=new Sim(simOptions(plan));this.simv.startMatch();this.mode=how},
    baseOptions:()=>Object.assign({},OPT_DEFAULTS,o.base||{}),
    seatsChanged(){this.changed++}};
  const control=new Control({session,slots,host,now:()=>clock.t});
  const run=(sec,fn)=>{let n=Math.round(sec/FIXED_DT),i=0;const sim=host.simv;while(n-->0){if(fn)fn(i++);sim.step(FIXED_DT);clock.t+=FIXED_DT*1000}sim.drain()};
  return {control,slots,session,host,clock,store,run};
}
const small={map:'keep',fighters:4,hazard:'off'};

/* ------------------------------------------------------------------ the reported setHumanSlot bug */
test('THE REPORTED BUG: setHumanSlot hands a seat to an external controller, which then really drives it',()=>{
  const {control,host,run,clock}=rig();
  control.scenario(Object.assign({seed:5},small));run(3.6);                       // intro + countdown over, bots fighting
  assert.equal(host.simv.phase,'fight');
  assert.equal(control.getSlots()[2].owner,'bot');
  const rec=control.setHumanSlot(2,true);
  assert.equal(rec.owner,'remote');assert.equal(host.simv.fighters[2].kind,'remote');assert.equal(control.getSlots()[2].kind,'remote');
  assert.ok(host.changed>0,'the page is told seats changed');
  const x0=host.simv.fighters[2].x;
  let accepted=0;
  run(.7,()=>{control.routeInputs(host.simv,{},clock.t);if(control.submitInput(2,{moveX:1,moveY:0}))accepted++});
  const f=host.simv.fighters[2];
  assert.ok(accepted>0,'commands were accepted');
  assert.ok(f.vx>2&&f.x-x0>.8,'driven east: vx='+f.vx.toFixed(2)+' dx='+(f.x-x0).toFixed(2));
});
test('setHumanSlot(i,false) returns the seat to the AI, and the AI really plays it',()=>{
  const {control,host,run}=rig();
  control.scenario(Object.assign({seed:5},small));
  control.setHumanSlot(2,true);run(3.6);
  assert.equal(host.simv.fighters[2].kind,'remote');
  control.setHumanSlot(2,false);
  assert.equal(host.simv.fighters[2].kind,'bot');assert.equal(control.getSlots()[2].owner,'bot');
  const x0=host.simv.fighters[2].x,z0=host.simv.fighters[2].z;run(1.5);
  const f=host.simv.fighters[2];assert.ok(Math.hypot(f.x-x0,f.z-z0)>.3||f.bashT>0||f.charging,'the AI moves it again');
});
test('setHumanSlot accepts the v0.21 booleans and the new owner names',()=>{
  const {control}=rig();control.scenario(small);
  assert.equal(control.setHumanSlot(0,false).owner,'bot');
  assert.equal(control.setHumanSlot(0,true).owner,'local','seat 0 + true = a person on this device');
  assert.equal(control.setHumanSlot(3,true).owner,'remote','other seats + true = remote');
  assert.equal(control.setHumanSlot(3,'bot').owner,'bot');
  assert.equal(control.setHumanSlot(1,'local').device,'p2','the second local seat uses the second device');
  assert.equal(control.setHumanSlot(2,'local'),null,'there are only two local devices');
  assert.equal(control.setHumanSlot(2,'ghost'),null);
  assert.equal(control.setHumanSlot(-1,true),null);assert.equal(control.setHumanSlot(99,true),null);assert.equal(control.setHumanSlot('x',true),null);
  assert.equal(control.setHumanSlot('1','remote').owner,'remote','numeric strings are fine');
});
test('ownership survives restart(), rematch, and a different match size',()=>{
  const {control,host}=rig();
  control.scenario(Object.assign({seed:7},small));control.setHumanSlot(2,true);
  control.restart();assert.equal(host.simv.fighters[2].kind,'remote');
  control.rematch();assert.equal(host.simv.fighters[2].kind,'remote');
  control.setFighterCount(6);assert.equal(host.simv.n,6);assert.equal(host.simv.fighters[2].kind,'remote');
  control.scenario({map:'floe',fighters:3});assert.equal(host.simv.fighters[2].kind,'remote');
  control.setFighterCount(2);assert.equal(host.simv.n,2);
  assert.equal(control.getSlots().length,2,'getSlots follows the match size');
  control.setFighterCount(5);assert.equal(host.simv.fighters[2].kind,'remote','seat 2 is still remote after shrinking and growing');
});

/* ---------------------------------------------------------------------- external input */
test('submitInput only drives remote seats: local seats, bot seats and bad seats are ignored',()=>{
  const {control,host,run}=rig();
  control.scenario(Object.assign({seed:3},small));run(3.6);
  assert.equal(control.submitInput(0,{moveX:1}),false,'seat 0 is local');
  assert.equal(control.submitInput(1,{moveX:1}),false,'seat 1 is a bot');
  assert.equal(control.submitInput(42,{moveX:1}),false);assert.equal(control.submitInput(-1,{}),false);assert.equal(control.submitInput('a',{}),false);
  control.setHumanSlot(1,true);
  assert.equal(control.submitInput(1,{moveX:1}),true);
  assert.equal(control.submitInput(1,null),true,'an empty/garbage command is a harmless heartbeat');
  control.setHumanSlot(1,false);
  assert.equal(control.submitInput(1,{moveX:1}),false,'handing the seat back stops the controller');
});
test('submitInput is refused while only the title-screen demo is running',()=>{
  const {control}=rig();control.startDemo('keep');control.setHumanSlot(2,true);
  assert.equal(control.submitInput(2,{moveX:1}),false);
});
test('an external client that goes quiet stops walking (dead-man), then resumes when it speaks again',()=>{
  const {control,host,run,clock}=rig();
  control.scenario(Object.assign({seed:3},small,{fighters:2}));control.setHumanSlot(1,true);run(3.6);   // two fighters: nobody to bump into
  control.multiplayerApi().setRemoteTimeout(300);
  control.submitInput(1,{moveX:1,moveY:0});
  run(.25,()=>control.routeInputs(host.simv,{},clock.t));
  assert.ok(host.simv.fighters[1].vx>1.5,'walking: '+host.simv.fighters[1].vx.toFixed(2));
  run(.7,()=>control.routeInputs(host.simv,{},clock.t));                          // silence for longer than the 300 ms limit
  assert.ok(Math.hypot(host.simv.fighters[1].vx,host.simv.fighters[1].vz)<.8,'stopped');
  control.submitInput(1,{moveX:-1,moveY:0});
  run(.2,()=>control.routeInputs(host.simv,{},clock.t));
  assert.ok(host.simv.fighters[1].vx<-1,'moving again');
});
test('remote bash: hold to charge, release to strike, or strike at once with a chosen power',()=>{
  const {control,host,run,clock}=rig();
  control.scenario(Object.assign({seed:3},small,{fighters:2}));control.setHumanSlot(1,true);run(3.6);
  const f=()=>host.simv.fighters[1],route=()=>control.routeInputs(host.simv,{},clock.t);
  control.submitInput(1,{bashDown:true});run(.4,route);
  assert.ok(f().charging&&f().charge>.2,'charging while BASH is held: '+f().charge.toFixed(2));
  control.submitInput(1,{bashDown:false});run(.1,route);
  assert.ok(f().bashT>0||f().bashCd>0,'released = struck');
  run(1.5,route);
  const s0=host.simv.stats[1].bashes;
  control.submitInput(1,{bashPressed:true,bashCharge:.8});run(.05,route);
  assert.equal(host.simv.stats[1].bashes,s0+1,'one instant strike');
});

/* --------------------------------------------------------------------------- names */
test('THE REPORTED BUG: player names persist through restarts, rounds and reloads, and show up live',()=>{
  const {control,host,store,run}=rig();
  control.scenario(Object.assign({seed:5},small));run(1);
  assert.equal(control.setPlayerName(2,'  ZED  '),'ZED');
  assert.equal(host.simv.fighters[2].name,'ZED','the fighter on the field is renamed immediately');
  assert.equal(control.getSlots()[2].name,'ZED');
  host.simv.startRound();assert.equal(host.simv.fighters[2].name,'ZED','new round');
  control.restart();assert.equal(host.simv.fighters[2].name,'ZED','restart');
  control.rematch();assert.equal(host.simv.fighters[2].name,'ZED','rematch');
  // a brand-new page load (same storage) remembers it
  const again=rig();again.store.dump().clear();for(const [k,v] of store.dump())again.store.setItem(k,v);
  const slots2=new SlotTable({storage:again.store});assert.equal(slots2.displayName(2,4),'ZED');
});
test('setPlayerName sanitises, resets to the default on empty, and refuses bad seats',()=>{
  const {control,host}=rig();control.scenario(small);
  assert.equal(control.setPlayerName(1,'A‮B\u0000C<script>'),'A B C<script>'.slice(0,12).trim(),'control and bidi characters become spaces, length is capped');
  assert.equal(control.setPlayerName(1,''),'RUFUS','empty = default name');
  assert.equal(host.simv.fighters[1].name,'RUFUS');
  assert.equal(control.setPlayerName(77,'x'),null);assert.equal(control.setPlayerName(1,undefined),'RUFUS');
  assert.equal(control.setPlayerName(0,'Ann'),'Ann');
  control.setHumanSlot(1,'local');assert.equal(control.getSlots()[0].name,'Ann');
});
test('two local players are called P1 and P2 for the whole match, not just round one',()=>{
  const {control,host}=rig();
  control.scenario(Object.assign({players:2,seed:9},small));
  assert.deepEqual(host.simv.fighters.slice(0,2).map(f=>f.name),['P1','P2']);
  host.simv.startRound();host.simv.startRound();
  assert.deepEqual(host.simv.fighters.slice(0,2).map(f=>f.name),['P1','P2'],'names survive new rounds');
  assert.deepEqual([control.deviceSeat('p1'),control.deviceSeat('p2')],[0,1]);assert.equal(control.isSplit(),true);
});

/* ---------------------------------------------------------------------------- seeds */
test('THE REPORTED BUG: seeds through the API reach the sim; restart replays; URL seed is the weakest source',()=>{
  const {control,host}=rig({urlSeed:'777'});
  control.scenario(Object.assign({seed:1234},small));assert.equal(host.simv.seed,1234);assert.equal(control.state().seed,1234);
  const a=JSON.stringify(host.simv.snapshot().fighters);
  control.restart();assert.equal(host.simv.seed,1234,'restart replays the seed');assert.equal(JSON.stringify(host.simv.snapshot().fighters),a);
  control.restart({seed:99});assert.equal(host.simv.seed,99);
  control.restart();assert.equal(host.simv.seed,99,'...and keeps replaying the new one');
  control.scenario(small);assert.notEqual(host.simv.seed,777,'a later match is derived from the API seed, not the URL seed');
  const {control:c2,host:h2}=rig({urlSeed:'777'});c2.scenario(small);assert.equal(h2.simv.seed,777,'with nothing else given the URL seed plays first');
  c2.setSeed(null);c2.scenario(small);assert.notEqual(h2.simv.seed,777);
});
test('Control.restart before any match behaves like a fresh scenario, with the given seed',()=>{
  const {control,host}=rig();control.restart({seed:31,map:'wharf',fighters:3});
  assert.equal(host.simv.seed,31);assert.equal(host.simv.map.id,'wharf');assert.equal(host.simv.n,3);
});
test('the title demo never becomes the match that restart() replays',()=>{
  const {control,host}=rig();
  control.scenario(Object.assign({seed:21},small));
  control.startDemo('floe');assert.equal(host.mode,'menu');assert.ok(host.simv.demo);
  control.restart();assert.equal(host.simv.demo,false,'replays the real match');assert.equal(host.simv.seed,21);assert.equal(host.simv.map.id,'keep');
  assert.equal(control.state().build,VERSIONS.build);
});

/* ------------------------------------------------------------------------ input routing */
test('routeInputs: each local device feeds its own seat; the touch/WASD device is not forced onto seat 0',()=>{
  const {control,host,clock}=rig();
  control.scenario(Object.assign({seed:1,players:2},small));
  const sim=host.simv,p1={mx:1,mz:0,bashDown:true,dash:true},p2={mx:0,mz:-1,bashDown:false,dash:false};
  control.routeInputs(sim,{p1,p2},clock.t);
  assert.deepEqual([sim.inputs[0].mx,sim.inputs[0].bashDown,sim.inputs[0].dash],[1,true,true]);
  assert.deepEqual([sim.inputs[1].mz,sim.inputs[1].bashDown],[-1,false]);
  assert.equal(sim.inputs[2].mx,0,'bots are untouched');
  // swap devices: p1 goes to seat 2, seat 0 becomes a bot
  control.setHumanSlot(0,'bot');control.setHumanSlot(2,'local',{device:'p1'});
  assert.equal(control.deviceSeat('p1'),2);assert.equal(control.deviceSeat('p2'),1);
  sim.inputs[0].mx=0;control.routeInputs(sim,{p1:{mx:-1,mz:0,bashDown:false,dash:false},p2},clock.t);
  assert.equal(sim.inputs[2].mx,-1);assert.equal(sim.inputs[0].mx,0);
});
test('routeInputs: a local seat whose device is missing stands still instead of keeping a stuck stick',()=>{
  const {control,host,clock}=rig();control.scenario(Object.assign({seed:1},small));
  const sim=host.simv;sim.inputs[0].mx=1;sim.inputs[0].bashDown=true;
  control.routeInputs(sim,{},clock.t);assert.equal(sim.inputs[0].mx,0);assert.equal(sim.inputs[0].bashDown,false);
});
test('routeInputs never touches demos or bots',()=>{
  const {control,host,clock}=rig();control.startDemo('keep');
  const sim=host.simv;sim.inputs[0].mx=.5;control.routeInputs(sim,{p1:{mx:1,mz:1,bashDown:true,dash:true}},clock.t);assert.equal(sim.inputs[0].mx,.5);
  control.routeInputs(null,{},0);
});
test('deviceSeat / isSplit only count seats that are really local in the running match',()=>{
  const {control,host}=rig();
  control.scenario(small);assert.equal(control.deviceSeat('p1'),0);assert.equal(control.deviceSeat('p2'),-1);assert.equal(control.isSplit(),false);
  control.setHumanSlot(1,'local');assert.equal(control.isSplit(),true);
  control.setHumanSlot(0,'remote');assert.equal(control.deviceSeat('p1'),-1,'seat 0 is no longer local');assert.equal(control.isSplit(),false);
  control.startDemo('keep');assert.equal(control.deviceSeat('p1'),-1);
});

/* ------------------------------------------------------------------------------- flow */
test('menu flow: quick match, Crown Cup with arena progression, quit',()=>{
  const {control,host,session}=rig();
  control.startFromMenu(Object.assign({},OPT_DEFAULTS,{map:'mesa',fighters:4}),{mode:'cup',players:1});
  assert.ok(session.cup);assert.equal(host.simv.map.id,'mesa');assert.equal(host.simv.winTarget,1);
  control.nextStage();assert.equal(host.simv.map.id,MAP_ORDER[(MAP_ORDER.indexOf('mesa')+1)%MAP_ORDER.length]);
  assert.equal(control.state().cup.stage,2);
  control.quitToTitle();assert.equal(session.cup,null);assert.equal(control.state().cup,null);
  control.startFromMenu(Object.assign({},OPT_DEFAULTS,{fighters:6}),{mode:'quick',players:2});
  assert.equal(host.simv.n,6);assert.equal(control.isSplit(),true);
  assert.equal(control.nextStage(),null,'no cup, no next arena');
});
test('scenario normalises junk and understands owners/names hints',()=>{
  const {control,host}=rig();
  control.scenario({map:'nope',fighters:'x',difficulty:'impossible',seed:'sunrise',owners:['local','bot','remote'],names:['Ann',null,'Cy']});
  assert.equal(host.simv.map.id,'keep');assert.equal(host.simv.n,4);assert.equal(host.simv.difficulty,'normal');
  assert.deepEqual(host.simv.fighters.map(f=>f.kind),['local','bot','remote','bot']);
  assert.deepEqual(host.simv.fighters.slice(0,3).map(f=>f.name),['Ann','RUFUS','Cy']);
  assert.ok(Number.isInteger(host.simv.seed));
  assert.deepEqual(Object.keys(pickOptions({map:'x',seed:1,junk:2,fighters:3})).sort(),['fighters','map']);
});
test('setFighterCount rejects nonsense and clamps to 2..10',()=>{
  const {control,host}=rig();control.scenario(small);
  assert.equal(control.setFighterCount('abc'),false);assert.equal(host.simv.n,4);
  assert.equal(control.setFighterCount(99),10);assert.equal(control.setFighterCount(0),2);
});
test('getState reports build, protocol, seating and cup progress',()=>{
  const {control}=rig();assert.equal(control.state(),null);
  control.scenario(small);control.setHumanSlot(2,true);
  const s=control.state();
  assert.equal(s.protocol,VERSIONS.protocol);assert.equal(s.version,VERSIONS.sim);assert.equal(s.slots[2].owner,'remote');assert.equal(s.fighters[2].owner,'remote');assert.equal(s.cup,null);
});
test('multiplayerApi exposes the documented surface and the same behaviour',()=>{
  const {control,host}=rig();control.scenario(small);
  const m=control.multiplayerApi();
  assert.equal(m.maxPlayers,10);
  for(const k of ['getSlots','setHumanSlot','setOwner','submitInput','setPlayerName','setLook','setBotSkill','setFighterCount','setRemoteTimeout'])assert.equal(typeof m[k],'function',k);
  m.setHumanSlot(3,true);assert.equal(host.simv.fighters[3].kind,'remote');
  assert.equal(m.setPlayerName(3,'NET'),'NET');
  m.setLook(2,7);m.setBotSkill(1,'legend');control.restart();
  assert.equal(host.simv.fighters[2].style,7);assert.equal(host.simv.fighters[1].diffName,'legend');
  m.setRemoteTimeout(100);m.submitInput(3,{moveX:1});
});
