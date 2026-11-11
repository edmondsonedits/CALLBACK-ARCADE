import { apiError, type Role } from "../../../../../lib/contracts";
import { roomSocketGameId, issueNativeArcadeSocketTicket } from "../../../../../lib/arcade/native-socket-ticket";
import { authenticateRoom } from "../../../../../server/auth";
import { getD1, loadRoom, runtimeEnv } from "../../../../../server/database";
import { sha256Hex } from "../../../../../server/crypto";
import { displayCookieName, getCookie, hostCookieName, noStoreHeaders, requireSameOrigin, seatCookieName } from "../../../../../server/http";
import { enforceRateLimit } from "../../../../../server/security";

interface NativeArcadeRuntimeEnv { PARTY_SECRET?: string; PARTY_WORKER_URL?: string; CALLBACK_ENV?: string }

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const code = (await context.params).code.toUpperCase();
  const roleHint = request.headers.get("x-callback-role");
  const roles: Role[] = roleHint === "host" ? ["host"] : roleHint === "player" ? ["player", "audience"] : roleHint === "display" ? ["display"] : ["host", "player", "audience"];
  const auth = await authenticateRoom(request, code, roles); if (auth instanceof Response) return auth;
  const limited = await enforceRateLimit(request, `native-socket-ticket:${code}:${auth.role}:${auth.id}`, 30); if (limited) return limited;
  const gameId = roomSocketGameId(auth.state.gameLength, auth.state.arcadeGameId);
  if (!gameId) return apiError("NATIVE_ARCADE_UNAVAILABLE", "This room does not use shared real-time transport.", 409);
  const env = runtimeEnv() as NativeArcadeRuntimeEnv;
  if (!env.PARTY_SECRET || env.PARTY_SECRET.length < 32 || !env.PARTY_WORKER_URL) return apiError("NATIVE_ARCADE_UNAVAILABLE", "Arcade real-time service is not configured.", 503);
  let workerUrl: URL;
  try {
    workerUrl = new URL(env.PARTY_WORKER_URL);
    const local = (process.env.NODE_ENV !== "production" || env.CALLBACK_ENV === "development") && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(workerUrl.hostname);
    if (workerUrl.username || workerUrl.password || workerUrl.search || workerUrl.hash || !(workerUrl.protocol === "https:" || local && workerUrl.protocol === "http:")) throw new Error("invalid worker url");
  } catch { return apiError("NATIVE_ARCADE_UNAVAILABLE", "Arcade real-time service is not configured.", 503); }

  const room = await loadRoom(code); if (!room || room.state.id !== auth.state.id) return apiError("ROOM_NOT_FOUND", "That room could not be found.", 404);
  let generationId = room.state.id;
  let partyKey = `native-${room.state.id}`;
  const child = await getD1().prepare("SELECT id, session_code FROM callback_session_games WHERE child_kind = 'main' AND child_code = ? AND active = 1 LIMIT 1").bind(code).first<{ id: string; session_code: string }>();
  if (child) { generationId = child.id; partyKey = `session-${child.session_code}`; }

  const cookieName = auth.role === "host" ? hostCookieName(code) : auth.role === "display" ? displayCookieName(code) : seatCookieName(code);
  const token = getCookie(request, cookieName);
  if (!token) return apiError("UNAUTHORIZED", "Your room session is missing or expired.", 401);
  if (auth.role === "player" && (!auth.participant?.active || auth.participant.removedAt || auth.participant.bot)) return apiError("NATIVE_ARCADE_PLAYER_UNAVAILABLE", "This player cannot connect to the Arcade match.", 403);
  const issued = await issueNativeArcadeSocketTicket({
    roomId: room.state.id, roomCode: code, gameId, matchId: room.state.gameLength === "arcade" ? room.state.arcadeMatch?.id ?? "lobby" : String(room.state.matchNumber),
    generationId, partyKey, actorId: auth.id, tokenHash: await sha256Hex(token), role: auth.role,
  }, env.PARTY_SECRET);
  return Response.json({ ticket: issued.ticket, workerUrl: workerUrl.toString().replace(/\/$/u, ""), roomKey: await sha256Hex(`${room.state.id}:${generationId}`) }, { headers: noStoreHeaders() });
}
