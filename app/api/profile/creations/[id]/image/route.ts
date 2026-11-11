import { getCookie, noStoreHeaders, requireSameOrigin } from "../../../../../../server/http";
import { sha256Hex } from "../../../../../../server/crypto";
import { enforceRateLimit } from "../../../../../../server/security";
import { playerCreationService } from "../../../../../../server/player-creations/runtime";

const COOKIE = "callback_profile";
type Context = { params: Promise<{ id: string }> };
function jsonError(error: string, status: number): Response { return Response.json({ error }, { status, headers: noStoreHeaders({ "Content-Type": "application/json; charset=utf-8" }) }); }

export async function GET(request: Request, context: Context): Promise<Response> {
  const failure = requireSameOrigin(request); if (failure) return new Response(failure.body, { status: failure.status, headers: noStoreHeaders(failure.headers) });
  const limited = await enforceRateLimit(request, "profile-creation-image", 60); if (limited) return new Response(limited.body, { status: limited.status, headers: noStoreHeaders(limited.headers) });
  const token = getCookie(request, COOKIE); if (!token || !/^[A-Za-z0-9_-]{40,64}$/u.test(token)) return jsonError("PROFILE_COOKIE_REQUIRED", 401);
  try {
    const service = await playerCreationService(), hash = await sha256Hex(token);
    if (!await service.assertProfile(hash)) return jsonError("PROFILE_COOKIE_REQUIRED", 401);
    const raster = await service.getCurrentRaster(hash, (await context.params).id);
    if (!raster) return jsonError("CREATION_NOT_FOUND", 404);
    const headers = noStoreHeaders({ "Content-Type": "image/png", "Content-Length": String(raster.size), "Cache-Control": "private, no-store", "Content-Disposition": "inline; filename=creation.png" });
    return new Response(raster.body, { status: 200, headers });
  } catch { return jsonError("PLAYER_CREATION_UNAVAILABLE", 503); }
}
