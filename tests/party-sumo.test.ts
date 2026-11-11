import assert from "node:assert/strict";
import test from "node:test";
import { createSumoParty, controlSumoParty, stepSumoParty, checkpointSumoParty, restoreSumoParty } from "../lib/party/sumo-runtime";
import { FIXED_DT } from "../lib/arcade/online/sumo-core.mjs";

const roster=[{id:"00",name:"Ada",memberId:"u1"},{id:"01",name:"Bo",memberId:"u2"}];
const create=()=>createSumoParty({partyId:"p1",roomCode:"ABCD",matchId:"m1",roster,options:{map:"keep"},now:1000});

test("host-controlled lifecycle counts down and advances original Sumo in two 120Hz substeps per frame", () => {
  const party=create();
  assert.equal(controlSumoParty(party,"host",{operation:"start",seq:1,epoch:party.epoch},1000).ok,true);
  assert.equal(party.phase,"COUNTDOWN");
  stepSumoParty(party,1200);
  assert.equal(party.simulation,null);
  stepSumoParty(party,4200);
  assert.equal(party.phase,"PLAYING");
  assert.ok(party.simulation);
  for(let t=4217;t<=7500;t+=17)stepSumoParty(party,t);
  party.inputs["00"]={seq:1,x:1,y:0,bashDown:false,dash:false,receivedAt:7500};
  for(let t=7517;t<=9000;t+=17)stepSumoParty(party,t);
  const simTimeBefore=party.liveSimulation!.t;
  const before={x:party.liveSimulation!.fighters[0]!.x,z:party.liveSimulation!.fighters[0]!.z};
  party.inputs["00"]={seq:2,x:1,y:0,bashDown:false,dash:false,receivedAt:9000};
  stepSumoParty(party,9017);
  assert.ok(Math.abs(party.liveSimulation!.t-simTimeBefore-2*FIXED_DT)<1e-9);
  const after=party.liveSimulation!.fighters[0]!;
  assert.ok(after.x!==before.x || after.z!==before.z);
});

test("stale human controls neutralize after 200ms while vacant seats use native bots", () => {
  const party=create();
  assert.equal(party.roster.length,10);
  assert.equal(party.roster.filter(seat=>seat.memberId!==null).length,2);
  controlSumoParty(party,"host",{operation:"start",seq:1,epoch:party.epoch},1000);stepSumoParty(party,4000);
  party.inputs["00"]={seq:1,x:1,y:0,bashDown:true,dash:false,receivedAt:4000};
  stepSumoParty(party,4201);
  assert.deepEqual(party.inputs["00"],{seq:1,x:0,y:0,bashDown:false,dash:false,receivedAt:4201});
  assert.ok(party.botIds.includes("02"));
});

test("paused and disconnected displays stop simulation; checkpoint restores unfinished match paused", () => {
  const party=create();party.phase="PLAYING";party.displayAttachedAt=1000;party.simulation=create().simulation;
  stepSumoParty(party,3101);
  assert.equal(party.paused,true);
  const saved=checkpointSumoParty(party,3101);
  const restored=restoreSumoParty(saved);
  assert.equal(restored.paused,true);
  assert.equal(restored.phase,"PLAYING");
  assert.deepEqual(restored.resultOutbox,[]);
});

test("match identity is stable across replay while result outbox survives lobby and checkpoint", () => {
  const party=create();
  controlSumoParty(party,"host",{operation:"start",seq:1,epoch:0},1000);stepSumoParty(party,4000);
  party.liveSimulation!.phase="matchend";party.liveSimulation!.matchWinner=0;party.liveSimulation!.crowns[0]=2;
  stepSumoParty(party,4017);
  assert.equal(party.phase,"RESULTS");
  const first=party.resultOutbox[0]!;
  assert.equal(first.matchId,"m1");
  assert.equal(first.eventKey,"sumo:p1:m1:1:result");
  controlSumoParty(party,"host",{operation:"lobby",seq:2,epoch:party.epoch},4100);
  controlSumoParty(party,"host",{operation:"start",seq:3,epoch:party.epoch},4200);
  assert.equal(party.matchId,"m1");
  assert.equal(party.resultOutbox[0]!.eventKey,first.eventKey);
  assert.equal(party.epoch,3);
  assert.equal(checkpointSumoParty(party,4200).party.resultOutbox.length,1);
});

test("pilot lifetime expiry transitions once and does not fabricate or erase completed results", () => {
  const party=create();party.sessionExpiresAt=5000;party.phase="PLAYING";party.epoch=4;
  stepSumoParty(party,5000);const expiredEpoch=party.epoch;
  assert.equal(party.phase,"LOBBY");assert.equal(party.paused,true);assert.equal(party.pauseReason,"pilot-session-expired");
  stepSumoParty(party,5017);assert.equal(party.epoch,expiredEpoch);
  const results=create();results.sessionExpiresAt=5000;results.phase="RESULTS";results.epoch=8;results.resultOutbox.push({v:1,partyId:"p1",roomCode:"ABCD",matchId:"m1",epoch:8,eventKey:"stable",winners:["00"],scores:{"00":2},round:1});
  stepSumoParty(results,5000);assert.equal(results.phase,"RESULTS");assert.equal(results.paused,true);assert.equal(results.resultOutbox.length,1);
});
