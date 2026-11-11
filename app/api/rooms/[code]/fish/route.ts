import { apiError } from "../../../../../lib/contracts";
import { authenticateRoom } from "../../../../../server/auth";
import { sha256Hex } from "../../../../../server/crypto";
import { getD1, loadRoom, persistMutation } from "../../../../../server/database";
import { applyFishRequest, FishRequestSchema } from "../../../../../server/fish-service";
import { noStoreHeaders, readJson, requireSameOrigin } from "../../../../../server/http";
import { enforceRateLimit } from "../../../../../server/security";
export async function POST(request:Request,context:{params:Promise<{code:string}>}) {
 const origin=requireSameOrigin(request);if(origin)return origin;
 const body=await readJson(request);if(body instanceof Response)return body;
 const parsed=FishRequestSchema.safeParse(body);if(!parsed.success)return apiError("INVALID_FISH_ACTION","That tank action is invalid.",422);
 const input=parsed.data; const {code}=await context.params;
 // A seated host keeps both cookies. Ballots must use the authenticated seat, never the host screen identity.
 const auth=await authenticateRoom(request,code,input.type==="FISH_BALLOT"?["player"]:["host"]);if(auth instanceof Response)return auth;
 const rate=await enforceRateLimit(request,`fish:${code}:${auth.id}`,40);if(rate)return rate;
 const fingerprint=`FISH:${await sha256Hex(JSON.stringify({type:input.type,payload:input.payload}))}`;
 try {
 for(let attempt=0;attempt<16;attempt++) {
   const prior=await getD1().prepare("SELECT actor_id,action_type,response_json FROM processed_actions WHERE room_id=? AND action_id=?").bind(auth.state.id,input.actionId).first<{actor_id:string;action_type:string;response_json:string}>();
   if(prior){if(prior.actor_id!==auth.id||prior.action_type!==fingerprint)return apiError("ACTION_ID_REUSED","This request ID has already been used.",409);return Response.json(JSON.parse(prior.response_json),{headers:noStoreHeaders()});}
   const loaded=await loadRoom(code);if(!loaded||loaded.state.id!==auth.state.id)return apiError("ROOM_NOT_FOUND","This room has closed.",404);
   const next=applyFishRequest(loaded.state,{id:auth.id,host:auth.role==="host"},input,Date.now());
   const endedAt=next.arcadeMatch?.endedAt??Date.now();
   const effects=next.arcadeMatch?.status==="COMPLETE"&&loaded.state.arcadeMatch?.status==="ACTIVE"?[{type:"arcade_finalize" as const,match:next.arcadeMatch,event:{eventId:next.arcadeMatch.id+":fish-tank:complete",matchId:next.arcadeMatch.id,type:"result" as const,playerId:null,points:0,occurredAt:endedAt,payload:next.arcadeMatch.result??{}}}]:[];
   if(await persistMutation({base:loaded.state,next,actionId:input.actionId,actorId:auth.id,actionType:fingerprint,effects}))return Response.json({ok:true,version:next.version},{headers:noStoreHeaders()});
 }
 return apiError("ROOM_CHANGED","The tank changed. Please retry.",409);
 }catch(error){const reason=error instanceof Error?error.message:"FISH_ACTION_REJECTED";return apiError("FISH_ACTION_REJECTED",reason.replaceAll("_"," ").toLowerCase().slice(0,160),409);}
}
