import { apiError } from "../../../../../lib/contracts";
import { loadRoom, registerDisplaySession } from "../../../../../server/database";
import { randomToken } from "../../../../../lib/game/random";
import { sha256Hex } from "../../../../../server/crypto";
import { displayCookieName, noStoreHeaders, requireSameOrigin, sessionCookie } from "../../../../../server/http";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const { code: rawCode } = await context.params; const code = rawCode.toUpperCase();
  const loaded = await loadRoom(code);
  if (!loaded) return apiError("ROOM_NOT_FOUND", "That room could not be found.", 404);
  const token = randomToken();
  await registerDisplaySession(loaded.state.id, await sha256Hex(token));
  return new Response(JSON.stringify({ code, role: "display", version: loaded.state.version }), { status: 201, headers: noStoreHeaders({ "Content-Type": "application/json", "Set-Cookie": sessionCookie(displayCookieName(code), token, 6 * 60 * 60) }) });
}
