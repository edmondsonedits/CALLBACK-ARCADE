import { sha256Hex } from "../crypto";
import { roomSocketGameId } from "../../lib/arcade/native-socket-ticket";

export interface NativeControlConfig { PARTY_SECRET?: string; PARTY_WORKER_URL?: string }
interface NativeRetireRoomRow { id: string; code: string; state_json: string }
interface NativeRetireChildRow { id: string; session_code: string }

export async function retireNativeArcadeRoomWith(db: D1Database, config: NativeControlConfig, code: string, fetcher: typeof fetch = fetch): Promise<void> {
  const room = await db.prepare("SELECT id, code, state_json FROM rooms WHERE code = ?").bind(code.toUpperCase()).first<NativeRetireRoomRow>();
  if (!room) return;
  let state: { gameLength?: string; arcadeGameId?: string | null };
  try { state = JSON.parse(room.state_json) as typeof state; } catch { throw new Error("NATIVE_ARCADE_ROOM_INVALID"); }
  if (!roomSocketGameId(state.gameLength, state.arcadeGameId)) return;
  // SessionService marks a child inactive before calling its adapter's retire method.
  const child = await db.prepare("SELECT id, session_code FROM callback_session_games WHERE child_kind = 'main' AND child_code = ? ORDER BY created_at DESC, id DESC LIMIT 1").bind(room.code).first<NativeRetireChildRow>();
  const generationId = child?.id ?? room.id;
  const partyKey = child ? "session-" + child.session_code : "native-" + room.id;
  if (!config.PARTY_SECRET || config.PARTY_SECRET.length < 32 || !config.PARTY_WORKER_URL) throw new Error("NATIVE_ARCADE_RETIRE_UNAVAILABLE");
  const base = new URL(config.PARTY_WORKER_URL);
  if (base.username || base.password || base.search || base.hash || base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))) throw new Error("NATIVE_ARCADE_RETIRE_UNAVAILABLE");
  const key = await sha256Hex(room.id + ":" + generationId);
  const response = await fetcher(new URL("/native-arcade/" + key + "/retire", base), {
    method: "POST", headers: { Authorization: "Bearer " + config.PARTY_SECRET, "Content-Type": "application/json" },
    body: JSON.stringify({ operation: "retire", roomId: room.id, generationId, partyKey }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: unknown } | null;
    if (response.status === 404 && body?.error === "NATIVE_ARCADE_NOT_PREPARED") return;
    throw new Error("NATIVE_ARCADE_RETIRE_FAILED");
  }
  if (response.headers.get("x-native-retired-generation") !== generationId) throw new Error("NATIVE_ARCADE_RETIRE_FAILED");
}
