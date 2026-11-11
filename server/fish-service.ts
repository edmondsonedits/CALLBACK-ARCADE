import { randomUuid } from "../lib/game/random";
import { z } from "zod";
import { FishFinaleActionSchema } from "../lib/arcade/fish-finale";
import { applyFishFinaleAction, createFishFinale, fishFinaleSnapshot } from "./arcade/fish_finale";
import type { RoomState } from "./types";
import { isValidSketchRelayMatch } from "./arcade/sketch_relay";
export const FishRequestSchema = z.object({ actionId:z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), type:z.enum(["FISH_OPEN",...FishFinaleActionSchema.options.map(action=>action.shape.type.value)]), payload:z.record(z.string(),z.unknown()) }).strict();
export function requireFishMatch(room:RoomState) {
 const m=room.sketchRelay;
 if(m?.fishTest) {
   if(room.gameLength!=="arcade"||room.arcadeGameId!=="sketch-relay"||room.phase!=="LOBBY"||room.status!=="LOBBY"||room.arcadeMatch!==null||room.deadlineAt!==null||!isValidSketchRelayMatch(m)||m.fishTestPreviousJoiningLocked===undefined||!m.showdown||m.showdown.version!==3||m.phase!=="prompt-writing"||m.matchId!==m.finale?.matchId) throw new Error("FISH_TEST_INVALID");
   return m;
 }
 if(room.arcadeGameId!=="sketch-relay"||room.phase!=="ARCADE_RESULTS"||room.status!=="COMPLETE"||room.arcadeMatch?.status!=="COMPLETE"||!m||m.showdown?.version!==3||m.phase!=="complete"||m.matchId!==room.arcadeMatch.id) throw new Error("FISH_REQUIRES_COMPLETED_MATCH");
 return m;
}
export function requireFishGame(room:RoomState) {
 if(room.gameLength==="arcade"&&room.arcadeGameId==="fish-tank"&&room.phase==="ARCADE_ACTIVE"&&room.status==="ACTIVE"&&room.arcadeMatch?.status==="ACTIVE"&&room.fishGame&&room.fishGame.matchId===room.arcadeMatch.id)return {matchId:room.fishGame.matchId,finale:room.fishGame,standalone:true as const};
 const match=requireFishMatch(room);
 if(!match.finale)throw new Error("BONUS_NOT_STARTED");
 return {matchId:match.matchId,finale:match.finale,standalone:false as const};
}
export function applyFishRequest(room:RoomState, actor:{id:string;host:boolean}, input:z.infer<typeof FishRequestSchema>, now:number) {
 if(room.arcadeGameId==="fish-tank") {
   const game=requireFishGame(room);if(!game.standalone)throw new Error("FISH_TANK_INVALID");
   if(input.type==="FISH_OPEN")throw new Error("FISH_ALREADY_STARTED");
   if(input.payload.matchId!==game.matchId||input.payload.finaleId!==game.finale.finaleId||input.payload.phase!==game.finale.phase)throw new Error("FISH_STALE_PHASE");
   if(input.type==="FISH_BACK") {
     const action=FishFinaleActionSchema.parse({type:input.type,payload:input.payload});
     applyFishFinaleAction(game.finale,actor,action,now);
     const next=structuredClone(room);next.fishGame=null;next.arcadeMatch={...next.arcadeMatch!,status:"COMPLETE",endedAt:now,result:{closedReason:"abandoned"}};next.phase="LOBBY";next.status="LOBBY";next.phaseStartedAt=now;next.deadlineAt=null;next.paused=false;next.remainingMs=null;next.joiningLocked=false;next.updatedAt=now;
     return next;
   }
   if(input.type==="FISH_BALLOT"&&!room.participants.some(p=>p.id===actor.id&&p.role==="player"&&p.active&&!p.bot&&!p.removedAt))throw new Error("PLAYER_REQUIRED");
   if(input.type!=="FISH_BALLOT"&&!actor.host)throw new Error("HOST_REQUIRED");
   const action=FishFinaleActionSchema.parse({type:input.type,payload:input.payload});
   const finale=applyFishFinaleAction(game.finale,actor,action,now);
   const next=structuredClone(room);next.fishGame=finale;
   if(action.type==="FISH_EXIT") {
     next.phase="ARCADE_RESULTS";next.status="COMPLETE";next.phaseStartedAt=now;next.deadlineAt=null;
     next.arcadeMatch={...next.arcadeMatch!,status:"COMPLETE",endedAt:now,result:{fishResult:finale.result??null,closedReason:finale.closedReason??"abandoned"}};
   } else next.deadlineAt=finale.pausedAt!==undefined?null:finale.deadline||null;
   next.updatedAt=now;return next;
 }
 const m=requireFishMatch(room); const next=structuredClone(room);
 if(m.fishTest&&input.type==="FISH_OPEN")throw new Error("FISH_TEST_ALREADY_STARTED");
 if(input.type==="FISH_OPEN") {
   if(!actor.host)throw new Error("HOST_REQUIRED");
   if(input.payload.matchId!==m.matchId)throw new Error("STALE_MATCH");
   if(m.finale)throw new Error("BONUS_ALREADY_OFFERED");
   next.sketchRelay!.finale=createFishFinale({matchId:m.matchId,seed:randomUuid(),now,players:m.players.map(id=>{const p=room.participants.find(p=>p.id===id);return{id,name:p?.nickname??"Artist",bot:Boolean(p?.bot)};})});
 } else {
   if(!m.finale)throw new Error("BONUS_NOT_STARTED");
   if(!actor.host&&!room.participants.some(p=>p.id===actor.id&&p.role==="player"&&p.active&&!p.removedAt))throw new Error("PLAYER_REQUIRED");
   const action=FishFinaleActionSchema.parse({type:input.type,payload:input.payload});
   if(m.fishTest&&["FISH_EXIT","FISH_BACK"].includes(action.type)) {
     if(!actor.host)throw new Error("FISH_UNAUTHORIZED");
     if(action.payload.matchId!==m.matchId||action.payload.finaleId!==m.finale.finaleId||action.payload.phase!==m.finale.phase)throw new Error("FISH_STALE_PHASE");
     if(action.type==="FISH_EXIT")applyFishFinaleAction(m.finale,actor,action,now);
     else if(now<m.finale.updatedAt)throw new Error("FISH_INVALID_TIME");
     next.sketchRelay= null; next.phase="LOBBY"; next.status="LOBBY"; next.phaseStartedAt=now; next.deadlineAt=null; next.paused=false; next.remainingMs=null; next.joiningLocked=m.fishTestPreviousJoiningLocked??next.joiningLocked; next.updatedAt=now;
     return next;
   }
   const finale=applyFishFinaleAction(m.finale,actor,action,now);
   if(action.type==="FISH_BACK")delete next.sketchRelay!.finale;
   else next.sketchRelay!.finale=finale;
 }
 return next;
}
export function canViewFishAsset(room:RoomState,playerId:string|undefined,assetId:string,trustedPreload=false,now=Date.now()) {
 const standalone=room.fishGame;if(standalone) {
  if(standalone.entries.some(e=>e.assetId===assetId&&e.playerId===playerId))return true;
  return fishFinaleSnapshot(standalone,playerId,trustedPreload,now).entries.some(e=>e.assetId===assetId);
 }
 const f=room.sketchRelay?.finale;if(!f)return false;
 if(f.entries.some(e=>e.assetId===assetId&&e.playerId===playerId))return true;
 return fishFinaleSnapshot(f,playerId,trustedPreload,now,Boolean(room.sketchRelay?.fishTest)).entries.some(e=>e.assetId===assetId);
}
