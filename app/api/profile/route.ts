import { CharacterProfileSchema } from "../../../lib/character-profile";
import { apiError } from "../../../lib/contracts";
import { profileService } from "../../../server/profiles/runtime";
import { getCookie, noStoreHeaders, requireSameOrigin, sessionCookie } from "../../../server/http";
import {enforceRateLimit} from '../../../server/security';

const COOKIE = "callback_profile";
const MAX_PROFILE_BODY = 250_000;
function response(body: unknown, status = 200, cookie?: string): Response {
  const headers = noStoreHeaders({ "Content-Type": "application/json; charset=utf-8" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return Response.json(body, { status, headers });
}
function privateError(result: Response): Response {
  return new Response(result.body, { status: result.status, statusText: result.statusText, headers: noStoreHeaders(result.headers) });
}
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
async function readProfileJson(request: Request): Promise<unknown | Response> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (contentType !== "application/json") return privateError(apiError("CONTENT_TYPE_REQUIRED", "Use application/json.", 415));
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_PROFILE_BODY) return privateError(apiError("BODY_TOO_LARGE", "Character history is too large.", 413));
  if (!request.body) return privateError(apiError("INVALID_JSON", "The request body is not valid JSON.", 400));
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PROFILE_BODY) { await reader.cancel(); return privateError(apiError("BODY_TOO_LARGE", "Character history is too large.", 413)); }
      chunks.push(value);
    }
    const body = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(body));
  } catch { return privateError(apiError("INVALID_JSON", "The request body is not valid JSON.", 400)); }
}

export async function GET(request: Request): Promise<Response> {
  const originError = requireSameOrigin(request); if (originError) return privateError(originError);
  let token = getCookie(request, COOKIE), cookie: string | undefined;
  if (!token || token.length < 40 || token.length > 64) { const limited=await enforceRateLimit(request,'profile-create',30);if(limited)return privateError(limited);token = newToken(); cookie = sessionCookie(COOKIE, token, 365 * 24 * 60 * 60); }
  try {
    const stored = await profileService().get(token);
    cookie=sessionCookie(COOKIE,token,365*24*60*60);
    return response({ version: stored.version, ...stored.profile, created: stored.created }, 200, cookie);
  } catch { return response({ error: "PROFILE_UNAVAILABLE", message: "Your character profile could not be loaded. Please try again." }, 503, cookie); }
}

export async function PUT(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const originError = requireSameOrigin(request); if (originError) return privateError(originError);
  if (!origin || origin !== new URL(request.url).origin) return privateError(apiError("CROSS_ORIGIN_BLOCKED", "This request must come from the game site.", 403));
  const token = getCookie(request, COOKIE);
  if (!token || token.length < 40 || token.length > 64) return privateError(apiError("PROFILE_COOKIE_REQUIRED", "Reload the page to create your private character profile.", 401));
  const payload = await readProfileJson(request);
  if (payload instanceof Response) return payload;
  if (!payload || typeof payload !== "object") return privateError(apiError("INVALID_PROFILE", "The character profile is invalid.", 422));
  const input = payload as { version?: unknown; profile?: unknown };
  if (!Number.isSafeInteger(input.version) || Number(input.version) < 1) return privateError(apiError("INVALID_VERSION", "Reload this character before saving.", 422));
  const parsed = CharacterProfileSchema.safeParse(input.profile);
  if (!parsed.success) return privateError(apiError("INVALID_PROFILE", "The character or its undo history is invalid.", 422));
  try {
    const version = await profileService().save(token, Number(input.version), parsed.data);
    if (version === null) return response({ error: "PROFILE_CONFLICT", message: "This character changed in another tab. Your draft is still here; reload before saving again." }, 409);
    return response({ version });
  } catch(e) { if(e instanceof Error&&/PROFILE_FACE_NOT_OWNED/.test(e.message))return response({error:"INVALID_PROFILE",message:"This portrait does not belong to this character profile."},422); if(e instanceof Error&&/IMMUTABLE/.test(e.message))return response({error:'INVALID_PROFILE',message:'The original and default characters must remain unchanged. Reload the saved profile.'},422);return response({ error: "PROFILE_SAVE_FAILED", message: "Your draft is still here, but the character could not be saved." }, 503); }
}
