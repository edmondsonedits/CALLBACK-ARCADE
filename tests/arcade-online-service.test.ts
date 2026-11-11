import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {ARENA_ONLINE_ENGINES} from '../lib/arcade/online/arena-engines';
import {SUMO_ONLINE_ENGINE,type SumoOnlineRenderView} from '../lib/arcade/online/sumo';import {restoreSumoSim} from '../lib/arcade/online/sumo-codec';import {ONLINE_ARCADE_DDL} from '../server/arcade/online/schema';
function database():D1Database {const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const sql of ONLINE_ARCADE_DDL)sqlite.exec(sql);class Statement {values:unknown[]=[];constructor(readonly sql:string){if((sql.match(/\bUNION\s+ALL\s+SELECT\b/gi)?.length??0)>=9)throw Error('D1_ERROR: too many terms in compound SELECT: SQLITE_ERROR')}bind(...values:unknown[]){this.values=values;return this}async first(){return sqlite.prepare(this.sql).get(...this.values as (string|number|null)[])??null}async all(){return {results:sqlite.prepare(this.sql).all(...this.values as (string|number|null)[])}}async run(){const r=sqlite.prepare(this.sql).run(...this.values as (string|number|null)[]);return {success:true,meta:{changes:Number(r.changes)}}}}return {prepare:(sql:string)=>new Statement(sql),async batch(stmts:Statement[]){sqlite.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}}} as unknown as D1Database;}
interface View {code:string;matchId:string;restored:boolean;paused:boolean;status:string;version:number;wins:Record<string,number>;lastResult:{winners:string[];scores:Record<string,number>}|null;players:{id:string;connected:boolean}[];game:{view:{frame:{actors:{id:string;x:number;y:number;height?:number}[];tick:number}};finished:boolean;winners:string[];scores:Record<string,number>}}
const json=async(response:Response)=>await response.json() as View;
const origin='https://arcade.test';const req=(path:string,body?:unknown,cookie?:string)=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
// Exercise the archived arena engine through a test-only alias; production
// availability gates remain enabled and persisted simulation checks stay intact.
async function setup(gameId='test-arena'){const m=await import('../server/arcade/online/service').catch(()=>null);assert.ok(m?.OnlineArcadeService,'online service is missing');let now=1000;const db=database(),fixture={...ARENA_ONLINE_ENGINES.find(g=>g.id==='snow-bash')!,id:'test-arena'},service=new m.OnlineArcadeService(db,id=>[fixture,...ARENA_ONLINE_ENGINES,SUMO_ONLINE_ENGINE].find(g=>g.id===id)??null,()=>now);const created=await service.create(req('/rooms',{gameId,options:{duration:30,crowns:1}})),body=await json(created);assert.equal(created.status,201);return {db,service,code:body.code as string,host:created.headers.get('set-cookie')!.split(';')[0],advance:(ms:number)=>{now+=ms}}}

test('online session children require parent admission while standalone joining still works',async()=>{
 const h=await setup();
 await h.db.prepare("INSERT INTO callback_session_games(id,session_code,child_kind,child_code,active,game_json,created_at) VALUES('child','ABCD','online',?,1,'{}',1000)").bind(h.code).run();
 const blocked=await h.service.join(req('/join',{nickname:'Unlisted'}),h.code);
 assert.equal(blocked.status,409);assert.equal((await blocked.json() as {error:{code:string}}).error.code,'SESSION_JOIN_REQUIRED');
 const standalone=await setup();assert.equal((await standalone.service.join(req('/join',{nickname:'Allowed'}),standalone.code)).status,201);
});

test('retired session instances reject a controller write that began before New Game',async()=>{
 const h=await setup(),joined=await h.service.join(req('/join',{nickname:'One'}),h.code),cookie=joined.headers.get('set-cookie')!.split(';')[0];
 const state=await json(await h.service.host(req('/host',{operation:'start'},h.host),h.code));
 const prepare=h.db.prepare.bind(h.db);
 h.db.prepare=((sql:string)=>{const statement=prepare(sql);if(!sql.startsWith('UPDATE online_arcade_seats SET sequence'))return statement;
   return {...statement,bind:(...values:unknown[])=>{const bound=statement.bind(...values);return {...bound,run:async()=>{await prepare("INSERT INTO callback_session_games(id,session_code,child_kind,child_code,active,game_json,created_at) VALUES('old','ABCD','online',?,0,'{}',0)").bind(h.code).run();return bound.run();}};}} as D1PreparedStatement;
 }) as D1Database['prepare'];
 assert.equal((await h.service.input(req('/input',{matchId:state.matchId,seq:1,x:1,y:0},cookie),h.code)).status,409);
 assert.equal((await prepare('SELECT sequence FROM online_arcade_seats WHERE room_code=?').bind(h.code).first<{sequence:number}>())?.sequence,0);
 assert.equal((await h.service.snapshot(req('/sync',undefined,cookie),h.code)).status,404);
});
test('atomic phone joining fills ten separate seats, restores refresh and rejects eleven',async()=>{const h=await setup();const joined=[];for(let i=0;i<10;i++)joined.push(await h.service.join(req('/join',{nickname:'Player '+i}),h.code));assert.ok(joined.every(r=>r.status===201));assert.equal((await h.service.join(req('/join',{nickname:'Eleven'}),h.code)).status,409);const cookie=joined[0]!.headers.get('set-cookie')!.split(';')[0];const restored=await h.service.join(req('/join',{nickname:'Changed'},cookie),h.code);assert.equal(restored.status,200);const self=await json(restored);assert.equal(self.restored,true);const view=await h.service.snapshot(req('/sync',undefined,h.host),h.code);const state=await json(view);assert.equal(state.players.length,10);assert.equal(new Set(state.players.map((p:{id:string})=>p.id)).size,10);assert.equal(JSON.stringify(state).includes('token_hash'),false);});
test('only authenticated host advances games and each phone controls only its assigned seat',async()=>{const h=await setup(),one=await h.service.join(req('/join',{nickname:'One'}),h.code),cookie=one.headers.get('set-cookie')!.split(';')[0];assert.equal((await h.service.host(req('/host',{operation:'start'},cookie),h.code)).status,401);const started=await h.service.host(req('/host',{operation:'start'},h.host),h.code),state=await json(started);assert.equal(started.status,200);const sent=await h.service.input(req('/input',{matchId:state.matchId,seq:1,x:1,y:0,action:'pickup'},cookie),h.code);assert.equal(sent.status,200);h.advance(4000);const tick=await h.service.host(req('/host',{operation:'tick'},h.host),h.code);const next=await json(tick);assert.equal(next.game.view.frame.actors.length,10);assert.ok(next.game.view.frame.tick>0);assert.equal((await h.service.snapshot(req('/sync'),h.code)).status,401);assert.equal((await h.service.input(req('/input',{matchId:state.matchId,seq:2,x:0,y:0,playerId:'09'},cookie),h.code)).status,422);});
test('input retries are idempotent, stale generations are rejected and pause stops simulation',async()=>{const h=await setup(),one=await h.service.join(req('/join',{nickname:'One'}),h.code),cookie=one.headers.get('set-cookie')!.split(';')[0],started=await h.service.host(req('/host',{operation:'start'},h.host),h.code),state=await json(started);const input={matchId:state.matchId,seq:1,x:1,y:0};assert.equal((await h.service.input(req('/input',input,cookie),h.code)).status,200);assert.equal((await h.service.input(req('/input',input,cookie),h.code)).status,200);assert.equal((await h.service.input(req('/input',{...input,x:-1},cookie),h.code)).status,409);assert.equal((await h.service.input(req('/input',{...input,seq:2,matchId:'old'},cookie),h.code)).status,409);const paused=await h.service.host(req('/host',{operation:'pause'},h.host),h.code),before=await json(paused);h.advance(4000);const tick=await h.service.host(req('/host',{operation:'tick'},h.host),h.code),after=await json(tick);assert.equal(after.game.view.frame.tick,before.game.view.frame.tick);assert.equal(after.paused,true);});
test('foreign-origin requests cannot create or mutate rooms',async()=>{const h=await setup();const cross=new Request(origin+'/rooms',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:JSON.stringify({gameId:'snow-bash'})});assert.equal((await h.service.create(cross)).status,403);});
test('a host can also play on the same browser without losing either role',async()=>{const h=await setup(),joined=await h.service.join(req('/join',{nickname:'Host player'},h.host),h.code),seat=joined.headers.get('set-cookie')!.split(';')[0],cookies=h.host+'; '+seat,started=await h.service.host(req('/host',{operation:'start'},cookies),h.code),state=await json(started);assert.equal((await h.service.input(req('/input',{matchId:state.matchId,seq:1,x:1,y:0},cookies),h.code)).status,200);const request=req('/sync',undefined,cookies);request.headers.set('x-callback-online-role','player');const self=await h.service.snapshot(request,h.code),body=await self.json() as {role:string;selfId:string};assert.equal(body.role,'player');assert.equal(body.selfId,'00');});

test('snapshot heartbeats preserve the phone connection without reviving expired movement',async()=>{
 const h=await setup(),joined=await h.service.join(req('/join',{nickname:'One'}),h.code),cookie=joined.headers.get('set-cookie')!.split(';')[0];
 const started=await json(await h.service.host(req('/host',{operation:'start'},h.host),h.code)),initial=started.game.view.frame.actors.find(p=>p.id==='00')!;
 assert.equal((await h.service.input(req('/input',{matchId:started.matchId,seq:1,x:1,y:0},cookie),h.code)).status,200);
 h.advance(3200);
 const heartbeat=await json(await h.service.snapshot(req('/sync',undefined,cookie),h.code));assert.equal(heartbeat.players.find(p=>p.id==='00')!.connected,true);
 const next=await json(await h.service.host(req('/host',{operation:'tick'},h.host),h.code)),actor=next.game.view.frame.actors.find(p=>p.id==='00')!;
 assert.ok(next.game.view.frame.tick>0);assert.equal(actor.x,initial.x,'expired movement must be neutral despite a fresh heartbeat');assert.equal(actor.y,initial.y);
});
test('snapshot heartbeats do not revive expired held Sumo charge',async()=>{
 const h=await setup('sumo'),joined=await h.service.join(req('/join',{nickname:'One'}),h.code),cookie=joined.headers.get('set-cookie')!.split(';')[0];
 const started=await json(await h.service.host(req('/host',{operation:'start'},h.host),h.code));
 assert.equal((await h.service.input(req('/input',{matchId:started.matchId,seq:1,x:0,y:0,heldActions:['charge'],bashDown:true},cookie),h.code)).status,200);
 h.advance(1000);await h.service.snapshot(req('/sync',undefined,cookie),h.code);
 const next=await h.service.host(req('/host',{operation:'tick'},h.host),h.code),body=await next.json() as {game:{view:SumoOnlineRenderView}},sim=restoreSumoSim(body.game.view.sim);
 assert.equal(sim.inputs[0].bashDown,false,'expired held charge must be released despite a fresh heartbeat');
});
test('pause rejects controller input and resume discards levels and queued actions from before the pause',async()=>{
 const h=await setup(),joined=await h.service.join(req('/join',{nickname:'One'}),h.code),cookie=joined.headers.get('set-cookie')!.split(';')[0];
 const started=await json(await h.service.host(req('/host',{operation:'start'},h.host),h.code)),initial=started.game.view.frame.actors.find(p=>p.id==='00')!;
 h.advance(3200);const input={matchId:started.matchId,seq:1,x:1,y:0,action:'jump'};
 assert.equal((await h.service.input(req('/input',input,cookie),h.code)).status,200);
 await h.service.host(req('/host',{operation:'pause'},h.host),h.code);h.advance(20);
 assert.equal((await h.service.input(req('/input',{...input,seq:2},cookie),h.code)).status,409,'paused rooms must reject input');
 await h.service.host(req('/host',{operation:'resume'},h.host),h.code);h.advance(100);
 const next=await json(await h.service.host(req('/host',{operation:'tick'},h.host),h.code)),actor=next.game.view.frame.actors.find(p=>p.id==='00')!;
 assert.equal(actor.x,initial.x,'resume must not revive pre-pause movement');assert.equal(actor.y,initial.y);assert.equal(actor.height,0,'resume must not execute a queued pre-pause jump');
 h.advance(20);assert.equal((await h.service.input(req('/input',{...input,seq:3},cookie),h.code)).status,200);h.advance(100);
 const active=await json(await h.service.host(req('/host',{operation:'tick'},h.host),h.code)),controlled=active.game.view.frame.actors.find(p=>p.id==='00')!;
 assert.ok(controlled.x>initial.x);assert.ok(controlled.height!>0,'new post-resume actions must remain usable');
});
test('the player snapshot requires a seat even when the same browser owns the host cookie',async()=>{
 const h=await setup(),request=req('/sync',undefined,h.host);request.headers.set('x-callback-online-role','player');
 assert.equal((await h.service.snapshot(request,h.code)).status,401);
 const joined=await h.service.join(req('/join',{nickname:'Host player'},h.host),h.code);assert.equal(joined.status,201);
 const body=await joined.json() as {role:string;selfId:string};assert.equal(body.role,'player');assert.equal(body.selfId,'00');
});

test('actual Snow Bash terminal scores are persisted once and repeated host ticks leave the result unchanged',async()=>{
 const h=await setup(),joined=await h.service.join(req('/join',{nickname:'One'}),h.code),cookie=joined.headers.get('set-cookie')!.split(';')[0];
 let room=await json(await h.service.host(req('/host',{operation:'start'},h.host),h.code));
 for(let attempt=0;attempt<160&&room.status==='PLAYING';attempt++){
  h.advance(250);await h.service.snapshot(req('/sync',undefined,cookie),h.code);
  const response=await h.service.host(req('/host',{operation:'tick'},h.host),h.code);assert.equal(response.status,200);room=await json(response);
 }
 assert.equal(room.status,'RESULT','the actual bounded Snow Bash match must terminate');assert.equal(room.game.finished,true);
 assert.deepEqual(room.lastResult?.winners,room.game.winners);assert.deepEqual(room.lastResult?.scores,room.game.scores);
 const before=room;
 for(let retry=0;retry<3;retry++){h.advance(250);room=await json(await h.service.host(req('/host',{operation:'tick'},h.host),h.code));}
 assert.equal(room.version,before.version);assert.deepEqual(room.wins,before.wins);assert.deepEqual(room.lastResult,before.lastResult);
 const results=await h.db.prepare('SELECT result_json FROM online_arcade_results WHERE room_code=? AND match_id=?').bind(h.code,room.matchId).all<{result_json:string}>();
 assert.equal(results.results.length,1,'one terminal match creates exactly one persisted result');assert.deepEqual(JSON.parse(results.results[0]!.result_json),room.lastResult);
});

test('HTTP controllers cannot submit charge power or client-authored scores',async()=>{const h=await setup(),one=await h.service.join(req('/join',{nickname:'One'}),h.code),cookie=one.headers.get('set-cookie')!.split(';')[0],state=await json(await h.service.host(req('/host',{operation:'start'},h.host),h.code));for(const extra of [{bashPower:1},{score:999},{winner:'00'}])assert.equal((await h.service.input(req('/input',{matchId:state.matchId,seq:1,x:0,y:0,...extra},cookie),h.code)).status,422);});


test('an active session mirror reads Online Arcade public state without driving or controlling the match',async()=>{
  const h=await setup('sumo');
  const {SESSION_DDL}=await import('../server/sessions/schema');for(const sql of SESSION_DDL)await h.db.prepare(sql).run();
  const {sha256Hex}=await import('../server/crypto');
  await h.db.prepare("INSERT INTO callback_sessions(code,host_token_hash,version,stage,active_id,expires_at) VALUES('ABCD','host',1,'PLAYING','game',100000)").run();
  await h.db.prepare("INSERT INTO callback_session_games(id,session_code,child_kind,child_code,active,game_json,created_at) VALUES('game','ABCD','online',?,1,'{}',0)").bind(h.code).run();
  await h.db.prepare("INSERT INTO callback_session_mirrors(token_hash,session_code,last_seen_at) VALUES(?,'ABCD',1000)").bind(await sha256Hex('mirror-secret')).run();
  const cookie='callback_lobby_mirror_ABCD=mirror-secret';
  const mirrorRequest=req('/sync',undefined,cookie);mirrorRequest.headers.set('x-callback-online-role','display');
  const mirrored=await h.service.snapshot(mirrorRequest,h.code);assert.equal(mirrored.status,200);
  const body=await mirrored.json() as {role:string;selfId:null;status:string};assert.equal(body.role,'display');assert.equal(body.selfId,null);assert.equal(body.status,'LOBBY');
  assert.equal((await h.service.host(req('/host',{operation:'tick'},cookie),h.code)).status,401);
  assert.equal((await h.service.host(req('/host',{operation:'start'},cookie),h.code)).status,401);
  assert.equal((await h.service.snapshot(req('/sync',undefined,cookie),h.code)).status,401);
  await h.db.prepare("UPDATE callback_sessions SET active_id='other' WHERE code='ABCD'").run();
  assert.equal((await h.service.snapshot(mirrorRequest,h.code)).status,401);
});
