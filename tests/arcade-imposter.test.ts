import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createImposterMatch,
  getImposterResult,
  imposterSnapshot,
  advanceImposter,
  submitImposterClue,
  submitImposterVote,
} from '../server/arcade/imposter';

const players = ['p1', 'p2', 'p3', 'p4'];
const setup = (seed = 23) => createImposterMatch({ matchId: 'match-one', players, now: 1_000, seed });
const successState = (result: { ok: boolean; state?: ReturnType<typeof setup> }) => {
  assert.equal(result.ok, true);
  if (!result.ok || !result.state) throw new Error('Expected successful Imposter mutation');
  return result.state;
};
const completeClues = (state: ReturnType<typeof setup>) => {
  for (const playerId of state.players) {
    if (state.clues[playerId] !== undefined) continue;
    const result = submitImposterClue(state, { matchId: state.matchId, round: state.round, playerId, clue: `clue ${playerId}`, now: state.updatedAt + 1 });
    state = successState(result);
  }
  return state;
};

test('creates a deterministic, serializable match with one hidden role and original prompt content', () => {
  const state = setup();
  assert.deepEqual(setup(), state);
  assert.equal(state.phase, 'cluing');
  assert.equal(state.round, 1);
  assert.equal(state.players.length, 4);
  assert.equal(new Set(state.players).size, state.players.length);
  assert.equal(state.roles.filter((role) => role.role === 'imposter').length, 1);
  assert.ok(state.word.trim().length > 0);
  assert.ok(state.category.trim().length > 0);
  assert.doesNotThrow(() => JSON.stringify(state));
  assert.notEqual(setup(24).word, state.word);
  assert.throws(() => createImposterMatch({ matchId: 'bad', players: ['same', 'same', 'p3'], now: 0, seed: 1 }));
  assert.throws(() => createImposterMatch({ matchId: 'bad', players: ['p1', 'p2'], now: 0, seed: 1 }));
});

test('role-filtered snapshots show civilians the word, the imposter only the category, and hide identities from host', () => {
  const state = setup();
  const imposterId = state.roles.find((role) => role.role === 'imposter')!.playerId;
  const civilianId = state.players.find((playerId) => playerId !== imposterId)!;
  const civilian = imposterSnapshot(state, { role: 'player', playerId: civilianId });
  const imposter = imposterSnapshot(state, { role: 'player', playerId: imposterId });
  const host = imposterSnapshot(state, { role: 'host' });
  assert.equal(civilian.assignment?.role, 'civilian');
  assert.equal(civilian.assignment?.word, state.word);
  assert.equal(civilian.assignment?.category, state.category);
  assert.equal(imposter.assignment?.role, 'imposter');
  assert.equal(imposter.assignment?.category, state.category);
  assert.equal(imposter.assignment?.word, undefined);
  assert.equal(host.assignment, undefined);
  assert.equal(JSON.stringify(host).includes(state.word), false);
  assert.deepEqual(host.clues, []);
  assert.throws(() => imposterSnapshot(state, { role: 'player', playerId: 'not-assigned' }));
});

test('clues accept one short entry per active player, support exact retries, and automatically open voting', () => {
  let state = setup();
  const firstPlayer = state.players[0]!;
  const first = submitImposterClue(state, { matchId: state.matchId, round: state.round, playerId: firstPlayer, clue: '  bright  ', now: 1_001 });
  state = successState(first);
  assert.equal(state.clues[firstPlayer], 'bright');
  assert.equal(state.phase, 'cluing');
  const retry = submitImposterClue(state, { matchId: state.matchId, round: 1, playerId: firstPlayer, clue: 'bright', now: state.deadline + 1 });
  assert.equal(retry.ok, true);
  if (retry.ok) {
    assert.equal(retry.idempotent, true);
    assert.equal(retry.state.version, state.version);
  }
  assert.equal(submitImposterClue(state, { matchId: state.matchId, round: 1, playerId: firstPlayer, clue: 'different', now: 1_002 }).ok, false);
  assert.equal(submitImposterClue(state, { matchId: state.matchId, round: 1, playerId: firstPlayer, clue: ' ', now: 1_002 }).ok, false);
  assert.equal(submitImposterClue(state, { matchId: state.matchId, round: 1, playerId: firstPlayer, clue: 'x'.repeat(81), now: 1_002 }).ok, false);
  assert.equal(submitImposterClue(state, { matchId: 'old-match', round: 1, playerId: 'outsider', clue: 'clue', now: 1_002 }).ok, false);
  assert.equal(submitImposterClue(state, { matchId: state.matchId, round: 2, playerId: 'p2', clue: 'clue', now: 1_002 }).ok, false);
  for (const playerId of state.players.slice(1)) {
    state = successState(submitImposterClue(state, { matchId: state.matchId, round: 1, playerId, clue: `clue ${playerId}`, now: state.updatedAt + 1 }));
  }
  assert.equal(state.phase, 'voting');
  assert.ok(state.deadline > state.updatedAt);
  assert.equal(Object.keys(state.clues).length, players.length);
});

test('keeps other clues private until voting starts and hides votes until reveal', () => {
  let state = setup();
  const p1 = state.players[0]!;
  state = successState(submitImposterClue(state, { matchId: state.matchId, round: 1, playerId: p1, clue: 'private clue', now: 1_001 }));
  const hostDuringClues = imposterSnapshot(state, { role: 'host' });
  const otherDuringClues = imposterSnapshot(state, { role: 'player', playerId: state.players[1]! });
  assert.deepEqual(hostDuringClues.clues, []);
  assert.deepEqual(otherDuringClues.clues, []);
  assert.equal(imposterSnapshot(state, { role: 'player', playerId: p1 }).ownClue, 'private clue');
  state = completeClues(state);
  const voting = imposterSnapshot(state, { role: 'host' });
  assert.equal(voting.clues.length, players.length);
  assert.equal(voting.voteCount, 0);
  assert.equal(imposterSnapshot(state, { role: 'player', playerId: p1 }).assignment?.role, state.roles.find((role) => role.playerId === p1)?.role);
});

test('a unique vote for the imposter makes civilians win and exact vote retries are idempotent', () => {
  let state = completeClues(setup());
  const imposterId = state.roles.find((role) => role.role === 'imposter')!.playerId;
  const voters = state.players.filter((playerId) => playerId !== imposterId);
  for (const playerId of voters) {
    state = successState(submitImposterVote(state, { matchId: state.matchId, round: 1, playerId, targetPlayerId: imposterId, now: state.updatedAt + 1 }));
  }
  assert.equal(state.phase, 'voting');
  const retry = submitImposterVote(state, { matchId: state.matchId, round: 1, playerId: voters[0]!, targetPlayerId: imposterId, now: state.updatedAt + 1 });
  assert.equal(retry.ok, true);
  if (retry.ok) assert.equal(retry.idempotent, true);
  const lastVoter = state.players.find((playerId) => !voters.includes(playerId))!;
  state = successState(submitImposterVote(state, { matchId: state.matchId, round: 1, playerId: lastVoter, targetPlayerId: lastVoter === imposterId ? voters[0]! : imposterId, now: state.updatedAt + 1 }));
  assert.equal(state.phase, 'revealed');
  const result = getImposterResult(state);
  assert.equal(result.winner, 'civilians');
  assert.equal(result.imposterId, imposterId);
  const retryAfterReveal = submitImposterVote(state, { matchId: state.matchId, round: 1, playerId: voters[0]!, targetPlayerId: imposterId, now: state.updatedAt + 1 });
  assert.equal(retryAfterReveal.ok, true);
  if (retryAfterReveal.ok) assert.equal(retryAfterReveal.idempotent, true);
  assert.deepEqual(imposterSnapshot(state, { role: 'host' }).result, result);
  assert.deepEqual(getImposterResult(state), result);
});

test('votes reject self-targets and a tied top vote never chooses an arbitrary player', () => {
  let state = completeClues(setup());
  const imposterId = state.roles.find((role) => role.role === 'imposter')!.playerId;
  const civilians = state.players.filter((playerId) => playerId !== imposterId);
  assert.equal(submitImposterVote(state, { matchId: state.matchId, round: 1, playerId: civilians[0]!, targetPlayerId: civilians[0]!, now: state.updatedAt + 1 }).ok, false);
  const targets = ['p2', 'p1', 'p1', 'p2'];
  for (let index = 0; index < state.players.length; index += 1) {
    const playerId = state.players[index]!;
    const targetPlayerId = targets[index]!;
    state = successState(submitImposterVote(state, { matchId: state.matchId, round: 1, playerId, targetPlayerId, now: state.updatedAt + 1 }));
  }
  assert.equal(state.phase, 'revealed');
  const result = getImposterResult(state);
  assert.deepEqual(result.accusedPlayerIds, [...result.accusedPlayerIds].sort());
  assert.ok(result.accusedPlayerIds.length >= 2);
  assert.equal(result.winner, 'imposter');
});

test('clue timeout opens voting and vote timeout reveals partial ballots without changing ties', () => {
  let state = setup();
  state = successState(advanceImposter(state, { now: state.deadline }));
  assert.equal(state.phase, 'voting');
  const imposterId = state.roles.find((role) => role.role === 'imposter')!.playerId;
  const voter = state.players.find((playerId) => playerId !== imposterId)!;
  state = successState(submitImposterVote(state, { matchId: state.matchId, round: 1, playerId: voter, targetPlayerId: imposterId, now: state.updatedAt + 1 }));
  state = successState(advanceImposter(state, { now: state.deadline + 120_000 }));
  assert.equal(state.phase, 'revealed');
  assert.deepEqual(getImposterResult(state).accusedPlayerIds, [imposterId]);
  assert.equal(getImposterResult(state).winner, 'civilians');
});

test('rejects stale match, round, unassigned players, invalid clocks, and post-reveal new actions', () => {
  let state = setup();
  assert.equal(submitImposterClue(state, { matchId: 'old-match', round: 1, playerId: 'p1', clue: 'x', now: 1_001 }).ok, false);
  assert.equal(submitImposterClue(state, { matchId: state.matchId, round: 2, playerId: 'p1', clue: 'x', now: 1_001 }).ok, false);
  assert.equal(submitImposterClue(state, { matchId: state.matchId, round: 1, playerId: 'ghost', clue: 'x', now: 1_001 }).ok, false);
  assert.equal(submitImposterClue(state, { matchId: state.matchId, round: 1, playerId: 'p1', clue: 'x', now: 999 }).ok, false);
  state = completeClues(state);
  const imposterId = state.roles.find((role) => role.role === 'imposter')!.playerId;
  for (const playerId of state.players) state = successState(submitImposterVote(state, { matchId: state.matchId, round: 1, playerId, targetPlayerId: imposterId === playerId ? state.players.find((other) => other !== playerId)! : imposterId, now: state.updatedAt + 1 }));
  assert.equal(state.phase, 'revealed');
  assert.equal(submitImposterVote(state, { matchId: state.matchId, round: 1, playerId: 'p1', targetPlayerId: 'p2', now: state.updatedAt + 1 }).ok, false);
});
