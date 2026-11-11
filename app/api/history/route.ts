import { noStoreHeaders } from "../../../server/http";
import { listHistoryMatches } from "../../../server/history";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const matches = await listHistoryMatches({ mode: url.searchParams.get("mode") ?? undefined, query: url.searchParams.get("q")?.trim() || undefined, limit: 30 });
  return Response.json({ matches }, { headers: noStoreHeaders() });
}
