import {bindRoomCreationProfile} from "../../../../../server/player-creations/room-manifest";
import {apiError} from '../../../../../lib/contracts';
import {WorkshopActionSchema} from '../../../../../lib/sorcery-workshop';
import {authenticateRoom} from '../../../../../server/auth';
import {getD1,loadRoom,persistMutation} from '../../../../../server/database';
import {sha256Hex} from '../../../../../server/crypto';
import {getCookie,noStoreHeaders,readJson,requireSameOrigin} from '../../../../../server/http';
import {enforceRateLimit} from '../../../../../server/security';
import {applyWorkshop,workshopSnapshot} from '../../../../../server/sorcery/workshop';
import {syncSketchRelayRoom} from '../../../../../server/arcade/sketch_relay';
import {showdownScoreEvents} from '../../../../../server/arcade/sketch_showdown';
import type {DbEffect} from '../../../../../server/types';
export async function POST(request:Request,context:{params:Promise<{code:string}>}){
 const origin=requireSameOrigin(request);if(origin)return origin;
 const {code}=await context.params;const auth=await authenticateRoom(request,code,['player']);if(auth instanceof Response)return auth;
 const limited=await enforceRateLimit(request,`workshop:${code}:${auth.id}`,40);if(limited)return limited;
 const body=await readJson(request);if(body instanceof Response)return body;const parsed=WorkshopActionSchema.safeParse(body);if(!parsed.success)return apiError('INVALID_WORKSHOP_ACTION','Choose an available workshop activity.',422);
 const token=getCookie(request,'callback_profile');let owner:string|undefined;
 if(token&&/^[A-Za-z0-9_-]{40,64}$/.test(token)){const hash=await sha256Hex(token);if(await getD1().prepare('SELECT 1 FROM character_profiles WHERE token_hash=?').bind(hash).first())owner=hash;}
 if(!owner&&['issue','choose','lease'].includes(parsed.data.type))return apiError('PROFILE_REQUIRED','Reload your saved character profile first.',409);
 if(owner)await bindRoomCreationProfile(request,auth.state,auth.id);
 const a=parsed.data;const fingerprint=`WORKSHOP:${await sha256Hex(JSON.stringify(a))}`;
 try{
  for(let attempt=0;attempt<8;attempt++){
   const prior=await getD1().prepare('SELECT actor_id,action_type,response_json FROM processed_actions WHERE room_id=? AND action_id=?').bind(auth.state.id,a.actionId).first<{actor_id:string;action_type:string;response_json:string}>();
   if(prior){if(prior.actor_id!==auth.id||prior.action_type!==fingerprint)throw new Error('ACTION_ID_REUSED');return Response.json(JSON.parse(prior.response_json),{headers:noStoreHeaders()});}
   const loaded=await loadRoom(code);if(!loaded||loaded.state.id!==auth.state.id)throw new Error('ROOM_CLOSED');
   const next=structuredClone(loaded.state);if(next.paused||next.phase!=='ARCADE_ACTIVE'||!next.participants.some(p=>p.id===auth.id&&p.active&&!p.removedAt&&!p.bot)||!next.sketchRelay?.showdown)throw new Error('WORKSHOP_CLOSED');
   applyWorkshop(next.sketchRelay,auth.id,owner??`seat:${auth.id}`,a,Date.now());next.sketchRelay.updatedAt=Date.now();next.sketchRelay.version++;
   next.sketchRelay.scores=Object.fromEntries(next.sketchRelay.players.map(id=>[id,0]));for(const e of showdownScoreEvents(next.sketchRelay))next.sketchRelay.scores[e.playerId]+=e.points;
   const effects:DbEffect[]=[];syncSketchRelayRoom(next,effects,Date.now());
   if(await persistMutation({base:loaded.state,next,actionId:a.actionId,actorId:auth.id,actionType:fingerprint,effects}))return Response.json({ok:true,version:next.version,workshop:workshopSnapshot(next.sketchRelay,auth.id,Date.now())},{headers:noStoreHeaders()});
  }
  throw new Error('ROOM_CHANGED');
 }catch(error){return apiError('WORKSHOP_REJECTED',String(error instanceof Error?error.message:error).replaceAll('_',' ').slice(0,100),409);}
}
