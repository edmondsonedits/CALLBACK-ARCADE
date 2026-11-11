import { z } from 'zod';
import { apiError } from '../../../../../lib/contracts';
import { authenticateRoom, type AuthenticatedRoom } from '../../../../../server/auth';
import { sha256Hex } from '../../../../../server/crypto';
import { getD1 } from '../../../../../server/database';
import { getCookie, noStoreHeaders, readJson, requireSameOrigin } from '../../../../../server/http';
import { enforceRateLimit } from '../../../../../server/security';
import { archiveSketchShowcase, setHallPreference, setSketchShowcasePreference, withdrawSketchShowcase } from '../../../../../server/sketch-showcase';
const change=z.union([z.object({enabled:z.boolean()}).strict(),z.object({withdrawId:z.string().regex(/^skw_[a-f0-9]{64}$/u)}).strict()]);
async function owner(request:Request,rawCode:string){const auth=await authenticateRoom(request,rawCode.toUpperCase(),['player']);if(auth instanceof Response)return auth;if(!auth.participant||auth.participant.bot||!auth.participant.active)return apiError('PLAYER_REQUIRED','An active artist seat is required.',403);return auth;}
async function profileHash(request:Request){const token=getCookie(request,'callback_profile');if(!token||!/^[A-Za-z0-9_-]{40,64}$/u.test(token))return undefined;const hash=await sha256Hex(token);const exists=await getD1().prepare('SELECT 1 AS found FROM character_profiles WHERE token_hash = ?').bind(hash).first();return exists?hash:undefined;}
async function preference(auth:AuthenticatedRoom,request:Request){
  if(auth.state.sketchRelay?.showdown?.version===4){const row=await getD1().prepare('SELECT enabled FROM sorcery_hall_preferences WHERE room_id=? AND player_id=?').bind(auth.state.id,auth.id).first<{enabled:number}>();return row?.enabled===1;}
  let row=await getD1().prepare('SELECT enabled FROM sketch_showcase_preferences WHERE room_id = ? AND player_id = ?').bind(auth.state.id,auth.id).first<{enabled:number}>();
  if(!row){const hash=await profileHash(request);const saved=hash?await getD1().prepare('SELECT enabled FROM sketch_showcase_profile_preferences WHERE profile_hash = ?').bind(hash).first<{enabled:number}>():null;if(saved?.enabled===1){await setSketchShowcasePreference(auth.state.id,auth.id,true,Date.now());row={enabled:1};}}
  return row?.enabled===1;
}
async function result(auth:AuthenticatedRoom,enabled:boolean){
  const entries=await getD1().prepare("SELECT id, round_number, state FROM sketch_showcase_entries WHERE room_id = ? AND artist_id = ? AND state IN ('pending','ready') ORDER BY completed_at DESC, id LIMIT 30").bind(auth.state.id,auth.id).all<{id:string;round_number:number;state:string}>();
  return Response.json({enabled,scope:auth.state.sketchRelay?.showdown?.version===4?'hall':'winners',entries:entries.results.map(e=>({id:e.id,round:e.round_number,status:e.state}))},{headers:noStoreHeaders()});
}
export async function GET(request:Request,context:{params:Promise<{code:string}>}){const auth=await owner(request,(await context.params).code);if(auth instanceof Response)return auth;const enabled=await preference(auth,request);if(enabled)await archiveSketchShowcase(auth.state);return result(auth,enabled);}
export async function POST(request:Request,context:{params:Promise<{code:string}>}){
  const origin=requireSameOrigin(request);if(origin)return origin;const auth=await owner(request,(await context.params).code);if(auth instanceof Response)return auth;
  const limited=await enforceRateLimit(request,`sketch-showcase:${auth.state.id}:${auth.id}`,20);if(limited)return limited;
  const body=await readJson(request);if(body instanceof Response)return body;const parsed=change.safeParse(body);if(!parsed.success)return apiError('INVALID_SHOWCASE_PREFERENCE','Choose a showcase preference or your own entry.',422);
  if('enabled'in parsed.data){if(auth.state.sketchRelay?.showdown?.version===4){await setHallPreference(auth.state.id,auth.id,parsed.data.enabled,Date.now());if(parsed.data.enabled)await archiveSketchShowcase(auth.state);return result(auth,parsed.data.enabled);}await setSketchShowcasePreference(auth.state.id,auth.id,parsed.data.enabled,Date.now(),await profileHash(request));if(parsed.data.enabled)await archiveSketchShowcase(auth.state);return result(auth,parsed.data.enabled);}
  if(!await withdrawSketchShowcase(auth.state.id,auth.id,parsed.data.withdrawId,Date.now()))return apiError('SHOWCASE_ENTRY_NOT_FOUND','That featured entry does not belong to your current seat.',404);
  return result(auth,await preference(auth,request));
}
