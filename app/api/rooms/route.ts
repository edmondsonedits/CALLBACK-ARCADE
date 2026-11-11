import { getD1 } from "../../../server/database";
import { authorizePhotoFace } from "../../../server/profile-faces/authorize";
import { createRoomSchema, apiError } from "../../../lib/contracts";
import { ARCADE_GAMES } from "../../../lib/arcade/catalog";
import { isArchivedArcadeGame } from "../../../lib/arcade/archived-games";
import { SOLO_BOT_NAMES } from "../../../server/bots";
import { randomRoomCode, randomToken } from "../../../lib/game/random";
import { normalizeNickname, validateNickname } from "../../../lib/game/validators";
import { sha256Hex } from "../../../server/crypto";
import { addParticipant, cleanupExpiredRooms, insertRoom, loadFeedbackTallies, loadRoom, persistMutation, roomCodeAvailable, runtimeEnv } from "../../../server/database";
import { createRoomState } from "../../../server/engine";
import { readJson, requireSameOrigin, hostCookieName, noStoreHeaders, seatCookieName, sessionCookie } from "../../../server/http";
import { getOpenAIImageAvailability } from "../../../server/openai-image-guard";
import { enforceRateLimit } from "../../../server/security";

export async function POST(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const limited = await enforceRateLimit(request, "create-room", 10); if (limited) return limited;
  const payload = await readJson(request); if (payload instanceof Response) return payload;
  const parsed = createRoomSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: { code: "INVALID_REQUEST", message: "Choose a valid game configuration.", detail: parsed.error.flatten() } }, { status: 422 });
  const faceError = await authorizePhotoFace(request, parsed.data.foolHostAvatarConfig?.photoFaceId, getD1()); if (faceError) return faceError;
  if (parsed.data.imageModel === "openai-low" && !parsed.data.fishTestOnly) {
    const access = await getOpenAIImageAvailability(runtimeEnv());
    if (!access.available) return apiError(access.code ?? "OPENAI_IMAGES_STOPPED", access.message ?? "Image generation is stopped to protect the allowance.", 503);
  }
  if (parsed.data.gameLength === "arcade" && (isArchivedArcadeGame(parsed.data.arcadeGameId) || !ARCADE_GAMES.some((game) => game.id === parsed.data.arcadeGameId && game.status === "playable"))) {
    return Response.json({ error: { code: "ARCADE_GAME_UNAVAILABLE", message: "That Arcade game is not playable yet." } }, { status: 409 });
  }
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const feedbackTallies = await loadFeedbackTallies();
  let code = "";
  let state: ReturnType<typeof createRoomState> | null = null;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = randomRoomCode();
    if (!(await roomCodeAvailable(candidate))) continue;
    const candidateState = createRoomState(candidate, { ...parsed.data, feedbackTallies });
    try {
      await insertRoom(candidateState, tokenHash);
      code = candidate;
      state = candidateState;
      break;
    } catch (error) {
      if (/unique|constraint failed.*rooms\.code/i.test(String(error))) continue;
      throw error;
    }
  }
  if (!state) return Response.json({ error: { code: "CODE_EXHAUSTED", message: "Could not reserve a room code. Try again." } }, { status: 503 });
  let foolPlayerToken: string | null = null;
  let foolPlayerId: string | null = null;
  if (parsed.data.gameLength === "bowl-of-fools") {
    const nickname = validateNickname(parsed.data.foolHostName ?? "Host");
    foolPlayerToken = randomToken();
    const hostPlayer = await addParticipant(code, {
      nickname,
      nicknameNormalized: normalizeNickname(nickname),
      role: "player",
      active: true,
      pendingActivation: false,
      bot: false,
      avatarConfig: parsed.data.foolHostAvatarConfig,
      avatarPreset: parsed.data.foolHostAvatarPreset ?? null,
    }, await sha256Hex(foolPlayerToken));
    if (hostPlayer === "RACE") return Response.json({ error: { code: "ROOM_BUSY", message: "Your player seat was missed while the room was being prepared. Try again." } }, { status: 409 });
    foolPlayerId = hostPlayer.id;
    const loaded = await loadRoom(code);
    if (!loaded) return Response.json({ error: { code: "ROOM_NOT_FOUND", message: "The Bowl of Fools room could not be restored." } }, { status: 500 });
    const next = structuredClone(loaded.state);
    next.foolHostPlayerId = hostPlayer.id;
    const configured = await persistMutation({ base: loaded.state, next, actionId: `configure-fool-host:${hostPlayer.id}`, actorId: "system", actionType: "CONFIGURE_FOOL_HOST", effects: [] });
    if (!configured) return Response.json({ error: { code: "ROOM_BUSY", message: "The host seat could not finish setting up. Try again." } }, { status: 409 });
    state = next;
  }
  let soloToken: string | null = null;
  let soloPlayerId: string | null = null;
  if (parsed.data.soloMode) {
    const nickname = validateNickname(parsed.data.soloPlayerName ?? "Tester");
    soloToken = randomToken();
    const human = await addParticipant(code, { nickname, nicknameNormalized: normalizeNickname(nickname), role: "player", active: true, pendingActivation: false, bot: false }, await sha256Hex(soloToken));
    if (human === "RACE") return Response.json({ error: { code: "ROOM_BUSY", message: "The solo room changed while it was being prepared. Try again." } }, { status: 409 });
    soloPlayerId = human.id;
    const usedNames = new Set([normalizeNickname(nickname)]);
    for (let index = 0; index < parsed.data.botCount; index += 1) {
      const baseName = SOLO_BOT_NAMES[index];
      let botName: string = baseName;
      let suffix = 2;
      while (usedNames.has(normalizeNickname(botName))) { botName = `${baseName.slice(0, 17)} ${suffix}`; suffix += 1; }
      usedNames.add(normalizeNickname(botName));
      const bot = await addParticipant(code, { nickname: botName, nicknameNormalized: normalizeNickname(botName), role: "player", active: true, pendingActivation: false, bot: true }, await sha256Hex(randomToken()));
      if (bot === "RACE") return Response.json({ error: { code: "ROOM_BUSY", message: "A bot missed its seat. Try creating the room once more." } }, { status: 409 });
    }
    const loaded = await loadRoom(code);
    if (!loaded) return Response.json({ error: { code: "ROOM_NOT_FOUND", message: "The solo room could not be restored." } }, { status: 500 });
    const next = structuredClone(loaded.state);
    next.soloPlayerId = human.id;
    next.joiningLocked = true;
    if (next.gameLength === "birthday") next.birthdayPersonId = human.id;
    const configured = await persistMutation({ base: loaded.state, next, actionId: `configure-solo:${human.id}`, actorId: "system", actionType: "CONFIGURE_SOLO", effects: [] });
    if (!configured) return Response.json({ error: { code: "ROOM_BUSY", message: "The solo room could not finish setting up. Try again." } }, { status: 409 });
    state = next;
  }
  void cleanupExpiredRooms(1).catch(() => undefined);
  const origin = new URL(request.url).origin;
  const headers = noStoreHeaders({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", sessionCookie(hostCookieName(code), token));
  if (soloToken && soloPlayerId) headers.append("Set-Cookie", sessionCookie(seatCookieName(code), soloToken));
  if (foolPlayerToken && foolPlayerId) headers.append("Set-Cookie", sessionCookie(seatCookieName(code), foolPlayerToken));
  return new Response(JSON.stringify({ code, role: parsed.data.soloMode || parsed.data.gameLength === "bowl-of-fools" ? "player" : "host", hostUrl: `${origin}/host/${code}`, playUrl: `${origin}/play/${code}`, soloUrl: parsed.data.soloMode ? `${origin}/play/${code}` : null, playerId: soloPlayerId ?? foolPlayerId, version: state.version }), { status: 201, headers });
}
