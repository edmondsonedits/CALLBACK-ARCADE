import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { OnlineArcadeService } from '../server/arcade/online/service';
import { ONLINE_ARCADE_DDL } from '../server/arcade/online/schema';
import type { OnlineEngine } from '../lib/arcade/online/types';

function database(): D1Database {
  const sqlite = new DatabaseSync(':memory:');
  for (const sql of ONLINE_ARCADE_DDL) sqlite.exec(sql);
  class Statement {
    values: (string | number | null)[] = [];
    constructor(readonly sql: string) {}
    bind(...values: (string | number | null)[]) { this.values = values; return this; }
    async first() { return sqlite.prepare(this.sql).get(...this.values) ?? null; }
    async all() { return { results: sqlite.prepare(this.sql).all(...this.values) }; }
    async run() { const r = sqlite.prepare(this.sql).run(...this.values); return { success: true, meta: { changes: Number(r.changes) } }; }
  }
  return { prepare: (sql: string) => new Statement(sql), async batch(statements: Statement[]) {
    sqlite.exec('BEGIN');
    try { const result = []; for (const s of statements) result.push(await s.run()); sqlite.exec('COMMIT'); return result; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } } as unknown as D1Database;
}
const origin = 'https://bots.test';
const request = (body?: unknown, cookie?: string) => new Request(origin, {
  method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
interface View { botEnabled: Record<string, boolean>; activeIds: string[]; minimumPlayers: number; status: string; version: number; matchId: string; players: { id: string }[]; lastResult: { winners: string[]; scores: Record<string, number> } | null; game: { view: { ids: string[]; bots: string[] } } }
async function setup() {
  let now = 1000;
  const engine: OnlineEngine = {
    id: 'bot-probe', title: 'Bot probe', controls: [],
    create: (ids, _seed, _options, bots) => ({ ids, bots, tick: 0 }),
    step: (value, _inputs, bots) => ({ ...value as object, bots, tick: 1 }),
    publicState: value => {
      const state = value as { ids: string[]; bots: string[]; tick: number };
      return { view: state, finished: state.tick > 0, winners: [...state.ids, '09'], scores: Object.fromEntries([...state.ids, '09'].map(id => [id, 1])) };
    },
  };
  const db = database();
  const service = new OnlineArcadeService(db, id => id === engine.id ? engine : null, () => now);
  const created = await service.create(request({ gameId: engine.id, options: {} }));
  assert.equal(created.status, 201);
  const { code } = await created.json() as { code: string };
  const host = created.headers.get('set-cookie')!.split(';')[0];
  const action = (body: unknown, cookie = host) => service.host(request(body, cookie), code);
  const view = async () => await (await service.snapshot(request(undefined, host), code)).json() as View;
  const set = (seatId: string, enabled: boolean) => action({ operation: 'bot', seatId, enabled });
  const allOff = async () => { for (let index = 0; index < 10; index++) assert.equal((await set(String(index).padStart(2, '0'), false)).status, 200); };
  return { db, service, code, host, action, view, set, allOff, advance: (ms: number) => { now += ms; } };
}

test('bot flags persist; sparse all-bot rounds exclude disabled contestants and their result points', async () => {
  const h = await setup(); await h.allOff();
  await h.set('02', true); await h.set('07', true);
  assert.equal((await h.view()).botEnabled['00'], false);
  const started = await h.action({ operation: 'start' }); assert.equal(started.status, 200);
  const state = await started.json() as View;
  assert.deepEqual(state.activeIds, ['02', '07']);
  assert.deepEqual(state.game.view.ids, ['02', '07']);
  assert.deepEqual(state.game.view.bots, ['02', '07']);
  h.advance(4000); await h.action({ operation: 'tick' });
  const result = await h.view();
  assert.deepEqual(result.lastResult!.winners, ['02', '07']);
  assert.deepEqual(Object.keys(result.lastResult!.scores), ['02', '07']);
  assert.equal((await h.set('02', false)).status, 200);
});

test('zero-bot matches keep phone players and their seats after reconnect and departure', async () => {
  const h = await setup(); await h.allOff();
  const cookies: string[] = [];
  for (const nickname of ['One', 'Two']) {
    const joined = await h.service.join(request({ nickname }), h.code); assert.equal(joined.status, 201);
    cookies.push(joined.headers.get('set-cookie')!.split(';')[0]);
  }
  assert.equal((await h.set('00', true)).status, 409, 'occupied phone seats cannot be configured as bots');
  const started = await (await h.action({ operation: 'start' })).json() as View;
  assert.deepEqual(started.activeIds, ['00', '01']); assert.deepEqual(started.game.view.bots, []);
  h.advance(4000); await h.action({ operation: 'tick' });
  assert.deepEqual((await h.view()).game.view.bots, [], 'disconnected phones do not create unwanted bots');
  const restored = await h.service.join(request({ nickname: 'Same phone' }, cookies[0]), h.code);
  assert.equal(restored.status, 200);
  await h.action({ operation: 'lobby' }); await h.action({ operation: 'remove', seatId: '00' });
  assert.equal((await h.view()).botEnabled['00'], false, 'phone departure restores the saved Off preference');
});

test('bot mutation requires the host and rejects active-round, invalid and insufficient rosters', async () => {
  const h = await setup(); await h.allOff();
  assert.equal((await h.action({ operation: 'start' })).status, 409);
  await h.set('07', true); assert.equal((await h.action({ operation: 'start' })).status, 409);
  await h.set('02', true);
  assert.equal((await h.action({ operation: 'bot', seatId: '02', enabled: false }, '')).status, 401);
  assert.equal((await h.action({ operation: 'bot', seatId: '10', enabled: true })).status, 422);
  assert.equal((await h.action({ operation: 'bot', seatId: '02', enabled: 'false' })).status, 422);
  await h.action({ operation: 'start' });
  assert.equal((await h.set('02', false)).status, 409);
  assert.equal((await h.view()).minimumPlayers, 2);
});

test('phone joins update room versions so start and bot configuration cannot race a changed roster', async () => {
  const h = await setup(); const before = await h.view();
  const joined = await h.service.join(request({ nickname: 'One' }), h.code); assert.equal(joined.status, 201);
  assert.ok((await h.view()).version > before.version);
  const withPhone = await h.view();
  await h.action({ operation: 'remove', seatId: '00' });
  assert.ok((await h.view()).version > withPhone.version);
});

test('a retired bot or replacement phone cannot inherit the previous contestant crowns', async () => {
  const h = await setup(); await h.allOff(); await h.set('00', true); await h.set('07', true);
  await h.action({ operation: 'start' }); h.advance(4000); await h.action({ operation: 'tick' });
  assert.equal((await h.view() as View & { wins: Record<string, number> }).wins['00'], 1);
  await h.set('07', false);
  assert.equal((await h.view() as View & { wins: Record<string, number> }).wins['07'], 0);
  await h.set('07', true);
  assert.equal((await h.view() as View & { wins: Record<string, number> }).wins['07'], 0);
  const joined = await h.service.join(request({ nickname: 'New human' }), h.code); assert.equal(joined.status, 201);
  assert.equal((await h.view() as View & { wins: Record<string, number> }).wins['00'], 0);
});
