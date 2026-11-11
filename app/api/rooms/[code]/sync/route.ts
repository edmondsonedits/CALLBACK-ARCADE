import { apiError, syncRequestSchema } from "../../../../../lib/contracts";
import { authenticateRoom } from "../../../../../server/auth";
import { syncAuthenticatedRoom } from "../../../../../server/room-sync";
import { displayCookieName, getCookie, noStoreHeaders, readJson, requireSameOrigin } from "../../../../../server/http";
import { enforceRateLimit } from "../../../../../server/security";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const { code: rawCode } = await context.params; const code = rawCode.toUpperCase();
  const roleHint = request.headers.get("x-callback-role");
  const roles = roleHint === "host" ? ["host" as const] : roleHint === "player" ? ["player" as const, "audience" as const] : roleHint === "display" ? ["display" as const] : ["host" as const, "player" as const, "audience" as const];
  const authenticated = await authenticateRoom(request, code, roles); if (authenticated instanceof Response) return authenticated;
  const limited = await enforceRateLimit(request, `sync:${code}:${authenticated.role}:${authenticated.id}`, 100); if (limited) return limited;
  const payload = await readJson(request); if (payload instanceof Response) return payload;
  const parsed = syncRequestSchema.safeParse(payload); if (!parsed.success) return apiError("INVALID_REQUEST", "Sync requires the last room version.", 422);
  const now = Date.now();
  const { snapshot, version } = await syncAuthenticatedRoom(authenticated, { displayToken: getCookie(request, displayCookieName(code)) }, now);
  if (parsed.data.version === version) return new Response(null, { status: 204, headers: noStoreHeaders({ "X-Callback-Version": String(version), "X-Callback-Server-Time": String(now) }) });
  return Response.json(snapshot, { headers: noStoreHeaders() });
}
