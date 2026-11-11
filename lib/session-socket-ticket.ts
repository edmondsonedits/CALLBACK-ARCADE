import { z } from 'zod';

const claimsSchema = z.object({
  v: z.literal(1), code: z.string().regex(/^[A-HJ-KM-NP-Z2-9]{4}$/),
  generation: z.string().regex(/^[a-f0-9]{64}$/), role: z.enum(['host', 'player', 'mirror']),
  actor: z.string().min(1).max(80), tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.number().int().positive(),
}).strict();
export type SessionSocketClaims = z.infer<typeof claimsSchema>;
const enc = new TextEncoder();
function b64(data: Uint8Array) { let raw = ''; for (const byte of data) raw += String.fromCharCode(byte); return btoa(raw).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, ''); }
function unb64(value: string) { if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw Error('SESSION_TICKET_INVALID'); const base = value.replaceAll('-', '+').replaceAll('_', '/'); return Uint8Array.from(atob(base + '='.repeat((4 - base.length % 4) % 4)), c => c.charCodeAt(0)); }
async function mac(payload: string, secret: string) { const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload))); }
export async function signSessionSocketTicket(value: Omit<SessionSocketClaims, 'v'> | SessionSocketClaims, secret: string, now = Date.now()) {
  const claims = claimsSchema.parse({ ...value, v: 1 });
  if (!secret || claims.expiresAt <= now || claims.expiresAt > now + 30_000) throw Error('SESSION_TICKET_EXPIRY');
  const payload = b64(enc.encode(JSON.stringify(claims)));
  return payload + '.' + b64(await mac(payload, secret));
}
export async function verifySessionSocketTicket(ticket: string, secret: string, now = Date.now()): Promise<SessionSocketClaims> {
  if (!secret || ticket.length > 2048) throw Error('SESSION_TICKET_INVALID');
  const parts = ticket.split('.'); if (parts.length !== 2) throw Error('SESSION_TICKET_INVALID');
  const expected = await mac(parts[0]!, secret), actual = unb64(parts[1]!);
  if (expected.length !== actual.length || expected.some((byte, i) => byte !== actual[i])) throw Error('SESSION_TICKET_INVALID');
  let raw: unknown; try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(unb64(parts[0]!))); } catch { throw Error('SESSION_TICKET_INVALID'); }
  const claims = claimsSchema.parse(raw);
  if (claims.expiresAt <= now || claims.expiresAt > now + 30_000) throw Error('SESSION_TICKET_EXPIRED');
  return claims;
}
