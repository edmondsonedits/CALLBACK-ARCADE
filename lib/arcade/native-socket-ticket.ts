import { z } from "zod";
import { ArcadeGameIdSchema, type ArcadeGameId } from "./contracts";

export const NATIVE_ARCADE_SOCKET_GAMES = ["arena-survivor", "buzzwort", "chaos-kommando", "drift-racer", "flatterfluff", "kartentisch", "magic-arena", "magic-duell", "minions-td", "schaetzorama", "word-tiles", "zeichnen-und-erraten", "imposter", "pantomime", "schattenjagd", "dungeon-party"] as const satisfies readonly ArcadeGameId[];
export type NativeArcadeGameId = (typeof NATIVE_ARCADE_SOCKET_GAMES)[number] | "sketch-relay";
const NativeGameSchema = z.enum([...NATIVE_ARCADE_SOCKET_GAMES, "sketch-relay"]);
const PartyGameSchema = z.enum(["party:standard", "party:pictures", "party:comic", "party:king-mystery", "party:royal-rumours", "party:bowl-of-fools"]);
const RoomGameSchema = z.union([NativeGameSchema, PartyGameSchema]);
export function roomSocketGameId(gameLength: unknown, arcadeGameId?: unknown): z.infer<typeof RoomGameSchema> | null {
  const result = RoomGameSchema.safeParse(gameLength === "arcade" ? arcadeGameId : `party:${String(gameLength)}`);
  return result.success ? result.data : null;
}
const TicketSchema = z.object({
  v: z.literal(1), roomId: z.string().min(1).max(120), roomCode: z.string().regex(/^[A-Z0-9]{4,8}$/u), gameId: RoomGameSchema,
  matchId: z.string().min(1).max(120), generationId: z.string().min(1).max(120), partyKey: z.string().min(1).max(120), actorId: z.string().min(1).max(120),
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/u), role: z.enum(["host", "player", "audience", "display"]), exp: z.number().int().positive(), nonce: z.string().regex(/^[A-Za-z0-9_-]{16,80}$/u),
}).strict();
export type NativeArcadeSocketClaims = z.infer<typeof TicketSchema>;
export type NativeArcadeSocketIdentity = Omit<NativeArcadeSocketClaims, "v" | "exp" | "nonce">;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const ticketTtlMs = 30_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("NATIVE_ARCADE_TICKET_MALFORMED");
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function signature(secret: string, value: string): Promise<Uint8Array> {
  if (!secret) throw new Error("NATIVE_ARCADE_TICKET_SECRET_MISSING");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}
function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index]! ^ right[index]!;
  return mismatch === 0;
}

export async function issueNativeArcadeSocketTicket(identity: NativeArcadeSocketIdentity, secret: string, now = Date.now()): Promise<{ ticket: string; claims: NativeArcadeSocketClaims }> {
  const claims = TicketSchema.parse({ ...identity, v: 1, exp: now + ticketTtlMs, nonce: toBase64Url(crypto.getRandomValues(new Uint8Array(18))) });
  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)));
  return { ticket: `${payload}.${toBase64Url(await signature(secret, payload))}`, claims };
}

export async function verifyNativeArcadeSocketTicket(ticket: string, secret: string, binding: Partial<NativeArcadeSocketIdentity> & { now?: number } = {}): Promise<NativeArcadeSocketClaims> {
  if (typeof ticket !== "string" || ticket.length > 2048) throw new Error("NATIVE_ARCADE_TICKET_MALFORMED");
  const parts = ticket.split(".");
  if (parts.length !== 2) throw new Error("NATIVE_ARCADE_TICKET_MALFORMED");
  let claims: NativeArcadeSocketClaims;
  let received: Uint8Array;
  try {
    claims = TicketSchema.parse(JSON.parse(decoder.decode(fromBase64Url(parts[0]!))));
    received = fromBase64Url(parts[1]!);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NATIVE_ARCADE_TICKET_")) throw error;
    throw new Error("NATIVE_ARCADE_TICKET_MALFORMED");
  }
  if (!equalBytes(await signature(secret, parts[0]!), received)) throw new Error("NATIVE_ARCADE_TICKET_SIGNATURE");
  const now = binding.now ?? Date.now();
  if (claims.exp <= now) throw new Error("NATIVE_ARCADE_TICKET_EXPIRED");
  if (claims.exp > now + ticketTtlMs + 5_000) throw new Error("NATIVE_ARCADE_TICKET_MALFORMED");
  for (const key of ["roomId", "roomCode", "gameId", "matchId", "generationId", "partyKey", "actorId", "tokenHash", "role"] as const) {
    if (binding[key] !== undefined && claims[key] !== binding[key]) throw new Error("NATIVE_ARCADE_TICKET_BINDING");
  }
  return claims;
}

export function isNativeArcadeSocketGame(value: unknown): value is NativeArcadeGameId {
  return NativeGameSchema.safeParse(value).success && ArcadeGameIdSchema.safeParse(value).success;
}
