import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { PartyRoom, type PartyEnv } from '../party-worker/src/index';
import { signPartyTicket } from '../lib/party/security';
import { createSumoParty, controlSumoParty, stepSumoParty, setPartySeatConnection, projectSumoSnapshot, checkpointSumoParty, restoreSumoParty, type SumoParty } from '../lib/party/sumo-runtime';

type Internals = { party: SumoParty | null; persistCheckpoint(now:number):Promise<void>; persistResults(party:SumoParty):Promise<void>; resultsDurable():boolean };
const fresh = () => createSumoParty({partyId:'review',roomCode:'ABCD',matchId:'match',roster:[{id:'00',name:'Ada',memberId:'member'}],now:Date.now()});
function fixture() {
 const sql=new DatabaseSync(':memory:'); let initialized=Promise.resolve(); let failCheckpoint=false;const sockets:WebSocket[]=[];let nonceGate:(()=>Promise<void>)|null=null;
 const state={blockConcurrencyWhile:(fn:()=>Promise<void>)=>(initialized=fn()),getWebSockets:()=>sockets,storage:{setAlarm:async()=>{},transactionSync:<T>(fn:()=>T)=>{sql.exec('BEGIN');try{const result=fn();sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}},sql:{exec:(query:string,...args:(string|number|null)[])=>{
  if(failCheckpoint&&query.startsWith('INSERT INTO party_checkpoint')){failCheckpoint=false;throw new Error('temporary checkpoint failure');}
  const statement=sql.prepare(query);if(/^(SELECT|WITH)/i.test(query))return {toArray:()=>statement.all(...args)};statement.run(...args);if(nonceGate&&query.startsWith('INSERT INTO party_ticket_nonce'))return nonceGate().then(()=>({toArray:()=>[]}));return {toArray:()=>[]};
 }}}} as unknown as DurableObjectState;
 const env={PARTY_SECRET:'test-only',SITE_ORIGIN:'https://test.invalid',RESULT_CALLBACK_URL:'https://test.invalid/result'} as PartyEnv;
 return {sql,sockets,holdNonce:(gate:()=>Promise<void>)=>{nonceGate=gate;},failNextCheckpoint:()=>{failCheckpoint=true;},async room(){const room=new PartyRoom(state,env);await initialized;return {room,internal:room as unknown as Internals};}};
}
function result(party:SumoParty,index=0){return {v:1 as const,partyId:party.partyId,roomCode:party.roomCode,matchId:party.matchId,epoch:index,eventKey:`event-${index}`,winners:['00'],scores:{'00':1},round:1};}

test('delivered results remain reconnectable after cold restart and do not consume replay backlog',async()=>{
 const h=fixture(),{room,internal}=await h.room(),party=fresh();internal.party=party;party.phase='RESULTS';
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:200});
 try {
  for(let i=0;i<34;i++){party.lastResult=result(party,i);party.resultOutbox.push(party.lastResult);await internal.persistResults(party);await room.alarm();}
 } finally {globalThis.fetch=originalFetch;}
 const restored=await h.room();assert.equal(restored.internal.resultsDurable(),true);
 assert.equal(restored.internal.party!.resultOutbox.length,0);
 assert.deepEqual(projectSumoSnapshot(restored.internal.party!,{kind:'host',now:Date.now()}).winners,['00']);
 assert.equal(controlSumoParty(restored.internal.party!,'host',{operation:'start',seq:1,epoch:0},Date.now()).ok,true);
 assert.equal(h.sql.prepare('SELECT COUNT(*) AS n FROM party_outbox').get()!.n,0);
 h.sql.close();
});

test('old checkpoints requeue results missing from SQLite before allowing reconnect',async()=>{
 const h=fixture(),{internal}=await h.room(),party=fresh();party.phase='RESULTS';party.resultOutbox.push(result(party));internal.party=party;
 await internal.persistCheckpoint(Date.now());
 h.sql.exec("UPDATE party_checkpoint SET body=json_remove(body,'$.party.lastResult')");
 const restored=await h.room();assert.equal(restored.internal.resultsDurable(),true);
 assert.equal(h.sql.prepare('SELECT COUNT(*) AS n FROM party_outbox').get()!.n,1);
 assert.deepEqual(projectSumoSnapshot(restored.internal.party!,{kind:'host',now:Date.now()}).winners,['00']);h.sql.close();
});

test('callback acknowledgement retains durable retry when its checkpoint fails',async()=>{
 const h=fixture(),{room,internal}=await h.room(),party=fresh();party.phase='RESULTS';party.lastResult=result(party);party.resultOutbox.push(party.lastResult);internal.party=party;
 await internal.persistResults(party);h.failNextCheckpoint();
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:200});
 try{await assert.rejects(room.alarm(),/temporary checkpoint failure/);assert.equal(h.sql.prepare('SELECT COUNT(*) AS n FROM party_outbox').get()!.n,1);await room.alarm();}finally{globalThis.fetch=previous;}
 const restored=await h.room();assert.equal(restored.internal.resultsDurable(),true);assert.equal(restored.internal.party!.resultOutbox.length,0);h.sql.close();
});

test('a failed checkpoint rejects its operation but the next write can recover',async()=>{
 const h=fixture(),{internal}=await h.room();internal.party=fresh();h.failNextCheckpoint();
 await assert.rejects(internal.persistCheckpoint(1000),/temporary checkpoint failure/);
 await internal.persistCheckpoint(2000);
 assert.equal(h.sql.prepare('SELECT updated_at FROM party_checkpoint').get()!.updated_at,2000);h.sql.close();
});

test('phones that never connect time out to bots while authenticated phones remain human',()=>{
 const party=fresh(),now=party.updatedAt;
 assert.equal(party.roster[0]!.connected,false);assert.equal(party.roster[0]!.disconnectedAt,now);
 controlSumoParty(party,'host',{operation:'start',seq:1,epoch:0},now);stepSumoParty(party,now+65_000);
 assert.ok(party.botIds.includes('00'));
 const connected=fresh();setPartySeatConnection(connected,'member',true,now,'socket');stepSumoParty(connected,now+65_000);
 assert.equal(connected.roster[0]!.connected,true);assert.equal(connected.botIds.includes('00'),false);
});

test('cold recovery resets stale phone connectivity in every match phase',()=>{
 for(const phase of ['LOBBY','COUNTDOWN','PLAYING','RESULTS'] as const){
  const party=fresh(),now=party.updatedAt;party.phase=phase;setPartySeatConnection(party,'member',true,now,'old-socket');
  const restored=restoreSumoParty(checkpointSumoParty(party,now));
  assert.equal(restored.roster[0]!.connected,false,phase);assert.equal(restored.connectedActors.member,undefined,phase);
  stepSumoParty(restored,now+65_000);assert.ok(restored.botIds.includes('00'),phase);
 }
});

test('retirement waits behind queued checkpoint writes before deleting the checkpoint',async()=>{
 const h=fixture(),{room,internal}=await h.room(),party=fresh();internal.party=party;
 let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});
 (internal as unknown as {checkpointQueue:Promise<void>}).checkpointQueue=barrier;
 const pending=internal.persistCheckpoint(Date.now());
 const retiring=room.fetch(new Request('https://test.invalid/retire',{method:'POST',body:JSON.stringify({partyId:party.partyId,roomCode:party.roomCode,matchId:party.matchId})}));
 await new Promise(resolve=>setTimeout(resolve,0));release();await pending;await retiring;
 assert.equal(h.sql.prepare('SELECT COUNT(*) AS n FROM party_checkpoint').get()!.n,0);h.sql.close();
});

test('cold recovery rejects old match sockets and keeps only the newest bound controller',async()=>{
 const h=fixture(),{internal}=await h.room(),party=fresh();internal.party=party;await internal.persistCheckpoint(Date.now());
 const closed:string[]=[];
 const socket=(id:string,matchId:string,connectedAt:number)=>({deserializeAttachment:()=>({authenticated:true,role:'player',partyId:party.partyId,roomCode:party.roomCode,matchId,memberId:'member',seatId:'00',socketId:id,connectedAt}),close:()=>closed.push(id),send:()=>{}}) as unknown as WebSocket;
 const stale=socket('stale','old-match',100),older=socket('older',party.matchId,200),newer=socket('newer',party.matchId,300);
 h.sockets.push(newer,stale,older);
 const restored=await h.room();assert.equal(restored.internal.party!.connectedActors.member,'newer');assert.ok(closed.includes('stale'));assert.ok(closed.includes('older'));
 await restored.room.webSocketMessage(stale,JSON.stringify({type:'ping',at:1}));assert.equal(closed.filter(id=>id==='stale').length,2);h.sql.close();
});

test('a ticket cannot cross into a replacement match during nonce persistence',async()=>{
 const h=fixture(),{room,internal}=await h.room(),party=fresh();internal.party=party;
 Object.assign(room,{startTimer:()=>{}});
 let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>{release=r;}),waiting=new Promise<void>(r=>{entered=r;});h.holdNonce(()=>{entered();return gate;});
 let attachment:unknown={authenticated:false};const frames:string[]=[];
 const socket={deserializeAttachment:()=>attachment,serializeAttachment:(value:unknown)=>{attachment=value;},send:(frame:string)=>frames.push(frame),close:()=>{}} as unknown as WebSocket;h.sockets.push(socket);
 const ticket=await signPartyTicket({v:1,partyId:party.partyId,roomCode:party.roomCode,matchId:party.matchId,role:'player',seatId:'00',memberId:'member',name:'Ada',expiresAt:Date.now()+30_000,nonce:'review-auth-interleaving'},'test-only');
 const authenticating=room.webSocketMessage(socket,JSON.stringify({type:'auth',ticket}));await waiting;
 const prepared=await room.fetch(new Request('https://test.invalid/prepare',{method:'POST',body:JSON.stringify({partyId:party.partyId,roomCode:party.roomCode,matchId:'next-match',roster:[{id:'00',name:'Ada',memberId:'member'}]})}));expectPrepared(prepared);
 release();await authenticating;
 assert.equal(frames.some(frame=>JSON.parse(frame).type==='ready'),false);assert.equal(internal.party!.connectedActors.member,undefined);h.sql.close();
});
function expectPrepared(response:Response){assert.equal(response.status,200);}
