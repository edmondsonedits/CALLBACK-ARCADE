import { apiError } from "../../../../../../lib/contracts";
import { getD1, runtimeEnv } from "../../../../../../server/database";

export async function GET(_request: Request, context: { params: Promise<{ matchId: string; assetId: string }> }) {
  const { matchId, assetId } = await context.params;
  if (!/^[a-z0-9_-]{1,180}$/iu.test(matchId) || !/^[a-z0-9_-]{1,100}$/iu.test(assetId)) return apiError("INVALID_HISTORY_MEDIA", "That archived image is invalid.", 400);
  const row = await getD1().prepare("SELECT object_key, content_type FROM history_media WHERE match_id = ? AND asset_id = ?").bind(matchId, assetId).first<{ object_key: string; content_type: string }>();
  if (!row) return apiError("HISTORY_MEDIA_NOT_FOUND", "That archived image is unavailable.", 404);
  const object = await runtimeEnv().MEDIA?.get(row.object_key);
  if (!object) return apiError("HISTORY_MEDIA_NOT_FOUND", "That archived image is unavailable.", 404);
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("Content-Type", row.content_type || headers.get("Content-Type") || "image/webp"); headers.set("Cache-Control", "public, max-age=86400, immutable"); headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
}
