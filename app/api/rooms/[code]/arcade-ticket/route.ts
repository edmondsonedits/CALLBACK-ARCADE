import { apiError } from "../../../../../lib/contracts";
import { authenticateRoom } from "../../../../../server/auth";
import { issueArcadeTicket, resolveArcadeTicketRole, selectArcadeControllerIds } from "../../../../../server/arcade/tickets";
import { syncArcadeWorker } from "../../../../../server/arcade/control";
import { runtimeEnv } from "../../../../../server/database";
import { noStoreHeaders, requireSameOrigin } from "../../../../../server/http";
import { enforceRateLimit } from "../../../../../server/security";

interface ArcadeRuntimeEnv { ARCADE_TICKET_SECRET?: string; ARCADE_CONTROL_SECRET?: string; ARCADE_WORKER_URL?: string }

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const { code: rawCode } = await context.params; const code = rawCode.toUpperCase();
  const auth = await authenticateRoom(request, code, ["host", "player"]); if (auth instanceof Response) return auth;
  const syncOnly = new URL(request.url).searchParams.get("sync") === "1";
  const limited = await enforceRateLimit(request, `arcade-ticket:${code}:${auth.role}:${auth.id}`, syncOnly ? 30 : 45);
  if (limited) return limited;
  const secret = (runtimeEnv() as ArcadeRuntimeEnv).ARCADE_TICKET_SECRET;
  const workerUrl = (runtimeEnv() as ArcadeRuntimeEnv).ARCADE_WORKER_URL;
  const controlSecret = (runtimeEnv() as ArcadeRuntimeEnv).ARCADE_CONTROL_SECRET;
  if (!workerUrl || (!syncOnly && !secret) || (syncOnly && !controlSecret)) return apiError("ARCADE_UNAVAILABLE", "Arcade real-time service is not configured.", 503);
  if (auth.state.gameLength !== "arcade" || !auth.state.arcadeGameId || !auth.state.arcadeMatch ||
    (syncOnly ? !["ARCADE_ACTIVE", "ARCADE_RESULTS"].includes(auth.state.phase) || (auth.state.phase === "ARCADE_ACTIVE" ? auth.state.arcadeMatch.status !== "ACTIVE" : auth.state.arcadeMatch.status !== "COMPLETE") : auth.state.phase !== "ARCADE_ACTIVE" || auth.state.arcadeMatch.status !== "ACTIVE")) return apiError("ARCADE_NOT_ACTIVE", "This Arcade match is not active.", 409);
  const controllerIds = auth.state.arcadeMatch.controllerIds ?? selectArcadeControllerIds(auth.state.arcadeGameId, auth.state.participants, auth.state.arcadeMatch.matchNumber);
  const revokedControllerIds = controllerIds.filter((id) => !auth.state.participants.some((participant) => participant.id === id && participant.active && !participant.removedAt && !participant.bot));
  if (controllerIds.length < 2) return apiError("ARCADE_CONTROLLERS_UNAVAILABLE", "This match does not have two active controllers.", 409);
  if (syncOnly) {
    const realtimeGameId = auth.state.arcadeGameId;
    if (!controlSecret || (realtimeGameId !== "air-hockey" && realtimeGameId !== "tap-race" && realtimeGameId !== "light-trails")) return apiError("ARCADE_NOT_SYNCABLE", "This real-time game is not available.", 409);
    try {
      await syncArcadeWorker({ roomCode: code, gameId: realtimeGameId, matchId: auth.state.arcadeMatch.id, roomVersion: auth.state.version, phase: auth.state.phase as "ARCADE_ACTIVE" | "ARCADE_RESULTS", paused: auth.state.phase === "ARCADE_RESULTS" || auth.state.paused, controllerIds, revokedControllerIds }, workerUrl, controlSecret);
      return Response.json({ ok: true, version: auth.state.version, phase: auth.state.phase }, { headers: noStoreHeaders() });
    } catch { return apiError("ARCADE_UNAVAILABLE", "The real-time game is reconnecting. Please try again.", 503); }
  }
  if (auth.role === "player" && (!auth.participant || !auth.participant.active || auth.participant.removedAt || auth.participant.bot)) return apiError("ARCADE_PLAYER_UNAVAILABLE", "This player cannot watch the Arcade match.", 403);
  if (auth.role !== "host" && auth.role !== "player") return apiError("ARCADE_ROLE_UNAVAILABLE", "This session cannot control the Arcade game.", 403);
  let parsedUrl: URL;
  try { parsedUrl = new URL(workerUrl); } catch { return apiError("ARCADE_UNAVAILABLE", "Arcade real-time service is not configured.", 503); }
  const localDevelopmentWorker = process.env.NODE_ENV !== "production" && runtimeEnv().CALLBACK_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(parsedUrl.hostname) && parsedUrl.protocol === "http:";
  if ((parsedUrl.protocol !== "https:" && !localDevelopmentWorker) || parsedUrl.username || parsedUrl.password) return apiError("ARCADE_UNAVAILABLE", "Arcade real-time service is not configured.", 503);
  const role = resolveArcadeTicketRole(auth.role, auth.id, controllerIds);
  const issued = await issueArcadeTicket({ roomCode: code, gameId: auth.state.arcadeGameId, matchId: auth.state.arcadeMatch.id, role, playerId: role === "host" ? null : auth.id }, secret!);
  return Response.json({ ticket: issued.ticket, workerUrl: parsedUrl.toString().replace(/\/$/u, ""), role }, { headers: noStoreHeaders() });
}
