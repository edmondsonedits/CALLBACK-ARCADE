import { HostActionSchema, apiError } from "../../../../../lib/contracts";
import { authenticateRoom } from "../../../../../server/auth";
import { executeHostRoomAction } from "../../../../../server/room-actions";
import { readJson, requireSameOrigin } from "../../../../../server/http";
import { enforceRateLimit } from "../../../../../server/security";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const { code: rawCode } = await context.params; const code = rawCode.toUpperCase();
  const initialAuth = await authenticateRoom(request, code, ["host"]); if (initialAuth instanceof Response) return initialAuth;
  const limited = await enforceRateLimit(request, `host-action:${code}:${initialAuth.id}`, 90); if (limited) return limited;
  const payload = await readJson(request); if (payload instanceof Response) return payload;
  const parsed = HostActionSchema.safeParse(payload); if (!parsed.success) return apiError("INVALID_ACTION", "That host action is not valid.", 422, parsed.error.flatten());
  return executeHostRoomAction(() => authenticateRoom(request, code, ["host"]), parsed.data);
}
