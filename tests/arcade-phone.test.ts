import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { SESSION_DDL } from '../server/sessions/schema';

interface ApiData { code: string; game: string; seat: number; name: string; lastSeq: number; maxSeats: number; expiresAt: number; serverNow: number; hostAlive: boolean; restored: boolean; status: { paused: boolean }; privateState: unknown; inputs: Array<{ packet: { buttons: number; seq: number } }>; roster: Array<{ seat: number; name: string; occupancyId: string; connected: boolean; stale: boolean; lastSeq: number; inputAgeMs: number | null }>; botEnabled: Record<number, boolean>; activeSeatIds: number[] | null; hostRefreshRequired: boolean; version: number; }

// Real SQLite executes production SQL and transactional D1 batches; no SQL behavior is mocked.
class SqlD1 {
  sql = new DatabaseSync(':memory:');
  prohibitSchemaMutations = false;
  beforeBatch?: () => void | Promise<void>;
  prepare(query: string) {
    if (this.prohibitSchemaMutations && /^\s*(CREATE|ALTER|DROP)\b/i.test(query)) throw new Error('Migration-owned schema mutation during API request');
    // Live D1 v67 rejects the ten-term compound SELECT accepted by Node SQLite.
    // Reproduce that observed limit so atomic seat allocation stays D1 compatible.
    if ((query.match(/\bUNION\s+ALL\s+SELECT\b/gi)?.length ?? 0) >= 9) throw new Error('D1_ERROR: too many terms in compound SELECT: SQLITE_ERROR');
    const db = this.sql;
    let values: Array<string | number | null> = [];
    const statement = {
      bind(...args: Array<string | number | null>) { values = args; return statement; },
      async first<T>() { return (db.prepare(query).get(...values) ?? null) as T | null; },
      async all<T>() { return { results: db.prepare(query).all(...values) as T[] }; },
      execute() { const compiled = db.prepare(query); if (compiled.columns().length) return { success: true, results: compiled.all(...values), meta: { changes: 0 } }; const info = compiled.run(...values); return { success: true, results: [], meta: { changes: Number(info.changes) } }; },
      async run() { return statement.execute(); },
    };
    return statement;
  }
  async batch(statements: Array<{ execute(): unknown }>) {
    const hook = this.beforeBatch; this.beforeBatch = undefined;
    if (hook) await hook();
    this.sql.exec('BEGIN IMMEDIATE');
    try { const result = []; for (const s of statements) result.push(s.execute()); this.sql.exec('COMMIT'); return result; }
    catch (error) { this.sql.exec('ROLLBACK'); throw error; }
  }
}
async function setup(game = 'blind-crown') {
  const serviceModule = await import('../server/arcade-phone/service').catch(() => null);
  assert.ok(serviceModule, 'Phone mailbox service must exist');
  const db = new SqlD1();
  db.sql.exec(readFileSync(new URL('../drizzle/0007_arcade_phone.sql', import.meta.url), 'utf8'));
  db.sql.exec(readFileSync(new URL('../drizzle/0011_arcade_phone_bots.sql', import.meta.url), 'utf8'));
  db.prohibitSchemaMutations = true;
  let time = 100000;
  const service = serviceModule.createPhoneService(db as unknown as D1Database, () => time);
  async function api(path: string, body: unknown = {}, cookie = '', extras: RequestInit = {}) {
    const response = await service.handle(new Request(`https://game.test/api/arcade-phone/${path}`, { method: 'POST', headers: { Origin: 'https://game.test', 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body), ...extras }), path.split('/'));
    const data = await response.json() as ApiData;
    return { response, data, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' };
  }
  const created = await api('create', { game });
  assert.equal(created.response.status, 201);
  const code = created.data.code as string;
  return { db, api, service, code, host: created.cookie, created, advance: (ms: number) => { time += ms; } };
}
const status = { phase: 'playing', paused: false, active: true, text: 'Ready' };
const packet = (seq: number, buttons = 0) => ({ seq, x: 0, y: 0, buttons });

test('host bot preferences are default-on, versioned, empty-seat only, and freeze the sparse active roster at start', async () => {
  const { api, code, host, db } = await setup();
  const initial = await api(`${code}/host`, { status: { ...status, phase: 'lobby', paused: true, active: false } }, host);
  assert.equal(initial.data.version, 1);
  assert.deepEqual(initial.data.botEnabled, Object.fromEntries(Array.from({ length: 10 }, (_, seat) => [seat, true])));
  const off = await api(`${code}/bot`, { seat: 0, enabled: false, version: 1 }, host);
  assert.equal(off.response.status, 200);
  assert.equal(off.data.botEnabled[0], false);
  assert.equal(off.data.version, 2);
  assert.equal((await api(`${code}/bot`, { seat: 0, enabled: false, version: 1 }, host)).response.status, 409, 'stale updates cannot overwrite a newer preference');
  assert.equal((await api(`${code}/bot`, { seat: 10, enabled: true, version: 2 }, host)).response.status, 400);
  assert.equal((await api(`${code}/bot`, { seat: 1, enabled: false, version: 2 })).response.status, 401);
  const one = await api(`${code}/join`, { name: 'One' });
  const notOccupied = await api(`${code}/bot`, { seat: one.data.seat, enabled: false, version: 2 }, host);
  assert.equal(notOccupied.response.status, 409, 'host cannot toggle a phone seat');
  const two = await api(`${code}/join`, { name: 'Two' });
  assert.deepEqual([one.data.seat, two.data.seat], [0, 1]);
  const switched = await api(`${code}/bot`, { seat: 0, enabled: true, version: 2 }, host);
  assert.equal(switched.response.status, 409, 'a currently occupied seat cannot be toggled');
  await api(`${code}/leave`, {}, one.cookie);
  const preferences = db.sql.prepare('SELECT bot_enabled_json FROM arcade_phone_rooms WHERE code=?').get(code)?.bot_enabled_json as string;
  assert.equal(JSON.parse(preferences)['0'], false, 'leaving restores the saved off preference');
  const ready = await api(`${code}/host`, { status: { ...status, phase: 'lobby', paused: true, active: false } }, host);
  const start = await api(`${code}/start`, { version: ready.data.version }, host);
  assert.equal(start.response.status, 200);
  assert.deepEqual(start.data.activeSeatIds, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal((await api(`${code}/bot`, { seat: 0, enabled: true, version: start.data.version }, host)).response.status, 409, 'a started roster is frozen');
});

test('all-bot room starts with two participants; one enabled bot is insufficient and a phone may replace that bot', async () => {
  const { api, code, host } = await setup();
  const first = await api(`${code}/host`, { status: { ...status, phase: 'lobby', paused: true, active: false } }, host);
  const started = await api(`${code}/start`, { version: first.data.version }, host);
  assert.equal(started.response.status, 200);
  assert.ok(Array.isArray(started.data.activeSeatIds));
  assert.equal(started.data.activeSeatIds.length, 10);

  const other = await api('create', { game: 'royal-sumo' });
  const lobby = await api(`${other.data.code}/host`, { status: { ...status, phase: 'lobby', paused: true, active: false } }, other.cookie);
  for (let seat = 1; seat < 10; seat++) assert.equal((await api(`${other.data.code}/bot`, { seat, enabled: false, version: seat }, other.cookie)).response.status, 200);
  const tooFew = await api(`${other.data.code}/start`, { version: lobby.data.version + 9 }, other.cookie);
  assert.equal(tooFew.response.status, 409);
  const human = await api(`${other.data.code}/join`, { name: 'Human' });
  assert.equal(human.data.seat, 0);
  const refreshed = await api(`${other.data.code}/host`, { status: { ...status, phase: 'lobby', paused: true, active: false } }, other.cookie);
  const restoredBot = await api(`${other.data.code}/bot`, { seat: 1, enabled: true, version: refreshed.data.version }, other.cookie);
  const oneHumanOneBot = await api(`${other.data.code}/start`, { version: restoredBot.data.version }, other.cookie);
  assert.equal(oneHumanOneBot.response.status, 200);
  assert.ok(Array.isArray(oneHumanOneBot.data.activeSeatIds));
  assert.deepEqual(oneHumanOneBot.data.activeSeatIds, [0, 1]);

  const replaceRoom = await api('create', { game: 'royal-sumo' });
  const replaceLobby = await api(`${replaceRoom.data.code}/host`, { status: { ...status, phase: 'lobby', paused: true, active: false } }, replaceRoom.cookie);
  const onlyBot = await api(`${replaceRoom.data.code}/bot`, { seat: 0, enabled: false, version: replaceLobby.data.version }, replaceRoom.cookie);
  assert.equal(onlyBot.response.status, 200);
  const joinOverOff = await api(`${replaceRoom.data.code}/join`, { name: 'Replacement' });
  assert.equal(joinOverOff.response.status, 201);
  assert.equal(joinOverOff.data.seat, 0);
});

test('featured phone rooms unlock a frozen roster only after an authenticated native-ready or settled-result transition', async () => {
  const cases = [
    { game: 'royal-sumo', ready: 'menu', result: 'matchend' },
    { game: 'royal-twisted', ready: 'setup', result: 'matchover' },
    { game: 'royal-roller-ruckus', ready: 'setup', result: 'finished' },
    { game: 'royal-scratch-match', ready: 'menu', result: 'results' },
    { game: 'blind-crown', ready: 'lobby', result: 'final' },
  ] as const;
  for (const scenario of cases) {
    const { api, code: roomCode, host: hostCookie } = await setup(scenario.game);
    const initial = await api(`${roomCode}/host`, { status: { ...status, phase: 'lobby', paused: true, active: false } }, hostCookie);
    const started = await api(`${roomCode}/start`, { version: initial.data.version }, hostCookie);
    assert.equal(started.response.status, 200, scenario.game);
    const playing = await api(`${roomCode}/host`, { status: { ...status, phase: 'playing', paused: false, active: true } }, hostCookie);
    assert.ok(Array.isArray(playing.data.activeSeatIds));
    assert.equal((await api(`${roomCode}/bot`, { seat: 9, enabled: false, version: playing.data.version }, hostCookie)).response.status, 409, `${scenario.game} keeps in-match roster frozen`);
    const premature = await api(`${roomCode}/lobby`, { version: playing.data.version }, hostCookie);
    assert.equal(premature.response.status, 409, `${scenario.game} does not unlock during play`);
    assert.equal((await api(`${roomCode}/lobby`, { version: playing.data.version }, '')).response.status, 401, `${scenario.game} lobby reset is host-only`);

    const result = await api(`${roomCode}/host`, { status: { ...status, phase: scenario.result, paused: false, active: true } }, hostCookie);
    const unlocked = await api(`${roomCode}/lobby`, { version: result.data.version }, hostCookie);
    assert.equal(unlocked.response.status, 200, `${scenario.game} settled result unlocks`);
    assert.equal(unlocked.data.activeSeatIds, null);
    const changed = await api(`${roomCode}/bot`, { seat: 9, enabled: false, version: unlocked.data.version }, hostCookie);
    assert.equal(changed.response.status, 200, `${scenario.game} can change bots after result`);
    const rematch = await api(`${roomCode}/start`, { version: changed.data.version }, hostCookie);
    assert.equal(rematch.response.status, 200, `${scenario.game} starts a rematch`);
    assert.deepEqual(rematch.data.activeSeatIds, [0, 1, 2, 3, 4, 5, 6, 7, 8]);

    // A reloaded TV reports its game's actual setup/menu/lobby phase. The
    // frozen list remains enforced until this explicit, versioned transition.
    const restoredTv = await api(`${roomCode}/host`, { status: { ...status, phase: scenario.ready, paused: false, active: false } }, hostCookie);
    const reset = await api(`${roomCode}/lobby`, { version: restoredTv.data.version }, hostCookie);
    assert.equal(reset.response.status, 200, `${scenario.game} restored TV returns to lobby`);
    assert.equal(reset.data.activeSeatIds, null);
    const next = await api(`${roomCode}/start`, { version: reset.data.version }, hostCookie);
    assert.equal(next.response.status, 200, `${scenario.game} restored TV can start again`);
  }
});

test('ten concurrent joins claim unique seats and the eleventh is refused', async () => {
  const { api, code } = await setup();
  const joins = await Promise.all(Array.from({ length: 10 }, (_, i) => api(`${code}/join`, { name: `Phone ${i}` })));
  assert.deepEqual(joins.map(j => j.response.status), Array(10).fill(201));
  assert.deepEqual(joins.map(j => j.data.seat).sort((a, b) => a - b), Array.from({ length: 10 }, (_, i) => i));
  assert.equal((await api(`${code}/join`, { name: 'Eleven' })).response.status, 409);
});
test('room cookies are separate, scoped, HttpOnly, Secure and credentials never enter JSON or plaintext DB', async () => {
  const { api, code, created, db } = await setup();
  const join = await api(`${code}/join`, { name: 'Phone' });
  for (const item of [created, join]) {
    assert.match(item.response.headers.get('set-cookie')!, /HttpOnly/);
    assert.match(item.response.headers.get('set-cookie')!, /Secure/);
    assert.match(item.response.headers.get('set-cookie')!, /SameSite=Strict/);
    assert.match(item.response.headers.get('set-cookie')!, new RegExp(`Path=/api/arcade-phone/${code}`));
    const token = item.cookie.split('=')[1];
    assert.ok(!JSON.stringify(item.data).includes(token));
    assert.ok(!JSON.stringify(db.sql.prepare('SELECT * FROM arcade_phone_rooms').all()).includes(token));
    assert.ok(!JSON.stringify(db.sql.prepare('SELECT * FROM arcade_phone_seats').all()).includes(token));
  }
  assert.notEqual(created.cookie.split('=')[0], join.cookie.split('=')[0]);
});
test('reconnect retains seat and phones cannot impersonate host or another room', async () => {
  const { api, code, host } = await setup();
  const joined = await api(`${code}/join`, { name: 'Phone' });
  const restored = await api(`${code}/join`, { name: 'Renamed' }, joined.cookie);
  assert.equal(restored.data.seat, joined.data.seat);
  assert.equal(restored.data.name, 'Phone');
  assert.equal((await api(`${code}/host`, { status }, joined.cookie)).response.status, 401);
  assert.equal((await api(`${code}/input`, packet(1), host)).response.status, 401);
  assert.equal((await api(`${code}/poll`)).response.status, 401);
  const other = await api('create', { game: 'royal-sumo' });
  assert.equal((await api(`${other.data.code}/poll`, {}, joined.cookie)).response.status, 401);
});
test('ordered press/release survive750ms transport delay and stale sequence is refused', async () => {
  const { api, code, host, advance } = await setup();
  await api(`${code}/host`, { status }, host);
  const join = await api(`${code}/join`, { name: 'Phone' });
  for (const p of [packet(1, 1), packet(2, 0)]) assert.equal((await api(`${code}/input`, p, join.cookie)).response.status, 200);
  assert.equal((await api(`${code}/input`, packet(1, 1), join.cookie)).response.status, 409);
  advance(750);
  const read = await api(`${code}/host`, { status }, host);
  assert.deepEqual(read.data.inputs.map((i: { packet: { buttons: number } }) => i.packet.buttons), [1, 0]);
  assert.equal((await api(`${code}/host`, { status, ack: { [join.data.seat]: { seq: 2, occupancyId: read.data.roster[0].occupancyId } } }, host)).data.inputs.length, 0);
});
test('concurrent sequence updates are CAS protected and queue refuses overflow without losing release', async () => {
  const { api, code, host } = await setup();
  await api(`${code}/host`, { status }, host);
  const join = await api(`${code}/join`, { name: 'Phone' });
  const race = await Promise.all([api(`${code}/input`, packet(1, 1), join.cookie), api(`${code}/input`, packet(1, 1), join.cookie)]);
  assert.deepEqual(race.map(r => r.response.status).sort(), [200, 409]);
  for (let i = 2; i <= 64; i++) assert.equal((await api(`${code}/input`, packet(i, 1), join.cookie)).response.status, 200);
  assert.equal((await api(`${code}/input`, packet(65), join.cookie)).response.status, 429);
  assert.equal((await api(`${code}/poll`, {}, join.cookie)).data.lastSeq, 64);
  assert.equal((await api(`${code}/host`, { status }, host)).data.inputs.length, 64);
  const read = await api(`${code}/host`, { status }, host);
  await api(`${code}/host`, { status, ack: { [join.data.seat]: { seq: 64, occupancyId: read.data.roster[0].occupancyId } } }, host);
  assert.equal((await api(`${code}/input`, packet(65), join.cookie)).response.status, 200);
});
test('five active phones receive only their occupancy-bound private state', async () => {
  const { api, code, host } = await setup();
  const phones = await Promise.all(Array.from({ length: 5 }, (_, index) => api(`${code}/join`, { name: `Phone ${index}` })));
  const initial = await api(`${code}/host`, { status }, host);
  const states = Object.fromEntries(phones.map((phone, index) => [phone.data.seat, { occupancyId: initial.data.roster.find(row => row.seat === phone.data.seat)!.occupancyId, state: { secret: `board-${index}` } }]));
  const response = await api(`${code}/host`, { status, privateStates: states }, host);
  assert.ok(!JSON.stringify(response.data).includes('board-0'));
  for (let index = 0; index < phones.length; index += 1) {
    const poll = await api(`${code}/poll`, {}, phones[index]!.cookie);
    assert.deepEqual(poll.data.privateState, { secret: `board-${index}` });
    assert.ok(!JSON.stringify(poll.data).includes('occupancyId'));
    assert.ok(!JSON.stringify(poll.data).includes(`board-${(index + 1) % phones.length}`));
    assert.ok(!('roster' in poll.data));
  }
  assert.equal((await api(`${code}/poll`, {}, host)).response.status, 401);
});
test('leaving clears the old phone private board before a replacement claims that seat', async () => {
  const { api, code, host, db } = await setup();
  await api(`${code}/host`, { status }, host);
  const first = await api(`${code}/join`, { name: 'Same Name' });
  const snapshot = await api(`${code}/host`, { status }, host);
  const occupancyId = snapshot.data.roster[0].occupancyId;
  await api(`${code}/host`, { status, privateStates: { [first.data.seat]: { occupancyId, state: { plan: 'A secret plan' } } } }, host);
  assert.deepEqual((await api(`${code}/poll`, {}, first.cookie)).data.privateState, { plan: 'A secret plan' });

  assert.equal((await api(`${code}/leave`, {}, first.cookie)).response.status, 200);
  const stored = db.sql.prepare('SELECT private_states_json FROM arcade_phone_rooms WHERE code=?').get(code)?.private_states_json as string;
  assert.deepEqual(JSON.parse(stored), {});
  const replacement = await api(`${code}/join`, { name: 'Same Name' });
  assert.equal(replacement.data.seat, first.data.seat);
  assert.equal((await api(`${code}/poll`, {}, replacement.cookie)).data.privateState, null);
});
test('legacy seat-keyed private state is not disclosed without an occupancy binding', async () => {
  const { api, code, db } = await setup();
  db.sql.prepare('UPDATE arcade_phone_rooms SET private_states_json=? WHERE code=?').run(JSON.stringify({ 0: { secret: 'legacy-board' } }), code);
  const phone = await api(`${code}/join`, { name: 'Replacement' });
  assert.equal(phone.data.seat, 0);
  assert.equal(phone.data.privateState, null);
  assert.ok(!JSON.stringify(phone.data).includes('legacy-board'));
});
test('in-flight host private state cannot repopulate a departed occupancy after read and before D1 batch', async () => {
  const { db, api, code, host } = await setup();
  await api(`${code}/host`, { status }, host);
  const first = await api(`${code}/join`, { name: 'Fast private replacement' });
  const snapshot = await api(`${code}/host`, { status }, host);
  const oldOccupancy = snapshot.data.roster[0].occupancyId as string;
  let replacementCookie = '';
  db.beforeBatch = async () => {
    assert.equal((await api(`${code}/leave`, {}, first.cookie)).response.status, 200);
    const replacement = await api(`${code}/join`, { name: 'Fast private replacement' });
    assert.equal(replacement.data.seat, first.data.seat);
    replacementCookie = replacement.cookie;
    assert.equal((await api(`${code}/poll`, {}, replacement.cookie)).data.privateState, null);
  };

  const stale = await api(`${code}/host`, { status, privateStates: { [first.data.seat]: { occupancyId: oldOccupancy, state: { plan: 'A secret plan' } } } }, host);
  assert.equal(stale.response.status, 200);
  assert.equal((await api(`${code}/poll`, {}, replacementCookie)).data.privateState, null);
});
test('transport keeps input through1500ms then expires it independently of3sec disconnect and8sec host timeout', async () => {
  const { api, code, host, advance } = await setup();
  await api(`${code}/host`, { status }, host);
  const join = await api(`${code}/join`, { name: 'Phone' });
  await api(`${code}/input`, packet(1, 1), join.cookie);
  advance(750);
  const delayed = await api(`${code}/host`, { status }, host);
  assert.deepEqual(delayed.data.inputs.map(input => input.packet.buttons), [1]);
  assert.equal(delayed.data.roster[0].stale, false);
  advance(750);
  const boundary = await api(`${code}/host`, { status }, host);
  assert.deepEqual(boundary.data.inputs.map(input => input.packet.buttons), [1]);
  assert.equal(boundary.data.roster[0].stale, false);
  advance(1);
  const stale = await api(`${code}/host`, { status }, host);
  assert.deepEqual(stale.data.inputs, []);
  assert.equal(stale.data.roster[0].stale, true);
  advance(1500);
  assert.equal((await api(`${code}/host`, { status }, host)).data.roster[0].connected, false);
  advance(8001);
  const poll = await api(`${code}/poll`, {}, join.cookie);
  assert.equal(poll.data.hostAlive, false);
  assert.equal(poll.data.status.paused, true);
  assert.equal((await api(`${code}/input`, packet(2, 1), join.cookie)).response.status, 409);
});
test('pause purges held input and host cannot accidentally redeliver paused edges', async () => {
  const { api, code, host } = await setup();
  await api(`${code}/host`, { status }, host);
  const join = await api(`${code}/join`, { name: 'Phone' });
  await api(`${code}/input`, packet(1, 1), join.cookie);
  assert.equal((await api(`${code}/host`, { status: { ...status, paused: true } }, host)).data.inputs.length, 0);
  assert.equal((await api(`${code}/input`, packet(2, 1), join.cookie)).response.status, 409);
});
test('close invalidates all credentials and expiry rejects controls', async () => {
  const { api, code, host, advance } = await setup();
  const join = await api(`${code}/join`, { name: 'Phone' });
  assert.equal((await api(`${code}/close`, {}, join.cookie)).response.status, 401);
  assert.equal((await api(`${code}/close`, {}, host)).response.status, 200);
  assert.equal((await api(`${code}/poll`, {}, join.cookie)).response.status, 404);
  assert.equal((await api(`${code}/host`, { status }, host)).response.status, 404);
  const other = await api('create', { game: 'royal-sumo' });
  advance(6 * 60 * 60 * 1000 + 1);
  assert.equal((await api(`${other.data.code}/join`, { name: 'Late' })).response.status, 404);
});
test('strict schemas reject unknown fields, invalid bounds, game IDs and oversize private states', async () => {
  const { api, code, host } = await setup();
  assert.equal((await api('create', { game: 'fake' })).response.status, 400);
  const join = await api(`${code}/join`, { name: 'Phone' });
  for (const p of [{ ...packet(1), x: 2 }, { ...packet(1), buttons: 16 }, { ...packet(1), seat: 9 }, { ...packet(1), seq: 1.1 }, { ...packet(1), plan: { x: 1.1, y: 0, a: 0, locked: true } }]) assert.equal((await api(`${code}/input`, p, join.cookie)).response.status, 400);
  assert.equal((await api(`${code}/host`, { status: { ...status, score: 1 } }, host)).response.status, 400);
  assert.equal((await api(`${code}/host`, { status, privateStates: { 0: { data: 'a'.repeat(8193) } } }, host)).response.status, 400);
});
test('unknown endpoints, methods, cross-origin and oversized bodies fail closed', async () => {
  const { api, code } = await setup();
  assert.equal((await api(`${code}/unknown`)).response.status, 404);
  assert.equal((await api('create', { game: 'royal-sumo' }, '', { method: 'GET', body: undefined })).response.status, 405);
  assert.equal((await api('create', { game: 'royal-sumo' }, '', { headers: { Origin: 'https://evil.test', 'Content-Type': 'application/json' } })).response.status, 403);
  assert.equal((await api('create', { game: 'royal-sumo', extra: 'x'.repeat(13000) })).response.status, 413);
});
test('versioned phone migration creates only its three isolated tables', async () => {
  const migration = readFileSync(new URL('../drizzle/0007_arcade_phone.sql', import.meta.url), 'utf8');
  const db = new DatabaseSync(':memory:');
  db.exec(migration);
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all().map(r => r.name), ['arcade_phone_inputs', 'arcade_phone_rooms', 'arcade_phone_seats']);
  db.close();
});

test('phone bot migration preserves v0007 rooms and defaults legacy seats on without freezing a roster', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../drizzle/0007_arcade_phone.sql', import.meta.url), 'utf8'));
  db.exec("INSERT INTO arcade_phone_rooms(code, game, host_token_hash, status_json, host_seen_at, expires_at) VALUES ('ABCD', 'royal-sumo', 'legacy-host', '{\"phase\":\"lobby\",\"active\":false}', 0, 100)");
  db.exec(readFileSync(new URL('../drizzle/0011_arcade_phone_bots.sql', import.meta.url), 'utf8'));
  const row = db.prepare("SELECT bot_enabled_json, active_seats_json, version FROM arcade_phone_rooms WHERE code='ABCD'").get();
  assert.ok(row);
  assert.equal(Object.keys(JSON.parse(String(row.bot_enabled_json))).length, 10);
  assert.ok(Object.values(JSON.parse(String(row.bot_enabled_json))).every(enabled => enabled === true));
  assert.equal(row.active_seats_json, null);
  assert.equal(row.version, 1);
  assert.match(SESSION_DDL[0], /bot_enabled_json/);
  assert.match(SESSION_DDL[0], /active_seats_json/);
  db.close();
});

test('lost host response replays pending edges until acknowledged and acknowledgement preserves new arrival', async () => {
  const { api, code, host } = await setup();
  await api(`${code}/host`, { status }, host);
  const joined = await api(`${code}/join`, { name: 'Phone' });
  await api(`${code}/input`, packet(1, 1), joined.cookie);
  const first = await api(`${code}/host`, { status }, host);
  assert.equal(first.data.inputs.length, 1);
  const replay = await api(`${code}/host`, { status }, host);
  assert.deepEqual(replay.data.inputs, first.data.inputs);
  await api(`${code}/input`, packet(2, 0), joined.cookie);
  const next = await api(`${code}/host`, { status, ack: { [joined.data.seat]: { seq: 1, occupancyId: first.data.roster[0].occupancyId } } }, host);
  assert.deepEqual(next.data.inputs.map(i => i.packet.buttons), [0]);
  assert.equal((await api(`${code}/host`, { status, ack: { [joined.data.seat]: { seq: 2, occupancyId: next.data.roster[0].occupancyId } } }, host)).data.inputs.length, 0);
});

test('stale occupancy acknowledgement cannot delete a replacement phone input at the same seat', async () => {
  const { api, code, host } = await setup();
  await api(`${code}/host`, { status }, host);
  const oldPhone = await api(`${code}/join`, { name: 'Same Name' });
  for (let seq = 1; seq <= 10; seq++) assert.equal((await api(`${code}/input`, packet(seq, seq % 2), oldPhone.cookie)).response.status, 200);
  const oldSnapshot = await api(`${code}/host`, { status }, host);
  const oldOccupancy = oldSnapshot.data.roster[0].occupancyId as string;
  assert.match(oldOccupancy, /^[a-f0-9]{64}$/);
  assert.notEqual(oldOccupancy, oldPhone.cookie.split('=')[1]);
  assert.equal(oldSnapshot.data.inputs.length, 10);

  assert.equal((await api(`${code}/leave`, {}, oldPhone.cookie)).response.status, 200);
  const replacement = await api(`${code}/join`, { name: 'Same Name' });
  assert.equal(replacement.data.seat, oldPhone.data.seat);
  assert.equal((await api(`${code}/input`, packet(1, 1), replacement.cookie)).response.status, 200);

  const next = await api(`${code}/host`, { status, ack: { [oldPhone.data.seat]: { seq: 10, occupancyId: oldOccupancy } } }, host);
  assert.equal(next.response.status, 200);
  assert.equal(next.data.roster[0].name, 'Same Name');
  assert.notEqual(next.data.roster[0].occupancyId, oldOccupancy);
  assert.deepEqual(next.data.inputs.map((input: { packet: { seq: number } }) => input.packet.seq), [1]);
});

test('occupancy acknowledgement delete is guarded against phone replacement between read and D1 batch', async () => {
  const { db, api, code, host } = await setup();
  await api(`${code}/host`, { status }, host);
  const oldPhone = await api(`${code}/join`, { name: 'Fast replacement' });
  await api(`${code}/input`, packet(1, 1), oldPhone.cookie);
  const oldSnapshot = await api(`${code}/host`, { status }, host);
  const oldOccupancy = oldSnapshot.data.roster[0].occupancyId as string;

  db.beforeBatch = async () => {
    assert.equal((await api(`${code}/leave`, {}, oldPhone.cookie)).response.status, 200);
    const replacement = await api(`${code}/join`, { name: 'Fast replacement' });
    assert.equal(replacement.data.seat, oldPhone.data.seat);
    assert.equal((await api(`${code}/input`, packet(1, 1), replacement.cookie)).response.status, 200);
  };
  const response = await api(`${code}/host`, { status, ack: { [oldPhone.data.seat]: { seq: 1, occupancyId: oldOccupancy } } }, host);

  assert.equal(response.response.status, 200);
  assert.notEqual(response.data.roster[0].occupancyId, oldOccupancy);
  assert.deepEqual(response.data.inputs.map((input: { packet: { seq: number } }) => input.packet.seq), [1]);
});

test('legacy numeric acknowledgements never clear input without occupancy and request a TV refresh', async () => {
  const { api, code, host } = await setup();
  await api(`${code}/host`, { status }, host);
  const phone = await api(`${code}/join`, { name: 'Phone' });
  await api(`${code}/input`, packet(1, 1), phone.cookie);

  const response = await api(`${code}/host`, { status, ack: { [phone.data.seat]: 1 } }, host);
  assert.equal(response.response.status, 200);
  assert.equal(response.data.hostRefreshRequired, true);
  assert.deepEqual(response.data.inputs.map((input: { packet: { seq: number } }) => input.packet.seq), [1]);
});

test('host accepts ten private boards within isolated 96KiB body and each 8KiB state limit', async () => {
  const { api, code, host } = await setup();
  const states = Object.fromEntries(Array.from({ length: 10 }, (_, seat) => [seat, { board: 'x'.repeat(7000) }]));
  assert.equal((await api(`${code}/host`, { status, privateStates: states }, host)).response.status, 200);
  assert.equal((await api(`${code}/host`, { status, extra: 'x'.repeat(100000) }, host)).response.status, 413);
});

// Pause exactly after initial auth, at the awaited JSON body read, without timers.
function delayedRequest(service: { handle(request: Request, path: string[]): Promise<Response> }, path: string, body: unknown, cookie: string) {
  let signalRead!: () => void;
  let release!: () => void;
  const entered = new Promise<void>(resolve => { signalRead = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const request = new Request(`https://game.test/api/arcade-phone/${path}`, { method: 'POST', headers: { Origin: 'https://game.test', 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });
  if (path.endsWith('/host')) {
    const stream = request.body!;
    const reader = stream.getReader();
    const read = reader.read.bind(reader);
    reader.read = async () => { signalRead(); await gate; return read(); };
    stream.getReader = (() => reader) as typeof stream.getReader;
  } else {
    const text = request.text.bind(request);
    request.text = async () => { signalRead(); await gate; return text(); };
  }
  const result = service.handle(request, path.split('/'));
  return { entered, release, result };
}
function mailboxRows(db: SqlD1) {
  return ['arcade_phone_rooms', 'arcade_phone_seats', 'arcade_phone_inputs'].map(table => db.sql.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all());
}
for (const action of ['host-ack', 'host-pause', 'close', 'input', 'poll', 'join']) {
  test(`delayed ${action} cannot mutate or disclose a replacement room with reused code`, async () => {
    const { db, api, service, code, host } = await setup();
    const joined = await api(`${code}/join`, { name: 'Old phone' });
    const oldHostSnapshot = await api(`${code}/host`, { status }, host);
    const pathAction = action.startsWith('host') ? 'host' : action;
    const body = action === 'host-ack' ? { status, ack: { 0: { seq: 100, occupancyId: oldHostSnapshot.data.roster[0].occupancyId } }, privateStates: { 0: { secret: 'old-host' } } }
      : action === 'host-pause' ? { status: { ...status, paused: true } }
      : action === 'input' ? packet(2, 1) : action === 'join' ? { name: 'Old reconnect' } : {};
    const pending = delayedRequest(service, `${code}/${pathAction}`, body, action.startsWith('host') || action === 'close' ? host : joined.cookie);
    await pending.entered;
    await api(`${code}/close`, {}, host);
    // Deterministically simulate creation cleanup plus random-code collision.
    const { sha256Hex } = await import('../server/crypto');
    const { randomToken } = await import('../lib/game/random');
    const replacementToken = randomToken();
    db.sql.prepare('DELETE FROM arcade_phone_rooms WHERE code = ?').run(code);
    db.sql.prepare('INSERT INTO arcade_phone_rooms(code, game, host_token_hash, status_json, private_states_json, host_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(code, 'blind-crown', await sha256Hex(replacementToken), JSON.stringify(status), JSON.stringify({ 0: { secret: 'replacement-only' } }), 100000, 1000000);
    const replacement = await api(`${code}/join`, { name: 'Replacement phone' });
    assert.equal(replacement.response.status, 201);
    await api(`${code}/input`, packet(1, 1), replacement.cookie);
    // A stale packet proves even cleanup deletes need generation/credential guards.
    db.sql.prepare('INSERT INTO arcade_phone_inputs(room_code, seat, seq, packet_json, received_at) VALUES (?, 0, 0, ?, 98000)').run(code, JSON.stringify(packet(0)));
    const before = mailboxRows(db);
    pending.release();
    const response = await pending.result;
    const responseText = await response.text();
    assert.ok(response.status === 401 || response.status === 404, `expected invalidated request, got ${response.status}: ${responseText}`);
    assert.ok(!responseText.includes('Replacement phone') && !responseText.includes('replacement-only'));
    assert.deepEqual(mailboxRows(db), before, 'invalidated request changed replacement mailbox');
  });
}

test('delayed input cannot act on a replacement seat token within the same room generation', async () => {
  const { db, api, service, code, host } = await setup();
  await api(`${code}/host`, { status }, host);
  const old = await api(`${code}/join`, { name: 'Old seat' });
  const pending = delayedRequest(service, `${code}/input`, packet(2, 1), old.cookie);
  await pending.entered;
  db.sql.prepare("UPDATE arcade_phone_seats SET token_hash = 'replacement-seat-hash', name = 'New seat' WHERE room_code = ? AND seat = 0").run(code);
  db.sql.prepare('INSERT INTO arcade_phone_inputs(room_code, seat, seq, packet_json, received_at) VALUES (?, 0, 0, ?, 98000)').run(code, JSON.stringify(packet(0)));
  const before = mailboxRows(db);
  pending.release();
  assert.equal((await pending.result).status, 401);
  assert.deepEqual(mailboxRows(db), before);
});

test('phone migration matches journal, snapshot, constraints and clean/upgrade chains without old table changes', () => {
  const migrationRoot = new URL('../drizzle/', import.meta.url);
  const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', migrationRoot), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
  assert.equal(journal.entries.find(entry=>entry.idx===7)?.tag, '0007_arcade_phone');
  assert.equal(journal.entries.filter(entry => entry.idx === 7).length, 1);
  assert.deepEqual(readdirSync(migrationRoot).filter(name => name.startsWith('0007_')), ['0007_arcade_phone.sql']);
  const migration = readFileSync(new URL('0007_arcade_phone.sql', migrationRoot), 'utf8');
  assert.ok(!/CREATE TABLE [`"]?(?:arcade_matches|arcade_score_events|history_matches|history_media)/.test(migration));
  assert.match(migration, /CREATE UNIQUE INDEX `idx_arcade_phone_seat_token`/);
  const snapshot = JSON.parse(readFileSync(new URL('meta/0007_snapshot.json', migrationRoot), 'utf8')) as { tables: Record<string, { columns: Record<string, unknown>; indexes: Record<string, { columns: string[] }>; checkConstraints: Record<string, unknown>; foreignKeys: Record<string, unknown> }> };
  const previousMigrations = readdirSync(migrationRoot).filter(name => /^000[0-6]_.*\.sql$/.test(name)).sort();
  for (const mode of ['clean', 'upgrade']) {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    for (const name of previousMigrations) db.exec(readFileSync(new URL(name, migrationRoot), 'utf8'));
    if (mode === 'upgrade') db.exec("INSERT INTO feedback_votes(event_key, pair_id, choice_id) VALUES ('legacy-proof', 'pair', 'choice')");
    const oldSchema = db.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'table' ORDER BY name").all();
    db.exec(migration);
    assert.deepEqual(db.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'arcade_phone_%' ORDER BY name").all(), oldSchema);
    if (mode === 'upgrade') assert.equal(db.prepare("SELECT choice_id FROM feedback_votes WHERE event_key = 'legacy-proof'").get()?.choice_id, 'choice');
    for (const tableName of ['arcade_phone_rooms', 'arcade_phone_seats', 'arcade_phone_inputs']) {
      const tableSnapshot = snapshot.tables[tableName];
      assert.ok(tableSnapshot);
      assert.deepEqual(db.prepare(`PRAGMA table_info('${tableName}')`).all().map(row => String(row.name)).sort(), Object.keys(tableSnapshot.columns).sort());
      const tableSql = String(db.prepare('SELECT sql FROM sqlite_schema WHERE name = ?').get(tableName)?.sql);
      for (const name of Object.keys(tableSnapshot.checkConstraints)) assert.ok(tableSql.includes(name));
      const dbIndexes = db.prepare(`PRAGMA index_list('${tableName}')`).all();
      for (const [name, index] of Object.entries(tableSnapshot.indexes)) {
        assert.ok(dbIndexes.some(row => row.name === name));
        assert.deepEqual(db.prepare(`PRAGMA index_info('${name}')`).all().map(row => String(row.name)), index.columns);
      }
      assert.equal(new Set(db.prepare(`PRAGMA foreign_key_list('${tableName}')`).all().map(row => row.id)).size, Object.keys(tableSnapshot.foreignKeys).length);
    }
    db.exec("INSERT INTO arcade_phone_rooms(code, game, host_token_hash, status_json, host_seen_at, expires_at) VALUES ('ABCD', 'blind-crown', 'hash', '{}', 0, 100)");
    assert.throws(() => db.exec("INSERT INTO arcade_phone_seats(room_code, seat, name, token_hash, last_seen_at) VALUES ('ABCD', 10, 'bad', 'bad', 0)"), /CHECK constraint failed/);
    assert.throws(() => db.exec("UPDATE arcade_phone_rooms SET closed = 2 WHERE code = 'ABCD'"), /CHECK constraint failed/);
    db.exec("INSERT INTO arcade_phone_seats(room_code, seat, name, token_hash, last_seen_at) VALUES ('ABCD', 0, 'one', 'seat-hash', 0)");
    assert.throws(() => db.exec("INSERT INTO arcade_phone_seats(room_code, seat, name, token_hash, last_seen_at) VALUES ('ABCD', 1, 'two', 'seat-hash', 0)"), /UNIQUE constraint failed/);
    assert.throws(() => db.exec("INSERT INTO arcade_phone_inputs(room_code, seat, seq, packet_json, received_at) VALUES ('ABCD', 1, 1, '{}', 0)"), /FOREIGN KEY constraint failed/);
    db.exec("INSERT INTO arcade_phone_inputs(room_code, seat, seq, packet_json, received_at) VALUES ('ABCD', 0, 1, '{}', 0)");
    db.exec("DELETE FROM arcade_phone_rooms WHERE code = 'ABCD'");
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM arcade_phone_seats').get()?.count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM arcade_phone_inputs').get()?.count, 0);
    db.close();
  }
});
