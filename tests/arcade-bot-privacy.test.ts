import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomState, applyHostAction } from '../server/engine';
import { arcadeBotAction } from '../server/arcade/bot-turns';

function start(arcadeGameId: 'imposter' | 'schaetzorama' | 'schattenjagd') {
  const state = createRoomState('FAIR', { gameLength: 'arcade', arcadeGameId, contentMode: 'party', timerAccessibility: false }, 1000);
  for (let seat = 1; seat <= 3; seat++) state.participants.push({ id: `p${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: 'player', seat, avatar: seat, color: '#fff', active: true, pendingActivation: false, bot: true, lastSeenAt: 1000, removedAt: null });
  return applyHostAction(state, { type: 'START_GAME', actionId: 'start', roundId: 'lobby', expectedPhase: 'LOBBY', payload: {} }, 1001).next;
}

test('Imposter bot ballots depend on public clues, not the hidden impostor identity', () => {
  const state = start('imposter');
  assert.ok(state.imposter);
  state.imposter.phase = 'voting'; state.imposter.clues = { p1: 'spice', p2: 'sweet', p3: 'baking' };
  state.imposter.roles = [{ playerId: 'p1', role: 'civilian' }, { playerId: 'p2', role: 'imposter' }, { playerId: 'p3', role: 'civilian' }];
  const changed = structuredClone(state);
  changed.imposter!.roles = [{ playerId: 'p1', role: 'civilian' }, { playerId: 'p2', role: 'civilian' }, { playerId: 'p3', role: 'imposter' }];
  const action = arcadeBotAction(state, 'p1'); assert.equal(action?.type, 'SUBMIT_IMPOSTER_VOTE');
  assert.deepEqual(arcadeBotAction(changed, 'p1'), action);
});

test('estimate bots do not read correct answers and deduction bots do not peek at other ballots', () => {
  const estimate = start('schaetzorama'); assert.ok(estimate.schaetzorama);
  const differentAnswer = structuredClone(estimate);
  differentAnswer.schaetzorama!.prompts[0]!.answer += 10;
  const action = arcadeBotAction(estimate, 'p1'); assert.equal(action?.type, 'SUBMIT_SCHAETZORAMA_ESTIMATE');
  assert.deepEqual(arcadeBotAction(differentAnswer, 'p1'), action);

  const mystery = start('schattenjagd'); assert.ok(mystery.schattenjagd);
  mystery.schattenjagd.choices.p2 = mystery.schattenjagd.cases[0]!.suspects[0]!.id;
  const differentTarget = structuredClone(mystery);
  const currentCase = differentTarget.schattenjagd!.cases[0]!;
  differentTarget.schattenjagd!.choices.p2 = currentCase.suspects[1]!.id;
  const choice = arcadeBotAction(mystery, 'p1'); assert.equal(choice?.type, 'SUBMIT_SCHATTENJAGD_VOTE');
  assert.deepEqual(arcadeBotAction(differentTarget, 'p1'), choice);
});
