import { z } from 'zod';

export const PHONE_GAMES = ['royal-sumo', 'royal-ballistix', 'royal-scratch-match', 'royal-roller-ruckus', 'royal-twisted', 'space-bash', 'blind-crown'] as const;
export const MAX_SEATS = 10;
export const ROOM_LIFETIME_MS = 6 * 60 * 60 * 1000;
// Mailbox delivery budget; the TV independently clears held controls 500ms after arrival.
export const INPUT_STALE_MS = 1500;
export const DISCONNECTED_MS = 3000;
export const HOST_TIMEOUT_MS = 8000;
export const MAX_PENDING_INPUTS = 64;
export const createSchema = z.object({ game: z.enum(PHONE_GAMES) }).strict();
export const joinSchema = z.object({ name: z.string().trim().min(1).max(24).refine(value => [...value].every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)) }).strict();
export const emptySchema = z.object({}).strict();
export const inputSchema = z.object({
  seq: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  x: z.number().min(-1).max(1), y: z.number().min(-1).max(1),
  buttons: z.number().int().min(0).max(15),
  plan: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), a: z.number().min(-Math.PI).max(Math.PI), locked: z.boolean() }).strict().optional(),
}).strict();
export const statusSchema = z.object({ phase: z.string().trim().min(1).max(40), paused: z.boolean(), active: z.boolean(), text: z.string().max(160) }).strict();
// States are trusted-host game display data, but still bounded JSON. No scores are written to party tables.
function boundedJson(value: unknown, depth = 0): boolean {
  if (depth > 6) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 128 && value.every(item => boundedJson(item, depth + 1));
  if (typeof value === 'object') return Object.entries(value).length <= 128 && Object.entries(value).every(([key, item]) => !['__proto__', 'constructor', 'prototype'].includes(key) && boundedJson(item, depth + 1));
  return false;
}
const privateStateSchema = z.record(z.string(), z.unknown()).refine(value => boundedJson(value) && new TextEncoder().encode(JSON.stringify(value)).byteLength <= 8192);
const privateStateEnvelopeSchema = z.object({ occupancyId: z.string().regex(/^[a-f0-9]{64}$/), state: privateStateSchema.nullable() }).strict();
// Accept cached v73 raw boards so the host can refresh without breaking the room;
// the service never stores or returns them because they are not occupancy-bound.
const hostPrivateStateSchema = z.union([privateStateEnvelopeSchema, privateStateSchema, z.null()]);
const occupancyAckSchema = z.object({ seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), occupancyId: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
// Numeric acknowledgements remain parseable for cached v73 hosts but are ignored
// by the service because they cannot prove which phone occupancy they belong to.
export const hostSchema = z.object({ status: statusSchema, privateStates: z.record(z.string().regex(/^[0-9]$/), hostPrivateStateSchema).optional(), ack: z.record(z.string().regex(/^[0-9]$/), z.union([occupancyAckSchema, z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)])).optional() }).strict();
export const botSchema = z.object({ seat: z.number().int().min(0).max(MAX_SEATS - 1), enabled: z.boolean(), version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER) }).strict();
export const startSchema = z.object({ version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER) }).strict();
export const lobbySchema = z.object({ version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER) }).strict();
export type PhoneInput = z.infer<typeof inputSchema>;
export type PhoneStatus = z.infer<typeof statusSchema>;
export const phoneHostCookie = (code: string) => `callback_phone_host_${code}`;
export const phoneSeatCookie = (code: string) => `callback_phone_seat_${code}`;
export const phoneCookie = (name: string, token: string, code: string, maxAge = ROOM_LIFETIME_MS / 1000) => `${name}=${encodeURIComponent(token)}; Path=/api/arcade-phone/${code}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
