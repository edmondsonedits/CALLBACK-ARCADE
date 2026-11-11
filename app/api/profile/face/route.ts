import { getCookie, noStoreHeaders, requireSameOrigin } from "../../../../server/http";
import { enforceIdentityRateLimit, enforceRateLimit } from "../../../../server/security";
import { ProfileFaceError, PROFILE_FACE_MAX_UPLOAD_BYTES } from "../../../../server/profile-faces/service";
import { profileFaceService } from "../../../../server/profile-faces/runtime";
import { sha256Hex } from "../../../../server/crypto";

const COOKIE = "callback_profile";
function privateError(code: string, message: string, status: number): Response {
  return Response.json({ error: code, message }, { status, headers: noStoreHeaders({ "Content-Type": "application/json; charset=utf-8" }) });
}
function privateResponse(result: Response): Response {
  return new Response(result.body, { status: result.status, statusText: result.statusText, headers: noStoreHeaders(result.headers) });
}

function userMessage(code: string): string {
  if (code === "IMAGE_BACKGROUND_UNSUPPORTED") return "The portrait model rejected transparent backgrounds. Portrait generation needs a service update; changing your photo will not fix this.";
  if (code === "IMAGE_AUTH_FAILED" || code === "IMAGE_ACCESS_DENIED" || code === "IMAGE_REQUEST_REJECTED") return "The portrait service could not accept this request. Please try again after the service is updated.";
  if (code === "IMAGE_CONTENT_REJECTED") return "The image service could not process this photo. Try a different clear photo of yourself.";
  if (code === "IMAGE_RATE_LIMITED") return "The portrait service is busy. Wait a minute before starting a new request.";
  if (code === "IMAGE_TIMEOUT") return "The portrait service took too long to respond. You can start a new request.";
  if (code === "OPENAI_IMAGE_NOT_CONFIGURED" || code === "OPENAI_IMAGES_DISABLED" || code === "OPENAI_IMAGES_NOT_VERIFIED") return "Cartoon portraits are temporarily unavailable.";
  if (code === "ALLOWANCE_STOP" || code.startsWith("OPENAI_IMAGE_GUARD")) return "Portrait generation is temporarily paused.";
  if (code === "TRANSPARENCY_REQUIRED" || code === "INVALID_IMAGE_OUTPUT" || code === "EMPTY_IMAGE") return "The portrait service could not create a clean transparent avatar. Try another photo.";
  if (code === "GENERATION_INTERRUPTED") return "This portrait request expired. Start a new portrait request to try again.";
  if (code === "PHOTO_TOO_LARGE") return "Choose a PNG photo smaller than 2 MB.";
  if (code === "PNG_REQUIRED" || code === "INVALID_PNG" || code === "UNSUPPORTED_PNG" || code.startsWith("INVALID_PNG_")) return "Choose a valid PNG photo and try again.";
  if (code === "PHOTO_TOO_SMALL") return "Choose a larger photo with a clearly visible face.";
  return "The portrait could not be created. Start a new portrait request to try again.";
}
async function readBoundedPng(request: Request): Promise<Uint8Array> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "image/png") throw new ProfileFaceError("PNG_REQUIRED", 415);
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/u.test(length) || Number(length) > PROFILE_FACE_MAX_UPLOAD_BYTES)) throw new ProfileFaceError("PHOTO_TOO_LARGE", 413);
  if (!request.body) throw new ProfileFaceError("EMPTY_PHOTO", 422);
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let total = 0, timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new ProfileFaceError("PHOTO_UPLOAD_TIMEOUT", 408)); }, 12_000); });
  try {
    await Promise.race([(async () => {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        total += value.byteLength;
        if (total > PROFILE_FACE_MAX_UPLOAD_BYTES) { void reader.cancel().catch(() => {}); throw new ProfileFaceError("PHOTO_TOO_LARGE", 413); }
        chunks.push(value);
      }
    })(), timeout]);
  } finally { if (timer) clearTimeout(timer); reader.releaseLock(); }
  if (!total) throw new ProfileFaceError("EMPTY_PHOTO", 422);
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function POST(request: Request): Promise<Response> {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return privateError("CROSS_ORIGIN_BLOCKED", "This request must come from the game site.", 403);
  const token = getCookie(request, COOKIE);
  if (!token || token.length < 40 || token.length > 64) return privateError("PROFILE_COOKIE_REQUIRED", "Reload the page to create your private character profile.", 401);
  const idempotencyKey = request.headers.get("idempotency-key") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(idempotencyKey)) return privateError("INVALID_IDEMPOTENCY_KEY", "Start this portrait request again.", 400);
  try {
    const bytes = await readBoundedPng(request);
    const byIp = await enforceRateLimit(request, "profile-face-ip", 8); if (byIp) return privateResponse(byIp);
    const profileHash = await sha256Hex(token);
    const byProfile = await enforceIdentityRateLimit(request, "profile-face-profile", profileHash, 5); if (byProfile) return privateResponse(byProfile);
    const result = await (await profileFaceService()).generate(token, idempotencyKey, bytes);
    if (result.status === "ready") return Response.json({ faceId: result.faceId }, { headers: noStoreHeaders() });
    if (result.status === "processing") return Response.json({ status: "processing", message: "Portrait generation is still processing." }, { status: 202, headers: noStoreHeaders({ "Retry-After": "2" }) });
    if (result.status === "conflict") return privateError("IDEMPOTENCY_CONFLICT", "This request key was already used with a different photo.", 409);
    return Response.json({ error: result.code, message: userMessage(result.code), terminal: true }, { status: 503, headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof ProfileFaceError) return Response.json({ error: error.code, message: userMessage(error.code), terminal: true }, { status: error.status, headers: noStoreHeaders() });
    return privateError("PROFILE_FACE_UNAVAILABLE", "The portrait service is temporarily unavailable.", 503);
  }
}
