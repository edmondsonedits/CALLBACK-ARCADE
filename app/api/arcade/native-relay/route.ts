import { apiError, HostActionSchema, PlayerActionSchema } from "../../../../lib/contracts";
import { authenticateNativeArcadeTicket, loadNativeAuthContext } from "../../../../server/arcade-native/auth";
import { projectNativeBatch } from "../../../../server/arcade-native/projection-batch";
import { executeHostRoomAction, executePlayerRoomAction } from "../../../../server/room-actions";
import { runtimeEnv } from "../../../../server/database";
import { noStoreHeaders } from "../../../../server/http";
import { verifyNativeArcadeSocketTicket } from "../../../../lib/arcade/native-socket-ticket";
import { timingSafeStringEqual } from "../../../../server/crypto";
import { syncAuthenticatedRoom } from "../../../../server/room-sync";

interface NativeRelayEnv { PARTY_SECRET?: string }
const MAX_BODY_BYTES = 48_000;
type SyncEntry = { ticket: string; nonce: string; version: number };

function error(code: string, status = 401) { return Response.json({ error: { code, message: "Native Arcade connection is no longer valid." } }, { status, headers: noStoreHeaders() }); }
function unauthorized(request: Request, secret?: string) { return !secret || !timingSafeStringEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`); }

async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return error("BODY_TOO_LARGE", 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return error("BODY_TOO_LARGE", 413);
  try { const parsed: unknown = JSON.parse(raw); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return error("INVALID_REQUEST", 400); return parsed as Record<string, unknown>; }
  catch { return error("INVALID_REQUEST", 400); }
}

export async function POST(request: Request) {
  const secret = (runtimeEnv() as NativeRelayEnv).PARTY_SECRET;
  if (unauthorized(request, secret)) return error("UNAUTHORIZED", 401);
  const input = await readBody(request); if (input instanceof Response) return input;
  if (input.operation === "sync" && Object.keys(input).every((key) => ["operation", "entries"].includes(key)) && Array.isArray(input.entries) && input.entries.length <= 14) {
    const entries: SyncEntry[] = [];
    for (const item of input.entries) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return error("INVALID_REQUEST", 400);
      const entry = item as Record<string, unknown>;
      if (Object.keys(entry).some((key) => !["ticket", "nonce", "version"].includes(key)) || typeof entry.ticket !== "string" || entry.ticket.length > 2048 || typeof entry.nonce !== "string" || entry.nonce.length > 80 || !Number.isSafeInteger(entry.version) || Number(entry.version) < 0) return error("INVALID_REQUEST", 400);
      entries.push({ ticket: entry.ticket, nonce: entry.nonce, version: Number(entry.version) });
    }
    try {
      const now = Date.now();
      const verified = await Promise.all(entries.map(async entry => {
        try { const claims = await verifyNativeArcadeSocketTicket(entry.ticket, secret!, { now }); return claims.nonce === entry.nonce ? { entry, claims } : null; }
        catch { return null; }
      }));
      const valid = verified.filter(value => value !== null);
      const revoked = entries.filter((_, index) => verified[index] === null).map(entry => ({ nonce: entry.nonce, snapshot: null, version: 0, revoked: true }));
      const projections = await projectNativeBatch(valid.map(value => value.entry), {
        load: async () => {
          return loadNativeAuthContext(valid[0]!.claims.roomCode);
        },
        authenticate: async (entry, context) => {
          const claims = await verifyNativeArcadeSocketTicket(entry.ticket, secret!, { now });
          if (claims.nonce !== entry.nonce) throw new Error("NATIVE_ARCADE_NONCE_MISMATCH");
          const auth = await authenticateNativeArcadeTicket(entry.ticket, secret!, now, context);
          return { auth, claims };
        },
        advance: async (context, actor) => {
          const result = await syncAuthenticatedRoom(actor.auth, { skipPresence: true }, now);
          return { ...context, loaded: { ...context.loaded, state: result.auth.state } };
        },
        project: async (entry, context, actor) => {
          const state = context.loaded.state;
          const auth = { ...actor.auth, state, participant: actor.auth.participant ? state.participants.find(p => p.id === actor.auth.id && !p.removedAt) ?? null : null };
          const result = await syncAuthenticatedRoom(auth, { skipAdvance: true, displayTokenHash: actor.claims.role === "display" ? actor.claims.tokenHash : undefined }, now);
          return { nonce: entry.nonce, snapshot: result.version === entry.version ? null : result.snapshot, version: result.version };
        },
      });
      return Response.json({ projections: [...projections, ...revoked] }, { headers: noStoreHeaders() });
    } catch { return error("REALTIME_SYNC_RETRY", 503); }
  }
  if (input.operation === "action" && Object.keys(input).every((key) => ["operation", "ticket", "action"].includes(key)) && typeof input.ticket === "string" && input.ticket.length <= 2048) {
    try {
      const claims = await verifyNativeArcadeSocketTicket(input.ticket, secret!);
      if (claims.role === "host") {
        const parsed = HostActionSchema.safeParse(input.action); if (!parsed.success) return error("INVALID_ACTION", 422);
        // Older clients can still end a game over the socket. Never ask that
        // coordinator to drain the action that is waiting for this response.
        return executeHostRoomAction(() => authenticateNativeArcadeTicket(input.ticket as string, secret!), parsed.data, { retireAfterEnd: false });
      }
      if (claims.role === "player" || claims.role === "audience") {
        const parsed = PlayerActionSchema.safeParse(input.action); if (!parsed.success) return error("INVALID_ACTION", 422);
        return executePlayerRoomAction(() => authenticateNativeArcadeTicket(input.ticket as string, secret!), parsed.data);
      }
      return error("ROLE_FORBIDDEN", 403);
    } catch { return error("NATIVE_ARCADE_REVOKED", 401); }
  }
  return apiError("INVALID_REQUEST", "The native Arcade relay request is invalid.", 400);
}
