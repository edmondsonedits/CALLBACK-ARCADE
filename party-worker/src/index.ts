import { activeSumoSeats, acceptPartyInput, checkpointSumoParty, controlSumoParty, createSumoParty, projectSumoBootstrap, projectSumoSnapshot, restoreSumoParty, setPartySeatConnection, stepSumoParty, type SumoParty } from "../../lib/party/sumo-runtime";
import { validatePartyMessage, type PartyRole } from "../../lib/party/protocol";
import { verifyPartyTicket } from "../../lib/party/security";

import { NativeArcadeRoom, routeNativeArcade } from "./native-room";
import { OnlineArcadeRoom, routeOnlineArcade } from "./online-room";
import { SessionRoom } from "./session-room";
import { verifySessionSocketTicket } from "../../lib/session-socket-ticket";
export {NativeArcadeRoom,OnlineArcadeRoom,SessionRoom};

export interface PartyEnv {NATIVE_ARCADE_ROOM:DurableObjectNamespace;ONLINE_ARCADE_ROOM:DurableObjectNamespace;SESSION_ROOM:DurableObjectNamespace;PARTY_SECRET:string;SITE_ORIGIN:string;RESULT_CALLBACK_URL?:string;PARTY_ROOM:DurableObjectNamespace;PARTY_ADMISSION:DurableObjectNamespace}
const encoder=new TextEncoder();
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
function auth(request:Request,secret:string):boolean{return !!secret&&request.headers.get("authorization")==="Bearer "+secret}
function partyIdFrom(path:string):string|null{const m=/^\/parties\/([A-Za-z0-9_-]{1,80})\/(socket|control)$/u.exec(path);return m?.[1]??null}
async function bodyObject(request:Request,max=16_384):Promise<Record<string,unknown>>{
 const length=Number(request.headers.get("content-length")??0);if(length>max)throw new Error("PARTY_BODY_TOO_LARGE");const text=await request.text();if(encoder.encode(text).byteLength>max)throw new Error("PARTY_BODY_TOO_LARGE");let value:unknown;try{value=JSON.parse(text)}catch{throw new Error("PARTY_BODY_INVALID")}if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("PARTY_BODY_INVALID");return value as Record<string,unknown>;
}
function validPrepare(value:Record<string,unknown>,pathParty:string):boolean{
 const allowed=["operation","partyId","roomCode","matchId","roster","options"];
 return Object.keys(value).every(k=>allowed.includes(k))&&value.operation==="prepare"&&value.partyId===pathParty&&typeof value.roomCode==="string"&&/^[A-Z0-9]{4,8}$/u.test(value.roomCode)&&typeof value.matchId==="string"&&value.matchId.length>0&&value.matchId.length<=120&&(value.roster===undefined||Array.isArray(value.roster)&&value.roster.length<=10)&&(value.options===undefined||!!value.options&&typeof value.options==="object"&&!Array.isArray(value.options));
}
async function responseError(error:unknown):Promise<Response>{const code=error instanceof Error?error.message:"PARTY_INTERNAL_ERROR",status=code.includes("FORBIDDEN")?403:code.includes("INVALID")||code.includes("MALFORMED")||code.includes("TOO_LARGE")?400:code.includes("BUSY")?409:500;return json({error:code},status)}
export default {async fetch(request:Request,env:PartyEnv,ctx:ExecutionContext):Promise<Response>{
 void ctx;
 const url=new URL(request.url);
 if(url.pathname==='/admission/release'){if(request.method!=='POST'||!auth(request,env.PARTY_SECRET))return json({error:'PARTY_UNAUTHORIZED'},401);const body=await bodyObject(request,1024);if(Object.keys(body).length!==1||typeof body.partyId!=='string'||!/^session-[A-Z2-9]{4}$/.test(body.partyId))return json({error:'PARTY_CONTROL_INVALID'},400);return env.PARTY_ADMISSION.get(env.PARTY_ADMISSION.idFromName('global')).fetch('https://admission/release',{method:'POST',body:JSON.stringify(body)});}
 const sessionMatch=/^\/sessions\/([A-HJ-KM-NP-Z2-9]{4})\/(socket|notify)$/u.exec(url.pathname);
 if(sessionMatch){const code=sessionMatch[1]!,action=sessionMatch[2]!;const stub=env.SESSION_ROOM.get(env.SESSION_ROOM.idFromName(code));if(action==='notify'){if(request.method!=='POST'||!auth(request,env.PARTY_SECRET))return json({error:'SESSION_UNAUTHORIZED'},401);return stub.fetch(new Request('https://session/notify',{method:'POST',headers:request.headers,body:request.body}));}if(!env.SITE_ORIGIN||request.headers.get('Origin')!==new URL(env.SITE_ORIGIN).origin)return json({error:'SESSION_ORIGIN_FORBIDDEN'},403);if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'SESSION_UPGRADE_REQUIRED'},426);const protocols=(request.headers.get('Sec-WebSocket-Protocol')??'').split(',').map(x=>x.trim());if(protocols.length!==2||protocols[0]!=='callback-session-v1')return json({error:'SESSION_TICKET_REQUIRED'},401);let claims;try{claims=await verifySessionSocketTicket(protocols[1]!,env.PARTY_SECRET);if(claims.code!==code)throw Error();}catch{return json({error:'SESSION_TICKET_INVALID'},401);}let verified:Response;try{verified=await fetch(new URL('/api/sessions/socket/validate',env.SITE_ORIGIN),{method:'POST',headers:{authorization:'Bearer '+env.PARTY_SECRET,'content-type':'application/json'},body:JSON.stringify({ticket:protocols[1]}),signal:AbortSignal.timeout(4000)});}catch{return json({error:'SESSION_VALIDATION_UNAVAILABLE'},503);}if(!verified.ok)return json({error:'SESSION_TICKET_REVOKED'},401);const headers=new Headers(request.headers);headers.set('Sec-WebSocket-Protocol','callback-session-v1');headers.set('X-Session-Code',code);headers.set('X-Session-Ticket',protocols[1]!);return stub.fetch(new Request('https://session/socket',{method:'GET',headers}));}
 const native=await routeNativeArcade(request,env);if(native)return native;
 const online=await routeOnlineArcade(request,env);if(online)return online;
 if(url.pathname==="/health"&&request.method==="GET"){const ready=!!env.PARTY_SECRET&&!!env.SITE_ORIGIN&&!!env.PARTY_ROOM&&!!env.PARTY_ADMISSION;return json({ready,backend:"sqlite-do"},ready?200:503)}
 const id=partyIdFrom(url.pathname);if(!id)return json({error:"NOT_FOUND"},404);
 if(url.pathname.endsWith("/socket")){
  if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return json({error:"PARTY_UPGRADE_REQUIRED"},426);
  if(!env.SITE_ORIGIN||request.headers.get("Origin")!==new URL(env.SITE_ORIGIN).origin)return json({error:"PARTY_ORIGIN_FORBIDDEN"},403);
  const protocols=(request.headers.get("Sec-WebSocket-Protocol")??"").split(",").map(x=>x.trim());if(protocols.length!==2||protocols[0]!=="callback-party-v1")return json({error:"PARTY_TICKET_REQUIRED"},401);
  try{const claims=await verifyPartyTicket(protocols[1]!,env.PARTY_SECRET);if(claims.partyId!==id)return json({error:"PARTY_TICKET_SCOPE"},403)}catch{return json({error:"PARTY_TICKET_INVALID"},401)}
  const forwarded=new URL(request.url);forwarded.pathname="/socket";const headers=new Headers(request.headers);headers.set("Sec-WebSocket-Protocol","callback-party-v1");const stub=env.PARTY_ROOM.get(env.PARTY_ROOM.idFromName(id));return stub.fetch(new Request(forwarded,{method:"GET",headers}));
 }
 const stub=env.PARTY_ROOM.get(env.PARTY_ROOM.idFromName(id));
 if(request.method!=="POST"||!auth(request,env.PARTY_SECRET))return json({error:"PARTY_UNAUTHORIZED"},401);
 try{
  const value=await bodyObject(request);
  if(value.operation==="prepare"){
   if(!validPrepare(value,id))throw new Error("PARTY_PREPARE_INVALID");
   const admission=env.PARTY_ADMISSION.get(env.PARTY_ADMISSION.idFromName("global"));
   const reserved=await admission.fetch("https://admission/reserve",{method:"POST",body:JSON.stringify({partyId:id,now:Date.now()})});if(!reserved.ok)return new Response(await reserved.text(),{status:reserved.status,headers:{"content-type":"application/json"}});
   const lease=await reserved.json() as {expiresAt?:number};
   try{const prepared=await stub.fetch("https://party/prepare",{method:"POST",body:JSON.stringify({...value,admissionExpiresAt:lease.expiresAt})});if(!prepared.ok&&!id.startsWith("session-"))await admission.fetch("https://admission/release",{method:"POST",body:JSON.stringify({partyId:id})});return prepared}catch(error){if(!id.startsWith("session-"))await admission.fetch("https://admission/release",{method:"POST",body:JSON.stringify({partyId:id})});throw error}
  }
  if(value.operation==="retire"&&value.partyId===id&&typeof value.roomCode==="string"&&typeof value.matchId==="string"&&Object.keys(value).every(k=>["operation","partyId","roomCode","matchId"].includes(k))){
   const result=await stub.fetch("https://party/retire",{method:"POST",body:JSON.stringify(value)});if(result.ok&&!id.startsWith("session-")){const admission=env.PARTY_ADMISSION.get(env.PARTY_ADMISSION.idFromName("global"));await admission.fetch("https://admission/release",{method:"POST",body:JSON.stringify({partyId:id})});}return result;
  }
  throw new Error("PARTY_CONTROL_INVALID");
 }catch(error){return responseError(error)}
}};

export class PartyAdmission {
 private readonly state:DurableObjectState;private partyId:string|null=null;private startedAt=0;private expiredPartyId:string|null=null;private readonly lifetime=20*60_000;
 constructor(state:DurableObjectState){this.state=state;void state.blockConcurrencyWhile(async()=>{const saved=await state.storage.get<{partyId:string;startedAt:number}>("lease");if(saved){this.partyId=saved.partyId;this.startedAt=saved.startedAt}this.expiredPartyId=await state.storage.get<string>("expired-party")??null})}
 async fetch(request:Request):Promise<Response>{
  const body=await request.json() as {partyId?:string;now?:number};
  if(new URL(request.url).pathname==="/reserve"){
   if(typeof body.partyId!=="string")return json({error:"PARTY_ADMISSION_INVALID"},400);
   if(this.partyId!==null&&Date.now()-this.startedAt>=this.lifetime){this.expiredPartyId=this.partyId;await this.state.storage.put("expired-party",this.expiredPartyId);this.partyId=null;await this.state.storage.delete("lease")}
   if(body.partyId===this.expiredPartyId)return json({error:"PARTY_SESSION_EXPIRED"},409);
   if(this.partyId&&this.partyId!==body.partyId)return json({error:"PARTY_PILOT_BUSY",retryAfterSeconds:Math.max(1,Math.ceil((this.lifetime-(Date.now()-this.startedAt))/1000))},409);
   if(this.partyId===null){this.partyId=body.partyId;this.startedAt=Date.now();await this.state.storage.put("lease",{partyId:this.partyId,startedAt:this.startedAt})}
   return json({ok:true,maxSessionMs:this.lifetime,expiresAt:this.startedAt+this.lifetime});
  }
  if(new URL(request.url).pathname==="/release"){if(this.partyId===body.partyId){this.partyId=null;this.startedAt=0;await this.state.storage.delete("lease")}return json({ok:true})}
  return json({error:"PARTY_ADMISSION_INVALID"},400);
 }
}

export class PartyRoom {
 private readonly state:DurableObjectState;private readonly env:PartyEnv;private party:SumoParty|null=null;private recoveryFailure:string|null=null;private timer:ReturnType<typeof setInterval>|null=null;private stepPending=false;private resultTask:Promise<void>|null=null;private persistedResultKeys=new Set<string>();private lastBootstrapKey="";private lastNonceCleanup=0;private readonly rates=new Map<string,{tokens:number;updatedAt:number}>();private readonly preauthTimers=new WeakMap<WebSocket,ReturnType<typeof setTimeout>>();
 constructor(state:DurableObjectState,env:PartyEnv){
  this.state=state;this.env=env;
  void state.blockConcurrencyWhile(async()=>{
   state.storage.sql.exec("CREATE TABLE IF NOT EXISTS party_checkpoint (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL, updated_at INTEGER NOT NULL)");
   state.storage.sql.exec("CREATE TABLE IF NOT EXISTS party_outbox (event_key TEXT PRIMARY KEY, body TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL)");
   state.storage.sql.exec("CREATE TABLE IF NOT EXISTS party_ticket_nonce (nonce TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)");
   const rows=state.storage.sql.exec<{body:string}>("SELECT body FROM party_checkpoint WHERE id=1").toArray();
   if(rows[0]){try{this.party=restoreSumoParty(JSON.parse(rows[0].body));this.lastBootstrapKey=this.bootstrapKey()}catch{this.party=null;this.recoveryFailure="PARTY_CHECKPOINT_INVALID"}}
   const outbox=state.storage.sql.exec<{event_key:string}>("SELECT event_key FROM party_outbox ORDER BY rowid").toArray();
   for(const row of outbox)this.persistedResultKeys.add(row.event_key);
   if(this.party){
    const controllers=new Map<string,{socket:WebSocket;meta:SocketMeta}>();
    for(const socket of this.sockets()){
     const meta=socket.deserializeAttachment() as SocketMeta|null;
     if(!meta?.authenticated)continue;
     if(!this.socketMatchesParty(meta)){socket.close(1008,"stale match socket");continue}
     if(meta.role!=="player"||!meta.memberId||!meta.socketId)continue;
     if(!this.party.roster.some(seat=>seat.id===meta.seatId&&seat.memberId===meta.memberId)){socket.close(1008,"seat mismatch");continue}
     const prior=controllers.get(meta.memberId);
     if(prior&&prior.meta.connectedAt>=meta.connectedAt){socket.close(4001,"controller replaced");continue}
     prior?.socket.close(4001,"controller replaced");controllers.set(meta.memberId,{socket,meta});
    }
    for(const {meta} of controllers.values()){
     setPartySeatConnection(this.party,meta.memberId!,true,Date.now(),meta.socketId);
     this.party.botIds=this.party.botIds.filter(id=>id!==meta.seatId);
    }
    // Old checkpoints may retain already-delivered results. Requeue them before
    // authenticating; the receiver deduplicates deliveries by event key.
    await this.persistResults(this.party);
   }
   await this.scheduleOutboxAlarm();
  });
 }
 private socketMatchesParty(meta:SocketMeta|null):meta is SocketMeta & {authenticated:true}{return Boolean(meta?.authenticated&&this.party&&meta.partyId===this.party.partyId&&meta.roomCode===this.party.roomCode&&meta.matchId===this.party.matchId)}

 private startTimer(){if(this.timer===null)this.timer=setInterval(()=>this.scheduledStep(),1000/60)}
 private ensureTimerAfterWake(now:number){if(this.timer!==null)return;this.startTimer();this.broadcastSnapshot(now);this.broadcastPlayerStatus(now)}
 private stopTimer(){if(this.timer!==null){clearInterval(this.timer);this.timer=null}}
 private scheduledStep(){if(this.stepPending||!this.party)return;this.stepPending=true;const now=Date.now(),priorKey=this.bootstrapKey();try{stepSumoParty(this.party,now);const key=this.bootstrapKey(),boundary=key!==priorKey;if(boundary){this.state.waitUntil(this.persistCheckpoint(now));this.lastBootstrapKey=key;this.broadcastBootstrap()}else if(now-this.party.lastCheckpointAt>=1000)this.state.waitUntil(this.persistCheckpoint(now));if(this.party.resultOutbox.length)this.state.waitUntil(this.persistResults(this.party));if(boundary||this.party.tick%6===0)this.broadcastPlayerStatus(now);if(!boundary&&this.party.tick%3===0)this.broadcastSnapshot(now);if(this.party.pauseReason==="pilot-session-expired"){this.state.waitUntil(this.persistCheckpoint(now));this.broadcastBootstrap();this.broadcastPlayerStatus(now);for(const ws of this.sockets())try{ws.close(1001,"pilot session expired")}catch{/* socket may already be closed */}this.stopTimer()}}catch{/* socket may already be closed */}finally{this.stepPending=false}}
 private checkpointQueue:Promise<void>=Promise.resolve();
 private async persistCheckpoint(now:number){if(!this.party)return;const snapshot=checkpointSumoParty(this.party,now),body=JSON.stringify(snapshot);this.checkpointQueue=this.checkpointQueue.catch(()=>{}).then(async()=>{await this.state.storage.sql.exec("INSERT INTO party_checkpoint(id,body,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at",body,now)});await this.checkpointQueue}
 private bootstrapKey(){const sim=this.party?.liveSimulation;return sim?`${sim.map.id}:${sim.round}:${sim.seed}`:"none"}
 private async scheduleOutboxAlarm(){if(!this.env.RESULT_CALLBACK_URL)return;const rows=this.state.storage.sql.exec<{at:number|null}>("SELECT MIN(next_attempt_at) AS at FROM party_outbox").toArray();const at=rows[0]?.at;if(typeof at==="number")await this.state.storage.setAlarm(Math.max(Date.now()+1,at))}
 async alarm(){if(!this.env.RESULT_CALLBACK_URL)return;const now=Date.now(),rows=this.state.storage.sql.exec<{event_key:string;body:string;attempts:number;next_attempt_at:number}>("SELECT event_key,body,attempts,next_attempt_at FROM party_outbox WHERE next_attempt_at<=? ORDER BY next_attempt_at,event_key LIMIT 1",now).toArray(),item=rows[0];if(!item){await this.scheduleOutboxAlarm();return}let succeeded=false;try{const response=await fetch(this.env.RESULT_CALLBACK_URL,{method:"POST",headers:{authorization:`Bearer ${this.env.PARTY_SECRET}`,"content-type":"application/json"},body:item.body});succeeded=response.ok}catch{/* socket may already be closed */}if(succeeded){if(this.party){this.party.resultOutbox=this.party.resultOutbox.filter(result=>result.eventKey!==item.event_key);await this.persistCheckpoint(Date.now())}await this.state.storage.sql.exec("DELETE FROM party_outbox WHERE event_key=?",item.event_key);this.persistedResultKeys.delete(item.event_key)}else{const attempts=item.attempts+1,delay=Math.min(5*60_000,1000*2**Math.min(attempts,8));await this.state.storage.sql.exec("UPDATE party_outbox SET attempts=?,next_attempt_at=? WHERE event_key=?",attempts,Date.now()+delay,item.event_key)}await this.scheduleOutboxAlarm()}
 private async persistResults(party:SumoParty):Promise<void>{
  // A retirement must wait for an in-flight flush, then include any newer result.
  if(this.resultTask){await this.resultTask;return this.persistResults(party)}
  const pending=party.resultOutbox.filter(x=>!this.persistedResultKeys.has(x.eventKey));if(!pending.length)return;
  this.resultTask=(async()=>{for(const result of pending){await this.state.storage.sql.exec("INSERT OR IGNORE INTO party_outbox(event_key,body,attempts,next_attempt_at) VALUES(?,?,0,?)",result.eventKey,JSON.stringify(result),Date.now());this.persistedResultKeys.add(result.eventKey)}await this.persistCheckpoint(Date.now());if(this.party?.phase==="RESULTS")this.broadcastBootstrap();await this.scheduleOutboxAlarm()})();
  try{await this.resultTask}finally{this.resultTask=null}
 }
 private resultsDurable(){return this.party?.phase!=="RESULTS"||this.party.resultOutbox.every(x=>this.persistedResultKeys.has(x.eventKey))}
 private sockets(){return this.state.getWebSockets()}
 private broadcastSnapshot(now:number){if(!this.party||!this.resultsDurable())return;const payload=JSON.stringify({type:"snapshot",...projectSumoSnapshot(this.party,{kind:"display",now})});for(const ws of this.sockets()){const meta=ws.deserializeAttachment() as SocketMeta|null;if(this.socketMatchesParty(meta)&&(meta.role==="host"||meta.role==="display")){try{ws.send(payload)}catch{/* socket may already be closed */}}}}
 private broadcastBootstrap(){if(!this.party||!this.resultsDurable())return;const payload=JSON.stringify({type:"bootstrap",snapshot:projectSumoBootstrap(this.party),botEnabled:this.party.botEnabled??{}});for(const ws of this.sockets()){const meta=ws.deserializeAttachment() as SocketMeta|null;if(this.socketMatchesParty(meta)&&(meta.role==="host"||meta.role==="display")){try{ws.send(payload)}catch{/* socket may already be closed */}}}}
 private broadcastPlayerStatus(now:number){if(!this.party||!this.resultsDurable())return;const p=this.party,alive=p.roster.map(seat=>{const index=activeSumoSeats(p).findIndex(s=>s.id===seat.id),fighter=p.liveSimulation?.fighters[index];return Boolean(fighter?.alive&&!fighter.falling)}),connectedSeats=p.roster.filter(s=>s.connected).map(s=>s.id),round=p.liveSimulation?.round??0,simPhase=p.liveSimulation?.phase??"idle";for(const ws of this.sockets()){const meta=ws.deserializeAttachment() as SocketMeta|null;if(!this.socketMatchesParty(meta)||meta.role!=="player"||!meta.seatId)continue;const seatId=meta.seatId;try{ws.send(JSON.stringify({type:"status",phase:p.phase,simPhase,paused:p.paused,epoch:p.epoch,round,connectedSeats,alive,seatId,ackSeq:p.lastSequences[seatId]??-1,nextSeq:(p.lastSequences[seatId]??-1)+1,serverTime:now}))}catch{/* socket may already be closed */}}}
 async fetch(request:Request):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(path==="/prepare"&&request.method==="POST"){
   if(this.recoveryFailure)return json({error:"PARTY_RECOVERY_FAILED",code:this.recoveryFailure},503);
   const body=await request.json() as Record<string,unknown>,partyId=String(body.partyId),roomCode=String(body.roomCode),matchId=String(body.matchId);
    if(this.party&&this.party.partyId!==partyId)return json({error:"PARTY_IDENTITY_MISMATCH"},409);
   if(this.party?.matchId===matchId&&this.party.roomCode===roomCode)return json({ok:true,idempotent:true,epoch:this.party.epoch});
    const roster=(Array.isArray(body.roster)?body.roster:(this.party?.roster.filter(s=>s.memberId).map(s=>({id:s.id,name:s.name,memberId:s.memberId}))??[])) as Array<{id:string;name:string;memberId:string}>;
   const now=Date.now(),expiresAt=Math.min(this.party?.sessionExpiresAt??now+20*60_000,typeof body.admissionExpiresAt==="number"?body.admissionExpiresAt:now+20*60_000);if(this.party){this.stopTimer();for(const ws of this.sockets())try{ws.close(1001,"new match prepared")}catch{/* socket may already be closed */}}this.party=createSumoParty({partyId,roomCode,matchId,roster,options:body.options as Record<string,unknown>|undefined,now,seed:(Math.random()*0x1_0000_0000)>>>0});this.party.sessionExpiresAt=expiresAt;this.lastBootstrapKey="none";await this.persistCheckpoint(now);return json({ok:true,idempotent:false,epoch:this.party.epoch});
  }
  if(path==="/retire"&&request.method==="POST"){
   const body=await request.json() as Record<string,unknown>;if(!this.party){const pendingOutbox=(await this.state.storage.sql.exec("SELECT event_key FROM party_outbox").toArray()).length;return json({ok:true,alreadyRetired:true,pendingOutbox})}if(body.partyId!==this.party.partyId||body.roomCode!==this.party.roomCode||body.matchId!==this.party.matchId)return json({error:"PARTY_RETIRE_OBSOLETE"},409);
   this.stopTimer();if(this.party.resultOutbox.length)await this.persistResults(this.party);this.party=null;for(const ws of this.sockets())try{ws.close(1000,"party retired")}catch{/* socket may already be closed */}this.checkpointQueue=this.checkpointQueue.catch(()=>{}).then(()=>{this.state.storage.sql.exec("DELETE FROM party_checkpoint WHERE id=1")});await this.checkpointQueue;return json({ok:true,pendingOutbox:(await this.state.storage.sql.exec("SELECT event_key FROM party_outbox")).toArray().length});
  }
  if(path==="/socket"&&request.headers.get("Upgrade")?.toLowerCase()==="websocket"){
   if(this.recoveryFailure)return json({error:"PARTY_RECOVERY_FAILED",code:this.recoveryFailure},503);
   if(!this.party)return json({error:"PARTY_NOT_PREPARED"},404);if(this.sockets().length>=32)return json({error:"PARTY_SOCKET_CAPACITY"},429);const protocols=(request.headers.get("Sec-WebSocket-Protocol")??"").split(",").map(x=>x.trim());if(protocols.length!==1||protocols[0]!=="callback-party-v1")return json({error:"PARTY_PROTOCOL_INVALID"},400);const pair=new WebSocketPair(),client=pair[0],server=pair[1];this.state.acceptWebSocket(server);server.serializeAttachment({authenticated:false,connectedAt:Date.now()} satisfies SocketMeta);this.preauthTimers.set(server,setTimeout(()=>{try{server.close(1008,"authentication timeout")}catch{/* socket may already be closed */}},5000));return new Response(null,{status:101,webSocket:client,headers:{"Sec-WebSocket-Protocol":"callback-party-v1"}});
  }
  return json({error:"NOT_FOUND"},404);
 }
 async webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){
  try{
   if(this.recoveryFailure){ws.send(JSON.stringify({type:"error",code:"PARTY_RECOVERY_FAILED"}));ws.close(1011,"party recovery failed");return}
   if(!this.party){ws.close(1011,"party unavailable");return}if((typeof message==="string"?encoder.encode(message).length:message.byteLength)>1024){ws.close(1009,"frame too large");return}
   if(!this.resultsDurable()){ws.send(JSON.stringify({type:"error",code:"PARTY_RESULTS_PENDING"}));ws.close(1013,"results awaiting durable storage");return}
   const meta=ws.deserializeAttachment() as SocketMeta|null;
   if(meta?.authenticated&&!this.socketMatchesParty(meta)){ws.close(1008,"stale match socket");return}
   if(!meta?.authenticated){const raw=typeof message==="string"?JSON.parse(message):JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(message));if(!raw||raw.type!=="auth"||typeof raw.ticket!=="string"||Object.keys(raw).some(k=>k!=="type"&&k!=="ticket")){ws.close(1008,"authentication required");return}
    const claims=await verifyPartyTicket(raw.ticket,this.env.PARTY_SECRET);if(claims.partyId!==this.party.partyId||claims.roomCode!==this.party.roomCode||claims.matchId!==this.party.matchId){ws.close(1008,"ticket binding mismatch");return}
    const authenticatingParty=this.party;const now=Date.now();if(now-this.lastNonceCleanup>60_000){await this.state.storage.sql.exec("DELETE FROM party_ticket_nonce WHERE expires_at<=?",now);this.lastNonceCleanup=now}try{await this.state.storage.sql.exec("INSERT INTO party_ticket_nonce(nonce,expires_at) VALUES(?,?)",claims.nonce,claims.expiresAt)}catch{ws.close(1008,"ticket already used");return}
    if(this.party!==authenticatingParty){ws.close(1008,"match changed during authentication");return}
    if(claims.role==="player"){const seat=this.party.roster.find(s=>s.id===claims.seatId&&s.memberId===claims.memberId);if(!seat){ws.close(1008,"seat mismatch");return}const old=this.party.connectedActors[claims.memberId!];if(old){for(const existing of this.sockets()){const attached=existing.deserializeAttachment() as SocketMeta|null;if(attached?.socketId===old){try{existing.close(4001,"controller replaced")}catch{/* socket may already be closed */}}}}this.party.botIds=this.party.botIds.filter(id=>id!==seat.id);setPartySeatConnection(this.party,claims.memberId!,true,Date.now());this.party.inputs[seat.id]={seq:this.party.inputs[seat.id]?.seq??-1,x:0,y:0,bashDown:false,dash:false,receivedAt:Date.now()};
    }else if(claims.role==="display"||claims.role==="host"){this.party.displayAttachedAt=Date.now();this.party.displayLastSeenAt=Date.now()}
    const preauth=this.preauthTimers.get(ws);if(preauth)clearTimeout(preauth);this.preauthTimers.delete(ws);const socketId=crypto.randomUUID(),nextSeq=claims.seatId?(this.party.lastSequences[claims.seatId]??-1)+1:undefined,nextControlSeq=(this.party.controlSequences.host??-1)+1,attached:SocketMeta={authenticated:true,partyId:this.party.partyId,roomCode:this.party.roomCode,matchId:this.party.matchId,connectedAt:Date.now(),role:claims.role,memberId:claims.memberId,seatId:claims.seatId,socketId,canControl:true};if(claims.role==="player"){this.party.connectedActors[claims.memberId!]=socketId;}ws.serializeAttachment(attached);this.startTimer();ws.send(JSON.stringify({type:"ready",epoch:this.party.epoch,botEnabled:this.party.botEnabled??{},role:claims.role,seatId:claims.seatId,...(nextSeq===undefined?{}:{nextSeq,ackSeq:nextSeq-1}),...(claims.role==="host"?{nextControlSeq}:{}),...((claims.role==="display"||claims.role==="host")?{snapshot:projectSumoBootstrap(this.party)}:{})}));this.broadcastPlayerStatus(Date.now());return;
   }
   if(!meta?.authenticated||!meta.role){ws.close(1008,"authentication required");return}const parsed=validatePartyMessage(message,meta.role);
   this.ensureTimerAfterWake(Date.now());
   if(parsed.type==="ping"){if((meta.role==="display"||meta.role==="host")&&this.party.displayAttachedAt!==null)this.party.displayLastSeenAt=Date.now();ws.send(JSON.stringify({type:"pong",at:parsed.at,serverTime:Date.now(),tick:this.party.tick,epoch:this.party.epoch,paused:this.party.paused,phase:this.party.phase}));return}
   if(parsed.type==="input"){if(meta.role!=="player"||!meta.memberId||this.party.connectedActors[meta.memberId]!==meta.socketId)return;const now=Date.now(),rate=this.consumeRate(meta.memberId,now),accepted=rate&&acceptPartyInput(this.party,meta.memberId,parsed,now);ws.send(JSON.stringify({type:"input-ack",seq:parsed.seq,epoch:this.party.epoch,serverReceivedAt:now,tick:this.party.tick,accepted}));return}
   if(parsed.type==="control"){const now=Date.now(),result=controlSumoParty(this.party,meta.role,parsed,now);ws.send(JSON.stringify({type:"control-ack",seq:parsed.seq,epoch:this.party.epoch,...result}));if(result.ok){this.state.waitUntil(this.persistCheckpoint(now));if(parsed.operation==="start"||parsed.operation==="bot")this.broadcastBootstrap();else this.broadcastSnapshot(now);this.broadcastPlayerStatus(now)}}
  }catch(error){try{ws.send(JSON.stringify({type:"error",code:error instanceof Error?error.message:"PARTY_MESSAGE_INVALID"}))}catch{/* socket may already be closed */}}
 }
 private consumeRate(id:string,now:number):boolean{const prior=this.rates.get(id)??{tokens:120,updatedAt:now},tokens=Math.min(120,prior.tokens+(now-prior.updatedAt)*.06);if(tokens<1){this.rates.set(id,{tokens,updatedAt:now});return false}this.rates.set(id,{tokens:tokens-1,updatedAt:now});return true}
 async webSocketClose(ws:WebSocket){const timeout=this.preauthTimers.get(ws);if(timeout)clearTimeout(timeout);this.preauthTimers.delete(ws);const meta=ws.deserializeAttachment() as SocketMeta|null,party=this.party;if(party&&meta?.authenticated&&meta.memberId&&party.connectedActors[meta.memberId]===meta.socketId)setPartySeatConnection(party,meta.memberId,false,Date.now());if(this.sockets().length===0&&party?.phase==="LOBBY")this.stopTimer()}
 async webSocketError(ws:WebSocket){await this.webSocketClose(ws)}
}
interface SocketMeta{partyId?:string;roomCode?:string;matchId?:string;authenticated:boolean;connectedAt:number;role?:PartyRole;memberId?:string|null;seatId?:string|null;socketId?:string;canControl?:boolean}
