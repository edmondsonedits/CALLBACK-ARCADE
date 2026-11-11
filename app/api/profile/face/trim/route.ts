import { getCookie, noStoreHeaders, requireSameOrigin } from "../../../../../server/http";
import { enforceIdentityRateLimit, enforceRateLimit } from "../../../../../server/security";
import { ProfileFaceError } from "../../../../../server/profile-faces/service";
import { profileFaceService } from "../../../../../server/profile-faces/runtime";
import { sha256Hex } from "../../../../../server/crypto";

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: code, message }, { status, headers: noStoreHeaders({ "Content-Type": "application/json; charset=utf-8" }) });
}

export async function POST(request: Request): Promise<Response> {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return errorResponse("CROSS_ORIGIN_BLOCKED", "This request must come from the game site.", 403);
  const token = getCookie(request, "callback_profile");
  if (!token || token.length < 40 || token.length > 64) return errorResponse("PROFILE_COOKIE_REQUIRED", "Reload the page to access your private character.", 401);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return errorResponse("CONTENT_TYPE_REQUIRED", "Use application/json.", 415);
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/u.test(length) || Number(length) > 256)) return errorResponse("BODY_TOO_LARGE", "The trim request is too large.", 413);
  if (!request.body) return errorResponse("INVALID_TRIM", "Choose a saved face and chin cutoff.", 422);
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let total = 0, body: unknown, timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new Error("TRIM_BODY_TIMEOUT")); }, 12_000); });
    await Promise.race([(async () => {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        total += value.byteLength;
        if (total > 256) { void reader.cancel().catch(() => {}); throw new Error("BODY_TOO_LARGE"); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      body = JSON.parse(new TextDecoder().decode(bytes));
    })(), timeout]);
  } catch (error) {
    if (error instanceof Error && error.message === "TRIM_BODY_TIMEOUT") return errorResponse("TRIM_BODY_TIMEOUT", "The trim request took too long.", 408);
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return errorResponse("BODY_TOO_LARGE", "The trim request is too large.", 413);
    return errorResponse("INVALID_JSON", "The trim request is not valid JSON.", 400);
  } finally { if (timer) clearTimeout(timer); reader.releaseLock(); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return errorResponse("INVALID_TRIM", "Choose a saved face and chin cutoff.", 422);
  const { faceId, cutoffPercent, curvePercent: submittedCurvePercent } = body as { faceId?: unknown; cutoffPercent?: unknown; curvePercent?: unknown };
  const curvePercent = submittedCurvePercent === undefined ? 0 : submittedCurvePercent;
  if (typeof faceId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(faceId) || !Number.isInteger(cutoffPercent) || (cutoffPercent as number) < 20 || (cutoffPercent as number) > 95 || !Number.isInteger(curvePercent) || (curvePercent as number) < 0 || (curvePercent as number) > 40) return errorResponse("INVALID_TRIM", "Choose a saved face, cutoff from 20% to 95%, and curve from 0% to 40%.", 422);
  try {
    const byIp = await enforceRateLimit(request, "profile-face-trim-ip", 20); if (byIp) return new Response(byIp.body, { status: byIp.status, headers: noStoreHeaders(byIp.headers) });
    const profileHash = await sha256Hex(token);
    const byProfile = await enforceIdentityRateLimit(request, "profile-face-trim-profile", profileHash, 12); if (byProfile) return new Response(byProfile.body, { status: byProfile.status, headers: noStoreHeaders(byProfile.headers) });
    const result = await (await profileFaceService()).trim(token, faceId, cutoffPercent as number, curvePercent as number);
    return Response.json(result, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof ProfileFaceError) {
      if (error.code === "PROFILE_FACE_NOT_OWNED") return errorResponse(error.code, "Choose a face from your own saved character.", error.status);
      if (error.code === "INVALID_CUTOFF") return errorResponse(error.code, "Choose a chin cutoff from 20% to 95%.", error.status);
      if (error.code === "INVALID_CURVE") return errorResponse(error.code, "Choose a chin curve from 0% to 40%.", error.status);
      return errorResponse(error.code, "The trimmed face could not be saved. Try again shortly.", error.status);
    }
    return errorResponse("PROFILE_FACE_UNAVAILABLE", "The face could not be trimmed. Try again shortly.", 503);
  }
}
