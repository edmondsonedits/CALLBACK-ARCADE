import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeRoom } from '../src/room.ts';

class MemorySql {
  record;
  exec(query, ...bindings) {
    if (query.startsWith('SELECT')) return { toArray: () => this.record ? [{ record: this.record }] : [] };
    if (query.startsWith('INSERT')) { this.record = bindings[0]; return { toArray: () => [] }; }
    if (query.startsWith('DELETE')) { this.record = undefined; return { toArray: () => [] }; }
    return { toArray: () => [] };
  }
}
function storage(sql = new MemorySql()) {
  return { sql, alarm: null, async setAlarm(value) { this.alarm = value; }, async deleteAll() {} };
}
function context(store, sockets = []) { return { storage: store, getWebSockets: () => sockets, acceptWebSocket(socket) { sockets.push(socket); } }; }
const post = (path, body) => new Request(`https://room.internal${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

class FakeSocket {
  readyState = 1; sent = []; attachment;
  send(data) { this.sent.push(JSON.parse(data)); }
  close(code, reason) { this.readyState = 3; this.closed = { code, reason }; }
  serializeAttachment(value) { this.attachment = structuredClone(value); }
  deserializeAttachment() { return this.attachment; }
}
class FakePair {
  0 = new FakeSocket(); 1 = new FakeSocket();
}
class FakeResponse {
  constructor(body, init = {}) { this.body = body; this.status = init.status ?? 200; this.webSocket = init.webSocket; }
  async json() { return JSON.parse(this.body); }
}
async function setup(room) {
  await room.fetch(post('/internal/create', { code: 'ABC234', gameId: 'royal-sumo', token: 'a'.repeat(64) }));
  await room.fetch(post('/internal/join', { name: 'P1', token: 'b'.repeat(64) }));
}
async function open(room) {
  const result = await room.fetch(new Request('https://room.internal/socket', { headers: { upgrade: 'websocket' } }));
  return { result, client: result.webSocket, server: roomStateSockets.at(-1) };
}
let roomStateSockets = [];

test('Durable Object persists private room identity and only exposes safe room snapshots', async () => {
  const store = storage(); const first = new ArcadeRoom(context(store), {});
  const created = await first.fetch(post('/internal/create', { code: 'ABC234', gameId: 'royal-sumo', token: 'a'.repeat(64) }));
  assert.equal(created.status, 201);
  const joined = await first.fetch(post('/internal/join', { name: ' Driver ', token: 'b'.repeat(64) }));
  assert.equal(joined.status, 201);
  assert.equal((await joined.json()).seat, 1);
  const persisted = JSON.parse(store.sql.record);
  assert.equal(persisted.slots[1].input.moveX, 0);
  assert.equal(persisted.slots[1].input.primaryAction, false);
  assert.equal(persisted.slots[1].lastInputAt, 0);
  assert.equal(persisted.slots[1].tokenHash.length, 64);
  const reopened = new ArcadeRoom(context(store), {});
  const status = await reopened.fetch(new Request('https://room.internal/internal/status'));
  const body = await status.json();
  assert.equal(body.room.slots[1].name, 'Driver');
  assert.equal(JSON.stringify(body).includes('token'), false);
  assert.equal(JSON.stringify(body).includes('hash'), false);
  assert.ok(store.alarm);
});

test('Durable Object denies the eleventh total occupant after host plus nine controllers', async () => {
  const room = new ArcadeRoom(context(storage()), {});
  await room.fetch(post('/internal/create', { code: 'ABC234', gameId: 'royal-sumo', token: 'a'.repeat(64) }));
  for (let i = 0; i < 9; i++) {
    const response = await room.fetch(post('/internal/join', { name: `P${i}`, token: String(i).padStart(64, '0') }));
    assert.equal(response.status, 201);
  }
  const full = await room.fetch(post('/internal/join', { name: 'P10', token: 'f'.repeat(64) }));
  assert.equal(full.status, 409);
  assert.equal((await full.json()).error, 'room-full');
});

test('room TTL deletes the SQLite row so an expired room cannot return after a Durable Object restart', async () => {
  const store = storage();
  const room = new ArcadeRoom(context(store), {});
  await room.fetch(post('/internal/create', { code: 'ABC234', gameId: 'royal-sumo', token: 'a'.repeat(64) }));
  const expired = JSON.parse(store.sql.record); expired.createdAt = 0; store.sql.record = JSON.stringify(expired);
  await new ArcadeRoom(context(store), {}).alarm();
  assert.equal(store.sql.record, undefined);
  const reopened = new ArcadeRoom(context(store), {});
  assert.equal((await reopened.fetch(new Request('https://room.internal/internal/status'))).status, 404);
});

test('socket auth, phase gates, host relay, duplicate sequence rejection, and host replacement pause', async () => {
  const oldResponse = globalThis.Response; const oldPair = globalThis.WebSocketPair;
  const sockets = []; roomStateSockets = sockets;
  try {
    globalThis.Response = FakeResponse;
    globalThis.WebSocketPair = FakePair;
    const store = storage();
    const room = new ArcadeRoom(context(store, sockets), {});
    await setup(room);
    const observer = await open(room);
    const wrong = await open(room);
    await room.webSocketMessage(wrong.server, JSON.stringify({ type: 'auth', role: 'host', token: 'c'.repeat(64) }));
    assert.equal(wrong.server.closed.code, 4003);
    const host = await open(room);
    await room.webSocketMessage(host.server, JSON.stringify({ type: 'auth', role: 'host', token: 'a'.repeat(64) }));
    assert.equal(host.server.sent.find(message => message.type === 'welcome').role, 'host');
    await room.webSocketMessage(host.server, JSON.stringify({ v: 1, type: 'ping', at: 1234 }));
    assert.equal(host.server.sent.find(message => message.type === 'pong').at, 1234);
    const controller = await open(room);
    await room.webSocketMessage(controller.server, JSON.stringify({ type: 'auth', role: 'controller', token: 'b'.repeat(64) }));
    assert.equal(controller.server.sent.find(message => message.type === 'welcome').sequence, 0);
    await room.webSocketMessage(host.server, JSON.stringify({ v: 1, type: 'start' }));
    await room.webSocketMessage(host.server, JSON.stringify({ v: 1, type: 'snapshot', data: { phase: 'running' } }));
    assert.equal(observer.server.sent.length, 0);
    const payload = { moveX: 0.5, moveY: 0, primaryAction: true, secondaryAction: false, tertiaryAction: false, run: false };
    await room.webSocketMessage(controller.server, JSON.stringify({ v: 1, type: 'input', sequence: 1, payload }));
    assert.ok(host.server.sent.some(message => message.type === 'input' && message.sequence === 1 && message.seat === 1));
    await room.webSocketMessage(controller.server, JSON.stringify({ v: 1, type: 'input', sequence: 1, payload }));
    assert.ok(controller.server.sent.some(message => message.type === 'error' && message.error === 'invalid-input'));
    const controllerReplacement = await open(room);
    await room.webSocketMessage(controllerReplacement.server, JSON.stringify({ type: 'auth', role: 'controller', token: 'b'.repeat(64) }));
    assert.equal(controllerReplacement.server.sent.find(message => message.type === 'welcome').sequence, 1);
    assert.equal(controller.server.closed.code, 4001);
    await room.webSocketMessage(controllerReplacement.server, JSON.stringify({ v: 1, type: 'input', sequence: 1, payload }));
    assert.ok(controllerReplacement.server.sent.some(message => message.type === 'error' && message.error === 'invalid-input'));
    await room.webSocketMessage(controllerReplacement.server, JSON.stringify({ v: 1, type: 'input', sequence: 2, payload }));
    const replacement = await open(room);
    await room.webSocketMessage(replacement.server, JSON.stringify({ type: 'auth', role: 'host', token: 'a'.repeat(64) }));
    const welcome = replacement.server.sent.find(message => message.type === 'welcome');
    assert.equal(welcome.room.phase, 'paused');
    assert.equal(host.server.closed.code, 4001);
    await room.webSocketMessage(replacement.server, JSON.stringify({ v: 1, type: 'resume' }));
    await room.webSocketMessage(controllerReplacement.server, JSON.stringify({ v: 1, type: 'input', sequence: 3, payload: { moveX: 0, moveY: 0, primaryAction: false, secondaryAction: false, tertiaryAction: false, run: false } }));
    await room.webSocketMessage(replacement.server, JSON.stringify({ v: 1, type: 'restart' }));
    assert.equal(JSON.parse(store.sql.record).phase, 'waiting');
    assert.equal(JSON.parse(store.sql.record).slots[1].lastSequence, 3);
  } finally {
    globalThis.Response = oldResponse; globalThis.WebSocketPair = oldPair;
  }
});

test('heartbeat alarm neutralizes stale held input with a safe-release marker', async () => {
  const oldResponse = globalThis.Response; const oldPair = globalThis.WebSocketPair; const oldDate = globalThis.Date;
  const sockets = []; roomStateSockets = sockets; let now = 100_000;
  try {
    globalThis.Response = FakeResponse; globalThis.WebSocketPair = FakePair;
    globalThis.Date = class extends oldDate { static now() { return now; } };
    const room = new ArcadeRoom(context(storage(), sockets), {});
    await setup(room);
    const host = await open(room);
    await room.webSocketMessage(host.server, JSON.stringify({ type: 'auth', role: 'host', token: 'a'.repeat(64) }));
    const controller = await open(room);
    await room.webSocketMessage(controller.server, JSON.stringify({ type: 'auth', role: 'controller', token: 'b'.repeat(64) }));
    await room.webSocketMessage(host.server, JSON.stringify({ v: 1, type: 'start' }));
    await room.webSocketMessage(controller.server, JSON.stringify({ v: 1, type: 'input', sequence: 1, payload: { moveX: 1, moveY: 0, primaryAction: true, secondaryAction: false, tertiaryAction: false, run: false } }));
    now += 2100;
    await room.alarm();
    const neutral = host.server.sent.find(message => message.type === 'input' && message.neutral === true);
    assert.equal(neutral.seat, 1);
    assert.equal(neutral.payload.primaryAction, false);
    assert.equal(neutral.payload.moveX, 0);
  } finally {
    globalThis.Response = oldResponse; globalThis.WebSocketPair = oldPair; globalThis.Date = oldDate;
  }
});

test('controller cancel sends a marked neutral release and rejects replay while running or paused', async () => {
  const oldResponse = globalThis.Response; const oldPair = globalThis.WebSocketPair;
  const sockets = []; roomStateSockets = sockets;
  try {
    globalThis.Response = FakeResponse; globalThis.WebSocketPair = FakePair;
    const room = new ArcadeRoom(context(storage(), sockets), {});
    await setup(room);
    const host = await open(room);
    await room.webSocketMessage(host.server, JSON.stringify({ type: 'auth', role: 'host', token: 'a'.repeat(64) }));
    const controller = await open(room);
    await room.webSocketMessage(controller.server, JSON.stringify({ type: 'auth', role: 'controller', token: 'b'.repeat(64) }));
    await room.webSocketMessage(host.server, JSON.stringify({ v: 1, type: 'start' }));
    await room.webSocketMessage(controller.server, JSON.stringify({ v: 1, type: 'input', sequence: 1, payload: { moveX: 0, moveY: 0, primaryAction: true, secondaryAction: false, tertiaryAction: false, run: false } }));
    await room.webSocketMessage(controller.server, JSON.stringify({ v: 1, type: 'cancel', sequence: 2 }));
    const cancel = host.server.sent.filter(message => message.type === 'input').at(-1);
    assert.equal(cancel.sequence, 2);
    assert.equal(cancel.neutral, true);
    assert.equal(cancel.payload.primaryAction, false);
    await room.webSocketMessage(controller.server, JSON.stringify({ v: 1, type: 'cancel', sequence: 2 }));
    assert.ok(controller.server.sent.some(message => message.error === 'invalid-input'));
    await room.webSocketMessage(host.server, JSON.stringify({ v: 1, type: 'pause' }));
    await room.webSocketMessage(controller.server, JSON.stringify({ v: 1, type: 'cancel', sequence: 3 }));
    assert.equal(host.server.sent.filter(message => message.type === 'input' && message.neutral === true).length, 2);
  } finally {
    globalThis.Response = oldResponse; globalThis.WebSocketPair = oldPair;
  }
});

test('per-seat input flood limit is persisted across Durable Object hydration', async () => {
  const oldResponse = globalThis.Response; const oldPair = globalThis.WebSocketPair; const oldDate = globalThis.Date;
  const sockets = []; roomStateSockets = sockets; let now = 300_000;
  try {
    globalThis.Response = FakeResponse; globalThis.WebSocketPair = FakePair;
    globalThis.Date = class extends oldDate { static now() { return now; } };
    const store = storage(); const room = new ArcadeRoom(context(store, sockets), {});
    await setup(room);
    const host = await open(room);
    await room.webSocketMessage(host.server, JSON.stringify({ type: 'auth', role: 'host', token: 'a'.repeat(64) }));
    const controller = await open(room);
    await room.webSocketMessage(controller.server, JSON.stringify({ type: 'auth', role: 'controller', token: 'b'.repeat(64) }));
    await room.webSocketMessage(host.server, JSON.stringify({ v: 1, type: 'start' }));
    const payload = { moveX: 0, moveY: 0, primaryAction: false, secondaryAction: false, tertiaryAction: false, run: false };
    for (let sequence = 1; sequence <= 31; sequence++) {
      await room.webSocketMessage(controller.server, JSON.stringify({ v: 1, type: 'input', sequence, payload }));
    }
    assert.equal(host.server.sent.filter(message => message.type === 'input').length, 30);
    assert.equal(controller.server.sent.filter(message => message.error === 'rate-limited').length, 1);
    assert.equal(JSON.parse(store.sql.record).slots[1].rateCount, 30);
    const hydrated = new ArcadeRoom(context(store, sockets), {});
    await hydrated.webSocketMessage(controller.server, JSON.stringify({ v: 1, type: 'input', sequence: 31, payload }));
    assert.equal(controller.server.sent.filter(message => message.error === 'rate-limited').length, 2);
  } finally {
    globalThis.Response = oldResponse; globalThis.WebSocketPair = oldPair; globalThis.Date = oldDate;
  }
});

test('hibernated live sockets restore room ownership without a false disconnect', async () => {
  const oldResponse = globalThis.Response; const oldPair = globalThis.WebSocketPair; const oldDate = globalThis.Date;
  const sockets = []; roomStateSockets = sockets;
  let now = 600_000;
  try {
    globalThis.Response = FakeResponse; globalThis.WebSocketPair = FakePair;
    globalThis.Date = class extends oldDate { static now() { return now; } };
    const store = storage(); const room = new ArcadeRoom(context(store, sockets), {});
    await setup(room);
    const host = await open(room);
    await room.webSocketMessage(host.server, JSON.stringify({ type: 'auth', role: 'host', token: 'a'.repeat(64) }));
    const controller = await open(room);
    await room.webSocketMessage(controller.server, JSON.stringify({ type: 'auth', role: 'controller', token: 'b'.repeat(64) }));
    await room.webSocketMessage(host.server, JSON.stringify({ v: 1, type: 'start' }));
    await room.webSocketMessage(controller.server, JSON.stringify({ v: 1, type: 'input', sequence: 1, payload: { moveX: 1, moveY: 0, primaryAction: true, secondaryAction: false, tertiaryAction: false, run: false } }));
    now += 4_000;
    await room.webSocketMessage(host.server, JSON.stringify({ v: 1, type: 'ping', at: now }));
    await room.webSocketMessage(controller.server, JSON.stringify({ v: 1, type: 'ping', at: now }));
    const persisted = JSON.parse(store.sql.record);
    assert.equal(persisted.hostLastSeenAt, now);
    assert.equal(persisted.slots[1].lastSeenAt, now);
    now += 5_000;
    const hydrated = new ArcadeRoom(context(store, sockets), {});
    const response = await hydrated.fetch(new Request('https://room.internal/internal/status'));
    const state = (await response.json()).room;
    assert.ok(host.server.sent.some(message => message.type === 'input' && message.neutral === true));
    await hydrated.alarm();
    assert.ok(host.server.sent.some(message => message.type === 'input' && message.neutral === true));
    assert.equal(state.hostConnected, true);
    assert.equal(state.phase, 'running');
    assert.equal(state.slots[1].connected, true);
    assert.equal(host.server.closed, undefined);
    assert.equal(controller.server.closed, undefined);
  } finally {
    globalThis.Response = oldResponse; globalThis.WebSocketPair = oldPair; globalThis.Date = oldDate;
  }
});

test('recovery neutralizes held actions before the first close callback', async () => {
  const oldResponse = globalThis.Response; const oldPair = globalThis.WebSocketPair;
  const sockets = []; roomStateSockets = sockets;
  try {
    globalThis.Response = FakeResponse; globalThis.WebSocketPair = FakePair;
    const store = storage(); const room = new ArcadeRoom(context(store, sockets), {});
    await setup(room);
    const host = await open(room);
    await room.webSocketMessage(host.server, JSON.stringify({ type: 'auth', role: 'host', token: 'a'.repeat(64) }));
    const controller = await open(room);
    await room.webSocketMessage(controller.server, JSON.stringify({ type: 'auth', role: 'controller', token: 'b'.repeat(64) }));
    await room.webSocketMessage(host.server, JSON.stringify({ v: 1, type: 'start' }));
    await room.webSocketMessage(controller.server, JSON.stringify({ v: 1, type: 'input', sequence: 1, payload: { moveX: 0, moveY: 0, primaryAction: true, secondaryAction: false, tertiaryAction: false, run: false } }));
    const hydrated = new ArcadeRoom(context(store, sockets), {});
    controller.server.readyState = 3;
    await hydrated.webSocketClose(controller.server, 1000, 'closed', true);
    assert.ok(host.server.sent.some(message => message.type === 'input' && message.seat === 1 && message.neutral === true));
  } finally {
    globalThis.Response = oldResponse; globalThis.WebSocketPair = oldPair;
  }
});

test('hibernation does not renew stale host or controller heartbeats', async () => {
  const oldResponse = globalThis.Response; const oldPair = globalThis.WebSocketPair; const oldDate = globalThis.Date;
  const sockets = []; roomStateSockets = sockets; let now = 700_000;
  try {
    globalThis.Response = FakeResponse; globalThis.WebSocketPair = FakePair;
    globalThis.Date = class extends oldDate { static now() { return now; } };
    const store = storage(); const room = new ArcadeRoom(context(store, sockets), {});
    await setup(room);
    const host = await open(room);
    await room.webSocketMessage(host.server, JSON.stringify({ type: 'auth', role: 'host', token: 'a'.repeat(64) }));
    const controller = await open(room);
    await room.webSocketMessage(controller.server, JSON.stringify({ type: 'auth', role: 'controller', token: 'b'.repeat(64) }));
    await room.webSocketMessage(host.server, JSON.stringify({ v: 1, type: 'start' }));
    now += 16_000;
    const hydrated = new ArcadeRoom(context(store, sockets), {});
    await hydrated.alarm();
    assert.deepEqual(host.server.closed, { code: 4000, reason: 'heartbeat-timeout' });
    assert.deepEqual(controller.server.closed, { code: 4000, reason: 'heartbeat-timeout' });
    const state = await (await hydrated.fetch(new Request('https://room.internal/internal/status'))).json();
    assert.equal(state.room.phase, 'paused');
    assert.equal(state.room.hostConnected, false);
    assert.equal(state.room.slots[1].connected, false);
    assert.equal(state.room.slots[1].bot, true);
  } finally {
    globalThis.Response = oldResponse; globalThis.WebSocketPair = oldPair; globalThis.Date = oldDate;
  }
});
