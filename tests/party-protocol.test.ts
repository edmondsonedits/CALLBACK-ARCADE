import assert from "node:assert/strict";
import test from "node:test";
import { validatePartyMessage } from "../lib/party/protocol";
import { acceptPartyInput, controlSumoParty, createSumoParty, projectSumoSnapshot, projectSumoBootstrap, stepSumoParty, setPartySeatConnection } from "../lib/party/sumo-runtime";
import { MAP_ORDER } from "../lib/arcade/online/sumo-core.mjs";

test("protocol rejects oversized, malformed and role-inappropriate frames", () => {
  assert.throws(() => validatePartyMessage("x".repeat(1025)), /PARTY_FRAME_TOO_LARGE/);
  assert.throws(() => validatePartyMessage(JSON.stringify({type:"input",v:1,epoch:2,seq:1,x:2,y:0,bashDown:false,dash:false})), /PARTY_INPUT_INVALID/);
  assert.throws(() => validatePartyMessage(JSON.stringify({type:"control",v:1,epoch:2,seq:1,operation:"start"}), "player"), /PARTY_ROLE_FORBIDDEN/);
  assert.deepEqual(validatePartyMessage(JSON.stringify({type:"ping",at:42})), {type:"ping",at:42});
});

test("Sumo dynamic projection stays within 8 KiB with complete arena state and interpolation fields", () => {
  const party = createSumoParty({partyId:"p1",roomCode:"ABCD",matchId:"m1",roster:[{id:"00",name:"Ada",memberId:"u1"},{id:"01",name:"Bo",memberId:"u2"}],options:{map:"keep"},now:1000});
  controlSumoParty(party,"host",{operation:"start",seq:1,epoch:party.epoch},1000);stepSumoParty(party,4000);
  const projection = projectSumoSnapshot(party, {kind:"display",now:1016});
  const text = JSON.stringify(projection);
  assert.ok(text.length < 8192, `dynamic payload was ${text.length} bytes`);
  assert.equal(projection.view.kind, "royal-sumo-v1.3");
  const fighter = projection.view.dynamic.fighters[0]!;
  assert.equal(typeof fighter[3], "number");
  assert.equal(typeof fighter[5], "number");
  assert.ok(projection.view.dynamic.fighterFields.includes("bashSerial"));
  assert.equal(projection.view.dynamic.simPhase,"intro");
  const bootstrap=projectSumoBootstrap(party);
  assert.ok(bootstrap.view.sim);
  assert.equal(bootstrap.view.sim!.data.fighters instanceof Array, true);
  assert.equal(bootstrap.view.sim!.mapId, "keep");
  assert.ok(Math.abs(Number(bootstrap.view.sim!.data.t)-party.liveSimulation!.t)<1e-9,"bootstrap must reflect the live authoritative Sim rather than its last checkpoint");
});

test("dynamic hazard snapshots preserve every original Sumo arena family under the documented budget", () => {
  for (const map of MAP_ORDER) {
    const party=createSumoParty({partyId:"p1",roomCode:"ABCD",matchId:"m1",roster:[{id:"00",name:"Ada",memberId:"u1"}],options:{map},now:1000,seed:19});
    controlSumoParty(party,"host",{operation:"start",seq:1,epoch:party.epoch},1000);stepSumoParty(party,4000);stepSumoParty(party,4017);
    const projection=projectSumoSnapshot(party,{kind:"display",now:4017}),size=JSON.stringify(projection).length;
    assert.ok(size<8192,`${map} dynamic payload was ${size} bytes`);
    assert.equal(projectSumoBootstrap(party).view.sim!.mapId,map);
    assert.ok(projection.view.dynamic.arena&&typeof projection.view.dynamic.arena.kind==="string");
  }
});

test("input sequences are idempotent and stale match epochs cannot control Sumo", () => {
  const party = createSumoParty({partyId:"p1",roomCode:"ABCD",matchId:"m1",roster:[{id:"00",name:"Ada",memberId:"u1"},{id:"01",name:"Bo",memberId:"u2"}],options:{map:"keep"},now:1000});
  party.phase="PLAYING";
  setPartySeatConnection(party,"u1",true,1000,"authenticated-socket");
  assert.equal(acceptPartyInput(party,"u1",{type:"input",v:1,epoch:party.epoch,seq:1,x:1,y:0,bashDown:false,dash:true},1000),true);
  assert.equal(acceptPartyInput(party,"u1",{type:"input",v:1,epoch:party.epoch,seq:1,x:-1,y:0,bashDown:false,dash:false},1001),false);
  const accepted=party.inputs["00"];
  party.epoch++;
  assert.equal(acceptPartyInput(party,"u1",{type:"input",v:1,epoch:party.epoch-1,seq:2,x:-1,y:0,bashDown:true,dash:false},1002),false);
  assert.deepEqual(party.inputs["00"],accepted);
});
