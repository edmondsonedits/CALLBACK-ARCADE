import { getD1, runtimeEnv } from './database';
import { sha256Hex } from './crypto';
import type { RoomState } from './types';
import type { SketchRelayMatch } from './arcade/sketch_relay';
import {hallWinners} from './sorcery/workshop';
export { SKETCH_SHOWCASE_DDL } from './sketch-showcase-schema';

type Chain = SketchRelayMatch['chains'][number];
export interface SketchWinner { round: number; artistId: string; artistName: string; points: number; tiedCount: number; chain: Chain }
interface JobRow { id: string; room_id: string; round_id: string; kind: string; status: string; prompt_json: string; object_key: string; content_type: string; byte_size: number }
interface Evidence { original: { key: string; assetId: string; contentType: string; byteSize: number; width: number; height: number; hash: string }; transformed: { key: string; assetId: string; contentType: string; byteSize: number } }
interface ImageInfo { key: string; contentType: string; byteSize: number; width: number; height: number; hash: string }
interface EntryRow { id: string; state: string; evidence_json: string; original_info_json: string | null; transformed_info_json: string | null }
export interface PublicSketchWinner { id: string; artistName: string; round: number; tiedCount: number; completedAt: number; originalUrl: string; transformedUrl: string; awardKind?: 'score'|'hall'; magicUnavailable?:boolean }
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_IMAGE_SIDE = 4096;

/** Each round uses its own ballot context; guesses/overall champions never select artwork. */
export function selectSketchRoundWinners(state: RoomState): SketchWinner[] {
  const m = state.sketchRelay, d = m?.showdown;
  if (state.status !== 'COMPLETE' || state.arcadeGameId !== 'sketch-relay' || state.arcadeMatch?.status !== 'COMPLETE' || state.arcadeMatch.id !== m?.matchId || m?.phase !== 'complete' || !d || ![2,3].includes(d.version)) return [];
  const result: SketchWinner[] = [];
  for (let round = 1; round <= (d.version === 3 ? 3 : 2); round++) {
    if (d.fallbackRounds.includes(round)) continue;
    const cs = m.chains.filter(c => c.round === round && c.drawing && d.orders[round - 1]?.includes(c.chainId));
    const totals = cs.map(chain => ({ chain, points: d.ballots.filter(b => b.round === round).reduce((n,b) => { const i = b.ranking.indexOf(chain.chainId); return n + (i < 0 ? 0 : [100,75,50][i] ?? 0); },0) }));
    const high = Math.max(0,...totals.map(v => v.points));
    if (!high) continue;
    const first = totals.filter(v => v.points === high);
    for (const { chain, points } of first) {
      const drawing = chain.drawing!, artist = state.participants.find(p => p.id === chain.originalPlayerId && p.role === 'player');
      if (!artist || artist.bot || m.botIds.includes(artist.id) || drawing.practice || drawing.playerId !== artist.id || !drawing.assetId || !drawing.source || drawing.source.assetId !== drawing.assetId || drawing.image.status !== 'READY' || !drawing.image.assetId || drawing.image.assetId !== drawing.image.jobId || drawing.image.assetId === drawing.assetId) continue;
      result.push({ round, artistId: artist.id, artistName: artist.nickname, points: points * (d.version === 3 ? round : 1), tiedCount: first.length, chain });
    }
  }
  return result;
}
export function selectSketchHallNominees(state:RoomState):SketchWinner[]{
 const m=state.sketchRelay,d=m?.showdown;if(!m||d?.version!==4)return [];
 const result:SketchWinner[]=[];
 for(let round=1;round<=m.round;round++){
  if(round===m.round&&!['halfway','complete'].includes(m.phase))continue;
  const ids=hallWinners(m,round);for(const entryId of ids){
   const chain=m.chains.find(c=>c.chainId===entryId&&c.round===round),drawing=chain?.drawing;const artist=state.participants.find(p=>p.id===chain?.originalPlayerId);
   if(!chain||!drawing?.source||!drawing.assetId||drawing.practice||!artist||artist.bot)continue;
   result.push({round,artistId:artist.id,artistName:artist.nickname,points:d.workshop!.nominations.filter(v=>v.round===round&&v.entry===entryId).length,tiedCount:ids.length,chain});
  }
 }return result;
}
export async function showcaseImageHash(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer);
  return Array.from(new Uint8Array(hash),v => v.toString(16).padStart(2,'0')).join('');
}
/** Identify actual bytes, including transformed WebP/JPEG dimensions, without trusting suffixes. */
export function showcaseImageDimensions(bytes: Uint8Array): { contentType: string; width: number; height: number } {
  const v = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const text = (start: number,n: number) => String.fromCharCode(...bytes.subarray(start,start+n));
  let width = 0, height = 0, contentType = '';
  if (bytes.length >= 45 && [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b) && text(12,4) === 'IHDR') {
    contentType = 'image/png'; width = v.getUint32(16); height = v.getUint32(20);
    let offset = 8, data = false, end = false;
    while (offset + 12 <= bytes.length) { const n = v.getUint32(offset), next = offset+12+n; if (next > bytes.length) break; const type = text(offset+4,4); if (type === 'IDAT' && n > 0) data = true; if (type === 'IEND') { end = n === 0 && next === bytes.length; break; } offset=next; }
    if (!data || !end) throw new Error('INVALID_SHOWCASE_IMAGE');
  } else if (bytes.length >= 30 && text(0,4) === 'RIFF' && text(8,4) === 'WEBP' && v.getUint32(4,true)+8 === bytes.length) {
    contentType = 'image/webp'; const kind=text(12,4);
    if (kind === 'VP8X') { width=1+bytes[24]!+(bytes[25]!<<8)+(bytes[26]!<<16); height=1+bytes[27]!+(bytes[28]!<<8)+(bytes[29]!<<16); }
    else if (kind === 'VP8 ' && bytes[23]===0x9d && bytes[24]===1 && bytes[25]===0x2a) { width=v.getUint16(26,true)&0x3fff; height=v.getUint16(28,true)&0x3fff; }
    else if (kind === 'VP8L' && bytes[20]===0x2f) { const bits=v.getUint32(21,true);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1; }
  } else if (bytes.length >= 10 && bytes[0]===255 && bytes[1]===216 && bytes[bytes.length-2]===255 && bytes[bytes.length-1]===217) {
    contentType='image/jpeg'; let i=2;
    while(i+8<bytes.length) { if(bytes[i]!==255) break; while(bytes[i]===255)i++;const marker=bytes[i++]!;if(marker===0xda||marker===0xd9)break;if(marker===1||marker>=0xd0&&marker<=0xd7)continue;const length=v.getUint16(i);if(length<2||i+length>bytes.length)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){height=v.getUint16(i+3);width=v.getUint16(i+5);break;}i+=length; }
  }
  if (!width || !height || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE || bytes.length > MAX_IMAGE_BYTES) throw new Error('INVALID_SHOWCASE_IMAGE');
  return { contentType,width,height };
}
function json(value: string): Record<string, unknown> { const parsed = JSON.parse(value); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('INVALID_SHOWCASE_EVIDENCE'); return parsed; }
async function evidenceFor(state: RoomState, winner: SketchWinner): Promise<Evidence | null> {
  const m=state.sketchRelay!, c=winner.chain, l=c.drawing!, source=l.source!;
  const query = 'SELECT id, room_id, round_id, kind, status, prompt_json, object_key, content_type, byte_size FROM jobs WHERE id = ? AND room_id = ? AND status = \'READY\'';
  const [original, transformed] = await Promise.all([getD1().prepare(query).bind(l.assetId,state.id).first<JobRow>(),getD1().prepare(query).bind(l.image.assetId,state.id).first<JobRow>()]);
  if(m.showdown?.version===4&&m.showdown.fallbackRounds.includes(winner.round)&&original&&original.kind==='SKETCH_UPLOAD'&&original.round_id===m.matchId+'-r'+winner.round&&original.object_key===source.objectKey&&original.byte_size===source.byteSize&&original.content_type==='image/png'){
   const receipt=json(original.prompt_json);if(receipt.matchId!==m.matchId||receipt.chainId!==c.chainId||receipt.playerId!==winner.artistId||receipt.assetId!==l.assetId||typeof receipt.sha256!=='string'||!/^[a-f0-9]{64}$/.test(receipt.sha256))return null;
   return {original:{key:original.object_key,assetId:original.id,contentType:'image/png',byteSize:source.byteSize,width:source.width,height:source.height,hash:receipt.sha256},transformed:{key:original.object_key,assetId:original.id,contentType:'image/png',byteSize:source.byteSize}};
  }
  if (!original || !transformed || original.kind!=='SKETCH_UPLOAD' || transformed.kind!=='SKETCH_TRANSFORM' || original.round_id!==`${m.matchId}-r${winner.round}` || transformed.round_id!==original.round_id || original.object_key!==source.objectKey || original.content_type!=='image/png' || original.byte_size!==source.byteSize || original.byte_size>450_000 || !transformed.object_key || !transformed.byte_size || transformed.byte_size>MAX_IMAGE_BYTES) return null;
  const receipt=json(original.prompt_json), payload=json(transformed.prompt_json);
  if (receipt.matchId!==m.matchId || receipt.round!==winner.round || receipt.chainId!==c.chainId || receipt.leg!=='drawing' || receipt.playerId!==winner.artistId || receipt.assetId!==l.assetId || receipt.objectKey!==source.objectKey || receipt.byteSize!==source.byteSize || receipt.contentType!==source.contentType || receipt.width!==source.width || receipt.height!==source.height || typeof receipt.sha256!=='string' || !/^[a-f0-9]{64}$/u.test(receipt.sha256) || payload.kind!=='SKETCH_TRANSFORM' || payload.matchId!==m.matchId || payload.round!==winner.round || payload.chainId!==c.chainId || payload.leg!=='drawing' || payload.sourceAssetId!==l.assetId || payload.jobId!==l.image.assetId) return null;
  return { original:{key:original.object_key,assetId:original.id,contentType:original.content_type,byteSize:original.byte_size,width:source.width,height:source.height,hash:receipt.sha256},transformed:{key:transformed.object_key,assetId:transformed.id,contentType:transformed.content_type,byteSize:transformed.byte_size} };
}
async function verifyOrCopy(id: string, kind: 'original' | 'transformed', source: Evidence['original'] | Evidence['transformed'], prior: string | null): Promise<ImageInfo> {
  const storage=runtimeEnv().MEDIA; if(!storage)throw new Error('SHOWCASE_STORAGE_UNAVAILABLE');
  const key=`showcase/sketch/${id}/${kind}`;
  // A verified partial copy can finish even if the disposable live-room object has expired.
  const existing=await storage.get(key);
  if(existing && prior){const info=JSON.parse(prior) as ImageInfo;const bytes=new Uint8Array(await existing.arrayBuffer());if(info.key===key&&bytes.length===info.byteSize&&await showcaseImageHash(bytes)===info.hash)return info;throw new Error('SHOWCASE_COPY_CHANGED');}
  const object=existing??await storage.get(source.key);if(!object||object.size!==source.byteSize)throw new Error('SHOWCASE_SOURCE_MISSING');
  const bytes=new Uint8Array(await object.arrayBuffer()), dimensions=showcaseImageDimensions(bytes), hash=await showcaseImageHash(bytes);
  if(dimensions.contentType!==source.contentType||'hash' in source&&(hash!==source.hash||dimensions.width!==source.width||dimensions.height!==source.height||dimensions.width!==dimensions.height||dimensions.width>512))throw new Error('SHOWCASE_SOURCE_CHANGED');
  const info:ImageInfo={key,...dimensions,hash,byteSize:bytes.length};
  if(!existing)await storage.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:dimensions.contentType},customMetadata:{purpose:'sketch-showcase',showcaseId:id,kind,sha256:hash}});
  const copied=await storage.get(key);if(!copied||copied.size!==bytes.length||await showcaseImageHash(new Uint8Array(await copied.arrayBuffer()))!==hash)throw new Error('SHOWCASE_COPY_UNVERIFIED');
  return info;
}
/** Retry is bounded, idempotent and terminal revocations are never overwritten. */
export async function retryPendingSketchShowcase(roomId: string, limit = 30): Promise<void> {
  const db=getD1(), rows=await db.prepare("SELECT id, state, evidence_json, original_info_json, transformed_info_json FROM sketch_showcase_entries WHERE room_id = ? AND state = 'pending' ORDER BY completed_at, id LIMIT ?").bind(roomId,Math.min(30,Math.max(1,limit))).all<EntryRow>();
  for(const row of rows.results)try{
    const evidence=JSON.parse(row.evidence_json) as Evidence;
    const original=await verifyOrCopy(row.id,'original',evidence.original,row.original_info_json);
    await db.prepare("UPDATE sketch_showcase_entries SET original_info_json = ?, updated_at = ? WHERE id = ? AND state = 'pending'").bind(JSON.stringify(original),Date.now(),row.id).run();
    const transformed=await verifyOrCopy(row.id,'transformed',evidence.transformed,row.transformed_info_json);
    await db.prepare("UPDATE sketch_showcase_entries SET transformed_info_json = ?, state = 'ready', updated_at = ? WHERE id = ? AND state = 'pending' AND ((rules_version=4 AND EXISTS(SELECT 1 FROM sorcery_hall_preferences h WHERE h.room_id=sketch_showcase_entries.room_id AND h.player_id=sketch_showcase_entries.artist_id AND h.enabled=1)) OR (rules_version<>4 AND EXISTS (SELECT 1 FROM sketch_showcase_preferences p WHERE p.room_id = sketch_showcase_entries.room_id AND p.player_id = sketch_showcase_entries.artist_id AND p.enabled = 1)))").bind(JSON.stringify(transformed),Date.now(),row.id).run();
  }catch{/* Pending records remain private; subsequent completion/consent/cleanup can retry. */}
}
export async function archiveSketchShowcase(state: RoomState): Promise<void> {
  const db=getD1(), winners=[...selectSketchRoundWinners(state),...selectSketchHallNominees(state)];
  for(const winner of winners)try{
    const id=`skw_${await sha256Hex(`${state.sketchRelay!.matchId}:${winner.round}:${winner.chain.chainId}`)}`;
    const prior=await db.prepare('SELECT state FROM sketch_showcase_entries WHERE id = ?').bind(id).first<{state:string}>();if(prior)continue;
    const evidence=await evidenceFor(state,winner);if(!evidence)continue;
    if(state.sketchRelay!.showdown!.version===4){await db.prepare('INSERT OR IGNORE INTO sorcery_hall_preferences(room_id,player_id,enabled) VALUES(?,?,0)').bind(state.id,winner.artistId).run();}
    // Freeze event attribution even before consent; unapproved records/media remain private.
    await db.prepare(`INSERT OR IGNORE INTO sketch_showcase_entries(id, room_id, source_match_id, history_match_id, source_game_id, rules_version, round_number, entry_id, artist_id, artist_name, completed_at, laughter_points, tied_count, state, evidence_json, updated_at) SELECT ?, ?, ?, ?, 'sketch-relay', ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN EXISTS (SELECT 1 FROM ${state.sketchRelay!.showdown!.version===4?'sorcery_hall_preferences':'sketch_showcase_preferences'} WHERE room_id = ? AND player_id = ? AND enabled = 1) THEN 'pending' ELSE 'unapproved' END, ?, ?`).bind(id,state.id,state.sketchRelay!.matchId,`${state.id}-match-${state.matchNumber}`,state.sketchRelay!.showdown!.version,winner.round,winner.chain.chainId,winner.artistId,winner.artistName,state.arcadeMatch!.endedAt??state.updatedAt,winner.points,winner.tiedCount,state.id,winner.artistId,JSON.stringify(evidence),Date.now()).run();
  }catch{/* Bad/missing historical evidence never makes a guessed pair. */}
  await retryPendingSketchShowcase(state.id);
}
export async function setSketchShowcasePreference(roomId: string,playerId: string,enabled: boolean,now: number,profileHash?: string): Promise<void> {
  const db=getD1();const statements=[db.prepare('INSERT INTO sketch_showcase_preferences(room_id, player_id, enabled, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(room_id, player_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at').bind(roomId,playerId,Number(enabled),now)];
  if(enabled)statements.push(db.prepare("UPDATE sketch_showcase_entries SET state = 'pending', updated_at = ? WHERE room_id = ? AND artist_id = ? AND state = 'unapproved'").bind(now,roomId,playerId));
  else statements.push(db.prepare("UPDATE sketch_showcase_entries SET state = 'withdrawn', updated_at = ? WHERE room_id = ? AND artist_id = ? AND state IN ('unapproved', 'pending', 'ready')").bind(now,roomId,playerId));
  if(profileHash)statements.push(db.prepare('INSERT INTO sketch_showcase_profile_preferences(profile_hash, enabled, updated_at) VALUES (?, ?, ?) ON CONFLICT(profile_hash) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at').bind(profileHash,Number(enabled),now));
  await db.batch(statements);
}
export async function setHallPreference(roomId:string,playerId:string,enabled:boolean,now:number){
 await getD1().batch([
  getD1().prepare('INSERT INTO sorcery_hall_preferences(room_id,player_id,enabled) VALUES(?,?,?) ON CONFLICT(room_id,player_id) DO UPDATE SET enabled=excluded.enabled').bind(roomId,playerId,Number(enabled)),
  getD1().prepare("UPDATE sketch_showcase_entries SET state=?,updated_at=? WHERE room_id=? AND artist_id=? AND rules_version=4 AND state IN ('unapproved','pending','ready')").bind(enabled?'pending':'withdrawn',now,roomId,playerId)
 ]);
}
export async function withdrawSketchShowcase(roomId:string,playerId:string,id:string,now:number):Promise<boolean>{
  const result=await getD1().prepare("UPDATE sketch_showcase_entries SET state = 'withdrawn', updated_at = ? WHERE id = ? AND room_id = ? AND artist_id = ? AND state IN ('pending', 'ready', 'withdrawn')").bind(now,id,roomId,playerId).run();return Number(result.meta?.changes??0)>0;
}
export async function listSketchShowcase(offset=0):Promise<{entries:PublicSketchWinner[];nextOffset:number|null}>{
  const bounded=Math.min(100_000,Math.max(0,Math.floor(offset)));const rows=await getD1().prepare("SELECT id, artist_name, round_number, tied_count, completed_at,rules_version,evidence_json FROM sketch_showcase_entries WHERE state = 'ready' AND original_info_json IS NOT NULL AND transformed_info_json IS NOT NULL ORDER BY completed_at DESC, source_match_id, round_number, id LIMIT 25 OFFSET ?").bind(bounded).all<{id:string;artist_name:string;round_number:number;tied_count:number;completed_at:number;rules_version:number;evidence_json:string}>();
  return {entries:rows.results.slice(0,24).map(row=>({id:row.id,artistName:row.artist_name,round:row.round_number,tiedCount:row.tied_count,completedAt:row.completed_at,...(row.rules_version===4?{awardKind:"hall" as const,magicUnavailable:(()=>{try{const e=JSON.parse(row.evidence_json) as Evidence;return e.original.assetId===e.transformed.assetId;}catch{return false;}})()}:{}),originalUrl:`/api/showcase/sketch-winners/${row.id}/original`,transformedUrl:`/api/showcase/sketch-winners/${row.id}/transformed`})),nextOffset:rows.results.length>24?bounded+24:null};
}
export async function readSketchShowcaseMedia(id:string,kind:string){
  if(!/^skw_[a-f0-9]{64}$/u.test(id)||!['original','transformed'].includes(kind))return null;
  const row=await getD1().prepare("SELECT original_info_json, transformed_info_json FROM sketch_showcase_entries WHERE id = ? AND state = 'ready'").bind(id).first<{original_info_json:string;transformed_info_json:string}>();if(!row)return null;
  const info=JSON.parse(kind==='original'?row.original_info_json:row.transformed_info_json) as ImageInfo;
  if(info.key!==`showcase/sketch/${id}/${kind}`||!['image/png','image/webp','image/jpeg'].includes(info.contentType))return null;
  const object=await runtimeEnv().MEDIA?.get(info.key);if(!object||object.size!==info.byteSize)return null;
  return {object,info};
}
