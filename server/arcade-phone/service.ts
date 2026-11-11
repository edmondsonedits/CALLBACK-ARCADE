import { z } from 'zod';
import { apiError } from '../../lib/contracts';
import { randomRoomCode, randomToken } from '../../lib/game/random';
import { sha256Hex, timingSafeStringEqual } from '../crypto';
import { getCookie, noStoreHeaders, readJson, requireSameOrigin } from '../http';
import { createSchema, joinSchema, inputSchema, emptySchema, hostSchema, botSchema, startSchema, lobbySchema, phoneCookie, phoneHostCookie, phoneSeatCookie, HOST_TIMEOUT_MS, DISCONNECTED_MS, INPUT_STALE_MS, MAX_PENDING_INPUTS, ROOM_LIFETIME_MS, MAX_SEATS, type PhoneStatus, type PhoneInput } from './contracts';

interface RoomRow { code: string; game: string; host_token_hash: string; status_json: string; private_states_json: string; bot_enabled_json: string; active_seats_json: string | null; version: number; host_seen_at: number; expires_at: number; closed: number }
interface SeatRow { token_hash: string; seat: number; name: string; last_seq: number; last_seen_at: number; input_at: number }
interface InputRow { seat: number; packet_json: string; received_at: number }
async function phoneOccupancyId(tokenHash: string) { return sha256Hex(`arcade-phone-occupancy-v1:${tokenHash}`); }
// The random host hash is an immutable generation discriminator while a room is live.
// Closed rooms clear it; code reuse creates an independent random hash.
const LIVE_ROOM = 'SELECT 1 FROM arcade_phone_rooms WHERE code = ? AND closed = 0 AND expires_at > ? AND host_token_hash = ?';
const FEATURED_LOBBY_PHASES: Record<string, { ready: string[]; settled: string[] }> = {
  'royal-sumo': { ready: ['menu'], settled: ['matchend'] },
  'royal-twisted': { ready: ['setup'], settled: ['matchover'] },
  'royal-roller-ruckus': { ready: ['setup'], settled: ['finished'] },
  'royal-scratch-match': { ready: ['menu'], settled: ['results'] },
  'blind-crown': { ready: ['lobby'], settled: ['final'] },
};
function json(body: unknown, status = 200, cookie?: string) {
  return Response.json(body, { status, headers: noStoreHeaders(cookie ? { 'Set-Cookie': cookie } : {}) });
}
function error(code: string, message: string, status: number) { const response = apiError(code, message, status); for (const [key, value] of noStoreHeaders()) response.headers.set(key, value); return response; }
// Host snapshots can carry ten 8KiB private boards. Other routes keep the shared12KB limit.
async function readHostJson(request: Request): Promise<unknown | Response> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return error('CONTENT_TYPE_REQUIRED', 'Use application/json.', 415);
  const maxBytes = 96 * 1024;
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) return error('BODY_TOO_LARGE', 'The request body is too large.', 413);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) { await reader.cancel(); return error('BODY_TOO_LARGE', 'The request body is too large.', 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const buffer = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(buffer)); } catch { return error('INVALID_JSON', 'The request body is not valid JSON.', 400); }
}
function cookie(request: Request, name: string) { try { return getCookie(request, name); } catch { return null; } }

export function createPhoneService(db: D1Database, clock: () => number = Date.now, reserveCode?: (code:string)=>Promise<boolean>) {
  const roomFor = (code: string, now: number, expectedHash?: string) => db.prepare('SELECT * FROM arcade_phone_rooms WHERE code = ? AND closed = 0 AND expires_at > ? AND (? IS NULL OR host_token_hash = ?)').bind(code, now, expectedHash ?? null, expectedHash ?? null).first<RoomRow>();
  async function seatFor(request: Request, room: RoomRow, now: number): Promise<SeatRow | null> {
    const token = cookie(request, phoneSeatCookie(room.code));
    if (!token) return null;
    return db.prepare(`SELECT token_hash, seat, name, last_seq, last_seen_at, input_at FROM arcade_phone_seats WHERE room_code = ? AND token_hash = ? AND EXISTS (${LIVE_ROOM})`).bind(room.code, await sha256Hex(token), room.code, now, room.host_token_hash).first<SeatRow>();
  }
  async function payload<T>(request: Request, schema: z.ZodType<T>, hostBody = false): Promise<T | Response> {
    const value = hostBody ? await readHostJson(request) : await readJson(request); if (value instanceof Response) return value;
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : error('INVALID_REQUEST', 'Invalid phone-room request.', 400);
  }
  async function phoneSnapshot(room: RoomRow, seat: SeatRow, now: number) {
    const hostAlive = now - room.host_seen_at <= HOST_TIMEOUT_MS;
    const status: PhoneStatus = JSON.parse(room.status_json);
    const privateStates = JSON.parse(room.private_states_json) as Record<string, { occupancyId?: unknown; state?: unknown }>;
    const entry = privateStates[String(seat.seat)];
    const occupancyId = await phoneOccupancyId(seat.token_hash);
    const privateState = entry?.occupancyId === occupancyId ? entry.state ?? null : null;
    return { code: room.code, game: room.game, seat: seat.seat, name: seat.name, lastSeq: seat.last_seq, status: { ...status, paused: status.paused || !hostAlive }, hostAlive, privateState, serverNow: now, expiresAt: room.expires_at };
  }
  async function handle(request: Request, path: string[]): Promise<Response> {
    if (request.method !== 'POST') { const response = error('METHOD_NOT_ALLOWED', 'Use POST.', 405); response.headers.set('Allow', 'POST'); return response; }
    const originError = requireSameOrigin(request); if (originError) return originError;
    if (request.headers.get('origin') !== new URL(request.url).origin && request.headers.get('sec-fetch-site') !== 'same-origin') return error('CROSS_ORIGIN_BLOCKED', 'Use this game site.', 403);
    const create = path.length === 1 && path[0] === 'create';
    const code = path[0]?.toUpperCase() ?? '';
    const action = path[1];
    if (!create && (path.length !== 2 || !/^[A-HJ-KM-NP-Z2-9]{4}$/.test(code) || !['join', 'input', 'host', 'poll', 'close', 'bot', 'start', 'lobby', 'leave'].includes(action))) return error('NOT_FOUND', 'Unknown phone-room endpoint.', 404);
    const now = clock();
    if (create) {
      const data = await payload(request, createSchema); if (data instanceof Response) return data;
      const token = randomToken(); const hash = await sha256Hex(token);
      // Only the isolated mailbox tables are cleaned up or read by this service.
      await db.batch([
        db.prepare('DELETE FROM arcade_phone_inputs WHERE room_code IN (SELECT code FROM arcade_phone_rooms WHERE expires_at <= ? OR closed = 1)').bind(now),
        db.prepare('DELETE FROM arcade_phone_seats WHERE room_code IN (SELECT code FROM arcade_phone_rooms WHERE expires_at <= ? OR closed = 1)').bind(now),
        db.prepare('DELETE FROM arcade_phone_rooms WHERE expires_at <= ? OR closed = 1').bind(now),
      ]);
      for (let attempt = 0; attempt < 8; attempt++) {
        const roomCode = randomRoomCode();
        if(reserveCode&&!await reserveCode(roomCode))continue;
        const inserted = await db.prepare('INSERT OR IGNORE INTO arcade_phone_rooms(code, game, host_token_hash, status_json, host_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').bind(roomCode, data.game, hash, JSON.stringify({ phase: 'lobby', paused: true, active: false, text: 'Waiting for host' }), now, now + ROOM_LIFETIME_MS).run();
        if (inserted.meta.changes) return json({ code: roomCode, game: data.game, maxSeats: 10, expiresAt: now + ROOM_LIFETIME_MS, serverNow: now }, 201, phoneCookie(phoneHostCookie(roomCode), token, roomCode));
      }
      return error('ROOM_BUSY', 'Please create another room.', 503);
    }
    const room = await roomFor(code, now); if (!room) return error('ROOM_NOT_FOUND', 'This phone room is closed or expired.', 404);
    if (['host', 'close', 'bot', 'start', 'lobby'].includes(action)) {
      const token = cookie(request, phoneHostCookie(code));
      if (!token || !timingSafeStringEqual(await sha256Hex(token), room.host_token_hash)) return error('UNAUTHORIZED', 'Host session required.', 401);
      if (action === 'close') {
        const data = await payload(request, emptySchema); if (data instanceof Response) return data;
        // Delete while the authenticated generation is still live, then invalidate its
        // hash. Every statement is guarded; a failed update cannot leave side effects.
        const results = await db.batch([
          db.prepare(`DELETE FROM arcade_phone_inputs WHERE room_code = ? AND EXISTS (${LIVE_ROOM})`).bind(code, code, now, room.host_token_hash),
          db.prepare(`DELETE FROM arcade_phone_seats WHERE room_code = ? AND EXISTS (${LIVE_ROOM})`).bind(code, code, now, room.host_token_hash),
          db.prepare("UPDATE arcade_phone_rooms SET closed = 1, host_token_hash = '', private_states_json = '{}' WHERE code = ? AND closed = 0 AND expires_at > ? AND host_token_hash = ?").bind(code, now, room.host_token_hash),
        ]);
        if (!results[2].meta.changes) return error('ROOM_NOT_FOUND', 'This phone room is closed or replaced.', 404);
        return json({ closed: true }, 200, phoneCookie(phoneHostCookie(code), '', code, 0));
      }
      if (action === 'lobby') {
        const data = await payload(request, lobbySchema); if (data instanceof Response) return data;
        if (room.version !== data.version) return error('STALE_VERSION', 'The room changed. Refresh the lobby and try again.', 409);
        const phases = FEATURED_LOBBY_PHASES[room.game];
        const nativeStatus = JSON.parse(room.status_json) as PhoneStatus;
        const phase = nativeStatus.phase.toLowerCase();
        const ready = !!phases?.ready.includes(phase) && !nativeStatus.active;
        const settled = !!phases?.settled.includes(phase);
        if (room.active_seats_json === null || (!ready && !settled)) return error('MATCH_LOCKED', 'The game must return to its lobby or finish before changing bot seats.', 409);
        const results = await db.batch([
          db.prepare(`UPDATE arcade_phone_rooms SET active_seats_json = NULL, status_json = ?, private_states_json = '{}', version = version + 1 WHERE code = ? AND version = ? AND closed = 0 AND expires_at > ? AND host_token_hash = ? AND active_seats_json IS NOT NULL`).bind(JSON.stringify({ phase: 'lobby', paused: true, active: false, text: 'Ready for the next match' }), code, data.version, now, room.host_token_hash),
          db.prepare(`DELETE FROM arcade_phone_inputs WHERE room_code = ? AND EXISTS (${LIVE_ROOM}) AND EXISTS (SELECT 1 FROM arcade_phone_rooms WHERE code = ? AND version = ? AND active_seats_json IS NULL)`).bind(code, code, now, room.host_token_hash, code, data.version + 1),
        ]);
        if (!results[0].meta.changes) return error('STALE_VERSION', 'The room changed. Refresh the lobby and try again.', 409);
        return json({ activeSeatIds: null, botEnabled: JSON.parse(room.bot_enabled_json), version: data.version + 1 });
      }
      if (action === 'bot') {
        const data = await payload(request, botSchema); if (data instanceof Response) return data;
        const botStatus = JSON.parse(room.status_json) as PhoneStatus;
        if (botStatus.active || room.active_seats_json !== null) return error('MATCH_LOCKED', 'Bot seats are locked after the match starts.', 409);
        if (room.version !== data.version) return error('STALE_VERSION', 'The room changed. Refresh the lobby and try again.', 409);
        const occupied = await db.prepare(`SELECT 1 FROM arcade_phone_seats WHERE room_code = ? AND seat = ? AND EXISTS (${LIVE_ROOM})`).bind(code, data.seat, code, now, room.host_token_hash).first();
        if (occupied) return error('SEAT_OCCUPIED', 'A phone already occupies this seat.', 409);
        const enabled = JSON.parse(room.bot_enabled_json) as Record<string, boolean>;
        enabled[String(data.seat)] = data.enabled;
        const updated = await db.prepare(`UPDATE arcade_phone_rooms SET bot_enabled_json = ?, version = version + 1 WHERE code = ? AND version = ? AND closed = 0 AND expires_at > ? AND host_token_hash = ? AND active_seats_json IS NULL AND json_extract(status_json, '$.active') = 0 AND NOT EXISTS (SELECT 1 FROM arcade_phone_seats WHERE room_code = ? AND seat = ?)`).bind(JSON.stringify(enabled), code, data.version, now, room.host_token_hash, code, data.seat).run();
        if (!updated.meta.changes) return error('STALE_VERSION', 'The room changed. Refresh the lobby and try again.', 409);
        return json({ botEnabled: enabled, version: data.version + 1 });
      }
      if (action === 'start') {
        const data = await payload(request, startSchema); if (data instanceof Response) return data;
        const currentStatus = JSON.parse(room.status_json) as PhoneStatus;
        if (room.version !== data.version) return error('STALE_VERSION', 'The room changed. Refresh the lobby and try again.', 409);
        if (currentStatus.active || room.active_seats_json !== null) return error('MATCH_LOCKED', 'This room already has an active roster.', 409);
        const phones = await db.prepare(`SELECT seat FROM arcade_phone_seats WHERE room_code = ? AND EXISTS (${LIVE_ROOM}) ORDER BY seat`).bind(code, code, now, room.host_token_hash).all<{ seat: number }>();
        const phoneSeats = new Set((phones.results || []).map(player => player.seat));
        const enabled = JSON.parse(room.bot_enabled_json) as Record<string, boolean>;
        const activeSeatIds = Array.from({ length: MAX_SEATS }, (_, seat) => seat).filter(seat => phoneSeats.has(seat) || enabled[String(seat)] === true);
        if (activeSeatIds.length < 2) return error('NOT_ENOUGH_PLAYERS', 'Enable at least two bots or connect enough phones to start.', 409);
        const updated = await db.prepare(`UPDATE arcade_phone_rooms SET active_seats_json = ?, version = version + 1 WHERE code = ? AND version = ? AND closed = 0 AND expires_at > ? AND host_token_hash = ? AND active_seats_json IS NULL AND json_extract(status_json, '$.active') = 0`).bind(JSON.stringify(activeSeatIds), code, data.version, now, room.host_token_hash).run();
        if (!updated.meta.changes) return error('STALE_VERSION', 'The room changed. Refresh the lobby and try again.', 409);
        return json({ activeSeatIds, botEnabled: enabled, version: data.version + 1 });
      }
      const data = await payload(request, hostSchema, true); if (data instanceof Response) return data;
      // Acknowledge only prior delivery, then read pending events in one D1 transaction.
      // Response loss replays unacknowledged events; host runtime deduplicates by sequence.
      const ackEntries = Object.entries(data.ack ?? {});
      let hostRefreshRequired = ackEntries.some(([, ack]) => typeof ack === 'number');
      const ackSeats = ackEntries.filter(([, ack]) => typeof ack !== 'number');
      const privateEntries = Object.entries(data.privateStates ?? {});
      const currentSeats = ackSeats.length || privateEntries.length
        ? await db.prepare(`SELECT seat, token_hash FROM arcade_phone_seats WHERE room_code = ? AND EXISTS (${LIVE_ROOM})`).bind(code, code, now, room.host_token_hash).all<{ seat: number; token_hash: string }>()
        : { results: [] as Array<{ seat: number; token_hash: string }> };
      const currentBySeat = new Map((currentSeats.results || []).map(seat => [seat.seat, seat.token_hash]));
      const acknowledgements = [];
      for (const [seatKey, ack] of ackSeats) {
        if (typeof ack === 'number') continue;
        const seat = Number(seatKey), tokenHash = currentBySeat.get(seat);
        if (!tokenHash || ack.occupancyId !== await phoneOccupancyId(tokenHash)) continue;
        acknowledgements.push(db.prepare(`DELETE FROM arcade_phone_inputs WHERE room_code = ? AND seat = ? AND seq <= ? AND EXISTS (${LIVE_ROOM}) AND EXISTS (SELECT 1 FROM arcade_phone_seats WHERE room_code = ? AND seat = ? AND token_hash = ?)`).bind(code, seat, ack.seq, code, now, room.host_token_hash, code, seat, tokenHash));
      }
      const privateUpdates = [];
      for (const [seatKey, value] of privateEntries) {
        const seat = Number(seatKey);
        if (!value || typeof value !== 'object' || !('occupancyId' in value) || !('state' in value)) {
          hostRefreshRequired = true;
          continue;
        }
        const envelope = value as { occupancyId: string; state: unknown };
        const tokenHash = currentBySeat.get(seat);
        if (!tokenHash || envelope.occupancyId !== await phoneOccupancyId(tokenHash)) {
          hostRefreshRequired = true;
          continue;
        }
        // Patch one seat at a time so concurrent host polls cannot replace another
        // phone's board. The token hash guard closes the read-to-batch replacement race.
        privateUpdates.push(db.prepare(`UPDATE arcade_phone_rooms SET private_states_json = json_set(private_states_json, ?, json(?)) WHERE code = ? AND closed = 0 AND expires_at > ? AND host_token_hash = ? AND EXISTS (SELECT 1 FROM arcade_phone_seats WHERE room_code = ? AND seat = ? AND token_hash = ?)`).bind(`$."${seat}"`, JSON.stringify(envelope), code, now, room.host_token_hash, code, seat, tokenHash));
      }
      const results = await db.batch([
        db.prepare('UPDATE arcade_phone_rooms SET status_json = ?, host_seen_at = ? WHERE code = ? AND closed = 0 AND expires_at > ? AND host_token_hash = ?').bind(JSON.stringify(data.status), now, code, now, room.host_token_hash),
        db.prepare(`DELETE FROM arcade_phone_inputs WHERE room_code = ? AND (received_at < ? OR ? = 1) AND EXISTS (${LIVE_ROOM})`).bind(code, now - INPUT_STALE_MS, data.status.paused || !data.status.active ? 1 : 0, code, now, room.host_token_hash),
        ...acknowledgements,
        ...privateUpdates,
        db.prepare(`SELECT token_hash, seat, name, last_seq, last_seen_at, input_at FROM arcade_phone_seats WHERE room_code = ? AND EXISTS (${LIVE_ROOM}) ORDER BY seat`).bind(code, code, now, room.host_token_hash),
        db.prepare(`SELECT seat, packet_json, received_at FROM arcade_phone_inputs WHERE room_code = ? AND EXISTS (${LIVE_ROOM}) ORDER BY seat, seq`).bind(code, code, now, room.host_token_hash),
      ]);
      if (!results[0].meta.changes) return error('ROOM_NOT_FOUND', 'This phone room is closed or expired.', 404);
      const rosterIndex = 2 + acknowledgements.length + privateUpdates.length;
      const roster = await Promise.all((results[rosterIndex].results as unknown as SeatRow[]).map(async seat => ({ seat: seat.seat, name: seat.name, occupancyId: await phoneOccupancyId(seat.token_hash), connected: now - seat.last_seen_at <= DISCONNECTED_MS, stale: !seat.input_at || now - seat.input_at > INPUT_STALE_MS, lastSeq: seat.last_seq, inputAgeMs: seat.input_at ? Math.max(0, now - seat.input_at) : null })));
      const inputs = (results[rosterIndex + 1].results as unknown as InputRow[]).map(input => ({ seat: input.seat, packet: JSON.parse(input.packet_json) as PhoneInput, receivedAt: input.received_at }));
      const fresh = await roomFor(code, now, room.host_token_hash);
      return json({ code, game: room.game, status: data.status, roster, inputs, botEnabled: JSON.parse(fresh?.bot_enabled_json ?? room.bot_enabled_json), activeSeatIds: fresh?.active_seats_json ? JSON.parse(fresh.active_seats_json) : null, version: fresh?.version ?? room.version, hostRefreshRequired, serverNow: now, expiresAt: room.expires_at });
    }
    if (action === 'join') {
      const data = await payload(request, joinSchema); if (data instanceof Response) return data;
      const existing = await seatFor(request, room, now);
      if (existing) {
        const touched = await db.prepare(`UPDATE arcade_phone_seats SET last_seen_at = ? WHERE room_code = ? AND seat = ? AND token_hash = ? AND EXISTS (${LIVE_ROOM})`).bind(now, code, existing.seat, existing.token_hash, code, now, room.host_token_hash).run();
        if (!touched.meta.changes) return error('ROOM_NOT_FOUND', 'This phone room is closed or replaced.', 404);
        return json({ ...await phoneSnapshot(room, existing, now), restored: true });
      }
      const token = randomToken(); const hash = await sha256Hex(token);
      // Seat selection happens inside a single INSERT SELECT, never a read-then-insert.
      const results = await db.batch([db.prepare(`WITH candidate(seat) AS (VALUES (0), (1), (2), (3), (4), (5), (6), (7), (8), (9))
        INSERT INTO arcade_phone_seats(room_code, seat, name, token_hash, last_seen_at)
        SELECT ?, candidate.seat, ?, ?, ? FROM candidate
        WHERE NOT EXISTS (SELECT 1 FROM arcade_phone_seats WHERE room_code = ? AND seat = candidate.seat)
        AND EXISTS (SELECT 1 FROM arcade_phone_rooms r WHERE r.code = ? AND (r.active_seats_json IS NULL OR EXISTS (SELECT 1 FROM json_each(r.active_seats_json) AS active WHERE CAST(active.value AS INTEGER) = candidate.seat)))
        AND EXISTS (${LIVE_ROOM}) ORDER BY candidate.seat LIMIT 1`).bind(code, data.name, hash, now, code, code, code, now, room.host_token_hash),
        db.prepare(`UPDATE arcade_phone_rooms SET version = version + 1 WHERE code = ? AND closed = 0 AND expires_at > ? AND host_token_hash = ? AND EXISTS (SELECT 1 FROM arcade_phone_seats WHERE room_code = ? AND token_hash = ?)`).bind(code, now, room.host_token_hash, code, hash)]);
      if (!results[0].meta.changes) return (await roomFor(code, now, room.host_token_hash)) ? error('ROOM_FULL', 'This room has no available phone seats.', 409) : error('ROOM_NOT_FOUND', 'Room closed.', 404);
      const joined = await db.prepare(`SELECT token_hash, seat, name, last_seq, last_seen_at, input_at FROM arcade_phone_seats WHERE room_code = ? AND token_hash = ? AND EXISTS (${LIVE_ROOM})`).bind(code, hash, code, now, room.host_token_hash).first<SeatRow>();
      if (!joined) return error('ROOM_NOT_FOUND', 'Room closed.', 404);
      return json({ ...await phoneSnapshot(room, joined, now), restored: false }, 201, phoneCookie(phoneSeatCookie(code), token, code, Math.max(0, Math.floor((room.expires_at - now) / 1000))));
    }
    const seat = await seatFor(request, room, now); if (!seat) return error('UNAUTHORIZED', 'Phone session required.', 401);
    if (action === 'leave') {
      const data = await payload(request, emptySchema); if (data instanceof Response) return data;
      const results = await db.batch([
        db.prepare(`DELETE FROM arcade_phone_inputs WHERE room_code = ? AND seat = ? AND EXISTS (${LIVE_ROOM}) AND EXISTS (SELECT 1 FROM arcade_phone_seats WHERE room_code = ? AND seat = ? AND token_hash = ?)`).bind(code, seat.seat, code, now, room.host_token_hash, code, seat.seat, seat.token_hash),
        db.prepare(`UPDATE arcade_phone_rooms SET private_states_json = json_remove(private_states_json, ?), version = version + 1 WHERE code = ? AND closed = 0 AND expires_at > ? AND host_token_hash = ? AND EXISTS (SELECT 1 FROM arcade_phone_seats WHERE room_code = ? AND seat = ? AND token_hash = ?)`).bind(`$."${seat.seat}"`, code, now, room.host_token_hash, code, seat.seat, seat.token_hash),
        db.prepare(`DELETE FROM arcade_phone_seats WHERE room_code = ? AND seat = ? AND token_hash = ? AND EXISTS (${LIVE_ROOM})`).bind(code, seat.seat, seat.token_hash, code, now, room.host_token_hash),
      ]);
      if (!results[2].meta.changes) return error('UNAUTHORIZED', 'Phone session required.', 401);
      return json({ left: true, seat: seat.seat });
    }
    if (action === 'poll') {
      const data = await payload(request, emptySchema); if (data instanceof Response) return data;
      const result = await db.prepare(`UPDATE arcade_phone_seats SET last_seen_at = ? WHERE room_code = ? AND seat = ? AND token_hash = ? AND EXISTS (${LIVE_ROOM})`).bind(now, code, seat.seat, seat.token_hash, code, now, room.host_token_hash).run();
      if (!result.meta.changes) return error('ROOM_NOT_FOUND', 'Room closed.', 404);
      return json(await phoneSnapshot(room, seat, now));
    }
    const data = await payload(request, inputSchema); if (data instanceof Response) return data;
    const currentStatus: PhoneStatus = JSON.parse(room.status_json);
    if (now - room.host_seen_at > HOST_TIMEOUT_MS || currentStatus.paused || !currentStatus.active) return error('HOST_PAUSED', 'The host is paused or disconnected.', 409);
    const results = await db.batch([
      db.prepare(`DELETE FROM arcade_phone_inputs WHERE room_code = ? AND received_at < ? AND EXISTS (${LIVE_ROOM}) AND EXISTS (SELECT 1 FROM arcade_phone_seats WHERE room_code = ? AND seat = ? AND token_hash = ?)`).bind(code, now - INPUT_STALE_MS, code, now, room.host_token_hash, code, seat.seat, seat.token_hash),
      db.prepare(`INSERT OR IGNORE INTO arcade_phone_inputs(room_code, seat, seq, packet_json, received_at)
        SELECT ?, ?, ?, ?, ? FROM arcade_phone_seats s WHERE s.room_code = ? AND s.seat = ? AND s.token_hash = ? AND s.last_seq < ?
        AND (SELECT COUNT(*) FROM arcade_phone_inputs WHERE room_code = ? AND seat = ?) < ?
        AND EXISTS (SELECT 1 FROM arcade_phone_rooms WHERE code = ? AND closed = 0 AND expires_at > ? AND host_token_hash = ? AND host_seen_at >= ? AND json_extract(status_json, '$.paused') = 0 AND json_extract(status_json, '$.active') = 1)`)
        .bind(code, seat.seat, data.seq, JSON.stringify(data), now, code, seat.seat, seat.token_hash, data.seq, code, seat.seat, MAX_PENDING_INPUTS, code, now, room.host_token_hash, now - HOST_TIMEOUT_MS),
      db.prepare(`UPDATE arcade_phone_seats SET last_seq = ?, last_seen_at = ?, input_at = ? WHERE room_code = ? AND seat = ? AND token_hash = ? AND last_seq < ? AND EXISTS (${LIVE_ROOM}) AND EXISTS (SELECT 1 FROM arcade_phone_inputs WHERE room_code = ? AND seat = ? AND seq = ?)`).bind(data.seq, now, now, code, seat.seat, seat.token_hash, data.seq, code, now, room.host_token_hash, code, seat.seat, data.seq),
    ]);
    if (results[1].meta.changes) return json({ accepted: true, seq: data.seq, serverNow: now });
    const freshRoom = await roomFor(code, now, room.host_token_hash); if (!freshRoom) return error('ROOM_NOT_FOUND', 'Room closed.', 404);
    const fresh = await seatFor(request, room, now); if (!fresh) return error('UNAUTHORIZED', 'Phone session required.', 401);
    if (data.seq <= fresh.last_seq) return error('STALE_SEQUENCE', 'Send a newer input sequence.', 409);
    const freshStatus: PhoneStatus = JSON.parse(freshRoom.status_json);
    if (freshStatus.paused || !freshStatus.active || now - freshRoom.host_seen_at > HOST_TIMEOUT_MS) return error('HOST_PAUSED', 'The host is paused or disconnected.', 409);
    const response = error('INPUT_QUEUE_FULL', 'Wait for the host, then retry this sequence.', 429); response.headers.set('Retry-After', '1'); return response;
  }
  return { handle };
}
