import {
  HEARTBEAT_INTERVAL_MS, HEARTBEAT_TIMEOUT_MS, HELD_INPUT_TIMEOUT_MS, MAX_INPUTS_PER_SECOND,
  ROOM_TTL_MS, acceptSequence, claimSeat, createRoomRecord, neutralInput,
  makeInputFrame, neutralizeStaleInputs, publicRoom, roomCanJoin, validateControllerInput,
  type RoomRecord,
} from './room-state.ts';

const MAX_BODY_BYTES = 32 * 1024;
const MAX_NAME_LENGTH = 24;
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const TOKEN_BYTES = 32;

interface SqlCursor<T> { toArray(): T[]; }
interface SqlStorage { exec<T = Record<string, unknown>>(query: string, ...bindings: unknown[]): SqlCursor<T>; }
interface Storage { sql: SqlStorage; setAlarm(time: number | Date): Promise<void>; }
interface SocketLike {
  accept?(): void; send(data: string): void; close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: any) => void): void;
  serializeAttachment?(value: unknown): void; deserializeAttachment?(): unknown; readyState: number;
}
interface DurableState {
  storage: Storage; getWebSockets(): SocketLike[]; acceptWebSocket?(socket: SocketLike): void;
}
export interface RoomNamespace { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> }; }
export interface RoomEnv { ROOMS?: RoomNamespace; }
type ConnectionIdentity = { role: 'host'; generation: number; messageRateWindowAt: number; messageRateCount: number }
  | { role: 'controller'; seat: number; generation: number; messageRateWindowAt: number; messageRateCount: number };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};
const makeCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
};
async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
function wsReady(socket: SocketLike): boolean { return socket.readyState === 1; }
function frame(socket: SocketLike, value: unknown): void { if (wsReady(socket)) socket.send(JSON.stringify(value)); }
function parseJson(value: string | ArrayBuffer): unknown {
  const text = typeof value === 'string' ? value : new TextDecoder().decode(value);
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error('message-too-large');
  return JSON.parse(text);
}
function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
async function readJsonLimited(request: Request, maxBytes: number): Promise<{ body: Record<string, unknown> | null; tooLarge: boolean }> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) return { body: null, tooLarge: true };
  if (!request.body) return { body: null, tooLarge: false };
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return { body: null, tooLarge: true }; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { body: recordOf(JSON.parse(new TextDecoder().decode(bytes))), tooLarge: false };
  } catch { return { body: null, tooLarge: false }; }
}

export async function createRoom(code: string, gameId: string, token: string, now = Date.now()): Promise<RoomRecord> {
  return createRoomRecord({ code, gameId, hostTokenHash: await digest(token), now });
}

export class ArcadeRoom {
  private record: RoomRecord | null = null;
  private recovered = false;
  private queue: Promise<void> = Promise.resolve();
  private readonly connections = new WeakMap<object, ConnectionIdentity>();
  private readonly localSockets = new Set<SocketLike>();
  private readonly state: DurableState;

  constructor(state: DurableState, _env: RoomEnv) {
    this.state = state;
    state.storage.sql.exec('CREATE TABLE IF NOT EXISTS room_state (id INTEGER PRIMARY KEY, record TEXT NOT NULL)');
    const row = state.storage.sql.exec<{ record: string }>('SELECT record FROM room_state WHERE id = 1').toArray()[0];
    if (row) {
      this.record = JSON.parse(row.record) as RoomRecord;
      const liveSockets = state.getWebSockets().filter(wsReady);
      const identities = liveSockets.map(socket => ({ socket, identity: socket.deserializeAttachment?.() as ConnectionIdentity | undefined }));
      const liveHost = identities.some(({ identity }) => identity?.role === 'host' && identity.generation === this.record!.hostSocketGeneration);
      const recoveredAt = Date.now();
      this.record.hostConnected = liveHost;
      this.record.hostLastSeenAt = liveHost ? (this.record.hostLastSeenAt || recoveredAt) : 0;
      for (const slot of Object.values(this.record.slots)) {
        const connected = identities.some(({ identity }) => identity?.role === 'controller' && identity.seat === slot.seat && identity.generation === slot.socketGeneration);
        slot.connected = connected; slot.bot = !connected; slot.lastSeenAt = connected ? (slot.lastSeenAt || recoveredAt) : 0; slot.input = neutralInput(); slot.lastInputAt = 0;
      }
      if (!liveHost) {
        if (this.record.phase === 'running') this.record.phase = 'paused';
        this.record.hostSocketGeneration++;
      }
      this.recovered = true;
      void this.save();
      void this.scheduleAlarm();
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.recoverRoomState();
    const url = new URL(request.url);
    if (url.pathname === '/internal/create' && request.method === 'POST') return this.create(request);
    if (url.pathname === '/internal/join' && request.method === 'POST') return this.join(request);
    if (url.pathname === '/socket' && request.method === 'GET') return this.upgrade(request);
    if (url.pathname === '/internal/status' && request.method === 'GET') return this.status();
    return json({ error: 'not-found' }, 404);
  }

  private async readBody(request: Request): Promise<Record<string, unknown> | null> {
    return (await readJsonLimited(request, 4096)).body;
  }

  private async create(request: Request): Promise<Response> {
    const body = await this.readBody(request);
    if (!body || typeof body.code !== 'string' || typeof body.gameId !== 'string' || typeof body.token !== 'string') return json({ error: 'invalid-request' }, 400);
    if (this.record) return json({ error: 'room-code-in-use' }, 409);
    this.record = await createRoom(body.code, body.gameId, body.token);
    await this.save(); await this.scheduleAlarm();
    return json({ room: publicRoom(this.record) }, 201);
  }

  private async join(request: Request): Promise<Response> {
    const body = await this.readBody(request);
    if (!body || typeof body.name !== 'string' || typeof body.token !== 'string') return json({ error: 'invalid-request' }, 400);
    const state = this.record;
    if (!state) return json({ error: 'room-not-found' }, 404);
    if (!roomCanJoin(state, Date.now())) return json({ error: 'room-closed' }, 410);
    const name = body.name.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
    if (!name) return json({ error: 'invalid-name' }, 400);
    const tokenHash = await digest(body.token);
    let claimed: { seat: number; resumed: boolean };
    try { claimed = claimSeat(state, { tokenHash, name, now: Date.now() }); }
    catch { return json({ error: 'room-full' }, 409); }
    const slot = state.slots[claimed.seat];
    await this.save(); await this.broadcastRoom();
    return json({ code: state.code, gameId: state.gameId, seat: claimed.seat, seatToken: body.token, sequence: slot.lastSequence, room: publicRoom(state) }, claimed.resumed ? 200 : 201);
  }

  private async status(): Promise<Response> {
    if (!this.record) return json({ error: 'room-not-found' }, 404);
    if (!roomCanJoin(this.record, Date.now())) return json({ error: 'room-closed' }, 410);
    return json({ room: publicRoom(this.record) });
  }

  private upgrade(request: Request): Response {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'websocket-required' }, 426);
    if (new URL(request.url).search) return json({ error: 'credentials-must-use-auth-message' }, 400);
    if (!this.record || !roomCanJoin(this.record, Date.now())) return json({ error: 'room-closed' }, this.record ? 410 : 404);
    const Pair = (globalThis as unknown as { WebSocketPair?: new () => { 0: SocketLike; 1: SocketLike } }).WebSocketPair;
    if (!Pair) return json({ error: 'websocket-unavailable' }, 501);
    const pair = new Pair();
    const client = pair[0]; const server = pair[1];
    server.serializeAttachment?.({ authExpiresAt: Date.now() + 5_000 });
    if (this.state.acceptWebSocket) this.state.acceptWebSocket(server);
    else {
      server.accept?.(); this.localSockets.add(server);
      setTimeout(() => { if (!this.identity(server)) server.close(4001, 'authentication-timeout'); }, 5_000);
      server.addEventListener('message', (event: { data: string | ArrayBuffer }) => this.enqueue(() => this.onMessage(server, event.data)));
      server.addEventListener('close', () => this.enqueue(() => this.onClose(server)));
      server.addEventListener('error', () => this.enqueue(() => this.onClose(server)));
    }
    void this.scheduleAlarm();
    return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: SocketLike });
  }

  webSocketMessage(socket: SocketLike, message: string | ArrayBuffer): Promise<void> { return this.enqueue(() => this.onMessage(socket, message)); }
  webSocketClose(socket: SocketLike, _code: number, _reason: string, _wasClean: boolean): Promise<void> { return this.enqueue(() => this.onClose(socket)); }
  webSocketError(socket: SocketLike, _error: unknown): Promise<void> { return this.enqueue(() => this.onClose(socket)); }

  private enqueue(task: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(task).catch(() => undefined);
    return this.queue;
  }

  private identity(socket: SocketLike): ConnectionIdentity | null {
    const fromMap = this.connections.get(socket as object);
    if (fromMap) return fromMap;
    const value = socket.deserializeAttachment?.();
    if (value && typeof value === 'object' && ((value as { role?: unknown }).role === 'host' || (value as { role?: unknown }).role === 'controller')) return value as ConnectionIdentity;
    return null;
  }

  private setIdentity(socket: SocketLike, identity: ConnectionIdentity): void {
    this.connections.set(socket as object, identity);
    socket.serializeAttachment?.(identity);
  }

  private async onMessage(socket: SocketLike, raw: string | ArrayBuffer): Promise<void> {
    const state = this.record;
    if (!state) { socket.close(4004, 'room-not-found'); return; }
    let msg: Record<string, unknown> | null;
    try { msg = recordOf(parseJson(raw)); } catch { socket.close(4002, 'invalid-message'); return; }
    if (!msg) { socket.close(4002, 'invalid-message'); return; }
    const identity = this.identity(socket);
    if (!identity) {
      const attachment = socket.deserializeAttachment?.() as { authExpiresAt?: number } | undefined;
      if (attachment?.authExpiresAt !== undefined && Date.now() >= attachment.authExpiresAt) { socket.close(4001, 'authentication-timeout'); return; }
      await this.authenticate(socket, msg); return;
    }
    if (msg.v !== 1 || typeof msg.type !== 'string') { this.reject(socket, 'invalid-protocol'); return; }
    const now = Date.now();
    const messageBytes = typeof raw === 'string' ? new TextEncoder().encode(raw).byteLength : raw.byteLength;
    const messageLimit = identity.role === 'controller' ? 2048 : msg.type === 'snapshot' ? MAX_BODY_BYTES : 1024;
    if (messageBytes > messageLimit) { this.reject(socket, 'message-too-large'); return; }
    if (now - identity.messageRateWindowAt >= 1000) { identity.messageRateWindowAt = now; identity.messageRateCount = 0; }
    if (++identity.messageRateCount > 60) { this.reject(socket, 'rate-limited'); return; }
    socket.serializeAttachment?.(identity);
    const allowedKeys = msg.type === 'ping' ? new Set(['v', 'type', 'at', 'clientTime'])
      : identity.role === 'controller' ? msg.type === 'cancel' ? new Set(['v', 'type', 'sequence']) : new Set(['v', 'type', 'sequence', 'payload'])
      : msg.type === 'snapshot' ? new Set(['v', 'type', 'data']) : new Set(['v', 'type']);
    if (Object.keys(msg).some(key => !allowedKeys.has(key))) { this.reject(socket, 'invalid-message'); return; }
    if (identity.role === 'host' && !this.isCurrentHost(identity)) { socket.close(4001, 'replaced'); return; }
    if (identity.role === 'controller' && !this.isCurrentSlot(identity)) { socket.close(4001, 'replaced'); return; }
    await this.recoverRoomState();
    if (msg.type === 'ping') {
      this.touch(identity, now); await this.save();
      const at = Number.isFinite(msg.at) ? msg.at : Number.isFinite(msg.clientTime) ? msg.clientTime : null;
      frame(socket, { v: 1, type: 'pong', at, clientTime: at, serverTime: now }); return;
    }
    if (identity.role === 'controller') {
      await this.controllerMessage(socket, identity, msg, now); return;
    }
    await this.hostMessage(socket, identity, msg, now);
  }

  private async authenticate(socket: SocketLike, msg: Record<string, unknown>): Promise<void> {
    const state = this.record;
    if (!state || Object.keys(msg).some(key => !['type', 'role', 'token'].includes(key)) || msg.type !== 'auth' ||
      (msg.role !== 'host' && msg.role !== 'controller') || typeof msg.token !== 'string' || !/^[a-f0-9]{64}$/i.test(msg.token)) {
      socket.close(4003, 'authentication-failed'); return;
    }
    const tokenHash = await digest(msg.token);
    const now = Date.now();
    if (msg.role === 'host') {
      if (tokenHash !== state.hostTokenHash) { socket.close(4003, 'authentication-failed'); return; }
      const previous = this.currentSocket({ role: 'host' });
      if (state.hostConnected && state.phase === 'running') {
        state.phase = 'paused';
        for (const slot of Object.values(state.slots)) slot.input = neutralInput();
      }
      state.hostSocketGeneration++;
      const identity: ConnectionIdentity = { role: 'host', generation: state.hostSocketGeneration, messageRateWindowAt: now, messageRateCount: 0 };
      if (previous && previous !== socket) previous.close(4001, 'replaced');
      state.hostConnected = true; state.hostLastSeenAt = now;
      this.setIdentity(socket, identity);
      frame(socket, { v: 1, type: 'welcome', role: 'host', room: publicRoom(state) });
      await this.save(); await this.broadcastRoom();
      this.sendHostSeatState(socket);
      await this.scheduleAlarm(); return;
    }
    const slot = Object.values(state.slots).find(candidate => candidate.tokenHash === tokenHash);
    if (!slot) { socket.close(4003, 'authentication-failed'); return; }
    const previous = this.currentSocket({ role: 'controller', seat: slot.seat });
    slot.lastSeenAt = now; slot.connected = true; slot.bot = false;
    const identity: ConnectionIdentity = { role: 'controller', seat: slot.seat, generation: (slot.socketGeneration ?? 0) + 1, messageRateWindowAt: now, messageRateCount: 0 };
    // Keep a distinct connection generation even when sequence is resumed from storage.
    slot.socketGeneration = identity.generation;
    if (previous && previous !== socket) previous.close(4001, 'replaced');
    this.setIdentity(socket, identity);
    frame(socket, { v: 1, type: 'welcome', role: 'controller', seat: slot.seat, sequence: slot.lastSequence, room: publicRoom(state) });
    await this.save(); await this.broadcastRoom();
    this.notifyHost({ v: 1, type: 'seat', seat: slot.seat, connected: true, name: slot.name });
    await this.scheduleAlarm();
  }

  private async controllerMessage(socket: SocketLike, identity: Extract<ConnectionIdentity, { role: 'controller' }>, msg: Record<string, unknown>, now: number): Promise<void> {
    const state = this.record!; const slot = state.slots[identity.seat];
    const cancel = msg.type === 'cancel';
    if (!cancel && msg.type !== 'input') { this.reject(socket, 'action-not-allowed'); return; }
    if (!cancel && (state.phase !== 'running' || !state.hostConnected)) { this.reject(socket, 'room-not-running'); return; }
    const input = cancel ? neutralInput() : validateControllerInput(msg.payload);
    if (!input || !Number.isSafeInteger(msg.sequence) || (msg.sequence as number) <= slot.lastSequence) { this.reject(socket, 'invalid-input'); return; }
    if (now - slot.rateWindowAt >= 1000) { slot.rateWindowAt = now; slot.rateCount = 0; }
    if (++slot.rateCount > MAX_INPUTS_PER_SECOND) { this.reject(socket, 'rate-limited'); return; }
    if (!acceptSequence(state, slot.seat, msg.sequence)) { this.reject(socket, 'invalid-input'); return; }
    slot.input = input; slot.lastInputAt = now; slot.lastSeenAt = now;
    const host = this.currentSocket({ role: 'host' });
    if (host) frame(host, makeInputFrame(slot.seat, msg.sequence as number, input, cancel));
    await this.save(); await this.scheduleAlarm();
  }

  private async hostMessage(socket: SocketLike, identity: Extract<ConnectionIdentity, { role: 'host' }>, msg: Record<string, unknown>, now: number): Promise<void> {
    const state = this.record!;
    if (msg.type === 'start' || msg.type === 'pause' || msg.type === 'resume' || msg.type === 'restart') {
      const valid = msg.type === 'start' ? state.phase === 'waiting'
        : msg.type === 'pause' ? state.phase === 'running'
        : msg.type === 'resume' ? state.phase === 'paused'
        : msg.type === 'restart' ? state.phase !== 'ended' : false;
      if (!valid) { this.reject(socket, 'invalid-phase'); return; }
      state.phase = msg.type === 'start' || msg.type === 'resume' ? 'running' : 'waiting';
      if (msg.type === 'pause') state.phase = 'paused';
      if (msg.type === 'restart') for (const slot of Object.values(state.slots)) slot.input = neutralInput();
      state.hostLastSeenAt = now; await this.save(); await this.broadcastRoom(); await this.scheduleAlarm(); return;
    }
    if (msg.type === 'snapshot') {
      if (state.phase !== 'running' && state.phase !== 'paused') { this.reject(socket, 'invalid-phase'); return; }
      const payload = JSON.stringify(msg.data);
      if (new TextEncoder().encode(payload).byteLength > 28 * 1024) { this.reject(socket, 'snapshot-too-large'); return; }
      state.hostLastSeenAt = now;
      this.broadcast({ v: 1, type: 'snapshot', data: msg.data });
      return;
    }
    this.reject(socket, 'action-not-allowed');
  }

  private touch(identity: ConnectionIdentity, now: number): void {
    const state = this.record!;
    if (identity.role === 'host') state.hostLastSeenAt = now;
    else state.slots[identity.seat].lastSeenAt = now;
  }

  private isCurrentHost(identity: ConnectionIdentity): boolean {
    return identity.role === 'host' && this.record?.hostSocketGeneration === identity.generation && this.record.hostConnected;
  }

  private isCurrentSlot(identity: ConnectionIdentity): boolean {
    const slot = identity.role === 'controller' ? this.record?.slots[identity.seat] : undefined;
    return !!slot && slot.socketGeneration === identity.generation && slot.connected;
  }

  private currentSocket(target: { role: 'host' } | { role: 'controller'; seat: number }): SocketLike | null {
    return this.allSockets().find(socket => {
      const identity = this.identity(socket);
      return wsReady(socket) && identity && (target.role === 'host'
        ? identity.role === 'host' && this.isCurrentHost(identity)
        : identity.role === 'controller' && identity.seat === target.seat && this.isCurrentSlot(identity));
    }) ?? null;
  }

  private allSockets(): SocketLike[] {
    const sockets = new Set<SocketLike>([...this.state.getWebSockets(), ...this.localSockets]);
    return [...sockets].filter(wsReady);
  }

  private authenticatedSockets(): SocketLike[] {
    return this.allSockets().filter(socket => {
      const identity = this.identity(socket);
      return !!identity && (identity.role === 'host' ? this.isCurrentHost(identity) : this.isCurrentSlot(identity));
    });
  }

  private sendHostSeatState(host: SocketLike): void {
    for (const slot of Object.values(this.record!.slots)) frame(host, { v: 1, type: 'seat', seat: slot.seat, connected: slot.connected, name: slot.name });
  }

  private notifyHost(message: unknown): void { const host = this.currentSocket({ role: 'host' }); if (host) frame(host, message); }
  private broadcast(message: unknown): void { for (const socket of this.authenticatedSockets()) frame(socket, message); }
  private async broadcastRoom(): Promise<void> { if (this.record) this.broadcast({ v: 1, type: 'room', room: publicRoom(this.record) }); }
  private async recoverRoomState(): Promise<void> {
    if (!this.record || !this.recovered) return;
    this.recovered = false;
    for (const slot of Object.values(this.record.slots)) this.notifyHost(makeInputFrame(slot.seat, slot.lastSequence, neutralInput(), true));
    await this.broadcastRoom();
  }
  private reject(socket: SocketLike, error: string): void { frame(socket, { v: 1, type: 'error', error }); }

  private async onClose(socket: SocketLike): Promise<void> {
    this.localSockets.delete(socket);
    await this.recoverRoomState();
    const state = this.record; const identity = this.identity(socket);
    if (!state || !identity) return;
    const now = Date.now();
    if (identity.role === 'host' && this.isCurrentHost(identity)) {
      state.hostConnected = false; state.hostLastSeenAt = now;
      if (state.phase === 'running') state.phase = 'paused';
      for (const slot of Object.values(state.slots)) slot.input = neutralInput();
      await this.save(); await this.broadcastRoom(); await this.scheduleAlarm(); return;
    }
    if (identity.role === 'controller' && this.isCurrentSlot(identity)) {
      const slot = state.slots[identity.seat]; slot.connected = false; slot.bot = true; slot.input = neutralInput();
      slot.lastSeenAt = now; await this.save(); await this.broadcastRoom();
      this.notifyHost({ v: 1, type: 'seat', seat: slot.seat, connected: false, name: slot.name }); await this.scheduleAlarm();
    }
  }

  async alarm(): Promise<void> {
    const state = this.record;
    if (!state) return;
    const now = Date.now();
    if (now - state.createdAt >= ROOM_TTL_MS) { await this.expire(); return; }
    await this.recoverRoomState();
    let changed = false;
    for (const socket of this.allSockets()) {
      const attachment = socket.deserializeAttachment?.() as { authExpiresAt?: number } | undefined;
      if (!this.identity(socket) && attachment?.authExpiresAt !== undefined && now >= attachment.authExpiresAt) socket.close(4001, 'authentication-timeout');
    }
    if (state.hostConnected && now - state.hostLastSeenAt >= HEARTBEAT_TIMEOUT_MS) {
      const host = this.currentSocket({ role: 'host' }); host?.close(4000, 'heartbeat-timeout');
      state.hostConnected = false; if (state.phase === 'running') state.phase = 'paused';
      for (const slot of Object.values(state.slots)) slot.input = neutralInput(); changed = true;
    }
    for (const slot of Object.values(state.slots)) {
      if (slot.connected && now - slot.lastSeenAt >= HEARTBEAT_TIMEOUT_MS) {
        this.currentSocket({ role: 'controller', seat: slot.seat })?.close(4000, 'heartbeat-timeout');
        slot.connected = false; slot.bot = true; slot.input = neutralInput(); changed = true;
        this.notifyHost({ v: 1, type: 'seat', seat: slot.seat, connected: false, name: slot.name });
      }
    }
    const stale = neutralizeStaleInputs(state, now);
    if (stale.length) {
      for (const seat of stale) this.notifyHost(makeInputFrame(seat, state.slots[seat].lastSequence, neutralInput(), true));
      changed = true;
    }
    if (changed) { await this.save(); await this.broadcastRoom(); }
    await this.scheduleAlarm();
  }

  private async expire(): Promise<void> {
    this.record = null;
    this.state.storage.sql.exec('DELETE FROM room_state');
    for (const socket of this.allSockets()) socket.close(4000, 'room-expired');
  }

  private async save(): Promise<void> {
    if (!this.record) return;
    this.record.updatedAt = Date.now();
    const persisted: RoomRecord = {
      ...this.record,
      hostConnected: false,
      hostLastSeenAt: this.record.hostLastSeenAt,
      slots: Object.fromEntries(Object.entries(this.record.slots).map(([seat, slot]) => [seat, {
        ...slot, connected: false, bot: true,
        input: neutralInput(), lastInputAt: 0,
      }])),
    };
    this.state.storage.sql.exec('INSERT INTO room_state (id, record) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET record = excluded.record', JSON.stringify(persisted));
  }

  private async scheduleAlarm(): Promise<void> {
    if (!this.record) return;
    const hasHeldInput = Object.values(this.record.slots).some(slot => slot.connected && Date.now() - slot.lastInputAt < HELD_INPUT_TIMEOUT_MS &&
      (slot.input.moveX !== 0 || slot.input.moveY !== 0 || slot.input.primaryAction || slot.input.secondaryAction || slot.input.tertiaryAction || slot.input.run));
    const unauthenticatedExpiry = this.allSockets().map(socket => {
      const attachment = socket.deserializeAttachment?.() as { authExpiresAt?: number } | undefined;
      return !this.identity(socket) ? attachment?.authExpiresAt : undefined;
    }).filter((value): value is number => value !== undefined);
    await this.state.storage.setAlarm(Math.min(this.record.createdAt + ROOM_TTL_MS, ...unauthenticatedExpiry, Date.now() + (hasHeldInput || this.recovered ? 1000 : HEARTBEAT_INTERVAL_MS)));
  }
}

export async function handleRoomApi(request: Request, env: RoomEnv & { CATALOG?: { games: Array<{ id: string; source: { status: string } }> } }): Promise<Response | null> {
  const url = new URL(request.url); const rooms = env.ROOMS;
  const roomRoute = url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|socket))?$/);
  if (url.pathname !== '/api/rooms' && !roomRoute) return null;
  if (!rooms) return null;
  if (url.pathname === '/api/rooms') {
    if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
    const parsed = await readJsonLimited(request, 2048);
    if (parsed.tooLarge) return json({ error: 'request-too-large' }, 413);
    const body = parsed.body;
    if (!body || typeof body.gameId !== 'string' || Object.keys(body).some(key => key !== 'gameId')) return json({ error: 'invalid-request' }, 400);
    const game = env.CATALOG?.games.find(candidate => candidate.id === body.gameId && candidate.source.status === 'imported');
    if (!game) return json({ error: 'game-unavailable' }, 404);
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = makeCode(); const hostToken = randomToken();
      const stub = rooms.get(rooms.idFromName(code));
      const response = await stub.fetch(new Request('https://room.internal/internal/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, gameId: game.id, token: hostToken }) }));
      if (response.status === 201) return json({ code, hostToken, gameId: game.id }, 201);
      if (response.status !== 409) return response;
    }
    return json({ error: 'room-allocation-failed' }, 503);
  }
  const code = roomRoute![1]; const action = roomRoute![2];
  const stub = rooms.get(rooms.idFromName(code));
  if (action === 'join' && request.method === 'POST') {
    const parsed = await readJsonLimited(request, 2048);
    if (parsed.tooLarge) return json({ error: 'request-too-large' }, 413);
    const body = parsed.body;
    if (!body || typeof body.name !== 'string' || Object.keys(body).some(key => key !== 'name' && key !== 'token')) return json({ error: 'invalid-request' }, 400);
    let token = body.token;
    if (token === undefined) token = randomToken();
    if (typeof token !== 'string' || token.length < 32 || token.length > 128 || !/^[a-f0-9]+$/i.test(token)) return json({ error: 'invalid-credential' }, 400);
    return stub.fetch(new Request('https://room.internal/internal/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: body.name, token }) }));
  }
  if (action === 'socket' && request.method === 'GET') {
    if (url.search) return json({ error: 'credentials-must-use-auth-message' }, 400);
    return stub.fetch(new Request('https://room.internal/socket', { headers: request.headers }));
  }
  if (!action && request.method === 'GET') return stub.fetch(new Request('https://room.internal/internal/status'));
  return json({ error: 'method-not-allowed' }, 405);
}
