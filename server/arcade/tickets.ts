import type { ArcadeGameId } from "../../lib/arcade/contracts";
import { getArcadeControllerCapacity } from "../../lib/arcade/catalog";

export type ArcadeRole = "host" | "player" | "spectator";
export interface ArcadeTicketClaims { v: 1; roomCode: string; gameId: ArcadeGameId; matchId: string; role: ArcadeRole; playerId: string | null; exp: number; nonce: string }
export interface ArcadeTicketBinding { roomCode?: string; gameId?: ArcadeGameId; matchId?: string; role?: ArcadeRole; playerId?: string | null }
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const ticketTtlMs = 30_000;
const callbackToleranceMs = 30_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("ARCADE_TICKET_MALFORMED");
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}
function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) mismatch |= left[i]! ^ right[i]!;
  return mismatch === 0;
}
function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return toBase64Url(bytes);
}
function validateTicket(value: unknown): ArcadeTicketClaims {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ARCADE_TICKET_MALFORMED");
  const claims = value as Record<string, unknown>;
  if (Object.keys(claims).some((key) => !["v", "roomCode", "gameId", "matchId", "role", "playerId", "exp", "nonce"].includes(key))) throw new Error("ARCADE_TICKET_MALFORMED");
  if (claims.v !== 1 || typeof claims.roomCode !== "string" || !/^[A-Z0-9]{4,8}$/u.test(claims.roomCode) || typeof claims.gameId !== "string" || !/^[a-z-]{2,40}$/u.test(claims.gameId) || typeof claims.matchId !== "string" || claims.matchId.length < 1 || claims.matchId.length > 120 || !["host", "player", "spectator"].includes(String(claims.role)) || (claims.role === "host" ? claims.playerId !== null : typeof claims.playerId !== "string" || claims.playerId.length < 1 || claims.playerId.length > 120) || !Number.isSafeInteger(claims.exp) || typeof claims.nonce !== "string" || !/^[A-Za-z0-9_-]{16,80}$/u.test(claims.nonce)) throw new Error("ARCADE_TICKET_MALFORMED");
  return claims as unknown as ArcadeTicketClaims;
}

export async function createArcadeTicket(input: ArcadeTicketClaims, secret: string): Promise<string> {
  if (!secret) throw new Error("ARCADE_TICKET_SECRET_MISSING");
  const claims = validateTicket(input);
  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)));
  return `${payload}.${toBase64Url(await hmac(secret, payload))}`;
}

export async function issueArcadeTicket(input: Omit<ArcadeTicketClaims, "v" | "exp" | "nonce">, secret: string, now = Date.now()): Promise<{ ticket: string; claims: ArcadeTicketClaims }> {
  const claims = validateTicket({ ...input, v: 1, exp: now + ticketTtlMs, nonce: randomNonce() });
  return { ticket: await createArcadeTicket(claims, secret), claims };
}

export async function verifyArcadeTicket(ticket: string, secret: string, binding: ArcadeTicketBinding = {}, now = Date.now()): Promise<ArcadeTicketClaims> {
  if (!secret) throw new Error("ARCADE_TICKET_SECRET_MISSING");
  if (typeof ticket !== "string" || ticket.length > 2048) throw new Error("ARCADE_TICKET_MALFORMED");
  const parts = ticket.split(".");
  if (parts.length !== 2) throw new Error("ARCADE_TICKET_MALFORMED");
  let expected: Uint8Array; let received: Uint8Array; let claims: ArcadeTicketClaims;
  try { expected = await hmac(secret, parts[0]!); received = fromBase64Url(parts[1]!); claims = validateTicket(JSON.parse(decoder.decode(fromBase64Url(parts[0]!)))); }
  catch (error) { if (error instanceof Error && error.message.startsWith("ARCADE_TICKET_")) throw error; throw new Error("ARCADE_TICKET_MALFORMED"); }
  if (!equalBytes(expected, received)) throw new Error("ARCADE_TICKET_SIGNATURE");
  if (claims.exp <= now) throw new Error("ARCADE_TICKET_EXPIRED");
  if (claims.exp > now + ticketTtlMs + 5_000) throw new Error("ARCADE_TICKET_MALFORMED");
  for (const key of ["roomCode", "gameId", "matchId", "role", "playerId"] as const) if (binding[key] !== undefined && binding[key] !== claims[key]) throw new Error("ARCADE_TICKET_BINDING");
  return claims;
}

export interface ArcadeSeatCandidate { id: string; role: string; seat: number; active: boolean; removedAt?: number | null; bot?: boolean }
export function selectArcadeControllerIds(gameId: ArcadeGameId, participants: readonly ArcadeSeatCandidate[], matchNumber = 1): string[] {
  const eligible = participants.filter((participant) => participant.role === "player" && participant.active && participant.removedAt == null).toSorted((left, right) => left.seat - right.seat || left.id.localeCompare(right.id));
  const capacity = getArcadeControllerCapacity(gameId);
  if (eligible.length <= capacity) return eligible.map((participant) => participant.id);
  const normalizedMatchNumber = Number.isFinite(matchNumber) ? Math.max(1, Math.trunc(matchNumber)) : 1;
  const offset = (normalizedMatchNumber - 1) % eligible.length;
  return Array.from({ length: capacity }, (_, index) => eligible[(offset + index) % eligible.length]!.id);
}

export function resolveArcadeTicketRole(authRole: "host" | "player", authenticatedId: string, controllerIds: readonly string[]): ArcadeRole {
  return authRole === "host" ? "host" : controllerIds.includes(authenticatedId) ? "player" : "spectator";
}

export interface ArcadeCallbackAuth { timestamp: number; nonce: string }
export async function signArcadeCallback(rawBody: string, secret: string, timestamp = Date.now(), nonce = randomNonce()): Promise<{ timestamp: string; nonce: string; signature: string }> {
  const timestampText = String(timestamp);
  return { timestamp: timestampText, nonce, signature: toBase64Url(await hmac(secret, `${timestampText}.${nonce}.${rawBody}`)) };
}
export async function verifyArcadeCallback(rawBody: string, headers: { timestamp?: string; nonce?: string; signature?: string }, secret: string, now = Date.now()): Promise<ArcadeCallbackAuth> {
  const { timestamp, nonce, signature } = headers;
  if (!secret) throw new Error("ARCADE_CALLBACK_SECRET_MISSING");
  if (!timestamp || !/^\d{13}$/u.test(timestamp) || !nonce || !/^[A-Za-z0-9_-]{16,80}$/u.test(nonce) || !signature) throw new Error("ARCADE_CALLBACK_MALFORMED");
  const time = Number(timestamp);
  if (!Number.isSafeInteger(time) || Math.abs(now - time) > callbackToleranceMs) throw new Error("ARCADE_CALLBACK_EXPIRED");
  let supplied: Uint8Array;
  try { supplied = fromBase64Url(signature); } catch { throw new Error("ARCADE_CALLBACK_SIGNATURE"); }
  if (!equalBytes(await hmac(secret, `${timestamp}.${nonce}.${rawBody}`), supplied)) throw new Error("ARCADE_CALLBACK_SIGNATURE");
  return { timestamp: time, nonce };
}

export async function processArcadeCallback<T>(rawBody: string, headers: { timestamp?: string; nonce?: string; signature?: string }, secret: string, now: number, persist: (roomCode: string, events: unknown) => Promise<T>): Promise<T> {
  await verifyArcadeCallback(rawBody, headers, secret, now);
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch { throw new Error("ARCADE_CALLBACK_MALFORMED"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || typeof (parsed as Record<string, unknown>).roomCode !== "string" || !Array.isArray((parsed as Record<string, unknown>).events)) throw new Error("ARCADE_CALLBACK_MALFORMED");
  const body = parsed as { roomCode: string; events: unknown[] };
  if (!/^[A-Z0-9]{4,8}$/u.test(body.roomCode) || body.events.length > 200) throw new Error("ARCADE_CALLBACK_MALFORMED");
  return persist(body.roomCode, body.events);
}
