import assert from 'node:assert/strict';
import test from 'node:test';
import { HostActionSchema, PlayerActionSchema } from '../lib/contracts';
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from '../server/engine';
import { deserializeRoomState, serializeRoomState } from '../server/serialization';
import { audienceSnapshot, hostSnapshot, playerSnapshot } from '../server/snapshots';

const base = { contentMode: 'party', timerAccessibility: false } as const;

function lobby(playerCount = 3, now = 1_000) {
  const room = createRoomState('MIME', { ...base, gameLength: 'arcade', arcadeGameId: 'pantomime' }, now);
  for (let seat = 1; seat <= playerCount; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: 'player', seat, avatar: seat - 1, color: '#fff', active: true, pendingActivation: false, bot: false, lastSeenAt: now, removedAt: null });
  return room;
}

function start(playerCount = 3, now = 1_000) {
  return applyHostAction(lobby(playerCount, now), { type: 'START_GAME', actionId: 'start-pantomime', roundId: 'lobby', expectedPhase: 'LOBBY', payload: {} }, now + 1).next;
}

function guessAction(playerId: string, matchId: string, attempt: number, guess: string, actionId = `${playerId}-guess-${attempt}`) {
  return { type: 'SUBMIT_PANTOMIME_GUESS', actionId, roundId: 'lobby', expectedPhase: 'ARCADE_ACTIVE', payload: { matchId, round: 1, attempt, guess } } as const;
}

function participant(room: ReturnType<typeof start>, playerId: string) { return room.participants.find((player) => player.id === playerId)!; }

test('starts Pantomime in the native room with three-player minimum and round-trip serialization', () => {
  const room = start();
  assert.equal(room.phase, 'ARCADE_ACTIVE');
  assert.equal(room.arcadeMatch?.gameId, 'pantomime');
  assert.equal(room.pantomime?.matchId, room.arcadeMatch?.id);
  assert.equal(room.deadlineAt, room.pantomime?.deadline);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).pantomime, room.pantomime);
  assert.equal(PlayerActionSchema.safeParse(guessAction(room.pantomime!.players[1]!, room.pantomime!.matchId, 1, 'A guess')).success, true);
  assert.equal(HostActionSchema.safeParse({ type: 'ADVANCE_PANTOMIME', actionId: 'reveal-schema', roundId: 'lobby', expectedPhase: 'ARCADE_ACTIVE', payload: { matchId: room.pantomime!.matchId, round: 1 } }).success, true);
  assert.throws(() => applyHostAction(lobby(2), { type: 'START_GAME', actionId: 'start-pantomime-small', roundId: 'lobby', expectedPhase: 'LOBBY', payload: {} }, 1_001), /PANTOMIME_NEEDS_THREE/);
});

test('host, performer, guessers, and spectators receive only their authorized pre-reveal snapshot data', () => {
  const room = start();
  const match = room.pantomime!;
  const host = hostSnapshot(room, room.updatedAt).pantomime;
  const performer = playerSnapshot(room, participant(room, match.performerId), room.updatedAt).pantomime;
  const guesserId = match.players.find((id) => id !== match.performerId)!;
  const guesser = playerSnapshot(room, participant(room, guesserId), room.updatedAt).pantomime;
  const spectator = audienceSnapshot(room, { ...room.participants[0]!, id: 'audience-1', role: 'audience' }, room.updatedAt).pantomime;
  assert.equal(host?.assignment, undefined);
  assert.deepEqual(performer?.assignment, { role: 'performer', prompt: match.prompt });
  assert.deepEqual(guesser?.assignment, { role: 'guesser' });
  assert.equal(spectator?.assignment, undefined);
  for (const snapshot of [host, guesser, spectator]) assert.equal(JSON.stringify(snapshot).includes(match.prompt), false);
  assert.equal(JSON.stringify(hostSnapshot(room, room.updatedAt)).includes(match.prompt), false);
});

test('per-player attempt ordering permits independent guesses and the correct answer finalizes once', () => {
  let room = start();
  const match = room.pantomime!;
  const [first, second] = match.players.filter((id) => id !== match.performerId) as [string, string];
  let now = room.updatedAt;
  room = applyPlayerAction(room, first, guessAction(first, match.matchId, 1, 'wrong first') as never, ++now).next;
  const retry = applyPlayerAction(room, first, guessAction(first, match.matchId, 1, 'wrong first', 'retry-first') as never, ++now).next;
  assert.equal(retry.pantomime?.version, room.pantomime?.version);
  assert.equal(retry.pantomime?.guesses.length, 1);
  assert.throws(() => applyPlayerAction(room, first, guessAction(first, match.matchId, 3, 'skip attempt') as never, now + 1), /ROUND_CLOSED/);
  room = applyPlayerAction(room, second, guessAction(second, match.matchId, 1, 'wrong too') as never, ++now).next;
  room = applyPlayerAction(room, first, guessAction(first, match.matchId, 2, 'another wrong') as never, ++now).next;
  const final = applyPlayerAction(room, second, guessAction(second, match.matchId, 2, match.prompt, 'correct-answer') as never, ++now);
  assert.equal(final.next.phase, 'ARCADE_RESULTS');
  assert.equal(final.next.pantomime?.outcome, 'guessed');
  assert.equal(final.next.pantomime?.winnerId, second);
  assert.equal(final.next.pantomime?.scores[second], 1_000);
  assert.equal(final.next.pantomime?.scores[match.performerId], 500);
  assert.equal(final.next.arcadeMatch?.status, 'COMPLETE');
  assert.equal(final.next.arcadeMatch?.result && (final.next.arcadeMatch.result as { outcome?: string }).outcome, 'guessed');
  const event = final.effects.find((effect) => effect.type === 'arcade_finalize');
  assert.ok(event && event.type === 'arcade_finalize');
  assert.equal(event.event.eventId, `${match.matchId}:pantomime:complete`);
  assert.equal(event.event.playerId, null);
  assert.deepEqual(deserializeRoomState(serializeRoomState(final.next)).pantomime, final.next.pantomime);
});

test('host early reveal is distinct from timeout and timeout recovery waits through grace', async () => {
  let room = start();
  const match = room.pantomime!;
  const early = applyHostAction(room, { type: 'ADVANCE_PANTOMIME', actionId: 'host-reveal-mime', roundId: 'lobby', expectedPhase: 'ARCADE_ACTIVE', payload: { matchId: match.matchId, round: 1 } }, match.updatedAt + 1);
  assert.equal(early.next.phase, 'ARCADE_RESULTS');
  assert.equal(early.next.pantomime?.outcome, 'host_reveal');
  assert.equal(early.next.pantomime?.winnerId, null);
  assert.deepEqual(deserializeRoomState(serializeRoomState(early.next)).pantomime, early.next.pantomime);

  room = start();
  const timedMatch = room.pantomime!;
  const pausedAt = timedMatch.updatedAt + 1;
  const paused = applyHostAction(room, { type: 'PAUSE', actionId: 'pause-mime', roundId: 'lobby', expectedPhase: 'ARCADE_ACTIVE', payload: {} }, pausedAt).next;
  assert.equal(paused.remainingMs, timedMatch.deadline - pausedAt);
  assert.throws(() => applyPlayerAction(paused, timedMatch.players.find((id) => id !== timedMatch.performerId)!, guessAction(timedMatch.players[0]!, timedMatch.matchId, 1, 'paused') as never, pausedAt + 1), /GAME_PAUSED/);
  const resumeAt = pausedAt + 10_000;
  room = applyHostAction(paused, { type: 'RESUME', actionId: 'resume-mime', roundId: 'lobby', expectedPhase: 'ARCADE_ACTIVE', payload: {} }, resumeAt).next;
  assert.equal(room.deadlineAt, resumeAt + (timedMatch.deadline - pausedAt));
  assert.equal(room.pantomime?.deadline, room.deadlineAt);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).pantomime, room.pantomime);
  const deadline = room.deadlineAt!;
  assert.equal((await advanceState(room, deadline + 1_999)).changed, false);
  const recovered = await advanceState(room, deadline + 2_000);
  assert.equal(recovered.changed, true);
  assert.equal(recovered.next.phase, 'ARCADE_RESULTS');
  assert.equal(recovered.next.pantomime?.outcome, 'timeout');
  assert.equal(recovered.next.pantomime?.winnerId, null);
  assert.ok(Object.values(recovered.next.pantomime!.scores).every((score) => score === 0));
  assert.equal(recovered.effects.find((effect) => effect.type === 'arcade_finalize')?.type, 'arcade_finalize');
  assert.deepEqual(deserializeRoomState(serializeRoomState(recovered.next)).pantomime, recovered.next.pantomime);
});
