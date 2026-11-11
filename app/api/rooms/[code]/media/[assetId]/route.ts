import { canViewFishAsset, requireFishMatch } from "../../../../../../server/fish-service";
import { apiError, roomMediaViewerRoles } from "../../../../../../lib/contracts";
import { authenticateRoom } from "../../../../../../server/auth";
import { getD1, runtimeEnv } from "../../../../../../server/database";
import { canViewSketchRelayAsset } from "../../../../../../server/arcade/sketch_relay";

export async function GET(request: Request, context: { params: Promise<{ code: string; assetId: string }> }) {
  const { code: rawCode, assetId } = await context.params; const code = rawCode.toUpperCase();
  const auth = await authenticateRoom(request, code, roomMediaViewerRoles); if (auth instanceof Response) return auth;
  // A solo fish-test controller has both host and player cookies. Resolve its
  // seat only for that frozen test match, keeping ordinary host media access
  // independent from any accompanying seat cookie.
  let fishViewerId = auth.role === "player" ? auth.id : undefined;
  if (auth.role === "host" && auth.state.soloMode && auth.state.sketchRelay?.fishTest) {
    const testMatch = requireFishMatch(auth.state);
    const seatAuth = await authenticateRoom(request, code, ["player"]);
    if (!(seatAuth instanceof Response) && seatAuth.state.id === auth.state.id && seatAuth.state.sketchRelay?.fishTest && seatAuth.state.sketchRelay.matchId === testMatch.matchId && seatAuth.participant?.active && !seatAuth.participant.pendingActivation && !seatAuth.participant.bot && testMatch.players.includes(seatAuth.id)) fishViewerId = seatAuth.id;
  }
  const job = await getD1().prepare("SELECT object_key, content_type, kind FROM jobs WHERE id = ? AND room_id = ? AND status = 'READY'").bind(assetId, auth.state.id).first<{ object_key: string; content_type: string; kind: string }>();
  if (!job) return apiError("ASSET_NOT_FOUND", "That room asset is unavailable.", 404);
  if (["SKETCH_UPLOAD", "SKETCH_TRANSFORM"].includes(job.kind) && !canViewSketchRelayAsset(auth.state, auth.role === "player" ? auth.id : null, assetId)) return apiError("ASSET_NOT_FOUND", "That room asset is unavailable.", 404);
  if (job.kind === "FISH_UPLOAD" && !canViewFishAsset(auth.state, fishViewerId, assetId, auth.role === "host" || auth.role === "display")) return apiError("ASSET_NOT_FOUND", "That room asset is unavailable.", 404);
  const object = await runtimeEnv().MEDIA?.get(job.object_key); if (!object) return apiError("ASSET_NOT_FOUND", "That room asset is unavailable.", 404);
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("Content-Type", job.content_type || headers.get("Content-Type") || "image/webp"); headers.set("Cache-Control", ["SKETCH_UPLOAD", "SKETCH_TRANSFORM", "FISH_UPLOAD"].includes(job.kind) ? "no-store, private" : "private, max-age=300"); headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
}
