import { apiError } from "../../../../lib/contracts";
import { recordArcadeEvents } from "../../../../server/arcade/room";
import { verifyArcadeCallback } from "../../../../server/arcade/tickets";
import { loadRoom, runtimeEnv } from "../../../../server/database";
import { noStoreHeaders } from "../../../../server/http";

interface ArcadeRuntimeEnv { ARCADE_CALLBACK_SECRET?: string }

export async function POST(request: Request) {
  const secret = (runtimeEnv() as ArcadeRuntimeEnv).ARCADE_CALLBACK_SECRET;
  if (!secret) return apiError("ARCADE_UNAVAILABLE", "Arcade callbacks are not configured.", 503);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 24_000) return apiError("BODY_TOO_LARGE", "The callback is too large.", 413);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 24_000) return apiError("BODY_TOO_LARGE", "The callback is too large.", 413);
  try {
    await verifyArcadeCallback(rawBody, { timestamp: request.headers.get("x-arcade-timestamp") ?? undefined, nonce: request.headers.get("x-arcade-nonce") ?? undefined, signature: request.headers.get("x-arcade-signature") ?? undefined }, secret);
  } catch { return apiError("UNAUTHORIZED", "The Arcade callback is not valid.", 401); }
  let body: unknown;
  try { body = JSON.parse(rawBody) as unknown; } catch { return apiError("INVALID_CALLBACK", "The Arcade callback is not valid.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof (body as Record<string, unknown>).roomCode !== "string" || !Array.isArray((body as Record<string, unknown>).events)) return apiError("INVALID_CALLBACK", "The Arcade callback is not valid.", 400);
  const roomCode = ((body as { roomCode: string }).roomCode).toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/u.test(roomCode)) return apiError("INVALID_CALLBACK", "The Arcade callback is not valid.", 400);
  try {
    const loaded = await loadRoom(roomCode);
    if (!loaded || loaded.state.gameLength !== "arcade") return apiError("ROOM_NOT_FOUND", "The Arcade room could not be found.", 404);
    const result = await recordArcadeEvents(loaded.state.id, (body as { events: unknown[] }).events);
    return Response.json(result, { headers: noStoreHeaders() });
  } catch { return apiError("INVALID_ARCADE_EVENT", "The Arcade event could not be recorded.", 409); }
}
