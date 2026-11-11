import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionRoom } from '../party-worker/src/session-room';
import { signSessionSocketTicket } from '../lib/session-socket-ticket';

test('parent notifications require the Worker secret, strict fields, and matching lobby generation', async () => {
  const sent: string[] = [];
  const generation = 'a'.repeat(64);
  const sockets = [generation, 'b'.repeat(64)].map(value => ({
    deserializeAttachment: () => ({ v: 1, code: 'ABCD', generation: value, role: 'host', actor: 'host', tokenHash: 'c'.repeat(64), expiresAt: Date.now() + 10_000 }),
    send: (data: string) => sent.push(data), close: () => undefined,
  } as unknown as WebSocket));
  const state = { getWebSockets: () => sockets } as unknown as DurableObjectState;
  const room = new SessionRoom(state, { PARTY_SECRET: 'secret', SITE_ORIGIN: 'https://callback.test' });
  const request = (authorization: string, body: unknown) => new Request('https://session/notify', { method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await room.fetch(request('Bearer wrong', { version: 2, generation }))).status, 401);
  assert.equal((await room.fetch(request('Bearer secret', { version: 2, generation, code: 'ABCD' }))).status, 400);
  assert.equal((await room.fetch(request('Bearer secret', { version: 2, generation }))).status, 200);
  assert.equal(sent.length, 1);
  assert.deepEqual(JSON.parse(sent[0]!), { type: 'invalidate', version: 2 });
});

test('parent WebSocket rejects missing and expired or forged tickets before accepting a socket', async () => {
  const state = { getWebSockets: () => [], storage: { setAlarm: async () => undefined, deleteAlarm: async () => undefined } } as unknown as DurableObjectState;
  const room = new SessionRoom(state, { PARTY_SECRET: 'secret', SITE_ORIGIN: 'https://callback.test' });
  const missing = await room.fetch(new Request('https://session/socket', { headers: { upgrade: 'websocket' } }));
  assert.equal(missing.status, 401);
  const forged = await room.fetch(new Request('https://session/socket', { headers: { upgrade: 'websocket', 'x-session-code': 'ABCD', 'sec-websocket-protocol': 'callback-session-v1,bad.ticket' } }));
  assert.equal(forged.status, 401);
});

test('same-socket ticket refresh preserves actor binding and per-actor traffic is bounded', async () => {
  const now = Date.now(), prior = { v: 1 as const, code: 'ABCD', generation: 'a'.repeat(64), role: 'host' as const, actor: 'host', tokenHash: 'c'.repeat(64), expiresAt: now + 5000 };
  let attachment: unknown = prior, closed = false; const sent: string[] = [], values = new Map<string, unknown>();
  const socket = { deserializeAttachment: () => attachment, serializeAttachment: (value: unknown) => { attachment = value; }, send: (value: string) => sent.push(value), close: () => { closed = true; } } as unknown as WebSocket;
  const storage = { get: async <T>(key: string) => values.get(key) as T | undefined, put: async (key: string, value: unknown) => { values.set(key, value); }, setAlarm: async () => undefined, deleteAlarm: async () => undefined };
  const state = { getWebSockets: () => [socket], storage } as unknown as DurableObjectState;
  const room = new SessionRoom(state, { PARTY_SECRET: 'secret', SITE_ORIGIN: 'https://callback.test' });
  const ticket = await signSessionSocketTicket({ ...prior, expiresAt: now + 20_000 }, 'secret', now);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 200 });
  try {
    await room.webSocketMessage(socket, JSON.stringify({ type: 'refresh', ticket }));
  } finally { globalThis.fetch = originalFetch; }
  assert.equal(closed, false);
  assert.equal((attachment as typeof prior).tokenHash, prior.tokenHash);
  assert.ok((attachment as typeof prior).expiresAt > prior.expiresAt);
  assert.deepEqual(JSON.parse(sent[0]!), { type: 'refreshed', expiresAt: now + 20_000 });
  for (let index = 0; index < 10; index++) await room.webSocketMessage(socket, JSON.stringify({ type: 'ping', at: now }));
  assert.equal(closed, true);
});
