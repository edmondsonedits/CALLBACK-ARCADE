import { apiError } from "../../../../lib/contracts";
import { getHistoryMatch } from "../../../../server/history";
import { noStoreHeaders } from "../../../../server/http";

export async function GET(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await context.params;
  if (!/^[a-z0-9_-]{1,180}$/iu.test(matchId)) return apiError("INVALID_HISTORY_ID", "That history-book entry is invalid.", 400);
  const match = await getHistoryMatch(matchId);
  if (!match) return apiError("HISTORY_NOT_FOUND", "That match has not been entered in the History Books.", 404);
  return Response.json({ match }, { headers: noStoreHeaders() });
}
