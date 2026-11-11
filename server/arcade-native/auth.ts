import { loadRoom, getD1 } from "../database";
import { timingSafeStringEqual } from "../crypto";
import { roomSocketGameId, verifyNativeArcadeSocketTicket, type NativeArcadeSocketClaims } from "../../lib/arcade/native-socket-ticket";
import type { AuthenticatedRoom } from "../auth";

export interface NativeAuthContext {
  loaded: NonNullable<Awaited<ReturnType<typeof loadRoom>>>;
  child: { id: string; session_code: string } | null;
}
export async function loadNativeAuthContext(code: string): Promise<NativeAuthContext> {
  const loaded = await loadRoom(code);
  if (!loaded) throw new Error("NATIVE_ARCADE_STALE_ROOM");
  const child = await getD1().prepare("SELECT id, session_code FROM callback_session_games WHERE child_kind = 'main' AND child_code = ? AND active = 1 LIMIT 1").bind(code).first<{ id: string; session_code: string }>();
  return { loaded, child };
}

export async function authenticateNativeArcadeTicket(ticket: string, secret: string, now = Date.now(), context?: NativeAuthContext): Promise<AuthenticatedRoom> {
  const claims = await verifyNativeArcadeSocketTicket(ticket, secret, { now });
  const { loaded, child } = context ?? await loadNativeAuthContext(claims.roomCode);
  if (!loaded || loaded.state.id !== claims.roomId) throw new Error("NATIVE_ARCADE_STALE_ROOM");
  const state = loaded.state;
  if (state.code !== claims.roomCode || roomSocketGameId(state.gameLength, state.arcadeGameId) !== claims.gameId) throw new Error("NATIVE_ARCADE_STALE_GAME");
  const currentMatchId = state.gameLength === "arcade" ? state.arcadeMatch?.id ?? "lobby" : String(state.matchNumber);
  if (currentMatchId !== claims.matchId || state.phase === "ARCADE_ACTIVE" && state.arcadeMatch?.status !== "ACTIVE") throw new Error("NATIVE_ARCADE_STALE_MATCH");
  const generationId = child?.id ?? state.id;
  const partyKey = child ? `session-${child.session_code}` : `native-${state.id}`;
  if (claims.generationId !== generationId || claims.partyKey !== partyKey) throw new Error("NATIVE_ARCADE_STALE_GENERATION");

  if (claims.role === "host") {
    if (claims.actorId !== "host" || !timingSafeStringEqual(claims.tokenHash, loaded.row.host_token_hash)) throw new Error("NATIVE_ARCADE_REVOKED");
    return { state, role: "host", id: "host", participant: null };
  }
  if (claims.role === "display") {
    const mirror = await getD1().prepare("SELECT id FROM display_sessions WHERE id = ? AND room_id = ? AND last_seen_at > ?").bind(claims.tokenHash, state.id, now - 6 * 60 * 60 * 1000).first<{ id: string }>();
    if (claims.actorId !== "display" || !mirror) throw new Error("NATIVE_ARCADE_REVOKED");
    return { state, role: "display", id: "display", participant: null };
  }
  const player = await getD1().prepare("SELECT id, role FROM players WHERE id = ? AND room_id = ? AND token_hash = ? AND removed_at IS NULL").bind(claims.actorId, state.id, claims.tokenHash).first<{ id: string; role: "player" | "audience" }>();
  const participant = state.participants.find((item) => item.id === claims.actorId && !item.removedAt);
  if (!player || !participant || player.role !== claims.role || participant.role !== claims.role || !participant.active || claims.role === "player" && participant.bot) throw new Error("NATIVE_ARCADE_REVOKED");
  return { state, role: player.role, id: player.id, participant };
}

export function nativeClaimBinding(claims: NativeArcadeSocketClaims) {
  return { roomId: claims.roomId, roomCode: claims.roomCode, gameId: claims.gameId, matchId: claims.matchId, generationId: claims.generationId, partyKey: claims.partyKey, actorId: claims.actorId, tokenHash: claims.tokenHash, role: claims.role };
}
