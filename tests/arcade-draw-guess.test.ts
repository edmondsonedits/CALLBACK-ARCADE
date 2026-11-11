import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceDrawGuess, createDrawGuessMatch, DRAW_GUESS_MAX_POINTS, drawGuessSnapshot, getDrawGuessResult,
  revealDrawGuess, submitDrawGuess, submitDrawGuessDrawing,
} from '../server/arcade/draw_guess';

const players = ['p1', 'p2', 'p3', 'p4'];
const setup = (seed = 61) => createDrawGuessMatch({ matchId: 'draw-match', players, now: 10_000, seed });
const stroke = { color: '#1a2b3c', width: 6, points: [{ x: 10, y: 20 }, { x: 500, y: 600 }, { x: 990, y: 800 }] };
const success = (result: ReturnType<typeof submitDrawGuess> | ReturnType<typeof submitDrawGuessDrawing> | ReturnType<typeof advanceDrawGuess> | ReturnType<typeof revealDrawGuess>) => {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('Expected mutation to succeed');
  return result.state;
};
const guesser = (state: ReturnType<typeof setup>) => state.players.find((id) => id !== state.artistId)!;
const submitDrawing = (state: ReturnType<typeof setup>) => success(submitDrawGuessDrawing(state, {
  matchId: state.matchId, round: state.round, playerId: state.artistId, drawing: [stroke], now: state.updatedAt + 1,
}));

test('creates deterministic matches and selects original prompts within player bounds', () => {
  const state = setup();
  assert.deepEqual(setup(), state);
  assert.equal(state.phase, 'drawing');
  assert.equal(state.deadline - state.updatedAt, 90_000);
  assert.equal(Object.keys(state.scores).length, players.length);
  assert.notEqual(setup(62).prompt, state.prompt);
  assert.throws(() => createDrawGuessMatch({ matchId: 'bad', players: ['p1', 'p1', 'p3'], now: 0, seed: 1 }));
  assert.throws(() => createDrawGuessMatch({ matchId: 'bad', players: ['p1', 'p2'], now: 0, seed: 1 }));
});

test('keeps prompt private to artist and drawing unavailable until artist submits', () => {
  const state = setup();
  const host = drawGuessSnapshot(state, { role: 'host' });
  const spectator = drawGuessSnapshot(state, { role: 'spectator' });
  const artist = drawGuessSnapshot(state, { role: 'player', playerId: state.artistId });
  const guesserView = drawGuessSnapshot(state, { role: 'player', playerId: guesser(state) });
  assert.equal(JSON.stringify(host).includes(state.prompt), false);
  assert.equal(JSON.stringify(spectator).includes(state.prompt), false);
  assert.equal(artist.assignment?.prompt, state.prompt);
  assert.deepEqual(guesserView.assignment, { role: 'guesser' });
  assert.equal(guesserView.drawing, undefined);
  assert.throws(() => drawGuessSnapshot(state, { role: 'player', playerId: 'outsider' }));
});

test('validates stroke counts, coordinates, and total payload before phase change', () => {
  const state = setup();
  const oversized = { ...stroke, points: Array.from({ length: DRAW_GUESS_MAX_POINTS + 1 }, (_, x) => ({ x: x % 1001, y: 0 })) };
  const invalids = [[], [{ ...stroke, color: 'red' }], [{ ...stroke, points: [{ x: -1, y: 0 }] }], [oversized]];
  for (const drawing of invalids) {
    const result = submitDrawGuessDrawing(state, { matchId: state.matchId, round: 1, playerId: state.artistId, drawing, now: state.updatedAt + 1 });
    assert.deepEqual(result, { ok: false, code: 'INVALID_INPUT' });
  }
  assert.equal(state.phase, 'drawing');
});

test('only artist submits once and transitions to a bounded guessing phase', () => {
  const state = setup();
  const unauthorized = submitDrawGuessDrawing(state, { matchId: state.matchId, round: 1, playerId: guesser(state), drawing: [stroke], now: state.updatedAt + 1 });
  assert.deepEqual(unauthorized, { ok: false, code: 'UNAUTHORIZED' });
  const guessing = submitDrawing(state);
  assert.equal(guessing.phase, 'guessing');
  assert.equal(guessing.deadline - guessing.updatedAt, 60_000);
  assert.deepEqual(drawGuessSnapshot(guessing, { role: 'host' }).drawing, [stroke]);
  const retry = submitDrawGuessDrawing(guessing, { matchId: state.matchId, round: 1, playerId: state.artistId, drawing: [stroke], now: guessing.updatedAt + 1 });
  assert.equal(retry.ok, true);
  if (retry.ok) assert.equal(retry.idempotent, true);
});

test('accepts per-player guesses, normalizes Unicode and punctuation, and settles score deterministically', () => {
  let state = submitDrawing(setup());
  const first = guesser(state);
  const second = state.players.find((id) => id !== state.artistId && id !== first)!;
  state = success(submitDrawGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId: first, guess: 'definitely wrong', now: state.updatedAt + 1 }));
  assert.equal(state.phase, 'guessing');
  const own = drawGuessSnapshot(state, { role: 'player', playerId: first });
  assert.deepEqual(own.ownGuesses, ['definitely wrong']);
  assert.equal(JSON.stringify(own).includes(state.prompt), false);
  assert.equal(own.assignment?.prompt, undefined);
  const retry = submitDrawGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId: first, guess: 'definitely wrong', now: state.deadline + 1 });
  assert.equal(retry.ok, true);
  if (retry.ok) assert.equal(retry.idempotent, true);
  state = success(submitDrawGuess(state, { matchId: state.matchId, round: 1, attempt: 1, playerId: second, guess: state.prompt.toLocaleUpperCase('und').replaceAll(' ', '!!!'), now: state.updatedAt + 1 }));
  assert.equal(state.phase, 'revealed');
  assert.equal(state.winnerId, second);
  assert.deepEqual(state.scores, { [players[0]!]: players[0] === second ? 1000 : players[0] === state.artistId ? 500 : 0,
    [players[1]!]: players[1] === second ? 1000 : players[1] === state.artistId ? 500 : 0,
    [players[2]!]: players[2] === second ? 1000 : players[2] === state.artistId ? 500 : 0,
    [players[3]!]: players[3] === second ? 1000 : players[3] === state.artistId ? 500 : 0 });
  const result = getDrawGuessResult(state);
  assert.equal(result.prompt, state.prompt);
  assert.deepEqual(result.drawing, [stroke]);
  assert.equal(result.guesses.length, 2);
});

test('recovers both phase deadlines and supports a host reveal without inventing strokes', () => {
  const drawing = setup();
  assert.deepEqual(advanceDrawGuess(drawing, { now: drawing.deadline - 1 }), { ok: false, code: 'TOO_EARLY' });
  const drawingTimedOut = success(advanceDrawGuess(drawing, { now: drawing.deadline }));
  assert.equal(drawingTimedOut.outcome, 'timeout');
  assert.equal(drawingTimedOut.drawing, undefined);
  assert.equal(getDrawGuessResult(drawingTimedOut).drawing, undefined);
  const guessing = submitDrawing(setup());
  const guessingTimedOut = success(advanceDrawGuess(guessing, { now: guessing.deadline }));
  assert.equal(guessingTimedOut.phase, 'revealed');
  assert.equal(guessingTimedOut.outcome, 'timeout');
  assert.deepEqual(guessingTimedOut.drawing, [stroke]);
  const earlyReveal = success(revealDrawGuess(setup(), { now: setup().updatedAt + 5 }));
  assert.equal(earlyReveal.outcome, 'host_reveal');
  assert.equal(earlyReveal.drawing, undefined);
});
