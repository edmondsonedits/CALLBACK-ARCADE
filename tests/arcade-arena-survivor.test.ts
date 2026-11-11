import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceArenaSurvivor, arenaSurvivorSnapshot, chooseArenaSurvivor, createArenaSurvivorMatch,
  getArenaSurvivorResult, revealArenaSurvivor,
} from '../server/arcade/arena_survivor';

const players = ['p1', 'p2', 'p3', 'p4'];
const setup = (seed = 231) => createArenaSurvivorMatch({ matchId: 'arena-match', players, now: 20_000, seed });
const success = (result: ReturnType<typeof chooseArenaSurvivor> | ReturnType<typeof advanceArenaSurvivor> | ReturnType<typeof revealArenaSurvivor>) => {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('Expected mutation to succeed');
  return result.state;
};

test('creates deterministic three-choice scenarios and validates player bounds', () => {
  const state = setup();
  assert.deepEqual(setup(), state);
  assert.equal(state.phase, 'answering');
  assert.equal(state.deadline - state.updatedAt, 45_000);
  assert.equal(state.scenario.choices.length, 3);
  assert.equal(state.successfulChoiceId, state.scenario.correctChoiceId);
  assert.ok(state.scenario.choices.some(({ id }) => id === state.scenario.correctChoiceId));
  assert.notEqual(setup(232).scenario.id, state.scenario.id);
  assert.throws(() => createArenaSurvivorMatch({ matchId: 'bad', players: ['p1', 'p1', 'p3'], now: 0, seed: 1 }));
  assert.throws(() => createArenaSurvivorMatch({ matchId: 'bad', players: ['p1', 'p2'], now: 0, seed: 1 }));
});

test('rejects a persisted answer that conflicts with the scenario answer key', () => {
  const invalid = structuredClone(setup());
  invalid.successfulChoiceId = invalid.scenario.choices.find(({ id }) => id !== invalid.scenario.correctChoiceId)!.id;
  assert.deepEqual(chooseArenaSurvivor(invalid, { matchId: invalid.matchId, round: 1, playerId: 'p1', choiceId: invalid.successfulChoiceId, now: invalid.updatedAt + 1 }),
    { ok: false, code: 'INVALID_STATE' });
});

test('hides the correct choice and explanation from host, spectators, and players until reveal', () => {
  const state = setup();
  for (const viewer of [{ role: 'host' as const }, { role: 'spectator' as const }, { role: 'player' as const, playerId: 'p1' }]) {
    const snapshot = arenaSurvivorSnapshot(state, viewer);
    assert.equal(Object.hasOwn(snapshot, 'successfulChoiceId'), false);
    assert.equal(Object.hasOwn(snapshot, 'result'), false);
    assert.equal(JSON.stringify(snapshot).includes(state.scenario.explanation), false);
  }
  assert.throws(() => arenaSurvivorSnapshot(state, { role: 'player', playerId: 'outsider' }));
});

test('accepts an equivalent scenario after persistence changes JSON property order', () => {
  const state = setup();
  const persisted = structuredClone(state);
  persisted.scenario = {
    id: state.scenario.id, title: state.scenario.title, description: state.scenario.description, choices: state.scenario.choices,
    correctChoiceId: state.scenario.correctChoiceId, explanation: state.scenario.explanation,
  };
  assert.doesNotThrow(() => arenaSurvivorSnapshot(persisted, { role: 'host' }));
});

test('locks one choice per player and supports identical idempotent retries only', () => {
  const state = setup();
  const choiceId = state.scenario.choices[0]!.id;
  const first = chooseArenaSurvivor(state, { matchId: state.matchId, round: 1, playerId: 'p1', choiceId, now: state.updatedAt + 1 });
  const locked = success(first);
  const retry = chooseArenaSurvivor(locked, { matchId: state.matchId, round: 1, playerId: 'p1', choiceId, now: locked.deadline + 10 });
  assert.equal(retry.ok, true);
  if (retry.ok) assert.equal(retry.idempotent, true);
  assert.deepEqual(chooseArenaSurvivor(locked, { matchId: state.matchId, round: 1, playerId: 'p1', choiceId: state.scenario.choices[1]!.id, now: locked.updatedAt + 1 }),
    { ok: false, code: 'ALREADY_LOCKED' });
  assert.deepEqual(chooseArenaSurvivor(state, { matchId: state.matchId, round: 1, playerId: 'outsider', choiceId, now: state.updatedAt + 1 }),
    { ok: false, code: 'UNAUTHORIZED' });
  assert.deepEqual(chooseArenaSurvivor(state, { matchId: state.matchId, round: 2, playerId: 'p1', choiceId, now: state.updatedAt + 1 }),
    { ok: false, code: 'UNAUTHORIZED' });
});

test('reveals simultaneous choices, winners, per-player scores, and choice totals', () => {
  let state = setup();
  for (const [index, playerId] of players.entries()) {
    const choiceId = index < 2 ? state.successfulChoiceId : state.scenario.choices.find(({ id }) => id !== state.successfulChoiceId)!.id;
    state = success(chooseArenaSurvivor(state, { matchId: state.matchId, round: 1, playerId, choiceId, now: state.updatedAt + 1 }));
  }
  const privateSnapshot = arenaSurvivorSnapshot(state, { role: 'host' });
  assert.equal(privateSnapshot.answerCount, players.length);
  assert.equal(privateSnapshot.result, undefined);
  const revealed = success(revealArenaSurvivor(state, { now: state.updatedAt + 1 }));
  const result = getArenaSurvivorResult(revealed);
  assert.equal(result.correctChoiceId, state.successfulChoiceId);
  assert.deepEqual(result.winners, players.slice(0, 2));
  assert.equal(result.choiceCounts[state.successfulChoiceId], 2);
  assert.deepEqual(result.scores, { p1: 1000, p2: 1000, p3: 0, p4: 0 });
  assert.ok(result.explanation.length > 0);
  assert.deepEqual(arenaSurvivorSnapshot(revealed, { role: 'player', playerId: 'p3' }).result, result);
});

test('timeout reveals partial submissions and assigns zero to players who did not answer', () => {
  let state = setup();
  state = success(chooseArenaSurvivor(state, { matchId: state.matchId, round: 1, playerId: 'p1', choiceId: state.successfulChoiceId, now: state.updatedAt + 1 }));
  assert.deepEqual(advanceArenaSurvivor(state, { now: state.deadline - 1 }), { ok: false, code: 'TOO_EARLY' });
  const result = getArenaSurvivorResult(success(advanceArenaSurvivor(state, { now: state.deadline })));
  assert.equal(result.outcome, 'timeout');
  assert.deepEqual(result.scores, { p1: 1000, p2: 0, p3: 0, p4: 0 });
  assert.equal(result.submissions.find(({ playerId }) => playerId === 'p2')?.choiceId, null);
  assert.equal(result.choiceCounts[state.successfulChoiceId], 1);
});
