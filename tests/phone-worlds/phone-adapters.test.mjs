import {runtime as scratch} from './royal-scratch-match-harness.mjs';
import {harness as roller} from './royal-roller-ruckus-harness.mjs';
import {runtime as twisted} from './royal-twisted-harness.mjs';
import {game as space,crate} from './space-bash-harness.mjs';
import {appHarness as blind} from './blind-crown-harness.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {game as ballistix} from './royal-ballistix-harness.mjs';
import {game as sumo} from './royal-sumo-harness.mjs';
const packet=(seq,x=0,y=0,buttons=0)=>({seq,x,y,buttons});
test('featured phone adapters compact sparse physical seats without changing mailbox identities',()=>{
 const s=sumo(),sp=s.c.CallbackPhoneGame;sp.assign(7,'Sparse Sumo');sp.start({activeSeatIds:[0,7]});s.sim().phase='fight';assert.equal(s.sim().n,2);assert.equal(s.sim().ownerOf(1),'remote');assert.equal(sp.phoneState(7).name,'Sparse Sumo');assert.equal(sp.phoneState(0),null);assert.equal(sp.input(7,packet(1,1,0,2)),true);s.step();assert.ok(Math.abs(s.sim().fighters[1].vx)>0);
 const t=twisted(),tp=t.game.CallbackPhoneGame;tp.assign(7,'Sparse Twisted');tp.start({activeSeatIds:[0,7]});t.run("phase='fight'");assert.equal(t.run('fighters.length'),2);assert.equal(tp.input(7,packet(1,0,0,1)),true);assert.ok(t.run('fighters[1].vy')>0);assert.equal(tp.phoneState(7).name,'Sparse Twisted');
 const r=roller(),rp=r.context.window.CallbackPhoneGame;rp.assign(7,'Sparse Roller');rp.start({activeSeatIds:[0,7]});r.run("phase='race'");assert.equal(r.run('racers.length'),2);assert.equal(rp.input(7,packet(1,1)),true);r.run('updatePlayer(racers[1],1/60)');assert.ok(r.run('racers[1].inputX')>0);assert.equal(rp.phoneState(7).name,'Sparse Roller');
 const c=scratch(),cp=c.g.CallbackPhoneGame;cp.assign(7,'Sparse Scratch');cp.start({activeSeatIds:[0,7]});assert.equal(c.run('players.length'),2);c.run("phase='response';phaseClock=gameClock()-1;songTime=1;notes=[{id:0,time:1,lanes:[0],responses:players.map(()=>({hits:new Set(),errors:[],resolved:false}))}]");assert.equal(cp.input(7,packet(1,0,0,1)),true);assert.ok(c.run('players[1].score')>0);assert.equal(cp.phoneState(7).name,'Sparse Scratch');
 const b=blind(),bp=b.c.CallbackPhoneGame;bp.assign(7,'Sparse Crown');bp.start({activeSeatIds:[0,7]});assert.equal(b.c.BlindCrownDebug.getState().players.length,2);assert.equal(bp.input(7,{...packet(1),plan:{x:.7,y:.6,a:.2,locked:true}}),true);assert.equal(bp.phoneState(7).name,'Sparse Crown');assert.equal(b.c.BlindCrownDebug.getState().players[1].name,'Sparse Crown');
});
test('Sumo phones own seats 0 and 9, move and dash, cancel safely, survive restart, release to bots',()=>{
 const g=sumo(),p=g.c.CallbackPhoneGame;assert.ok(p,'phone adapter');p.assign(0,'Zero');p.assign(9,'Nine');p.start();
 let s=g.sim();s.phase='fight';assert.equal(s.n,10);assert.equal(s.ownerOf(1),'bot');assert.equal(s.ownerOf(0),'remote');
 for(const id of [0,9])p.input(id,packet(1,1,0,2));g.step();for(const id of [0,9]){assert.ok(s.fighters[id].dashCd>0);assert.ok(Math.abs(s.fighters[id].vx)>0);}
 p.assign(0,'Zero');assert.equal(p.input(0,packet(1)),false);p.clear(0);assert.equal(p.input(0,packet(2)),true);
 const b=sumo(),bp=b.c.CallbackPhoneGame;bp.assign(9,'Nine');bp.start();b.sim().phase='fight';bp.input(9,packet(1,0,0,1));bp.input(9,packet(2));b.step();assert.equal(b.sim().fighters[9].bashSerial,1);
 p.pause();assert.equal(p.status().paused,true);p.resume();g.c.RoyalSumo.restart();assert.equal(g.sim().ownerOf(0),'remote');assert.equal(g.sim().fighters[0].name,'Zero');
 p.release(0);assert.equal(g.sim().ownerOf(0),'bot');assert.equal(p.input(0,packet(3,1)),false);p.stop();assert.equal(p.status().active,false);
});

test('Ballistix phones move 0/9, pulse once between frames, retain roster on round reset, return 0 to AI',()=>{
 const g=ballistix(2,123,{initial:true}),p=g.sandbox.CallbackPhoneGame;assert.ok(p,'phone adapter');p.assign(0,'Zero');p.assign(9,'Nine');p.start();g.G.phase='fight';
 for(const id of [0,9]){assert.equal(p.input(id,packet(1,1,0,2)),true);p.input(id,packet(2,1));}g.paddles(1/120);
 for(const id of [0,9]){assert.ok(g.P[id].pos>0);assert.ok(g.P[id].pulseCd>0);assert.equal(p.phoneState(id).name,id===0?'Zero':'Nine');}
 const cd=g.P[0].pulseCd;p.assign(0,'Zero');assert.equal(p.input(0,packet(2)),false);p.clear(0);assert.equal(p.input(0,packet(3)),true);assert.equal(g.P[0].pulseCd,cd);
 g.paddles(.3);p.input(0,packet(4,0,0,1));assert.equal(g.P[0].mag,true);p.pause();assert.equal(g.P[0].mag,false);p.resume();g.resetRound();assert.equal(p.phoneState(0).human,true);assert.equal(p.phoneState(1).human,false);
 p.release(0);g.input.keyAxis=1;g.G.phase='fight';g.paddles(1/120);assert.equal(g.P[0].pos,0);p.stop();assert.equal(p.status().active,false);
});

test('Scratch four phone lanes score once on edges, seat0 ignores local controls, roster updates do not reset notes',()=>{
 const g=scratch(),p=g.g.CallbackPhoneGame;assert.ok(p,'phone adapter');p.assign(0,'Zero');p.assign(9,'Nine');p.start();
 g.run("phase='response';phaseClock=gameClock()-1;songTime=1;notes=[{id:0,time:1,lanes:[0,1,2,3],responses:players.map(()=>({hits:new Set(),errors:[],resolved:false}))}]");
 for(const id of [0,9])for(let lane=0;lane<4;lane++){p.input(id,packet(lane*2+1,0,0,1<<lane));p.input(id,packet(lane*2+2));}
 assert.ok(g.run('players[0].score')>0);assert.ok(g.run('players[9].score')>0);const score=g.run('players[0].score');p.assign(0,'Zero');assert.equal(g.run('players[0].score'),score);assert.equal(g.run('notes.length'),1);
 g.run('tryHit(0)');assert.equal(g.run('players[0].score'),score);p.clear(0);assert.equal(p.input(0,packet(9)),true);p.pause();assert.equal(p.status().paused,true);p.resume();g.g.ScratchMatchAPI.replay();assert.equal(g.run('players[0].human'),true);assert.equal(g.run('players[0].name'),'Zero');assert.equal(g.run('players[1].human'),false);
 p.release(0);assert.equal(g.run('players[0].human'),false);p.stop();assert.equal(p.status().phase,'menu');
});

test('Roller phones steer 0/9, recover only after falls, retain owners, expose fitted overview and bounded radar',()=>{
 const g=roller(),p=g.context.window.CallbackPhoneGame;assert.ok(p,'phone adapter');p.assign(0,'Zero');p.assign(9,'Nine');p.start();g.run("phase='race';camera={position:new THREE.Vector3(),up:new THREE.Vector3(),aspect:1,fov:45,lookAt(){},updateProjectionMatrix(){}};");
 for(const id of [0,9]){p.input(id,packet(1,1));g.run(`updatePlayer(racers[${id}],1/60)`);assert.ok(g.run(`racers[${id}].inputX`)>0);g.run(`racers[${id}].falling=true`);p.input(id,packet(2,0,0,1));p.input(id,packet(3));assert.equal(g.run(`racers[${id}].recoveries`),1);}
 p.assign(0,'Zero');p.clear(0);assert.equal(p.input(0,packet(4)),true);p.pause();assert.equal(g.run('networkInputs[0].moveX'),0);p.resume();g.run('resetRace()');assert.equal(p.phoneState(0).name,'Zero');assert.equal(g.run('humanControl[0]'),true);assert.equal(g.run('humanControl[1]'),false);
 g.run('updateCamera(1/60)');assert.ok(g.run('camera.position.y')>100);const st=p.phoneState(9);assert.ok(st.radar.track.length<=64);assert.ok(JSON.stringify(st).length<8192);assert.equal(st.radar.racers.length,10);assert.ok(st.radar.bounds.maxX>st.radar.bounds.minX);
 p.release(0);g.run('keys.KeyD=true');assert.equal(g.run("samplePlayerInput(0).source"),'ai');assert.equal(g.run('humanControl[0]'),false);p.stop();assert.equal(p.status().active,false);
});

test('Twisted phones jump once and hold duck on 0/9, seat0 yields local controls, restart/release preserve ownership',()=>{
 const g=twisted(),p=g.game.CallbackPhoneGame;assert.ok(p,'phone adapter');p.assign(0,'Zero');p.assign(9,'Nine');p.start();g.run("phase='fight'");
 for(const id of [0,9]){p.input(id,packet(1,0,0,1));p.input(id,packet(2));assert.ok(g.run(`fighters[${id}].vy`)>0);assert.equal(g.run(`fighters[${id}].input.jumpBuffer`),0);}
 g.run('fighters[0].jumpY=0;fighters[0].vy=0');g.fire('keydown',{code:'Space'});assert.equal(g.run('fighters[0].vy'),0);p.input(0,packet(3,0,0,2));assert.equal(g.run('fighters[0].duck'),true);p.assign(0,'Zero');assert.equal(g.run('fighters[0].duck'),true);p.clear(0);assert.equal(g.run('fighters[0].duck'),false);assert.equal(p.input(0,packet(4)),true);
 p.pause();p.resume();g.game.RoyalTwisted.restart();assert.equal(g.run('fighters[0].controller'),'remote');assert.equal(g.run('fighters[9].name'),'Nine');assert.equal(g.run('fighters[1].controller'),'ai');p.release(0);assert.equal(g.run('fighters[0].controller'),'ai');p.stop();assert.equal(p.status().active,false);
});

test('Space phones move 0/9 and actuate grab/throw, kick, jump edges with CPU handoff and restart ownership',()=>{
 const g=space(),p=g.sandbox.CallbackPhoneGame;assert.ok(p,'phone adapter');p.assign(0,'Zero');p.assign(9,'Nine');p.start();g.phase='fight';g.crates=[];g.fighters.forEach((f,i)=>{f.x=i===9?2:-2;f.z=i===9?2:-2;f.think=100;});
 for(const id of [0,9]){p.input(id,packet(1,1));g.step(1/120);assert.ok(g.fighters[id].vx>0);p.input(id,packet(2,0,0,4));p.input(id,packet(3));assert.ok(g.fighters[id].vy>0);assert.equal(g.sandbox.SpaceBash.getState().stats[id].jumps,1);}
 const f=g.fighters[0];f.grounded=true;f.y=0;f.faceX=1;f.faceZ=0;g.crates=[crate({x:f.x+.4,z:f.z})];p.input(0,packet(4,0,0,1));assert.ok(f.carrying);p.input(0,packet(5));p.input(0,packet(6,0,0,1));assert.equal(f.carrying,null);assert.equal(g.sandbox.SpaceBash.getState().stats[0].throws,1);p.input(0,packet(7,0,0,2));assert.ok(f.kickCd>0);
 p.assign(0,'Zero');p.clear(0);assert.equal(p.input(0,packet(8)),true);p.pause();assert.equal(p.status().paused,true);p.resume();g.restartMatch();assert.equal(g.fighters[0].control,'remote');assert.equal(g.fighters[9].name,'Nine');assert.equal(g.fighters[1].control,'cpu');p.release(0);assert.equal(g.fighters[0].control,'cpu');g.fire('keydown',{code:'Space'});assert.equal(g.fighters[0].jumpCd,0);p.stop();assert.equal(p.status().active,false);
});

test('Blind seats0/9 place aim lock privately, public TV hides every planning coordinate, release/restart preserve roster',()=>{
 const g=blind(),p=g.c.CallbackPhoneGame;assert.ok(p,'phone adapter');p.assign(0,'Zero');p.assign(9,'Nine');p.start();
 for(const [id,x,y,a] of [[0,.2,.3,.25],[9,.8,.7,-.5]]){assert.equal(p.input(id,{...packet(1),plan:{x,y,a,locked:true}}),true);const s=p.phoneState(id);assert.equal(s.plan.locked,true);assert.equal(s.plan.a,a);assert.ok(s.board.geometry.walls.length>0);assert.equal(s.seat,id);assert.ok(!JSON.stringify(s).includes('seed'));assert.ok(!('players' in s));}
 let pub=g.c.BlindCrownDebug.getState();assert.equal(pub.players.length,10);assert.equal(pub.players[1].bot,true);assert.ok(pub.players.every(q=>!('x' in q)&&!('y' in q)&&!('a' in q)));assert.equal(pub.shots.length,0);
 const before=JSON.stringify(p.phoneState(0).plan);p.assign(0,'Zero');assert.equal(JSON.stringify(p.phoneState(0).plan),before);p.clear(0);assert.equal(p.input(0,{...packet(2),plan:{x:.3,y:.3,a:0,locked:false}}),true);p.pause();assert.equal(p.input(0,packet(3)),false);const clock=p.phoneState(0).clock;g.advance(10);assert.equal(p.phoneState(0).clock,clock);p.resume();assert.equal(p.input(0,packet(3)),true);
 p.release(0);assert.equal(p.phoneState(0),null);pub=g.c.BlindCrownDebug.getState();assert.equal(pub.players[0].bot,true);p.start();assert.equal(g.c.BlindCrownDebug.getState().players[9].bot,false);assert.equal(p.phoneState(9).name,'Nine');p.stop();assert.equal(p.status().active,false);assert.equal(g.nodes.get('onlineTab').hidden,true);
});

test('Sumo phone mode keeps ten contenders after native count change',()=>{
 const a=sumo(),ap=a.c.CallbackPhoneGame;ap.assign(9,'Nine');ap.start();a.c.RoyalSumo.restart({fighters:2});assert.equal(a.sim().n,10);assert.equal(a.sim().ownerOf(9),'remote');
});
test('Ballistix phone mode keeps ten contenders after native count change',()=>{
 const b=ballistix(2,123,{initial:true}),bp=b.sandbox.CallbackPhoneGame;bp.assign(9,'Nine');bp.start();b.sandbox.RoyalBallistix.setPlayerCount(2);b.restart();assert.equal(b.P.length,10);assert.equal(bp.phoneState(9).human,true);
});
test('Scratch phone mode keeps ten contenders after native count change',()=>{
 const c=scratch(),cp=c.g.CallbackPhoneGame;cp.assign(9,'Nine');cp.start();c.run('pendingSeats=2;newSession()');assert.equal(c.run('players.length'),10);assert.equal(c.run('players[9].human'),true);
});
test('Roller phone mode keeps ten contenders after native count change',()=>{
 const d=roller(),dp=d.context.window.CallbackPhoneGame;dp.assign(0,'Zero');dp.start();d.run("racerCountEl.value='2';resetRace()");assert.equal(d.run('racers.length'),10);
});
test('Twisted phone mode keeps ten contenders after native count change',()=>{
 const e=twisted(),ep=e.game.CallbackPhoneGame;ep.assign(9,'Nine');ep.start();e.run("playerCountEl.value='2';restartMatch()");assert.equal(e.run('fighters.length'),10);assert.equal(e.run('fighters[9].controller'),'remote');
});
test('Space phone mode keeps ten contenders after native count change',()=>{
 const f=space(),fp=f.sandbox.CallbackPhoneGame;fp.assign(9,'Nine');fp.start();f.preferences.players=2;f.applyMatchSetup();assert.equal(f.fighters.length,10);assert.equal(f.fighters[9].control,'remote');
});
test('Blind phone mode keeps ten contenders after native count change',()=>{
 const h=blind(),hp=h.c.CallbackPhoneGame;hp.assign(9,'Nine');hp.start();h.nodes.get('botSlider').value='1';h.nodes.get('startBtn').onclick();assert.equal(h.c.BlindCrownDebug.getState().players.length,10);assert.equal(h.c.BlindCrownDebug.getState().players[9].bot,false);
});

test('Sumo starts the newly selected map/rules and Cup with all phone owners',()=>{
 const g=sumo(),p=g.c.CallbackPhoneGame;p.assign(0,'Zero');p.assign(9,'Nine');p.start();const settings=g.c.RoyalSumo.debug.settings();settings.set('match.map','mesa');settings.set('match.mode','cup');settings.set('match.dash','off');p.start();assert.equal(g.sim().map.id,'mesa');assert.equal(g.sim().P.dashOn,false);assert.equal(g.c.RoyalSumo.debug.session().cup.n,10);assert.equal(g.sim().ownerOf(0),'remote');
});
test('Phone seat0 names survive native preferences/style changes and restarts',()=>{
 const b=ballistix(2,123,{initial:true}),bp=b.sandbox.CallbackPhoneGame;bp.assign(0,'Zero');bp.start();b.elements.get('#volume').oninput?.({target:{value:'30'}});assert.equal(bp.phoneState(0).name,'Zero');
 });
test('Twisted phone seat0 name survives restart',()=>{
 const t=twisted(),tp=t.game.CallbackPhoneGame;tp.assign(0,'Zero');tp.start();assert.equal(t.run('fighters[0].name'),'Zero');t.game.RoyalTwisted.restart();assert.equal(t.run('fighters[0].name'),'Zero');
});

test('Scratch held bits do not score a second beat until release and a new press edge',()=>{
 const g=scratch(),p=g.g.CallbackPhoneGame;p.assign(0,'Zero');p.start();const beat=()=>g.run("phase='response';phaseClock=gameClock()-1;songTime=1;notes=[{id:0,time:1,lanes:[0],responses:players.map(()=>({hits:new Set(),errors:[],resolved:false}))}]");beat();p.input(0,packet(1,0,0,1));const score=g.run('players[0].score');assert.ok(score>0);beat();p.input(0,packet(2,0,0,1));assert.equal(g.run('players[0].score'),score);assert.equal(g.run('notes[0].responses[0].hits.size'),0);p.input(0,packet(3));p.input(0,packet(4,0,0,1));assert.ok(g.run('players[0].score')>score);
});
test('Sumo stale clear cancels charge without producing a bash or resetting network order',()=>{
 const g=sumo(),p=g.c.CallbackPhoneGame;p.assign(0,'Zero');p.start();g.sim().phase='fight';p.input(0,packet(7,0,0,1));g.step();assert.equal(g.sim().fighters[0].charging,true);p.clear(0);g.step();assert.equal(g.sim().fighters[0].bashSerial,0);assert.equal(g.sim().fighters[0].charging,false);assert.equal(p.input(0,packet(6)),false);assert.equal(p.input(0,packet(8)),true);
});

test('Twisted can report assigned seat9 safely before the first ten-player start',()=>{
 const g=twisted(2),p=g.game.CallbackPhoneGame;g.run("createHazard('low',.97)");p.assign(9,'Nine');assert.equal(p.phoneState(9),null);p.start();assert.equal(p.phoneState(9).name,'Nine');
});

test('Sumo stop hands seats back to offline ownership and rejects retained phone metadata input',()=>{
 const g=sumo(),p=g.c.CallbackPhoneGame;p.assign(0,'Zero');p.assign(9,'Nine');p.start();p.stop();g.c.RoyalSumo.scenario({fighters:10,players:1});assert.equal(g.sim().ownerOf(0),'local');assert.equal(g.sim().ownerOf(9),'bot');assert.equal(p.input(9,packet(1,1)),false);p.start();assert.equal(g.sim().ownerOf(9),'remote');assert.equal(g.sim().fighters[9].name,'Nine');
});
test('Roller stop disconnects network seats so offline count/local steering work and phone restart retains names',()=>{
 const g=roller(),p=g.context.window.CallbackPhoneGame;p.assign(0,'Zero');p.assign(9,'Nine');p.start();p.input(0,packet(1,1));p.stop();g.run("racerCountEl.value='2';resetRace();readGamepad=()=>null;keys.KeyD=true");assert.equal(g.run('racers.length'),2);assert.equal(g.run('samplePlayerInput(0).source'),'keyboard');assert.equal(g.run('humanControl[9]'),false);assert.equal(p.input(9,packet(1,1)),false);p.start();assert.equal(g.run('racers[9].name'),'Nine');assert.equal(g.run('humanControl[9]'),true);
});
for(const route of ['settings','help'])test(`Ballistix native ${route} pause clears held phone movement/Magnet and preserves next sequence`,()=>{
 const g=ballistix(2,123,{initial:true}),p=g.sandbox.CallbackPhoneGame;p.assign(0,'Zero');p.start();g.G.phase='fight';p.input(0,packet(1,1,0,1));assert.equal(g.P[0].mag,true);
 const enter=route==='settings'?'#pauseSettings':'#help',leave=route==='settings'?'#close':'#helpClose';g.elements.get(enter).onclick();assert.equal(p.status().paused,true);assert.equal(g.P[0].mag,false);g.elements.get(leave).onclick();g.elements.get('#resume').onclick();const pos=g.P[0].pos;g.paddles(1/120);assert.equal(g.P[0].pos,pos);assert.equal(p.input(0,packet(2,0,0,1)),true);assert.equal(g.P[0].mag,true);
});
test('Roller native name and cosmetic preference handlers retain assigned seat0 name',()=>{
 const g=roller(),p=g.context.window.CallbackPhoneGame;p.assign(0,'Zero');p.start();g.run('applyPlayerStyle()');assert.equal(g.run('racers[0].name'),'Zero');
 for(const id of ['#playerName','#playerColor','#cageTrim','#helmetStyle','#volumeSetting']){const e=g.els.get(id);assert.ok(e);{e.value=id==='#playerName'?'Offline Name':id==='#volumeSetting'?'.3':e.value;for(const event of ['input','change','blur'])for(const fn of e.events[event]||[])fn({target:e});assert.equal(g.run('racers[0].name'),'Zero');}}
});
test('Space native volume, cosmetics, and direct name editing retain assigned seat0 name',()=>{
 const g=space(),p=g.sandbox.CallbackPhoneGame;p.assign(0,'Zero');p.start();
 for(const [id,value] of [['#volume','.3'],['#patch','star'],['#playerColor','#67e8f9']]){const e=g.element(id);e.value=value;e.onchange();assert.equal(g.fighters[0].name,'Zero');assert.equal(p.phoneState(0).name,'Zero');}
 const e=g.element('#playerName');e.value='Offline Name';for(const event of ['oninput','onblur','onchange']){e[event]();assert.equal(g.fighters[0].name,'Zero');}p.stop();g.sandbox.SpaceBash.setPlayers(2);e.value='Local Name';e.oninput();assert.equal(g.fighters[0].name,'Local Name');
});
