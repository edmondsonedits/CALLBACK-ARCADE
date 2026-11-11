import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceFlatterfluffRound, createFlatterfluffMatch, flatterfluffSnapshot, fireFlatterfluffShot,
  getFlatterfluffResult, nextFlatterfluffRound, revealFlatterfluffRound,
} from '../server/arcade/flatterfluff';

const players = ['p1', 'p2', 'p3'];
const start = (seed = 42) => createFlatterfluffMatch({ matchId: 'fluff-1', players, now: 5_000, seed });
const stateOf = (result: ReturnType<typeof fireFlatterfluffShot> | ReturnType<typeof revealFlatterfluffRound> | ReturnType<typeof advanceFlatterfluffRound> | ReturnType<typeof nextFlatterfluffRound>) => {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('Expected successful Flatterfluff mutation');
  return result.state;
};

test('creates deterministic bounded target waves and validates setup', () => {
  const match = start();
  assert.deepEqual(start(), match);
  assert.equal(match.round, 1);
  assert.equal(match.phase, 'aiming');
  assert.equal(match.targets.length, 5);
  assert.equal(match.deadline - match.updatedAt, 12_000);
  assert.ok(match.targets.every((target) => target.x >= 0 && target.x <= 1 && target.y >= 0 && target.y <= 1));
  assert.notDeepEqual(start(43).targets, match.targets);
  assert.throws(() => createFlatterfluffMatch({ matchId: 'bad', players: ['p1', 'p1'], now: 0, seed: 1 }));
  assert.throws(() => createFlatterfluffMatch({ matchId: 'bad', players: [], now: 0, seed: 1 }));
});

test('keeps locked aim private and scores only the chosen player target after reveal', () => {
  const initial = start();
  const target = initial.targets[0]!;
  const locked = stateOf(fireFlatterfluffShot(initial, { matchId: initial.matchId, round: 1, playerId: 'p1', x: target.x, y: target.y, now: initial.updatedAt + 1 }));
  assert.deepEqual(flatterfluffSnapshot(locked, { role: 'player', playerId: 'p1' }).ownShot, { x: target.x, y: target.y });
  for (const viewer of [{ role: 'host' as const }, { role: 'spectator' as const }, { role: 'player' as const, playerId: 'p2' }]) {
    const snapshot = flatterfluffSnapshot(locked, viewer);
    assert.equal(snapshot.submittedCount, 1);
    assert.equal('ownShot' in snapshot, false);
    assert.equal(JSON.stringify(snapshot).includes('"playerId":"p1"'), false);
    assert.equal(Object.hasOwn(snapshot, 'result'), false);
  }
  const revealed = stateOf(revealFlatterfluffRound(locked, { now: locked.updatedAt + 1 }));
  const result = getFlatterfluffResult(revealed);
  assert.equal(result.round, 1);
  assert.equal(result.shots.find((shot) => shot.playerId === 'p1')?.hitTargetId, target.id);
  assert.ok(result.shots.find((shot) => shot.playerId === 'p1')!.points >= target.points);
  assert.deepEqual(result.scores, revealed.scores);
  assert.equal(flatterfluffSnapshot(revealed, { role: 'host' }).result?.shots.length, players.length);
});

test('rejects out-of-bounds, duplicate, stale, and wrong-round aim while allowing only identical retries', () => {
  const initial = start();
  assert.deepEqual(fireFlatterfluffShot(initial, { matchId: initial.matchId, round: 1, playerId: 'p1', x: 1.01, y: 0.5, now: initial.updatedAt + 1 }), { ok: false, code: 'INVALID_INPUT' });
  assert.deepEqual(fireFlatterfluffShot(initial, { matchId: initial.matchId, round: 2, playerId: 'p1', x: 0.5, y: 0.5, now: initial.updatedAt + 1 }), { ok: false, code: 'ROUND_MISMATCH' });
  assert.deepEqual(fireFlatterfluffShot(initial, { matchId: initial.matchId, round: 1, playerId: 'outsider', x: 0.5, y: 0.5, now: initial.updatedAt + 1 }), { ok: false, code: 'UNAUTHORIZED' });
  const locked = stateOf(fireFlatterfluffShot(initial, { matchId: initial.matchId, round: 1, playerId: 'p1', x: 0.25, y: 0.75, now: initial.updatedAt + 1 }));
  const retry = fireFlatterfluffShot(locked, { matchId: initial.matchId, round: 1, playerId: 'p1', x: 0.25, y: 0.75, now: locked.deadline + 1 });
  assert.equal(retry.ok, true);
  if (retry.ok) assert.equal(retry.idempotent, true);
  assert.deepEqual(fireFlatterfluffShot(locked, { matchId: initial.matchId, round: 1, playerId: 'p1', x: 0.3, y: 0.75, now: locked.updatedAt + 1 }), { ok: false, code: 'ALREADY_LOCKED' });
});

test('fills missing fire with safe misses at deadline and supports five rounds and final standings', () => {
  let match = start();
  for (let round = 1; round <= 5; round += 1) {
    const target = match.targets[0]!;
    match = stateOf(fireFlatterfluffShot(match, { matchId: match.matchId, round, playerId: 'p1', x: target.x, y: target.y, now: match.updatedAt + 1 }));
    if (round === 1) {
      assert.deepEqual(advanceFlatterfluffRound(match, { now: match.deadline - 1 }), { ok: false, code: 'TOO_EARLY' });
      match = stateOf(advanceFlatterfluffRound(match, { now: match.deadline }));
      assert.equal(match.results[0]?.outcome, 'timeout');
      assert.equal(match.results[0]?.shots.find((shot) => shot.playerId === 'p2')?.timedOut, true);
    } else match = stateOf(revealFlatterfluffRound(match, { now: match.updatedAt + 1 }));
    if (round < 5) match = stateOf(nextFlatterfluffRound(match, { now: match.updatedAt + 1 }));
  }
  assert.equal(match.phase, 'complete');
  assert.equal(match.results.length, 5);
  assert.deepEqual(getFlatterfluffResult(match).winners, ['p1']);
});

test('rejects corrupted persisted target and score state before exposing snapshots', () => {
  const match = start();
  const malformed = structuredClone(match);
  malformed.targets[0]!.x = 3;
  assert.throws(() => flatterfluffSnapshot(malformed, { role: 'host' }));

  const badScore = structuredClone(match);
  badScore.scores.p1 = 250;
  assert.throws(() => flatterfluffSnapshot(badScore, { role: 'host' }));

  const revealed = stateOf(revealFlatterfluffRound(match, { now: match.updatedAt + 1 }));
  revealed.results[0]!.scores.p1 = 500;
  assert.throws(() => flatterfluffSnapshot(revealed, { role: 'host' }));
});
