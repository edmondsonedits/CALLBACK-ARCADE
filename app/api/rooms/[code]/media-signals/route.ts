import { z } from "zod";
import { apiError } from "../../../../../lib/contracts";
import { authenticateRoom } from "../../../../../server/auth";
import { readMediaSignals, sendMediaSignal } from "../../../../../server/database";
import { noStoreHeaders, readJson, requireSameOrigin } from "../../../../../server/http";
import { enforceRateLimit } from "../../../../../server/security";

const FoolSignalSchema = z.object({
  targetId: z.string().min(1).max(100),
  kind: z.enum(["OFFER", "ANSWER", "ICE", "HANGUP"]),
  payload: z.unknown(),
}).strict();
const ClassicBowlSignalSchema = z.object({
  recipientId: z.string().min(1).max(100),
  kind: z.enum(["offer", "answer", "ice"]),
  payload: z.unknown(),
}).strict();

function remoteLiveEnabled(state: Awaited<ReturnType<typeof authenticateRoom>> extends Response ? never : { gameLength: string; bowl: { environment: string } | null; foolPlayMode: string }): boolean {
  return (state.gameLength === "bowl" && state.bowl?.environment === "remote_live") || (state.gameLength === "bowl-of-fools" && state.foolPlayMode === "REMOTE_LIVE");
}

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await context.params; const code = rawCode.toUpperCase();
  const auth = await authenticateRoom(request, code, ["player"]); if (auth instanceof Response) return auth;
  if (!remoteLiveEnabled(auth.state)) return apiError("MEDIA_UNAVAILABLE", "Remote Live is not enabled for this room.", 409);
  const after = Math.max(0, Number(new URL(request.url).searchParams.get("after") ?? 0) || 0);
  const signals = await readMediaSignals(auth.state.id, auth.id, after);
  const legacyBowl = auth.state.gameLength === "bowl";
  const peers = auth.state.participants.filter((participant) => participant.role === "player" && participant.active && !participant.removedAt).map((participant) => ({ id: participant.id }));
  return Response.json({ signals: signals.map((signal) => ({ ...signal, kind: legacyBowl ? signal.kind.toLowerCase() : signal.kind })), selfId: auth.id, peers, serverTime: Date.now() }, { headers: noStoreHeaders() });
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const { code: rawCode } = await context.params; const code = rawCode.toUpperCase();
  const auth = await authenticateRoom(request, code, ["player"]); if (auth instanceof Response) return auth;
  const limited = await enforceRateLimit(request, `media-signal:${code}:${auth.id}`, 180); if (limited) return limited;
  if (!remoteLiveEnabled(auth.state)) return apiError("MEDIA_UNAVAILABLE", "Remote Live is not enabled for this room.", 409);
  const payload = await readJson(request); if (payload instanceof Response) return payload;
  const parsed = (auth.state.gameLength === "bowl" ? ClassicBowlSignalSchema : FoolSignalSchema).safeParse(payload);
  if (!parsed.success) return apiError("INVALID_SIGNAL", "That call signal is not valid.", 422);
  const targetId = "recipientId" in parsed.data ? parsed.data.recipientId : parsed.data.targetId;
  const target = auth.state.participants.find((participant) => participant.id === targetId && participant.role === "player" && participant.active && !participant.removedAt);
  if (!target || target.id === auth.id) return apiError("INVALID_MEDIA_TARGET", "That player is not available for this call.", 422);
  if (JSON.stringify(parsed.data.payload).length > 10_000) return apiError("SIGNAL_TOO_LARGE", "That call signal is too large.", 413);
  await sendMediaSignal(auth.state.id, auth.id, target.id, parsed.data.kind, parsed.data.payload);
  return Response.json({ ok: true }, { status: auth.state.gameLength === "bowl" ? 201 : 200, headers: noStoreHeaders() });
}
