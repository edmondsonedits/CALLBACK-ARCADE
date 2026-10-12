import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { game, arena, crate } from './harness.mjs';
function invariant(g) {
 for(const f of g.fighters){for(const k of ['x','y','z','vx','vy','vz','hp'])assert.ok(Number.isFinite(f[k]),`fighter ${f.id} ${k}`);if(f.carrying){assert.ok(f.alive&&!f.falling);assert.ok(f.carrying.alive);assert.equal(f.carrying.held,f)}}
 for(const c of g.crates){for(const k of ['x','y','z','vx','vy','vz','fuse'])assert.ok(Number.isFinite(c[k]),`crate ${c.id} ${k}`);if(c.held){assert.ok(c.alive);assert.equal(c.held.carrying,c)}}
 assert.ok(g.particles.length<1000);assert.ok(g.crates.length<=16);
}
for(const n of [2,4,10])test(`${n} contestants: natural first-to-three match and terminal stability`,t=>{
 const g=game(900+n);g.sandbox.SpaceBash.setPlayers(n);const started=performance.now();let ticks=0,peakCrates=0,peakParticles=0;
 // Human seat intentionally idle; the real bots and hazards decide outcomes.
 for(;ticks<120*2400&&g.phase!=='match';ticks++){
  g.step(1/120);peakCrates=Math.max(peakCrates,g.crates.length);peakParticles=Math.max(peakParticles,g.particles.length);
  if(ticks%120===0)invariant(g);
 }
 assert.equal(g.phase,'match');assert.equal(Math.max(...g.wins),3);const wins=[...g.wins],round=g.round;g.advance(30);
 assert.equal(g.phase,'match');assert.equal(g.round,round);assert.deepEqual([...g.wins],wins);invariant(g);
 t.diagnostic(JSON.stringify({contestants:n,round,simulatedSeconds:ticks/120,wallMs:Math.round(performance.now()-started),peakCrates,peakParticles}));
});
for(const n of [2,4,10])test(`${n} contestants: ten rematches reset all owned state`,()=>{
 const g=arena(n);
 for(let cycle=0;cycle<10;cycle++){
  g.phase='fight';const f=g.fighters[0],c=crate({x:f.x+.3,z:f.z,type:'tnt',armed:true,fuse:.2});g.crates=[c];g.grabThrow(f);g.destroyTile(-2,-2);g.flash=.2;
  for(let crown=0;crown<3;crown++){g.phase='fight';g.finishRound(f)}assert.equal(g.phase,'match');
  g.restartMatch();assert.equal(g.phase,'countdown');assert.equal(g.round,1);assert.ok(g.wins.every(w=>w===0));assert.equal(g.tiles.filter(t=>t.alive).length,64);assert.equal(g.particles.length,0);assert.equal(g.flash,0);assert.equal(f.carrying,null);assert.equal(c.held,null);assert.ok(g.crates.every(c=>!c.armed&&!c.held));assert.equal(g.fighters.length,n);invariant(g);
 }
});
test('10 contestants: seeded input, collision and fuse stress over ten resets',()=>{
 const g=game(334);g.sandbox.SpaceBash.setPlayers(10);let ticks=0;
 for(let cycle=0;cycle<10;cycle++){
  g.restartMatch();g.advance(3.3);
  for(let i=0;i<120*20;i++,ticks++){
   if(g.phase==='fight'){
    g.joy.x=Math.sin(ticks*.023);g.joy.z=Math.cos(ticks*.029);
    if(i%43===0)g.grabThrow(g.fighters[0]);if(i%67===0)g.kick(g.fighters[0]);if(i%91===0)g.jump(g.fighters[0]);
   }
   g.step(1/120);if(i%120===0)invariant(g);
  }
 }
});
test('portrait and landscape deck footprint clears HUD and controls',()=>{
 const g=game();for(const [width,height,top,reserved] of [[390,844,128,195],[844,390,110,50],[360,640,128,165],[1280,800,128,195]]){
  g.sandbox.innerWidth=width;g.sandbox.innerHeight=height;g.resize();const b=g.board;
  assert.ok(b.cx-b.size*.48>=0&&b.cx+b.size*.48<=width);
  assert.ok(b.cy-b.size*.23>=top);assert.ok(b.cy+b.size*.23<=height-reserved);
 }
});
test('live canvas renderer executes with gameplay and warning states',()=>{
 const g=arena(10);g.fighters[0].land=.2;g.fighters[0].kickFx=.1;g.fighters[1].y=1;g.destroyTile(1.5,1.5);
 g.crates=[crate({type:'tnt',x:.4,fuse:.4,armed:true}),crate({id:2,type:'nitro',x:1,z:1,fuse:.2,armed:true})];
 g.frames.length=0;g.render();assert.equal(g.frames.length,1);g.frames.shift()();
 assert.notEqual(g.element('#bootError').classList.contains('open'),true);
});
