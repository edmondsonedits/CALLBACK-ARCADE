import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Sim} from '../../src/core/sim.js';
import {Session,simOptions} from '../../src/core/session.js';
import {SlotTable} from '../../src/core/slots.js';
import {MAP_ORDER} from '../../src/core/maps.js';
import {OPT_DEFAULTS} from '../../src/core/options.js';
import {FIXED_DT} from '../../src/core/tune.js';
import {Hasher,hashState,hashEvent} from '../support/scenario.js';

const base=o=>Object.assign({map:'keep',fighters:4,seed:5,hazard:'off',difficulty:'normal'},o);
const fight=(sim,sec=4)=>{sim.startMatch();let n=Math.round(sec/FIXED_DT);while(n-->0)sim.step(FIXED_DT);sim.drain()};
const stepN=(sim,sec,fn)=>{let n=Math.round(sec/FIXED_DT),i=0;while(n-->0){if(fn)fn(i++);sim.step(FIXED_DT)}};

test('slots option sets owner, name, look and bot skill per seat',()=>{
  const sim=new Sim(base({slots:[{owner:'local',name:'Ann',style:3},{owner:'bot',skill:'legend'},{owner:'remote',name:'Zed',style:0},{owner:'bot'}]}));
  sim.startMatch();
  assert.deepEqual(sim.fighters.map(f=>f.kind),['local','bot','remote','bot']);
  assert.deepEqual(sim.fighters.map(f=>f.name),['Ann','RUFUS','Zed','GREGOR']);
  assert.deepEqual(sim.fighters.map(f=>f.style),[3,1,0,3]);
  assert.deepEqual([...sim.humanSlots],[0,2]);
  assert.equal(sim.fighters[1].diffName,'legend');assert.equal(sim.fighters[3].diffName,'normal');
});
test('the older humans:[ids] shorthand still means seat 0 local, others remote; [-1] means nobody',()=>{
  const a=new Sim(base({humans:[0,3]}));a.startMatch();assert.deepEqual(a.fighters.map(f=>f.kind),['local','bot','bot','remote']);
  const b=new Sim(base({humans:[-1]}));b.startMatch();assert.ok(b.fighters.every(f=>f.kind==='bot'));
  const c=new Sim(base({}));c.startMatch();assert.deepEqual(c.fighters.map(f=>f.kind),['local','bot','bot','bot'],'default: one local human');
  const d=new Sim(base({demo:true,humans:[0,1]}));d.startMatch();assert.ok(d.fighters.every(f=>f.kind==='bot'),'demos are bots only');
});
test('THE REPORTED BUG: handing a bot seat to a remote controller really changes who drives it',()=>{
  const sim=new Sim(base());sim.startMatch();stepN(sim,3.5);                 // past intro + countdown: bots are fighting
  assert.equal(sim.phase,'fight');
  const before=sim.fighters[2];assert.equal(before.kind,'bot');
  assert.equal(sim.setOwner(2,'remote'),true);
  assert.equal(sim.fighters[2].kind,'remote');assert.ok(sim.humanSlots.has(2));assert.equal(sim.ownerOf(2),'remote');
  // the AI must not touch this seat's input any more: drive it east and watch it go east
  const x0=sim.fighters[2].x;
  stepN(sim,.6,()=>{const i=sim.inputs[2];i.mx=1;i.mz=0});
  const f=sim.fighters[2];
  assert.ok(f.vx>2||f.x-x0>.8,'moved east under external control: vx='+f.vx.toFixed(2)+' dx='+(f.x-x0).toFixed(2));
  assert.ok(Math.abs(f.vz)<1.2,'and not wherever the AI wanted to go: vz='+f.vz.toFixed(2));
});
test('handing a seat back to the AI wakes the AI up',()=>{
  const sim=new Sim(base({slots:[{owner:'local'},{owner:'bot'},{owner:'remote'},{owner:'bot'}]}));sim.startMatch();stepN(sim,3.5);
  assert.equal(sim.fighters[2].ai,null,'a remote seat has no AI state');
  assert.equal(sim.setOwner(2,'bot'),true);
  assert.ok(sim.fighters[2].ai,'AI state is initialised');assert.ok(!sim.humanSlots.has(2));
  const p0=[sim.fighters[2].x,sim.fighters[2].z];let moved=0,changed=false;
  stepN(sim,2,()=>{const i=sim.inputs[2];if(i.mx!==0||i.mz!==0)changed=true});
  moved=Math.hypot(sim.fighters[2].x-p0[0],sim.fighters[2].z-p0[1]);
  assert.ok(changed||moved>.3,'the bot is steering again (moved '+moved.toFixed(2)+')');
});
test('a new owner starts from a clean input: no stuck stick or half-pressed BASH',()=>{
  const sim=new Sim(base({slots:[{owner:'local'},{owner:'bot'},{owner:'remote'},{owner:'bot'}]}));sim.startMatch();stepN(sim,3.5);
  const inp=sim.inputs[2];inp.mx=1;inp.mz=1;inp.bashDown=true;inp.dash=true;
  sim.setOwner(2,'bot');
  assert.deepEqual([inp.mx,inp.mz,inp.bashDown,inp.dash,inp.bashPower],[0,0,false,false,-1]);
});
test('setOwner rejects bad seats and owners, ignores no-ops, and is not allowed in demos',()=>{
  const sim=new Sim(base());sim.startMatch();
  for(const [i,o] of [[-1,'bot'],[4,'bot'],[99,'bot'],[1.2,'bot'],['1','bot'],[1,'admin'],[1,undefined],[1,null]])assert.equal(sim.setOwner(i,o),false,i+' '+o);
  assert.equal(sim.setOwner(1,'bot'),false,'already a bot');
  const d=new Sim(base({demo:true}));d.startMatch();assert.equal(d.setOwner(1,'remote'),false);
});
test('owner changes are announced as an event',()=>{
  const sim=new Sim(base());sim.startMatch();sim.drain();
  sim.setOwner(3,'remote');const ev=sim.drain().filter(e=>e.type==='owner');
  assert.equal(ev.length,1);assert.deepEqual([ev[0].id,ev[0].owner,ev[0].was],[3,'remote','bot']);
});
test('THE REPORTED BUG: names survive round changes (the fighter objects are rebuilt every round)',()=>{
  const sim=new Sim(base({slots:[{owner:'local',name:'Ann'},{owner:'bot'},{owner:'remote'},{owner:'bot'}]}));sim.startMatch();
  assert.equal(sim.setSeatName(2,'Zed'),true);assert.equal(sim.fighters[2].name,'Zed','applies to the live fighter');
  const first=sim.fighters[2];sim.startRound();
  assert.notEqual(sim.fighters[2],first,'new fighter object');
  assert.equal(sim.fighters[2].name,'Zed');assert.equal(sim.fighters[0].name,'Ann');
  assert.equal(sim.setSeatName(2,''),false);assert.equal(sim.setSeatName(2,42),false);assert.equal(sim.setSeatName(-1,'x'),false);
});
test('ownership also survives round changes',()=>{
  const sim=new Sim(base());sim.startMatch();sim.setOwner(1,'remote');sim.startRound();
  assert.equal(sim.fighters[1].kind,'remote');assert.equal(sim.fighters[1].ai,null);
});
test('looks and skills: explicit seat styles reach the fighters, skill overrides beat the match difficulty and the mixed ladder',()=>{
  const sim=new Sim(base({difficulty:'mixed',slots:[{owner:'local'},{owner:'bot',skill:'rookie'},{owner:'bot'},{owner:'bot'}]}));sim.startMatch();
  assert.equal(sim.fighters[1].diffName,'rookie');
  assert.equal(sim.fighters[2].diffName,'easy','seat 2 keeps its mixed-ladder skill (index 2 = easy)');
});
test('a full match with a remote seat driven by a puppet is deterministic, and differs from the all-bot match',()=>{
  const run=(withRemote,flipAt)=>{
    const sim=new Sim(base({seed:77,hazard:'normal',slots:[{owner:'local'},{owner:'bot'},{owner:withRemote?'remote':'bot'},{owner:'bot'}]}));
    sim.startMatch();const H=new Hasher();let s=1;const rnd=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296};
    for(let t=0;t<120*25;t++){
      if(t%15===0){const a=rnd()*6.28;for(const id of [0,2]){if(sim.fighters[id]&&sim.fighters[id].kind!=='bot'){const i=sim.inputs[id];i.mx=Math.cos(a);i.mz=Math.sin(a);i.bashDown=rnd()<.4}}}
      if(flipAt&&t===flipAt)sim.setOwner(2,'bot');
      sim.step(FIXED_DT);for(const e of sim.drain())hashEvent(H,e);if(t%60===0)hashState(H,sim);
    }
    return H.hex();
  };
  assert.equal(run(true),run(true));assert.equal(run(true,600),run(true,600));
  assert.notEqual(run(true),run(false));assert.notEqual(run(true),run(true,600),'handing the seat back mid-match changes the outcome');
});
test('snapshot reports owner and style for every fighter',()=>{
  const sim=new Sim(base({slots:[{owner:'local',style:4},{owner:'remote'},{owner:'bot'},{owner:'bot'}]}));sim.startMatch();
  const s=sim.snapshot();assert.deepEqual(s.fighters.map(f=>f.owner),['local','remote','bot','bot']);assert.equal(s.fighters[0].style,4);
  assert.equal(s.version,'1.2.1');
});
test('end to end: the session plans seating, the Sim obeys it, restart keeps it',()=>{
  const slots=new SlotTable();const ses=new Session({slots,maps:MAP_ORDER,random:()=>.5});
  ses.applySeating({owners:{2:'remote'},names:{2:'Zed'}});
  const p=ses.planMatch(Object.assign({},OPT_DEFAULTS,{fighters:4}),{seed:1});
  let sim=new Sim(simOptions(p));sim.startMatch();
  assert.deepEqual(sim.fighters.map(f=>[f.kind,f.name]),[['local','YOU'],['bot','RUFUS'],['remote','Zed'],['bot','GREGOR']]);
  slots.setOwner(2,'bot');                                      // changed between matches
  sim=new Sim(simOptions(ses.planReplay()));sim.startMatch();
  assert.equal(sim.fighters[2].kind,'bot');assert.equal(sim.fighters[2].name,'Zed','the custom name stays with the seat');
});
