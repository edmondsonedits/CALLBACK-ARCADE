import assert from 'node:assert/strict';import test from 'node:test';
import {createShowdown,advanceShowdown,showdownScoreEvents} from '../server/arcade/sketch_showdown';
import {applyWorkshop,workshop,beginWorkshopClose,workshopPoints,workshopSnapshot} from '../server/sorcery/workshop';
const fresh=()=>{let m=createShowdown({matchId:'workshop',players:['a','b','c'],now:1,rulesVersion:4});m=advanceShowdown(m,m.deadline).state;m=advanceShowdown(m,m.deadline).state;return m;};
const req=(m:ReturnType<typeof fresh>,type:'issue'|'choose'|'lease',extra:object={})=>({actionId:crypto.randomUUID(),matchId:m.matchId,round:m.round,type,...extra});
test('reward is capped, timed, owner-bound and reproduced by normal score events',()=>{
 const m=fresh();m.phase='transforming';let now=m.updatedAt;
 for(let i=0;i<3;i++){
  applyWorkshop(m,'a','owner-a',req(m,'issue'),now);const b=workshop(m).ballots.at(-1)!;
  assert.throws(()=>applyWorkshop(m,'a','owner-a',req(m,'choose',{ballotId:b.id,choice:b.options[0]}),now+9999));
  applyWorkshop(m,'a','owner-a',req(m,'choose',{ballotId:b.id,choice:b.options[0]}),now+10000);
  applyWorkshop(m,'a','owner-a',req(m,'choose',{ballotId:b.id,choice:b.options[0]}),now+10001);now+=10002;
 }
 assert.equal(workshopPoints(m,'a'),50);
 assert.equal(showdownScoreEvents(m).filter(e=>e.kind==='SKETCH_WORKSHOP').reduce((n,e)=>n+e.points,0),50);
 assert.throws(()=>applyWorkshop(m,'b','owner-a',req(m,'issue'),now));
 assert.equal(workshopSnapshot(m,'b',now)?.ballot,undefined);
});
test('shared closing hold is ten seconds once, never per editor or reconnect',()=>{
 const m=fresh();workshop(m).leases=[{actor:'a',until:m.updatedAt+15000},{actor:'b',until:m.updatedAt+15000}];
 assert.equal(beginWorkshopClose(m,m.updatedAt),true);const end=workshop(m).closeUntil;
 assert.equal(end,m.updatedAt+10000);assert.equal(beginWorkshopClose(m,m.updatedAt+1000),false);assert.equal(workshop(m).closeUntil,end);
});
test('issued ballot text survives catalogue changes and old missing IDs cannot break snapshots',()=>{
 const m=fresh();m.phase='transforming';applyWorkshop(m,'a','owner-a',req(m,'issue'),m.updatedAt);
 const b=workshop(m).ballots[0]!;const original=b.optionTexts![0];b.options[0]='removed-catalogue-id';
 assert.equal(workshopSnapshot(m,'a',m.updatedAt)?.ballot?.options[0]?.text,original);
 delete b.optionTexts;assert.equal(workshopSnapshot(m,'a',m.updatedAt)?.ballot?.options[0]?.text,'An archived prompt');
});
test('a drawing deadline with missing submissions does not grant an editor extension',()=>{
 const m=fresh();assert.equal(m.phase,'drawing');workshop(m).leases=[{actor:'a',until:m.deadline+15000}];
 const next=advanceShowdown(m,m.deadline).state;assert.equal(next.phase,'transforming');assert.equal(workshop(next).closeUntil,null);
});
test('Hall nominations reject practice and bot artwork, accept real human art once, and never change points',()=>{
 const m=fresh(),now=m.updatedAt;m.phase='round-results';m.deadline=now+30000;workshop(m).intermissionRound=m.round;
 const c=m.chains.find(c=>c.round===m.round&&c.originalPlayerId==='b')!;
 c.drawing={playerId:'b',practice:true,submittedAt:now,image:{status:'MISSING'}};
 const nominate=()=>applyWorkshop(m,'a','', {actionId:crypto.randomUUID(),matchId:m.matchId,round:m.round,type:'nominate',choice:c.chainId},now);
 assert.throws(nominate,/INVALID_NOMINATION/);
 c.drawing={playerId:'b',assetId:'human-upload',submittedAt:now,source:{assetId:'human-upload',objectKey:'rooms/test/upload',width:32,height:32,byteSize:100,contentType:'image/png'},image:{status:'FALLBACK',assetId:'human-upload'}};
 m.botIds=['b'];assert.throws(nominate,/INVALID_NOMINATION/);m.botIds=[];
 const scores={...m.scores};nominate();assert.throws(nominate,/NOMINATION_LOCKED/);assert.deepEqual(m.scores,scores);
});
