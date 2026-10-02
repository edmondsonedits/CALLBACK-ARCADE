import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRoomApi } from '../src/room.ts';

function bindingStub() {
  const calls = [];
  return {
    calls,
    namespace: {
      idFromName: code => code,
      get: code => ({ async fetch(request) {
        const body = request.method === 'POST' ? await request.json() : null;
        calls.push({ code, url: request.url, method: request.method, body });
        if (request.url.endsWith('/internal/create')) return new Response(JSON.stringify({ room: { code, gameId: body.gameId } }), { status: 201 });
        if (request.url.endsWith('/internal/join')) return new Response(JSON.stringify({ code, seat: 1, seatToken: body.token }), { status: 201 });
        return new Response(JSON.stringify({ room: { code } }));
      } }),
    },
  };
}
const catalog = { games: [
  { id: 'royal-sumo', source: { status: 'imported' } },
  { id: 'pending', source: { status: 'awaiting-import' } },
] };

test('room creation only allocates imported catalog games and returns an opaque host credential', async () => {
  const rooms = bindingStub();
  const request = new Request('https://arcade.test/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gameId: 'royal-sumo' }) });
  const result = await handleRoomApi(request, { ROOMS: rooms.namespace, CATALOG: catalog });
  assert.equal(result.status, 201);
  const payload = await result.json();
  assert.match(payload.code, /^[A-Z2-9]{6}$/);
  assert.match(payload.hostToken, /^[a-f0-9]{64}$/);
  assert.equal(payload.gameId, 'royal-sumo');
  assert.equal(rooms.calls[0].url, 'https://room.internal/internal/create');
  assert.equal((await handleRoomApi(new Request('https://arcade.test/api/rooms', { method: 'POST', body: JSON.stringify({ gameId: 'pending' }) }), { ROOMS: rooms.namespace, CATALOG: catalog })).status, 404);
});

test('join supports a private reconnect credential without placing it in a URL', async () => {
  const rooms = bindingStub(); const token = 'a'.repeat(64);
  const request = new Request('https://arcade.test/api/rooms/ABC234/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: ' Pilot ', token }) });
  const result = await handleRoomApi(request, { ROOMS: rooms.namespace, CATALOG: catalog });
  assert.equal(result.status, 201);
  assert.equal(rooms.calls[0].url, 'https://room.internal/internal/join');
  assert.equal(rooms.calls[0].body.token, token);
});

test('join rejects malformed reconnect credentials and socket credentials in query strings', async () => {
  const rooms = bindingStub();
  const bad = await handleRoomApi(new Request('https://arcade.test/api/rooms/ABC234/join', { method: 'POST', body: JSON.stringify({ name: 'P', token: 'short' }) }), { ROOMS: rooms.namespace, CATALOG: catalog });
  assert.equal(bad.status, 400);
  assert.equal(rooms.calls.length, 0);
  const socket = await handleRoomApi(new Request('https://arcade.test/api/rooms/ABC234/socket?token=secret', { headers: { upgrade: 'websocket' } }), { ROOMS: rooms.namespace, CATALOG: catalog });
  assert.equal(socket.status, 400);
  assert.equal(rooms.calls.length, 0);
});
