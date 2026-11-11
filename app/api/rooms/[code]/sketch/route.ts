import { apiError } from "../../../../../lib/contracts";
import { SketchRelayBoundSchema, SketchRelayLegSchema, type SketchRelayUploadReceipt } from "../../../../../lib/arcade/sketch-relay";
import { authenticateRoom } from "../../../../../server/auth";
import { sha256Hex } from "../../../../../server/crypto";
import { getD1, loadRoom, persistMutation, runtimeEnv } from "../../../../../server/database";
import { noStoreHeaders, requireSameOrigin } from "../../../../../server/http";
import { enforceRateLimit } from "../../../../../server/security";
import { readSketchPng, sketchBytesHash, SketchUploadError } from "../../../../../server/sketch-images";
import { applySketchRelayUpload, validateSketchRelayUpload } from "../../../../../server/arcade/sketch_relay";

interface SourceRow { prompt_json: string }
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const { code: rawCode } = await context.params; const code = rawCode.toUpperCase();
  const auth = await authenticateRoom(request, code, ["player"]); if (auth instanceof Response) return auth;
  if (!auth.participant || auth.participant.bot || !auth.participant.active) return apiError("SKETCH_PLAYER_REQUIRED", "An active player must submit the drawing.", 403);
  const limited = await enforceRateLimit(request, `sketch-upload:${code}:${auth.id}`, 12); if (limited) return limited;
  const bound = SketchRelayBoundSchema.safeParse({ matchId: request.headers.get("X-Sketch-Match"), round: Number(request.headers.get("X-Sketch-Round")), chainId: request.headers.get("X-Sketch-Chain") });
  const leg = SketchRelayLegSchema.safeParse(request.headers.get("X-Sketch-Leg"));
  const actionId = request.headers.get("X-Sketch-Action-Id") ?? "";
  const rawPromptIndex = request.headers.get("X-Sketch-Prompt-Index");
  if (!bound.success || !leg.success || !/^[a-zA-Z0-9_-]{1,100}$/u.test(actionId) || (leg.data === "drawing" ? rawPromptIndex === null || !/^[0-2]$/u.test(rawPromptIndex) : rawPromptIndex !== null)) return apiError("INVALID_SKETCH_UPLOAD", "That drawing submission is not valid.", 422);
  const bounds = { ...bound.data, leg: leg.data, ...(rawPromptIndex === null ? {} : { promptIndex: Number(rawPromptIndex) }) };
  const assetId = `sksrc_${await sha256Hex(`${auth.state.id}:${auth.id}:${actionId}`)}`;
  const sourceRow = () => getD1().prepare("SELECT prompt_json FROM jobs WHERE id = ? AND room_id = ? AND kind = 'SKETCH_UPLOAD' AND status = 'READY'").bind(assetId, auth.state.id).first<SourceRow>();
  try {
    const existing = await sourceRow();
    if (!existing) validateSketchRelayUpload(auth.state, auth.id, bounds, Date.now());
    const { bytes, width, height } = await readSketchPng(request);
    const sha256 = await sketchBytesHash(bytes);
    const duplicate = (row: SourceRow, version: number) => {
      const receipt = JSON.parse(row.prompt_json) as Record<string, unknown>;
      if (receipt.sha256 !== sha256 || receipt.playerId !== auth.id || receipt.actionId !== actionId || receipt.matchId !== bounds.matchId || receipt.round !== bounds.round || receipt.chainId !== bounds.chainId || receipt.leg !== bounds.leg || receipt.promptIndex !== bounds.promptIndex) return apiError("ACTION_ID_REUSED", "That upload ID already belongs to a different drawing.", 409);
      return Response.json({ ok: true, assetId, version, idempotent: true }, { headers: noStoreHeaders({ "X-Callback-Idempotent": "true" }) });
    };
    if (existing) return duplicate(existing, auth.state.version);
    const storage = runtimeEnv().MEDIA;
    if (!storage) return apiError("SKETCH_STORAGE_UNAVAILABLE", "Drawing storage is unavailable. Keep your drawing and retry shortly.", 503);
    // The content digest makes every action/content pair immutable, including competing retries.
    const objectKey = `rooms/${auth.state.id}/${assetId}-${sha256}.png`;
    try {
      await storage.put(objectKey, bytes, { onlyIf: { etagDoesNotMatch: "*" }, httpMetadata: { contentType: "image/png" }, customMetadata: { roomId: auth.state.id, assetId, purpose: "sketch-source" } });
      const stored = await storage.head(objectKey);
      if (!stored || stored.size !== bytes.byteLength) throw new Error("STORAGE_CONFIRMATION_FAILED");
    } catch { throw new SketchUploadError("SKETCH_STORAGE_UNAVAILABLE", 503, "The drawing could not be saved. Keep it and retry shortly."); }
    const receipt: SketchRelayUploadReceipt = { ...bounds, assetId, objectKey, width, height, byteSize: bytes.byteLength, contentType: "image/png" };
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const loaded = await loadRoom(code); if (!loaded || loaded.state.id !== auth.state.id) return apiError("ROOM_NOT_FOUND", "That room has closed.", 404);
      const prior = await sourceRow(); if (prior) return duplicate(prior, loaded.state.version);
      const usedAction = await getD1().prepare("SELECT 1 AS used FROM processed_actions WHERE room_id = ? AND action_id = ?").bind(auth.state.id, actionId).first();
      if (usedAction) return apiError("ACTION_ID_REUSED", "That action ID is already in use.", 409);
      const result = applySketchRelayUpload(loaded.state, auth.id, receipt, Date.now());
      const effects = result.effects.map(effect => effect.type === "sketch_source" ? { ...effect, promptHash: `sketch-upload:${assetId}`, prompt: { ...receipt, playerId: auth.id, actionId, sha256 } } : effect);
      const won = await persistMutation({ base: loaded.state, next: result.next, actionId, actorId: auth.id, actionType: "SKETCH_UPLOAD", effects });
      if (won) return Response.json({ ok: true, assetId, version: result.next.version }, { headers: noStoreHeaders() });
    }
    return apiError("ROOM_CHANGED", "The room changed during upload. Retry the same drawing.", 409);
  } catch (error) {
    if (error instanceof SketchUploadError) return apiError(error.code, error.message, error.status);
    const code = error instanceof Error ? error.message : "SKETCH_UPLOAD_FAILED";
    return apiError("SKETCH_UPLOAD_REJECTED", code.startsWith("SKETCH_") || code === "ROOM_PAUSED" ? code.replaceAll("_", " ").toLowerCase() : "This drawing can no longer be submitted. Refresh the room and retry.", 409);
  }
}
