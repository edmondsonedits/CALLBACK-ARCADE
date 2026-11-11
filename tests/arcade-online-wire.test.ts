import test from 'node:test';import assert from 'node:assert/strict';
const ids=Array.from({length:10},(_,i)=>String(i).padStart(2,'0'));
test('Site-hosted realtime adapters retain ten seats and work without external Worker bindings',async()=>{const m=await import('../lib/arcade/online/wire-engines').catch(()=>null);assert.ok(m?.WIRE_ONLINE_ENGINES,'hosted transport adapters are missing');for(const g of m.WIRE_ONLINE_ENGINES){let s=g.create(ids,19,{},[]);for(let i=1;i<8;i++)s=g.step(s,{'09':{seq:i,x:.5,y:-.5,action:'tap'}},ids.slice(0,9));const publicView=g.publicState(s).view as {snapshot:{state:{players?:string[];racers?:unknown[];riders?:unknown[]}}};const state=publicView.snapshot.state;assert.equal((state.players??state.racers??state.riders)!.length,10,g.id);assert.deepEqual(g.step(JSON.parse(JSON.stringify(s)),{},ids),g.step(s,{},ids),g.id);}});

test('hosted Air Hockey completes a tied match at its native deadline without rejecting the final simulation tick',async()=>{
 const {WIRE_ONLINE_ENGINES}=await import('../lib/arcade/online/wire-engines'),game=WIRE_ONLINE_ENGINES.find(g=>g.id==='air-hockey')!;
 let state=game.create(ids,19,{},[]);for(let tick=1;tick<=2700;tick++)state=game.step(state,{},[]);
 const result=game.publicState(state);assert.equal(result.finished,true);assert.deepEqual(result.winners,[]);assert.ok(Object.values(result.scores).every(score=>score===0));
 assert.deepEqual(game.step(JSON.parse(JSON.stringify(state)),{},[]),state,'terminal simulation ticks must be idempotent');
});
