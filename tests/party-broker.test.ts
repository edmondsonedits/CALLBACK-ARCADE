import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { SESSION_DDL } from '../server/sessions/schema';
import { ONLINE_ARCADE_DDL } from '../server/arcade/online/schema';
import { sha256Hex } from '../server/crypto';
import { verifyPartyTicket } from '../lib/party/security';
import { PartyBroker } from '../server/party/broker';

async function fixture() {
  const sqlite=new DatabaseSync(':memory:');for(const sql of [...SESSION_DDL,...ONLINE_ARCADE_DDL])sqlite.exec(sql);
  const wrap=(sql:string,args:unknown[]=[]):D1PreparedStatement=>({bind:(...values:unknown[])=>wrap(sql,values),first:async()=>sqlite.prepare(sql).get(...args as never[])??null,all:async()=>({results:sqlite.prepare(sql).all(...args as never[])}),run:async()=>({meta:{changes:Number(sqlite.prepare(sql).run(...args as never[]).changes)}})}) as unknown as D1PreparedStatement;
  const db={prepare:wrap,batch:async(statements:D1PreparedStatement[])=>{sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}} as unknown as D1Database;
  const hostHash=await sha256Hex('host-secret'),seatHash=await sha256Hex('seat-secret');
  await db.prepare("INSERT INTO callback_sessions(code,host_token_hash,version,stage,active_id,expires_at) VALUES('ABCD',?,1,'PLAYING','match-1',90000)").bind(hostHash).run();
  await db.prepare("INSERT INTO callback_session_games(id,session_code,child_kind,child_code,game_json,created_at,active) VALUES('match-1','ABCD','online','EFGH','{}',100,1)").run();
  await db.prepare("INSERT INTO callback_session_members(id,session_code,seat,token_hash,nickname,nickname_normalized,avatar_preset,last_seen_at) VALUES('member-1','ABCD',0,?,'Alice','alice',NULL,100)").bind(seatHash).run();
  const state={options:{realtimePilot:true,partyId:'match-1'},matchId:'match-1',wins:{'00':0},round:0};
  await db.prepare("INSERT INTO online_arcade_rooms VALUES('EFGH','sumo',?,1,'LOBBY',?,100,90000)").bind(hostHash,JSON.stringify(state)).run();
  await db.prepare("INSERT INTO online_arcade_seats VALUES('EFGH','00',?,'Alice','alice',0,'{}',100)").bind(seatHash).run();
  const secret='test-secret-with-at-least-thirty-two-characters';
  return {db,secret,broker:new PartyBroker(db,{PARTY_SECRET:secret,PARTY_WORKER_URL:'https://party.test'},fetch,()=>1000)};
}
const req=(cookie='',body:unknown={role:'player'})=>new Request('https://callback.test/api/arcade/online/rooms/EFGH/realtime',{method:'POST',headers:{origin:'https://callback.test',cookie,'content-type':'application/json'},body:JSON.stringify(body)});
test('ticket identity is derived from active parent membership and child cookies',async()=>{
  const f=await fixture();assert.equal((await f.broker.ticket(req(),'EFGH')).status,401);
  assert.equal((await f.broker.ticket(req('callback_arcade_seat_EFGH=seat-secret',{role:'host'}),'EFGH')).status,401);
  const response=await f.broker.ticket(req('callback_arcade_seat_EFGH=seat-secret'),'EFGH');assert.equal(response.status,200);
  const issued=await response.json() as {ticket:string;socketUrl:string};const claims=await verifyPartyTicket(issued.ticket,f.secret,1000);
  assert.equal(claims.memberId,'member-1');assert.equal(claims.seatId,'00');assert.equal(claims.partyId,'match-1');assert.equal(claims.role,'player');assert.equal(claims.expiresAt,31000);assert.equal(new URL(issued.socketUrl).search,'');
  await f.db.prepare("UPDATE callback_session_games SET active=0 WHERE id='match-1'").run();assert.equal((await f.broker.ticket(req('callback_arcade_seat_EFGH=seat-secret'),'EFGH')).status,409);
});
test('worker results are authenticated and stored exactly once, including delayed retired results',async()=>{
  const f=await fixture();const body={v:1,partyId:'match-1',roomCode:'EFGH',matchId:'match-1',epoch:2,eventKey:'sumo:match-1:match-1:2:result',winners:['00'],scores:{'00':2},round:2};
  const resultReq=(secret=f.secret,payload:unknown=body)=>new Request('https://callback.test/api/party/events',{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json'},body:JSON.stringify(payload)});
  assert.equal((await f.broker.result(resultReq('wrong'))).status,401);
  assert.equal((await f.broker.result(resultReq(f.secret,{...body,matchId:'wrong',eventKey:'sumo:match-1:wrong:2:result'}))).status,409);
  await f.db.prepare("UPDATE callback_session_games SET active=0 WHERE id='match-1'").run();
  assert.equal((await f.broker.result(resultReq())).status,200);assert.equal((await f.broker.result(resultReq())).status,200);
  const count=await f.db.prepare('SELECT count(*) AS n FROM online_arcade_results').first<{n:number}>();assert.equal(count?.n,1);
  const row=await f.db.prepare("SELECT state_json FROM online_arcade_rooms WHERE code='EFGH'").first<{state_json:string}>();assert.equal(JSON.parse(row!.state_json).wins['00'],0,'retired results cannot mutate a current game');
});

test('active results commit once when the clock advances between database statements',async()=>{
 const f=await fixture();let now=1000;const broker=new PartyBroker(f.db,{PARTY_SECRET:f.secret,PARTY_WORKER_URL:'https://party.test'},fetch,()=>++now);
 const body={v:1,partyId:'match-1',roomCode:'EFGH',matchId:'match-1',epoch:2,eventKey:'sumo:match-1:match-1:2:result',winners:['00'],scores:{'00':2},round:2};
 const request=()=>new Request('https://callback.test/api/party/events',{method:'POST',headers:{authorization:'Bearer '+f.secret,'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await broker.result(request())).status,200);assert.equal((await broker.result(request())).status,200);
 const row=await f.db.prepare("SELECT version,status,state_json FROM online_arcade_rooms WHERE code='EFGH'").first<{version:number;status:string;state_json:string}>();assert.equal(row?.status,'RESULT');assert.equal(row?.version,2);assert.equal(JSON.parse(row!.state_json).wins['00'],1);
});

test('a result produced by the original Sumo runtime is accepted by the broker',async()=>{
 const {createSumoParty,controlSumoParty,stepSumoParty}=await import('../lib/party/sumo-runtime');
 const f=await fixture(),party=createSumoParty({partyId:'match-1',roomCode:'EFGH',matchId:'match-1',now:0,options:{winTarget:1},roster:[{id:'00',memberId:'member-1',name:'Alice'}]});
 controlSumoParty(party,'host',{operation:'start',seq:1,epoch:0},0);stepSumoParty(party,3000);for(let i=1;i<300&&party.liveSimulation!.phase!=='fight';i++)stepSumoParty(party,3000+i*1000/60);assert.equal(party.liveSimulation!.phase,'fight');party.liveSimulation!.endRound(0);
 for(let i=1;i<900&&party.phase!=='RESULTS';i++)stepSumoParty(party,8000+i*1000/60);
 assert.equal(party.phase,'RESULTS');const body=party.resultOutbox[0];assert.ok(body);
 const request=new Request('https://callback.test/api/party/events',{method:'POST',headers:{authorization:'Bearer '+f.secret,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal((await f.broker.result(request)).status,200);
});
