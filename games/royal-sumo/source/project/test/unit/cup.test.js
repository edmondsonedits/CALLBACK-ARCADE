import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newCup,scoreStage,standings,champions,rankMatch,rankBy,cupOrder,isFinalStage,CUP_POINTS} from '../../src/core/cup.js';
import {MAP_ORDER} from '../../src/core/maps.js';

const mk=(n=4,stages=6)=>newCup({order:cupOrder('keep',MAP_ORDER).slice(0,stages),n});
const res=(n,winner,kos)=>({n,winner,stats:kos.map(k=>({kos:k}))});

test('cup order starts at the chosen arena and visits every arena once',()=>{
  const o=cupOrder('wharf',MAP_ORDER);
  assert.equal(o[0],'wharf');assert.equal(o.length,MAP_ORDER.length);assert.deepEqual([...o].sort(),[...MAP_ORDER].sort());
  assert.equal(cupOrder('nonsense',MAP_ORDER)[0],MAP_ORDER[0]);
});
test('3 points per arena win, 1 per knockout',()=>{
  const c=mk();
  const gain=scoreStage(c,res(4,2,[1,0,2,3]));
  assert.deepEqual(gain,[1,0,5,3]);assert.deepEqual(c.total,[1,0,5,3]);assert.deepEqual(c.wins,[0,0,1,0]);assert.deepEqual(c.kos,[1,0,2,3]);
  assert.equal(CUP_POINTS.win,3);assert.equal(CUP_POINTS.ko,1);
});
test('scoring the same arena twice counts once (results screen can re-render)',()=>{
  const c=mk();scoreStage(c,res(4,0,[2,0,0,0]));const again=scoreStage(c,res(4,0,[2,0,0,0]));
  assert.deepEqual(c.total,[5,0,0,0]);assert.deepEqual(again,[5,0,0,0]);
  c.stage=1;scoreStage(c,res(4,1,[0,1,0,0]));assert.deepEqual(c.total,[5,4,0,0]);
});
test('a drawn arena scores knockouts only',()=>{
  const c=mk();scoreStage(c,res(4,-1,[1,1,0,0]));assert.deepEqual(c.total,[1,1,0,0]);assert.deepEqual(c.wins,[0,0,0,0]);
});
test('THE REPORTED BUG: the last arena winner is not automatically on top of the cup podium',()=>{
  const c=mk(4,2);
  c.total=[10,4,2,4];c.wins=[2,1,0,1];c.kos=[4,1,2,1];c.stage=1;c.counted=1;       // fighter 0 leads; fighter 3 wins the final arena
  const st=standings(c);
  assert.deepEqual(st.map(r=>r.id),[0,1,3,2],'ordered by points, not by who won last');
  assert.equal(st[0].rank,1);assert.deepEqual(champions(c),[0]);
});
test('tie-breaks: points, then arena wins, then knockouts',()=>{
  const c=mk();c.total=[6,6,6,0];c.wins=[1,2,1,0];c.kos=[3,0,1,0];
  assert.deepEqual(standings(c).map(r=>r.id),[1,0,2,3]);
  c.wins=[1,1,1,0];assert.deepEqual(standings(c).map(r=>r.id),[0,2,1,3],'same wins: more knockouts first');
});
test('a complete tie shares a rank and does not favour the lower seat number',()=>{
  const c=mk();c.total=[5,5,5,1];c.wins=[1,1,1,0];c.kos=[2,2,2,1];
  const st=standings(c);
  assert.deepEqual(st.map(r=>r.rank),[1,1,1,4],'competition ranking: 1,1,1,4');
  assert.ok(st.slice(0,3).every(r=>r.tied));assert.equal(st[3].tied,false);
  assert.deepEqual(champions(c).sort(),[0,1,2]);
});
test('fresh cup: everybody level, everybody champion until something is scored',()=>{
  const c=mk();assert.deepEqual(champions(c),[0,1,2,3]);assert.equal(isFinalStage(c),false);
  c.stage=c.order.length-1;assert.equal(isFinalStage(c),true);
});
test('rankMatch: winner first, then crowns, then knockouts, ties share a rank',()=>{
  const r=rankMatch({n:4,winner:2,crowns:[1,0,2,1],stats:[{kos:0},{kos:5},{kos:0},{kos:3}]});
  assert.deepEqual(r.map(x=>x.id),[2,3,0,1]);assert.deepEqual(r.map(x=>x.rank),[1,2,3,4]);
  const w=rankMatch({n:3,winner:1,crowns:[1,3,1],stats:[{kos:2},{kos:0},{kos:2}]});
  assert.equal(w[0].id,1);assert.deepEqual(w.slice(1).map(x=>x.rank),[2,2]);assert.ok(w[1].tied);
  const d=rankMatch({n:3,winner:-1,crowns:[0,0,0],stats:[]});assert.deepEqual(d.map(x=>x.rank),[1,1,1],'a draw ranks everyone level');
});
test('the winner outranks someone with more crowns only if the sim says so (winner is authoritative)',()=>{
  const r=rankMatch({n:2,winner:0,crowns:[1,1],stats:[{kos:0},{kos:9}]});assert.equal(r[0].id,0);
});
test('rankBy is stable and deterministic',()=>{
  const a=rankBy(5,i=>[i%2]),b=rankBy(5,i=>[i%2]);assert.deepEqual(a,b);assert.deepEqual(a.map(x=>x.id),[1,3,0,2,4]);
});
