import type { HostAction, PlayerAction } from "../lib/contracts";
import { blocksNewArchivedGame, isArchivedGamePack } from "../lib/game/archived-packs";
import {loadPromptWeights} from "./sorcery/prompt-learning";
import { getD1, loadRoom, persistMutation, processedAction, runtimeEnv } from "./database";
import { applyHostAction, applyPlayerAction } from "./engine";
import type { AuthenticatedRoom } from "./auth";
import { apiError } from "../lib/contracts";
import { getOpenAIImageAvailability } from "./openai-image-guard";
import { errorResponse } from "./errors";
import { noStoreHeaders } from "./http";
import { retireNativeArcadeRoom } from "./arcade-native/control";
import { sessionService } from "./sessions/runtime";

async function retireEndedRoom(code: string) {
  try { await retireNativeArcadeRoom(code); }
  catch { console.warn("room_retirement_deferred", { code }); }
}

type AuthLoader = () => Promise<AuthenticatedRoom | Response>;

async function revokeRemovedMembership(code: string, action: HostAction) {
  // Both HTTP and realtime actions must revoke parent-lobby membership. Repeat
  // this idempotent cleanup on retries in case the child commit succeeded first.
  if (action.type === "REMOVE_PLAYER") await (await sessionService()).removeSessionMemberForChild(code, action.payload.playerId);
}

export async function executeHostRoomAction(loadAuth: AuthLoader, action: HostAction, options: {retireAfterEnd?: boolean} = {}): Promise<Response> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const auth = await loadAuth(); if (auth instanceof Response) return auth;
    if (auth.role !== "host") return apiError("UNAUTHORIZED", "Only the host can control this room.", 401);
    if (action.type === "SET_CONFIG" && action.payload.imageModel === "openai-low") {
      const access = await getOpenAIImageAvailability(runtimeEnv());
      if (!access.available) return apiError(access.code ?? "OPENAI_IMAGES_STOPPED", access.message ?? "Image generation is stopped to protect the allowance.", 503);
    }
    if (blocksNewArchivedGame(auth.state.gameLength, action.type) || (action.type === "SET_CONFIG" && action.payload.gameLength && isArchivedGamePack(action.payload.gameLength))) return apiError("GAME_ARCHIVED", "That game pack is archived and unavailable for new launches.", 409);
    const prior = await processedAction(auth.state.id, action.actionId); if (prior) {
      try { await revokeRemovedMembership(auth.state.code, action); }
      catch (error) { return errorResponse(error); }
      if (action.type === "END_GAME" && auth.state.phase === "ENDED" && options.retireAfterEnd !== false) await retireEndedRoom(auth.state.code);
      return Response.json(prior, { headers: noStoreHeaders({ "X-Callback-Idempotent": "true" }) });
    }
    try {
      const mutation = applyHostAction(auth.state, action);
      if(auth.profileHash)mutation.next.sorceryHostProfileHash=auth.profileHash;
      if(mutation.next.sketchRelay?.showdown?.version===4&&mutation.next.sketchRelay.matchId!==auth.state.sketchRelay?.matchId){mutation.next.sketchRelay.showdown.promptWeights=await loadPromptWeights(getD1(),mutation.next.sorceryHostProfileHash).catch(()=>({}));}
      const won = await persistMutation({ base: auth.state, next: mutation.next, actionId: action.actionId, actorId: "host", actionType: action.type, effects: mutation.effects });
      if (won) {
        await revokeRemovedMembership(auth.state.code, action);
        if (action.type === "END_GAME" && options.retireAfterEnd !== false) await retireEndedRoom(auth.state.code);
        return Response.json({ ok: true, version: mutation.next.version, phase: mutation.next.phase }, { headers: noStoreHeaders() });
      }
      await new Promise((resolve) => setTimeout(resolve, 8 + Math.floor(Math.random() * 24)));
    } catch (error) { return errorResponse(error); }
  }
  return apiError("ROOM_BUSY", "The room changed at the same moment. Try again.", 409);
}

export async function executePlayerRoomAction(loadAuth: AuthLoader, action: PlayerAction): Promise<Response> {
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const auth = await loadAuth(); if (auth instanceof Response) return auth;
    if (auth.role !== "player" && auth.role !== "audience") return apiError("UNAUTHORIZED", "Your room session is missing or expired.", 401);
    const prior = await processedAction(auth.state.id, action.actionId); if (prior) return Response.json(prior, { headers: noStoreHeaders({ "X-Callback-Idempotent": "true" }) });
    try {
      const mutation = applyPlayerAction(auth.state, auth.id, action);
      const won = await persistMutation({ base: auth.state, next: mutation.next, actionId: action.actionId, actorId: auth.id, actionType: action.type, effects: mutation.effects });
      if (won) return Response.json({ ok: true, version: mutation.next.version, phase: mutation.next.phase }, { headers: noStoreHeaders() });
      const latest = await loadRoom(auth.state.code); if (!latest) return apiError("ROOM_NOT_FOUND", "That room could not be found.", 404);
      await new Promise((resolve) => setTimeout(resolve, 8 + Math.floor(Math.random() * 24)));
    } catch (error) { return errorResponse(error); }
  }
  return apiError("ROOM_BUSY", "The room changed at the same moment. Try again.", 409);
}
