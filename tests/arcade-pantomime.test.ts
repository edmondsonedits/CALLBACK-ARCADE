import assert from 'node:assert/strict';
import test from 'node:test';
import { advancePantomime, createPantomimeMatch, getPantomimeResult, pantomimeSnapshot, revealPantomime, submitPantomimeGuess } from '../server/arcade/pantomime';

const players = ['p1', 'p2', 'p3', 'p4'];
const setup = (seed = 73) => createPantomimeMatch({ matchId: 'mime-match', players, now: 5_000, seed });
const success = (result: ReturnType<typeof submitPantomimeGuess> | ReturnType<typeof advancePantomime>) => {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('Expected mutation to succeed');
  return result.state;
};
const guesser = (state: ReturnType<typeof setup>) => state.players.find((id) => id !== state.performerId)!;

test('creates deterministic matches with original prompts and valid player bounds', () => {
  const state = setup();
  assert.deepEqual(setup(), state);
  assert.equal(state.phase, 'acting');
  assert.equal(state.players.length, 4);
  assert.equal(new Set(state.players).size, 4);
  assert.equal(state.deadline - state.updatedAt, 75_000);
  assert.equal(Object.keys(state.scores).length, players.length);
  assert.notEqual(setup(74).prompt, state.prompt);
  assert.throws(() => createPantomimeMatch({ matchId: 'bad', players: ['p1', 'p1', 'p3'], now: 0, seed: 1 }));
  assert.throws(() => createPantomimeMatch({ matchId: 'bad', players: ['p1', 'p2'], now: 0, seed: 1 }));
  assert.throws(() => createPantomimeMatch({ matchId: 'bad', players, now: Number.MAX_SAFE_INTEGER, seed: 1 }));
});

test('only performer sees the prompt before reveal; host and other players get no prompt leak', () => {
  const state = setup();
  const host = pantomimeSnapshot(state, { role: 'host' });
  const spectator = pantomimeSnapshot(state, { role: 'spectator' });
  const performer = pantomimeSnapshot(state, { role: 'player', playerId: state.performerId });
  const guesserView = pantomimeSnapshot(state, { role: 'player', playerId: guesser(state) });
  assert.equal(host.assignment, undefined);
  assert.equal(spectator.assignment, undefined);
  assert.equal(JSON.stringify(host).includes(state.prompt), false);
  assert.equal(performer.assignment?.role, 'performer');
  assert.equal(performer.assignment?.prompt, state.prompt);
  assert.deepEqual(guesserView.assignment, { role: 'guesser' });
  assert.equal(JSON.stringify(guesserView).includes(state.prompt), false);
  assert.throws(() => pantomimeSnapshot(state, { role: 'player', playerId: 'outsider' }));
});

test('supports ordered per-player guesses and exact idempotent retries without locking out others', () => {
  let state = setup();
  const first = guesser(state);
  const second = state.players.find((id) => id !== state.performerId && id !== first)!;
  state = success(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId: first, guess: 'not it', now: state.updatedAt + 1 }));
  const retry = submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId: first, guess: 'not it', now: state.deadline + 1 });
  assert.equal(retry.ok, true);
  if (retry.ok) { assert.equal(retry.idempotent, true); assert.equal(retry.state.version, state.version); }
  assert.equal(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId: first, guess: 'different', now: state.updatedAt + 2 }).ok, false);
  assert.equal(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 3, playerId: first, guess: 'skip ahead', now: state.updatedAt + 2 }).ok, false);
  state = success(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId: second, guess: 'another try', now: state.updatedAt + 1 }));
  state = success(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 2, playerId: first, guess: 'still wrong', now: state.updatedAt + 1 }));
  assert.deepEqual(pantomimeSnapshot(state, { role: 'player', playerId: first }).ownGuesses, ['not it', 'still wrong']);
  assert.equal(pantomimeSnapshot(state, { role: 'host' }).ownGuesses, undefined);
});

test('normalized exact phrase guess reveals scores and full result; partial phrase matches are rejected', () => {
  let state = setup();
  const playerId = guesser(state);
  const wrong = `${state.prompt.split(' ')[0]} extra`;
  state = success(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId, guess: wrong, now: state.updatedAt + 1 }));
  assert.equal(state.phase, 'acting');
  const answer = state.prompt.toUpperCase().replaceAll(' ', ' — ');
  state = success(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 2, playerId, guess: `  ${answer}!!! `, now: state.updatedAt + 1 }));
  assert.equal(state.phase, 'revealed');
  assert.equal(state.outcome, 'guessed');
  assert.equal(state.winnerId, playerId);
  assert.equal(state.scores[playerId], 1000);
  assert.equal(state.scores[state.performerId], 500);
  assert.equal(state.version, 3);
  const result = getPantomimeResult(state);
  assert.equal(result.prompt, state.prompt);
  assert.equal(result.guesses.length, 2);
  assert.equal(result.guesses[0]?.correct, false);
  assert.equal(result.guesses[1]?.correct, true);
  assert.deepEqual(pantomimeSnapshot(state, { role: 'host' }).result, result);
  assert.throws(() => getPantomimeResult(setup()));
  assert.equal(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 3, playerId, guess: 'late', now: state.updatedAt + 1 }).ok, false);
});

test('timeout reveals the prompt without points and deadline boundaries close new guesses', () => {
  let state = setup();
  assert.equal(advancePantomime(state, { now: state.deadline - 1 }).ok, false);
  assert.equal(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId: guesser(state), guess: 'too late', now: state.deadline }).ok, false);
  state = success(advancePantomime(state, { now: state.deadline }));
  assert.equal(state.phase, 'revealed');
  assert.equal(state.outcome, 'timeout');
  assert.equal(state.winnerId, null);
  assert.ok(Object.values(state.scores).every((score) => score === 0));
  assert.equal(getPantomimeResult(state).prompt, state.prompt);
  assert.equal(advancePantomime(state, { now: state.updatedAt }).ok, false);
});

test('host reveal can safely finish an active round before its deadline', () => {
  const state = setup();
  const revealed = revealPantomime(state, { now: state.updatedAt + 1 });
  const final = success(revealed);
  assert.equal(final.phase, 'revealed');
  assert.equal(final.outcome, 'host_reveal');
  assert.equal(final.winnerId, null);
  assert.equal(final.deadline, final.updatedAt);
  assert.ok(Object.values(final.scores).every((score) => score === 0));
});

test('rejects invalid, stale, unauthorized, excessive, and out-of-order inputs or corrupt state', () => {
  const state = setup();
  const playerId = guesser(state);
  assert.equal(submitPantomimeGuess(state, { matchId: 'old', round: 1, attempt: 1, playerId, guess: 'guess', now: 5_001 }).ok, false);
  assert.equal(submitPantomimeGuess(state, { matchId: state.matchId, round: 2, attempt: 1, playerId, guess: 'guess', now: 5_001 }).ok, false);
  assert.equal(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId: 'nobody', guess: 'guess', now: 5_001 }).ok, false);
  assert.equal(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId: state.performerId, guess: 'guess', now: 5_001 }).ok, false);
  assert.equal(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId, guess: ' ', now: 5_001 }).ok, false);
  assert.equal(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId, guess: 'x'.repeat(101), now: 5_001 }).ok, false);
  assert.equal(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId, guess: 'guess', now: 4_999 }).ok, false);
  assert.equal(submitPantomimeGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId, guess: 'guess', now: Number.NaN }).ok, false);
  const corrupt = structuredClone(state); corrupt.players.push(corrupt.performerId);
  assert.deepEqual(submitPantomimeGuess(corrupt, { matchId: state.matchId, round: 1, attempt: 1, playerId, guess: 'guess', now: 5_001 }), { ok: false, code: 'INVALID_STATE' });
});
