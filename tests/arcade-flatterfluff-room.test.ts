import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from '../server/engine';
import { deserializeRoomState, serializeRoomState } from '../server/serialization';
import { audienceSnapshot, hostSnapshot, playerSnapshot } from '../server/snapshots';

const start = (code = 'FLUF') => {
  const room = createRoomState(code, { contentMode: 'party', timerAccessibility: false, gameLength: 'arcade', arcadeGameId: 'flatterfluff' }, 50_000);
  for (let seat = 1; seat <= 2; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: 'player', seat, avatar: seat - 1, color: '#fff', active: true, pendingActivation: false, bot: false, lastSeenAt: 50_000, removedAt: null });
  return applyHostAction(room, { type: 'START_GAME', actionId: 'start-flatterfluff', roundId: 'lobby', expectedPhase: 'LOBBY', payload: {} }, 50_001).next;
};
const shoot = (room: ReturnType<typeof start>, playerId: string, x: number, y: number, now: number) => applyPlayerAction(room, playerId, {
  type: 'SUBMIT_FLATTERFLUFF_SHOT', actionId: `fluff-${room.flatterfluff!.round}-${playerId}-${now}`, roundId: 'lobby', expectedPhase: 'ARCADE_ACTIVE',
  payload: { matchId: room.flatterfluff!.matchId, round: room.flatterfluff!.round, x, y },
} as never, now).next;
const host = (room: ReturnType<typeof start>, transition: 'reveal' | 'next', now: number) => applyHostAction(room, {
  type: 'ADVANCE_FLATTERFLUFF', actionId: `fluff-host-${room.flatterfluff!.round}-${transition}-${now}`, roundId: 'lobby', expectedPhase: 'ARCADE_ACTIVE',
  payload: { matchId: room.flatterfluff!.matchId, round: room.flatterfluff!.round, transition },
} as never, now).next;

test('Flatterfluff room keeps phone aim private, validates input, persists, pauses, and resumes', () => {
  let room = start();
  assert.equal(room.flatterfluff?.phase, 'aiming');
  const target = room.flatterfluff!.targets[0]!;
  room = shoot(room, 'player-1', target.x, target.y, 50_002);
  assert.deepEqual(playerSnapshot(room, room.participants[0]!, 50_002).flatterfluff?.ownShot, { x: target.x, y: target.y });
  assert.equal('ownShot' in (playerSnapshot(room, room.participants[1]!, 50_002).flatterfluff ?? {}), false);
  assert.equal('result' in (hostSnapshot(room, 50_002).flatterfluff ?? {}), false);
  assert.equal('result' in (audienceSnapshot(room, { ...room.participants[0]!, id: 'audience-1', role: 'audience' }, 50_002).flatterfluff ?? {}), false);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).flatterfluff, room.flatterfluff);
  assert.throws(() => shoot(room, 'player-1', 0.3, 0.4, 50_003), /ALREADY_LOCKED/);
  assert.throws(() => shoot(room, 'player-2', 2, 0.4, 50_003));

  const paused = applyHostAction(room, { type: 'PAUSE', actionId: 'pause-fluff', roundId: 'lobby', expectedPhase: 'ARCADE_ACTIVE', payload: {} }, 50_010).next;
  assert.equal(paused.paused, true);
  assert.throws(() => shoot(paused, 'player-2', 0.4, 0.6, 50_011), /GAME_PAUSED/);
  room = applyHostAction(paused, { type: 'RESUME', actionId: 'resume-fluff', roundId: 'lobby', expectedPhase: 'ARCADE_ACTIVE', payload: {} }, 60_000).next;
  assert.equal(room.flatterfluff!.deadline, 60_000 + paused.remainingMs!);
  room = shoot(room, 'player-2', 0.2, 0.2, 60_001);
  assert.equal(hostSnapshot(room, 60_001).flatterfluff?.submittedCount, 2);
  room = host(room, 'reveal', 60_002);
  assert.equal(room.flatterfluff?.results[0]?.shots.length, 2);
});

test('Flatterfluff completes five rounds, recovers a missed deadline, and replays in the same room', async () => {
  let room = start('FLUR'); let now = 50_001;
  for (let round = 1; round <= 5; round += 1) {
    const target = room.flatterfluff!.targets[0]!;
    room = shoot(room, 'player-1', target.x, target.y, ++now);
    if (round === 1) {
      const deadline = room.flatterfluff!.deadline;
      assert.equal((await advanceState(room, deadline + 1_999)).changed, false);
      room = (await advanceState(room, deadline + 2_000)).next;
      assert.equal(room.flatterfluff?.results[0]?.outcome, 'timeout');
      assert.equal(room.flatterfluff?.results[0]?.shots.find((shot) => shot.playerId === 'player-2')?.timedOut, true);
      now = deadline + 2_000;
    } else {
      room = shoot(room, 'player-2', room.flatterfluff!.targets[0]!.x, room.flatterfluff!.targets[0]!.y, ++now);
      room = host(room, 'reveal', ++now);
    }
    if (round < 5) room = host(room, 'next', ++now);
  }
  const matchId = room.flatterfluff!.matchId;
  assert.equal(room.phase, 'ARCADE_RESULTS');
  assert.equal(room.flatterfluff?.results.length, 5);
  assert.equal(room.arcadeMatch?.status, 'COMPLETE');
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).flatterfluff, room.flatterfluff);
  const replay = applyHostAction(room, { type: 'PLAY_AGAIN', actionId: 'replay-flatterfluff', roundId: 'lobby', expectedPhase: 'ARCADE_RESULTS', payload: {} }, ++now).next;
  assert.equal(replay.code, 'FLUR');
  assert.equal(replay.phase, 'LOBBY');
  assert.equal(replay.flatterfluff, null);
  assert.equal(room.arcadeMatch?.id, matchId);
});
