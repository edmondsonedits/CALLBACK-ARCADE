// Quantified game-feel metrics, measured on the real Sim (no rendering): how long things take, in sim seconds.
// Used by test/unit/feel.test.js (budgets) and tools/feel.mjs (prints the table).
import {Sim} from '../../src/core/sim.js';
import {FIXED_DT,TUNE} from '../../src/core/tune.js';

function fresh(n=2,over={}){
  const s=new Sim(Object.assign({map:'keep',fighters:n,difficulty:'normal',hazard:'off',seed:7,humans:Array.from({length:n},(_,i)=>i),assist:0},over));
  s.startMatch();
  let guard=0;while(s.phase!=='fight'&&guard++<2000){s.step(FIXED_DT);s.drain()}
  for(const f of s.fighters){f.vx=f.vz=0}
  return s;
}
const tick=(s,inp,i=0)=>{Object.assign(s.inputs[i],inp);s.step(FIXED_DT);s.drain()};
function park(s){ // isolate fighter 0 at the centre, everyone else far away on solid ground is not possible; put rivals in the ring edge and freeze AI-free
  s.fighters[0].x=0;s.fighters[0].z=0;s.fighters[0].vx=s.fighters[0].vz=0;
  if(s.fighters[1]){s.fighters[1].x=0;s.fighters[1].z=-4.2;s.fighters[1].vx=s.fighters[1].vz=0}
}
export function measureFeel(){
  const out={};
  // 1. acceleration: 0 -> 90% of top speed, and the speed it settles at
  {const s=fresh();park(s);const top=TUNE.maxSpeed;let t=0,t90=-1;
    for(let k=0;k<240;k++){tick(s,{mx:1,mz:0});t+=FIXED_DT;if(t90<0&&s.fighters[0].vx>=.9*top)t90=t;s.fighters[0].x=Math.min(s.fighters[0].x,1.5)}
    out.timeTo90Speed=+t90.toFixed(3);out.topSpeed=+s.fighters[0].vx.toFixed(2)}
  // 2. stopping: stick released at top speed -> below 10% speed
  {const s=fresh();park(s);for(let k=0;k<120;k++){tick(s,{mx:1,mz:0});s.fighters[0].x=0}
    let t=0,t10=-1,dist=0;const x0=s.fighters[0].x;
    for(let k=0;k<240;k++){tick(s,{mx:0,mz:0});t+=FIXED_DT;if(t10<0&&Math.abs(s.fighters[0].vx)<=.1*TUNE.maxSpeed)t10=t}
    out.timeToStop=+t10.toFixed(3);out.stopDistance=+(s.fighters[0].x-x0).toFixed(2)}
  // 3. reversing: full speed east -> crossing zero when the stick flips west
  {const s=fresh();park(s);for(let k=0;k<120;k++){tick(s,{mx:1,mz:0});s.fighters[0].x=0}
    let t=0,tz=-1;for(let k=0;k<240;k++){tick(s,{mx:-1,mz:0});t+=FIXED_DT;if(tz<0&&s.fighters[0].vx<=0)tz=t}
    out.timeToReverse=+tz.toFixed(3)}
  // 4. tap bash: press+release in consecutive ticks -> first tick the strike is active; and when its hit window closes
  {const s=fresh();park(s);const f=s.fighters[0];let t=0,tStart=-1,tEnd=-1;
    tick(s,{bashDown:true});t+=FIXED_DT;
    for(let k=0;k<200;k++){tick(s,{bashDown:false});t+=FIXED_DT;if(tStart<0&&f.bashT>0)tStart=t;if(tStart>0&&f.bashT===0){tEnd=t;break}}
    out.tapBashStartLatency=+tStart.toFixed(3);out.tapBashDuration=+(tEnd-tStart).toFixed(3)}
  // 5. charged bash: hold to full, then release
  {const s=fresh();park(s);const f=s.fighters[0];let t=0,tFull=-1;
    for(let k=0;k<300;k++){tick(s,{bashDown:true});t+=FIXED_DT;if(tFull<0&&f.chargeFull){tFull=t;break}}
    out.chargeToFull=+tFull.toFixed(3);
    tick(s,{bashDown:false});out.chargedBashActiveAfterRelease=f.bashT>0}
  // 6. dash: distance and duration, then cooldown
  {const s=fresh();park(s);const f=s.fighters[0];f.fx=1;f.fz=0;const x0=f.x;tick(s,{mx:1,mz:0,dash:true});let t=FIXED_DT;
    for(let k=0;k<200&&(f.dashT>0||k<2);k++){tick(s,{mx:1,mz:0});t+=FIXED_DT}
    out.dashDuration=+t.toFixed(3);out.dashDistance=+(f.x-x0).toFixed(2);out.dashCooldown=TUNE.dash.cd}
  // 7. knockback: victim displacement 1.2 s after a light tap and a full-charge bash (assist off, rival in reach)
  for(const [name,hold] of [['light',0],['full',1]]){
    const s=fresh();const a=s.fighters[0],b=s.fighters[1];a.x=0;a.z=0;a.fx=1;a.fz=0;b.x=1.0;b.z=0;b.vx=b.vz=0;b.stab=100;
    if(hold){for(let k=0;k<Math.round(TUNE.chargeTime/FIXED_DT)+4;k++){tick(s,{bashDown:true});a.x=0;a.vx=0}}
    else tick(s,{bashDown:true});
    const bx0=b.x;let hit=false;
    for(let k=0;k<Math.round(1.4/FIXED_DT);k++){tick(s,{bashDown:false});if(k>200)break;}
    out['knockback_'+name]=+(b.x-bx0).toFixed(2);out['stabLoss_'+name]=+(100-b.stab).toFixed(1)}
  return out;
}
