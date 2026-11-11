import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSchaetzoramaMatch,
  SCHAETZORAMA_PROMPT_DECK,
  submitSchaetzoramaEstimate,
  advanceSchaetzorama,
  schaetzoramaSnapshot,
  getSchaetzoramaResult,
} from '../server/arcade/schaetzorama';

const players = ['p1', 'p2', 'p3'];
const setup = () => createSchaetzoramaMatch({ matchId: 'm1', players, now: 1_000, seed: 23 });
const stateOf = (result: ReturnType<typeof submitSchaetzoramaEstimate>) => {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('Unexpected submission failure');
  return result.state;
};

test('creates a five-round serializable match from an original numeric prompt deck', () => {
  const state = setup();
  assert.equal(state.roundCount, 5);
  assert.equal(state.round, 1);
  assert.equal(state.phase, 'estimating');
  assert.equal(state.prompts.length, 5);
  assert.ok(state.prompts.every((prompt) => prompt.question && prompt.unit && prompt.answer > prompt.min && prompt.answer < prompt.max));
  assert.doesNotThrow(() => JSON.stringify(state));
  assert.ok(state.prompts.every(({ question, unit }) => question.includes(unit)));
  assert.ok(SCHAETZORAMA_PROMPT_DECK.every(({ question, unit }) => question.includes(unit)));
  assert.ok(SCHAETZORAMA_PROMPT_DECK.every(({ question }) => !/typical|standard adult|household bathtub|doorway|fingernail|A4|bathtub|one-cup/i.test(question)));
  assert.equal(SCHAETZORAMA_PROMPT_DECK.find(({ id }) => id === 'kp-est-12')?.answer, 299_792_458);
  assert.ok(SCHAETZORAMA_PROMPT_DECK.filter(({ id }) => ['kp-est-13', 'kp-est-14', 'kp-est-15'].includes(id)).every(({ sourceUrl }) => sourceUrl === 'https://science.nasa.gov/moon/facts/'));
  const inferredMoonDiameter = SCHAETZORAMA_PROMPT_DECK.find(({ id }) => id === 'kp-est-15');
  assert.match(inferredMoonDiameter?.question ?? '', /twice.*approximate mean radius.*approximate diameter/i);
  assert.equal(inferredMoonDiameter?.answer, 2 * (SCHAETZORAMA_PROMPT_DECK.find(({ id }) => id === 'kp-est-14')?.answer ?? NaN));
});

test('rejects prototype-sensitive player identifiers', () => {
  for (const playerId of ['__proto__', 'constructor', 'toString']) {
    assert.throws(() => createSchaetzoramaMatch({ matchId: 'bad-id', players: [playerId, 'p2'], now: 1_000, seed: 1 }));
  }
});

test('keeps answer and other estimates private until reveal', () => {
  const state = setup();
  const submitted = submitSchaetzoramaEstimate(state, { playerId: 'p1', round: 1, version: 0, estimate: state.prompts[0].answer, now: 2_000 });
  assert.equal(submitted.ok, true);
  const submittedState = stateOf(submitted);
  const own = schaetzoramaSnapshot(submittedState, { role: 'player', playerId: 'p1' });
  const other = schaetzoramaSnapshot(submittedState, { role: 'player', playerId: 'p2' });
  assert.equal(own.answer, undefined);
  assert.equal(own.estimate, state.prompts[0].answer);
  assert.equal(other.answer, undefined);
  assert.equal(other.estimate, undefined);
  assert.equal(other.submitted, false);
  assert.equal(schaetzoramaSnapshot(submitted.state, { role: 'host' }).answer, undefined);
});

test('validates eligible players, integer bounds, round/version, and duplicate locks', () => {
  const state = setup();
  assert.equal(submitSchaetzoramaEstimate(state, { playerId: 'intruder', round: 1, version: 0, estimate: 2, now: 2_000 }).ok, false);
  assert.equal(submitSchaetzoramaEstimate(state, { playerId: 'p1', round: 2, version: 0, estimate: 2, now: 2_000 }).ok, false);
  assert.equal(submitSchaetzoramaEstimate(state, { playerId: 'p1', round: 1, version: 1, estimate: 2, now: 2_000 }).ok, false);
  assert.equal(submitSchaetzoramaEstimate(state, { playerId: 'p1', round: 1, version: 0, estimate: 2.4, now: 2_000 }).ok, false);
  const prompt = state.prompts[0];
  assert.equal(submitSchaetzoramaEstimate(state, { playerId: 'p1', round: 1, version: 0, estimate: prompt.max + 1, now: 2_000 }).ok, false);
  const firstEstimate = prompt.answer;
  const first = submitSchaetzoramaEstimate(state, { playerId: 'p1', round: 1, version: 0, estimate: firstEstimate, now: 2_000 });
  const duplicate = submitSchaetzoramaEstimate(stateOf(first), { playerId: 'p1', round: 1, version: 0, estimate: firstEstimate, now: 2_000 });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.idempotent, true);
  const changed = submitSchaetzoramaEstimate(stateOf(first), { playerId: 'p1', round: 1, version: 1, estimate: firstEstimate + 1, now: 2_001 });
  assert.equal(changed.ok, false);
});

test('locks submissions at deadline, reveals on timeout, and continues with time reset', () => {
  let state = setup();
  const late = submitSchaetzoramaEstimate(state, { playerId: 'p1', round: 1, version: 0, estimate: state.prompts[0].answer, now: state.deadline + 1 });
  assert.equal(late.ok, false);
  const reveal = advanceSchaetzorama(state, { now: state.deadline });
  assert.equal(reveal.ok, true);
  if (!reveal.ok) throw new Error('Unexpected reveal failure');
  state = reveal.state;
  assert.equal(state.phase, 'revealing');
  const snapshot = schaetzoramaSnapshot(state, { role: 'player', playerId: 'p1' });
  assert.notEqual(snapshot.answer, undefined);
  assert.equal(snapshot.estimates.length, 0);
  const next = advanceSchaetzorama(state, { now: state.deadline + 1 });
  if (!next.ok) throw new Error('Unexpected next round failure');
  assert.equal(next.state.round, 2);
  assert.equal(next.state.phase, 'estimating');
  assert.ok(next.state.deadline > next.state.updatedAt);
});

test('late timeout processing keeps the revealed, next-round, and completed states valid', () => {
  let state = setup();
  const delayed = advanceSchaetzorama(state, { now: state.deadline + 120_000 });
  assert.equal(delayed.ok, true);
  if (!delayed.ok) throw new Error('Unexpected delayed reveal failure');
  state = delayed.state;
  assert.doesNotThrow(() => schaetzoramaSnapshot(state, { role: 'host' }));
  const next = advanceSchaetzorama(state, { now: state.updatedAt + 1 });
  assert.equal(next.ok, true);
  if (!next.ok) throw new Error('Unexpected next round failure');
  state = next.state;
  assert.ok(state.deadline > state.updatedAt);

  while (state.round < state.roundCount) {
    const reveal = advanceSchaetzorama(state, { now: state.deadline + 90_000 });
    assert.equal(reveal.ok, true);
    if (!reveal.ok) throw new Error('Unexpected late reveal failure');
    state = reveal.state;
    if (state.round < state.roundCount) {
      const nextRound = advanceSchaetzorama(state, { now: state.updatedAt + 1 });
      assert.equal(nextRound.ok, true);
      if (!nextRound.ok) throw new Error('Unexpected next round failure');
      state = nextRound.state;
    }
  }
  const reveal = advanceSchaetzorama(state, { now: state.deadline + 90_000 });
  assert.equal(reveal.ok, true);
  if (!reveal.ok) throw new Error('Unexpected final reveal failure');
  const finished = advanceSchaetzorama(reveal.state, { now: reveal.state.updatedAt + 90_000 });
  assert.equal(finished.ok, true);
  if (!finished.ok) throw new Error('Unexpected finalization failure');
  assert.doesNotThrow(() => getSchaetzoramaResult(finished.state));
});

test('an exact submission retry remains idempotent after timeout/reveal while new estimates stay locked', () => {
  let state = setup();
  const prompt = state.prompts[0];
  const first = submitSchaetzoramaEstimate(state, { playerId: 'p1', round: 1, version: 0, estimate: prompt.answer, now: state.updatedAt + 1 });
  assert.equal(first.ok, true);
  state = stateOf(first);
  const retryAfterCutoff = submitSchaetzoramaEstimate(state, { playerId: 'p1', round: 1, version: 0, estimate: prompt.answer, now: state.deadline + 1 });
  assert.equal(retryAfterCutoff.ok, true);
  if (!retryAfterCutoff.ok) throw new Error('Exact retry must remain idempotent after the cutoff');
  assert.equal(retryAfterCutoff.idempotent, true);
  const reveal = advanceSchaetzorama(state, { now: state.deadline + 2_000 });
  assert.equal(reveal.ok, true);
  if (!reveal.ok) throw new Error('Unexpected reveal failure');
  state = reveal.state;
  const retry = submitSchaetzoramaEstimate(state, { playerId: 'p1', round: 1, version: 0, estimate: prompt.answer, now: state.updatedAt + 1 });
  assert.equal(retry.ok, true);
  if (!retry.ok) throw new Error('Exact retry must remain idempotent');
  assert.equal(retry.idempotent, true);
  assert.equal(retry.state.version, state.version);
  const newSubmission = submitSchaetzoramaEstimate(state, { playerId: 'p2', round: 1, version: state.version, estimate: prompt.answer, now: state.updatedAt + 1 });
  assert.equal(newSubmission.ok, false);
});

test('reveal awards closest points, handles ties, and finalizes after five rounds', () => {
  let state = setup();
  for (let round = 1; round <= 5; round += 1) {
    const prompt = state.prompts[round - 1];
    for (const playerId of players) {
      const estimate = playerId === 'p1' ? prompt.answer - 1 : playerId === 'p2' ? prompt.answer + 1 : prompt.max;
      const submitted = submitSchaetzoramaEstimate(state, { playerId, round, version: state.version, estimate, now: state.updatedAt + 1 });
      assert.equal(submitted.ok, true);
      state = stateOf(submitted);
    }
    const reveal = advanceSchaetzorama(state, { now: state.updatedAt });
    assert.equal(reveal.ok, true);
    if (!reveal.ok) throw new Error('Unexpected reveal failure');
    state = reveal.state;
    assert.deepEqual(schaetzoramaSnapshot(state, { role: 'host' }).winners.sort(), ['p1', 'p2']);
    assert.equal(schaetzoramaSnapshot(state, { role: 'host' }).estimates.length, 3);
    if (round < 5) {
      const next = advanceSchaetzorama(state, { now: state.updatedAt + 1 });
      assert.equal(next.ok, true);
      if (!next.ok) throw new Error('Unexpected next round failure');
      state = next.state;
    } else {
      const final = advanceSchaetzorama(state, { now: state.updatedAt + 1 });
      assert.equal(final.ok, true);
      if (!final.ok) throw new Error('Unexpected finish failure');
      state = final.state;
    }
  }
  assert.equal(state.phase, 'completed');
  assert.deepEqual(getSchaetzoramaResult(state).scores, { p1: 5, p2: 5, p3: 0 });
});

test('rejects backward or invalid clocks without mutating the input state', () => {
  const state = setup();
  const backwards = submitSchaetzoramaEstimate(state, { playerId: 'p1', round: 1, version: 0, estimate: 1, now: 999 });
  assert.equal(backwards.ok, false);
  assert.equal(state.version, 0);
  assert.equal(state.phase, 'estimating');
  assert.equal(advanceSchaetzorama(state, { now: Number.NaN }).ok, false);
});
