import { apiError } from "../../../../../../lib/contracts";
import { authenticateRoom } from "../../../../../../server/auth";
import { sha256Hex } from "../../../../../../server/crypto";
import { getD1,loadRoom,persistMutation,runtimeEnv } from "../../../../../../server/database";
import { requireFishGame } from "../../../../../../server/fish-service";
import { readFishPng,FishPngError } from "../../../../../../server/fish-png";
import { noStoreHeaders,requireSameOrigin } from "../../../../../../server/http";
import { enforceRateLimit } from "../../../../../../server/security";
import { submitFish, tickFishFinale } from "../../../../../../server/arcade/fish_finale";
import { archiveFishCreation,bindRoomCreationProfile,fishCreationId,retryFishArchives } from "../../../../../../server/player-creations/room-manifest";
interface Receipt {sha256:string;playerId:string;matchId:string;finaleId:string;actionId:string}
export async function POST(request:Request,context:{params:Promise<{code:string}>}){
 const origin=requireSameOrigin(request);if(origin)return origin;
 const {code}=await context.params;const auth=await authenticateRoom(request,code,["player"]);if(auth instanceof Response)return auth;
 if(!auth.participant?.active||auth.participant.bot)return apiError("PLAYER_REQUIRED","An active player must send the fish.",403);
 const rate=await enforceRateLimit(request,`fish-upload:${code}:${auth.id}`,12);if(rate)return rate;
 const matchId=request.headers.get("X-Fish-Match"),finaleId=request.headers.get("X-Fish-Finale"),actionId=request.headers.get("X-Fish-Action-Id")??"";
 if(!matchId||!finaleId||!(/^[a-zA-Z0-9_-]{1,100}$/u.test(actionId)))return apiError("INVALID_UPLOAD","Missing fish submission context.",422);
 try{
 const m=requireFishGame(auth.state);if(m.finale.finaleId!==finaleId||m.matchId!==matchId)throw new Error("This fish belongs to a previous round.");
 const {bytes,width,height,bounds}=await readFishPng(request);const digest=await crypto.subtle.digest("SHA-256",bytes);const sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
 const assetId=`fish_${await sha256Hex(`${auth.state.id}:${auth.id}:${actionId}`)}`;
 const source=()=>getD1().prepare("SELECT prompt_json FROM jobs WHERE id=? AND room_id=? AND kind='FISH_UPLOAD' AND status='READY'").bind(assetId,auth.state.id).first<{prompt_json:string}>();
 const collectionOwnerHash=await bindRoomCreationProfile(request,auth.state,auth.id);
 const collectionCreationId=collectionOwnerHash?await fishCreationId(auth.state.id,assetId,collectionOwnerHash):undefined;
 const receipt={sha256,playerId:auth.id,matchId,finaleId,actionId,...(collectionOwnerHash?{collectionOwnerHash,collectionCreationId}:{})};
 const duplicate=async(row:{prompt_json:string})=>{const prior=JSON.parse(row.prompt_json) as Receipt;if(Object.entries({sha256,playerId:auth.id,matchId,finaleId,actionId}).some(([k,v])=>prior[k as keyof Receipt]!==v))return apiError("ACTION_ID_REUSED","That upload ID belongs to another fish.",409);await retryFishArchives(auth.state.id);return Response.json({ok:true,assetId,idempotent:true},{headers:noStoreHeaders()});};
 const prior=await source();if(prior)return duplicate(prior);
 // Validate the frozen seat and current clock before writing storage.
 const fresh=await loadRoom(code);if(!fresh||fresh.state.id!==auth.state.id)throw new Error("Room closed.");
 if(!fresh.state.participants.some(p=>p.id===auth.id&&p.role==="player"&&p.active&&!p.bot&&!p.removedAt))throw new Error("Player removed.");
 const freshGame=requireFishGame(fresh.state);if(freshGame.finale.finaleId!==finaleId)throw new Error("Previous tank.");
 const usedBeforeWrite=await getD1().prepare("SELECT 1 AS used FROM processed_actions WHERE room_id=? AND action_id=?").bind(auth.state.id,actionId).first();if(usedBeforeWrite)return apiError("ACTION_ID_REUSED","That request ID is already used.",409);
 submitFish(tickFishFinale(freshGame.finale,Date.now()),auth.id,assetId,Date.now());
 const storage=runtimeEnv().MEDIA;if(!storage)return apiError("STORAGE_UNAVAILABLE","Keep your fish and retry shortly.",503);
 const objectKey=`rooms/${auth.state.id}/${assetId}-${sha256}.png`;
 await storage.put(objectKey,bytes,{onlyIf:{etagDoesNotMatch:"*"},httpMetadata:{contentType:"image/png"}});
 if((await storage.head(objectKey))?.size!==bytes.length)throw new Error("Fish storage confirmation failed.");
 for(let i=0;i<8;i++){
  const loaded=await loadRoom(code);if(!loaded||loaded.state.id!==auth.state.id)throw new Error("Room closed.");
  const found=await source();if(found)return duplicate(found);
  const used=await getD1().prepare("SELECT 1 AS used FROM processed_actions WHERE room_id=? AND action_id=?").bind(auth.state.id,actionId).first();if(used)return apiError("ACTION_ID_REUSED","That request ID is already used.",409);
  if(!loaded.state.participants.some(p=>p.id===auth.id&&p.role==="player"&&p.active&&!p.bot&&!p.removedAt))throw new Error("Player removed.");
  const game=requireFishGame(loaded.state);if(game.matchId!==matchId||game.finale.finaleId!==finaleId)throw new Error("This fish belongs to a previous round.");
  const next=structuredClone(loaded.state);const submitted=submitFish(tickFishFinale(game.finale,Date.now()),auth.id,assetId,Date.now(),{width,height,anchors:{head:{x:.80078125,y:.5},body:{x:.53515625,y:.5},tail:{x:.16015625,y:.5}},bounds});if(game.standalone)next.fishGame=submitted;else next.sketchRelay!.finale=submitted;
  if(await persistMutation({base:loaded.state,next,actionId,actorId:auth.id,actionType:"FISH_UPLOAD",effects:[{type:"sketch_source",kind:"FISH_UPLOAD",id:assetId,roundId:finaleId,promptHash:assetId,prompt:{...receipt,width,height},objectKey,byteSize:bytes.length,now:Date.now()}]})){
   const entryId=submitted.entries.find(entry=>entry.playerId===auth.id)?.id;
   if(entryId)await archiveFishCreation(request,next,auth.id,bytes,assetId).catch(error=>console.warn("fish_creation_archive_deferred",{room:code,participant:auth.id,entryId,reason:String(error)}));
   return Response.json({ok:true,assetId,version:next.version},{headers:noStoreHeaders()});
  }
 }
 return apiError("ROOM_CHANGED","The tank changed. Retry the same fish.",409);
 }catch(error){return apiError("FISH_UPLOAD_REJECTED",error instanceof FishPngError?error.message:"Your fish could not be accepted. Check the timer and retry the same drawing.",error instanceof FishPngError?422:409);}
}
