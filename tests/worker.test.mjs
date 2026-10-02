import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/routes.ts';
const games = [{ id: 'known', title: 'Known', aliases: [], tags: [], description: 'Known', players: { min: 1, max: 2 }, version: '0.1.0', source: { status: 'awaiting-import', paths: [], provenance: 'pending', url: null }, lifecycle: 'intake', multiplayer: { status: 'not-integrated', evidence: [] } }];
const catalog = { version: 1, revision: 'abc', generatedFrom: 'games/*/manifest.json', games };
const unavailable = { CATALOG: catalog, DB: { prepare() { throw new Error('offline'); } } };
test('serves read-only routes and honest unavailable-database fallback health', async () => {
  const list = await handleRequest(new Request('https://arcade.test/api/games'), unavailable);
  assert.equal(list.status, 200);
  assert.equal((await list.json()).games[0].id, 'known');
  assert.equal((await (await handleRequest(new Request('https://arcade.test/api/games/known'), unavailable)).json()).id, 'known');
  assert.equal((await handleRequest(new Request('https://arcade.test/api/games/nope'), unavailable)).status, 404);
  assert.equal((await (await handleRequest(new Request('https://arcade.test/api/health'), unavailable)).json()).database, 'unavailable');
  assert.equal((await handleRequest(new Request('https://arcade.test/api/rooms', { method: 'POST' }), unavailable)).status, 404);
});
test('detects stale but reachable D1 while serving the checked-in catalog', async () => {
  const stale = { CATALOG: catalog, DB: { prepare(query) { return { async first() { return query.includes('catalog_meta') ? { revision: 'old-revision' } : { ok: 1 }; } }; } } };
  const response = await handleRequest(new Request('https://arcade.test/api/health'), stale);
  assert.deepEqual(await response.json(), { status: 'ok', database: 'connected', catalog: 'stale', catalogSource: 'checked-in-repository' });
});
test('treats a reachable database without catalog metadata as stale, not disconnected', async () => {
  const unmigrated = { CATALOG: catalog, DB: { prepare(query) { return { async first() { if (query.includes('catalog_meta')) throw new Error('table missing'); return { ok: 1 }; } }; } } };
  const response = await handleRequest(new Request('https://arcade.test/api/health'), unmigrated);
  assert.deepEqual(await response.json(), { status: 'ok', database: 'connected', catalog: 'stale', catalogSource: 'checked-in-repository' });
});
