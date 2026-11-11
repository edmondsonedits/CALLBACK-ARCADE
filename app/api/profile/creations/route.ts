import { getCookie, noStoreHeaders, requireSameOrigin } from "../../../../server/http";
import { sha256Hex } from "../../../../server/crypto";
import { enforceRateLimit } from "../../../../server/security";
import { playerCreationService } from "../../../../server/player-creations/runtime";
import { PlayerCreationError } from "../../../../server/player-creations/service";

const COOKIE = "callback_profile";
const MAX_DRAFT_BODY = 180_000;
function response(body: unknown, status = 200): Response { return Response.json(body, { status, headers: noStoreHeaders({ "Content-Type": "application/json; charset=utf-8" }) }); }
function fromError(error: unknown): Response { return error instanceof PlayerCreationError ? response({ error: error.code }, error.status) : response({ error: "PLAYER_CREATION_UNAVAILABLE" }, 503); }
async function profileHash(request: Request): Promise<string | null> {
  const token = getCookie(request, COOKIE); if (!token || !/^[A-Za-z0-9_-]{40,64}$/u.test(token)) return null;
  const hash = await sha256Hex(token), service = await playerCreationService(); return await service.assertProfile(hash) ? hash : null;
}
async function readJson(request: Request, limit = MAX_DRAFT_BODY): Promise<unknown | Response> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return response({ error: "CONTENT_TYPE_REQUIRED" }, 415);
  const declared = Number(request.headers.get("content-length") ?? 0); if (declared > limit) return response({ error: "BODY_TOO_LARGE" }, 413);
  if (!request.body) return response({ error: "INVALID_JSON" }, 400);
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); return response({ error: "BODY_TOO_LARGE" }, 413); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return response({ error: "INVALID_JSON" }, 400); }
}
function sameOriginMutation(request: Request): Response | null {
  const failure = requireSameOrigin(request); if (failure) return new Response(failure.body, { status: failure.status, headers: noStoreHeaders(failure.headers) });
  const origin = request.headers.get("origin"); return origin && origin === new URL(request.url).origin ? null : response({ error: "CROSS_ORIGIN_BLOCKED" }, 403);
}

export async function GET(request: Request): Promise<Response> {
  const failure = requireSameOrigin(request); if (failure) return new Response(failure.body, { status: failure.status, headers: noStoreHeaders(failure.headers) });
  const limited = await enforceRateLimit(request, "profile-creations-read", 120); if (limited) return new Response(limited.body, { status: limited.status, headers: noStoreHeaders(limited.headers) });
  try { const hash = await profileHash(request); if (!hash) return response({ error: "PROFILE_COOKIE_REQUIRED" }, 401); return response({ creations: await (await playerCreationService()).list(hash) }); }
  catch (error) { return fromError(error); }
}

export async function POST(request: Request): Promise<Response> {
  const failure = sameOriginMutation(request); if (failure) return failure;
  const limited = await enforceRateLimit(request, "profile-creations-write", 40); if (limited) return new Response(limited.body, { status: limited.status, headers: noStoreHeaders(limited.headers) });
  const hash = await profileHash(request); if (!hash) return response({ error: "PROFILE_COOKIE_REQUIRED" }, 401);
  const body = await readJson(request); if (body instanceof Response) return body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return response({ error: "INVALID_CREATION" }, 422);
  const input = body as Record<string, unknown>, service = await playerCreationService();
  try {
    if (typeof input.id === "string") {
      const result = await service.saveDraft(hash, input.id, { expectedRevision: input.expectedRevision, source: input.source, title: input.title, placement: input.placement, shareInRooms: input.shareInRooms });
      return result.record ? response({ creation: result.record }) : response({ error: "REVISION_CONFLICT" }, 409);
    }
    // Fish history is created only from verified game upload receipts. The
    // editable scenery library has its own enforced twenty-creation quota.
    if(input.kind !== "scenery") return response({error:"INVALID_CREATION_KIND"},422);
    const creation = await service.createDraft(hash, { kind: input.kind, title: input.title, source: input.source, placement: input.placement, shareInRooms: input.shareInRooms });
    return response({ creation }, 201);
  } catch (error) { return fromError(error); }
}
