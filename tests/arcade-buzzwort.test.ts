import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceBuzzwort,
  createBuzzwortMatch,
  getBuzzwortResult,
  submitBuzzwortClue,
  submitBuzzwortGuess,
  buzzwortSnapshot,
} from '../server/arcade/buzzwort';

const players = ['p1', 'p2', 'p3', 'p4'];
const setup = (seed = 81) => createBuzzwortMatch({ matchId: 'buzz-match', players, now: 5_000, seed });
const stateOf = (result: { ok: boolean; state?: ReturnType<typeof setup> }) => {
  assert.equal(result.ok, true);
  if (!result.ok || !result.state) throw new Error('Expected a successful Buzzwort action');
  return result.state;
};
const clue = (state: ReturnType<typeof setup>) => `a familiar thing with ${state.card.tabooWords.length} covered terms`;
const clueAction = (state: ReturnType<typeof setup>, input: { playerId?: string; text?: string; now?: number; matchId?: string; round?: number; attempt?: number } = {}) => submitBuzzwortClue(state, {
  matchId: input.matchId ?? state.matchId,
  round: input.round ?? state.round,
  attempt: input.attempt ?? state.attempt,
  playerId: input.playerId ?? state.clueGiverId,
  text: input.text ?? clue(state),
  now: input.now ?? state.updatedAt + 1,
});
const guessAction = (state: ReturnType<typeof setup>, input: { playerId?: string; guess?: string; now?: number; matchId?: string; round?: number; attempt?: number } = {}) => submitBuzzwortGuess(state, {
  matchId: input.matchId ?? state.matchId,
  round: input.round ?? state.round,
  attempt: input.attempt ?? state.attempt,
  playerId: input.playerId ?? state.guesserId,
  guess: input.guess ?? 'not the answer',
  now: input.now ?? state.updatedAt + 1,
});

test('creates a deterministic balanced short-round match and original card deck', () => {
  const state = setup();
  assert.deepEqual(setup(), state);
  assert.equal(state.phase, 'clue');
  assert.equal(state.round, 1);
  assert.equal(state.players.length, 4);
  assert.equal(new Set(state.players).size, state.players.length);
  assert.ok(state.card.word.length > 0);
  assert.ok(state.card.tabooWords.length >= 3);
  assert.doesNotThrow(() => JSON.stringify(state));
  assert.throws(() => createBuzzwortMatch({ matchId: 'too-small', players: ['p1', 'p2'], now: 0, seed: 1 }));
  assert.throws(() => createBuzzwortMatch({ matchId: 'duplicate', players: ['p1', 'p1', 'p2'], now: 0, seed: 1 }));
});

test('only the clue giver receives the target and blocked words before the reveal', () => {
  const state = setup();
  const giverId = state.clueGiverId;
  const guesserId = state.guesserId;
  const host = buzzwortSnapshot(state, { role: 'host' });
  const giver = buzzwortSnapshot(state, { role: 'player', playerId: giverId });
  const guesser = buzzwortSnapshot(state, { role: 'player', playerId: guesserId });
  const watcher = buzzwortSnapshot(state, { role: 'spectator' });
  assert.equal(giver.assignment?.role, 'clue_giver');
  assert.equal(giver.assignment?.card?.word, state.card.word);
  assert.deepEqual(giver.assignment?.card?.tabooWords, state.card.tabooWords);
  assert.equal(guesser.assignment?.role, 'guesser');
  assert.equal(guesser.assignment?.card, undefined);
  assert.equal(host.assignment, undefined);
  assert.equal(watcher.assignment, undefined);
  assert.equal(JSON.stringify(host).includes(state.card.word), false);
  assert.equal(JSON.stringify(guesser).includes(state.card.word), false);
  assert.equal(JSON.stringify(watcher).includes(state.card.word), false);
});

test('accepts one safe clue from the giver and exact retries remain idempotent', () => {
  let state = setup();
  const text = clue(state);
  const first = clueAction(state, { text, now: state.updatedAt + 1 });
  state = stateOf(first);
  assert.equal(state.version, 1);
  assert.equal(state.phase, 'guess');
  assert.equal(state.currentClue, text);
  const retry = clueAction(state, { text, now: state.deadline + 1 });
  assert.equal(retry.ok, true);
  if (retry.ok) {
    assert.equal(retry.idempotent, true);
    assert.equal(retry.state.version, state.version);
  }
  assert.equal(clueAction(state, { text: 'different', now: state.updatedAt + 1 }).ok, false);
  assert.equal(clueAction(state, { playerId: state.guesserId, text, now: state.updatedAt + 1 }).ok, false);
  assert.equal(clueAction(state, { matchId: 'old-match', text, now: state.updatedAt + 1 }).ok, false);
  assert.equal(clueAction(state, { round: 2, text, now: state.updatedAt + 1 }).ok, false);
});

test('rejects target and taboo words as whole words regardless of case or punctuation', () => {
  for (const offending of [setup().card.word, setup().card.tabooWords[0]!]) {
    const state = setup();
    const text = `${offending.toUpperCase()}!`; // Card is deterministic for this seed.
    const result = clueAction(state, { text, now: state.updatedAt + 1 });
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(result.state.phase, 'revealed');
    assert.equal(result.state.outcome, 'taboo');
    assert.equal(result.state.winnerTeam, state.watcherTeam);
  }
});

test('one wrong guess returns to clue phase; an exact answer reveals and awards the active team once', () => {
  let state = setup();
  const previousClue = clue(state);
  state = stateOf(clueAction(state, { text: previousClue, now: state.updatedAt + 1 }));
  const guesser = state.guesserId;
  state = stateOf(guessAction(state, { playerId: guesser, guess: 'certainly not the answer', now: state.updatedAt + 1 }));
  assert.equal(state.phase, 'clue');
  assert.equal(state.currentClue, undefined);
  assert.equal(state.guesses.length, 1);
  assert.equal(guessAction(state, { playerId: guesser, guess: 'another delayed guess', attempt: 1, now: state.updatedAt + 1 }).ok, false);
  const oldClueRetry = clueAction(state, { text: previousClue, attempt: 1, now: state.updatedAt + 1 });
  assert.equal(oldClueRetry.ok, true);
  if (oldClueRetry.ok) assert.equal(oldClueRetry.idempotent, true);
  state = stateOf(clueAction(state, { now: state.updatedAt + 1 }));
  const guessText = `  ${state.card.word.toUpperCase()}! `;
  const result = guessAction(state, { playerId: guesser, guess: guessText, now: state.updatedAt + 1 });
  state = stateOf(result);
  assert.equal(state.phase, 'revealed');
  assert.equal(state.outcome, 'guessed');
  assert.equal(state.winnerTeam, state.activeTeam);
  assert.equal(state.scores[state.activeTeam], 1);
  const retry = guessAction(state, { playerId: guesser, guess: guessText, attempt: 2, now: state.updatedAt + 1 });
  assert.equal(retry.ok, true);
  if (retry.ok) assert.equal(retry.idempotent, true);
  assert.deepEqual(getBuzzwortResult(state), getBuzzwortResult(state));
});

test('deadline recovery ends the round safely and exposes the card only in the result', () => {
  let state = setup();
  assert.equal(advanceBuzzwort(state, { now: state.deadline - 1 }).ok, false);
  state = stateOf(advanceBuzzwort(state, { now: state.deadline }));
  assert.equal(state.phase, 'revealed');
  assert.equal(state.outcome, 'timeout');
  assert.equal(state.winnerTeam, state.watcherTeam);
  const host = buzzwortSnapshot(state, { role: 'host' });
  assert.equal(host.result?.card.word, state.card.word);
  assert.deepEqual(host.result?.card.tabooWords, state.card.tabooWords);
  assert.equal(getBuzzwortResult(state).winnerTeam, state.watcherTeam);
});

test('rejects malformed, stale, unassigned, repeated-phase and overdue actions without state corruption', () => {
  const state = setup();
  const text = clue(state);
  assert.equal(clueAction(state, { matchId: 'old', text, now: state.updatedAt + 1 }).ok, false);
  assert.equal(clueAction(state, { round: 2, text, now: state.updatedAt + 1 }).ok, false);
  assert.equal(clueAction(state, { playerId: 'outsider', text, now: state.updatedAt + 1 }).ok, false);
  assert.equal(clueAction(state, { text: 'x'.repeat(121), now: state.updatedAt + 1 }).ok, false);
  assert.equal(guessAction(state, { guess: state.card.word, now: state.updatedAt + 1 }).ok, false);
  assert.equal(clueAction(state, { text, now: state.deadline }).ok, false);
});
