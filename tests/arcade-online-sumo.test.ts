import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { SUMO_ONLINE_ENGINE, type SumoOnlineState } from "../lib/arcade/online/sumo";
import { persistSumoSim, restoreSumoSim } from "../lib/arcade/online/sumo-codec";
import { Sim, MAPS, FIXED_DT, deriveSeed } from "../lib/arcade/online/sumo-core.mjs";
import type { OnlineInput } from "../lib/arcade/online/types";

const ids = Array.from({ length: 10 }, (_, i) => String(i).padStart(2, "0"));
const maps = ["keep", "floe", "plaza", "wharf", "teeter", "mesa"];
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function inputs(tick: number): Record<string, OnlineInput> {
  return Object.fromEntries(ids.map((id, i) => [id, {
    seq: tick, x: Math.cos((tick + i * 17) / 23), y: Math.sin((tick + i * 17) / 23),
    bashDown: tick % 41 < 22, dash: tick % 90 === i, action: tick % 67 === i ? "bash" : undefined,
  }]));
}
function run(state: SumoOnlineState, from: number, count: number, bots: string[] = []): SumoOnlineState {
  for (let i = from; i < from + count; i++) state = SUMO_ONLINE_ENGINE.step(state, inputs(i), bots) as SumoOnlineState;
  return state;
}

test("online Sumo seats all ten controllers and accepts movement, charge, release and dash", () => {
  let state = SUMO_ONLINE_ENGINE.create(ids, 291, { map: "teeter", winTarget: 1 }, []) as SumoOnlineState;
  assert.equal(restoreSumoSim(state.simulation).humanSlots.size, 10);
  state = run(state, 0, 102);
  const sim = restoreSumoSim(state.simulation);
  assert.equal(sim.phase, "fight");
  assert.equal(sim.fighters.length, 10);
  for (const f of sim.fighters) assert.equal(f.input, sim.inputs[f.id]);
  const before = sim.fighters.map(f => [f.x, f.z]);
  state = run(state, 102, 20);
  const after = restoreSumoSim(state.simulation);
  assert.ok(after.fighters.every((f, i) => f.x !== before[i][0] || f.z !== before[i][1]));
  assert.ok(after.fighters.some(f => f.bashSerial > 0 || f.dashSerial > 0 || f.charging));
});

for (const map of maps) test(`online Sumo preserves complete JSON continuation on ${map}`, () => {
  const bots = ids.slice(3);
  const first = SUMO_ONLINE_ENGINE.create(ids, 83782, { map, winTarget: 2, hazard: "wild" }, bots) as SumoOnlineState;
  assert.deepEqual(first, SUMO_ONLINE_ENGINE.create(ids, 83782, { map, winTarget: 2, hazard: "wild" }, bots));
  assert.notDeepEqual(first, SUMO_ONLINE_ENGINE.create(ids, 83783, { map, winTarget: 2, hazard: "wild" }, bots));
  const mid = run(first, 0, 540, bots);
  const hydrated = restoreSumoSim(copy(mid).simulation);
  assert.ok(hydrated.humanSlots instanceof Set);
  assert.equal(hydrated.humanSlots.size, 3);
  if (map === "keep") assert.ok((hydrated.arena?.rings as { dropAt: unknown }[]).every(r => r.dropAt instanceof Float32Array));
  assert.deepEqual(run(mid, 540, 300, bots), run(copy(mid), 540, 300, bots));
  assert.equal((SUMO_ONLINE_ENGINE.publicState(mid).view as { sim: { mapId: string } }).sim.mapId, map);
});

test("static online Sumo source matches native v1.3 physics and bot RNG on all six maps", async () => {
  // Dynamic evaluation is restricted to this test's pinned upstream comparison.
  const source = await readFile("public/arcade-games/royal-sumo/original/royal_sumo_crownfall_v1.3.0.html", "utf8");
  const core = source.slice(source.indexOf("/* ---- core/util.js ---- */"),source.indexOf("/* ---- core/slots.js ---- */"));
  const NativeSim = runInNewContext(`${core}\nM_core_sim.Sim`, { Math,Float32Array,Set }) as typeof Sim;
  for (const map of maps) {
    const options = {map,fighters:10,seed:7219,winTarget:2,hazard:"wild",slots:ids.map((_,i) => ({owner:i<3 ? "remote" : "bot",name:`P${i+1}`,style:i}))};
    const native = new NativeSim(options);native.startMatch();native.drain();
    let state = SUMO_ONLINE_ENGINE.create(ids,7219,options,ids.slice(3)) as SumoOnlineState;
    for (let tick=0;tick<660;tick++) {
      const command = inputs(tick);
      for (let seat=0;seat<3;seat++) {
        const c=command[ids[seat]],out=native.inputs[seat];
        out.mx=c.x;out.mz=c.y;const length=Math.hypot(out.mx,out.mz);if(length>1){out.mx/=length;out.mz/=length;}
        out.bashDown=c.bashDown===true;out.bashPower=c.action==="bash" ? .35 : -1;out.dash=c.dash===true;
      }
      for (let sub=0;sub<4;sub++) native.step(FIXED_DT);
      native.drain();state=SUMO_ONLINE_ENGINE.step(state,command,ids.slice(3)) as SumoOnlineState;
      if(state.finished)break;
    }
    // VM arrays have a separate prototype; compare their exact JSON-persisted values.
    assert.deepEqual(copy(state.simulation.data),copy(persistSumoSim(native).data),map);
  }
});

function endRound(state:SumoOnlineState,winner:number):SumoOnlineState {
  const sim=restoreSumoSim(state.simulation);sim.phase="fight";sim.endRound(winner);
  return {...state,simulation:persistSumoSim(sim)};
}
test("quick Sumo publishes crowns during rounds and terminates only at native matchend", () => {
  let state = SUMO_ONLINE_ENGINE.create(ids,923,{winTarget:2},ids) as SumoOnlineState;
  state=endRound(state,4);
  assert.equal(SUMO_ONLINE_ENGINE.publicState(state).finished,false);
  assert.equal(SUMO_ONLINE_ENGINE.publicState(state).scores["04"],1);
  for(let i=0;i<80;i++) state=SUMO_ONLINE_ENGINE.step(state,{},ids) as SumoOnlineState;
  assert.equal(restoreSumoSim(state.simulation).phase,"intro");
  assert.equal(state.finished,false);
  state=endRound(state,4);
  for(let i=0;i<80&&!state.finished;i++) state=SUMO_ONLINE_ENGINE.step(state,{},ids) as SumoOnlineState;
  assert.deepEqual(SUMO_ONLINE_ENGINE.publicState(state).winners,["04"]);
  assert.equal(SUMO_ONLINE_ENGINE.publicState(state).scores["04"],2);
  assert.equal(restoreSumoSim(state.simulation).phase,"matchend");
  assert.deepEqual(SUMO_ONLINE_ENGINE.step(copy(state),{},ids),state);
});
test("Crown Cup plays six original stages, scores win plus KOs and preserves tied champions", () => {
  let state=SUMO_ONLINE_ENGINE.create(ids,821,{mode:"cup",map:"wharf"},ids) as SumoOnlineState;
  const order=["wharf","teeter","mesa","keep","floe","plaza"];
  for(let stage=0;stage<6;stage++) {
    const sim=restoreSumoSim(state.simulation);
    assert.equal(sim.map.id,order[stage]);assert.equal(sim.winTarget,1);
    assert.equal(sim.seed,stage===0?821:deriveSeed(821,stage));
    // Three wins and one knockout each yield a final shared 10-point first place.
    if(stage<2){sim.stats[stage].kos=1;state={...state,simulation:persistSumoSim(sim)};}
    state=endRound(state,stage%2);
    for(let i=0;i<80&&!state.finished&&state.cup?.stage===stage;i++) state=SUMO_ONLINE_ENGINE.step(state,{},ids) as SumoOnlineState;
    assert.equal(state.finished,stage===5);
    assert.equal(state.cup?.history.length,stage+1);
    if(stage<5) assert.deepEqual(SUMO_ONLINE_ENGINE.step(state,{},ids),SUMO_ONLINE_ENGINE.step(copy(state),{},ids));
  }
  const result=SUMO_ONLINE_ENGINE.publicState(state);
  assert.deepEqual(result.winners,["00","01"]);assert.equal(result.scores["00"],10);assert.equal(result.scores["01"],10);
  assert.equal(state.cup?.history[0].gain[0],4);
  assert.deepEqual(SUMO_ONLINE_ENGINE.step(state,{},ids),state);
});

test("online Sumo consumes action edges once and restores bot ownership without stale human input", () => {
  let state = SUMO_ONLINE_ENGINE.create(ids, 27, { map: "plaza", hazard: "off" }, []) as SumoOnlineState;
  state = run(state, 0, 100);
  state = SUMO_ONLINE_ENGINE.step(state, { "00": { seq: 101, x: 1, y: 0, dash: true } }, []) as SumoOnlineState;
  assert.equal(restoreSumoSim(state.simulation).fighters[0].dashSerial, 1);
  const held = { "00": { seq: 101, x: 1, y: 0, dash: true } };
  for (let i = 0; i < 80; i++) state = SUMO_ONLINE_ENGINE.step(state, held, []) as SumoOnlineState;
  assert.equal(restoreSumoSim(state.simulation).fighters[0].dashSerial, 1);
  state = SUMO_ONLINE_ENGINE.step(state, {}, ["00"]) as SumoOnlineState;
  assert.equal(restoreSumoSim(state.simulation).seats[0].owner, "bot");
  state = SUMO_ONLINE_ENGINE.step(copy(state), {}, []) as SumoOnlineState;
  const sim = restoreSumoSim(state.simulation);
  assert.equal(sim.seats[0].owner, "remote");
  assert.equal(sim.inputs[0].mx, 0);
  assert.equal(sim.inputs[0].dash, false);
});

test("online renderer bridge keeps original scenes and guards all local simulation/result paths", async () => {
  const html = await readFile("public/arcade-games/royal-sumo/online-v65.html", "utf8");
  assert.ok(html.includes("window.CallbackOnlineView="));
  assert.ok(html.includes("if(running&&!onlineView)sim.advance(sdt)"));
  assert.ok(html.includes("if(onlineView)return;"));
  assert.ok(html.includes("function showOnlineResults(snapshot)"));
  for (const map of maps) assert.ok(html.includes(`SCENES.${map}`), map);
});

test("authoritative renderer applies snapshots without physics and preserves keep GPU tile references", async () => {
  const html = await readFile("public/arcade-games/royal-sumo/online-v65.html", "utf8");
  const bridge = html.slice(html.indexOf("/* Same-origin host snapshots own physics"),html.indexOf("/* ------------------------------------------------------------- boot ------ */"));
  const frame = html.slice(html.indexOf("function frame(ts){"),html.indexOf("function showResults(){",html.indexOf("function frame(ts){")));
  const shown:Record<string,unknown>[]=[];
  let advances=0;
  const harness = runInNewContext(`
    let sim=null,onlineView=false,onlineSnapshot=null,onlineTick=-1,onlineResultShown=false;
    let mode='game',paused=false,matchEndT=-1,hitStop=0,slowT=0,gfxDead=false,lastT=.99,time=0,fpsAcc=0,fpsN=0,fps=60,renderScale=1,slowK=1;
    const scene=null;
    const uiRoot={querySelector:()=>null};
    const R={cam:{},beginFrame:()=>{},updateCamera:()=>{}};
    const safe=f=>f(),dropScene=()=>{},rebuildScene=()=>{},fillView=()=>{},route=()=>{},focusPoint=()=>null;
    const gv=(key,fallback)=>key==='gfx.auto'?false:fallback;
    const requestAnimationFrame=()=>{};
    const readInput=()=>{throw Error('local inputs reached online frame')};
    const beltOf=(f,i)=>String(i),Controls={setHud:()=>{}},UI={show:()=>{},showPause:()=>{},showResults:show},Sound={intensity:()=>{}};
    ${bridge}\n${frame}
    ({apply:window.CallbackOnlineView.apply,frame,getSim:()=>sim})
  `,{MAPS,Sim,Float32Array,Set,ArrayBuffer,window:{},show:(result:Record<string,unknown>)=>shown.push(result)}) as {
    apply(snapshot:unknown):boolean;frame(ts:number):void;getSim():Sim;
  };
  let state=SUMO_ONLINE_ENGINE.create(ids,922,{map:"keep",winTarget:1},ids) as SumoOnlineState;
  const snapshot=()=>({...SUMO_ONLINE_ENGINE.publicState(state),players:[{id:"00",name:"Ada"}]});
  assert.equal(harness.apply(snapshot()),true);
  const sim=harness.getSim(),arena=sim.arena!,ring=(arena.rings as Record<string,unknown>[])[0];
  const batch={gpu:"kept"};ring.batch=batch;ring.fxd=new Uint8Array(Number(ring.S));
  sim.advance=()=>{advances++;};
  harness.frame(1000);assert.equal(advances,0);
  assert.equal(sim.fighters[0].name,"Ada");
  assert.equal(harness.apply(snapshot()),false);
  state=SUMO_ONLINE_ENGINE.step(state,{},ids) as SumoOnlineState;
  assert.equal(harness.apply(snapshot()),true);
  assert.equal(harness.getSim(),sim);assert.equal(sim.arena,arena);
  assert.equal((sim.arena!.rings as Record<string,unknown>[])[0].batch,batch);
  state=endRound(state,0);
  for(let i=0;i<80&&!state.finished;i++)state=SUMO_ONLINE_ENGINE.step(state,{},ids) as SumoOnlineState;
  assert.equal(harness.apply(snapshot()),true);
  assert.equal(shown.length,1);assert.equal(shown[0].winner,0);
  assert.deepEqual(copy(shown[0].ranking),copy((SUMO_ONLINE_ENGINE.publicState(state).view as {ranking:unknown}).ranking));
});
