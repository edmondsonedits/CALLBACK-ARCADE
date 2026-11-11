import type { SessionView } from '../lib/session-contracts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { SessionService, type SessionAdapter } from '../server/sessions/service';
import { SESSION_DDL } from '../server/sessions/schema';
import { reserveCallbackCode } from '../server/sessions/codes';
import { verifySessionSocketTicket } from '../lib/session-socket-ticket';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const sql of SESSION_DDL) sqlite.exec(sql);
  const wrap = (sql: string, args: unknown[] = []): D1PreparedStatement => ({
    bind: (...values: unknown[]) => wrap(sql, values),
    first: async () => sqlite.prepare(sql).get(...args as never[]) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args as never[]) }),
    run: async () => { const r = sqlite.prepare(sql).run(...args as never[]); return { meta: { changes: Number(r.changes) } }; },
  }) as unknown as D1PreparedStatement;
  return { prepare: wrap, batch: async (statements: D1PreparedStatement[]) => { sqlite.exec('BEGIN'); try { const results = []; for (const s of statements) results.push(await s.run()); sqlite.exec('COMMIT'); return results; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } } } as unknown as D1Database;
}
const origin = 'https://callback.test';
const request = (path: string, body?: unknown, cookie = '') => new Request(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { origin, cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const cookieOf = (r: Response) => r.headers.get('set-cookie')!.split(';')[0]!;
const adapter: SessionAdapter = {
  launch: async (_request, game, members, id) => ({ code: id.slice(0,4), kind: game.kind, title: game.gameId, hostPath: '/host/TEST', playPath: '/play/TEST', members: members.map(m => m.id) }),
  credentials: async () => [],
  retire: async () => undefined,
};
async function setup() { const db = database(), service = new SessionService(db, adapter, () => 1000); const created = await service.create(request('/sessions', {})); assert.equal(created.status, 201); return { db, service, code: (await created.json() as SessionView).code as string, host: cookieOf(created) }; }

test('live avatar ownership comes from lobby cookies and closes with the session', async () => {
  const h = await setup();
  assert.equal(await h.service.avatarIdentity(request('/pose'), h.code), null);
  assert.equal(await h.service.avatarIdentity(request('/pose', undefined, h.host), h.code, true), null);
  const joined = await h.service.join(request('/join', { nickname: 'Puppet' }), h.code);
  const player = cookieOf(joined), view = await joined.json() as SessionView;
  const auth = await h.service.avatarIdentity(request('/pose', undefined, player), h.code, true);
  assert.equal(auth?.actorId, view.selfId); assert.deepEqual(auth?.playerIds, [view.selfId]);
  const both = await h.service.avatarIdentity(request('/pose', undefined, h.host + '; ' + player), h.code, true);
  assert.equal(both?.actorId, view.selfId);
  assert.equal((await h.service.avatarIdentity(request('/pose', undefined, h.host), h.code))?.actorId, 'host');
  await h.db.prepare("UPDATE callback_sessions SET stage='CLOSED' WHERE code=?").bind(h.code).run();
  assert.equal(await h.service.avatarIdentity(request('/pose', undefined, player), h.code, true), null);
});

test('session exists before game selection and joining is authenticated, capacity bounded, and idempotent', async () => {
  const h = await setup();
  assert.equal((await h.service.snapshot(request('/sync'), h.code)).status, 401);
  const view = await (await h.service.snapshot(request('/sync', undefined, h.host), h.code)).json() as SessionView;
  assert.equal(view.stage, 'SELECTING'); assert.equal(view.activeGame, null);
  const joins = await Promise.all(Array.from({ length: 10 }, (_, i) => h.service.join(request('/join', { nickname: 'Player ' + i }), h.code)));
  assert.equal(joins.filter(r => r.status === 201).length, 10);
  assert.equal((await h.service.join(request('/join', { nickname: 'Eleven' }), h.code)).status, 409);
  const restored = await h.service.join(request('/join', { nickname: 'Player 0' }, cookieOf(joins[0]!)), h.code);
  assert.equal(restored.status, 200);
  const roster = await (await h.service.snapshot(request('/sync', undefined, h.host), h.code)).json() as SessionView;
  assert.equal(new Set(roster.players.map((p: {id:string}) => p.id)).size, 10);
  assert.equal(JSON.stringify(roster).includes('token_hash'), false);
});

test('New Game and another service retain session code and seats; stale host versions cannot launch', async () => {
  const h = await setup(), joined = await h.service.join(request('/join', { nickname: 'One' }), h.code), seat = cookieOf(joined);
  const before = await (await h.service.snapshot(request('/sync', undefined, seat), h.code)).json() as SessionView;
  assert.equal((await h.service.host(request('/host', { operation: 'launch', version: 1, game: { kind: 'main', gameId: 'pictures' } }, seat), h.code)).status, 401);
  let hostView = await (await h.service.snapshot(request('/sync', undefined, h.host), h.code)).json() as SessionView;
  let launched = await h.service.host(request('/host', { operation: 'launch', version: hostView.version, game: { kind: 'main', gameId: 'pictures' } }, h.host), h.code);
  assert.equal(launched.status, 200);
  assert.equal((await h.service.host(request('/host', { operation: 'launch', version: hostView.version, game: { kind: 'online', gameId: 'sumo' } }, h.host), h.code)).status, 409);
  hostView = await launched.json() as SessionView;
  const lobby = await h.service.host(request('/host', { operation: 'lobby', version: hostView.version }, h.host), h.code); assert.equal(lobby.status,200);
  hostView = await lobby.json() as SessionView;
  launched = await h.service.host(request('/host', { operation:'launch',version:hostView.version,game:{kind:'online',gameId:'sumo'} },h.host),h.code);assert.equal(launched.status,200);
  const after = await (await h.service.snapshot(request('/sync',undefined,seat),h.code)).json() as SessionView;
  assert.equal(after.code,before.code);assert.equal(after.selfId,before.selfId);assert.equal(after.players.length,1);assert.equal(after.activeGame?.kind,'online');
});

test('host can kick one lobby member and reset everyone while preserving host session and code', async () => {
  const h=await setup();
  const first=await h.service.join(request('/join',{nickname:'First'}),h.code),firstCookie=cookieOf(first),firstView=await first.json() as SessionView;
  const second=await h.service.join(request('/join',{nickname:'Second'}),h.code),secondCookie=cookieOf(second),secondView=await second.json() as SessionView;
  const kick=await h.service.host(request('/host',{operation:'kick',version:secondView.version,playerId:firstView.selfId},h.host),h.code);
  assert.equal(kick.status,200);const afterKick=await kick.json() as SessionView;assert.deepEqual(afterKick.players.map(p=>p.nickname),['Second']);
  assert.equal((await h.service.snapshot(request('/sync',undefined,firstCookie),h.code)).status,401,'kicked phone membership is revoked');
  const launch=await h.service.host(request('/host',{operation:'launch',version:afterKick.version,game:{kind:'main',gameId:'pictures'}},h.host),h.code);assert.equal(launch.status,200);
  const playing=await launch.json() as SessionView;
  const reset=await h.service.host(request('/host',{operation:'reset',version:playing.version},h.host),h.code);assert.equal(reset.status,200);
  const cleared=await reset.json() as SessionView;assert.equal(cleared.code,h.code);assert.equal(cleared.stage,'SELECTING');assert.equal(cleared.activeGame,null);assert.deepEqual(cleared.players,[]);
  assert.equal((await h.service.snapshot(request('/sync',undefined,h.host),h.code)).status,200,'host remains in control of the same lobby');
  assert.equal((await h.service.snapshot(request('/sync',undefined,secondCookie),h.code)).status,401,'reset revokes every phone membership');
});

test('reset retains all members when active game retirement fails',async()=>{
  const h=await setup(),joined=await h.service.join(request('/join',{nickname:'Stay'}),h.code),seat=cookieOf(joined);
  const service=new SessionService(h.db,{...adapter,retire:async()=>{throw Error('temporary worker failure')}},()=>1000);
  const lobby=await(await service.snapshot(request('/sync',undefined,h.host),h.code)).json() as SessionView;
  const launch=await service.host(request('/host',{operation:'launch',version:lobby.version,game:{kind:'main',gameId:'pictures'}},h.host),h.code);assert.equal(launch.status,200);
  const active=await launch.json() as SessionView;
  assert.equal((await service.host(request('/host',{operation:'reset',version:active.version},h.host),h.code)).status,409);
  assert.equal((await service.snapshot(request('/sync',undefined,seat),h.code)).status,200);
  const stillActive=await(await service.snapshot(request('/sync',undefined,h.host),h.code)).json() as SessionView;assert.equal(stillActive.stage,'PLAYING');assert.equal(stillActive.players.length,1);
});

test('stale child launch cannot publish after a concurrent host reset',async()=>{
  const h=await setup();const serviceRef:{current?:SessionService}={},retired={value:false};
  const raceAdapter:SessionAdapter={...adapter,launch:async(_launchRequest,game,members,id,hostHash)=>{
    const current=await(await serviceRef.current!.snapshot(request('/sync',undefined,h.host),h.code)).json() as SessionView;
    const reset=await serviceRef.current!.host(request('/host',{operation:'reset',version:current.version},h.host),h.code);assert.equal(reset.status,200);
    return adapter.launch(_launchRequest,game,members,id,hostHash);
  },retire:async()=>{retired.value=true;}};
  serviceRef.current=new SessionService(h.db,raceAdapter,()=>1000);
  const service=serviceRef.current;
  const launch=await service.host(request('/host',{operation:'launch',version:1,game:{kind:'main',gameId:'pictures'}},h.host),h.code);
  assert.equal(launch.status,409);assert.equal(retired.value,true);
  const parent=await(await service.snapshot(request('/sync',undefined,h.host),h.code)).json() as SessionView;
  assert.equal(parent.stage,'SELECTING');assert.equal(parent.activeGame,null);assert.deepEqual(parent.players,[]);
  const child=await h.db.prepare('SELECT active FROM callback_session_games WHERE session_code=? ORDER BY created_at DESC LIMIT 1').bind(h.code).first<{active:number}>();assert.equal(child?.active,0);
});

test('foreign-origin actions and expired or closed sessions are rejected', async () => {
  const h = await setup();
  const foreign = new Request(origin+'/sessions',{method:'POST',headers:{origin:'https://foreign.test','content-type':'application/json'},body:'{}'});
  assert.equal((await h.service.create(foreign)).status,403);
  const view = await (await h.service.snapshot(request('/sync',undefined,h.host),h.code)).json() as SessionView;
  assert.equal((await h.service.host(request('/host',{operation:'close',version:view.version},h.host),h.code)).status,200);
  assert.equal((await h.service.join(request('/join',{nickname:'Late'}),h.code)).status,404);
});

test('parent socket tickets require the exact lobby role and are revoked after the session closes', async () => {
  const h = await setup();
  const service = new SessionService(h.db, { ...adapter, socketConfig: () => ({ secret: 's'.repeat(40), workerUrl: 'https://party.test' }) }, () => 1000);
  assert.equal((await service.socketTicket(request(`/api/sessions/${h.code}/socket-ticket?role=host`), h.code)).status, 401);
  assert.equal((await service.socketTicket(request(`/api/sessions/${h.code}/socket-ticket?role=player`, undefined, h.host), h.code)).status, 401);
  const hostResponse = await service.socketTicket(request(`/api/sessions/${h.code}/socket-ticket?role=host`, undefined, h.host), h.code);
  assert.equal(hostResponse.status, 200);
  const hostTicket = (await hostResponse.json() as { ticket: string }).ticket;
  const hostClaims = await verifySessionSocketTicket(hostTicket, 's'.repeat(40), 1000);
  assert.equal(hostClaims.code, h.code); assert.equal(hostClaims.role, 'host'); assert.equal(hostClaims.tokenHash.length, 64);
  assert.equal(JSON.stringify(hostClaims).includes(h.host.split('=')[1]!), false);
  const valid = await service.validateSocketTicket(new Request('https://callback.test/validate', { method: 'POST', headers: { authorization: 'Bearer ' + 's'.repeat(40), 'content-type': 'application/json' }, body: JSON.stringify({ ticket: hostTicket }) }), 's'.repeat(40));
  assert.equal(valid.status, 200);
  const lobby = await (await service.snapshot(request('/sync', undefined, h.host), h.code)).json() as SessionView;
  await service.host(request('/host', { operation: 'close', version: lobby.version }, h.host), h.code);
  assert.equal((await service.validateSocketTicket(new Request('https://callback.test/validate', { method: 'POST', headers: { authorization: 'Bearer ' + 's'.repeat(40), 'content-type': 'application/json' }, body: JSON.stringify({ ticket: hostTicket }) }), 's'.repeat(40))).status, 401);
});

test('committed lobby updates await bounded notification delivery without failing on notifier errors', async () => {
  const h = await setup(); let delivered = false;
  const service = new SessionService(h.db, { ...adapter, notify: async () => { await new Promise(resolve => setTimeout(resolve, 15)); delivered = true; } }, () => 1000);
  const response = await service.host(request('/host', { operation: 'presentation', version: 1, presentation: { category: 'arcade', extended: false, birthdayName: '' } }, h.host), h.code);
  assert.equal(response.status, 200); assert.equal(delivered, true);
  const lossy = new SessionService(h.db, { ...adapter, notify: async () => { throw Error('Worker unavailable'); } }, () => 1000);
  const failedDelivery = await lossy.host(request('/host', { operation: 'presentation', version: 2, presentation: { category: null, extended: false, birthdayName: '' } }, h.host), h.code);
  assert.equal(failedDelivery.status, 200);
});

test('lobby ticket rate limits distinguish authenticated phones behind one network', async () => {
  const h=await setup(),scopes:string[]=[];
  const service=new SessionService(h.db,{...adapter,socketConfig:()=>({secret:'s'.repeat(40),workerUrl:'https://party.test'}),ticketLimit:async(_req,scope)=>{scopes.push(scope);return null;}},()=>1000);
  for(const nickname of ['Alice','Bob']){
    const joined=await service.join(request('/join',{nickname}),h.code);
    assert.equal((await service.socketTicket(request('/ticket?role=player',undefined,cookieOf(joined)),h.code)).status,200);
  }
  assert.equal(scopes.length,2);assert.notEqual(scopes[0],scopes[1]);
  assert.equal((await service.socketTicket(request('/ticket?role=host'),h.code)).status,401);
  assert.equal(scopes.length,2,'unauthenticated clients do not consume a player bucket');
});

test('lobby ticket rate limits distinguish mirrors on the same network', async () => {
  const h=await setup(),scopes:string[]=[];
  const service=new SessionService(h.db,{...adapter,socketConfig:()=>({secret:'s'.repeat(40),workerUrl:'https://party.test'}),ticketLimit:async(_req,scope)=>{scopes.push(scope);return null;}},()=>1000);
  const view=await (await service.snapshot(request('/sync',undefined,h.host),h.code)).json() as SessionView;
  const cookies:string[]=[];
  for(let i=0;i<2;i++){
    const joined=await service.joinMirror(request('/mirror',{code:view.mirrorCode}));
    cookies.push(cookieOf(joined));
    assert.equal((await service.socketTicket(request('/ticket?role=mirror',undefined,cookies[i]),h.code)).status,200);
  }
  assert.notEqual(scopes[0],scopes[1]);
  assert.equal((await service.socketTicket(request('/ticket?role=mirror',undefined,cookies[0]),h.code)).status,200);
  assert.equal(scopes[2],scopes[0],'renewal keeps the same authenticated mirror bucket');
  for(const cookie of cookies)assert.equal(scopes.some(scope=>scope.includes(cookie.split('=')[1]!)),false);
});
test('expired code reservations cannot reclaim an occupied primary key or retired child code',async()=>{
  const h=await setup();
  await h.db.prepare('CREATE TABLE rooms(code TEXT PRIMARY KEY)').run();
  await h.db.prepare('CREATE TABLE online_arcade_rooms(code TEXT PRIMARY KEY)').run();
  await h.db.prepare('UPDATE callback_sessions SET expires_at=0 WHERE code=?').bind(h.code).run();
  await h.db.prepare('UPDATE callback_code_registry SET expires_at=0 WHERE code=?').bind(h.code).run();
  assert.equal(await reserveCallbackCode(h.db,h.code,'session',Date.now()+1000),false);
  await h.db.prepare("INSERT INTO callback_session_games(id,session_code,child_kind,child_code,active,game_json,created_at) VALUES('retired',?,'main','ABCD',0,'{}',0)").bind(h.code).run();
  assert.equal(await reserveCallbackCode(h.db,'ABCD','main',Date.now()+1000),false);
  assert.equal(await reserveCallbackCode(h.db,'EFGH','main',Date.now()+1000),true);
});


test('numeric mirror code is host-only, stable under concurrent snapshots, and mirrors cannot control games', async () => {
  const h = await setup();
  const views = await Promise.all(Array.from({length: 8}, async () => (await h.service.snapshot(request('/sync', undefined, h.host), h.code)).json() as Promise<SessionView>));
  assert.match(views[0].mirrorCode ?? '', /^\d{4}$/);
  assert.equal(new Set(views.map(v => v.mirrorCode)).size, 1);
  const joined = await h.service.join(request('/join', {nickname: 'One'}), h.code);
  assert.equal('mirrorCode' in (await joined.json() as SessionView), false);
  const mirror = await h.service.joinMirror(request('/api/sessions/mirror', {code: views[0].mirrorCode}));
  assert.equal(mirror.status, 201);
  const mirrorCookie = cookieOf(mirror);
  const mirrored = await mirror.json() as SessionView;
  assert.equal(mirrored.role, 'mirror');
  assert.equal('mirrorCode' in mirrored, false);
  assert.equal(mirrorCookie.startsWith('callback_lobby_mirror_'), true);
  const combined = await h.service.snapshot(request('/sync?role=mirror', undefined, h.host + '; ' + mirrorCookie), h.code);
  assert.equal((await combined.json() as SessionView).role, 'mirror');
  assert.equal((await h.service.snapshot(request('/sync?role=mirror', undefined, h.host), h.code)).status, 401);
  assert.equal((await h.service.host(request('/host', {operation:'launch', version:1, game:{kind:'main',gameId:'pictures'}}, mirrorCookie), h.code)).status, 401);
  const picked = await h.service.host(request('/host', {operation:'presentation',version:1,presentation:{category:'arcade',extended:true,birthdayName:'Danny'}}, h.host), h.code);
  assert.equal(picked.status, 200);
  const selected = await h.service.snapshot(request('/sync?role=mirror', undefined, mirrorCookie), h.code);
  assert.deepEqual((await selected.json() as SessionView).presentation, {category:'arcade',extended:true,birthdayName:'Danny'});
  assert.equal((await h.service.host(request('/host',{operation:'presentation',version:1,presentation:{category:null,extended:false,birthdayName:''}},h.host),h.code)).status,409);
  const current = await (await h.service.snapshot(request('/sync',undefined,h.host),h.code)).json() as SessionView;
  assert.equal((await h.service.host(request('/host',{operation:'launch',version:current.version,game:{kind:'main',gameId:'pictures'}},h.host),h.code)).status,200);
  assert.equal((await (await h.service.snapshot(request('/sync?role=mirror',undefined,mirrorCookie),h.code)).json() as SessionView).activeGame!.kind,'main');
  const next = await (await h.service.snapshot(request('/sync',undefined,h.host),h.code)).json() as SessionView;
  assert.equal((await h.service.host(request('/host',{operation:'lobby',version:next.version},h.host),h.code)).status,200);
  const ready = await (await h.service.snapshot(request('/sync',undefined,h.host),h.code)).json() as SessionView;
  assert.equal((await h.service.host(request('/host',{operation:'launch',version:ready.version,game:{kind:'online',gameId:'sumo'}},h.host),h.code)).status,200);
  assert.equal((await (await h.service.snapshot(request('/sync?role=mirror',undefined,mirrorCookie),h.code)).json() as SessionView).activeGame!.kind,'online');
  assert.equal((await h.service.joinMirror(request('/mirror',{code:'abc4'}))).status,422);
  assert.equal((await h.service.joinMirror(new Request('https://callback.test/mirror',{method:'POST',headers:{origin:'https://foreign.test','content-type':'application/json'},body:JSON.stringify({code:views[0].mirrorCode})}))).status,403);
  const closing=await (await h.service.snapshot(request('/sync',undefined,h.host),h.code)).json() as SessionView;
  assert.equal((await h.service.host(request('/host',{operation:'close',version:closing.version},h.host),h.code)).status,200);
  assert.equal((await h.service.snapshot(request('/sync?role=mirror',undefined,mirrorCookie),h.code)).status,404);
  assert.equal((await h.service.joinMirror(request('/mirror',{code:views[0].mirrorCode}))).status,404);

});

test('failed game retirement keeps the prior game available for cleanup retry',async()=>{
 const h=await setup();const service=new SessionService(h.db,{...adapter,retire:async()=>{throw new Error('temporary disconnect')}},()=>1000);
 const before=await (await service.snapshot(request('/sync',undefined,h.host),h.code)).json() as SessionView;
 const launch=await service.host(request('/sessions/'+h.code+'/host',{operation:'launch',version:before.version,game:{kind:'online',gameId:'sumo'}},h.host),h.code);assert.equal(launch.status,200);
 const playing=await launch.json() as SessionView;
 const failed=await service.host(request('/sessions/'+h.code+'/host',{operation:'launch',version:playing.version,game:{kind:'online',gameId:'sumo'}},h.host),h.code);assert.equal(failed.status,409);
 const recovered=await (await service.snapshot(request('/sync',undefined,h.host),h.code)).json() as SessionView;assert.equal(recovered.stage,'PLAYING');assert.equal(recovered.activeGame?.id,playing.activeGame?.id);const retired=await h.db.prepare('SELECT active FROM callback_session_games WHERE id=?').bind(playing.activeGame!.id).first<{active:number}>();assert.equal(retired?.active,1);
});
