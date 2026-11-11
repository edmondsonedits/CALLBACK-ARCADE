import { getCookie, noStoreHeaders, requireSameOrigin } from "../../../../../server/http";
import { sha256Hex } from "../../../../../server/crypto";
import { enforceRateLimit } from "../../../../../server/security";
import { playerCreationService } from "../../../../../server/player-creations/runtime";
import { PlayerCreationError } from "../../../../../server/player-creations/service";

const COOKIE = "callback_profile";
const MAX_COMMIT_BODY = 11_300_000;
function response(body: unknown, status = 200): Response { return Response.json(body, { status, headers: noStoreHeaders({ "Content-Type": "application/json; charset=utf-8" }) }); }
function fromError(error: unknown): Response { return error instanceof PlayerCreationError ? response({ error: error.code }, error.status) : response({ error: "PLAYER_CREATION_UNAVAILABLE" }, 503); }
async function readJson(request: Request): Promise<unknown | Response> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return response({ error: "CONTENT_TYPE_REQUIRED" }, 415);
  const declared = Number(request.headers.get("content-length") ?? 0); if (declared > MAX_COMMIT_BODY) return response({ error: "BODY_TOO_LARGE" }, 413);
  if (!request.body) return response({ error: "INVALID_JSON" }, 400);
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_COMMIT_BODY) { await reader.cancel(); return response({ error: "BODY_TOO_LARGE" }, 413); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return response({ error: "INVALID_JSON" }, 400); }
}
function mutationError(request: Request): Response | null {
  const failure = requireSameOrigin(request); if (failure) return new Response(failure.body, { status: failure.status, headers: noStoreHeaders(failure.headers) });
  const origin = request.headers.get("origin"); return origin && origin === new URL(request.url).origin ? null : response({ error: "CROSS_ORIGIN_BLOCKED" }, 403);
}
async function ownerHash(request: Request): Promise<string | null> {
  const token = getCookie(request, COOKIE); if (!token || !/^[A-Za-z0-9_-]{40,64}$/u.test(token)) return null;
  const hash = await sha256Hex(token), service = await playerCreationService(); return await service.assertProfile(hash) ? hash : null;
}
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context): Promise<Response> {
  const failure = mutationError(request); if (failure) return failure;
  const limited = await enforceRateLimit(request, "profile-creations-commit", 20); if (limited) return new Response(limited.body, { status: limited.status, headers: noStoreHeaders(limited.headers) });
  const hash = await ownerHash(request); if (!hash) return response({ error: "PROFILE_COOKIE_REQUIRED" }, 401);
  const body = await readJson(request); if (body instanceof Response) return body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return response({ error: "INVALID_CREATION" }, 422);
  const input = body as Record<string, unknown>;
  try {
    const result = await (await playerCreationService()).commit(hash, (await context.params).id, { expectedRevision: input.expectedRevision, idempotencyKey: input.idempotencyKey, rasterBase64: input.rasterBase64, source: input.source, placement: input.placement });
    if (!result.record) return response({ error: "REVISION_CONFLICT" }, 409);
    return response({ creation: result.record, replayed: result.replayed });
  } catch (error) { return fromError(error); }
}

export async function DELETE(request: Request, context: Context): Promise<Response> {
  const failure = mutationError(request); if (failure) return failure;
  const limited = await enforceRateLimit(request, "profile-creations-delete", 20); if (limited) return new Response(limited.body, { status: limited.status, headers: noStoreHeaders(limited.headers) });
  const hash = await ownerHash(request); if (!hash) return response({ error: "PROFILE_COOKIE_REQUIRED" }, 401);
  const body = await readJson(request); if (body instanceof Response) return body;
  const revision = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).expectedRevision : undefined;
  try {
    const deleted = await (await playerCreationService()).delete(hash, (await context.params).id, revision);
    return deleted ? response({ deleted: true }) : response({ error: "REVISION_CONFLICT" }, 409);
  } catch (error) { return fromError(error); }
}
