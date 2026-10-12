import {test} from 'node:test';
import assert from 'node:assert/strict';
import {QualityGovernor} from '../../src/core/quality.js';

/* Virtual-time harness. `cost(k)` returns seconds per frame at render scale k (pixel cost ~ k^2), `vsync` caps the rate. */
function run(gov,seconds,{cost,vsync=1/60,active=()=>true,onStep}={}){
  let t=0;const steps=[];
  while(t<seconds){
    const dt=Math.max(vsync,cost?cost(gov.k):0);
    t+=dt;
    const k=gov.update(dt,active(t));
    if(k!==null){steps.push({t:+t.toFixed(1),k});if(onStep)onStep(t,k)}
  }
  return steps;
}
const heavy=k=>.008+.040*k*k;          // 1.0 -> 48 ms (21 fps); 0.8 -> 33.6 ms (30 fps); 0.7 -> 27.6 ms (36 fps); 0.6 -> 22 ms (45 fps)
const light=k=>.004+.004*k*k;

test('a healthy 60 fps game is never touched',()=>{
  const g=new QualityGovernor();const steps=run(g,120,{cost:light});
  assert.equal(steps.length,0);assert.equal(g.k,1);
});
test('sustained slowness steps resolution down in small steps and stops when fps is fine',()=>{
  const g=new QualityGovernor();const steps=run(g,60,{cost:heavy});
  assert.ok(steps.length>=2,'stepped down at least twice: '+JSON.stringify(steps));
  assert.ok(steps.every((s,i)=>i===0||s.k<steps[i-1].k),'monotonic while overloaded');
  assert.ok(g.k<1&&g.k>=g.min);
  const fps=1/heavy(g.k);assert.ok(fps>=36,'ended at a playable frame rate: '+fps.toFixed(1)+' fps at k='+g.k);
});
test('it never goes below the floor, however bad things get',()=>{
  const g=new QualityGovernor();run(g,300,{cost:k=>.05+.1*k*k});
  assert.ok(g.k>=g.min-1e-9);assert.equal(g.k,g.min);
});
test('recovery: when the load goes away it climbs back to full resolution, without oscillating',()=>{
  const g=new QualityGovernor();let load=heavy;
  run(g,60,{cost:k=>load(k)});const low=g.k;assert.ok(low<1);
  load=light;const steps=run(g,90,{cost:k=>load(k)});
  assert.equal(g.k,1,'back to full');assert.ok(steps.every((s,i)=>i===0||s.k>steps[i-1].k),'only upward: '+JSON.stringify(steps));
});
test('a step up that does not hold is undone, and every retry waits longer than the last',()=>{
  const g=new QualityGovernor();
  // smooth cost curve: k=1 -> 22 fps, 0.9 -> 33 fps (still too slow), 0.8 or less -> 71 fps
  const cost=k=>k>=.95?.045:(k>=.85?.030:.014);
  const steps=run(g,500,{cost});
  assert.equal(steps[0].k,.9);assert.equal(steps[1].k,.8,'finds the playable level');
  const ups=steps.filter((s,i)=>i>0&&s.k>steps[i-1].k);
  assert.ok(ups.length>=2&&ups.length<=6,'a few probing attempts, not a flap: '+JSON.stringify(steps));
  const gaps=ups.slice(1).map((u,i)=>u.t-ups[i].t);
  assert.ok(gaps.every((x,i)=>i===0||x>=gaps[i-1]*1.5),'exponential back-off between retries: '+gaps.map(x=>x.toFixed(0)));
  assert.ok(g.k<=.9+1e-9,'does not live at the level that stutters');
});
test('a display refresh cap is not mistaken for slowness: the step is undone and retried only with back-off',()=>{
  const g=new QualityGovernor();                  // 30 Hz low-power mode: fps is 30 whatever the resolution
  const steps=run(g,600,{cost:()=>0,vsync:1/30});
  let lowTime=0,t=0,k=1;for(const s of steps){lowTime+=(k<1?s.t-t:0);t=s.t;k=s.k}if(k<1)lowTime+=600-t;
  assert.equal(g.k,1,'ends at full resolution');
  assert.ok(lowTime<60,'spent less than 10% of the time at reduced resolution: '+lowTime.toFixed(1)+' s, steps '+JSON.stringify(steps.slice(0,8)));
});
test('menus, pauses, hidden tabs and long gaps are not slow frames',()=>{
  const g=new QualityGovernor();
  for(let i=0;i<500;i++)assert.equal(g.update(.1,false),null);                 // inactive
  for(let i=0;i<50;i++)assert.equal(g.update(5,true),null);                    // tab came back after 5 s
  assert.equal(g.k,1);assert.equal(g.changes,0);
});
test('isolated hitches (one long frame a second) do not trigger a step down',()=>{
  const g=new QualityGovernor();let t=0,n=0;
  while(t<120){const dt=(n++%60===0)?.4:1/60;t+=dt;g.update(dt,true)}
  assert.equal(g.k,1);
});
test('resuming from a pause waits for the settle period before judging anything',()=>{
  const slowAfterResume=settle=>{
    const g=new QualityGovernor({settle});
    for(let i=0;i<30;i++)g.update(1/60,true);
    g.update(.016,false);                                                      // pause
    let changed=0;for(let i=0;i<23;i++)if(g.update(.1,true)!==null)changed++;  // 2.3 s of slow frames right after resuming
    return changed;
  };
  assert.equal(slowAfterResume(.8),0,'default settle swallows the first 0.8 s');
  assert.equal(slowAfterResume(0),1,'without a settle the same frames would have cost resolution');
});
test('turning Auto Quality off returns to full resolution immediately and stays there',()=>{
  const g=new QualityGovernor();run(g,60,{cost:heavy});assert.ok(g.k<1);
  assert.equal(g.setEnabled(false),true,'reports that the multiplier changed');assert.equal(g.k,1);
  const steps=run(g,60,{cost:heavy});assert.equal(steps.length,0);assert.equal(g.k,1);
  assert.equal(g.setEnabled(false),false,'no change when already off');
});
test('turning it back on starts again from full resolution',()=>{
  const g=new QualityGovernor();run(g,60,{cost:heavy});g.setEnabled(false);
  assert.equal(g.setEnabled(true),false);assert.equal(g.k,1);
  run(g,60,{cost:heavy});assert.ok(g.k<1,'adaptive again');
});
test('output steps are tidy: two decimals, inside [min,max]',()=>{
  const g=new QualityGovernor({min:.55,step:.15});const steps=run(g,200,{cost:k=>.05});
  for(const s of steps){assert.equal(s.k,Math.round(s.k*100)/100);assert.ok(s.k>=.55&&s.k<=1)}
  assert.ok(g.info().k===g.k);
});
test('bad input never throws or moves anything',()=>{
  const g=new QualityGovernor();
  for(const dt of [NaN,-1,0,Infinity,undefined,null])assert.equal(g.update(dt,true),null);
  assert.equal(g.k,1);
});
