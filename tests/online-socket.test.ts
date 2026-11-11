import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {getOnlineEngine} from '../lib/arcade/online/engines';
import {signOnlineSocketTicket,verifyOnlineSocketTicket} from '../server/arcade/online/socket-security';
import {OnlineSocketBroker,retireOnlineSocketRoom} from '../server/arcade/online/socket-broker';
import {ONLINE_ARCADE_DDL} from '../server/arcade/online/schema';
import {SESSION_DDL} from '../server/sessions/schema';
import {sha256Hex} from '../server/crypto';
import {OnlineArcadeRoom} from '../party-worker/src/online-room';
import {OnlineArcadeService} from '../server/arcade/online/service';

const secret='test-secret-that-is-long-enough-for-this';
test('all six online adapters and standalone Sumo advance deterministically across JSON checkpoints',()=>{
 for(const gameId of ['twisted-system','roller-ruckus','scratch-match','tailblazer','air-hockey','light-trails','sumo']){
  const engine=getOnlineEngine(gameId);assert.ok(engine,gameId);const ids=['00','01'],state=engine.create(ids,712,{duration:45,crowns:3,players:2},[]);let restored=JSON.parse(JSON.stringify(state));
  for(let tick=1;tick<=12;tick++){restored=engine.step(restored,{ '00':{seq:tick,x:.2,y:-.3,heldActions:[],bashDown:false},'01':{seq:tick,x:-.1,y:.4,heldActions:[],bashDown:false}},[]);restored=JSON.parse(JSON.stringify(restored))}
  const view=engine.publicState(restored);assert.ok(view&&Array.isArray(view.winners)&&view.scores['00']!==undefined,gameId);assert.doesNotThrow(()=>JSON.stringify(view),gameId);
  if(gameId==='scratch-match'){const projected=JSON.stringify(view.view);assert.doesNotMatch(projected,/configuredSeed|randomState/);assert.ok((view.view as Record<string,unknown>).TUNING,'the phone bridge needs public static tuning')}
 }
});

test('socket tickets reject tampering, expired claims, and oversized future expiry',async()=>{
 const claims={v:1 as const,code:'ABCD',gameId:'tailblazer',generation:'a'.repeat(64),role:'player' as const,seatId:'00',seatTokenHash:'a'.repeat(64),expiresAt:31_000,nonce:'123e4567-e89b-42d3-a456-426614174000'};
 const ticket=await signOnlineSocketTicket(claims,secret);assert.equal((await verifyOnlineSocketTicket(ticket,secret,1000)).seatId,'00');
 await assert.rejects(()=>verifyOnlineSocketTicket(ticket.slice(0,-1)+'x',secret,1000));await assert.rejects(()=>verifyOnlineSocketTicket(ticket,secret,31_000));
 const future=await signOnlineSocketTicket({...claims,expiresAt:40_000},secret);await assert.rejects(()=>verifyOnlineSocketTicket(future,secret,1000));
});

async function dbFixture(){const sqlite=new DatabaseSync(':memory:');for(const sql of [...SESSION_DDL,...ONLINE_ARCADE_DDL])sqlite.exec(sql);const wrap=(sql:string,args:unknown[]=[]):D1PreparedStatement=>({bind:(...values:unknown[])=>wrap(sql,values),first:async()=>sqlite.prepare(sql).get(...args as never[])??null,all:async()=>({results:sqlite.prepare(sql).all(...args as never[])}),run:async()=>({meta:{changes:Number(sqlite.prepare(sql).run(...args as never[]).changes)}})}) as unknown as D1PreparedStatement;const db={prepare:wrap,batch:async(statements:D1PreparedStatement[])=>{sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}} as unknown as D1Database;const hash=await sha256Hex('host-cookie-secret');const state={gameId:'tailblazer',version:1,status:'PLAYING',options:{},matchId:'match-1',round:1,activeIds:['00','01'],wins:{'00':0,'01':0},cupComplete:false,paused:false,inputEpoch:1,runAt:0,engineState:{},lastResult:null};await db.prepare('INSERT INTO online_arcade_rooms VALUES(?,?,?,?,?,?,?,?)').bind('ABCD','tailblazer',hash,1,'PLAYING',JSON.stringify(state),1000,90000).run();const seatHash=await sha256Hex('seat-cookie-secret');await db.prepare("INSERT INTO online_arcade_seats(room_code,seat_id,token_hash,nickname,nickname_normalized,sequence,input_json,last_seen_at) VALUES('ABCD','00',?,'Alice','alice',0,'{}',1000)").bind(seatHash).run();return{sqlite,db,hash,seatHash,state}}

function fakeDurableState(checkpoint?:Record<string,unknown>){
 const sqlite=new DatabaseSync(':memory:');if(checkpoint)sqlite.exec(`CREATE TABLE online_checkpoint(id INTEGER PRIMARY KEY,body TEXT NOT NULL,updated_at INTEGER NOT NULL); INSERT INTO online_checkpoint VALUES(1,'${JSON.stringify(checkpoint).replaceAll("'","''")}',1)`);
 const sql={exec<T extends Record<string,unknown>>(query:string,...args:unknown[]){const statement=query.trimStart().toUpperCase();if(statement.startsWith('CREATE TABLE')){sqlite.exec(query);return{toArray:()=>[] as T[]}}if(statement.startsWith('SELECT'))return{toArray:()=>sqlite.prepare(query).all(...args as never[]) as T[]};return sqlite.prepare(query).run(...args as never[]) as unknown as {toArray:()=>T[]}}};
 const sockets:WebSocket[]=[];let alarmAt=0;const storage={sql,setAlarm:async(at:number)=>{alarmAt=at},getAlarm:async()=>alarmAt,deleteAlarm:async()=>{alarmAt=0}} as unknown as DurableObjectStorage;
 let initialized=Promise.resolve();const state={storage,blockConcurrencyWhile:<T>(callback:()=>Promise<T>)=>{initialized=callback().then(()=>undefined);return initialized},getWebSockets:()=>sockets,acceptWebSocket:(ws:WebSocket)=>{sockets.push(ws)}} as unknown as DurableObjectState;
 return{state,sockets,sqlite,ready:()=>initialized,alarm:()=>alarmAt};
}
const seatToken='a'.repeat(64),generation='b'.repeat(64);
function roomPrepare(overrides:Record<string,unknown>={}){const engine=getOnlineEngine('air-hockey')!;return{operation:'prepare',code:'ABCD',gameId:'air-hockey',generation,partyKey:`online-${generation}`,leaseExpiresAt:Date.now()+19*60_000,matchId:'match-1',round:1,status:'PLAYING',options:{},engineState:engine.create(['00','01'],712,{players:2},[]),activeIds:['00','01'],botIds:[],players:[{id:'00',name:'Alice'},{id:'01',name:'Bot'}],seatTokens:{'00':seatToken},botEnabled:{},wins:{'00':0,'01':0},cupComplete:false,paused:false,epoch:1,runAt:0,version:1,...overrides}}
function fakeSocket(meta:Record<string,unknown>){let attachment:Record<string,unknown>|null=meta;const sent:string[]=[];let closeCode=0;const socket={serializeAttachment(value:Record<string,unknown>){attachment=value},deserializeAttachment(){return attachment},send(value:string){sent.push(value)},close(code=1000){closeCode=code}} as unknown as WebSocket;return{socket,sent,closeCode:()=>closeCode}}

test('socket ticket creation checks host and seat cookies and binds room generation',async()=>{
 const f=await dbFixture(),calls:{body:Record<string,unknown>}[]=[];const broker=new OnlineSocketBroker(f.db,{PARTY_SECRET:secret,PARTY_WORKER_URL:'https://worker.test'},async(input,init)=>{calls.push({body:JSON.parse(String(init?.body))});return new Response('{}')},()=>1000);
 const request=(cookie:string,role:'host'|'player'='host')=>new Request('https://site.test/api/arcade/online/rooms/ABCD/socket',{method:'POST',headers:{origin:'https://site.test',cookie,'content-type':'application/json'},body:JSON.stringify({role})});
 assert.equal((await broker.ticket(request('callback_arcade_host_ABCD=wrong'),'ABCD')).status,401);
 const host=await broker.ticket(request('callback_arcade_host_ABCD=host-cookie-secret'),'ABCD');assert.equal(host.status,200);const ticket=await host.json() as {ticket:string;socketUrl:string};const claims=await verifyOnlineSocketTicket(ticket.ticket,secret,1000);assert.equal(claims.generation,f.hash);assert.equal(claims.role,'host');assert.equal(new URL(ticket.socketUrl).pathname,'/online-arcade/ABCD/socket');assert.equal(calls.length,1);assert.equal(calls[0]!.body.partyKey,`online-${f.hash}`);
 const player=await broker.ticket(request('callback_arcade_seat_ABCD=seat-cookie-secret','player'),'ABCD');assert.equal(player.status,200);const playerClaims=await verifyOnlineSocketTicket((await player.json() as {ticket:string}).ticket,secret,1000);assert.equal(playerClaims.seatId,'00');
});

test('mirror ticket works when the Site broker has no SITE_ORIGIN binding',async()=>{
 const f=await dbFixture(),mirrorToken='valid-mirror-cookie',mirrorHash=await sha256Hex(mirrorToken);f.sqlite.prepare("INSERT INTO callback_sessions(code,host_token_hash,version,stage,active_id,expires_at) VALUES('PARN',?,1,'PLAYING','child-1',90000)").run(f.hash);f.sqlite.prepare("INSERT INTO callback_session_games(id,session_code,child_kind,child_code,active,game_json,created_at) VALUES('child-1','PARN','online','ABCD',1,'{}',1)").run();f.sqlite.prepare('INSERT INTO callback_session_mirrors(token_hash,session_code,last_seen_at) VALUES(?,?,?)').run(mirrorHash,'PARN',1000);
 const broker=new OnlineSocketBroker(f.db,{PARTY_SECRET:secret,PARTY_WORKER_URL:'https://worker.test'},async()=>new Response('{}'),()=>1000),request=new Request('https://site.test/api/arcade/online/rooms/ABCD/socket',{method:'POST',headers:{origin:'https://site.test',cookie:`callback_lobby_mirror_PARN=${mirrorToken}`,'content-type':'application/json'},body:JSON.stringify({role:'display'})});const response=await broker.ticket(request,'ABCD');assert.equal(response.status,200);const payload=await response.json() as {ticket:string};const claims=await verifyOnlineSocketTicket(payload.ticket,secret,1000);assert.equal(claims.role,'display');assert.equal(claims.seatId,null);
});

test('result callback is idempotent and room retirement keeps the session lease key after deactivation',async()=>{
 const f=await dbFixture(),broker=new OnlineSocketBroker(f.db,{PARTY_SECRET:secret},fetch,()=>2000),event={code:'ABCD',gameId:'tailblazer',generation:f.hash,matchId:'match-1',round:1,winners:['00'],scores:{'00':3,'01':1},eventKey:'ABCD:match-1'};
 const request=()=>new Request('https://site.test/api/arcade/online/socket-result',{method:'POST',headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},body:JSON.stringify(event)});
 assert.equal((await broker.result(request())).status,200);assert.equal((await broker.result(request())).status,200);const saved=await f.db.prepare("SELECT state_json FROM online_arcade_rooms WHERE code='ABCD'").first<{state_json:string}>();assert.equal(JSON.parse(saved!.state_json).wins['00'],1);const count=await f.db.prepare('SELECT count(*) AS n FROM online_arcade_results').first<{n:number}>();assert.equal(count?.n,1);
 f.sqlite.prepare("INSERT INTO callback_session_games(id,session_code,child_kind,child_code,game_json,created_at,active) VALUES('child-2','PARN','online','ABCD','{}',1,0)").run();let retired:Record<string,unknown>|null=null;await retireOnlineSocketRoom(f.db,{PARTY_SECRET:secret,PARTY_WORKER_URL:'https://worker.test'},'ABCD',async(_url,init)=>{retired=JSON.parse(String(init?.body));return new Response('{}')});assert.equal((retired as Record<string,unknown>|null)?.partyKey,'session-PARN');
});

test('standalone Sumo socket results retain its one-crown match rule',async()=>{
 const f=await dbFixture(),state={...f.state,gameId:'sumo',options:{crowns:3}};await f.db.prepare("UPDATE online_arcade_rooms SET game_id='sumo',state_json=? WHERE code='ABCD'").bind(JSON.stringify(state)).run();const broker=new OnlineSocketBroker(f.db,{PARTY_SECRET:secret},fetch,()=>2000),event={code:'ABCD',gameId:'sumo',generation:f.hash,matchId:'match-1',round:1,winners:['00'],scores:{'00':3,'01':1},eventKey:'ABCD:match-1'};const response=await broker.result(new Request('https://site.test/api/arcade/online/socket-result',{method:'POST',headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},body:JSON.stringify(event)}));assert.equal(response.status,200);const saved=await f.db.prepare("SELECT state_json FROM online_arcade_rooms WHERE code='ABCD'").first<{state_json:string}>();assert.equal(JSON.parse(saved!.state_json).cupComplete,true);
});

test('DO prepare preserves a paused live match and clears input from its previous epoch',async()=>{
 const engine=getOnlineEngine('air-hockey')!,startedAt=Date.now()-60_000,base=roomPrepare(),state=engine.step(base.engineState as never,{'00':{seq:1,x:1,y:0,heldActions:[],bashDown:false},'01':{seq:0,x:0,y:0,heldActions:[],bashDown:false}},[]),checkpoint={...base,startedAt,updatedAt:1,tick:41,engineState:state,inputs:{'00':{seq:8,x:1,y:0,heldActions:[],bashDown:false,receivedAt:Date.now()}},lastSeq:{'00':8},consumedSeq:{'00':7}};
 const fake=fakeDurableState(checkpoint),doRoom=new OnlineArcadeRoom(fake.state,{PARTY_SECRET:secret,SITE_ORIGIN:'https://site.test',ONLINE_ARCADE_ROOM:{} as DurableObjectNamespace,PARTY_ADMISSION:{} as DurableObjectNamespace});await fake.ready();(doRoom as unknown as {stopTimer():void}).stopTimer();
 const first=await doRoom.fetch(new Request('https://online/control',{method:'POST',body:JSON.stringify(roomPrepare({version:2,paused:true,epoch:2,engineState:base.engineState}))}));assert.equal(first.status,200);
 const second=await doRoom.fetch(new Request('https://online/control',{method:'POST',body:JSON.stringify(roomPrepare({version:3,paused:false,epoch:3,engineState:base.engineState}))}));assert.equal(second.status,200);
 const saved=JSON.parse(String(fake.sqlite.prepare('SELECT body FROM online_checkpoint WHERE id=1').get()?.body)) as Record<string,unknown>;
 assert.deepEqual(saved.engineState,state);assert.equal(saved.tick,41);assert.equal(saved.startedAt,startedAt);assert.equal(saved.epoch,3);assert.deepEqual(saved.inputs,{});assert.deepEqual(saved.consumedSeq,{});assert.deepEqual(saved.lastSeq,{'00':8});(doRoom as unknown as {stopTimer():void}).stopTimer();
});

test('DO recovery expires against its persisted lease deadline and releases standalone admission',async()=>{
 const calls:unknown[]=[],base=roomPrepare(),expired={...base,startedAt:Date.now()-60*60_000,leaseExpiresAt:Date.now()-1000,updatedAt:1},fake=fakeDurableState(expired),admission={idFromName:()=> 'global',get:()=>({fetch:async(_input:RequestInfo|URL,init?:RequestInit)=>{calls.push(JSON.parse(String(init?.body)));return new Response('{}')}})},doRoom=new OnlineArcadeRoom(fake.state,{PARTY_SECRET:secret,SITE_ORIGIN:'https://site.test',ONLINE_ARCADE_ROOM:{} as DurableObjectNamespace,PARTY_ADMISSION:admission as unknown as DurableObjectNamespace});await fake.ready();(doRoom as unknown as {stopTimer():void}).stopTimer();await doRoom.alarm();assert.equal(calls.length,1);assert.deepEqual(calls[0],{partyId:`online-${generation}`});assert.equal(fake.sqlite.prepare('SELECT count(*) AS n FROM online_checkpoint').get()?.n,0);
});

test('DO closes a removed player socket when a different token reoccupies that seat',async()=>{
 const base=roomPrepare(),fake=fakeDurableState({...base,startedAt:Date.now(),updatedAt:1}),old=fakeSocket({authenticated:true,role:'player',seatId:'00',seatTokenHash:seatToken,generation,connectedAt:Date.now()});fake.sockets.push(old.socket);const doRoom=new OnlineArcadeRoom(fake.state,{PARTY_SECRET:secret,SITE_ORIGIN:'https://site.test',ONLINE_ARCADE_ROOM:{} as DurableObjectNamespace,PARTY_ADMISSION:{} as DurableObjectNamespace});await fake.ready();(doRoom as unknown as {stopTimer():void}).stopTimer();const response=await doRoom.fetch(new Request('https://online/control',{method:'POST',body:JSON.stringify(roomPrepare({version:2,seatTokens:{'00':'c'.repeat(64)}}))}));assert.equal(response.status,200);assert.equal(old.closeCode(),4003);(doRoom as unknown as {stopTimer():void}).stopTimer();
});

test('HTTP tick and input cannot report success while persistent simulation owns the room',async()=>{
 const f=await dbFixture(),engine=getOnlineEngine('tailblazer')!;Object.assign(f.state,{engineState:engine.create(['00','01'],712,{players:2},[]),socketActive:true,simTick:0,lastTickAt:1000,accumulator:0,consumed:{}});await f.db.prepare("UPDATE online_arcade_rooms SET state_json=? WHERE code='ABCD'").bind(JSON.stringify(f.state)).run();const service=new OnlineArcadeService(f.db,id=>getOnlineEngine(id),()=>2000),host=await service.host(new Request('https://site.test/api/rooms/ABCD/host-actions',{method:'POST',headers:{origin:'https://site.test',cookie:'callback_arcade_host_ABCD=host-cookie-secret','content-type':'application/json'},body:JSON.stringify({operation:'tick'})}),'ABCD'),player=await service.input(new Request('https://site.test/api/rooms/ABCD/player-actions',{method:'POST',headers:{origin:'https://site.test',cookie:'callback_arcade_seat_ABCD=seat-cookie-secret','content-type':'application/json'},body:JSON.stringify({matchId:'match-1',seq:1,x:1,y:0})}),'ABCD');assert.equal(host.status,200);assert.equal(player.status,409);assert.equal((await player.json() as {error:{code:string}}).error.code,'REALTIME_ONLY');const saved=await f.db.prepare("SELECT version,state_json FROM online_arcade_rooms WHERE code='ABCD'").first<{version:number;state_json:string}>();assert.equal(saved?.version,1);assert.equal(JSON.parse(saved!.state_json).simTick,0);
});
