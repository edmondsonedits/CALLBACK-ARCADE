import test from 'node:test';import assert from 'node:assert/strict';
const ids=Array.from({length:10},(_,i)=>String(i).padStart(2,'0'));
test('all eight upgraded model games accept ten real inputs and preserve JSON continuation',async()=>{
 const m=await import('../lib/arcade/online/arena-engines').catch(()=>null);assert.ok(m?.ARENA_ONLINE_ENGINES,'authoritative arena adapters are missing');
 assert.equal(m.ARENA_ONLINE_ENGINES.length,8);
 for(const g of m.ARENA_ONLINE_ENGINES){const initial=g.create(ids,71,{duration:30},[]);const moving=g.step(initial,{'00':{seq:1,x:.8,y:.5,action:'special'}},[]);const idle=g.step(initial,{},[]);assert.notDeepEqual(moving,idle,g.id);const view=g.publicState(moving).view as {frame:{actors:unknown[]}};assert.equal(view.frame.actors.length,10,g.id);const restored=JSON.parse(JSON.stringify(moving));assert.deepEqual(g.step(restored,{'00':{seq:2,x:1,y:0}},ids.slice(1)),g.step(moving,{'00':{seq:2,x:1,y:0}},ids.slice(1)),g.id);}
});
