// Deterministic scenario runner shared by the golden-hash tests, the determinism tests and the legacy-baseline tool.
// It only needs a Sim class + FIXED_DT, so it runs unchanged against the old concatenated build and the ES modules.
const imul=Math.imul;
export class Hasher{
  constructor(){this.h=0x811c9dc5>>>0;this.n=0}
  int(v){v|=0;for(let i=0;i<4;i++){this.h^=(v>>>(i*8))&255;this.h=imul(this.h,0x01000193)>>>0}this.n++}
  num(v,k=1000){const r=Math.round(v*k);this.int(r>2147483647?2147483647:(r<-2147483648?-2147483648:r))}
  str(s){for(let i=0;i<s.length;i++)this.int(s.charCodeAt(i))}
  hex(){return this.h.toString(16).padStart(8,'0')}
}
/* tiny local PRNG so puppet inputs never touch the sim's own stream */
function lcg(seed){let s=seed>>>0;return()=>{s=(imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
const EV_NUM=['x','z','speed','force','dmg','imp','power','r'];
const EV_INT=['id','src','dst','a','b','by','winner','round','n','ring','wedge','idx'];
export function hashEvent(H,e){
  H.str(e.type);H.num(e.t,1000);
  for(const k of EV_INT)if(e[k]!==undefined&&typeof e[k]==='number')H.int(e[k]);
  for(const k of EV_NUM)if(e[k]!==undefined&&typeof e[k]==='number')H.num(e[k]);
  if(e.tier)H.str(e.tier);if(e.kind)H.str(String(e.kind));if(e.cause)H.str(e.cause);
}
export function hashState(H,sim){
  H.int(sim.round);H.str(sim.phase);H.num(sim.t,1000);
  for(const f of sim.fighters){
    H.int(f.id);H.num(f.x);H.num(f.z);H.num(f.y);H.num(f.vx);H.num(f.vz);H.num(f.stab,100);H.num(f.charge,100);
    H.int(f.alive?1:0);H.int(f.falling?1:0);H.int(f.down?1:0);H.str(f.state);
  }
  for(let i=0;i<sim.n;i++)H.int(sim.crowns[i]);
}
/* Puppet driver: fixed pseudo-random stick/bash/dash changes for human-owned seats. */
export function makePuppet(inputSeed){
  const r=lcg(inputSeed);
  return (inp,tick)=>{
    if(tick%14!==0)return;
    const a=r()*Math.PI*2,m=r()<.2?0:.4+r()*.6;
    inp.mx=Math.cos(a)*m;inp.mz=Math.sin(a)*m;
    inp.bashDown=r()<.45;
    if(r()<.07)inp.dash=true;
  };
}
/**
 * spec: {map,n,seed,difficulty,hazard,seconds,humans:[ids],inputSeed,opts}
 * make(spec) must return a started-or-unstarted Sim (see adapters). Returns {digest, checkpoints, events, finalRound, matchWinner}.
 */
export function runScenario(make,FIXED_DT,spec){
  const sim=make(spec);sim.startMatch();
  const H=new Hasher(),puppet=new Map();
  for(const id of spec.humans||[])puppet.set(id,makePuppet((spec.inputSeed||7)*131+id*17));
  const ticks=Math.round((spec.seconds||20)/FIXED_DT);let events=0;const checkpoints=[];
  for(let tick=0;tick<ticks;tick++){
    for(const [id,p] of puppet)p(sim.inputs[id],tick);
    sim.step(FIXED_DT);
    for(const e of sim.drain()){hashEvent(H,e);events++}
    if(tick%120===0)hashState(H,sim);
    if(tick%600===599)checkpoints.push(H.hex());
  }
  hashState(H,sim);
  return {digest:H.hex(),checkpoints,events,round:sim.round,phase:sim.phase,crowns:sim.crowns.slice(0,sim.n),matchWinner:sim.matchWinner,t:+sim.t.toFixed(3),
    fighters:sim.fighters.map(f=>({id:f.id,x:+f.x.toFixed(3),z:+f.z.toFixed(3),alive:f.alive}))};
}
/* The golden matrix: every map, small/medium/large crowds, bots-only and mixed human/bot seats, mixed difficulty ladder. */
export function goldenMatrix(MAP_ORDER){
  const out=[];let k=0;
  for(const map of MAP_ORDER){
    out.push({id:map+'-4-bots',map,n:4,seed:1000+k,difficulty:'normal',hazard:'normal',seconds:30,humans:[],inputSeed:1});
    out.push({id:map+'-4-human0',map,n:4,seed:2000+k,difficulty:'hard',hazard:'wild',seconds:30,humans:[0],inputSeed:2});
    out.push({id:map+'-8-mixed',map,n:8,seed:3000+k,difficulty:'mixed',hazard:'normal',seconds:30,humans:[0,3],inputSeed:3});
    out.push({id:map+'-2-legend',map,n:2,seed:4000+k,difficulty:'legend',hazard:'normal',seconds:25,humans:[],inputSeed:4,opts:{arena:.8,length:'short'}});
    k++;
  }
  return out;
}
