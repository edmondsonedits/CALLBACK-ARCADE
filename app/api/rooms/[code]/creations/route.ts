import {getD1} from '../../../../../server/database';
import {authenticateRoom} from '../../../../../server/auth';
import {bindRoomCreationProfile,roomCreationAssets} from '../../../../../server/player-creations/room-manifest';
import {noStoreHeaders,requireSameOrigin,readJson} from '../../../../../server/http';
import {enforceRateLimit} from '../../../../../server/security';
export async function GET(request:Request,context:{params:Promise<{code:string}>}){
 const {code}=await context.params;const auth=await authenticateRoom(request,code,['host','display','player']);if(auth instanceof Response)return auth;
 const limited=await enforceRateLimit(request,`creation-manifest:${code}:${auth.id}`,90);if(limited)return limited;
 const assets=await roomCreationAssets(auth.state);
 const hidden=Boolean((await getD1().prepare('SELECT hidden FROM room_creation_controls WHERE room_id=?').bind(auth.state.id).first<{hidden:number}>())?.hidden);
 return Response.json({hidden,assets:assets.map(a=>({id:a.id,kind:a.kind,revision:a.revision,participantId:a.participantId,placement:a.placement,scale:a.scale,artistName:auth.state.participants.find(p=>p.id===a.participantId)?.nickname??'An artist',url:`/api/rooms/${code}/creations/${a.id}?revision=${a.revision}`}))},{headers:noStoreHeaders()});
}
export async function POST(request:Request,context:{params:Promise<{code:string}>}){
 const origin=requireSameOrigin(request);if(origin)return origin;const {code}=await context.params;const auth=await authenticateRoom(request,code,['host','player']);if(auth instanceof Response)return auth;
 const limited=await enforceRateLimit(request,`creation-presence:${code}:${auth.id}`,20);if(limited)return limited;
 const input=await readJson(request);if(input instanceof Response)return input;if(auth.role==='host'){const hidden=(input as {hideReturningArt?:unknown})?.hideReturningArt;if(typeof hidden!=='boolean')return Response.json({error:'INVALID_PERMISSION'},{status:422,headers:noStoreHeaders()});await getD1().prepare('INSERT INTO room_creation_controls(room_id,hidden) VALUES(?,?) ON CONFLICT(room_id) DO UPDATE SET hidden=excluded.hidden').bind(auth.state.id,Number(hidden)).run();return Response.json({hidden},{headers:noStoreHeaders()});}const flag=(input as {allowHistory?:unknown})?.allowHistory;if(flag!==undefined&&typeof flag!=='boolean')return Response.json({error:'INVALID_PERMISSION'},{status:422,headers:noStoreHeaders()});
 const owner=await bindRoomCreationProfile(request,auth.state,auth.id,flag);return Response.json({ok:Boolean(owner)},{status:owner?200:409,headers:noStoreHeaders()});
}
