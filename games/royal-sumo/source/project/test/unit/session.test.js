import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Session,simOptions} from '../../src/core/session.js';
import {SlotTable} from '../../src/core/slots.js';
import {Sim} from '../../src/core/sim.js';
import {MAP_ORDER} from '../../src/core/maps.js';
import {OPT_DEFAULTS} from '../../src/core/options.js';
import {deriveSeed,hashStr32} from '../../src/core/seed.js';

const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))}};
const mkSession=(o={})=>{let r=0;const seq=[.1,.2,.3,.4,.5,.6,.7,.8,.9];return new Session(Object.assign({slots:new SlotTable({storage:mem()}),maps:MAP_ORDER,random:()=>seq[r++%seq.length]},o))};
const opts=(o={})=>Object.assign({},OPT_DEFAULTS,o);

test('?seed= plays exactly as given in the first match, then the sequence derives from it',()=>{
  const s=mkSession({urlSeed:'777'});
  assert.equal(s.planMatch(opts()).seed,777);
  assert.equal(s.planMatch(opts()).seed,deriveSeed(777,1));
  assert.equal(s.planMatch(opts()).seed,deriveSeed(777,2));
  const t=mkSession({urlSeed:'777'});assert.equal(t.planMatch(opts()).seed,777,'a second session replays the same sequence');
  assert.equal(t.planMatch(opts()).seed,deriveSeed(777,1));
});
test('THE REPORTED BUG: a seed given through the API reaches the match, and beats the URL seed',()=>{
  const s=mkSession({urlSeed:777});
  const p=s.planMatch(opts(),{seed:4242});
  assert.equal(p.seed,4242);
  assert.equal(new Sim(simOptions(p)).seed,4242,'...and the Sim');
  assert.equal(s.planMatch(opts()).seed,deriveSeed(4242,1),'later matches follow the API seed, not the URL one');
});
test('seed formats: numbers, numeric strings, hex, words; zero is a real seed; junk means "no seed"',()=>{
  const s=mkSession();
  assert.equal(s.planMatch(opts(),{seed:0}).seed,0);
  assert.equal(s.planMatch(opts(),{seed:'0x10'}).seed,16);
  assert.equal(s.planMatch(opts(),{seed:'sunrise'}).seed,hashStr32('sunrise'));
  const r=mkSession();assert.equal(r.planMatch(opts(),{seed:'  '}).seed,Math.floor(.1*4294967296),'blank falls back to random');
});
test('no seed: fresh randomness per match from the injected source',()=>{
  const s=mkSession();const a=s.planMatch(opts()).seed,b=s.planMatch(opts()).seed;
  assert.equal(a,Math.floor(.1*4294967296));assert.equal(b,Math.floor(.2*4294967296));assert.notEqual(a,b);
});
test('setSeed(null) goes back to random; setSeed(v) applies to the next match',()=>{
  const s=mkSession({urlSeed:5});s.planMatch(opts());
  s.setSeed(null);assert.equal(s.planMatch(opts()).seed,Math.floor(.1*4294967296));
  assert.equal(s.setSeed(99),99);assert.equal(s.planMatch(opts()).seed,99);
});
test('restart replays the same seed; restart({seed}) takes a new one; rematch is a different match',()=>{
  const s=mkSession();const p=s.planMatch(opts({map:'floe',fighters:5}),{seed:1234});
  const r=s.planReplay();assert.equal(r.seed,1234);assert.equal(r.opts.map,'floe');assert.equal(r.n,5);
  assert.deepEqual(r.slots,p.slots);
  const r2=s.planReplay({seed:99});assert.equal(r2.seed,99);
  assert.equal(s.planReplay().seed,99,'the explicit seed becomes the one that is replayed');
  const rm=s.planRematch();assert.notEqual(rm.seed,99);assert.equal(rm.seed,deriveSeed(99,1));assert.equal(rm.opts.map,'floe');
});
test('replaying a match gives a bit-identical simulation',()=>{
  const s=mkSession();const run=p=>{const sim=new Sim(simOptions(p));sim.startMatch();for(let i=0;i<1200;i++)sim.step(1/120);return JSON.stringify(sim.snapshot())};
  const a=run(s.planMatch(opts({map:'plaza'}),{seed:31337})),b=run(s.planReplay());
  assert.equal(a,b);
  assert.notEqual(a,run(s.planReplay({seed:31338})));
});
test('seating survives restart, rematch and cup stages (owners, names, looks)',()=>{
  const s=mkSession();
  s.applySeating({owners:{2:'remote'},names:{2:'Zed',0:'Ann'}});
  s.slots.setStyle(3,0);
  const check=p=>{
    assert.equal(p.slots[2].owner,'remote');assert.equal(p.slots[2].name,'Zed');assert.equal(p.slots[0].name,'Ann');
    assert.equal(new Set(p.slots.map(x=>x.style)).size,p.slots.length);assert.equal(p.slots[3].style,0);
  };
  check(s.planMatch(opts()));check(s.planReplay());check(s.planRematch());
  check(s.planCup(opts()));check(s.advanceCup());
});
test('applySeating understands players, arrays and objects, and ignores nonsense',()=>{
  const s=mkSession();
  s.applySeating({players:2});assert.equal(s.slots.owner(1),'local');
  s.applySeating({players:1,owners:['local','bot','remote',null,'nonsense'],names:['A',undefined,'C']});
  assert.deepEqual([s.slots.owner(1),s.slots.owner(2),s.slots.owner(3),s.slots.owner(4)],['bot','remote','bot','bot']);
  assert.equal(s.slots.get(0).name,'A');assert.equal(s.slots.get(1).name,'');assert.equal(s.slots.get(2).name,'C');
  s.applySeating(null);s.applySeating('x');s.applySeating({owners:{foo:'remote','-1':'remote'}});
  assert.equal(s.slots.owner(2),'remote');
});
test('demo plans are bots only and never consume the session seed sequence',()=>{
  const s=mkSession({urlSeed:50});s.slots.setName(0,'Ann');
  const d=s.planMatch(opts(),{demo:true});assert.equal(d.demo,true);
  const sim=new Sim(simOptions(d));assert.equal(sim.humanSlots.size,0);assert.notEqual(sim.seats[0].name,'Ann');
  assert.equal(s.planMatch(opts()).seed,50,'the real match still gets the URL seed');
});
test('Crown Cup: stage seeds are a pure function of the cup seed',()=>{
  const s=mkSession();const p0=s.planCup(opts({map:'wharf',fighters:4}),{seed:2024});
  assert.equal(p0.seed,2024);assert.equal(p0.kind,'cup');assert.equal(p0.stage,0);assert.equal(p0.opts.map,'wharf');assert.equal(p0.opts.winTarget,1);
  const seeds=[p0.seed];for(let k=1;k<6;k++){const p=s.advanceCup();assert.equal(p.stage,k);seeds.push(p.seed)}
  assert.equal(new Set(seeds).size,6);assert.equal(seeds[3],deriveSeed(2024,3));
  const t=mkSession();t.planCup(opts({map:'wharf',fighters:4}),{seed:2024});const again=[2024];for(let k=1;k<6;k++)again.push(t.advanceCup().seed);
  assert.deepEqual(seeds,again);
  assert.equal(s.advanceCup(),null,'no arena after the last');
  assert.deepEqual(s.cup.order.slice(0,3),['wharf','teeter','mesa']);
});
test('Crown Cup: finishing arenas builds the standings; the final arena names the champion(s) by points',()=>{
  const s=mkSession();s.planCup(opts({fighters:4}),{seed:1});
  const win=(w,kos)=>({n:4,winner:w,stats:kos.map(k=>({kos:k}))});
  let c=s.finishCupStage(win(0,[1,0,0,0]));assert.equal(c.last,false);assert.equal(c.next,s.cup.order[1]);assert.deepEqual(c.total,[4,0,0,0]);
  const again=s.finishCupStage(win(0,[1,0,0,0]));assert.deepEqual(again.total,[4,0,0,0],'idempotent');
  s.advanceCup();s.finishCupStage(win(0,[2,0,0,0]));
  for(let k=2;k<5;k++){s.advanceCup();s.finishCupStage(win(1,[0,0,0,0]))}
  s.advanceCup();c=s.finishCupStage(win(3,[0,0,0,2]));   // fighter 3 wins the LAST arena
  assert.equal(c.last,true);assert.equal(c.next,null);
  assert.deepEqual(c.total,[4+5,9,0,5]);
  assert.deepEqual(c.standings.map(r=>r.id),[1,0,3,2],'0 and 1 are level on 9 points; wins decide (1 has three arena wins, 0 has two). Fighter 3 won the LAST arena but is third on points.');
  assert.deepEqual(c.champs,[1]);assert.deepEqual(c.standings.map(r=>r.rank),[1,2,3,4]);
});
test('Crown Cup: replaying a stage keeps the stage and its seed',()=>{
  const s=mkSession();s.planCup(opts(),{seed:9});s.advanceCup();s.advanceCup();
  const here=s.plan,r=s.planReplay();
  assert.equal(r.stage,2);assert.equal(r.seed,here.seed);assert.equal(r.kind,'cup');assert.equal(r.stages,6);
});
test('starting a quick match ends any cup in progress',()=>{
  const s=mkSession();s.planCup(opts(),{seed:9});assert.ok(s.cup);s.planMatch(opts());assert.equal(s.cup,null);
});
test('options are normalised on the way in: nonsense never reaches the Sim',()=>{
  const s=mkSession();const p=s.planMatch({map:'constructor',fighters:99,difficulty:'__proto__',hazard:'???',knockback:'abc'});
  assert.equal(p.opts.map,'keep');assert.equal(p.n,10);assert.equal(p.opts.difficulty,'normal');assert.equal(p.opts.hazard,'normal');assert.equal(p.opts.knockback,1);
  const sim=new Sim(simOptions(p));sim.startMatch();for(let i=0;i<240;i++)sim.step(1/120);
  for(const f of sim.fighters)assert.ok(isFinite(f.x)&&isFinite(f.z));
});
