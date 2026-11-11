import { authenticateRoom } from "../../../../../server/auth";
import { countActiveDisplaySessions } from "../../../../../server/database";
import { noStoreHeaders, requireSameOrigin } from "../../../../../server/http";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const { code: rawCode } = await context.params; const code = rawCode.toUpperCase();
  const authenticated = await authenticateRoom(request, code, ["host"]);
  if (authenticated instanceof Response) return authenticated;
  return Response.json({ count: await countActiveDisplaySessions(authenticated.state.id) }, { headers: noStoreHeaders() });
}
