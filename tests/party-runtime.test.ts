import assert from "node:assert/strict";
import test from "node:test";
import worker, { PartyAdmission, PartyRoom, type PartyEnv } from "../party-worker/src/index";
import { signPartyTicket } from "../lib/party/security";
import { checkpointSumoParty, controlSumoParty, createSumoParty, restoreSumoParty, stepSumoParty } from "../lib/party/sumo-runtime";

test("control endpoints require server bearer auth and validate one pilot admission", async () => {
  const env={PARTY_SECRET:"secret",SITE_ORIGIN:"https://site.example",PARTY_ROOM:{idFromName:(id:string)=>id,get:()=>({fetch:async()=>new Response("{}")})},PARTY_ADMISSION:{idFromName:(id:string)=>id,get:()=>({fetch:async()=>new Response("{}")})}} as unknown as PartyEnv;
  const denied=await worker.fetch(new Request("https://worker.example/parties/p1/control",{method:"POST",body:JSON.stringify({operation:"prepare",partyId:"p1",roomCode:"ABCD",matchId:"m1"})}),env,{} as ExecutionContext);
  assert.equal(denied.status,401);
  const authorized=await worker.fetch(new Request("https://worker.example/parties/p1/control",{method:"POST",headers:{authorization:"Bearer secret","content-type":"application/json"},body:JSON.stringify({operation:"prepare",partyId:"p1",roomCode:"ABCD",matchId:"m1",roster:[{id:"00",name:"Ada",memberId:"u1"}]})}),env,{} as ExecutionContext);
  assert.equal(authorized.status,200);
});

test("failed party preparation releases the reserved global admission lease", async () => {
  const paths:string[]=[];
  const env={PARTY_SECRET:"secret",SITE_ORIGIN:"https://site.example",PARTY_ROOM:{idFromName:(id:string)=>id,get:()=>({fetch:async()=>new Response(JSON.stringify({error:"prepare failed"}),{status:500})})},PARTY_ADMISSION:{idFromName:(id:string)=>id,get:()=>({fetch:async(input:RequestInfo|URL)=>{paths.push(new URL(input instanceof Request?input.url:String(input)).pathname);return new Response("{}")}})}} as unknown as PartyEnv;
  const response=await worker.fetch(new Request("https://worker.example/parties/p1/control",{method:"POST",headers:{authorization:"Bearer secret","content-type":"application/json"},body:JSON.stringify({operation:"prepare",partyId:"p1",roomCode:"ABCD",matchId:"m1"})}),env,{} as ExecutionContext);
  assert.equal(response.status,500);
  assert.deepEqual(paths,["/reserve","/release"]);
});

test("socket route validates scoped signed tickets before DO lookup and strips ticket from negotiated subprotocol", async () => {
  let actorPath="",actorProtocols="",lookupCount=0;
  const env={PARTY_SECRET:"secret",SITE_ORIGIN:"https://site.example",PARTY_ROOM:{idFromName:(id:string)=>{lookupCount++;return id},get:()=>({fetch:async(req:Request)=>{actorPath=new URL(req.url).pathname;actorProtocols=req.headers.get("sec-websocket-protocol")??"";return new Response("upgraded")}})},PARTY_ADMISSION:{idFromName:(id:string)=>id,get:()=>new Response("{}")}} as unknown as PartyEnv;
  const ticket=await signPartyTicket({v:1,partyId:"p1",roomCode:"ABCD",matchId:"m1",role:"host",seatId:null,memberId:null,name:"Host",expiresAt:Date.now()+30_000,nonce:"nonce-1234567890"},"secret");
  const denied=await worker.fetch(new Request("https://worker.example/parties/p1/socket",{headers:{origin:"https://evil.example",upgrade:"websocket"}}),env,{} as ExecutionContext);
  assert.equal(denied.status,403);
  const noTicket=await worker.fetch(new Request("https://worker.example/parties/arbitrary/socket",{headers:{origin:"https://site.example",upgrade:"websocket","sec-websocket-protocol":"callback-party-v1"}}),env,{} as ExecutionContext);
  assert.equal(noTicket.status,401);
  assert.equal(lookupCount,0,"invalid socket tickets must not instantiate or route to Durable Objects");
  const accepted=await worker.fetch(new Request("https://worker.example/parties/p1/socket",{headers:{origin:"https://site.example",upgrade:"websocket","sec-websocket-protocol":`callback-party-v1, ${ticket}`}}),env,{} as ExecutionContext);
  assert.equal(accepted.status,200);
  assert.equal(actorPath,"/socket");
  assert.equal(actorProtocols,"callback-party-v1");
  assert.equal(lookupCount,1);
});
test("one global pilot admission allows same-party retries and rejects a second active party", async () => {
  let lease:unknown;
  const state={blockConcurrencyWhile:(fn:()=>Promise<void>)=>fn(),storage:{get:async()=>lease,put:async(_key:string,value:unknown)=>{lease=value},delete:async()=>{lease=undefined}}} as unknown as DurableObjectState;
  const admission=new PartyAdmission(state);
  const reserve=(partyId:string)=>admission.fetch(new Request("https://admission/reserve",{method:"POST",body:JSON.stringify({partyId})}));
  assert.equal((await reserve("p1")).status,200);
  assert.equal((await reserve("p1")).status,200);
  assert.equal((await reserve("p2")).status,409);
  assert.equal((await admission.fetch(new Request("https://admission/release",{method:"POST",body:JSON.stringify({partyId:"p1"})}))).status,200);
  assert.equal((await reserve("p2")).status,200);
});

test("Durable Object exposes message lifecycle handlers for first-frame ticket auth and teardown", async () => {
  const room=Object.create(PartyRoom.prototype) as PartyRoom;
  assert.equal(typeof room.webSocketMessage,"function");
  assert.equal(typeof room.fetch,"function");
  assert.equal(typeof room.webSocketClose,"function");
  assert.equal(typeof room.alarm,"function");
});

test("failed result storage withholds bootstrap and reconnect results until a durable retry succeeds",async()=>{
 const secret="result-recovery-secret",party=createSumoParty({partyId:"p1",roomCode:"ABCD",matchId:"m1",roster:[{id:"00",name:"Ada",memberId:"u1"}],now:Date.now()});
 party.phase="RESULTS";party.resultOutbox.push({v:1,partyId:"p1",roomCode:"ABCD",matchId:"m1",epoch:0,eventKey:"sumo:p1:m1:0:result",winners:["00"],scores:{"00":1},round:1});
 let failWrite=true,meta:unknown={authenticated:false};const frames:Record<string,unknown>[]=[],closes:number[]=[];
 const socket={deserializeAttachment:()=>meta,serializeAttachment:(value:unknown)=>{meta=value},send:(value:string)=>frames.push(JSON.parse(value)),close:(code:number)=>closes.push(code)};
 const state={storage:{sql:{exec:(query:string)=>{if(failWrite&&query.startsWith("INSERT OR IGNORE INTO party_outbox"))throw new Error("FREE_WRITE_QUOTA");return {toArray:()=>[]}}}},getWebSockets:()=>[socket]} as unknown as DurableObjectState;
 const room=Object.assign(Object.create(PartyRoom.prototype),{state,env:{PARTY_SECRET:secret},party,persistedResultKeys:new Set<string>(),resultPending:false,checkpointQueue:Promise.resolve(),preauthTimers:new WeakMap(),lastNonceCleanup:Date.now(),rates:new Map(),startTimer:()=>{}}) as PartyRoom;
 const privateRoom=room as unknown as {persistResults(p:typeof party):Promise<void>;broadcastBootstrap():void;broadcastPlayerStatus(now:number):void};
 await assert.rejects(privateRoom.persistResults(party),/FREE_WRITE_QUOTA/);
 privateRoom.broadcastBootstrap();privateRoom.broadcastPlayerStatus(Date.now());
 const ticket=await signPartyTicket({v:1,partyId:"p1",roomCode:"ABCD",matchId:"m1",role:"host",seatId:null,memberId:null,name:"Host",expiresAt:Date.now()+30000,nonce:"results-reconnect-nonce"},secret);
 await room.webSocketMessage(socket as unknown as WebSocket,JSON.stringify({type:"auth",ticket}));
 assert.equal(frames.some(f=>f.type==='ready'||f.type==='bootstrap'||f.type==='status'),false);assert.equal(frames.at(-1)?.code,'PARTY_RESULTS_PENDING');assert.deepEqual(closes,[1013]);
 failWrite=false;await privateRoom.persistResults(party);await room.webSocketMessage(socket as unknown as WebSocket,JSON.stringify({type:"auth",ticket}));
 assert.equal((frames.find(f=>f.type==='ready')?.snapshot as {finished:boolean}).finished,true);
});

test("callback outbox retries indefinitely through a durable alarm with bounded backoff", async () => {
  let attempts=5,nextAttemptAt=0,scheduled=0;
  const state={storage:{sql:{exec:(query:string,...args:unknown[])=>{if(query.includes("UPDATE party_outbox")){attempts=Number(args[0]);nextAttemptAt=Number(args[1])}return {toArray:()=>{if(query.includes("SELECT event_key,body,attempts"))return [{event_key:"event",body:"{}",attempts:5,next_attempt_at:0}];if(query.includes("SELECT MIN(next_attempt_at)"))return [{at:nextAttemptAt}];return []}}}},setAlarm:async(at:number)=>{scheduled=at}}} as unknown as DurableObjectState;
  const room=Object.assign(Object.create(PartyRoom.prototype),{state,env:{PARTY_SECRET:"secret",SITE_ORIGIN:"https://site.example",RESULT_CALLBACK_URL:"https://site.example/callback"},party:null,persistedResultKeys:new Set<string>()}) as PartyRoom;
  const previous=globalThis.fetch;globalThis.fetch=async()=>new Response("retry",{status:503});
  try{await room.alarm()}finally{globalThis.fetch=previous}
  assert.equal(attempts,6);
  assert.ok(scheduled>Date.now(),"failed callbacks schedule another durable alarm");
  assert.equal(scheduled,nextAttemptAt);
});

test("authenticated host and player reconnects resume authoritative sequence acknowledgements", async () => {
  const secret="sequence-test-secret",party=createSumoParty({partyId:"p1",roomCode:"ABCD",matchId:"m1",roster:[{id:"00",name:"Ada",memberId:"u1"}],now:1000});
  party.lastSequences["00"]=5;party.controlSequences.host=8;party.epoch=3;
  const attached=new Map<object,unknown>(),frames=new Map<object,Array<Record<string,unknown>>>(),sockets:object[]=[];
  const state={storage:{sql:{exec:()=>({toArray:()=>[]})}},getWebSockets:()=>sockets,waitUntil:()=>{}} as unknown as DurableObjectState;
  const room=Object.assign(Object.create(PartyRoom.prototype),{state,env:{PARTY_SECRET:secret},party,preauthTimers:new WeakMap(),lastNonceCleanup:Date.now(),rates:new Map()}) as PartyRoom;
  Object.assign(room,{startTimer:()=>{}});
  const makeSocket=()=>{const socket={deserializeAttachment:()=>attached.get(socket)??{authenticated:false},serializeAttachment:(value:unknown)=>attached.set(socket,value),send:(value:string)=>frames.get(socket)!.push(JSON.parse(value)),close:()=>{}};sockets.push(socket);frames.set(socket,[]);return socket as unknown as WebSocket};
  const host=makeSocket(),hostTicket=await signPartyTicket({v:1,partyId:"p1",roomCode:"ABCD",matchId:"m1",role:"host",seatId:null,memberId:null,name:"Host",expiresAt:Date.now()+30_000,nonce:"host-reconnect-nonce1"},secret);
  await room.webSocketMessage(host,JSON.stringify({type:"auth",ticket:hostTicket}));
  const player=makeSocket(),playerTicket=await signPartyTicket({v:1,partyId:"p1",roomCode:"ABCD",matchId:"m1",role:"player",seatId:"00",memberId:"u1",name:"Ada",expiresAt:Date.now()+30_000,nonce:"player-reconnect-nonce1"},secret);
  await room.webSocketMessage(player,JSON.stringify({type:"auth",ticket:playerTicket}));
  const hostReady=frames.get(host)!.find(frame=>frame.type==="ready")!,playerReady=frames.get(player)!.find(frame=>frame.type==="ready")!;
  assert.equal(hostReady.nextControlSeq,9);assert.equal(playerReady.nextSeq,6);assert.equal(playerReady.ackSeq,5);assert.equal(playerReady.epoch,3);
});

test("player status exposes the original Sim phase during the nested countdown", () => {
  const party=createSumoParty({partyId:"p1",roomCode:"ABCD",matchId:"m1",roster:[{id:"00",name:"Ada",memberId:"u1"}],now:1000,seed:19});
  controlSumoParty(party,"host",{operation:"start",seq:0,epoch:0},1000);
  stepSumoParty(party,4000);
  assert.equal(party.phase,"PLAYING");assert.notEqual(party.liveSimulation?.phase,"fight");
  const frames:Record<string,unknown>[]=[];
  const socket={deserializeAttachment:()=>({authenticated:true,partyId:"p1",roomCode:"ABCD",matchId:"m1",role:"player",seatId:"00"}),send:(value:string)=>frames.push(JSON.parse(value))};
  const state={getWebSockets:()=>[socket]} as unknown as DurableObjectState;
  const room=Object.assign(Object.create(PartyRoom.prototype),{state,party}) as PartyRoom;
  (room as unknown as {broadcastPlayerStatus(now:number):void}).broadcastPlayerStatus(4000);
  assert.equal(frames[0]?.phase,"PLAYING");assert.equal(frames[0]?.simPhase,party.liveSimulation?.phase);
});

test("authenticated socket cold recovery restarts simulation and syncs paused epoch before stale controls", async () => {
  const party=createSumoParty({partyId:"p1",roomCode:"ABCD",matchId:"m1",roster:[{id:"00",name:"Ada",memberId:"u1"}],now:1000,seed:19});
  controlSumoParty(party,"host",{operation:"start",seq:0,epoch:0},1000);stepSumoParty(party,4000);
  const oldEpoch=party.epoch,recovered=restoreSumoParty(checkpointSumoParty(party,4000));
  const attached=new Map<object,unknown>(),hostFrames:Record<string,unknown>[]=[],playerFrames:Record<string,unknown>[]=[],sockets:object[]=[];
  const makeSocket=(role:"host"|"player",seatId:string|null,frames:Record<string,unknown>[])=>{const socket={deserializeAttachment:()=>attached.get(socket),serializeAttachment:(value:unknown)=>attached.set(socket,value),send:(value:string)=>frames.push(JSON.parse(value)),close:()=>{}};attached.set(socket,{authenticated:true,partyId:"p1",roomCode:"ABCD",matchId:"m1",role,seatId,socketId:role});sockets.push(socket);return socket as unknown as WebSocket};
  const host=makeSocket("host",null,hostFrames);makeSocket("player","00",playerFrames);const waits:Promise<void>[]=[],state={getWebSockets:()=>sockets,waitUntil:(promise:Promise<void>)=>waits.push(promise),storage:{sql:{exec:()=>({toArray:()=>[]})}}} as unknown as DurableObjectState;
  const room=Object.assign(Object.create(PartyRoom.prototype),{state,env:{PARTY_SECRET:"secret"},party:recovered,timer:null,checkpointQueue:Promise.resolve()}) as PartyRoom;let timerStarts=0;
  Object.assign(room,{startTimer:()=>{timerStarts++;Object.assign(room,{timer:{}})}});
  await room.webSocketMessage(host,JSON.stringify({type:"control",v:1,epoch:oldEpoch,seq:1,operation:"pause"}));
  const stale=hostFrames.find(frame=>frame.type==="control-ack"),snapshot=hostFrames.find(frame=>frame.type==="snapshot"),status=playerFrames.find(frame=>frame.type==="status");
  assert.equal(stale?.reason,"PARTY_STALE_EPOCH");assert.equal(snapshot?.view&&((snapshot.view as {dynamic:{epoch:number;paused:boolean}}).dynamic.epoch),recovered.epoch);assert.equal((snapshot?.view as {dynamic:{paused:boolean}}).dynamic.paused,true);
  assert.equal(status?.epoch,recovered.epoch);assert.equal(status?.paused,true);assert.equal(status?.simPhase,recovered.liveSimulation?.phase);assert.equal(timerStarts,1);
  await room.webSocketMessage(host,JSON.stringify({type:"control",v:1,epoch:recovered.epoch,seq:1,operation:"resume"}));
  assert.equal((hostFrames.filter(frame=>frame.type==="control-ack").at(-1))?.ok,true);assert.equal(timerStarts,1);await Promise.all(waits);
});

test("retiring an already-empty PartyRoom is idempotent and preserves durable outbox rows", async () => {
  const queries:string[]=[],state={getWebSockets:()=>[],storage:{sql:{exec:(query:string)=>{queries.push(query);return {toArray:()=>[{event_key:"pending-event"}]}}}}} as unknown as DurableObjectState;
  const room=Object.assign(Object.create(PartyRoom.prototype),{state,party:null,timer:null}) as PartyRoom;
  const response=await room.fetch(new Request("https://party/retire",{method:"POST",body:JSON.stringify({operation:"retire",partyId:"p1",roomCode:"ABCD",matchId:"m1"})}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,alreadyRetired:true,pendingOutbox:1});assert.equal(queries.some(query=>query.includes("DELETE FROM party_outbox")),false);
});

test("invalid checkpoint recovery is surfaced as a sanitized fail-closed response", async () => {
  let initialized:Promise<void>|undefined;
  const state={blockConcurrencyWhile:(fn:()=>Promise<void>)=>{initialized=fn();return initialized},storage:{sql:{exec:(query:string)=>({toArray:()=>query.includes("SELECT body FROM party_checkpoint")?[{body:"not-json"}]:[]})}}} as unknown as DurableObjectState;
  const room=new PartyRoom(state,{PARTY_SECRET:"secret",SITE_ORIGIN:"https://site.example"} as PartyEnv);await initialized;
  const response=await room.fetch(new Request("https://party/prepare",{method:"POST",body:JSON.stringify({partyId:"p1",roomCode:"ABCD",matchId:"m1"})}));
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:"PARTY_RECOVERY_FAILED",code:"PARTY_CHECKPOINT_INVALID"});
});

test("new match preparation closes sockets bound to the previous room and match", async () => {
  let closed=0;const socket={close:()=>{closed++},deserializeAttachment:()=>null};
  const state={storage:{sql:{exec:()=>({toArray:()=>[]})}},getWebSockets:()=>[socket]} as unknown as DurableObjectState;
  const prior=createSumoParty({partyId:"p1",roomCode:"OLD1",matchId:"old-match",roster:[{id:"00",name:"Ada",memberId:"u1"}],now:1000});
  const room=Object.assign(Object.create(PartyRoom.prototype),{state,env:{PARTY_SECRET:"secret"},party:prior,timer:null,checkpointQueue:Promise.resolve(),lastBootstrapKey:"none"}) as PartyRoom;
  const response=await room.fetch(new Request("https://party/prepare",{method:"POST",body:JSON.stringify({partyId:"p1",roomCode:"NEW1",matchId:"new-match",roster:[{id:"00",name:"Ada",memberId:"u1"}]})}));
  assert.equal(response.status,200);assert.equal(closed,1);assert.equal((room as unknown as {party:{matchId:string}}).party.matchId,"new-match");
});

test('shared Sumo retirement holds admission until the parent closes, and parent release requires service auth',async()=>{
 const paths:string[]=[];const env={PARTY_SECRET:'secret',SITE_ORIGIN:'https://site.example',PARTY_ROOM:{idFromName:(id:string)=>id,get:()=>({fetch:async()=>Response.json({ok:true})})},PARTY_ADMISSION:{idFromName:(id:string)=>id,get:()=>({fetch:async(input:RequestInfo|URL)=>{paths.push(new URL(input instanceof Request?input.url:String(input)).pathname);return Response.json({ok:true})}})}} as unknown as PartyEnv;
 const request=(path:string,body:unknown,authorized=true)=>worker.fetch(new Request('https://worker.example'+path,{method:'POST',headers:authorized?{authorization:'Bearer secret'}:{},body:JSON.stringify(body)}),env,{} as ExecutionContext);
 assert.equal((await request('/parties/session-ABCD/control',{operation:'retire',partyId:'session-ABCD',roomCode:'WXYZ',matchId:'old'})).status,200);assert.deepEqual(paths,[]);
 assert.equal((await request('/admission/release',{partyId:'session-ABCD'},false)).status,401);assert.deepEqual(paths,[]);
 assert.equal((await request('/admission/release',{partyId:'session-ABCD'})).status,200);assert.deepEqual(paths,['/release']);
});
