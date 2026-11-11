import {getD1,runtimeEnv} from '../database';
import {getCookie} from '../http';
import {sha256Hex} from '../crypto';
import {emptyFishDocument} from '../../lib/fish-art';
import {playerCreationService} from './runtime';
import type {RoomState} from '../types';
export async function bindRoomCreationProfile(request:Request,state:RoomState,actor:string,allowHistory?:boolean){
 const token=getCookie(request,'callback_profile');if(!token||!/^[A-Za-z0-9_-]{40,64}$/.test(token))return null;
 const owner=await sha256Hex(token);if(!await getD1().prepare('SELECT 1 FROM character_profiles WHERE token_hash=?').bind(owner).first())return null;
 if(!state.participants.some(p=>p.id===actor&&p.active&&!p.removedAt&&!p.bot))return null;
 await getD1().prepare('INSERT INTO player_creation_presence(room_id,participant_id,profile_hash,allow_history) VALUES(?,?,?,?) ON CONFLICT(room_id,participant_id) DO UPDATE SET profile_hash=excluded.profile_hash,allow_history=CASE WHEN ? IS NULL THEN player_creation_presence.allow_history ELSE excluded.allow_history END').bind(state.id,actor,owner,Number(allowHistory??false),allowHistory===undefined?null:Number(allowHistory)).run();return owner;
}
export async function roomCreationAssets(state:RoomState){
 if((await getD1().prepare('SELECT hidden FROM room_creation_controls WHERE room_id=?').bind(state.id).first<{hidden:number}>())?.hidden)return [];

 const rows=await getD1().prepare('SELECT participant_id,profile_hash,allow_history FROM player_creation_presence WHERE room_id=?').bind(state.id).all<{participant_id:string;profile_hash:string;allow_history:number}>();
 const fish=state.fishGame??state.sketchRelay?.finale;const roster=fish?new Set(fish.participantIds.length?fish.participantIds:fish.players.map(p=>p.id)):null;
 const present=rows.results.filter(r=>(!roster||roster.has(r.participant_id))&&state.participants.some(p=>p.id===r.participant_id&&p.active&&!p.removedAt&&!p.bot));

 const sourceRows=await getD1().prepare('SELECT creation_id,match_id FROM fish_creation_sources WHERE room_id=? AND match_id=?').bind(state.id,state.fishGame?.matchId??state.sketchRelay?.finale?.matchId??'').all<{creation_id:string;match_id:string}>();const current=new Set(sourceRows.results.map(r=>r.creation_id));
 const assets=await (await playerCreationService()).listRoomCreations(new Map(present.map(r=>[r.participant_id,r.profile_hash])),[...current]);
 return assets.filter(a=>a.kind==='scenery'||!current.has(a.id)&&present.some(p=>p.participant_id===a.participantId&&p.allow_history===1));
}
export async function fishCreationId(roomId:string,assetId:string,owner:string){const digest=await sha256Hex(roomId+':'+assetId+':'+owner);return digest.slice(0,8)+'-'+digest.slice(8,12)+'-4'+digest.slice(13,16)+'-a'+digest.slice(17,20)+'-'+digest.slice(20,32);}
export async function archiveFishCreation(request:Request,state:RoomState,actor:string,bytes:Uint8Array,assetId:string){const owner=await bindRoomCreationProfile(request,state,actor);if(!owner)return;await archiveFishForOwner(state.id,state.fishGame?.matchId??state.sketchRelay?.matchId??'',owner,bytes,assetId);}
async function archiveFishForOwner(roomId:string,matchId:string,owner:string,bytes:Uint8Array,assetId:string){
 if(!/^[a-f0-9]{64}$/.test(owner))throw new Error('INVALID_ARCHIVE_OWNER');const id=await fishCreationId(roomId,assetId,owner);
 if(await getD1().prepare('SELECT 1 FROM player_creations WHERE creation_id=?').bind(id).first())return;
 const storage=runtimeEnv().MEDIA;if(!storage)throw new Error('ARCHIVE_STORAGE_UNAVAILABLE');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes).buffer)),b=>b.toString(16).padStart(2,'0')).join('');const key='player-creations/'+owner+'/'+id+'/fish-'+hash+'.png';
 await storage.put(key,Uint8Array.from(bytes),{httpMetadata:{contentType:'image/png'}});const head=await storage.head(key);if(!head||head.size!==bytes.byteLength)throw new Error('ARCHIVE_STORAGE_UNCONFIRMED');
 const now=Date.now();await getD1().batch([
  getD1().prepare("INSERT INTO player_creations(creation_id,profile_hash,kind,title,created_at,updated_at,share_in_rooms,revision,state,draft_json,placement_json,current_object_key,current_sha256,current_byte_size) VALUES(?,?,'fish','Previous fish',?,?,1,1,'ready',?,?,?,?,?) ON CONFLICT(creation_id) DO NOTHING").bind(id,owner,now,now,JSON.stringify(emptyFishDocument()),JSON.stringify({x:.5,y:.5,layer:'backdrop'}),key,hash,bytes.byteLength),
  getD1().prepare('INSERT INTO fish_creation_sources(creation_id,room_id,match_id,asset_id) VALUES(?,?,?,?) ON CONFLICT(creation_id) DO NOTHING').bind(id,roomId,matchId,assetId)
 ]);
}
/** READY upload receipts form a durable retry queue; pending copies defer room cleanup. */
export async function retryFishArchives(roomId:string):Promise<boolean>{
 const pending=await getD1().prepare("SELECT j.id,j.prompt_json,j.object_key,j.byte_size FROM jobs j LEFT JOIN player_creations c ON c.creation_id=json_extract(j.prompt_json,'$.collectionCreationId') WHERE j.room_id=? AND j.kind='FISH_UPLOAD' AND j.status='READY' AND json_extract(j.prompt_json,'$.collectionCreationId') IS NOT NULL AND c.creation_id IS NULL LIMIT 10").bind(roomId).all<{id:string;prompt_json:string;object_key:string;byte_size:number}>();
 for(const job of pending.results){try{const receipt=JSON.parse(job.prompt_json) as {collectionOwnerHash:string;collectionCreationId:string;matchId:string;sha256:string};if(await fishCreationId(roomId,job.id,receipt.collectionOwnerHash)!==receipt.collectionCreationId)continue;const object=await runtimeEnv().MEDIA?.get(job.object_key);if(!object||object.size!==job.byte_size)continue;const bytes=new Uint8Array(await object.arrayBuffer());const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==receipt.sha256)continue;await archiveFishForOwner(roomId,receipt.matchId,receipt.collectionOwnerHash,bytes,job.id);}catch{/* Retry on the next queue drain or cleanup. */}}
 const remaining=await getD1().prepare("SELECT 1 AS pending FROM jobs j LEFT JOIN player_creations c ON c.creation_id=json_extract(j.prompt_json,'$.collectionCreationId') WHERE j.room_id=? AND j.kind='FISH_UPLOAD' AND j.status='READY' AND json_extract(j.prompt_json,'$.collectionCreationId') IS NOT NULL AND c.creation_id IS NULL LIMIT 1").bind(roomId).first();return !remaining;
}
