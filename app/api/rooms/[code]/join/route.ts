import { getD1 } from "../../../../../server/database";
import { authorizePhotoFace } from "../../../../../server/profile-faces/authorize";
import { apiError, joinRoomSchema } from "../../../../../lib/contracts";
import { randomToken } from "../../../../../lib/game/random";
import { normalizeNickname, validateNickname } from "../../../../../lib/game/validators";
import { authenticateSeat, addParticipant, cleanupExpiredRooms, loadRoom } from "../../../../../server/database";
import { sha256Hex } from "../../../../../server/crypto";
import { getCookie, noStoreHeaders, readJson, requireSameOrigin, seatCookieName, sessionCookie } from "../../../../../server/http";
import { enforceRateLimit } from "../../../../../server/security";
import { sessionChildJoinError } from "../../../../../server/sessions/child-admission";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const { code: rawCode } = await context.params; const code = rawCode.toUpperCase();
  const limited = await enforceRateLimit(request, `join:${code}`, 75); if (limited) return limited;
  const parentJoin = await sessionChildJoinError(getD1(), "main", code); if (parentJoin) return parentJoin;
  let loaded = await loadRoom(code); if (!loaded) return apiError("ROOM_NOT_FOUND", "That room could not be found.", 404);
  const existing = await authenticateSeat(loaded.state.id, getCookie(request, seatCookieName(code)));
  if (existing) {
    const participant = loaded.state.participants.find((item) => item.id === existing.id);
    if (participant && !participant.removedAt) return Response.json({ code, role: participant.role, id: participant.id, nickname: participant.nickname, restored: true, version: loaded.state.version }, { headers: noStoreHeaders() });
  }
  const payload = await readJson(request); if (payload instanceof Response) return payload;
  const parsed = joinRoomSchema.safeParse(payload); if (!parsed.success) return apiError("INVALID_REQUEST", "Enter a nickname and try again.", 422, parsed.error.flatten());
  const faceError = await authorizePhotoFace(request, parsed.data.avatarConfig?.photoFaceId, getD1()); if (faceError) return faceError;
  let nickname: string;
  try { nickname = validateNickname(parsed.data.nickname); } catch (error) { return apiError(error instanceof Error ? error.message : "INVALID_NICKNAME", "Nicknames must contain 1–20 characters.", 422); }
  const normalized = normalizeNickname(nickname);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    loaded = await loadRoom(code); if (!loaded) return apiError("ROOM_NOT_FOUND", "That room could not be found.", 404);
    const state = loaded.state;
    if (!parsed.data.audience && (state.joiningLocked || state.phase !== "LOBBY" || state.status !== "LOBBY")) return apiError("JOINING_LOCKED", "New players can only join before the game starts.", 409);
    if (parsed.data.audience && ["COMPLETE", "ENDED"].includes(state.status)) return apiError("JOINING_LOCKED", "Spectators can join while the game is active.", 409);
    if (state.participants.some((participant) => !participant.removedAt && participant.nicknameNormalized === normalized)) {
      let suffix = 2; let suggestion = `${nickname} ${suffix}`;
      while (state.participants.some((participant) => !participant.removedAt && participant.nicknameNormalized === normalizeNickname(suggestion))) { suffix += 1; suggestion = `${nickname} ${suffix}`; }
      return apiError("DUPLICATE_NICKNAME", "That nickname is already in use in the room.", 409, { suggestion });
    }
    const playerCount = state.participants.filter((participant) => participant.role === "player" && !participant.bot && !participant.removedAt).length;
    if (!parsed.data.audience && playerCount >= 10) return apiError("ROOM_FULL", "This room already has ten players.", 409);
    const token = randomToken();
    const role = parsed.data.audience ? "audience" : "player";
    const added = await addParticipant(code, { nickname, nicknameNormalized: normalized, role, active: true, pendingActivation: false, avatarConfig: parsed.data.avatarConfig, avatarPreset: parsed.data.avatarPreset ?? null }, await sha256Hex(token));
    if (added === "RACE") continue;
    void cleanupExpiredRooms(1).catch(() => undefined);
    return new Response(JSON.stringify({ code, role, id: added.id, nickname, pendingActivation: false, restored: false }), { status: 201, headers: noStoreHeaders({ "Content-Type": "application/json", "Set-Cookie": sessionCookie(seatCookieName(code), token) }) });
  }
  return apiError("ROOM_BUSY", "The room changed while you joined. Try once more.", 409);
}
