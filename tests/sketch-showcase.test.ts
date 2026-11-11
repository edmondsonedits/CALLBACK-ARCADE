import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { deflateSync } from 'node:zlib';
import { createShowdown } from '../server/arcade/sketch_showdown';
import type { RoomState } from '../server/types';

const sqlite = new DatabaseSync(':memory:');
const objects = new Map<string, Uint8Array>();
let failCopy = false;
let failTransformedCopy = false;
let afterPut: ((key:string)=>Promise<void>) | null = null;
const d1 = { prepare(sql: string) { let values: unknown[] = []; return { bind(...args: unknown[]) { values = args; return this; }, async run() { const result = sqlite.prepare(sql).run(...values as never[]); return { meta: { changes: Number(result.changes) } }; }, async first() { return sqlite.prepare(sql).get(...values as never[]) ?? null; }, async all() { return { results: sqlite.prepare(sql).all(...values as never[]) }; } }; }, async batch(statements: Array<{ run(): Promise<unknown> }>) { const results = []; for (const s of statements) results.push(await s.run()); return results; } };
const storage = { async get(key: string) { const bytes = objects.get(key); return bytes ? { size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer, body: bytes, httpMetadata: { contentType: 'image/png' } } : null; }, async put(key: string, bytes: Uint8Array) { if (failCopy || failTransformedCopy && key.endsWith('/transformed')) throw new Error('R2 unavailable'); if (!objects.has(key)) objects.set(key, Uint8Array.from(bytes)); await afterPut?.(key); return {}; }, async head(key: string) { const bytes = objects.get(key); return bytes ? { size: bytes.length } : null; } };
(globalThis as unknown as { __showcaseEnv: unknown }).__showcaseEnv = { DB: d1, MEDIA: storage };
const hook = registerHooks({ resolve(specifier, context, next) { if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export const env=globalThis.__showcaseEnv', shortCircuit: true }; return next(specifier, context); } });
const mod = await import('../server/sketch-showcase');
hook.deregister();

function fixture(): RoomState {
  const m = createShowdown({ matchId: 'match-unique', players: ['a','b','c'], now: 100, rulesVersion: 3 });
  m.round = 3; m.phase = 'complete'; m.updatedAt = 500;
  for (const c of m.chains) { const id = `src-${c.round}-${c.originalPlayerId}`; c.drawing = { playerId: c.originalPlayerId, assetId: id, submittedAt: 120, source: { assetId: id, objectKey: `rooms/room/${id}`, width: 8, height: 8, byteSize: 100, contentType: 'image/png' }, image: { status: 'READY', jobId: `ai-${id}`, assetId: `ai-${id}` } }; }
  m.showdown!.orders = [1,2,3].map(r => m.chains.filter(c => c.round === r).map(c => c.chainId));
  const entry = (r: number, p: string) => m.chains.find(c => c.round === r && c.originalPlayerId === p)!.chainId;
  m.showdown!.ballots = [{round:1,playerId:'c',ranking:[entry(1,'a'),entry(1,'b')]},{round:1,playerId:'b',ranking:[entry(1,'a')]},{round:2,playerId:'a',ranking:[entry(2,'b')]},{round:2,playerId:'b',ranking:[entry(2,'c')] }];
  m.scores = { a: 0, b: 9999, c: 0 };
  return { id:'room', code:'ABCD', matchNumber:1, gameLength:'arcade', arcadeGameId:'sketch-relay', status:'COMPLETE', phase:'ARCADE_RESULTS', updatedAt:900, arcadeMatch:{id:m.matchId,gameId:'sketch-relay',matchNumber:1,status:'COMPLETE',startedAt:100,endedAt:500,result:{}}, sketchRelay:m, participants:['a','b','c'].map(id=>({id,nickname:`Artist ${id}`,role:'player',active:true,bot:false,removedAt:null})) } as unknown as RoomState;
}
function png(size = 8) { const chunk = (type: string, data: Uint8Array) => { const b=Buffer.alloc(data.length+12); b.writeUInt32BE(data.length); b.write(type,4); b.set(data,8); return b; }; const h=Buffer.alloc(13); h.writeUInt32BE(size);h.writeUInt32BE(size,4);h[8]=8;h[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(Buffer.alloc(size*(size*4+1)))),chunk('IEND',new Uint8Array())]); }
async function prepare(state: RoomState) {
  sqlite.exec('DROP TABLE IF EXISTS sketch_showcase_entries; DROP TABLE IF EXISTS sketch_showcase_preferences; DROP TABLE IF EXISTS sketch_showcase_profile_preferences; DROP TABLE IF EXISTS jobs; CREATE TABLE jobs(id TEXT PRIMARY KEY,room_id TEXT,round_id TEXT,kind TEXT,status TEXT,prompt_json TEXT,object_key TEXT,content_type TEXT,byte_size INTEGER);');
  for (const sql of mod!.SKETCH_SHOWCASE_DDL) sqlite.exec(sql);
  objects.clear(); failCopy=false;failTransformedCopy=false;afterPut=null;
  for (const c of state.sketchRelay!.chains) { const l=c.drawing!, bytes=png(); l.source!.byteSize=bytes.length; objects.set(l.source!.objectKey,bytes); objects.set(`rooms/room/${l.image.assetId}`,bytes); const hash=await mod!.showcaseImageHash(bytes);
    sqlite.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?)').run(l.assetId!,'room',`${state.sketchRelay!.matchId}-r${c.round}`,'SKETCH_UPLOAD','READY',JSON.stringify({...l.source,matchId:state.sketchRelay!.matchId,round:c.round,chainId:c.chainId,leg:'drawing',playerId:c.originalPlayerId,sha256:hash}),l.source!.objectKey,'image/png',bytes.length);
    sqlite.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?)').run(l.image.assetId!,'room',`${state.sketchRelay!.matchId}-r${c.round}`,'SKETCH_TRANSFORM','READY',JSON.stringify({kind:'SKETCH_TRANSFORM',matchId:state.sketchRelay!.matchId,round:c.round,chainId:c.chainId,leg:'drawing',sourceAssetId:l.assetId,jobId:l.image.assetId}),`rooms/room/${l.image.assetId}`,'image/png',bytes.length);
  }
}

test('round winners use each drawing ballot, retain positive ties and ignore overall guess totals', () => {
  assert.ok(mod, 'the winners projection must exist');
  const entries=mod.selectSketchRoundWinners(fixture());
  assert.deepEqual(entries.map(e=>[e.round,e.artistId,e.points,e.tiedCount]),[[1,'a',200,1],[2,'b',200,2],[2,'c',200,2]]);
});
test('incomplete, fallback, practice and missing original/transform never seed the feed', () => {
  assert.ok(mod, 'the winners projection must exist');
  const state=fixture(); state.status='ACTIVE'; assert.equal(mod.selectSketchRoundWinners(state).length,0);state.status='COMPLETE';
  state.sketchRelay!.showdown!.fallbackRounds=[1]; state.sketchRelay!.botIds=['b']; state.participants.find(p=>p.id==='b')!.bot=true;
  state.sketchRelay!.chains.find(c=>c.round===2&&c.originalPlayerId==='c')!.drawing!.image.status='FALLBACK';
  assert.deepEqual(mod.selectSketchRoundWinners(state),[]);
});
test('consent defaults off; verified copies survive room deletion with minimal public fields', async () => {
  assert.ok(mod, 'the winners projection must exist');const state=fixture(); await prepare(state);await mod.archiveSketchShowcase(state);assert.equal((await mod.listSketchShowcase()).entries.length,0);
  state.participants[0]!.nickname='Changed after winning';await mod.setSketchShowcasePreference(state.id,'a',true,1000);await mod.archiveSketchShowcase(state);const first=await mod.listSketchShowcase();assert.equal(first.entries[0]?.artistName,'Artist a');assert.equal(first.entries.length,1);assert.deepEqual(Object.keys(first.entries[0]).sort(),['artistName','completedAt','id','originalUrl','round','tiedCount','transformedUrl']);
  for(const key of [...objects.keys()])if(key.startsWith('rooms/'))objects.delete(key);sqlite.exec('DELETE FROM jobs');
  assert.ok(await mod.readSketchShowcaseMedia(first.entries[0].id,'original'));assert.ok(await mod.readSketchShowcaseMedia(first.entries[0].id,'transformed'));
  assert.equal(await mod.readSketchShowcaseMedia(first.entries[0].id,'fish'),null);
});
test('storage failure stays pending, retries once, freezes name, and withdrawal cannot resurrect', async () => {
  assert.ok(mod, 'the winners projection must exist');const state=fixture();await prepare(state);await mod.setSketchShowcasePreference(state.id,'a',true,1000);failCopy=true;await mod.archiveSketchShowcase(state);assert.equal((await mod.listSketchShowcase()).entries.length,0);assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sketch_showcase_entries WHERE state='pending'").get()!.n,1);
  failCopy=false;state.participants[0]!.nickname='Renamed';await mod.archiveSketchShowcase(state);await mod.archiveSketchShowcase(state);const result=await mod.listSketchShowcase();assert.equal(result.entries.length,1);assert.equal(result.entries[0].artistName,'Artist a');
  await mod.withdrawSketchShowcase(state.id,'a',result.entries[0].id,2000);await mod.archiveSketchShowcase(state);assert.equal((await mod.listSketchShowcase()).entries.length,0);assert.equal(await mod.readSketchShowcaseMedia(result.entries[0].id,'original'),null);assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sketch_showcase_entries WHERE artist_id='a'").get()!.n,1);
});
test('mismatched immutable receipt or transform chain is rejected before publication', async () => {
  assert.ok(mod, 'the winners projection must exist');const state=fixture();await prepare(state);await mod.setSketchShowcasePreference(state.id,'a',true,1000);
  const id=state.sketchRelay!.chains.find(c=>c.round===1&&c.originalPlayerId==='a')!.drawing!.image.assetId!;const row=sqlite.prepare('SELECT prompt_json FROM jobs WHERE id=?').get(id)!;sqlite.prepare('UPDATE jobs SET prompt_json=? WHERE id=?').run(JSON.stringify({...JSON.parse(String(row.prompt_json)),chainId:'other-chain'}),id);
  await mod.archiveSketchShowcase(state);assert.equal((await mod.listSketchShowcase()).entries.length,0);
});

test('a source hash mismatch, failed copy verification and cross-artist withdrawal cannot publish or revoke',async()=>{
  const state=fixture();await prepare(state);await mod.setSketchShowcasePreference(state.id,'a',true,1000);
  const original=state.sketchRelay!.chains.find(c=>c.round===1&&c.originalPlayerId==='a')!.drawing!.source!;objects.set(original.objectKey,png(9));await mod.archiveSketchShowcase(state);assert.equal((await mod.listSketchShowcase()).entries.length,0);
  objects.set(original.objectKey,png());await mod.retryPendingSketchShowcase(state.id);const result=await mod.listSketchShowcase();assert.equal(result.entries.length,1);
  assert.equal(await mod.withdrawSketchShowcase(state.id,'b',result.entries[0].id,3000),false);assert.equal((await mod.listSketchShowcase()).entries.length,1);
  await mod.setSketchShowcasePreference(state.id,'a',false,4000);await mod.setSketchShowcasePreference(state.id,'a',true,5000);await mod.archiveSketchShowcase(state);assert.equal((await mod.listSketchShowcase()).entries.length,0);
});
test('public paging bounds its pool while allowing co-winners beyond the newest 24',async()=>{
  const state=fixture();await prepare(state);await mod.setSketchShowcasePreference(state.id,'a',true,1000);await mod.archiveSketchShowcase(state);
  const template=sqlite.prepare("SELECT * FROM sketch_showcase_entries WHERE state='ready'").get()!;
  for(let i=0;i<30;i++)sqlite.prepare('INSERT INTO sketch_showcase_entries(id,room_id,source_match_id,history_match_id,source_game_id,rules_version,round_number,entry_id,artist_id,artist_name,completed_at,laughter_points,tied_count,state,evidence_json,original_info_json,transformed_info_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(`skw_${i.toString(16).padStart(64,'0')}`,'room',`match-${i}`,'history','sketch-relay',3,1,`entry-${i}`,'a',`Artist ${i}`,1000+i,100,1,'ready',String(template.evidence_json),String(template.original_info_json),String(template.transformed_info_json),2000);
  const first=await mod.listSketchShowcase();assert.equal(first.entries.length,24);assert.equal(first.nextOffset,24);const second=await mod.listSketchShowcase(first.nextOffset!);assert.equal(second.entries.length,7);assert.equal(second.nextOffset,null);assert.equal(new Set([...first.entries,...second.entries].map(e=>e.id)).size,31);
});
test('verified partial original copy completes after its live source disappears',async()=>{
  const state=fixture();await prepare(state);await mod.setSketchShowcasePreference(state.id,'a',true,1000);failTransformedCopy=true;await mod.archiveSketchShowcase(state);
  const row=sqlite.prepare("SELECT id, original_info_json, state FROM sketch_showcase_entries WHERE artist_id='a'").get()!;assert.equal(row.state,'pending');assert.ok(row.original_info_json);
  const original=state.sketchRelay!.chains.find(c=>c.round===1&&c.originalPlayerId==='a')!.drawing!.source!;objects.delete(original.objectKey);failTransformedCopy=false;await mod.retryPendingSketchShowcase(state.id);assert.equal((await mod.listSketchShowcase()).entries.length,1);
});
test('withdrawal racing a successful media copy prevents the final ready transition',async()=>{
  const state=fixture();await prepare(state);await mod.setSketchShowcasePreference(state.id,'a',true,1000);
  afterPut=async key=>{if(key.endsWith('/transformed')){const id=key.split('/')[2]!;await mod.withdrawSketchShowcase(state.id,'a',id,2000);}};
  await mod.archiveSketchShowcase(state);assert.equal((await mod.listSketchShowcase()).entries.length,0);assert.equal(sqlite.prepare("SELECT state FROM sketch_showcase_entries WHERE artist_id='a'").get()!.state,'withdrawn');
  afterPut=null;await mod.archiveSketchShowcase(state);assert.equal((await mod.listSketchShowcase()).entries.length,0);
});
test('preference route requires the artist seat, rejects forged ownership, and persists profile preference',async()=>{
  const {createRoomState}=await import('../server/engine');const {ensureDatabase,insertRoom}=await import('../server/database');const {sha256Hex}=await import('../server/crypto');
  const {GET,POST}=await import('../app/api/rooms/[code]/showcase/route');sqlite.exec('DROP TABLE jobs');await ensureDatabase();
  const now=Date.now(),room=createRoomState('SCON',{gameLength:'arcade',arcadeGameId:'sketch-relay',contentMode:'party',timerAccessibility:false},now);
  room.participants.push({id:'artist-seat',nickname:'Artist',nicknameNormalized:'artist',role:'player',seat:1,avatar:0,color:'#fff',active:true,pendingActivation:false,bot:false,lastSeenAt:now,removedAt:null});await insertRoom(room,await sha256Hex('host-secret'));
  sqlite.prepare('INSERT INTO players(id,room_id,token_hash,nickname,nickname_normalized,role,seat,avatar,color,active,pending_activation,connected_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('artist-seat',room.id,await sha256Hex('seat-secret'),'Artist','artist','player',1,0,'#fff',1,0,now,now);
  const params={params:Promise.resolve({code:'SCON'})},url='https://game.test/api/rooms/SCON/showcase';
  assert.equal((await GET(new Request(url,{headers:{Cookie:'callback_host_SCON=host-secret'}}),params)).status,401);
  const token='p'.repeat(43);const {profileService}=await import('../server/profiles/runtime');await profileService().get(token);
  const cookie=`callback_seat_SCON=seat-secret; callback_profile=${token}`;const initial=await GET(new Request(url,{headers:{Cookie:cookie}}),params);assert.equal((await initial.json() as {enabled:boolean}).enabled,false);
  const post=(body:unknown,origin='https://game.test')=>POST(new Request(url,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)}),params);
  assert.equal((await post({enabled:true,artistId:'someone-else'})).status,422);assert.equal((await post({enabled:true},'https://attacker.test')).status,403);assert.equal((await post({enabled:true})).status,200);
  assert.equal((await (await GET(new Request(url,{headers:{Cookie:cookie}}),params)).json() as {enabled:boolean}).enabled,true);
  assert.equal(sqlite.prepare('SELECT enabled FROM sketch_showcase_profile_preferences WHERE profile_hash=?').get(await sha256Hex(token))!.enabled,1);
});
test('Hall nominations require separate consent and withdrawal is terminal across archive retries',async()=>{
 const state=fixture();state.sketchRelay!.showdown!.version=4;
 const entry=state.sketchRelay!.chains.find(c=>c.round===1&&c.originalPlayerId==='a')!;
 state.sketchRelay!.showdown!.workshop={leases:[],closedRound:3,closeUntil:null,intermissionRound:3,ballots:[],reactions:[],nominations:[{actor:'b',round:1,entry:entry.chainId}]};
 await prepare(state);sqlite.exec('DELETE FROM sorcery_hall_preferences');
 await mod.setSketchShowcasePreference(state.id,'a',true,1000,'old-profile');await mod.archiveSketchShowcase(state);
 assert.equal((await mod.listSketchShowcase()).entries.length,0);
 assert.equal(sqlite.prepare("SELECT state FROM sketch_showcase_entries WHERE artist_id='a'").get()!.state,'unapproved');
 await mod.setHallPreference(state.id,'a',true,2000);await mod.retryPendingSketchShowcase(state.id);
 const published=await mod.listSketchShowcase();assert.equal(published.entries.length,1);assert.equal(published.entries[0]!.awardKind,'hall');
 await mod.setHallPreference(state.id,'a',false,3000);await mod.setHallPreference(state.id,'a',true,4000);await mod.archiveSketchShowcase(state);
 assert.equal((await mod.listSketchShowcase()).entries.length,0);
});
