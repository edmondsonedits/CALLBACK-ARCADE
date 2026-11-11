import { getD1 } from "../../../../../server/database";
import { authorizePhotoFace } from "../../../../../server/profile-faces/authorize";
import { PlayerActionSchema, apiError } from "../../../../../lib/contracts";
import { authenticateRoom } from "../../../../../server/auth";
import { executePlayerRoomAction } from "../../../../../server/room-actions";
import { readJson, requireSameOrigin } from "../../../../../server/http";
import { enforceRateLimit } from "../../../../../server/security";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const { code: rawCode } = await context.params; const code = rawCode.toUpperCase();
  const initialAuth = await authenticateRoom(request, code, ["player", "audience"]); if (initialAuth instanceof Response) return initialAuth;
  const limited = await enforceRateLimit(request, `player-action:${code}:${initialAuth.id}`, 45); if (limited) return limited;
  const payload = await readJson(request); if (payload instanceof Response) return payload;
  const parsed = PlayerActionSchema.safeParse(payload); if (!parsed.success) return apiError("INVALID_ACTION", "That player action is not valid.", 422, parsed.error.flatten());
  if (parsed.data.type === "UPDATE_AVATAR") { const faceError = await authorizePhotoFace(request, parsed.data.payload.avatarConfig.photoFaceId, getD1()); if (faceError) return faceError; }
  return executePlayerRoomAction(() => authenticateRoom(request, code, ["player", "audience"]), parsed.data);
}
