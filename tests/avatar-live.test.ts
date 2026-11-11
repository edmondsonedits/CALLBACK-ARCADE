import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { AVATAR_POSE_DDL } from '../server/avatar/schema';
import { AvatarPoseService } from '../server/avatar/service';
import { avatarPoseRequestSchema, type AvatarPoseSnapshot } from '../lib/avatar-live';
import { NEUTRAL_POSE } from '../lib/avatar-pose';

function setup() {
  let now = 1000;
  const sqlite = new DatabaseSync(':memory:'); for (const ddl of AVATAR_POSE_DDL) sqlite.exec(ddl);
  const prepare = (sql: string, args: unknown[] = []): D1PreparedStatement => ({
    bind: (...values: unknown[]) => prepare(sql, values),
    all: async () => ({ results: sqlite.prepare(sql).all(...args as never[]) }),
    run: async () => { const r = sqlite.prepare(sql).run(...args as never[]); return { meta: { changes: Number(r.changes) } }; },
  }) as unknown as D1PreparedStatement;
  const service = new AvatarPoseService({ prepare } as D1Database, () => now);
  return { service, sqlite, time: (n: number) => { now = n; } };
}
const request = (sequence: number, fields = {}, origin = 'https://game.test') => new Request('https://game.test/avatar-poses', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ sequence, pose: { ...NEUTRAL_POSE, leftElbow: 60 }, ...fields }),
});
const snapshotOf = async (service: AvatarPoseService, scope: string, ids: string[]) =>
  await (await service.snapshot(scope, ids)).json() as AvatarPoseSnapshot;

test('transient schema rejects actor IDs, unknown joints, nonfinite and excessive transforms', () => {
  assert.ok(avatarPoseRequestSchema.safeParse({ sequence: 1, pose: NEUTRAL_POSE }).success);
  for (const input of [
    { sequence: 1, pose: NEUTRAL_POSE, playerId: 'other' },
    { sequence: 1, pose: { ...NEUTRAL_POSE, hacked: 1 } },
    { sequence: 1, pose: { ...NEUTRAL_POSE, leftElbow: Infinity } },
    { sequence: 1, pose: { ...NEUTRAL_POSE, x: 33 } },
    { sequence: Number.MAX_SAFE_INTEGER + 1, pose: NEUTRAL_POSE },
  ]) assert.equal(avatarPoseRequestSchema.safeParse(input).success, false);
});

test('latest pose is isolated by authenticated actor and scope; stale packets cannot replace it', async () => {
  const h = setup();
  assert.equal((await h.service.publish(request(10), 'room:one', 'alice')).status, 204);
  await h.service.publish(request(9, { pose: { ...NEUTRAL_POSE, head: 20 } }), 'room:one', 'alice');
  await h.service.publish(request(12), 'room:two', 'bob');
  const snapshot = await snapshotOf(h.service, 'room:one', ['alice']);
  assert.equal(snapshot.poses.length, 1); assert.equal(snapshot.poses[0].playerId, 'alice');
  assert.equal(snapshot.poses[0].sequence, 10); assert.equal(snapshot.poses[0].pose.head, 0);
  assert.deepEqual((await snapshotOf(h.service, 'room:one', ['bob'])).poses, []);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM avatar_live_poses').get()!.n, 2);
});

test('disconnect expiry returns to neutral, permits reconnect sequences, and never persists history', async () => {
  const h = setup(); await h.service.publish(request(900), 'session:one', 'alice');
  h.time(4000); assert.deepEqual((await snapshotOf(h.service, 'session:one', ['alice'])).poses, []);
  await h.service.publish(request(1), 'session:one', 'alice');
  const snapshot = await snapshotOf(h.service, 'session:one', ['alice']);
  assert.equal(snapshot.poses[0].sequence, 1); assert.equal(snapshot.poses[0].expiresAt, 7000);
  assert.deepEqual(Object.keys(snapshot).sort(), ['poses', 'serverTime']);
});

test('foreign origin and actor spoofing are rejected before storage', async () => {
  const h = setup();
  assert.equal((await h.service.publish(request(1, {}, 'https://other.test'), 'one', 'alice')).status, 403);
  assert.equal((await h.service.publish(request(1, { playerId: 'bob' }), 'one', 'alice')).status, 422);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM avatar_live_poses').get()!.n, 0);
});

test('removed players cannot crowd an authenticated snapshot out of its ten slots', async () => {
  const h = setup();
  for (let i = 0; i < 10; i++) await h.service.publish(request(1), 'one', `removed-${i}`);
  await h.service.publish(request(1), 'one', 'active');
  assert.equal((await snapshotOf(h.service, 'one', ['active'])).poses[0]?.playerId, 'active');
  assert.deepEqual((await snapshotOf(h.service, 'one', [])).poses, []);
});
